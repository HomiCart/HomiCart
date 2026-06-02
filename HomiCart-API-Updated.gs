// ============================================
// HomiCart API v18.0
// Batch System + Per-Store Order Windows
// ============================================

const SPREADSHEET_ID = '1txQXRi-19VIDNHQej5vnqYku5-clPOj3QR_JqXKYQI0';

const SHEET_ORDERS  = 'AlRoknAlMasry';
const SHEET_FAYOUMI = 'AlFayoumi';
const SHEET_SETTINGS = 'Settings';

// DataBase column constants
const COL_ID       = 1;
const COL_NAME     = 2;
const COL_PHONE    = 3;
const COL_WHATSAPP = 4;
const COL_AREA     = 5;
const COL_ADDRESS  = 6;
const COL_LOCATION = 7;
const COL_CREATED  = 8;
const COL_UPDATED  = 9;
const COL_LAT      = 10;
const COL_LNG      = 11;

// Order sheet column constants
const ORD_ID         = 1;   // OrderID
const ORD_CUSTOMER   = 2;   // CustomerID
const ORD_ITEMS      = 3;   // Items
const ORD_NAME       = 4;   // Customer Name
const ORD_PHONE      = 5;   // Phone
const ORD_DATE       = 6;   // OrderDate
const ORD_STATUS     = 7;   // Status: New | Preparing | Delivered | Cancelled
const ORD_UPDATED    = 8;   // UpdatedAt
const ORD_NOTES      = 9;   // Notes
const ORD_LOCATION   = 10;  // Location URL
const ORD_VENDOR     = 11;  // Vendor / Store Name
const ORD_BATCH      = 12;  // BatchID ← persistent per operational cycle

