'use strict';

/**
 * HomiCart — Local Dev Server
 * ─────────────────────────────────────────────────────────────
 * Priority for /api/sheets calls:
 *   1. backend/service-account.json present  → Google Sheets API directly
 *   2. APPS_SCRIPT_URL configured            → Apps Script proxy
 *   3. Neither                               → local JSON mock (data/local_orders.json)
 *
 * To connect Google Sheets:
 *   a) Google Cloud Console → Enable Sheets API → Create Service Account
 *   b) Download JSON key → save as  backend/service-account.json
 *   c) Share the spreadsheet with the service account email
 *   d) Restart this server — orders go straight to Google Sheets
 * ─────────────────────────────────────────────────────────────
 */

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════
const BASE_DIR = path.resolve('D:\\MyBusiness\\HomiCart');
const PORT     = 3000;

// Google Sheets spreadsheet ID
const SS_ID = '1txQXRi-19VIDNHQej5vnqYku5-clPOj3QR_JqXKYQI0';

// Service account key (place your downloaded JSON here to enable direct Sheets access)
const SA_FILE = path.join(BASE_DIR, 'backend', 'service-account.json');

// Apps Script fallback (if no service account and you have a deployed Web App)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_SCRIPT_ID/exec';

// Local mock fallback
const MOCK_DB_FILE = path.join(BASE_DIR, 'data', 'local_orders.json');

// ── MIME types ──────────────────────────────────────────────────
const MIME = {
  '.html' : 'text/html; charset=utf-8',
  '.css'  : 'text/css',
  '.js'   : 'application/javascript',
  '.json' : 'application/json',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.gif'  : 'image/gif',
  '.webp' : 'image/webp',
  '.bmp'  : 'image/bmp',
  '.svg'  : 'image/svg+xml',
  '.ico'  : 'image/x-icon',
  '.woff' : 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf'  : 'font/ttf',
  '.eot'  : 'application/vnd.ms-fontobject',
  '.mp4'  : 'video/mp4',
  '.webm' : 'video/webm',
};

// Image extensions the API will return
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);

// ── Helpers ──────────────────────────────────────────────────────

/** Safely join base + relative — returns null if path escapes base */
function safeJoin(base, rel) {
  const resolved = path.resolve(path.join(base, rel));
  return resolved.startsWith(base + path.sep) || resolved === base
    ? resolved
    : null;
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type'               : 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control'              : 'no-store',
    'Content-Length'             : Buffer.byteLength(body),
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type'               : mime,
    'Content-Length'             : stat.size,
    'Cache-Control'              : 'no-store',   // always serve fresh — never cache locally
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
}

// ── Server ───────────────────────────────────────────────────────
http.createServer((req, res) => {

  const parsed   = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  // ── OPTIONS preflight ─────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    res.end();
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  //  API  →  POST /api/sheets
  //  Proxies the request to Google Apps Script (follows redirects,
  //  keeps POST body so doPost() in Code.gs receives the payload).
  // ═══════════════════════════════════════════════════════════════
  if (pathname === '/api/sheets') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const sa            = _loadSA();
      const hasAppsScript = !APPS_SCRIPT_URL.includes('REPLACE_WITH');

      if (sa) {
        // ── Priority 1: Direct Google Sheets API via service account ──
        _handleSheets(body)
          .then(result => { console.log(`  📊  [Sheets API]`, JSON.parse(body).action, '→', JSON.stringify(result).slice(0,80)); sendJSON(res, 200, result); })
          .catch(err   => { console.error('[Sheets API error]', err.message); sendJSON(res, 502, { error: err.message }); });
      } else if (hasAppsScript) {
        // ── Priority 2: Apps Script proxy ────────────────────────────
        _forwardToScript(body, 0, (err, result) => {
          if (err) return sendJSON(res, 502, { error: err.message });
          sendJSON(res, 200, result);
        });
      } else {
        // ── Priority 3: Local JSON mock ───────────────────────────────
        _handleMock(body, (err, result) => {
          if (err) return sendJSON(res, 500, { error: err.message });
          sendJSON(res, 200, result);
        });
      }
    });
    return;
  }

  // ── View all locally-stored orders (mock mode only) ──────────────
  if (pathname === '/api/orders') {
    const db = _loadMock();
    sendJSON(res, 200, db);
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  //  API  →  GET /api/list-images?folder=<relative-path>
  //  Returns JSON: { files: [{ name, url }] }
  //  Only files whose extension is in IMG_EXT are returned.
  // ═══════════════════════════════════════════════════════════════
  if (pathname === '/api/list-images') {
    const folder     = (parsed.query.folder || '');
    const folderPath = safeJoin(BASE_DIR, folder);

    if (!folderPath) {
      return sendJSON(res, 403, { error: 'Forbidden', files: [] });
    }

    fs.readdir(folderPath, (err, files) => {
      if (err) {
        return sendJSON(res, 404, { error: 'Folder not found', files: [] });
      }

      // Build a URL-safe path for each image
      const folderUrlPart = folder
        .replace(/\\/g, '/')
        .split('/')
        .map(encodeURIComponent)
        .join('/');

      const images = files
        .filter(f => IMG_EXT.has(path.extname(f).toLowerCase()))
        .sort()                        // consistent ordering
        .map(f => ({
          name : f,
          url  : '/' + folderUrlPart + '/' + encodeURIComponent(f),
        }));

      return sendJSON(res, 200, { files: images });
    });
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Static file serving
  // ═══════════════════════════════════════════════════════════════
  const filePath = safeJoin(BASE_DIR, pathname);

  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 – Not found: ' + pathname);
      return;
    }
    try {
      sendFile(res, filePath);
    } catch (e) {
      res.writeHead(500);
      res.end('Server error');
    }
  });


