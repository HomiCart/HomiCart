/**
 * HomiCart — Google Apps Script Backend
 * ══════════════════════════════════════════════════════════════
 * DEPLOYMENT STEPS:
 *  1. Go to https://script.google.com  → New project
 *  2. Paste this entire file (replace default code)
 *  3. Click Deploy → New Deployment → Web App
 *       Execute as  : Me
 *       Who has access: Anyone
 *  4. Click Deploy → copy the Web App URL
 *  5. Paste that URL into server.js  →  APPS_SCRIPT_URL constant
 *
 * EXPECTED SHEET STRUCTURE  (adjust column constants below if yours differ)
 *
 *  DataBase tab  (gid 1932528384)
 *    A  Client ID     (CLIENT-001, CLIENT-002 …)
 *    B  الاسم
 *    C  رقم الهاتف
 *    D  الإمارة
 *    E  العنوان
 *    F  تاريخ التسجيل
 *
 *  AlRoknAlMasry / AlFayoumi tabs
 *    A  Temp ID
 *    B  Order ID      (ROKN-0001 / FAY-0001 …)
 *    C  Client ID
 *    D  الاسم
 *    E  رقم الهاتف
 *    F  الأصناف والكميات
 *    G  الإمارة
 *    H  العنوان
 *    I  التاريخ والوقت
 *    J  الحالة         (مؤقت | مؤكد | ملغي)
 * ══════════════════════════════════════════════════════════════
 */

const SS_ID    = '1txQXRi-19VIDNHQej5vnqYku5-clPOj3QR_JqXKYQI0';
const TIMEZONE = 'Asia/Dubai';

// Column indices — 1-based (update if your headers are in a different order)
const DB  = { CLIENT_ID:1, NAME:2, PHONE:3, EMIRATE:4, ADDRESS:5, REG_DATE:6 };
const ORD = { TEMP_ID:1, ORDER_ID:2, CLIENT_ID:3, NAME:4, PHONE:5,
              ITEMS:6, EMIRATE:7, ADDRESS:8, DATETIME:9, STATUS:10 };

// Order ID prefixes per store sheet
const ORDER_PREFIX = { AlRoknAlMasry:'ROKN', AlFayoumi:'FAY' };

/* ────────────────────────────────────────────────────────────────
   HTTP ENTRY POINTS
──────────────────────────────────────────────────────────────── */
function doPost(e) {
  let result;
  try {
    const payload = JSON.parse(e.postData.contents);
    switch (payload.action) {
      case 'saveTempOrder':  result = saveTempOrder(payload);        break;
      case 'lookupPhone':    result = lookupPhone(payload.phone);    break;
      case 'registerClient': result = registerClient(payload);       break;
      case 'confirmOrder':   result = confirmOrder(payload);         break;
      case 'cancelOrder':    result = cancelOrder(payload.tempId, payload.sheetName); break;
      default: result = { error: 'Unknown action: ' + payload.action };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Also support GET (ping / health check)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'HomiCart API OK', ts: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ────────────────────────────────────────────────────────────────
   SAVE TEMPORARY ORDER
──────────────────────────────────────────────────────────────── */
function saveTempOrder(data) {
  const sheet = _sheet(data.sheetName);
  const now   = _now();
  sheet.appendRow([
    data.tempId,  // A TempID
    '',           // B OrderID   — assigned on confirm
    '',           // C ClientID  — assigned on confirm
    '',           // D Name
    '',           // E Phone
    data.items,   // F Items
    '',           // G Emirate
    '',           // H Address
    now,          // I DateTime
    'مؤقت',       // J Status
  ]);
  return { success: true };
}

/* ────────────────────────────────────────────────────────────────
   LOOKUP PHONE IN DATABASE
──────────────────────────────────────────────────────────────── */
function lookupPhone(rawPhone) {
  const sheet = _sheet('DataBase');
  const rows  = sheet.getDataRange().getValues();
  const phone = _normalizePhone(String(rawPhone));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[DB.CLIENT_ID - 1]) continue; // skip blank rows
    if (_normalizePhone(String(row[DB.PHONE - 1])) === phone) {
      return {
        found: true,
        client: {
          clientId : row[DB.CLIENT_ID - 1],
          name     : row[DB.NAME     - 1],
          phone    : row[DB.PHONE    - 1],
          emirate  : row[DB.EMIRATE  - 1],
          address  : row[DB.ADDRESS  - 1],
        },
      };
    }
  }
  return { found: false };
}

/* ────────────────────────────────────────────────────────────────
   REGISTER NEW CLIENT
──────────────────────────────────────────────────────────────── */
function registerClient(data) {
  const sheet    = _sheet('DataBase');
  const lastRow  = sheet.getLastRow();          // row 1 = header → lastRow = count of all rows
  const clientId = 'CLIENT-' + String(lastRow).padStart(3, '0');
  const today    = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy');

  sheet.appendRow([
    clientId,
    data.name,
    data.phone,
    data.emirate || '',
    data.address || '',
    today,
  ]);
  return { success: true, clientId };
}

/* ────────────────────────────────────────────────────────────────
   CONFIRM ORDER  (مؤقت → مؤكد, assign Order ID)
──────────────────────────────────────────────────────────────── */
function confirmOrder(data) {
  const sheet = _sheet(data.sheetName);
  const rows  = sheet.getDataRange().getValues();

  // Find the temp order row
  let rowNum = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][ORD.TEMP_ID - 1]) === String(data.tempId)) {
      rowNum = i + 1;
      break;
    }
  }
  if (rowNum === -1) throw new Error('Temp order not found: ' + data.tempId);

  // Count already-confirmed orders for sequential numbering
  let confirmedCount = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][ORD.STATUS - 1]) === 'مؤكد') confirmedCount++;
  }
  const prefix  = ORDER_PREFIX[data.sheetName] || 'ORD';
  const orderId = prefix + '-' + String(confirmedCount + 1).padStart(4, '0');

  // Update row in-place
  const range = sheet.getRange(rowNum, 1, 1, 10);
  const vals  = range.getValues()[0];
  vals[ORD.ORDER_ID  - 1] = orderId;
  vals[ORD.CLIENT_ID - 1] = data.clientId;
  vals[ORD.NAME      - 1] = data.name;
  vals[ORD.PHONE     - 1] = data.phone;
  vals[ORD.EMIRATE   - 1] = data.emirate || '';
  vals[ORD.ADDRESS   - 1] = data.address || '';
  vals[ORD.STATUS    - 1] = 'مؤكد';
  range.setValues([vals]);

  return { success: true, orderId, clientId: data.clientId };
}

/* ────────────────────────────────────────────────────────────────
   CANCEL TEMP ORDER
──────────────────────────────────────────────────────────────── */
function cancelOrder(tempId, sheetName) {
  const sheet = _sheet(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };
  const rows = sheet.getDataRange().getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][ORD.TEMP_ID - 1]) === String(tempId)) {
      sheet.getRange(i + 1, ORD.STATUS).setValue('ملغي');
      return { success: true };
    }
  }
  return { error: 'Order not found' };
}

/* ────────────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────────────── */
function _sheet(name) {
  const s = SpreadsheetApp.openById(SS_ID).getSheetByName(name);
  if (!s) throw new Error('Sheet not found: ' + name);
  return s;
}

function _now() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
}

function _normalizePhone(p) {
  return p.replace(/[\s\-\(\)\.]/g, '')
          .replace(/^\+?971/, '0')
          .replace(/^00971/, '0');
}
