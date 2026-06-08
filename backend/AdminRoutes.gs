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
  else if (action === 'processVendorFull')      result = processVendorFull(e.parameter.sheet, e.parameter.workspace, parseFloat(e.parameter.lat), parseFloat(e.parameter.lng), e.parameter.batchId || '');
  else if (action === 'getWorkspaceExport')     result = getWorkspaceExport(e.parameter.workspace);
  else if (action === 'processMultiVendorFull') result = processMultiVendorFull(e.parameter.vendors, parseFloat(e.parameter.lat), parseFloat(e.parameter.lng));

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

    var lastDataRow = sheet.getLastRow() - 1;
    var values   = sheet.getRange(2, 1, lastDataRow, 4).getValues();
    // Column C stores =HYPERLINK("URL","text") — getValues() returns display text,
    // NOT the URL. Must use getFormulas() to get the actual Google Maps URL.
    var formulas = sheet.getRange(2, 3, lastDataRow, 1).getFormulas();

    return values
      .filter(function(r) { return r[0]; })
      .map(function(r, i) {
        var formula = (formulas[i] && formulas[i][0]) ? formulas[i][0] : '';
        // Extract URL from: =HYPERLINK("https://www.google.com/maps/dir/...","Open Route N")
        var match = formula.match(/HYPERLINK\("([^"]+)"/i);
        var url   = match ? match[1] : String(r[2] || '');
        return { route: r[0], stops: r[1], url: url, notes: r[3] };
      });
  } catch(err) {
    console.log('_getRouteLinksData error:', err.toString());
    return [];
  }
}


// ════════════════════════════════════════════════════════════════════
//  GET ALL ORDERS FROM VENDOR SHEET
//  sheet: 'Orders' (الركن المصري) or 'AlFayoumi' (الفيومي)
// ════════════════════════════════════════════════════════════════════