// ══════════════════════════════════════════════════════════════════
//  GOOGLE SHEETS API  (active when backend/service-account.json exists)
//
//  Column layout expected in every sheet:
//   DataBase:    A=ClientID  B=Name  C=Phone  D=Emirate  E=Address  F=RegDate
//   Store tabs:  A=TempID  B=OrderID  C=ClientID  D=Name  E=Phone
//                F=Items  G=Emirate  H=Address  I=DateTime  J=Status
// ══════════════════════════════════════════════════════════════════
let _sa         = null;
let _saLoaded   = false;
let _tokenCache = { token: null, exp: 0 };

function _loadSA() {
  if (_saLoaded) return _sa;
  _saLoaded = true;
  try {
    _sa = JSON.parse(fs.readFileSync(SA_FILE, 'utf8'));
    console.log('  ✅  Service account loaded:', _sa.client_email);
  } catch(e) {
    _sa = null;
  }
  return _sa;
}

async function _getAccessToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.exp - 60000) return _tokenCache.token;
  const sa = _loadSA();
  if (!sa) throw new Error('service-account.json not found');

  const now = Math.floor(Date.now() / 1000);
  const hdr  = Buffer.from(JSON.stringify({ alg:'RS256', typ:'JWT' })).toString('base64url');
  const pay  = Buffer.from(JSON.stringify({
    iss  : sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud  : 'https://oauth2.googleapis.com/token',
    exp  : now + 3600,
    iat  : now,
  })).toString('base64url');

  const unsigned = `${hdr}.${pay}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const jwt = `${unsigned}.${sig}`;

  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const tokenData = await _httpsReq('POST','oauth2.googleapis.com','/token', body,
    { 'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body) });

  if (!tokenData.access_token) throw new Error('Token error: ' + JSON.stringify(tokenData));
  _tokenCache = { token: tokenData.access_token, exp: Date.now() + (tokenData.expires_in||3600)*1000 };
  return _tokenCache.token;
}

function _httpsReq(method, host, urlPath, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const headers = { ...extraHeaders };
    const bBuf = body ? Buffer.from(body, 'utf8') : null;
    if (bBuf) headers['Content-Length'] = bBuf.length;

    const req = https.request({ hostname:host, path:urlPath, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON parse: '+d.slice(0,200))); }});
    });
    req.on('error', reject);
    if (bBuf) req.write(bBuf);
    req.end();
  });
}

async function _sheetsGet(range) {
  const tok = await _getAccessToken();
  return _httpsReq('GET','sheets.googleapis.com',
    `/v4/spreadsheets/${SS_ID}/values/${encodeURIComponent(range)}`,
    null, { Authorization: `Bearer ${tok}` });
}

async function _sheetsAppend(sheet, values) {
  const tok  = await _getAccessToken();
  const body = JSON.stringify({ values });
  const qp   = 'valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
  return _httpsReq('POST','sheets.googleapis.com',
    `/v4/spreadsheets/${SS_ID}/values/${encodeURIComponent(sheet)}:append?${qp}`,
    body, { Authorization:`Bearer ${tok}`, 'Content-Type':'application/json' });
}

async function _sheetsUpdate(range, values) {
  const tok  = await _getAccessToken();
  const body = JSON.stringify({ values });
  return _httpsReq('PUT','sheets.googleapis.com',
    `/v4/spreadsheets/${SS_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    body, { Authorization:`Bearer ${tok}`, 'Content-Type':'application/json' });
}

