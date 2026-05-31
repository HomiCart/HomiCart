// ============================================
// HomiCart API - Multi-Vendor Version (FULLY UPDATED)
// Routes: malhama (الركن المصري) -> "Orders" sheet
//         fayoumi (الفيومي) -> "AlFayoumi" sheet
// Version: v15.1 - Added getDriveImages via DriveApp (no API key needed)
// ============================================
//
// DEPLOYMENT:
//  1. Open your existing project:
//     https://script.google.com/u/0/home/projects/1AuxdnCMWUS-8NTalwIymEThOm4QTz_sIWPe3kYF0dzVuAe7-_9OFq009/edit
//  2. Select all (Ctrl+A), paste this file
//  3. Save (Ctrl+S)
//  4. Deploy → New Deployment (or Manage Deployments → Edit existing)
//       Execute as  : Me
//       Who has access: Anyone
//  5. Copy the Web App URL → paste into server.js → APPS_SCRIPT_URL
//
// DRIVE FOLDERS (used by getDriveImages — no API key needed):
//   Backgrounds  : 123evaENwY1Tv6lGhaOR6SBTaexLNRFX_
//   Al Fayoumy   : 1EVV0EI-wfcqVexNxBmKw_jc7i1SMeMyo
//   Al Rokn      : 128tbcnmTV58imd2eYQzFxEZELDe0tvt_
//   Make each folder: Share → Anyone with link → Viewer
// ============================================

const SPREADSHEET_ID = '1txQXRi-19VIDNHQej5vnqYku5-clPOj3QR_JqXKYQI0';

// Sheet name constants - MUST match HTML
const SHEET_ORDERS  = 'Orders';     // For malhama (الركن المصري)
const SHEET_FAYOUMI = 'AlFayoumi';  // For fayoumi (الفيومي للطيور)