function getVendorOrders(sheetName) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName || SHEET_ORDERS);
    if (!sheet || sheet.getLastRow() < 2) return { success: true, orders: [] };

    // v18.0 orders sheet: exactly 12 columns
    // Col: ID(1) CustID(2) Items(3) Name(4) Phone(5) Date(6)
    //      Status(7) UpdatedAt(8) Notes(9) Location(10) Vendor(11) BatchID(12)
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
    var orders = data
      .filter(function(r) { return r[0]; })
      .map(function(r) {
        return {
          orderId    : r[0],   // OrderID
          clientId   : r[1],   // CustomerID
          items      : r[2],   // Items
          name       : r[3],   // CustomerName
          phone      : r[4],   // Phone
          date       : r[5] ? String(r[5]).substring(0, 10) : '',
          status     : r[6],   // Status: New | Preparing | Delivered | Cancelled
          notes      : r[8],   // Notes
          location   : r[9],   // Location URL (maps link stored at order time)
          hasLocation: !!(r[9]) // has a location URL
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

    // v18.0: Orders sheet has 12 cols — no lat/lng in orders, lookup from DataBase
    var data = ordersSheet.getRange(2, 1, lastRow - 1, 12).getValues();

    // Get customer lat/lng from DataBase
    var dbSheet = ss.getSheetByName('DataBase');
    var byId = {};
    if (dbSheet && dbSheet.getLastRow() >= 2) {
      dbSheet.getRange(2, 1, dbSheet.getLastRow()-1, 11).getValues().forEach(function(r) {
        var id = String(r[0]).trim();
        if (id) byId[id] = { lat: String(r[9]||'').trim(), lng: String(r[10]||'').trim() };
      });
    }

    var confirmed = data.filter(function(r) {
      var st  = String(r[6]).trim();
      var cId = String(r[1]).trim();
      var c   = byId[cId] || {};
      return r[0] && (st === 'Preparing') && c.lat && c.lng;
    });

    if (confirmed.length === 0)
      return { success: false, message: 'لا توجد طلبات Preparing مع موقع محدد في DataBase' };

    var routesSheet = ss.getSheetByName('Routes');
    if (!routesSheet) routesSheet = ss.insertSheet('Routes');
    routesSheet.clearContents();
    routesSheet.getRange('H1').setValue(startLat || 0);
    routesSheet.getRange('I1').setValue(startLng || 0);

    // Always use ?q=lat,lng format so extractLatLngFromGoogleMapsLink() can parse it
    var routeRows = confirmed.map(function(r) {
      var cId = String(r[1]).trim();
      var c   = byId[cId] || {};
      var url = 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng;
      return [url, '', '', c.lat, c.lng, '', ''];
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

function processVendorFull(sheetName, workspaceTab, startLat, startLng, batchIdParam) {
  try {
    var batchId     = batchIdParam ? String(batchIdParam).trim() : '';
    // Fallback: sheet = sheetName (store key), workspace = sheetName + 'Workspace'
    if (!sheetName || sheetName === 'undefined')   sheetName    = '';
    if (!workspaceTab || workspaceTab === 'undefined') workspaceTab = sheetName + 'Workspace';
    var ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ordersSheet = sheetName ? ss.getSheetByName(sheetName) : null;
    var dbSheet     = ss.getSheetByName('DataBase');
    var wsSheet     = ss.getSheetByName(workspaceTab);

    if (!ordersSheet) return { success: false, message: 'شيت ' + sheetName + ' مش موجود' };
    if (!dbSheet)     return { success: false, message: 'شيت DataBase مش موجود' };
    // Auto-create workspace tab if missing
    if (!wsSheet) {
      wsSheet = ss.insertSheet(workspaceTab);
      wsSheet.getRange(1,1,1,12).setValues([['Index','','OrderID','CustomerID','RouteNo','Name','Phone','Area','Address','Location','Latitude','Longitude']]);
      wsSheet.getRange(1,1,1,12).setFontWeight('bold').setBackground('#1a3a5c').setFontColor('#ffffff');
      wsSheet.setFrozenRows(1);
    }

    // ── 1. Get Preparing orders (filtered by batchId if provided) ──
    // v18.0 orders: 12 cols — BatchID is col 12 (index 11)
    var oLast = ordersSheet.getLastRow();
    if (oLast < 2) return { success: false, message: 'لا توجد طلبات' };

    var allOrders = ordersSheet.getRange(2, 1, oLast - 1, 12).getValues();
    var confirmed = allOrders.filter(function(r) {
      var st      = String(r[6]).trim();
      var batchOk = !batchId || String(r[11]).trim() === batchId;
      return r[0] && st === 'Preparing' && batchOk;
    });
    if (confirmed.length === 0) {
      return {
        success: false,
        message: batchId
          ? 'لا توجد أوردرات Preparing في الدورة: ' + batchId
          : 'لا توجد أوردرات Preparing في ' + sheetName
      };
    }

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
      var c   = byId[clientId] || byPhone[rawPh] || {};

      // ── Get lat/lng: try DataBase cols 10-11 first, then extract from location URL ──
      var lat = String(c.lat || '').trim();
      var lng = String(c.lng || '').trim();

      // Fallback: many customers store only a Maps URL in c.location (col 7),
      // not separate lat/lng numbers. Extract from ?q=lat,lng if needed.
      if ((!lat || !lng) && c.location) {
        var locStr = String(c.location);
        var locMatch = locStr.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i)
                    || locStr.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
        if (locMatch) { lat = locMatch[1]; lng = locMatch[2]; }
      }

      // ALWAYS build the Maps URL from numeric lat/lng — NEVER from c.location text.
      // GenerateRoutesFromColumnA()
      // cannot parse. Only ?q=LAT,LNG format is correctly extracted by
      // extractLatLngFromGoogleMapsLink() in RouteLinks.gs
      var mapsUrl = (lat && lng)
        ? 'https://www.google.com/maps?q=' + lat + ',' + lng
        : '';

      wsRows.push([
        idx + 1, '',         // A: index, B: empty
        orderId, clientId,   // C: OrderID, D: CustomerID
        '',                  // E: Route Number (filled after routing)
        c.phone   || order[4] || '',  // F: Mobile
        c.name    || order[3] || '',  // G: Name
        c.area    || '',              // H: Area
        c.address || '',              // I: Address
        mapsUrl,                      // J: Maps link (?q=lat,lng format)
        items,                        // K: Order items (Sep-Text Order)
        ''                            // L: Combined Data (formula below)
      ]);

      routeEntries.push({ wsIdx: idx, lat: lat, lng: lng, maps: mapsUrl, hasCoords: !!(lat && lng) });
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
    var routesSheet  = ss.getSheetByName('Routes');
    if (!routesSheet) routesSheet = ss.insertSheet('Routes');
    routesSheet.clearContents();
    routesSheet.getRange('H1').setValue(parseFloat(startLat) || 0);
    routesSheet.getRange('I1').setValue(parseFloat(startLng) || 0);

    // Also clear RouteLinks to avoid returning stale data from a previous run
    var routeLinksSheet = ss.getSheetByName('RouteLinks');
    if (routeLinksSheet) routeLinksSheet.clearContents();

    var validEntries = routeEntries.filter(function(e) { return e.hasCoords; });

    if (validEntries.length === 0) {
      return {
        success     : false,
        message     : 'لا يوجد موقع محدد لأي عميل في DataBase. تأكد من تسجيل lat/lng للعملاء أو أن عمود Location يحتوي على رابط Google Maps.',
        ordersCount : confirmed.length,
        routedCount : 0,
        noCoords    : confirmed.length,
        links       : [],
        whatsappText: ''
      };
    }

    var routeRows = validEntries.map(function(e) {
      return [e.maps, '', '', e.lat, e.lng, '', ''];
    });
    routesSheet.getRange(2, 1, routeRows.length, 7).setValues(routeRows);

    // ── 6. Run route optimization ─────────────────────────────────
    nearestNeighborOrder();

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

    var noCoords = confirmed.length - validEntries.length;
    var msg = 'تم ترتيب مسار ' + validEntries.length + ' أوردر من أصل ' + confirmed.length + ' Preparing';
    if (noCoords > 0) msg += ' — ' + noCoords + ' بدون موقع في DataBase';

    return {
      success      : true,
      message      : msg,
      ordersCount  : confirmed.length,    // total Preparing orders in sheet
      routedCount  : validEntries.length, // orders that had location and got routed
      noCoords     : noCoords,            // orders skipped (no lat/lng in DataBase)
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


// ════════════════════════════════════════════════════════════════════
//  MULTI-VENDOR DELIVERY PIPELINE
//  Combines Preparing orders from multiple vendor sheets,
//  groups by customer, routes once, assigns unified delivery numbers,
//  saves DeliveryNo (col 13) back to each vendor sheet,
//  and returns combined + per-vendor WhatsApp text.
// ════════════════════════════════════════════════════════════════════

function processMultiVendorFull(vendorsParam, startLat, startLng) {
  try {
    var vendors = String(vendorsParam || '').split(',').map(function(v){ return v.trim(); }).filter(function(v){ return v; });
    if (vendors.length === 0) return { success: false, message: 'لم يتم اختيار أي تاجر' };

    var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
    var dbSheet = ss.getSheetByName('DataBase');
    if (!dbSheet) return { success: false, message: 'شيت DataBase مش موجود' };

    // ── 1. Collect all Preparing orders from all vendor sheets ──
    var allOrders = [];
    vendors.forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
      data.forEach(function(r, ri) {
        if (r[0] && String(r[6]).trim() === 'Preparing') {
          allOrders.push({
            vendor   : sheetName,
            rowIndex : ri + 2,
            orderId  : String(r[0]),
            clientId : String(r[1]).trim(),
            items    : String(r[2] || '').trim(),
            name     : String(r[3] || ''),
            phone    : String(r[4] || '').replace(/[\s\-\(\)]/g,'').replace(/^\+?971/,'0').replace(/^00971/,'0')
          });
        }
      });
    });

    if (allOrders.length === 0)
      return { success: false, message: 'لا توجد أوردرات Preparing في التجار المختارين' };

    // ── 2. Build customer lookup from DataBase ──
    //  DataBase columns: ID(1) Name(2) Phone(3) WhatsApp(4) Area(5) Address(6)
    //                    Location(7) CreatedAt(8) UpdatedAt(9) Latitude(10) Longitude(11)
    var dbLast = dbSheet.getLastRow();
    var dbData = dbLast >= 2 ? dbSheet.getRange(2, 1, dbLast - 1, 17).getValues() : [];
    var byId = {}, byPhone = {};
    dbData.forEach(function(r) {
      var id  = String(r[0]).trim();
      var ph  = String(r[2] || '').replace(/[\s\-\(\)]/g,'').replace(/^\+?971/,'0').replace(/^00971/,'0');
      var obj = {
        name    : r[1] || '', phone   : r[2] || '',
        area    : r[4] || '', address : r[5] || '',
        location: String(r[6] || ''),       // col 7 = Location URL (contains correct coords)
        lat     : String(r[9]  || '').trim(), // col 10 = Latitude
        lng     : String(r[10] || '').trim()  // col 11 = Longitude
      };
      if (id) byId[id]    = obj;
      if (ph) byPhone[ph] = obj;
    });

    // ── 3. Group orders by customer → one delivery stop per customer ──
    var customerMap = {};
    allOrders.forEach(function(order) {
      var c   = byId[order.clientId] || byPhone[order.phone] || {};
      var key = order.clientId || order.phone;
      if (!customerMap[key]) {
        var lat = '', lng = '';
        // Prefer the stored Google Maps URL (most reliable source of truth)
        if (c.location) {
          var m = c.location.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i)
               || c.location.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
          if (m) { lat = m[1]; lng = m[2]; }
        }
        // Fallback to explicit Latitude/Longitude columns
        if ((!lat || !lng) && c.lat && c.lng) { lat = c.lat; lng = c.lng; }
        customerMap[key] = {
          clientId  : order.clientId,
          phone     : c.phone    || order.phone,
          name      : c.name     || order.name,
          area      : c.area     || '',
          address   : c.address  || '',
          lat       : lat,
          lng       : lng,
          deliveryNo: '',
          orders    : []
        };
      }
      customerMap[key].orders.push(order);
    });

    var customers = Object.values(customerMap);

    // ── 4. Populate Routes sheet & run nearest-neighbor + 2-OPT ──
    var routesSheet = ss.getSheetByName('Routes');
    if (!routesSheet) routesSheet = ss.insertSheet('Routes');
    routesSheet.clearContents();
    routesSheet.getRange('H1').setValue(parseFloat(startLat) || 0);
    routesSheet.getRange('I1').setValue(parseFloat(startLng) || 0);

    var rlSheet = ss.getSheetByName('RouteLinks');
    if (rlSheet) rlSheet.clearContents();

    var routable = customers.filter(function(c) { return c.lat && c.lng; });
    if (routable.length === 0)
      return { success: false, message: 'لا يوجد موقع لأي عميل في DataBase' };

    var routeRows = routable.map(function(c) {
      return ['https://www.google.com/maps?q=' + c.lat + ',' + c.lng, '', '', c.lat, c.lng, '', ''];
    });
    routesSheet.getRange(2, 1, routeRows.length, 7).setValues(routeRows);

    nearestNeighborOrder();

    // ── 5. Read delivery numbers back from Routes col G ──
    //  IMPORTANT: read BEFORE GenerateRoutesFromColumnA() — that function
    //  SORTS the Routes sheet by visit order, which would scramble the
    //  row↔customer mapping. Here the rows are still in customer insertion
    //  order, so routeNums[i] is the correct visit order for routable[i].
    var routeNums = routesSheet.getRange(2, 7, routable.length, 1).getValues();
    routable.forEach(function(c, i) { c.deliveryNo = routeNums[i][0] || ''; });

    // Now generate the grouped Maps links (this sorts the Routes sheet)
    GenerateRoutesFromColumnA();

    // ── 6. Sort customers by delivery number ──
    customers.sort(function(a, b) {
      return (parseInt(a.deliveryNo) || 999) - (parseInt(b.deliveryNo) || 999);
    });

    // ── 7. Write DeliveryNo (col 13) + status to each vendor sheet ──
    var now = Utilities.formatDate(new Date(), 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');
    vendors.forEach(function(sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) return;
      var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
      var statusArr = [], updatedArr = [], deliveryArr = [];
      data.forEach(function(r) {
        if (r[0] && String(r[6]).trim() === 'Preparing') {
          var key  = String(r[1]).trim() || String(r[4]||'').replace(/[\s\-\(\)]/g,'').replace(/^\+?971/,'0').replace(/^00971/,'0');
          var cust = customerMap[key];
          deliveryArr.push([cust ? (cust.deliveryNo || '') : '']);
          statusArr.push(['جاري التحضير']);
          updatedArr.push([now]);
        } else {
          deliveryArr.push([r[12] || '']);
          statusArr.push([r[6]]);
          updatedArr.push([r[7]]);
        }
      });
      sheet.getRange(2, 7,  statusArr.length,  1).setValues(statusArr);
      sheet.getRange(2, 8,  updatedArr.length,  1).setValues(updatedArr);
      sheet.getRange(2, 13, deliveryArr.length, 1).setValues(deliveryArr);
    });

    // ── 8. Generate Combined WhatsApp text ──
    var combinedText = '';
    customers.forEach(function(cust) {
      if (!cust.deliveryNo) return;
      var mapsUrl = (cust.lat && cust.lng) ? 'https://www.google.com/maps?q=' + cust.lat + ',' + cust.lng : '';
      combinedText += '🧾 رقم ' + cust.deliveryNo + '\n';
      combinedText += '📞 ' + cust.phone + '\n';
      combinedText += '👤 ' + cust.name  + '\n';
      combinedText += '📍 ' + cust.area + '\n';
      if (cust.address) combinedText += cust.address + '\n';
      if (mapsUrl) combinedText += '🗺️ ' + mapsUrl + '\n';
      combinedText += '🛒 الاوردر 👇\n';
      var byVendor = {};
      cust.orders.forEach(function(o) {
        if (!byVendor[o.vendor]) byVendor[o.vendor] = [];
        byVendor[o.vendor].push(o.items);
      });
      Object.keys(byVendor).forEach(function(v) {
        combinedText += '[' + v + ']: ' + byVendor[v].join(' | ') + '\n';
      });
      combinedText += '---------------------------\n\n';
    });

    // ── 9. Generate per-vendor WhatsApp texts ──
    var vendorTexts = {};
    vendors.forEach(function(sheetName) {
      var text = '';
      customers.forEach(function(cust) {
        if (!cust.deliveryNo) return;
        var vOrders = cust.orders.filter(function(o) { return o.vendor === sheetName; });
        if (!vOrders.length) return;
        var mapsUrl = (cust.lat && cust.lng) ? 'https://www.google.com/maps?q=' + cust.lat + ',' + cust.lng : '';
        text += '🧾 رقم ' + cust.deliveryNo + '\n';
        text += '📞 ' + cust.phone + '\n';
        text += '👤 ' + cust.name  + '\n';
        text += '📍 ' + cust.area + '\n';
        if (cust.address) text += cust.address + '\n';
        if (mapsUrl) text += '🗺️ ' + mapsUrl + '\n';
        text += '🛒 الاوردر 👇\n';
        vOrders.forEach(function(o) { text += o.items + '\n'; });
        text += '---------------------------\n\n';
      });
      vendorTexts[sheetName] = text;
    });

    // ── 10. Write structured export sheets for admin review ──
    _writeMultiVendorExportSheets(ss, customers, vendors);

    var routed  = customers.filter(function(c) { return c.deliveryNo; }).length;
    var noCoord = customers.length - routed;

    return {
      success       : true,
      message       : 'تم تجميع ' + routed + ' عميل من ' + vendors.length + ' تاجر' + (noCoord > 0 ? ' — ⚠️ ' + noCoord + ' بدون موقع' : ''),
      totalOrders   : allOrders.length,
      totalCustomers: customers.length,
      combinedText  : combinedText,
      vendorTexts   : vendorTexts,
      links         : _getRouteLinksData()
    };

  } catch(err) {
    return { success: false, message: 'خطأ: ' + err.toString() };
  }
}

// ════════════════════════════════════════════════════════════════════
//  WRITE EXPORT SHEETS — structured tables for admin to review before
//  sending to vendors. Creates:
//   • "تجميع_موحد"        → one row per (customer, vendor) with full info
//   • "تصدير_<vendor>"    → one tab per vendor, filtered to that vendor
//  Sheets are cleared & rewritten on every run.
// ════════════════════════════════════════════════════════════════════
function _writeMultiVendorExportSheets(ss, customers, vendors) {
  try {
    var header = ['رقم التوصيل', 'الاسم', 'الهاتف', 'المنطقة', 'العنوان', 'رابط الموقع', 'التاجر', 'الطلب'];

    // Only routed customers, in delivery-number order
    var routedCustomers = customers
      .filter(function(c) { return c.deliveryNo; })
      .sort(function(a, b) { return (parseInt(a.deliveryNo) || 999) - (parseInt(b.deliveryNo) || 999); });

    // ── Combined sheet: one row per (customer, vendor) ──
    var combinedRows = [];
    routedCustomers.forEach(function(c) {
      var mapsUrl = (c.lat && c.lng) ? 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng : '';
      var byVendor = {};
      c.orders.forEach(function(o) {
        if (!byVendor[o.vendor]) byVendor[o.vendor] = [];
        byVendor[o.vendor].push(o.items);
      });
      Object.keys(byVendor).forEach(function(v) {
        combinedRows.push([c.deliveryNo, c.name, "'" + c.phone, c.area, c.address, mapsUrl, v, byVendor[v].join(' | ')]);
      });
    });
    _replaceSheet(ss, 'تجميع_موحد', header, combinedRows);

    // ── Per-vendor sheets (with column I = ready WhatsApp message) ──
    var vendorHeader = header.concat(['الرسالة الجاهزة']); // column I
    vendors.forEach(function(sheetName) {
      var rows = [];
      routedCustomers.forEach(function(c) {
        var vOrders = c.orders.filter(function(o) { return o.vendor === sheetName; });
        if (!vOrders.length) return;
        var mapsUrl = (c.lat && c.lng) ? 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng : '';
        var items = vOrders.map(function(o){ return o.items; }).join(' | ');

        // Column I: formatted message — same layout as WhatsApp text
        var msg = '🧾 رقم ' + c.deliveryNo + '\n'
                + '📞 ' + c.phone + '\n'
                + '👤 ' + c.name  + '\n'
                + '📍 ' + c.area + '\n'
                + (c.address ? c.address + '\n' : '')
                + (mapsUrl ? '🗺️ ' + mapsUrl + '\n' : '')
                + '🛒 الاوردر 👇\n'
                + vOrders.map(function(o){ return o.items; }).join('\n') + '\n'
                + '---------------------------';

        rows.push([c.deliveryNo, c.name, "'" + c.phone, c.area, c.address, mapsUrl, sheetName, items, msg]);
      });
      // Tab name capped (Sheets limit 100 chars)
      _replaceSheet(ss, ('تصدير_' + sheetName).substring(0, 95), vendorHeader, rows);
    });
  } catch(e) {
    console.warn('_writeMultiVendorExportSheets error:', e.toString());
  }
}

// Clear (or create) a sheet and write header + rows
function _replaceSheet(ss, name, header, rows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}