async function _handleSheets(body) {
  const data = JSON.parse(body);
  const _norm = p => String(p||'').replace(/[\s\-\(\)\.]/g,'').replace(/^\+?971/,'0').replace(/^00971/,'0');
  const _now  = () => new Date().toLocaleString('ar-AE',{timeZone:'Asia/Dubai'});

  switch(data.action) {

    case 'saveTempOrder': {
      await _sheetsAppend(data.sheetName,
        [[data.tempId,'','','','', data.items,'','', _now(),'مؤقت']]);
      return { success: true };
    }

    case 'lookupPhone': {
      const r = await _sheetsGet('DataBase');
      const rows = r.values || [];
      const phone = _norm(data.phone);
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] && _norm(rows[i][2]||'') === phone) {
          return { found:true, client:{ clientId:rows[i][0], name:rows[i][1], phone:rows[i][2], emirate:rows[i][3]||'', address:rows[i][4]||'' }};
        }
      }
      return { found: false };
    }

    case 'registerClient': {
      const r = await _sheetsGet('DataBase');
      const rows = r.values || [];
      const clientId = 'CLIENT-' + String(rows.length).padStart(3,'0'); // rows.length includes header
      const today = new Date().toLocaleDateString('ar-AE');
      await _sheetsAppend('DataBase',[[clientId,data.name,data.phone,data.emirate||'',data.address||'',today]]);
      return { success:true, clientId };
    }

    case 'confirmOrder': {
      const r = await _sheetsGet(data.sheetName);
      const rows = r.values || [];
      let rowNum = -1;
      for (let i=0;i<rows.length;i++) {
        if (String(rows[i][0]) === String(data.tempId)) { rowNum=i+1; break; }
      }
      if (rowNum === -1) throw new Error('Temp order not found: '+data.tempId);

      const confirmed = rows.slice(1).filter(r=>r[9]==='مؤكد').length;
      const prefix  = data.sheetName==='AlRoknAlMasry'?'ROKN':'FAY';
      const orderId = prefix+'-'+String(confirmed+1).padStart(4,'0');

      const cur = rows[rowNum-1] || new Array(10).fill('');
      const upd = [...cur];
      upd[1]=orderId; upd[2]=data.clientId; upd[3]=data.name;
      upd[4]=data.phone; upd[6]=data.emirate||''; upd[7]=data.address||''; upd[9]='مؤكد';
      await _sheetsUpdate(`${data.sheetName}!A${rowNum}:J${rowNum}`, [upd]);
      return { success:true, orderId, clientId:data.clientId };
    }

    case 'cancelOrder': {
      const r = await _sheetsGet(data.sheetName);
      const rows = r.values || [];
      let rowNum=-1;
      for (let i=0;i<rows.length;i++) {
        if (String(rows[i][0])===String(data.tempId)) { rowNum=i+1; break; }
      }
      if (rowNum !== -1) await _sheetsUpdate(`${data.sheetName}!J${rowNum}`, [['ملغي']]);
      return { success:true };
    }

    default: throw new Error('Unknown action: '+data.action);
  }
}

