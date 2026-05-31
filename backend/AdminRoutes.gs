// ════════════════════════════════════════════════════════════════════
//  AdminRoutes.gs
//  ── تعليمات ──
//  1. في Apps Script editor افتح مشروعك
//  2. اضغط + جنب Files واختار Script
//  3. سمّه  AdminRoutes  (بدون .gs)
//  4. احذف كل الكود الموجود والصق هذا الملف كاملاً
//  5. اضغط Ctrl+S
//
//  ثم في RouteOrder.gs:
//  ابحث عن:   function doGet(e) {
//  وبعد الـ { مباشرةً أضف السطر التالي:
//       var rr = tryRoutingAction(e); if (rr) return rr;
//
//  مثال:
//  function doGet(e) {
//    var rr = tryRoutingAction(e); if (rr) return rr;   // ← السطر الجديد
//    console.log('=== GET REQUEST ===');
//    ...
//  }
// ════════════════════════════════════════════════════════════════════

// ── Helper: wrap result as JSON response ──────────────────────────
function _respond(result) {
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Intercept routing actions before the main doGet logic ─────────
// Returns a response if the action is a routing action, else null.
function tryRoutingAction(e) {
  var action = (e && e.parameter) ? e.parameter.action : null;
  var result = null;

  if      (action === 'setStartPoint')        result = _setStartPoint(e.parameter.lat, e.parameter.lng);
  else if (action === 'runRouteOptimization') result = _runRouteOptimization();
  else if (action === 'generateRouteLinks')   result = _generateRouteLinks();
  else if (action === 'runFullRoutePipeline') result = _runFullRoutePipeline();
  else if (action === 'getRouteLinks')        result = { success: true, links: _getRouteLinksData() };
  else if (action === 'getVendorOrders')      result = getVendorOrders(e.parameter.sheet);
  else if (action === 'routeVendorOrders')    result = routeVendorOrders(e.parameter.sheet, parseFloat(e.parameter.lat), parseFloat(e.parameter.lng));
  else if (action === 'processVendorFull')    result = processVendorFull(e.parameter.sheet, e.parameter.workspace, parseFloat(e.parameter.lat), parseFloat(e.parameter.lng));
  else if (action === 'getWorkspaceExport')   result = getWorkspaceExport(e.parameter.workspace);

  if (result === null) return null;
  return _respond(result);
}


// ════════════════════════════════════════════════════════════════════
//  ROUTING WRAPPERS
//  These call nearestNeighborOrder() (Routing.gs)
//  and GenerateRoutesFromColumnA() (RouteLinks.gs)
// ════════════════════════════════════════════════════════════════════

function _setStartPoint(lat, lng) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Routes');
    if (!sheet) return { success: false, message: 'شيت Routes مش موجود' };
    sheet.getRange('H1').setValue(parseFloat(lat) || 0);
    sheet.getRange('I1').setValue(parseFloat(lng) || 0);
    return { success: true, message: 'تم حفظ نقطة البداية: ' + lat + ', ' + lng };
  } catch(err) { return { success: false, message: err.toString() }; }
}

function _runRouteOptimization() {
  try {
    nearestNeighborOrder();
    return { success: true, message: 'تم ترتيب المسار بنجاح ✅' };
  } catch(err) { return { success: false, message: err.toString() }; }
}

function _generateRouteLinks() {
  try {
    GenerateRoutesFromColumnA();
    return { success: true, message: 'تم توليد الروابط ✅', links: _getRouteLinksData() };
  } catch(err) { return { success: false, message: err.toString() }; }
}

function _runFullRoutePipeline() {
  try {
    nearestNeighborOrder();
    GenerateRoutesFromColumnA();
    return { success: true, message: 'اكتمل الترتيب وتوليد الروابط ✅', links: _getRouteLinksData() };
  } catch(err) { return { success: false, message: err.toString() }; }
}

function _getRouteLinksData() {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('RouteLinks');
    if (!sheet || sheet.getLastRow() < 2) return [];
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    return data.filter(function(r) { return r[2]; }).map(function(r) {
      return {
        route : r[0],
        stops : r[1],
        url   : String(r[2]).replace(/=HYPERLINK\("([^"]+)".*/, '$1'),
        notes : r[3]
      };
    });
  } catch(err) { return []; }
}