// ============================================================
//  HTTP Handlers
// ============================================================
function doGet(e) {
  var rr = tryRoutingAction(e); if (rr) return rr;  // ← السطر الجديد فقط
  console.log('=== GET REQUEST ===');
  const p = e.parameter || {};
  const action = p.action;
  let result;
  try {
    if (!action) {
      result = { success: true, message: 'HomiCart API v17.0' };
    }
    // ── Order Window ──────────────────────────────────────────
    else if (action === 'getOrderWindow')   { result = getOrderWindow(); }
    else if (action === 'setOrderWindow')   { result = setOrderWindow(p); }
    else if (action === 'closeOrderWindow') { result = closeOrderWindow(); }
    // ── Orders ────────────────────────────────────────────────
    else if (action === 'submitOrder')      { result = submitOrder(p); }
    else if (action === 'updateOrderItems')     { result = updateOrderItems(p); }
    else if (action === 'updateOrderWithNewId') { result = updateOrderWithNewId(p); }
    else if (action === 'getOrdersByPhone')         { result = getOrdersByPhone(p); }
    else if (action === 'cancelOrderByCustomer')    { result = cancelOrderByCustomer(p); }
    else if (action === 'updateOrder')      { result = updateOrder(p); }
    else if (action === 'getOrderByCustomer') { result = getOrderByCustomer(p.customerId, p.sheet || SHEET_ORDERS); }
    else if (action === 'getLatestOrderByPhone') { result = getLatestOrderByPhone(p.phone); }
    else if (action === 'getOrders')        { result = getOrders(p.phone); }
    // ── Customers ────────────────────────────────────────────
    else if (action === 'getCustomer')      { result = getCustomer(p.phone); }
    else if (action === 'getCustomerById')  { result = getCustomerById(p.customerId); }
    else if (action === 'createOrUpdateCustomer') { result = createOrUpdateCustomer(p); }
    else if (action === 'getCustomerAndLatestOrder') { result = getCustomerAndLatestOrder(p.phone); }
    else if (action === 'updateCustomerLocation') { result = updateCustomerLocation(p.customerId, p.latitude, p.longitude); }
    else if (action === 'getCustomerLocation') { result = getCustomerLocation(p.customerId); }
    // ── Misc ─────────────────────────────────────────────────
    else if (action === 'getDriveImages')   { result = getDriveImages(p.folderId); }
    else if (action === 'ping' || action === 'test')      { result = { success: true, message: 'pong', ts: new Date().toISOString() }; }
    // ── Admin ─────────────────────────────────────────────
    else if (action === 'getAdminStats')          { result = getAdminStats(); }
    else if (action === 'getStoreOrders')         { result = getStoreOrders(p); }
    else if (action === 'getStoreOrderWindow')    { result = getStoreOrderWindow(p); }
    else if (action === 'setStoreOrderWindow')    { result = setStoreOrderWindow(p); }
    else if (action === 'bulkUpdateStatus')       { result = bulkUpdateStatus(p); }
    else if (action === 'adminUpdateOrderStatus') { result = adminUpdateOrderStatus(p); }
    // ── Batch System ──────────────────────────────────────
    else if (action === 'getActiveBatch')  { result = getActiveBatch(p); }
    else if (action === 'startNewBatch')   { result = startNewBatch(p); }
    else if (action === 'closeBatch')      { result = closeBatch(p); }
    else if (action === 'getBatchOrders')   { result = getBatchOrders(p); }
    else if (action === 'reactivateBatch') { result = reactivateBatch(p); }
    else if (action === 'extendBatch')        { result = extendBatch(p); }
    else if (action === 'getPreviousBatches') { result = getPreviousBatches(p); }
    else { result = { success: false, message: 'Unknown action: ' + action }; }
  } catch(err) {
    result = { success: false, message: 'Server error: ' + err.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const p = {};
    if (e.postData) {
      try { Object.assign(p, JSON.parse(e.postData.contents)); }
      catch(_) { Object.assign(p, e.parameter || {}); }
    } else {
      Object.assign(p, e.parameter || {});
    }
    // Route same as GET
    const fakeE = { parameter: p };
    return doGet(fakeE);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
//  ORDER WINDOW — Admin controls when orders open/close
// ============================================================

// Returns current window status: isOpen, start, end, phase
function getOrderWindow() {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) return { success: true, isOpen: false, phase: 'no_settings', message: 'Order window not configured' };

    const rows = sheet.getDataRange().getValues();
    const cfg  = {};
    rows.forEach(r => { if (r[0]) cfg[r[0].toString().trim()] = r[1]; });

    const start = cfg['window_start'] ? new Date(cfg['window_start']) : null;
    const end   = cfg['window_end']   ? new Date(cfg['window_end'])   : null;

    if (!start || !end) return { success: true, isOpen: false, phase: 'no_settings', message: 'Window not set' };

    const now = new Date();
    let phase, isOpen;
    if (now < start) { phase = 'before_open'; isOpen = false; }
    else if (now <= end) { phase = 'open'; isOpen = true; }
    else { phase = 'closed'; isOpen = false; }

    return {
      success: true,
      isOpen,
      phase,
      start: start.toISOString(),
      end  : end.toISOString(),
      now  : now.toISOString(),
      message: isOpen ? 'Orders are open' : (phase === 'before_open' ? 'Not open yet' : 'Orders closed'),
    };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// Admin: set the order window start and end times
// Params: start (ISO string or 'YYYY-MM-DD HH:MM'), end (same)
function setOrderWindow(p) {
  try {
    if (!p.start || !p.end) return { success: false, message: 'start and end required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_SETTINGS);
      sheet.appendRow(['Key', 'Value', 'Description']);
      sheet.getRange(1,1,1,3).setFontWeight('bold');
    }
    _upsertSetting(sheet, 'window_start', p.start);
    _upsertSetting(sheet, 'window_end',   p.end);
    _upsertSetting(sheet, 'window_status','open');
    return { success: true, message: 'Order window set', start: p.start, end: p.end };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// Admin / auto: close the window — convert all "New" orders → "Preparing"
function closeOrderWindow() {
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ts      = _timestamp('Asia/Dubai');
    let   updated = 0;

    [SHEET_ORDERS, SHEET_FAYOUMI].forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (!sheet) return;
      const last = sheet.getLastRow();
      for (let i = 2; i <= last; i++) {
        if (sheet.getRange(i, ORD_STATUS).getValue() === 'New') {
          sheet.getRange(i, ORD_STATUS).setValue('Preparing');
          sheet.getRange(i, ORD_UPDATED).setValue(ts);
          updated++;
        }
      }
    });

    // Mark window as closed in Settings
    const settings = ss.getSheetByName(SHEET_SETTINGS);
    if (settings) _upsertSetting(settings, 'window_status', 'closed');

    return { success: true, updated, message: `${updated} orders moved to Preparing` };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// ============================================================
//  SUBMIT NEW ORDER
// ============================================================
function submitOrder(p) {
  try {
    if (!p.phone)     return { success: false, message: 'Phone required' };
    if (!p.orderText) return { success: false, message: 'Order text required' };

    const ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName  = _validSheet(p.sheet) || SHEET_ORDERS;
    let   sheet      = ss.getSheetByName(sheetName);
    if (!sheet) sheet = _setupOrderSheet(ss, sheetName);

    // Get or create customer
    const custResult = getCustomer(p.phone.trim());
    let   customerId = '';
    if (custResult.success && custResult.customer) {
      customerId = custResult.customer.id;
    } else {
      const r = createOrUpdateCustomer({
        phone: p.phone, name: p.name || 'Customer',
        area: p.area || 'غير محدد', address: p.address || 'غير محدد',
        whatsapp: p.whatsapp || p.phone, userTimezone: p.userTimezone || 'Asia/Dubai',
      });
      if (r.success) customerId = r.customerId;
    }

    const orderId    = 'O' + Date.now();
    const ts         = _timestamp(p.userTimezone || 'Asia/Dubai');
    const locationUrl = _buildLocationUrl(p.latitude, p.longitude, p.location);
    const newRow     = sheet.getLastRow() + 1;

    // Get active BatchID for this store (creates one if missing)
    let batchId = '';
    try {
      const batchResult = getActiveBatch({ store: sheetName });
      if (batchResult.batchId && batchResult.isActive) {
        batchId = batchResult.batchId;
      } else if (!batchResult.batchId) {
        // Auto-create first batch if none exists
        const nb = startNewBatch({ store: sheetName });
        batchId = nb.batchId || '';
      }
      // If batch exists but is closed → orders still use same batchId (admin must start new one)
      if (!batchId && batchResult.batchId) batchId = batchResult.batchId;
    } catch(_) {}

    sheet.getRange(newRow, ORD_ID).setValue(orderId);
    sheet.getRange(newRow, ORD_CUSTOMER).setValue(customerId);
    sheet.getRange(newRow, ORD_ITEMS).setValue(p.orderText.trim());
    sheet.getRange(newRow, ORD_NAME).setValue(p.name || '');
    sheet.getRange(newRow, ORD_PHONE).setValue(p.phone.trim());
    sheet.getRange(newRow, ORD_DATE).setValue(ts);
    sheet.getRange(newRow, ORD_STATUS).setValue('New');
    sheet.getRange(newRow, ORD_UPDATED).setValue(ts);
    if (p.notes)     sheet.getRange(newRow, ORD_NOTES).setValue(p.notes);
    if (locationUrl) sheet.getRange(newRow, ORD_LOCATION).setValue(locationUrl);
    if (p.vendor)    sheet.getRange(newRow, ORD_VENDOR).setValue(p.vendor);
    if (batchId)     sheet.getRange(newRow, ORD_BATCH).setValue(batchId);

    return { success: true, orderId, customerId, batchId, timestamp: ts, sheet: sheetName, status: 'New' };
  } catch(err) {
    return { success: false, message: 'submitOrder error: ' + err.toString() };
  }
}

// ============================================================
//  UPDATE ORDER ITEMS (Edit same row — no new ID created)
// ============================================================
function updateOrderItems(p) {
  try {
    if (!p.orderId) return { success: false, message: 'orderId required' };
    if (!p.items)   return { success: false, message: 'items required' };

    const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = _validSheet(p.sheet) || SHEET_ORDERS;
    const sheet     = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Sheet not found: ' + sheetName };

    const lastRow = sheet.getLastRow();
    for (let i = 2; i <= lastRow; i++) {
      const rowId = sheet.getRange(i, ORD_ID).getValue();
      if (rowId && rowId.toString().trim() === p.orderId.toString().trim()) {
        const status = sheet.getRange(i, ORD_STATUS).getValue();
        // Only allow edit if status is "New"
        if (status !== 'New') {
          return { success: false, message: 'Cannot edit — order status is: ' + status };
        }
        const ts = _timestamp('Asia/Dubai');
        sheet.getRange(i, ORD_ITEMS).setValue(p.items.trim());
        sheet.getRange(i, ORD_UPDATED).setValue(ts);
        return { success: true, orderId: p.orderId, status, timestamp: ts, message: 'Order updated' };
      }
    }
    return { success: false, message: 'Order not found: ' + p.orderId };
  } catch(err) {
    return { success: false, message: 'updateOrderItems error: ' + err.toString() };
  }
}

// ============================================================
//  UPDATE ORDER WITH NEW ID (edit same row, assign new OrderID)
//  - Updates: OrderID (new), Items, OrderDate, UpdatedAt
//  - Does NOT create a new row — updates existing row only
//  - Only allowed if Status = "New" and window is open
// ============================================================
function updateOrderWithNewId(p) {
  try {
    if (!p.orderId) return { success: false, message: 'orderId required' };
    if (!p.items)   return { success: false, message: 'items required' };

    const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = _validSheet(p.sheet) || SHEET_ORDERS;
    const sheet     = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Sheet not found: ' + sheetName };

    const lastRow = sheet.getLastRow();
    for (let i = 2; i <= lastRow; i++) {
      const rowId = (sheet.getRange(i, ORD_ID).getValue() || '').toString().trim();
      if (rowId === p.orderId.toString().trim()) {
        const status = sheet.getRange(i, ORD_STATUS).getValue();
        if (status !== 'New') {
          return { success: false, message: 'Cannot edit — order status is: ' + status };
        }
        const newOrderId = 'O' + Date.now();
        const ts         = _timestamp('Asia/Dubai');
        sheet.getRange(i, ORD_ID).setValue(newOrderId);       // New OrderID
        sheet.getRange(i, ORD_ITEMS).setValue(p.items.trim()); // Updated items
        sheet.getRange(i, ORD_DATE).setValue(ts);              // Updated OrderDate
        sheet.getRange(i, ORD_UPDATED).setValue(ts);           // UpdatedAt
        return {
          success: true,
          oldOrderId: p.orderId,
          newOrderId,
          status,
          timestamp: ts,
          message: 'Order updated with new ID'
        };
      }
    }
    return { success: false, message: 'Order not found: ' + p.orderId };
  } catch(err) {
    return { success: false, message: 'updateOrderWithNewId error: ' + err.toString() };
  }
}

// ============================================================
//  GET ALL ORDERS BY PHONE (for customer order history)
// ============================================================
function getOrdersByPhone(p) {
  try {
    if (!p.phone) return { success: false, message: 'Phone required' };

    const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = _validSheet(p.sheet) || SHEET_ORDERS;
    const sheet     = ss.getSheetByName(sheetName);
    if (!sheet) return { success: true, orders: [] };

    // Find customerID by phone
    const custResult = getCustomer(p.phone.trim());
    if (!custResult.success || !custResult.customer) {
      return { success: true, orders: [] };
    }
    const customerId = custResult.customer.id;

    const lastRow = sheet.getLastRow();
    const orders  = [];
    for (let i = 2; i <= lastRow; i++) {
      const cid = (sheet.getRange(i, ORD_CUSTOMER).getValue() || '').toString().trim();
      if (cid === customerId.toString().trim()) {
        const status = sheet.getRange(i, ORD_STATUS).getValue() || 'New';
        orders.push({
          id    : sheet.getRange(i, ORD_ID).getValue()    || '',
          items : sheet.getRange(i, ORD_ITEMS).getValue() || '',
          date  : sheet.getRange(i, ORD_DATE).getValue()  || '',
          status,
        });
      }
    }
    return { success: true, orders, count: orders.length };
  } catch(err) {
    return { success: false, message: 'getOrdersByPhone error: ' + err.toString() };
  }
}

// ============================================================
//  CANCEL ORDER BY CUSTOMER — deletes row from sheet
//  Only allowed if Status = "New"
// ============================================================
function cancelOrderByCustomer(p) {
  try {
    if (!p.orderId) return { success: false, message: 'orderId required' };

    const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = _validSheet(p.sheet) || SHEET_ORDERS;
    const sheet     = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Sheet not found: ' + sheetName };

    const lastRow = sheet.getLastRow();
    for (let i = 2; i <= lastRow; i++) {
      const rowId = (sheet.getRange(i, ORD_ID).getValue() || '').toString().trim();
      if (rowId === p.orderId.toString().trim()) {
        const status = sheet.getRange(i, ORD_STATUS).getValue();
        if (status !== 'New') {
          return { success: false, message: 'لا يمكن إلغاء الطلب — الحالة الحالية: ' + status };
        }
        sheet.deleteRow(i); // ← permanently remove from sheet
        return { success: true, orderId: p.orderId, message: 'Order cancelled and removed' };
      }
    }
    return { success: false, message: 'Order not found: ' + p.orderId };
  } catch(err) {
    return { success: false, message: 'cancelOrderByCustomer error: ' + err.toString() };
  }
}

// ============================================================
//  UPDATE ORDER (status or other fields)
// ============================================================
function updateOrder(p) {
  try {
    if (!p.orderId)   return { success: false, message: 'orderId required' };
    if (!p.orderText) return { success: false, message: 'orderText required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(_validSheet(p.sheet) || SHEET_ORDERS);
    if (!sheet) return { success: false, message: 'Sheet not found' };
    const last = sheet.getLastRow();
    for (let i = 2; i <= last; i++) {
      if (sheet.getRange(i, ORD_ID).getValue().toString().trim() === p.orderId) {
        const ts = _timestamp('Asia/Dubai');
        sheet.getRange(i, ORD_ITEMS).setValue(p.orderText.trim());
        sheet.getRange(i, ORD_STATUS).setValue(p.status || 'New');
        sheet.getRange(i, ORD_UPDATED).setValue(ts);
        return { success: true, orderId: p.orderId, timestamp: ts };
      }
    }
    return { success: false, message: 'Order not found' };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// ============================================================
//  CUSTOMERS
// ============================================================
function createOrUpdateCustomer(data) {
  try {
    if (!data.phone || !data.phone.trim()) return { success: false, message: 'Phone required' };
    if (!data.name  || !data.name.trim())  return { success: false, message: 'Name required' };
    if (!data.area  || !data.area.trim())  return { success: false, message: 'Area required' };
    if (!data.address || !data.address.trim()) return { success: false, message: 'Address required' };

    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName('DataBase');
    if (!sheet) sheet = _setupDataBase(ss);

    const ts           = _timestamp(data.userTimezone || 'Asia/Dubai', data.userTimestamp);
    const phoneToStore = data.phone.trim();
    const waToStore    = (data.whatsapp || data.phone).trim();
    const locationUrl  = _buildLocationUrl(data.latitude, data.longitude, data.location);

    let customerId = '', customerRow = -1;
    const lastRow = sheet.getLastRow();
    for (let i = 2; i <= lastRow; i++) {
      if (_phoneMatch(sheet.getRange(i, COL_PHONE).getValue(), phoneToStore)) {
        customerRow = i;
        customerId  = sheet.getRange(i, COL_ID).getValue();
        break;
      }
    }

    if (customerRow > 0) {
      sheet.getRange(customerRow, COL_NAME).setValue(data.name.trim());
      sheet.getRange(customerRow, COL_WHATSAPP).setValue(waToStore);
      sheet.getRange(customerRow, COL_AREA).setValue(data.area.trim());
      sheet.getRange(customerRow, COL_ADDRESS).setValue(data.address.trim());
      if (locationUrl) sheet.getRange(customerRow, COL_LOCATION).setValue(locationUrl);
      sheet.getRange(customerRow, COL_UPDATED).setValue(ts);
      if (data.latitude && data.longitude) {
        sheet.getRange(customerRow, COL_LAT).setValue(parseFloat(data.latitude));
        sheet.getRange(customerRow, COL_LNG).setValue(parseFloat(data.longitude));
      }
    } else {
      customerId = 'C' + Date.now();
      const row  = sheet.getLastRow() + 1;
      sheet.getRange(row, COL_ID).setValue(customerId);
      sheet.getRange(row, COL_NAME).setValue(data.name.trim());
      sheet.getRange(row, COL_PHONE).setValue(phoneToStore);
      sheet.getRange(row, COL_WHATSAPP).setValue(waToStore);
      sheet.getRange(row, COL_AREA).setValue(data.area.trim());
      sheet.getRange(row, COL_ADDRESS).setValue(data.address.trim());
      sheet.getRange(row, COL_LOCATION).setValue(locationUrl || '');
      sheet.getRange(row, COL_CREATED).setValue(ts);
      sheet.getRange(row, COL_UPDATED).setValue(ts);
      if (data.latitude && data.longitude) {
        sheet.getRange(row, COL_LAT).setValue(parseFloat(data.latitude));
        sheet.getRange(row, COL_LNG).setValue(parseFloat(data.longitude));
      }
    }

    return { success: true, customerId, timestamp: ts, location: locationUrl,
             message: customerRow > 0 ? 'Customer updated' : 'Customer created' };
  } catch(err) {
    return { success: false, message: 'createOrUpdateCustomer error: ' + err.toString() };
  }
}

function getCustomer(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: true, customer: null };
    const last = sheet.getLastRow();
    for (let i = 2; i <= last; i++) {
      if (_phoneMatch(sheet.getRange(i, COL_PHONE).getValue(), phone.trim())) {
        return { success: true, customer: {
          id       : sheet.getRange(i, COL_ID).getValue()       || '',
          name     : sheet.getRange(i, COL_NAME).getValue()      || '',
          phone    : _cleanPhone(sheet.getRange(i, COL_PHONE).getValue()),
          whatsapp : sheet.getRange(i, COL_WHATSAPP).getValue()  || '',
          area     : sheet.getRange(i, COL_AREA).getValue()      || '',
          address  : sheet.getRange(i, COL_ADDRESS).getValue()   || '',
          location : sheet.getRange(i, COL_LOCATION).getValue()  || '',
          latitude : sheet.getRange(i, COL_LAT).getValue()       || '',
          longitude: sheet.getRange(i, COL_LNG).getValue()       || '',
        }};
      }
    }
    return { success: true, customer: null };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function getCustomerById(customerId) {
  try {
    if (!customerId) return { success: false, message: 'customerId required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: true, customer: null };
    const last = sheet.getLastRow();
    for (let i = 2; i <= last; i++) {
      if ((sheet.getRange(i, COL_ID).getValue() || '').toString().trim() === customerId.toString().trim()) {
        return { success: true, customer: {
          id       : sheet.getRange(i, COL_ID).getValue()       || '',
          name     : sheet.getRange(i, COL_NAME).getValue()      || '',
          phone    : _cleanPhone(sheet.getRange(i, COL_PHONE).getValue()),
          whatsapp : sheet.getRange(i, COL_WHATSAPP).getValue()  || '',
          area     : sheet.getRange(i, COL_AREA).getValue()      || '',
          address  : sheet.getRange(i, COL_ADDRESS).getValue()   || '',
          location : sheet.getRange(i, COL_LOCATION).getValue()  || '',
          latitude : sheet.getRange(i, COL_LAT).getValue()       || '',
          longitude: sheet.getRange(i, COL_LNG).getValue()       || '',
        }};
      }
    }
    return { success: true, customer: null };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function getCustomerAndLatestOrder(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone required' };
    const cr = getCustomer(phone);
    if (!cr.success || !cr.customer) return { success: true, customer: null, latestOrder: null };
    const or = getOrderByCustomer(cr.customer.id, SHEET_ORDERS);
    return { success: true, customer: cr.customer, latestOrder: or.order || null };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function updateCustomerLocation(customerId, latitude, longitude) {
  try {
    if (!customerId || !latitude || !longitude) return { success: false, message: 'Missing params' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'DataBase not found' };
    const loc = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const last = sheet.getLastRow();
    for (let i = 2; i <= last; i++) {
      if ((sheet.getRange(i, COL_ID).getValue() || '').toString().trim() === customerId) {
        sheet.getRange(i, COL_LOCATION).setValue(loc);
        sheet.getRange(i, COL_LAT).setValue(parseFloat(latitude));
        sheet.getRange(i, COL_LNG).setValue(parseFloat(longitude));
        sheet.getRange(i, COL_UPDATED).setValue(_timestamp('Asia/Dubai'));
        return { success: true, customerId, location: loc };
      }
    }
    return { success: false, message: 'Customer not found' };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function getCustomerLocation(customerId) {
  try {
    const r = getCustomerById(customerId);
    if (!r.success || !r.customer) return { success: false, message: 'Customer not found' };
    return { success: true, customerId, latitude: r.customer.latitude, longitude: r.customer.longitude, location: r.customer.location };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function getOrders(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone required' };
    const cr = getCustomer(phone);
    if (!cr.success || !cr.customer) return { success: true, orders: [] };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_ORDERS);
    if (!sheet) return { success: true, orders: [] };
    const last = sheet.getLastRow(), orders = [];
    for (let i = 2; i <= last; i++) {
      if ((sheet.getRange(i, ORD_CUSTOMER).getValue() || '').toString().trim() === cr.customer.id) {
        orders.push({
          id      : sheet.getRange(i, ORD_ID).getValue(),
          items   : sheet.getRange(i, ORD_ITEMS).getValue(),
          date    : sheet.getRange(i, ORD_DATE).getValue(),
          status  : sheet.getRange(i, ORD_STATUS).getValue() || 'New',
          location: sheet.getRange(i, ORD_LOCATION).getValue() || '',
        });
      }
    }
    return { success: true, orders };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function getOrderByCustomer(customerId, sheetName) {
  try {
    if (!customerId) return { success: false, message: 'customerId required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName || SHEET_ORDERS);
    if (!sheet) return { success: true, order: null };
    const last = sheet.getLastRow();
    let latest = null, latestDate = null;
    for (let i = 2; i <= last; i++) {
      if ((sheet.getRange(i, ORD_CUSTOMER).getValue() || '').toString().trim() === customerId.toString().trim()) {
        const d = sheet.getRange(i, ORD_DATE).getValue();
        if (!latest || (d && d > latestDate)) {
          latestDate = d;
          latest = {
            id        : sheet.getRange(i, ORD_ID).getValue(),
            customerId: customerId,
            items     : sheet.getRange(i, ORD_ITEMS).getValue(),
            date      : d,
            status    : sheet.getRange(i, ORD_STATUS).getValue() || 'New',
            location  : sheet.getRange(i, ORD_LOCATION).getValue() || '',
            vendor    : sheet.getRange(i, ORD_VENDOR).getValue()   || '',
            sheet     : sheetName,
          };
        }
      }
    }
    return { success: true, order: latest };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function getLatestOrderByPhone(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone required' };
    const cr = getCustomer(phone);
    if (!cr.success || !cr.customer) return { success: true, order: null };
    return getOrderByCustomer(cr.customer.id, SHEET_ORDERS);
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

// ============================================================
//  DRIVE IMAGES
// ============================================================
function getDriveImages(folderId) {
  if (!folderId) return { success: false, files: [], message: 'folderId required' };
  try {
    const folder = DriveApp.getFolderById(folderId.trim());
    const iter   = folder.getFiles();
    const files  = [];
    while (iter.hasNext()) {
      const f = iter.next();
      if (!f.getMimeType().startsWith('image/')) continue;
      const id = f.getId();
      files.push({ name: f.getName(), id, url: 'https://drive.google.com/uc?export=view&id=' + id, fullUrl: 'https://drive.google.com/uc?export=view&id=' + id });
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, files, count: files.length };
  } catch(err) {
    return { success: false, files: [], message: 'Drive error: ' + err.toString() };
  }
}

// ============================================================
//  BATCH SYSTEM
//  BatchID is persistent per store — same batch across all
//  time windows until admin explicitly starts a new cycle.
// ============================================================

// Get the current active batch for a store
function getActiveBatch(p) {
  try {
    const store = p.store;
    if (!store) return { success: false, message: 'store required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) return { success: true, batchId: null, status: 'no_batch', isActive: false };
    const rows = sheet.getDataRange().getValues();
    const cfg  = {};
    rows.forEach(r => { if (r[0]) cfg[r[0].toString().trim()] = r[1]; });
    const batchId = cfg[store + '_batch_id']     || null;
    const status  = (cfg[store + '_batch_status'] || 'closed').toString().trim();
    return { success: true, batchId, status, isActive: status === 'active' };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Admin-only: start a brand new batch (new operational cycle)
// Automatically closes previous batch: New → Preparing for all old batch orders
function startNewBatch(p) {
  try {
    const store = p.store;
    if (!store) return { success: false, message: 'store required' };

    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) sheet = _setupSettingsSheet(ss);

    // ── Step 1: Get previous batch info ──────────────────────
    const prevBatch = getActiveBatch({ store });
    let autoClosedCount = 0;

    // ── Step 2: Auto-close previous batch (New → Preparing) ──
    // Triggered automatically when new batch starts
    if (prevBatch.batchId) {
      autoClosedCount = _closeBatchOrders(store, prevBatch.batchId);
      _upsertSetting(sheet, store + '_batch_status', 'closed');
      console.log('Auto-closed previous batch: ' + prevBatch.batchId + ' — ' + autoClosedCount + ' orders moved to Preparing');
    }

    // ── Step 3: Create new batch ─────────────────────────────
    const newBatchId = 'BATCH-' + store.replace(/\s/g,'') + '-' + Date.now();
    _upsertSetting(sheet, store + '_batch_id',     newBatchId);
    _upsertSetting(sheet, store + '_batch_status', 'active');

    return {
      success          : true,
      newBatchId,
      previousBatchId  : prevBatch.batchId || null,
      autoClosedOrders : autoClosedCount,
      store,
      message          : 'New batch started. ' + autoClosedCount + ' previous orders moved to Preparing.'
    };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Internal: close all "New" orders for a specific BatchID → Preparing
function _closeBatchOrders(store, batchId) {
  try {
    const sheetName = _validSheet(store) || SHEET_ORDERS;
    const ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet     = ss.getSheetByName(sheetName);
    if (!sheet || !batchId) return 0;
    const last = sheet.getLastRow();
    if (last < 2) return 0;
    const ts  = _timestamp('Asia/Dubai');
    const bid = batchId.toString().trim();
    // Read batch + status columns at once
    const data    = sheet.getRange(2, 1, last - 1, 12).getValues();
    let   updated = 0;
    data.forEach((row, idx) => {
      const rowBatch  = (row[ORD_BATCH-1]  || '').toString().trim();
      const rowStatus = (row[ORD_STATUS-1] || '').toString().trim();
      if (rowBatch === bid && rowStatus === 'New') {
        const rowNum = idx + 2;
        sheet.getRange(rowNum, ORD_STATUS).setValue('Preparing');
        sheet.getRange(rowNum, ORD_UPDATED).setValue(ts);
        updated++;
      }
    });
    return updated;
  } catch(e) {
    console.warn('_closeBatchOrders error:', e.toString());
    return 0;
  }
}

// Close the current batch: New → Preparing (only for current BatchID)
// Called when timer hits zero OR by admin
function closeBatch(p) {
  try {
    const store = p.store;
    if (!store) return { success: false, message: 'store required' };

    // Get current batch to filter orders by BatchID
    const batch   = getActiveBatch({ store });
    let   updated = 0;

    if (batch.batchId) {
      // Close ONLY orders belonging to this specific batch
      updated = _closeBatchOrders(store, batch.batchId);
    } else {
      // No batch found — fallback: close all New orders
      const r = bulkUpdateStatus({ sheet: _validSheet(store) || SHEET_ORDERS, fromStatus: 'New', toStatus: 'Preparing' });
      updated = r.updated || 0;
    }

    // Mark batch as closed
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) sheet = _setupSettingsSheet(ss);
    _upsertSetting(sheet, store + '_batch_status', 'closed');

    return {
      success      : true,
      store,
      batchId      : batch.batchId || null,
      ordersUpdated: updated,
      message      : 'Batch closed — ' + updated + ' orders moved to Preparing'
    };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// ══════════════════════════════════════════════════════════════
//  GET ALL PREVIOUS BATCHES FOR A STORE
//  Returns unique BatchIDs with order count, date range, status
// ══════════════════════════════════════════════════════════════
function getPreviousBatches(p) {
  try {
    const store = p.store;
    if (!store) return { success: false, message: 'store required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(_validSheet(store) || SHEET_ORDERS);
    if (!sheet) return { success: true, batches: [] };
    const last = sheet.getLastRow();
    if (last < 2) return { success: true, batches: [] };

    // Read all rows at once
    const data = sheet.getRange(2, 1, last - 1, 12).getValues();
    const batchMap = {};

    data.forEach(row => {
      const batchId = (row[ORD_BATCH-1]  || '').toString().trim();
      const date    =  row[ORD_DATE-1];
      const status  = (row[ORD_STATUS-1] || '').toString().trim();
      if (!batchId) return;

      if (!batchMap[batchId]) {
        batchMap[batchId] = { batchId, firstOrder: date, lastOrder: date, total: 0, new: 0, preparing: 0, delivered: 0 };
      }
      const b = batchMap[batchId];
      b.total++;
      if (status === 'New')       b.new++;
      if (status === 'Preparing') b.preparing++;
      if (status === 'Delivered') b.delivered++;
      if (date && (!b.firstOrder || date < b.firstOrder)) b.firstOrder = date;
      if (date && (!b.lastOrder  || date > b.lastOrder))  b.lastOrder  = date;
    });

    // Get current active batch
    const activeBatch = getActiveBatch({ store });
    const activeBatchId = activeBatch.batchId || '';

    const batches = Object.values(batchMap).map(b => ({
      batchId    : b.batchId,
      isActive   : b.batchId === activeBatchId,
      total      : b.total,
      new        : b.new,
      preparing  : b.preparing,
      delivered  : b.delivered,
      firstOrder : _valToStr(b.firstOrder),
      lastOrder  : _valToStr(b.lastOrder),
    }));

    // Sort newest first
    batches.sort((a, b) => (b.firstOrder || '') > (a.firstOrder || '') ? 1 : -1);
    return { success: true, batches };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// ══════════════════════════════════════════════════════════════
//  EXTEND BATCH
//  Admin extends the closing time of the current batch.
//  - Updates the store window end time
//  - Reactivates the batch (same BatchID, no new batch)
//  - Reverts ALL "Preparing" orders in this batch back to "New"
//    because the batch is still open
// ══════════════════════════════════════════════════════════════
function extendBatch(p) {
  try {
    const { store, newEnd } = p;
    if (!store)  return { success: false, message: 'store required' };
    if (!newEnd) return { success: false, message: 'newEnd required (YYYY-MM-DD HH:MM:SS)' };

    // 1. Determine which batch to extend
    //    If admin specified a batchId → use that (reopen previous batch)
    //    Otherwise → use the current active batch
    const specificBatchId = p.batchId || null;
    let   targetBatchId   = specificBatchId;
    if (!targetBatchId) {
      const current = getActiveBatch({ store });
      if (!current.batchId) return { success: false, message: 'No batch found — start a new batch first' };
      targetBatchId = current.batchId;
    }

    // 2. Update end time + set target batch as active
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) sheet = _setupSettingsSheet(ss);
    _upsertSetting(sheet, store + '_end',          newEnd);
    _upsertSetting(sheet, store + '_batch_id',     targetBatchId);  // activate selected batch
    _upsertSetting(sheet, store + '_batch_status', 'active');

    // Override batch reference for revert step
    const batch = { batchId: targetBatchId };

    // 3. Revert ALL orders → "New" for this BatchID
    //    (regardless of current status — Preparing, Delivered, Cancelled, etc.)
    const sheetName   = _validSheet(store) || SHEET_ORDERS;
    const ordersSheet = ss.getSheetByName(sheetName);
    let   revertedCount = 0;

    if (ordersSheet) {
      const last = ordersSheet.getLastRow();
      if (last >= 2) {
        const data = ordersSheet.getRange(2, 1, last - 1, 12).getValues();
        const ts   = _timestamp('Asia/Dubai');
        const bid  = batch.batchId.toString().trim();
        data.forEach((row, idx) => {
          const rowBatch  = (row[ORD_BATCH-1]  || '').toString().trim();
          const rowStatus = (row[ORD_STATUS-1] || '').toString().trim();
          // Revert ALL orders in this batch back to New (no status filter)
          if (rowBatch !== bid)    return;
          if (rowStatus === 'New') return; // already New, skip
          const rowNum = idx + 2;
          ordersSheet.getRange(rowNum, ORD_STATUS).setValue('New');
          ordersSheet.getRange(rowNum, ORD_UPDATED).setValue(ts);
          revertedCount++;
        });
      }
    }

    return {
      success        : true,
      batchId        : batch.batchId,
      store,
      newEnd,
      revertedOrders : revertedCount,
      message        : `Batch extended to ${newEnd}. ${revertedCount} orders reverted to New.`
    };
  } catch(err) { return { success: false, message: 'extendBatch error: ' + err.toString() }; }
}

// Re-activate current batch without creating a new one (window extension)
function reactivateBatch(p) {
  try {
    const store   = p.store;
    const batchId = p.batchId; // optional: specific batch to activate
    if (!store) return { success: false, message: 'store required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    let   sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) sheet = _setupSettingsSheet(ss);
    const targetId = batchId || getActiveBatch({ store }).batchId;
    if (!targetId) return { success: false, message: 'No batch found — use startNewBatch' };
    _upsertSetting(sheet, store + '_batch_id',     targetId);
    _upsertSetting(sheet, store + '_batch_status', 'active');
    return { success: true, batchId: targetId, store, message: 'Batch reactivated' };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Get all orders for a specific batch
function getBatchOrders(p) {
  try {
    if (!p.batchId) return { success: false, message: 'batchId required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(_validSheet(p.sheet) || SHEET_ORDERS);
    if (!sheet) return { success: true, orders: [] };
    const last = sheet.getLastRow(), orders = [];
    for (let i = 2; i <= last; i++) {
      const bid = (sheet.getRange(i, ORD_BATCH).getValue() || '').toString().trim();
      if (bid === p.batchId.toString().trim()) {
        orders.push({
          id     : sheet.getRange(i, ORD_ID).getValue()      || '',
          custId : sheet.getRange(i, ORD_CUSTOMER).getValue() || '',
          items  : sheet.getRange(i, ORD_ITEMS).getValue()   || '',
          name   : sheet.getRange(i, ORD_NAME).getValue()    || '',
          phone  : sheet.getRange(i, ORD_PHONE).getValue()   || '',
          date   : sheet.getRange(i, ORD_DATE).getValue()    || '',
          status : sheet.getRange(i, ORD_STATUS).getValue()  || 'New',
          updated: sheet.getRange(i, ORD_UPDATED).getValue() || '',
          batchId: bid,
        });
      }
    }
    return { success: true, orders, count: orders.length };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// ============================================================
//  ADMIN FUNCTIONS
// ============================================================

function getAdminStats() {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const stats = { total:0, new:0, preparing:0, delivered:0, cancelled:0, perStore:{} };
    [SHEET_ORDERS, SHEET_FAYOUMI].forEach(name => {
      const sheet = ss.getSheetByName(name);
      stats.perStore[name] = 0;
      if (!sheet) return;
      const last = sheet.getLastRow();
      if (last < 2) return;
      // Read entire status column at once — much faster than cell-by-cell
      const values = sheet.getRange(2, ORD_STATUS, last - 1, 1).getValues();
      stats.perStore[name] = values.length;
      values.forEach(row => {
        const status = (row[0] || 'New').toString().trim();
        stats.total++;
        if      (status === 'New')       stats.new++;
        else if (status === 'Preparing') stats.preparing++;
        else if (status === 'Delivered') stats.delivered++;
        else if (status === 'Cancelled') stats.cancelled++;
      });
    });
    return { success: true, stats };
  } catch(err) { return { success: false, message: err.toString() }; }
}

function getStoreOrders(p) {
  try {
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(_validSheet(p.sheet) || SHEET_ORDERS);
    if (!sheet) return { success: true, orders: [] };
    const last = sheet.getLastRow();
    if (last < 2) return { success: true, orders: [] };
    // Read all columns at once — single API call instead of N*9
    const rows   = sheet.getRange(2, 1, last - 1, 12).getValues();
    const orders = rows.map(r => ({
      id     : r[ORD_ID-1]       || '',
      custId : r[ORD_CUSTOMER-1] || '',
      items  : r[ORD_ITEMS-1]    || '',
      name   : r[ORD_NAME-1]     || '',
      phone  : r[ORD_PHONE-1]    || '',
      date   : r[ORD_DATE-1]     || '',
      status : r[ORD_STATUS-1]   || 'New',
      updated: r[ORD_UPDATED-1]  || '',
      batchId: r[ORD_BATCH-1]    || '',
    })).filter(o => o.id); // skip empty rows
    return { success: true, orders };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Per-store window stored as: AlRoknAlMasry_start, AlRoknAlMasry_end etc.
function getStoreOrderWindow(p) {
  try {
    const store = p.store;
    if (!store) return { success: false, message: 'store required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) return { success: true, start: null, end: null, isActive: false, phase: 'no_settings' };

    const rows = sheet.getDataRange().getValues();
    const cfg  = {};
    // Convert all values to plain strings to avoid Date object issues
    rows.forEach(r => { if (r[0]) cfg[r[0].toString().trim()] = _valToStr(r[1]); });

    const start       = cfg[store + '_start']        || null;
    const end         = cfg[store + '_end']          || null;
    const batchStatus = cfg[store + '_batch_status'] || 'closed';

    // Determine phase based on current time vs window
    let isActive = false, phase = 'no_settings';
    if (start && end) {
      const now = new Date();
      const s   = new Date(start);
      const e   = new Date(end);
      if      (now < s)  { phase = 'before_open'; isActive = false; }
      else if (now <= e) { phase = 'open';         isActive = batchStatus === 'active'; }
      else               { phase = 'closed';       isActive = false; }
    }

    return { success: true, store, start, end, isActive, phase, batchStatus };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// Convert Sheets cell value (may be Date object) to plain string
function _valToStr(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');
  }
  return String(val).trim() || null;
}

function setStoreOrderWindow(p) {
  try {
    const { store, start, end } = p;
    if (!store || !start || !end) return { success: false, message: 'store, start and end required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (!sheet) sheet = _setupSettingsSheet(ss);
    _upsertSetting(sheet, store + '_start', start);
    _upsertSetting(sheet, store + '_end',   end);
    return { success: true, store, start, end };
  } catch(err) { return { success: false, message: err.toString() }; }
}

function bulkUpdateStatus(p) {
  try {
    const { sheet: sheetName, fromStatus, toStatus } = p;
    if (!fromStatus || !toStatus) return { success: false, message: 'fromStatus and toStatus required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(_validSheet(sheetName) || SHEET_ORDERS);
    if (!sheet) return { success: false, message: 'Sheet not found' };
    const ts = _timestamp('Asia/Dubai');
    let updated = 0;
    const last = sheet.getLastRow();
    for (let i = 2; i <= last; i++) {
      if ((sheet.getRange(i, ORD_STATUS).getValue() || '') === fromStatus) {
        sheet.getRange(i, ORD_STATUS).setValue(toStatus);
        sheet.getRange(i, ORD_UPDATED).setValue(ts);
        updated++;
      }
    }
    return { success: true, updated, fromStatus, toStatus };
  } catch(err) { return { success: false, message: err.toString() }; }
}

function adminUpdateOrderStatus(p) {
  try {
    const { orderId, status, sheet: sheetName } = p;
    if (!orderId || !status) return { success: false, message: 'orderId and status required' };
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(_validSheet(sheetName) || SHEET_ORDERS);
    if (!sheet) return { success: false, message: 'Sheet not found' };
    const ts = _timestamp('Asia/Dubai');
    const last = sheet.getLastRow();
    for (let i = 2; i <= last; i++) {
      if ((sheet.getRange(i, ORD_ID).getValue() || '').toString().trim() === orderId.toString().trim()) {
        sheet.getRange(i, ORD_STATUS).setValue(status);
        sheet.getRange(i, ORD_UPDATED).setValue(ts);
        return { success: true, orderId, status, timestamp: ts };
      }
    }
    return { success: false, message: 'Order not found' };
  } catch(err) { return { success: false, message: err.toString() }; }
}

// ============================================================
//  SETUP
// ============================================================
function setupSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    _setupDataBase(ss);
    _setupOrderSheet(ss, SHEET_ORDERS);
    _setupOrderSheet(ss, SHEET_FAYOUMI);
    _setupSettingsSheet(ss);
    return { success: true, message: 'All sheets ready' };
  } catch(err) {
    return { success: false, message: err.toString() };
  }
}

function _setupDataBase(ss) {
  let s = ss.getSheetByName('DataBase');
  if (!s) {
    s = ss.insertSheet('DataBase');
    const h = ['CustomerID','Name','Phone','WhatsApp','Area','Address','Location','CreatedAt','UpdatedAt','Latitude','Longitude'];
    s.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

function _setupOrderSheet(ss, name) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    const h = ['OrderID','CustomerID','Items','CustomerName','Phone','OrderDate','Status','UpdatedAt','Notes','Location','Vendor','BatchID'];
    s.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

function _setupSettingsSheet(ss) {
  let s = ss.getSheetByName(SHEET_SETTINGS);
  if (!s) {
    s = ss.insertSheet(SHEET_SETTINGS);
    s.getRange(1,1,1,3).setValues([['Key','Value','Description']]).setFontWeight('bold');
    s.appendRow(['window_start', '', 'Order window open time (YYYY-MM-DD HH:MM:SS)']);
    s.appendRow(['window_end',   '', 'Order window close time (YYYY-MM-DD HH:MM:SS)']);
    s.appendRow(['window_status','closed','open | closed']);
    s.setFrozenRows(1);
  }
  return s;
}

function onOpen() { setupSheets(); }

// ============================================================
//  PRIVATE HELPERS
// ============================================================
function _timestamp(tz, userTs) {
  if (userTs && userTs.toString().trim()) return userTs.toString().trim();
  return Utilities.formatDate(new Date(), tz || 'Asia/Dubai', 'yyyy-MM-dd HH:mm:ss');
}

function _cleanPhone(raw) {
  if (!raw) return '';
  const s = raw.toString().trim();
  return s.startsWith("'") ? s.substring(1) : s;
}

function _phoneMatch(rowPhone, input) {
  const cp = _cleanPhone(rowPhone);
  return cp === input ||
    (input.startsWith('0') && cp === input.substring(1)) ||
    (!input.startsWith('0') && cp === '0' + input);
}

function _buildLocationUrl(lat, lng, fallback) {
  if (lat && lng && lat.toString().trim() && lng.toString().trim()) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return (fallback || '').toString().trim();
}

function _validSheet(name) {
  if (!name) return null;
  return (name === SHEET_ORDERS || name === SHEET_FAYOUMI) ? name : null;
}

function _upsertSetting(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() === key) {
      const cell = sheet.getRange(i + 1, 2);
      cell.setNumberFormat('@');   // force text — prevent Sheets auto-converting dates
      cell.setValue(String(value));
      return;
    }
  }
  const newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1).setValue(key);
  const valCell = sheet.getRange(newRow, 2);
  valCell.setNumberFormat('@');
  valCell.setValue(String(value));
}


// ════════════════════════════════════════════════════════════════
//  PIPELINE FUNCTIONS  (for 🚀 Processing Button in admin.html)
//  Added to v18.0 — zero changes to existing code above
//
//  Column mapping (v18.0):
//   DataBase: ID(1) Name(2) Phone(3) Area(5) Address(6)
//             Location(7) Lat(10) Lng(11)   ← only 11 cols
//   Orders  : ID(1) CustID(2) Items(3) Name(4) Phone(5)
//             Status(7) Location(10)          ← 12 cols
//   Workspace: A=Index B=- C=OrderID D=CustID E=RouteNo
//              F=Mobile G=Name H=Area I=Address
//              J=MapsLink K=Items L=CombinedData
// ════════════════════════════════════════════════════════════════

// All orders from a vendor sheet (for admin table display)
function getVendorOrders(sheetName) {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID)
                              .getSheetByName(sheetName || SHEET_ORDERS);
    if (!sheet || sheet.getLastRow() < 2) return { success: true, orders: [] };
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
    var orders = rows.filter(function(r) { return r[0]; }).map(function(r) {
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
        hasLocation: !!(r[9])
      };
    });
    return { success: true, orders: orders };
  } catch(err) {
    return { success: false, message: err.toString(), orders: [] };
  }
}

// Full 1-click pipeline: Preparing orders → Workspace → Route → Maps links
function processVendorFull(sheetName, workspaceTab, startLat, startLng) {
  try {
    var ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ordersSheet = ss.getSheetByName(sheetName || SHEET_ORDERS);
    var dbSheet     = ss.getSheetByName('DataBase');
    var wsSheet     = ss.getSheetByName(workspaceTab);

    if (!ordersSheet) return { success: false, message: 'Sheet not found: ' + sheetName };
    if (!dbSheet)     return { success: false, message: 'DataBase sheet not found' };
    if (!wsSheet)     return { success: false, message: 'Workspace not found: ' + workspaceTab };

    // ── 1. Get Preparing orders ───────────────────────────────────
    var oLast = ordersSheet.getLastRow();
    if (oLast < 2) return { success: false, message: 'No orders found' };

    var allOrders = ordersSheet.getRange(2, 1, oLast - 1, 12).getValues();
    var preparing = allOrders.filter(function(r) {
      return r[0] && String(r[6]).trim() === 'Preparing';
    });

    if (preparing.length === 0)
      return { success: false, message: 'No Preparing orders in ' + sheetName };

    // ── 2. Build customer lookup from DataBase (11 cols) ─────────
    //    r[0]=ID  r[2]=Phone  r[4]=Area  r[5]=Address
    //    r[6]=Location  r[9]=Lat  r[10]=Lng
    var dbLast = dbSheet.getLastRow();
    var dbData = dbLast >= 2 ? dbSheet.getRange(2, 1, dbLast - 1, 11).getValues() : [];
    var byId = {}, byPhone = {};

    dbData.forEach(function(r) {
      var id  = String(r[0]).trim();
      var ph  = _cleanPhone(String(r[2] || ''));
      var obj = {
        name    : r[1]  || '',
        phone   : r[2]  || '',
        area    : r[4]  || '',
        address : r[5]  || '',
        location: r[6]  || '',
        lat     : r[9]  || '',
        lng     : r[10] || ''
      };
      if (id) byId[id]    = obj;
      if (ph) byPhone[ph] = obj;
    });

    // ── 3. Build Workspace rows + route entries ──────────────────
    var wsRows = [], routeEntries = [];

    preparing.forEach(function(order, idx) {
      var orderId  = order[0];
      var clientId = String(order[1]).trim();
      var items    = String(order[2] || '').trim();
      var rawPh    = _cleanPhone(String(order[4] || ''));
      var c        = byId[clientId] || byPhone[rawPh] || {};
      var maps     = c.location
                   || (c.lat && c.lng
                       ? 'https://www.google.com/maps?q=' + c.lat + ',' + c.lng
                       : '');

      wsRows.push([
        idx + 1,            // A: row index
        '',                 // B: separator
        orderId,            // C: OrderID
        clientId,           // D: CustomerID
        '',                 // E: Route number (filled after routing)
        c.phone  || order[4] || '',  // F: Mobile
        c.name   || order[3] || '',  // G: Name
        c.area   || '',              // H: Area
        c.address|| '',              // I: Address
        maps,                        // J: Maps link
        items,                       // K: Order items (Sep-Text Order)
        ''                           // L: Combined Data (formula below)
      ]);

      routeEntries.push({
        wsIdx    : idx,
        lat      : c.lat,
        lng      : c.lng,
        maps     : maps,
        hasCoords: !!(c.lat && c.lng)
      });
    });

    // ── 4. Clear Workspace and write rows ────────────────────────
    if (wsSheet.getLastRow() > 1)
      wsSheet.getRange(2, 1, wsSheet.getLastRow() - 1, 12).clearContent();

    if (wsRows.length > 0) {
      wsSheet.getRange(2, 1, wsRows.length, 12).setValues(wsRows);

      // Combined Data formula in col L (WhatsApp-ready format)
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

    // ── 5. Populate Routes sheet with lat/lng ────────────────────
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

    // ── 6. Run route optimization (defined in Routing.gs) ─────────
    if (validEntries.length > 0) nearestNeighborOrder();

    // ── 7. Write route numbers back to Workspace col E ────────────
    if (validEntries.length > 0) {
      var routeNums = routesSheet.getRange(2, 7, validEntries.length, 1).getValues();
      validEntries.forEach(function(entry, ri) {
        var rNum = routeNums[ri] ? routeNums[ri][0] : '';
        if (rNum) wsSheet.getRange(entry.wsIdx + 2, 5).setValue(rNum);
      });
    }

    // ── 8. Auto-sort Workspace by route number (col E = 5) ────────
    var wsLast = wsSheet.getLastRow();
    if (wsLast > 2) wsSheet.getRange(2, 1, wsLast - 1, 12).sort({ column: 5, ascending: true });

    // ── 9. Generate Google Maps route links (RouteLinks.gs) ───────
    if (validEntries.length > 0) GenerateRoutesFromColumnA();

    // ── 10. Update only UpdatedAt — status stays "Preparing" ──────
    var now     = _timestamp('Asia/Dubai');
    var prepIds = {};
    preparing.forEach(function(o) { prepIds[String(o[0])] = true; });
    var updArray = allOrders.map(function(r) {
      return [prepIds[String(r[0])] ? now : r[7]];
    });
    ordersSheet.getRange(2, 8, updArray.length, 1).setValues(updArray);

    // ── 11. Return summary ─────────────────────────────────────────
    return {
      success      : true,
      message      : 'تم معالجة ' + preparing.length + ' أوردر',
      ordersCount  : preparing.length,
      routedCount  : validEntries.length,
      noCoords     : preparing.length - validEntries.length,
      links        : _getPipelineRouteLinks(),
      whatsappText : _getWorkspaceExportText(wsSheet)
    };

  } catch(err) {
    return { success: false, message: 'processVendorFull error: ' + err.toString() };
  }
}

// Returns all Combined Data (col L) joined for WhatsApp
function _getWorkspaceExportText(wsSheet) {
  try {
    var last = wsSheet.getLastRow();
    if (last < 2) return '';
    return wsSheet.getRange(2, 12, last - 1, 1).getValues()
      .map(function(r) { return String(r[0] || '').trim(); })
      .filter(function(t) { return t; })
      .join('\n\n');
  } catch(e) { return ''; }
}

// Action: export Workspace text (called by admin.html copyWhatsapp button)
function getWorkspaceExport(workspaceTab) {
  try {
    var ws = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(workspaceTab);
    if (!ws) return { success: false, message: workspaceTab + ' not found' };
    return { success: true, text: _getWorkspaceExportText(ws) };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

// Read generated route links from RouteLinks sheet
function _getPipelineRouteLinks() {
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('RouteLinks');
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues()
      .filter(function(r) { return r[2]; })
      .map(function(r) {
        return {
          route : r[0],
          stops : r[1],
          url   : String(r[2]).replace(/=HYPERLINK\("([^"]+)".*/, '$1'),
          notes : r[3]
        };
      });
  } catch(e) { return []; }
}