// ══════════════════════════════════════════════════════════════════
//  LOCAL MOCK  (active when APPS_SCRIPT_URL still has placeholder)
//  Orders are stored in data/local_orders.json so you can inspect them.
//  Switch to real Google Sheets any time by filling in APPS_SCRIPT_URL.
// ══════════════════════════════════════════════════════════════════
function _loadMock() {
  try { return JSON.parse(fs.readFileSync(MOCK_DB_FILE, 'utf8')); }
  catch(e) { return { AlRoknAlMasry: [], AlFayoumi: [], DataBase: [] }; }
}
function _saveMock(db) {
  fs.mkdirSync(path.dirname(MOCK_DB_FILE), { recursive: true });
  fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function _handleMock(body, callback) {
  try {
    const data = JSON.parse(body);
    const db   = _loadMock();
    let result = {};

    switch (data.action) {

      case 'saveTempOrder': {
        db[data.sheetName] = db[data.sheetName] || [];
        db[data.sheetName].push({
          tempId   : data.tempId,
          orderId  : '',
          clientId : '',
          name     : '',
          phone    : '',
          items    : data.items,
          emirate  : '',
          address  : '',
          datetime : new Date().toLocaleString('ar-AE', { timeZone: 'Asia/Dubai' }),
          status   : 'مؤقت',
        });
        _saveMock(db);
        result = { success: true };
        console.log(`  📝  [MOCK] Temp order saved → ${data.sheetName} | ${data.tempId}`);
        break;
      }

      case 'lookupPhone': {
        const norm = p => String(p).replace(/[\s\-\(\)\.]/g,'').replace(/^\+?971/,'0').replace(/^00971/,'0');
        const row  = (db.DataBase || []).find(r => r.clientId && norm(r.phone) === norm(data.phone));
        result = row ? { found: true, client: row } : { found: false };
        break;
      }

      case 'registerClient': {
        const rows     = db.DataBase || [];
        const clientId = 'CLIENT-' + String(rows.length + 1).padStart(3, '0');
        rows.push({ clientId, name: data.name, phone: data.phone,
                    emirate: data.emirate || '', address: data.address || '',
                    regDate: new Date().toLocaleDateString('ar-AE') });
        db.DataBase = rows;
        _saveMock(db);
        result = { success: true, clientId };
        console.log(`  👤  [MOCK] New client → ${clientId} | ${data.name}`);
        break;
      }

      case 'confirmOrder': {
        const sheet = db[data.sheetName] || [];
        const idx   = sheet.findIndex(r => r.tempId === data.tempId);
        if (idx === -1) { result = { error: 'Temp order not found: ' + data.tempId }; break; }
        const confirmed = sheet.filter(r => r.status === 'مؤكد').length;
        const prefix    = data.sheetName === 'AlRoknAlMasry' ? 'ROKN' : 'FAY';
        const orderId   = prefix + '-' + String(confirmed + 1).padStart(4, '0');
        Object.assign(sheet[idx], {
          orderId, clientId: data.clientId, name: data.name,
          phone: data.phone, emirate: data.emirate || '',
          address: data.address || '', status: 'مؤكد',
        });
        _saveMock(db);
        result = { success: true, orderId, clientId: data.clientId };
        console.log(`  ✅  [MOCK] Order confirmed → ${orderId} | ${data.clientId}`);
        break;
      }

      case 'cancelOrder': {
        const sheet = db[data.sheetName] || [];
        const row   = sheet.find(r => r.tempId === data.tempId);
        if (row) { row.status = 'ملغي'; _saveMock(db); }
        result = { success: true };
        break;
      }

      default:
        result = { error: 'Unknown action: ' + data.action };
    }
    callback(null, result);
  } catch(err) {
    callback(err);
  }
}

// ── Apps Script proxy helper (follows redirects, keeps POST body) ──
function _forwardToScript(body, depth, callback) {
  if (depth > 6) return callback(new Error('Too many redirects'));
  let targetUrl;
  try { targetUrl = new URL(depth === 0 ? APPS_SCRIPT_URL : _forwardToScript._next); }
  catch(e) { return callback(new Error('Invalid APPS_SCRIPT_URL in server.js')); }

  const opts = {
    hostname: targetUrl.hostname,
    path    : targetUrl.pathname + targetUrl.search,
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Content-Length': Buffer.byteLength(body, 'utf8'),
    },
  };

  const req = https.request(opts, (proxyRes) => {
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      proxyRes.resume();
      _forwardToScript._next = proxyRes.headers.location;
      return _forwardToScript(body, depth + 1, callback);
    }
    let data = '';
    proxyRes.on('data', chunk => data += chunk.toString());
    proxyRes.on('end', () => {
      try   { callback(null, JSON.parse(data)); }
      catch (e) { callback(null, { raw: data.slice(0, 300) }); }
    });
  });
  req.on('error', callback);
  req.write(body);
  req.end();
}
_forwardToScript._next = APPS_SCRIPT_URL;

}).listen(PORT, () => {
  console.log('');
  const sa       = _loadSA();
  const mockMode = !sa && APPS_SCRIPT_URL.includes('REPLACE_WITH');
  console.log('');
  console.log('  ✅  HomiCart server running');
  console.log('  🌐  http://localhost:' + PORT + '/frontend/app-v3-local.html');
  console.log('  📁  Serving: ' + BASE_DIR);
  if (sa) {
    console.log('  ☁️   Google Sheets API  — direct write to spreadsheet');
    console.log('  📧  Service account: ' + sa.client_email);
  } else if (!mockMode) {
    console.log('  🔗  Apps Script proxy enabled');
  } else {
    console.log('  🧪  MOCK MODE  — orders saved locally: ' + MOCK_DB_FILE);
    console.log('  📊  View orders: http://localhost:' + PORT + '/api/orders');
    console.log('  ──  To connect Google Sheets: add backend/service-account.json');
  }
  console.log('');
});