// ════════════════════════════════════════════════════════════════════
//  GET ALL ORDERS FROM VENDOR SHEET
//  sheet: 'Orders' (الركن المصري) or 'AlFayoumi' (الفيومي)
// ════════════════════════════════════════════════════════════════════

function getVendorOrders(sheetName) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName || 'Orders');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, orders: [] };
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
    var orders = data
      .filter(function(r) { return r[0]; })
      .map(function(r) {
        return {
          orderId    : r[0],
          clientId   : r[1],
          items      : r[2],
          name       : r[3],
          phone      : r[4],
          date       : r[5] ? String(r[5]).substring(0, 10) : '',
          status     : r[6],
          notes      : r[8],
          location   : r[9],
          latitude   : r[10],
          longitude  : r[11],
          mapsLink   : r[12],
          hasLocation: !!(r[10] && r[11])
        };
      });
    return { success: true, orders: orders };
  } catch(err) {
    return { success: false, message: err.toString(), orders: [] };
  }
}


// ════════════════════════════════════════════════════════════════════
//  ROUTE CONFIRMED ORDERS  (without Workspace)
//  Gets مؤكد orders with locations → routes them → marks جاري التحضير
// ════════════════════════════════════════════════════════════════════

function routeVendorOrders(sheetName, startLat, startLng) {
  try {
    var ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ordersSheet = ss.getSheetByName(sheetName || 'Orders');
    if (!ordersSheet) return { success: false, message: 'شيت ' + sheetName + ' مش موجود' };

    var lastRow = ordersSheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'لا توجد طلبات' };

    var data = ordersSheet.getRange(2, 1, lastRow - 1, 15).getValues();
    var confirmed = data.filter(function(r) {
      var st = String(r[6]).trim(); return r[0] && (st === 'Preparing' || st === 'جاري التحضير') && r[10] && r[11];
    });

    if (confirmed.length === 0)
      return { success: false, message: 'لا توجد طلبات مؤكدة مع موقع محدد' };

    var routesSheet = ss.getSheetByName('Routes');
    if (!routesSheet) routesSheet = ss.insertSheet('Routes');
    routesSheet.clearContents();
    routesSheet.getRange('H1').setValue(startLat || 0);
    routesSheet.getRange('I1').setValue(startLng || 0);

    var routeRows = confirmed.map(function(r) {
      return [r[12] || '', '', '', r[10], r[11], '', ''];
    });
    routesSheet.getRange(2, 1, routeRows.length, 7).setValues(routeRows);

    nearestNeighborOrder();
    GenerateRoutesFromColumnA();

    var now = Utilities.formatDate(new Date(), 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');
    var confirmedIds = {};
    confirmed.forEach(function(r) { confirmedIds[String(r[0])] = true; });

    var statusArr = data.map(function(r) {
      return [confirmedIds[String(r[0])] ? 'جاري التحضير' : r[6]];
    });
    ordersSheet.getRange(2, 7, statusArr.length, 1).setValues(statusArr);

    return {
      success     : true,
      message     : 'تم ترتيب ' + confirmed.length + ' طلب → جاري التحضير ✅',
      ordersCount : confirmed.length,
      links       : _getRouteLinksData()
    };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}


// ════════════════════════════════════════════════════════════════════
//  FULL 1-CLICK PIPELINE  (with Workspace)
//  Replaces 5 manual steps:
//   1. Reads مؤكد orders
//   2. JOINs with DataBase → full customer info
//   3. Populates Workspace / FWorkspace tab (cols A-L)
//   4. Inserts Combined Data formula in col L (WhatsApp format)
//   5. Populates Routes sheet + sets start point
//   6. Runs nearestNeighborOrder() + 2-OPT
//   7. Writes route numbers back to Workspace col E
//   8. AUTO-SORTS Workspace by route number
//   9. Runs GenerateRoutesFromColumnA()
//  10. Updates order status → جاري التحضير (batch)
//  11. Returns WhatsApp text + Maps links
// ════════════════════════════════════════════════════════════════════

function processVendorFull(sheetName, workspaceTab, startLat, startLng) {
  try {
    var ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ordersSheet = ss.getSheetByName(sheetName);
    var dbSheet     = ss.getSheetByName('DataBase');
    var wsSheet     = ss.getSheetByName(workspaceTab);

    if (!ordersSheet) return { success: false, message: 'شيت ' + sheetName + ' مش موجود' };
    if (!dbSheet)     return { success: false, message: 'شيت DataBase مش موجود' };
    if (!wsSheet)     return { success: false, message: 'شيت ' + workspaceTab + ' مش موجود' };

    // ── 1. Get مؤكد orders ────────────────────────────────────────
    var oLast = ordersSheet.getLastRow();
    if (oLast < 2) return { success: false, message: 'لا توجد طلبات' };

    var allOrders = ordersSheet.getRange(2, 1, oLast - 1, 15).getValues();
    var confirmed = allOrders.filter(function(r) {
 var st = String(r[6]).trim(); return r[0] && (st === 'Preparing' || st === 'جاري التحضير');
    });

    if (confirmed.length === 0)
      return { success: false, message: 'لا توجد طلبات بحالة Preparing في ' + sheetName };

    // ── 2. Build customer lookup from DataBase ────────────────────
    var dbLast = dbSheet.getLastRow();
    // v18.0 DataBase: 11 cols — Lat=col10(r[9]), Lng=col11(r[10])
    var dbData = dbLast >= 2 ? dbSheet.getRange(2, 1, dbLast - 1, 11).getValues() : [];

    var byId    = {};
    var byPhone = {};
    dbData.forEach(function(r) {
      var id = String(r[0]).trim();
      var ph = _cleanPhone ? _cleanPhone(String(r[2]||'')) : String(r[2]||'').replace(/[\s\-\(\)]/g,'').replace(/^\+?971/,'0').replace(/^00971/,'0');
      var obj = { name: r[1]||'', phone: r[2]||'', area: r[4]||'', address: r[5]||'',
                  location: r[6]||'', lat: r[9]||'', lng: r[10]||'' };
      if (id) byId[id]    = obj;
      if (ph) byPhone[ph] = obj;
    });

    // ── 3. Build Workspace rows ───────────────────────────────────
    var wsRows      = [];
    var routeEntries = [];

    confirmed.forEach(function(order, idx) {
      var orderId  = order[0];
      var clientId = String(order[1]).trim();
      var items    = String(order[2] || '').trim();
      var rawPh    = String(order[4] || '').replace(/[\s\-\(\)]/g,'').replace(/^\+?971/,'0').replace(/^00971/,'0');
      var c        = byId[clientId] || byPhone[rawPh] || {};
      var maps     = c.mapsLink || (c.lat && c.lng ? 'https://www.google.com/maps?q='+c.lat+','+c.lng : '');

      wsRows.push([
        idx + 1, '',         // A: index, B: empty
        orderId, clientId,   // C: OrderID, D: CustomerID
        '',                  // E: Route Number (filled after routing)
        c.phone  || order[4] || '',  // F: Mobile
        c.name   || order[3] || '',  // G: Name
        c.area   || '',              // H: Area
        c.address|| '',              // I: Address
        maps,                        // J: Maps link
        items,                       // K: Order items (Sep-Text Order)
        ''                           // L: Combined Data (formula below)
      ]);

      routeEntries.push({ wsIdx: idx, lat: c.lat, lng: c.lng, maps: maps, hasCoords: !!(c.lat && c.lng) });
    });

    // ── 4. Clear & write Workspace ────────────────────────────────
    if (wsSheet.getLastRow() > 1)
      wsSheet.getRange(2, 1, wsSheet.getLastRow() - 1, 12).clearContent();

    if (wsRows.length > 0) {
      wsSheet.getRange(2, 1, wsRows.length, 12).setValues(wsRows);

      // Insert Combined Data formula in col L per row (WhatsApp format)
      for (var fi = 0; fi < wsRows.length; fi++) {
        var fr = fi + 2;
        wsSheet.getRange(fr, 12).setFormula(
          '="🧾 رقم "&E'+fr+'&CHAR(10)'+
          '&"📞 "&F'+fr+'&CHAR(10)'+
          '&"👤 "&G'+fr+'&CHAR(10)'+
          '&"📍 "&H'+fr+'&" - "&I'+fr+'&CHAR(10)'+
          '&"🗺️ "&J'+fr+'&CHAR(10)'+
          '&"🛒 الاوردر 👇"&CHAR(10)&K'+fr+'&CHAR(10)'+
          '&"---------------------------"'
        );
      }
    }

    // ── 5. Populate Routes sheet ──────────────────────────────────
    var routesSheet = ss.getSheetByName('Routes');
    if (!routesSheet) routesSheet = ss.insertSheet('Routes');
    routesSheet.clearContents();
    routesSheet.getRange('H1').setValue(parseFloat(startLat) || 0);
    routesSheet.getRange('I1').setValue(parseFloat(startLng) || 0);

    var validEntries = routeEntries.filter(function(e) { return e.hasCoords; });
    if (validEntries.length > 0) {
      var routeRows = validEntries.map(function(e) {
        return [e.maps, '', '', e.lat, e.lng, '', ''];
      });
      routesSheet.getRange(2, 1, routeRows.length, 7).setValues(routeRows);
    }

    // ── 6. Run route optimization ─────────────────────────────────
    if (validEntries.length > 0) nearestNeighborOrder();

    // ── 7. Write route numbers back to Workspace col E ────────────
    if (validEntries.length > 0) {
      var routeNums = routesSheet.getRange(2, 7, validEntries.length, 1).getValues();
      validEntries.forEach(function(entry, ri) {
        var wsRow = entry.wsIdx + 2;
        var rNum  = routeNums[ri] ? routeNums[ri][0] : '';
        if (rNum) wsSheet.getRange(wsRow, 5).setValue(rNum);
      });
    }

    // ── 8. Auto-sort Workspace by route number (col E) ────────────
    var wsLast = wsSheet.getLastRow();
    if (wsLast > 2)
      wsSheet.getRange(2, 1, wsLast - 1, 12).sort({ column: 5, ascending: true });

    // ── 9. Generate Google Maps route links ───────────────────────
    if (validEntries.length > 0) GenerateRoutesFromColumnA();

    // ── 10. Update order statuses in batch ────────────────────────
    var confirmedIds = {};
    confirmed.forEach(function(r) { confirmedIds[String(r[0])] = true; });
    var now = Utilities.formatDate(new Date(), 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');

    var statusArr  = allOrders.map(function(r) { return [confirmedIds[String(r[0])] ? 'جاري التحضير' : r[6]]; });
    var updatedArr = allOrders.map(function(r) { return [confirmedIds[String(r[0])] ? now : r[7]]; });
    ordersSheet.getRange(2, 7, statusArr.length, 1).setValues(statusArr);
    ordersSheet.getRange(2, 8, updatedArr.length, 1).setValues(updatedArr);

    // ── 11. Get WhatsApp text from Workspace col L ────────────────
    var waText = _getWorkspaceExportText(wsSheet);
    var links  = _getRouteLinksData();

    return {
      success      : true,
      message      : 'تم معالجة ' + confirmed.length + ' أوردر ✅',
      ordersCount  : confirmed.length,
      routedCount  : validEntries.length,
      noCoords     : confirmed.length - validEntries.length,
      links        : links,
      whatsappText : waText
    };

  } catch(err) {
    return { success: false, message: 'خطأ: ' + err.toString() };
  }
}


// Returns all Combined Data (col L) joined for WhatsApp sending
function _getWorkspaceExportText(wsSheet) {
  try {
    var last = wsSheet.getLastRow();
    if (last < 2) return '';
    var vals = wsSheet.getRange(2, 12, last - 1, 1).getValues();
    return vals
      .map(function(r) { return String(r[0] || '').trim(); })
      .filter(function(t) { return t; })
      .join('\n\n');
  } catch(e) { return ''; }
}

// Action: get workspace export text for a given tab name
function getWorkspaceExport(workspaceTab) {
  try {
    var ws = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(workspaceTab);
    if (!ws) return { success: false, message: workspaceTab + ' not found' };
    return { success: true, text: _getWorkspaceExportText(ws) };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}