// ========== HTTP Handlers ==========
function doGet(e) {
  console.log('=== GET REQUEST ===');
  console.log('Parameters:', JSON.stringify(e.parameter));

  const action = e.parameter ? e.parameter.action : null;
  let result;

  try {
    if (!action) {
      result = {
        success: true,
        message: 'HomiCart API - Multi-Vendor Version',
        version: 'v15.1',
        availableActions: [
          'getOrderStatus', 'getCustomer', 'getOrders',
          'getCustomerById', 'getOrderByCustomer', 'test', 'ping',
          'createOrUpdateCustomer', 'submitOrder', 'updateOrder',
          'getLatestOrderByPhone', 'getCustomerAndLatestOrder',
          'updateCustomerLocation', 'getCustomerLocation',
          'getDriveImages'   // NEW: list images from a public Drive folder
        ]
      };
    }
    // ── List images from a Google Drive folder ─────────────────────
    else if (action === 'getDriveImages') {
      result = getDriveImages(e.parameter.folderId);
    }
    // ── Serve a single Drive file as base64 (used by server proxy) ─
    else if (action === 'getImageBase64') {
      const fileId = e.parameter.id;
      if (!fileId) {
        result = { success: false, message: 'id is required' };
      } else {
        try {
          const file     = DriveApp.getFileById(fileId.trim());
          const blob     = file.getBlob();
          result = {
            success  : true,
            data     : Utilities.base64Encode(blob.getBytes()),
            mimeType : blob.getContentType() || 'image/jpeg',
            name     : file.getName()
          };
        } catch(err) {
          result = { success: false, message: 'File error: ' + err.toString() };
        }
      }
    }
    else if (action === 'getOrderStatus') {
      result = getOrderStatus();
    }
    else if (action === 'getCustomer') {
      result = getCustomer(e.parameter.phone);
    }
    else if (action === 'getOrders') {
      result = getOrders(e.parameter.phone);
    }
    else if (action === 'getCustomerById') {
      result = getCustomerById(e.parameter.customerId);
    }
    else if (action === 'getOrderByCustomer') {
      const sheetName = e.parameter.sheet || SHEET_ORDERS;
      result = getOrderByCustomer(e.parameter.customerId, sheetName);
    }
    else if (action === 'getLatestOrderByPhone') {
      result = getLatestOrderByPhone(e.parameter.phone);
    }
    else if (action === 'getCustomerAndLatestOrder') {
      result = getCustomerAndLatestOrder(e.parameter.phone);
    }
    else if (action === 'createOrUpdateCustomer') {
      const customerData = {
        phone: e.parameter.phone,
        whatsapp: e.parameter.whatsapp || e.parameter.phone,
        name: e.parameter.name,
        area: e.parameter.area,
        address: e.parameter.address,
        location: e.parameter.location || '',
        notes: e.parameter.notes || '',
        round: e.parameter.round || '',
        latitude: e.parameter.latitude || '',
        longitude: e.parameter.longitude || '',
        userTimezone: e.parameter.userTimezone || 'Asia/Dubai'
      };
      result = createOrUpdateCustomer(customerData);
    }
    else if (action === 'submitOrder') {
      const orderData = {
        phone: e.parameter.phone,
        whatsapp: e.parameter.whatsapp || e.parameter.phone,
        name: e.parameter.name,
        area: e.parameter.area,
        address: e.parameter.address,
        location: e.parameter.location || '',
        orderText: e.parameter.orderText,
        notes: e.parameter.notes || '',
        round: e.parameter.round || '',
        replaceOrderId: e.parameter.replaceOrderId || '',
        latitude: e.parameter.latitude || '',
        longitude: e.parameter.longitude || '',
        userTimezone: e.parameter.userTimezone || 'Asia/Dubai',
        userTimestamp: e.parameter.userTimestamp || '',
        sheet: e.parameter.sheet || SHEET_ORDERS,
        vendor: e.parameter.vendor || ''
      };
      result = submitOrder(orderData);
    }
    else if (action === 'updateOrder') {
      const orderData = {
        orderId: e.parameter.orderId,
        orderText: e.parameter.orderText,
        status: e.parameter.status || 'تم التحديث',
        sheet: e.parameter.sheet || SHEET_ORDERS
      };
      result = updateOrder(orderData);
    }
    else if (action === 'updateCustomerLocation') {
      result = updateCustomerLocation(e.parameter.customerId, e.parameter.latitude, e.parameter.longitude);
    }
    else if (action === 'getCustomerLocation') {
      result = getCustomerLocation(e.parameter.customerId);
    }
    else if (action === 'test') {
      result = { success: true, message: 'Server is working!', timestamp: new Date().toISOString(), parameters: e.parameter || {} };
    }
    else if (action === 'ping') {
      result = { success: true, message: 'pong' };
    }
    // ── Routing actions ──────────────────────────────────────────
    else if (action === 'setStartPoint') {
      result = setStartPoint(parseFloat(e.parameter.lat), parseFloat(e.parameter.lng));
    }
    else if (action === 'runRouteOptimization') {
      result = runRouteOptimization();
    }
    else if (action === 'generateRouteLinks') {
      result = generateRouteLinks();
    }
    else if (action === 'runFullRoutePipeline') {
      result = runFullRoutePipeline();
    }
    else if (action === 'getRouteLinks') {
      result = getRouteLinks();
    }
    else if (action === 'getVendorOrders') {
      result = getVendorOrders(e.parameter.sheet);
    }
    else if (action === 'routeVendorOrders') {
      result = routeVendorOrders(
        e.parameter.sheet,
        parseFloat(e.parameter.lat),
        parseFloat(e.parameter.lng)
      );
    }
    else if (action === 'processVendorFull') {
      result = processVendorFull(
        e.parameter.sheet,
        e.parameter.workspace,
        parseFloat(e.parameter.lat),
        parseFloat(e.parameter.lng)
      );
    }
    else if (action === 'getWorkspaceExport') {
      result = getWorkspaceExport(e.parameter.workspace);
    }
    else {
      result = { success: false, message: 'Invalid action.', receivedAction: action };
    }
  } catch (error) {
    console.error('Error in doGet:', error);
    result = { success: false, message: 'Server error: ' + error.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== doPost - Handles POST requests from HTML form ==========
function doPost(e) {
  console.log('=== POST REQUEST ===');

  try {
    const data = {};

    if (e.postData && e.postData.type === 'application/x-www-form-urlencoded') {
      const params = e.parameter;
      if (params) {
        for (const key in params) {
          data[key] = params[key];
        }
      }
    } else if (e.postData) {
      try {
        const parsedData = JSON.parse(e.postData.contents);
        Object.assign(data, parsedData);
      } catch (jsonError) {
        console.log('Not JSON, using form data');
        if (e.parameter) {
          Object.assign(data, e.parameter);
        }
      }
    } else if (e.parameter) {
      Object.assign(data, e.parameter);
    }

    console.log('Post data parsed:', JSON.stringify(data));

    const action = data.action || '';
    const latitude = data.latitude || '';
    const longitude = data.longitude || '';
    const location = data.location || '';
    const userTimezone = data.userTimezone || 'Asia/Dubai';
    const userTimestamp = data.userTimestamp || '';
    const sheetName = data.sheet || SHEET_ORDERS;
    const vendor = data.vendor || '';

    let result;

    // ── NEW: getDriveImages via POST too ───────────────────────────
    if (action === 'getDriveImages') {
      result = getDriveImages(data.folderId);
    }
    else if (action === 'createOrUpdateCustomer') {
      const customerData = {
        phone: data.phone || '',
        whatsapp: data.whatsapp || data.phone || '',
        name: data.name || '',
        area: data.area || '',
        address: data.address || '',
        location: location,
        notes: data.notes || '',
        round: data.round || '',
        latitude: latitude,
        longitude: longitude,
        userTimezone: userTimezone,
        userTimestamp: userTimestamp
      };
      result = createOrUpdateCustomer(customerData);
    }
    else if (action === 'submitOrder') {
      const orderData = {
        phone: data.phone || '',
        whatsapp: data.whatsapp || data.phone || '',
        name: data.name || '',
        area: data.area || '',
        address: data.address || '',
        location: location,
        orderText: data.orderText || '',
        notes: data.notes || '',
        round: data.round || '',
        replaceOrderId: data.replaceOrderId || '',
        latitude: latitude,
        longitude: longitude,
        userTimezone: userTimezone,
        userTimestamp: userTimestamp,
        sheet: sheetName,
        vendor: vendor
      };
      result = submitOrder(orderData);
    }
    else if (action === 'lookupPhone') {
      // Map our confirm.html's action to getCustomer
      result = getCustomer(data.phone);
      if (result.success) {
        result.found = !!result.customer;
        if (result.customer) {
          result.client = {
            clientId : result.customer.id,
            name     : result.customer.name,
            phone    : result.customer.phone,
            emirate  : result.customer.area,
            address  : result.customer.address,
          };
        }
      }
    }
    else if (action === 'registerClient') {
      // Map our confirm.html's action to createOrUpdateCustomer
      const customerData = {
        phone    : data.phone || '',
        name     : data.name  || '',
        area     : data.emirate || data.area || '',
        address  : data.address || '',
        whatsapp : data.phone || '',
        location : '',
        notes    : '',
        userTimezone: 'Asia/Dubai'
      };
      const r = createOrUpdateCustomer(customerData);
      result = {
        success  : r.success,
        clientId : r.customerId,
        message  : r.message
      };
    }
    else if (action === 'confirmOrder') {
      // Map confirm.html's confirmOrder to submitOrder
      const orderData = {
        phone    : data.phone    || '',
        name     : data.name     || '',
        area     : data.emirate  || data.area || '',
        address  : data.address  || '',
        orderText: data.items    || '',
        whatsapp : data.phone    || '',
        location : '',
        notes    : '',
        sheet    : sheetName,
        vendor   : vendor,
        userTimezone: 'Asia/Dubai'
      };
      const r = submitOrder(orderData);
      result = {
        success  : r.success,
        orderId  : r.orderId,
        clientId : r.customerId || data.clientId,
        message  : r.message
      };
    }
    else if (action === 'saveTempOrder') {
      // Temp orders go to a "TempOrders" helper tab or the target sheet with status مؤقت
      result = saveTempOrder(data);
    }
    else if (action === 'cancelOrder') {
      result = cancelTempOrder(data.tempId, data.sheetName || sheetName);
    }
    else {
      result = { success: false, message: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Server error in POST: ' + error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════════════
//  NEW: getDriveImages
//  Lists all image files in a public Google Drive folder.
//  Returns: { success, files: [{name, url, fullUrl, id}], count }
//  No API key needed — uses DriveApp (built into Apps Script).
//  Requirement: folder must be shared "Anyone with link → Viewer"
// ══════════════════════════════════════════════════════════════
function getDriveImages(folderId) {
  if (!folderId || folderId.trim() === '') {
    return { success: false, files: [], message: 'folderId is required' };
  }
  try {
    const folder    = DriveApp.getFolderById(folderId.trim());
    const iterator  = folder.getFiles();
    const imageFiles = [];

    while (iterator.hasNext()) {
      const file     = iterator.next();
      const mimeType = file.getMimeType();
      if (!mimeType.startsWith('image/')) continue;
      const id = file.getId();
      imageFiles.push({
        name   : file.getName(),
        id     : id,
        // Direct view URL — works once file is made public via setupDriveFolders()
        url    : 'https://drive.google.com/uc?export=view&id=' + id,
        fullUrl: 'https://drive.google.com/uc?export=view&id=' + id,
      });
    }

    // Sort alphabetically by name for consistent ordering
    imageFiles.sort(function(a, b) { return a.name.localeCompare(b.name); });

    console.log('getDriveImages: folder=' + folderId + ' found=' + imageFiles.length);
    return { success: true, files: imageFiles, count: imageFiles.length };

  } catch (err) {
    console.error('getDriveImages error:', err);
    return {
      success: false,
      files  : [],
      message: 'Drive error: ' + err.toString() +
               ' — Make sure folder is shared publicly (Anyone with link → Viewer).'
    };
  }
}

// ── saveTempOrder (stores temp order in target sheet with مؤقت status) ──
function saveTempOrder(data) {
  try {
    const ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName  = data.sheetName || SHEET_ORDERS;
    let   sheet      = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const h = ['OrderID','CustomerID','Items','CustomerName','Phone',
                 'OrderDate','Status','LastUpdated','Notes','Location',
                 'Latitude','Longitude','GoogleMapsLink','Round','Vendor'];
      sheet.getRange(1,1,1,h.length).setValues([h]);
    }

    const now = Utilities.formatDate(new Date(), 'Asia/Dubai', 'dd/MM/yyyy HH:mm:ss');
    sheet.appendRow([data.tempId,'','',data.name||'','',now,'مؤقت',now,
                     data.items||'','','','','','','']);
    return { success: true };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// ── cancelTempOrder ──────────────────────────────────────────────────────
function cancelTempOrder(tempId, sheetName) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName || SHEET_ORDERS);
    if (!sheet) return { success: false, message: 'Sheet not found' };
    const rows  = sheet.getDataRange().getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(tempId)) {
        sheet.getRange(i + 1, 7).setValue('ملغي');
        return { success: true };
      }
    }
    return { success: false, message: 'Order not found' };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// ══════════════════════════════════════════════════════════════
//  setupDriveFolders  — run this ONCE from the editor.
//
//  What it does:
//    • Makes every image file in all 3 Drive folders publicly
//      accessible (Anyone with the link → Viewer)
//    • After this runs, direct image URLs like
//      https://drive.google.com/uc?export=view&id=FILE_ID
//      will load in any browser without login
//
//  Requires: appsscript.json scope must be "drive" (not "drive.readonly")
//  See: backend/appsscript.json in the repo
// ══════════════════════════════════════════════════════════════
function setupDriveFolders() {
  const FOLDER_IDS = [
    '123evaENwY1Tv6lGhaOR6SBTaexLNRFX_',  // Backgrounds
    '1EVV0EI-wfcqVexNxBmKw_jc7i1SMeMyo',  // AlFayoumy menu
    '128tbcnmTV58imd2eYQzFxEZELDe0tvt_',  // AlRoknAlMasry menu
  ];

  let totalFiles = 0;
  const results  = [];

  FOLDER_IDS.forEach(function(folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      // Make folder itself publicly viewable
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const iter = folder.getFiles();
      let count  = 0;
      while (iter.hasNext()) {
        const file = iter.next();
        // Make every file inside individually publicly accessible
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        count++;
        totalFiles++;
      }
      results.push({ folderId: folderId, name: folder.getName(), files: count, status: '✅' });
      console.log('✅ ' + folder.getName() + ': ' + count + ' files made public');
    } catch(err) {
      results.push({ folderId: folderId, error: err.toString(), status: '❌' });
      console.error('❌ Error for folder ' + folderId + ': ' + err.toString());
    }
  });

  console.log('Done! ' + totalFiles + ' files are now publicly accessible.');
  return { success: true, totalFiles: totalFiles, folders: results };
}

// Keep authorizeDriveAccess as an alias
function authorizeDriveAccess() { return setupDriveFolders(); }

// ══════════════════════════════════════════════════════════════
//  ROUTING ACTIONS
//  These wrap the functions in Routing.gs and RouteLinks.gs.
//  Called by the admin dashboard via doGet.
// ══════════════════════════════════════════════════════════════

// Write start lat/lng to Routes sheet H1 & I1
function setStartPoint(lat, lng) {
  try {
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName('Routes');
    if (!sheet) return { success: false, message: 'شيت Routes مش موجود' };
    sheet.getRange('H1').setValue(lat);
    sheet.getRange('I1').setValue(lng);
    return { success: true, message: 'تم حفظ نقطة البداية: ' + lat + ', ' + lng };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Step 1 — run nearest-neighbor + 2-OPT optimization
function runRouteOptimization() {
  try {
    nearestNeighborOrder();   // defined in Routing.gs
    return { success: true, message: 'تم ترتيب المسار بنجاح ✅' };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Step 2 — sort by visit order and generate Google Maps links
function generateRouteLinks() {
  try {
    GenerateRoutesFromColumnA();   // defined in RouteLinks.gs
    return { success: true, message: 'تم توليد الروابط بنجاح ✅', links: getRouteLinks().links };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Run both steps in sequence
function runFullRoutePipeline() {
  try {
    nearestNeighborOrder();
    GenerateRoutesFromColumnA();
    return { success: true, message: 'اكتمل الترتيب وتوليد الروابط ✅', links: getRouteLinks().links };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// ══════════════════════════════════════════════════════════════
//  FULL VENDOR PIPELINE
//  Replaces 5 manual steps with 1 function call.
//
//  Steps performed automatically:
//   1. Read مؤكد orders from Orders / AlFayoumi sheet
//   2. JOIN with DataBase → get name, phone, area, address, location
//   3. Clear & populate Workspace / FWorkspace tab (all columns A–L)
//   4. Write Combined Data formula in column L (WhatsApp-ready format)
//   5. Populate Routes sheet with lat/lng + set start point
//   6. Run nearestNeighborOrder() + 2-OPT optimization
//   7. Write route numbers back to Workspace column E
//   8. AUTO-SORT Workspace by route number (column E)
//   9. Run GenerateRoutesFromColumnA() → RouteLinks sheet
//  10. Update order status → "جاري التحضير"
//  11. Return combined WhatsApp text + Maps links
//
//  Workspace columns:
//   A=Index  B=—  C=OrderID  D=CustomerID  E=RouteNumber
//   F=Mobile  G=Name  H=Area  I=Address  J=MapsLink
//   K=OrderItems  L=CombinedData(formula)
// ══════════════════════════════════════════════════════════════
function processVendorFull(sheetName, workspaceTab, startLat, startLng) {
  try {
    var ss           = SpreadsheetApp.openById(SS_ID);
    var ordersSheet  = ss.getSheetByName(sheetName);
    var dbSheet      = ss.getSheetByName('DataBase');
    var wsSheet      = ss.getSheetByName(workspaceTab);

    if (!ordersSheet) return { success: false, message: 'شيت ' + sheetName + ' مش موجود' };
    if (!dbSheet)     return { success: false, message: 'شيت DataBase مش موجود' };
    if (!wsSheet)     return { success: false, message: 'شيت ' + workspaceTab + ' مش موجود' };

    // ── Step 1: Get Preparing orders ────────────────────────────────
    var oLastRow = ordersSheet.getLastRow();
    if (oLastRow < 2) return { success: false, message: 'لا توجد طلبات' };

    var ordersAll = ordersSheet.getRange(2, 1, oLastRow - 1, 15).getValues();
    var confirmed = ordersAll.filter(function(r) {
      var status = String(r[6]).trim();
      return r[0] && (status === 'Preparing' || status === 'جاري التحضير');
    });

    if (confirmed.length === 0) {
      return { success: false, message: 'لا توجد طلبات بحالة "Preparing" في ' + sheetName };
    }

    // ── Step 2: Build customer lookup map from DataBase ───────────
    var dbLastRow = dbSheet.getLastRow();
    var dbData    = dbLastRow >= 2
      ? dbSheet.getRange(2, 1, dbLastRow - 1, 17).getValues()
      : [];

    var byId = {};
    var byPhone = {};
    dbData.forEach(function(r) {
      var id = String(r[0]).trim();
      var ph = String(r[2]).replace(/\s/g, '').replace(/^\+?971/, '0').replace(/^00971/, '0');
      var obj = {
        name    : r[1]  || '',
        phone   : r[2]  || '',
        area    : r[4]  || '',
        address : r[5]  || '',
        location: r[6]  || '',
        lat     : r[14] || '',
        lng     : r[15] || '',
        mapsLink: r[16] || ''
      };
      if (id) byId[id]     = obj;
      if (ph) byPhone[ph]  = obj;
    });

    // ── Step 3: Build workspace rows ──────────────────────────────
    var wsRows = [];           // rows to write into workspace
    var routeEntries = [];     // matching entries for Routes sheet

    confirmed.forEach(function(order, idx) {
      var orderId  = order[0];
      var clientId = String(order[1]).trim();
      var items    = String(order[2] || '').trim();
      var rawPhone = String(order[4] || '').replace(/\s/g, '').replace(/^\+?971/, '0').replace(/^00971/, '0');
      var c        = byId[clientId] || byPhone[rawPhone] || {};
      var mapsLink = c.mapsLink
                   || (c.lat && c.lng ? 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng : '');

      wsRows.push([
        idx + 1,          // A: row index
        '',               // B: separator
        orderId,          // C: OrderID
        clientId,         // D: CustomerID
        '',               // E: Route number — filled after routing
        c.phone  || order[4] || '', // F: Mobile
        c.name   || order[3] || '', // G: Name
        c.area   || '',             // H: Area
        c.address|| '',             // I: Address
        mapsLink,                   // J: Maps link
        items,                      // K: Sep-Text Order (items)
        ''                          // L: Combined Data (formula inserted below)
      ]);

      routeEntries.push({
        wsIdx   : idx,
        lat     : c.lat,
        lng     : c.lng,
        mapsLink: mapsLink,
        hasCoords: !!(c.lat && c.lng)
      });
    });

    // ── Step 4: Clear workspace tab (keep header row 1) ───────────
    if (wsSheet.getLastRow() > 1) {
      wsSheet.getRange(2, 1, wsSheet.getLastRow() - 1, 12).clearContent();
    }

    // Write all workspace rows at once
    if (wsRows.length > 0) {
      wsSheet.getRange(2, 1, wsRows.length, 12).setValues(wsRows);

      // Insert Combined Data formula in column L (col 12) per row
      for (var fi = 0; fi < wsRows.length; fi++) {
        var fr = fi + 2;
        wsSheet.getRange(fr, 12).setFormula(
          '="🧾 رقم "&E' + fr + '&CHAR(10)' +
          '&"📞 "&F' + fr + '&CHAR(10)' +
          '&"👤 "&G' + fr + '&CHAR(10)' +
          '&"📍 "&H' + fr + '&" - "&I' + fr + '&CHAR(10)' +
          '&"🗺️ "&J' + fr + '&CHAR(10)' +
          '&"🛒 الاوردر 👇"&CHAR(10)&K' + fr + '&CHAR(10)' +
          '&"---------------------------"'
        );
      }
    }

    // ── Step 5: Populate Routes sheet ────────────────────────────
    var routesSheet = ss.getSheetByName('Routes');
    if (!routesSheet) routesSheet = ss.insertSheet('Routes');
    routesSheet.clearContents();

    routesSheet.getRange('H1').setValue(parseFloat(startLat) || 0);
    routesSheet.getRange('I1').setValue(parseFloat(startLng) || 0);

    // Only entries with coords go into Routes
    var validEntries = routeEntries.filter(function(e) { return e.hasCoords; });
    if (validEntries.length > 0) {
      var routeRows = validEntries.map(function(e) {
        return [e.mapsLink, '', '', e.lat, e.lng, '', ''];
      });
      routesSheet.getRange(2, 1, routeRows.length, 7).setValues(routeRows);
    }

    // ── Step 6: Run route optimization ───────────────────────────
    if (validEntries.length > 0) {
      nearestNeighborOrder(); // writes visit order to Routes col G
    }

    // ── Step 7: Write route numbers back to Workspace column E ───
    if (validEntries.length > 0) {
      var routeOrderVals = routesSheet.getRange(2, 7, validEntries.length, 1).getValues();
      validEntries.forEach(function(e, ri) {
        var wsRow    = e.wsIdx + 2; // +2: header offset
        var routeNum = routeOrderVals[ri] ? routeOrderVals[ri][0] : '';
        if (routeNum) wsSheet.getRange(wsRow, 5).setValue(routeNum);
      });
    }

    // ── Step 8: Sort Workspace by route number (col E = col 5) ───
    var wsDataLast = wsSheet.getLastRow();
    if (wsDataLast > 2) {
      wsSheet.getRange(2, 1, wsDataLast - 1, 12).sort({ column: 5, ascending: true });
    }

    // ── Step 9: Generate Google Maps route links ──────────────────
    if (validEntries.length > 0) {
      GenerateRoutesFromColumnA();
    }

    // ── Step 10: Update LastUpdated timestamp (status stays Preparing) ──
    var confirmedIds = {};
    confirmed.forEach(function(o) { confirmedIds[String(o[0])] = true; });
    var now = Utilities.formatDate(new Date(), 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');

    // Only update LastUpdated — do NOT change status (stays Preparing)
    var lastUpdArray = ordersAll.map(function(r) {
      if (confirmedIds[String(r[0])]) return [now];
      return [r[7]];
    });
    ordersSheet.getRange(2, 8, lastUpdArray.length, 1).setValues(lastUpdArray);

    // ── Step 11: Compile WhatsApp text from workspace col L ───────
    var wsExport  = _getWorkspaceExport(wsSheet);
    var mapLinks  = getRouteLinks().links || [];

    return {
      success      : true,
      message      : 'تم معالجة ' + confirmed.length + ' أوردر ✅',
      ordersCount  : confirmed.length,
      routedCount  : validEntries.length,
      noCoords     : confirmed.length - validEntries.length,
      links        : mapLinks,
      whatsappText : wsExport
    };

  } catch(err) {
    return { success: false, message: 'خطأ: ' + err.toString() };
  }
}

// Returns all Combined Data (col L) joined for WhatsApp sending
function _getWorkspaceExport(wsSheet) {
  try {
    var lastRow = wsSheet.getLastRow();
    if (lastRow < 2) return '';
    var vals = wsSheet.getRange(2, 12, lastRow - 1, 1).getValues();
    return vals
      .map(function(r) { return String(r[0] || '').trim(); })
      .filter(function(t) { return t; })
      .join('\n\n');
  } catch(e) { return ''; }
}

// Action: get workspace export text
function getWorkspaceExport(workspaceTab) {
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var ws = ss.getSheetByName(workspaceTab);
    if (!ws) return { success: false, message: workspaceTab + ' not found' };
    return { success: true, text: _getWorkspaceExport(ws) };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

// Get all orders from a vendor sheet (Orders or AlFayoumi)
function getVendorOrders(sheetName) {
  try {
    var sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(sheetName || 'Orders');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, orders: [] };
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
    var orders = data
      .filter(function(r) { return r[0]; }) // skip blank rows
      .map(function(r) {
        return {
          orderId    : r[0],  // A: OrderID
          clientId   : r[1],  // B: CustomerID
          items      : r[2],  // C: Items
          name       : r[3],  // D: CustomerName
          phone      : r[4],  // E: Phone
          date       : r[5] ? String(r[5]).substring(0,10) : '',  // F: OrderDate
          status     : r[6],  // G: Status
          notes      : r[8],  // I: Notes
          location   : r[9],  // J: Location
          latitude   : r[10], // K: Latitude
          longitude  : r[11], // L: Longitude
          mapsLink   : r[12], // M: GoogleMapsLink
          hasLocation: !!(r[10] && r[11])
        };
      });
    return { success: true, orders: orders };
  } catch(err) {
    return { success: false, message: err.toString(), orders: [] };
  }
}

// Route confirmed orders for a vendor:
// 1. Gets "مؤكد" orders with locations from sheetName
// 2. Writes them to Routes sheet
// 3. Runs optimization (nearestNeighborOrder)
// 4. Generates Google Maps links (GenerateRoutesFromColumnA)
// 5. Updates order status to "جاري التحضير"
// 6. Returns the generated links
function routeVendorOrders(sheetName, startLat, startLng) {
  try {
    var ss           = SpreadsheetApp.openById(SS_ID);
    var ordersSheet  = ss.getSheetByName(sheetName || 'Orders');
    if (!ordersSheet) return { success: false, message: 'شيت ' + sheetName + ' مش موجود' };

    var lastRow = ordersSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'لا توجد طلبات في هذا الشيت' };

    var data = ordersSheet.getRange(2, 1, lastRow - 1, 15).getValues();

    // Filter confirmed orders that have lat/lng
    var confirmed = [];
    for (var i = 0; i < data.length; i++) {
      var status = String(data[i][6]).trim();
      var lat    = data[i][10];
      var lng    = data[i][11];
      var maps   = data[i][12];
      if (status === 'مؤكد' && lat && lng) {
        confirmed.push({ rowIndex: i + 2, orderId: data[i][0], lat: lat, lng: lng, maps: maps });
      }
    }

    if (confirmed.length === 0) {
      return { success: false, message: 'لا توجد طلبات مؤكدة مع موقع محدد في هذا الشيت' };
    }

    // Prepare / clear Routes sheet
    var routesSheet = ss.getSheetByName('Routes');
    if (!routesSheet) routesSheet = ss.insertSheet('Routes');
    routesSheet.clearContents();

    // Set start point
    routesSheet.getRange('H1').setValue(startLat || 0);
    routesSheet.getRange('I1').setValue(startLng || 0);

    // Write confirmed orders to Routes sheet
    // Columns: A=MapsLink, B=OrderID, C=(empty), D=Lat, E=Lng, F=(empty), G=VisitOrder
    var routesData = confirmed.map(function(o) {
      return [o.maps || '', o.orderId, '', o.lat, o.lng, '', ''];
    });
    routesSheet.getRange(2, 1, routesData.length, 7).setValues(routesData);

    // Run route optimization (from Routing.gs)
    nearestNeighborOrder();

    // Generate Google Maps links (from RouteLinks.gs)
    GenerateRoutesFromColumnA();

    // Update order status to "جاري التحضير"
    for (var j = 0; j < confirmed.length; j++) {
      ordersSheet.getRange(confirmed[j].rowIndex, 7).setValue('جاري التحضير');
    }

    var now = Utilities.formatDate(new Date(), 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');
    for (var k = 0; k < confirmed.length; k++) {
      ordersSheet.getRange(confirmed[k].rowIndex, 8).setValue(now); // LastUpdated
    }

    return {
      success     : true,
      message     : 'تم ترتيب ' + confirmed.length + ' طلب وتحويلهم لـ "جاري التحضير" ✅',
      ordersCount : confirmed.length,
      links       : getRouteLinks().links
    };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// Read generated links from RouteLinks sheet
function getRouteLinks() {
  try {
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName('RouteLinks');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, links: [] };
    const data  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    const links = data
      .filter(r => r[2])
      .map(r => ({ route: r[0], stops: r[1], url: String(r[2]).replace(/^=HYPERLINK\("([^"]+)".*/, '$1'), notes: r[3] }));
    return { success: true, links };
  } catch(err) { return { success: false, message: err.toString(), links: [] }; }
}

// ========== Core Functions (unchanged from v15.0) ==========

function getOrderStatus() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: true, status: 'Active', round: '' };
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, status: 'Active', round: '' };
    let status = 'Active', round = '';
    if (sheet.getLastColumn() >= 13) {
      const statusCell = sheet.getRange(2, 13).getValue();
      if (statusCell) status = statusCell.toString().trim();
    }
    if (sheet.getLastColumn() >= 12) {
      const roundCell = sheet.getRange(2, 12).getValue();
      if (roundCell) round = roundCell.toString().trim();
    }
    return { success: true, status: status, round: round };
  } catch (error) {
    return { success: true, status: 'Active', round: '' };
  }
}

function getCustomer(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone number is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'Database sheet not found' };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, customer: null };
    const headers = getHeaders(sheet);
    const latCol = getColumnIndex(headers, 'Latitude') || 15;
    const lngCol = getColumnIndex(headers, 'Longitude') || 16;
    const mapsCol = getColumnIndex(headers, 'GoogleMapsLink') || 17;
    for (let i = 2; i <= lastRow; i++) {
      const rowPhone = sheet.getRange(i, 3).getValue();
      const phoneString = rowPhone ? rowPhone.toString().trim() : '';
      const cleanPhone = phoneString.startsWith("'") ? phoneString.substring(1) : phoneString;
      if (cleanPhone === phone || phoneString === "'" + phone ||
          (phone.startsWith('0') && cleanPhone === phone.substring(1)) ||
          (!phone.startsWith('0') && cleanPhone === '0' + phone)) {
        const customer = {
          id: sheet.getRange(i, 1).getValue() || '',
          name: sheet.getRange(i, 2).getValue() || '',
          phone: cleanPhone,
          whatsapp: sheet.getRange(i, 4).getValue() || '',
          area: sheet.getRange(i, 5).getValue() || '',
          address: sheet.getRange(i, 6).getValue() || '',
          location: sheet.getRange(i, 7).getValue() || '',
          notes: sheet.getRange(i, 11).getValue() || '',
          latitude: sheet.getRange(i, latCol).getValue() || '',
          longitude: sheet.getRange(i, lngCol).getValue() || '',
          mapsLink: sheet.getRange(i, mapsCol).getValue() || '',
          isActive: true,
          accountStatus: 'Active',
          rowNumber: i
        };
        return { success: true, customer: customer };
      }
    }
    return { success: true, customer: null, message: 'Customer not found' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function createOrUpdateCustomer(data) {
  try {
    if (!data.phone || data.phone.trim() === '') return { success: false, message: 'Phone number is required' };
    if (!data.name  || data.name.trim()  === '') return { success: false, message: 'Name is required' };
    if (!data.area  || data.area.trim()  === '') return { success: false, message: 'Area is required' };
    if (!data.address || data.address.trim() === '') return { success: false, message: 'Address is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('DataBase');
    if (!sheet) {
      sheet = ss.insertSheet('DataBase');
      const headers = ['ID','Name','Phone','WhatsApp','Area','Address','Location',
                       'CreatedAt','UpdatedAt','IsActive','Notes','Round','Round Status',
                       'LocationVerified','Latitude','Longitude','GoogleMapsLink'];
      sheet.getRange(1,1,1,headers.length).setValues([headers]);
      sheet.getRange(2,12).setValue('الرحلة 1');
      sheet.getRange(2,13).setValue('Active');
      sheet.getRange(2,14).setValue('Pending');
    }
    let timestamp;
    if (data.userTimestamp && data.userTimestamp.trim() !== '') {
      timestamp = data.userTimestamp;
    } else {
      const now = new Date();
      timestamp = Utilities.formatDate(now, data.userTimezone || 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');
    }
    const headers   = getHeaders(sheet);
    const latCol    = getColumnIndex(headers,'Latitude') || 15;
    const lngCol    = getColumnIndex(headers,'Longitude') || 16;
    const mapsCol   = getColumnIndex(headers,'GoogleMapsLink') || 17;
    const verifiedCol = getColumnIndex(headers,'LocationVerified') || 14;
    let customerId  = '';
    let customerRow = -1;
    const lastRow   = sheet.getLastRow();
    const inputPhone = data.phone.trim();
    for (let i = 2; i <= lastRow; i++) {
      const rowPhone   = sheet.getRange(i,3).getValue();
      const ps         = rowPhone ? rowPhone.toString().trim() : '';
      const cp         = ps.startsWith("'") ? ps.substring(1) : ps;
      if (cp === inputPhone || ps === "'" + inputPhone ||
          (inputPhone.startsWith('0') && cp === inputPhone.substring(1)) ||
          (!inputPhone.startsWith('0') && cp === '0' + inputPhone)) {
        customerRow = i;
        customerId  = sheet.getRange(i,1).getValue();
        break;
      }
    }
    const phoneToStore    = data.phone.trim();
    const whatsappToStore = (data.whatsapp || data.phone).trim();
    if (customerRow > 0) {
      sheet.getRange(customerRow,2).setValue(data.name.trim());
      sheet.getRange(customerRow,3).setValue(phoneToStore);
      sheet.getRange(customerRow,4).setValue(whatsappToStore);
      sheet.getRange(customerRow,5).setValue(data.area.trim());
      sheet.getRange(customerRow,6).setValue(data.address.trim());
      if (data.latitude && data.longitude && data.latitude.trim() !== '' && data.longitude.trim() !== '') {
        sheet.getRange(customerRow,latCol).setValue(parseFloat(data.latitude));
        sheet.getRange(customerRow,lngCol).setValue(parseFloat(data.longitude));
        sheet.getRange(customerRow,mapsCol).setValue('https://www.google.com/maps?q='+data.latitude+','+data.longitude);
        if (data.location && data.location.trim() !== '') sheet.getRange(customerRow,7).setValue(data.location.trim());
        sheet.getRange(customerRow,verifiedCol).setValue('Verified');
      }
      sheet.getRange(customerRow,9).setValue(timestamp);
      if (data.round && data.round.trim() !== '') sheet.getRange(customerRow,12).setValue(data.round.trim());
    } else {
      customerId = 'C' + Date.now();
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow,1).setValue(customerId);
      sheet.getRange(newRow,2).setValue(data.name.trim());
      sheet.getRange(newRow,3).setValue(phoneToStore);
      sheet.getRange(newRow,4).setValue(whatsappToStore);
      sheet.getRange(newRow,5).setValue(data.area.trim());
      sheet.getRange(newRow,6).setValue(data.address.trim());
      sheet.getRange(newRow,7).setValue(data.location || '');
      sheet.getRange(newRow,8).setValue(timestamp);
      sheet.getRange(newRow,9).setValue(timestamp);
      sheet.getRange(newRow,10).setValue(true);
      sheet.getRange(newRow,11).setValue(data.notes || '');
      if (data.latitude && data.longitude && data.latitude.trim() !== '' && data.longitude.trim() !== '') {
        sheet.getRange(newRow,latCol).setValue(parseFloat(data.latitude));
        sheet.getRange(newRow,lngCol).setValue(parseFloat(data.longitude));
        sheet.getRange(newRow,mapsCol).setValue('https://www.google.com/maps?q='+data.latitude+','+data.longitude);
        sheet.getRange(newRow,verifiedCol).setValue('Verified');
      } else {
        sheet.getRange(newRow,verifiedCol).setValue('Pending');
      }
      if (data.round && data.round.trim() !== '') sheet.getRange(newRow,12).setValue(data.round.trim());
    }
    return {
      success: true,
      message: customerRow > 0 ? 'Customer updated successfully' : 'Customer created successfully',
      customerId: customerId,
      timestamp: timestamp,
      latitude: data.latitude || '',
      longitude: data.longitude || '',
      location: data.location || ''
    };
  } catch (error) {
    return { success: false, message: 'Error while saving customer: ' + error.toString() };
  }
}

function submitOrder(orderData) {
  try {
    if (!orderData.phone || orderData.phone.trim() === '') return { success: false, message: 'Phone number is required' };
    if (!orderData.orderText || orderData.orderText.trim() === '') return { success: false, message: 'Order text is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const statusResult = getOrderStatus();
    if (statusResult.status && statusResult.status.toLowerCase() === 'inactive') {
      return { success: false, message: 'Orders are currently closed.' };
    }
    let targetSheetName = orderData.sheet || SHEET_ORDERS;
    if (targetSheetName !== SHEET_ORDERS && targetSheetName !== SHEET_FAYOUMI) {
      targetSheetName = SHEET_ORDERS;
    }
    let customerId = '';
    let customerLocation = '';
    const dbSheet = ss.getSheetByName('DataBase');
    if (dbSheet && dbSheet.getLastRow() >= 2) {
      const lastRow = dbSheet.getLastRow();
      const inputPhone = orderData.phone.trim();
      const headers = getHeaders(dbSheet);
      const latCol = getColumnIndex(headers,'Latitude') || 15;
      const lngCol = getColumnIndex(headers,'Longitude') || 16;
      for (let i = 2; i <= lastRow; i++) {
        const rowPhone = dbSheet.getRange(i,3).getValue();
        const ps = rowPhone ? rowPhone.toString().trim() : '';
        const cp = ps.startsWith("'") ? ps.substring(1) : ps;
        if (cp === inputPhone || ps === "'" + inputPhone ||
            (inputPhone.startsWith('0') && cp === inputPhone.substring(1))) {
          customerId = dbSheet.getRange(i,1).getValue();
          const sl = dbSheet.getRange(i,7).getValue();
          if (sl) customerLocation = sl;
          if (orderData.name && orderData.name.trim() !== '') dbSheet.getRange(i,2).setValue(orderData.name.trim());
          if (orderData.whatsapp && orderData.whatsapp.trim() !== '') dbSheet.getRange(i,4).setValue(orderData.whatsapp.trim());
          if (orderData.area && orderData.area.trim() !== '') dbSheet.getRange(i,5).setValue(orderData.area.trim());
          if (orderData.address && orderData.address.trim() !== '') dbSheet.getRange(i,6).setValue(orderData.address.trim());
          if (orderData.location && orderData.location.trim() !== '') {
            const cl = dbSheet.getRange(i,7).getValue();
            if (orderData.location !== cl) { dbSheet.getRange(i,7).setValue(orderData.location.trim()); customerLocation = orderData.location; }
          }
          if (orderData.latitude && orderData.longitude && orderData.latitude.trim() !== '' && orderData.longitude.trim() !== '') {
            dbSheet.getRange(i,latCol).setValue(parseFloat(orderData.latitude));
            dbSheet.getRange(i,lngCol).setValue(parseFloat(orderData.longitude));
          }
          const ts2 = Utilities.formatDate(new Date(), orderData.userTimezone||'Asia/Dubai','yyyy-MM-dd HH:mm:ss');
          dbSheet.getRange(i,9).setValue(ts2);
          break;
        }
      }
    }
    if (!customerId) {
      const r = createOrUpdateCustomer({
        phone: orderData.phone, name: orderData.name || 'Customer',
        whatsapp: orderData.whatsapp || orderData.phone,
        area: orderData.area || 'غير محدد', address: orderData.address || 'غير محدد',
        location: orderData.location || '', notes: orderData.notes || '',
        round: orderData.round || '',
        latitude: orderData.latitude || '', longitude: orderData.longitude || '',
        userTimezone: orderData.userTimezone || 'Asia/Dubai',
        userTimestamp: orderData.userTimestamp || ''
      });
      if (!r.success) return r;
      customerId = r.customerId;
      customerLocation = orderData.location || '';
    }
    let ordersSheet = ss.getSheetByName(targetSheetName);
    if (!ordersSheet) {
      ordersSheet = ss.insertSheet(targetSheetName);
      const h = ['OrderID','CustomerID','Items','CustomerName','Phone',
                 'OrderDate','Status','LastUpdated','Notes','Location',
                 'Latitude','Longitude','GoogleMapsLink','Round','Vendor'];
      ordersSheet.getRange(1,1,1,h.length).setValues([h]);
    }
    let timestamp;
    if (orderData.userTimestamp && orderData.userTimestamp.trim() !== '') {
      timestamp = orderData.userTimestamp;
    } else {
      timestamp = Utilities.formatDate(new Date(), orderData.userTimezone||'Asia/Dubai','yyyy-MM-dd HH:mm:ss');
    }
    let existingOrderId = orderData.replaceOrderId || '';
    if (!existingOrderId || existingOrderId.trim() === '') {
      const lastRow2 = ordersSheet.getLastRow();
      let latestDate = null, latestOrderId = null;
      for (let i = 2; i <= lastRow2; i++) {
        const oc = ordersSheet.getRange(i,2).getValue();
        if (oc && oc.toString().trim() === customerId.toString().trim()) {
          const od = ordersSheet.getRange(i,6).getValue();
          if (!latestDate || (od && od > latestDate)) { latestDate = od; latestOrderId = ordersSheet.getRange(i,1).getValue(); }
        }
      }
      if (latestOrderId) existingOrderId = latestOrderId;
    }
    if (existingOrderId && existingOrderId.trim() !== '') {
      let orderRow = -1;
      const lastRow3 = ordersSheet.getLastRow();
      for (let i = 2; i <= lastRow3; i++) {
        if (ordersSheet.getRange(i,1).getValue() === existingOrderId) { orderRow = i; break; }
      }
      if (orderRow > 0) {
        ordersSheet.getRange(orderRow,3).setValue(orderData.orderText.trim());
        ordersSheet.getRange(orderRow,4).setValue(orderData.name||'Customer');
        ordersSheet.getRange(orderRow,5).setValue(orderData.phone);
        ordersSheet.getRange(orderRow,7).setValue('تم التحديث');
        ordersSheet.getRange(orderRow,8).setValue(timestamp);
        ordersSheet.getRange(orderRow,9).setValue(orderData.notes||'');
        if (customerLocation) ordersSheet.getRange(orderRow,10).setValue(customerLocation);
        if (orderData.latitude && orderData.longitude && orderData.latitude.trim()!=='' && orderData.longitude.trim()!=='') {
          ordersSheet.getRange(orderRow,11).setValue(parseFloat(orderData.latitude));
          ordersSheet.getRange(orderRow,12).setValue(parseFloat(orderData.longitude));
          ordersSheet.getRange(orderRow,13).setValue('https://www.google.com/maps?q='+orderData.latitude+','+orderData.longitude);
        }
        if (orderData.round) ordersSheet.getRange(orderRow,14).setValue(orderData.round);
        if (orderData.vendor) ordersSheet.getRange(orderRow,15).setValue(orderData.vendor);
        return { success:true, message:'Order updated successfully', orderId:existingOrderId, customerId, timestamp, location:customerLocation, sheet:targetSheetName, isUpdated:true };
      }
    }
    const orderId = 'O' + Date.now();
    const newOrderRow = ordersSheet.getLastRow() + 1;
    ordersSheet.getRange(newOrderRow,1).setValue(orderId);
    ordersSheet.getRange(newOrderRow,2).setValue(customerId);
    ordersSheet.getRange(newOrderRow,3).setValue(orderData.orderText.trim());
    ordersSheet.getRange(newOrderRow,4).setValue(orderData.name||'Customer');
    ordersSheet.getRange(newOrderRow,5).setValue(orderData.phone);
    ordersSheet.getRange(newOrderRow,6).setValue(timestamp);
    ordersSheet.getRange(newOrderRow,7).setValue('جديد');
    ordersSheet.getRange(newOrderRow,8).setValue(timestamp);
    ordersSheet.getRange(newOrderRow,9).setValue(orderData.notes||'');
    if (customerLocation) { ordersSheet.getRange(newOrderRow,10).setValue(customerLocation); }
    else if (orderData.location && orderData.location.trim()!=='') { ordersSheet.getRange(newOrderRow,10).setValue(orderData.location); }
    if (orderData.latitude && orderData.longitude && orderData.latitude.trim()!=='' && orderData.longitude.trim()!=='') {
      ordersSheet.getRange(newOrderRow,11).setValue(parseFloat(orderData.latitude));
      ordersSheet.getRange(newOrderRow,12).setValue(parseFloat(orderData.longitude));
      ordersSheet.getRange(newOrderRow,13).setValue('https://www.google.com/maps?q='+orderData.latitude+','+orderData.longitude);
    }
    if (orderData.round) ordersSheet.getRange(newOrderRow,14).setValue(orderData.round);
    if (orderData.vendor) ordersSheet.getRange(newOrderRow,15).setValue(orderData.vendor);
    return { success:true, message:'Order submitted successfully', orderId, customerId, timestamp, location:customerLocation, sheet:targetSheetName, isUpdated:false };
  } catch (error) {
    return { success: false, message: 'Error submitting order: ' + error.toString() };
  }
}

function getOrderByCustomer(customerId, sheetName) {
  try {
    if (!customerId || customerId.trim() === '') return { success: false, message: 'Customer ID is required' };
    const targetSheet = sheetName || SHEET_ORDERS;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(targetSheet);
    if (!sheet) return { success: true, order: null, sheet: targetSheet };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, order: null, sheet: targetSheet };
    let latestOrder = null, latestDate = null;
    for (let i = 2; i <= lastRow; i++) {
      const rc = sheet.getRange(i,2).getValue();
      if (rc && rc.toString().trim() === customerId) {
        const od = sheet.getRange(i,6).getValue();
        if (!latestOrder || (od && (!latestDate || od > latestDate))) {
          latestOrder = { id:sheet.getRange(i,1).getValue(), customerId:rc, items:sheet.getRange(i,3).getValue(),
            date:od, status:sheet.getRange(i,7).getValue()||'جديد', notes:sheet.getRange(i,9).getValue()||'',
            address:sheet.getRange(i,10).getValue()||'', latitude:sheet.getRange(i,11).getValue()||'',
            longitude:sheet.getRange(i,12).getValue()||'', location:sheet.getRange(i,10).getValue()||'',
            vendor:sheet.getRange(i,15).getValue()||'', sheet:targetSheet };
          latestDate = od;
        }
      }
    }
    return { success: true, order: latestOrder, sheet: targetSheet };
  } catch (error) { return { success: false, message: error.toString() }; }
}

function updateOrder(data) {
  try {
    if (!data.orderId || data.orderId.trim() === '') return { success: false, message: 'Order ID is required' };
    if (!data.orderText || data.orderText.trim() === '') return { success: false, message: 'Order text is required' };
    const targetSheetName = data.sheet || SHEET_ORDERS;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) return { success: false, message: 'Sheet not found: ' + targetSheetName };
    const lastRow = sheet.getLastRow();
    let orderRow = -1;
    for (let i = 2; i <= lastRow; i++) {
      if (sheet.getRange(i,1).getValue().toString().trim() === data.orderId) { orderRow = i; break; }
    }
    if (orderRow === -1) return { success: false, message: 'Order not found' };
    const timestamp = Utilities.formatDate(new Date(),'Asia/Dubai','yyyy-MM-dd HH:mm:ss');
    sheet.getRange(orderRow,3).setValue(data.orderText.trim());
    sheet.getRange(orderRow,7).setValue(data.status||'تم التحديث');
    sheet.getRange(orderRow,8).setValue(timestamp);
    return { success:true, message:'Order updated successfully', orderId:data.orderId, timestamp, sheet:targetSheetName };
  } catch (error) { return { success: false, message: error.toString() }; }
}

function getHeaders(sheet) {
  const headers = [];
  const lastCol = sheet.getLastColumn();
  for (let col = 1; col <= lastCol; col++) {
    const h = sheet.getRange(1,col).getValue();
    headers.push(h ? h.toString().trim() : '');
  }
  return headers;
}

function getColumnIndex(headers, columnName) {
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].toLowerCase() === columnName.toLowerCase()) return i + 1;
  }
  return null;
}

function updateCustomerLocation(customerId, latitude, longitude) {
  try {
    if (!customerId || !latitude || !longitude) return { success: false, message: 'Missing required parameters' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'Database sheet not found' };
    const lastRow = sheet.getLastRow();
    const headers = getHeaders(sheet);
    const latCol = getColumnIndex(headers,'Latitude')||15;
    const lngCol = getColumnIndex(headers,'Longitude')||16;
    const mapsCol = getColumnIndex(headers,'GoogleMapsLink')||17;
    const verifiedCol = getColumnIndex(headers,'LocationVerified')||14;
    for (let i = 2; i <= lastRow; i++) {
      const rc = sheet.getRange(i,1).getValue();
      if (rc && rc.toString().trim() === customerId) {
        sheet.getRange(i,latCol).setValue(parseFloat(latitude));
        sheet.getRange(i,lngCol).setValue(parseFloat(longitude));
        const ml = 'https://www.google.com/maps?q='+latitude+','+longitude;
        sheet.getRange(i,mapsCol).setValue(ml);
        sheet.getRange(i,7).setValue(ml);
        sheet.getRange(i,verifiedCol).setValue('Verified');
        sheet.getRange(i,9).setValue(Utilities.formatDate(new Date(),'Asia/Dubai','yyyy-MM-dd HH:mm:ss'));
        return { success:true, message:'Location updated successfully', customerId, latitude, longitude };
      }
    }
    return { success: false, message: 'Customer not found' };
  } catch (error) { return { success: false, message: 'Error: ' + error.toString() }; }
}

function getCustomerLocation(customerId) {
  try {
    if (!customerId) return { success: false, message: 'Customer ID is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'Database sheet not found' };
    const lastRow = sheet.getLastRow();
    const headers = getHeaders(sheet);
    const latCol = getColumnIndex(headers,'Latitude')||15;
    const lngCol = getColumnIndex(headers,'Longitude')||16;
    for (let i = 2; i <= lastRow; i++) {
      const rc = sheet.getRange(i,1).getValue();
      if (rc && rc.toString().trim() === customerId) {
        const lat = sheet.getRange(i,latCol).getValue();
        const lng = sheet.getRange(i,lngCol).getValue();
        const loc = sheet.getRange(i,7).getValue();
        if (lat && lng) return { success:true, customerId, latitude:lat, longitude:lng, location:loc||'', message:'Location found' };
        return { success:true, customerId, latitude:null, longitude:null, location:loc||'', message:'No location stored' };
      }
    }
    return { success: false, message: 'Customer not found' };
  } catch (error) { return { success: false, message: 'Error: ' + error.toString() }; }
}

function getLatestOrderByPhone(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone number is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dbSheet = ss.getSheetByName('DataBase');
    if (!dbSheet) return { success: false, message: 'Database sheet not found' };
    let customerId = null;
    const lastRowDB = dbSheet.getLastRow();
    for (let i = 2; i <= lastRowDB; i++) {
      const rp = dbSheet.getRange(i,3).getValue();
      const ps = rp ? rp.toString().trim() : '';
      const cp = ps.startsWith("'") ? ps.substring(1) : ps;
      if (cp===phone||ps==="'"+phone||(phone.startsWith('0')&&cp===phone.substring(1))||(!phone.startsWith('0')&&cp==='0'+phone)) {
        customerId = dbSheet.getRange(i,1).getValue(); break;
      }
    }
    if (!customerId) return { success: true, order: null, message: 'No customer found' };
    const ordersSheet = ss.getSheetByName(SHEET_ORDERS);
    if (!ordersSheet) return { success: true, order: null, message: 'No orders sheet found' };
    const lastRowO = ordersSheet.getLastRow();
    if (lastRowO <= 1) return { success: true, order: null, message: 'No orders' };
    let latestOrder = null, latestDate = null;
    for (let i = 2; i <= lastRowO; i++) {
      const oc = ordersSheet.getRange(i,2).getValue();
      if (oc && oc.toString().trim() === customerId.toString().trim()) {
        const od = ordersSheet.getRange(i,6).getValue();
        if (!latestOrder || (od && (!latestDate || od > latestDate))) {
          latestOrder = { id:ordersSheet.getRange(i,1).getValue(), customerId:oc, items:ordersSheet.getRange(i,3).getValue(),
            date:od, status:ordersSheet.getRange(i,7).getValue()||'جديد',
            latitude:ordersSheet.getRange(i,11).getValue(), longitude:ordersSheet.getRange(i,12).getValue(),
            location:ordersSheet.getRange(i,10).getValue() };
          latestDate = od;
        }
      }
    }
    return latestOrder ? { success:true, order:latestOrder, message:'Latest order found' } : { success:true, order:null, message:'No orders found' };
  } catch (error) { return { success: false, message: 'Error: ' + error.toString() }; }
}

function getCustomerAndLatestOrder(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone number is required' };
    const cr = getCustomer(phone);
    if (!cr.success || !cr.customer) return { success:true, customer:null, latestOrder:null, message:'Customer not found' };
    const customer = cr.customer;
    const customerId = customer.id;
    if (!customerId) return { success:true, customer, latestOrder:null, message:'Customer has no ID' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ordersSheet = ss.getSheetByName(SHEET_ORDERS);
    if (!ordersSheet) return { success:true, customer, latestOrder:null, message:'Orders sheet not found' };
    const lastRowO = ordersSheet.getLastRow();
    if (lastRowO <= 1) return { success:true, customer, latestOrder:null, message:'No orders' };
    let latestOrder = null, latestDate = null;
    for (let i = 2; i <= lastRowO; i++) {
      const oc = ordersSheet.getRange(i,2).getValue();
      if (oc && oc.toString().trim() === customerId.toString().trim()) {
        const od = ordersSheet.getRange(i,6).getValue();
        if (!latestOrder || (od && (!latestDate || od > latestDate))) {
          latestOrder = { id:ordersSheet.getRange(i,1).getValue(), customerId:oc, items:ordersSheet.getRange(i,3).getValue(),
            date:od, status:ordersSheet.getRange(i,7).getValue()||'جديد',
            latitude:ordersSheet.getRange(i,11).getValue()||'', longitude:ordersSheet.getRange(i,12).getValue()||'',
            location:ordersSheet.getRange(i,10).getValue()||'' };
          latestDate = od;
        }
      }
    }
    return { success:true, customer, latestOrder, message: latestOrder ? 'Customer and latest order found' : 'Customer found but no orders' };
  } catch (error) { return { success: false, message: 'Error: ' + error.toString() }; }
}

function getOrders(phone) {
  try {
    if (!phone || phone.trim() === '') return { success: false, message: 'Phone number is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_ORDERS);
    if (!sheet) return { success: false, message: 'Orders sheet not found' };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, orders: [] };
    const orders = [];
    const inputPhone = phone.trim();
    for (let i = 2; i <= lastRow; i++) {
      const rp = sheet.getRange(i,5).getValue();
      const ps = rp ? rp.toString().trim() : '';
      const cp = ps.startsWith("'") ? ps.substring(1) : ps;
      if (cp===inputPhone||ps==="'"+inputPhone||(inputPhone.startsWith('0')&&cp===inputPhone.substring(1))) {
        orders.push({ id:sheet.getRange(i,1).getValue(), customerId:sheet.getRange(i,2).getValue(),
          items:sheet.getRange(i,3).getValue(), date:sheet.getRange(i,6).getValue(),
          status:sheet.getRange(i,7).getValue()||'جديد', latitude:sheet.getRange(i,11).getValue(),
          longitude:sheet.getRange(i,12).getValue(), location:sheet.getRange(i,10).getValue() });
      }
    }
    return { success: true, orders };
  } catch (error) { return { success: false, message: error.toString() }; }
}

function getCustomerById(customerId) {
  try {
    if (!customerId || customerId.trim() === '') return { success: false, message: 'Customer ID is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'Database sheet not found' };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, customer: null };
    const headers = getHeaders(sheet);
    const latCol = getColumnIndex(headers,'Latitude')||15;
    const lngCol = getColumnIndex(headers,'Longitude')||16;
    for (let i = 2; i <= lastRow; i++) {
      const rc = sheet.getRange(i,1).getValue();
      if (rc && rc.toString().trim() === customerId) {
        const rp = sheet.getRange(i,3).getValue();
        const ps = rp ? rp.toString().trim() : '';
        const cp = ps.startsWith("'") ? ps.substring(1) : ps;
        return { success:true, customer:{ id:rc, name:sheet.getRange(i,2).getValue(),
          phone:cp, whatsapp:sheet.getRange(i,4).getValue(), area:sheet.getRange(i,5).getValue(),
          address:sheet.getRange(i,6).getValue(), location:sheet.getRange(i,7).getValue(),
          notes:sheet.getRange(i,11).getValue(), latitude:sheet.getRange(i,latCol).getValue(),
          longitude:sheet.getRange(i,lngCol).getValue() }};
      }
    }
    return { success: true, customer: null };
  } catch (error) { return { success: false, message: error.toString() }; }
}

function onOpen() {
  console.log('HomiCart API v15.1 initialized');
  setupSheets();
}

function setupSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let dbSheet = ss.getSheetByName('DataBase');
    if (!dbSheet) {
      dbSheet = ss.insertSheet('DataBase');
      const h = ['ID','Name','Phone','WhatsApp','Area','Address','Location',
                 'CreatedAt','UpdatedAt','IsActive','Notes','Round','Round Status',
                 'LocationVerified','Latitude','Longitude','GoogleMapsLink'];
      dbSheet.getRange(1,1,1,h.length).setValues([h]);
      dbSheet.getRange(2,12).setValue('الرحلة 1');
      dbSheet.getRange(2,13).setValue('Active');
      dbSheet.getRange(2,14).setValue('Pending');
    }
    const orderSheets = [SHEET_ORDERS, SHEET_FAYOUMI];
    const oh = ['OrderID','CustomerID','Items','CustomerName','Phone',
                'OrderDate','Status','LastUpdated','Notes','Location',
                'Latitude','Longitude','GoogleMapsLink','Round','Vendor'];
    orderSheets.forEach(function(name) {
      let s = ss.getSheetByName(name);
      if (!s) { s = ss.insertSheet(name); s.getRange(1,1,1,oh.length).setValues([oh]); }
    });
    return { success: true, message: 'Sheets setup completed' };
  } catch (error) { return { success: false, message: error.toString() }; }
}
