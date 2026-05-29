// ============================================
// HomiCart API - Multi-Vendor Version (FULLY UPDATED)
// Routes: malhama (الركن المصري) -> "Orders" sheet
//         fayoumi (الفيومي) -> "AlFayoumi" sheet
// Version: v15.0 - Complete rewrite with proper routing
// ============================================

const SPREADSHEET_ID = '1txQXRi-19VIDNHQej5vnqYku5-clPOj3QR_JqXKYQI0';

// Sheet name constants - MUST match HTML
const SHEET_ORDERS = 'Orders';      // For malhama (الركن المصري)
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
        message: 'HomiCart API - Complete Multi-Vendor Platform',
        version: 'v15.0',
        availableActions: [
          // Customer & Orders
          'getOrderStatus', 'getCustomer', 'getOrders', 'getCustomerById',
          'getOrderByCustomer', 'getLatestOrderByPhone', 'getCustomerAndLatestOrder',
          'createOrUpdateCustomer', 'submitOrder', 'updateOrder',
          'updateCustomerLocation', 'getCustomerLocation', 'getOrderById',
          // Phase 1: Vendors, Menu, Schedule
          'getVendors', 'getMenuByVendor', 'getSchedule',
          // Phase 2: Invoices & Notifications
          'sendEmailNotification', 'generateInvoiceHTML', 'generateWhatsAppLink',
          // Utility
          'test', 'ping'
        ]
      };
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
        userTimezone: e.parameter.userTimezone || 'Asia/Riyadh'
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
        userTimezone: e.parameter.userTimezone || 'Asia/Riyadh',
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
        sheet: e.parameter.sheet || SHEET_ORDERS,
        userTimezone: e.parameter.userTimezone || 'Asia/Riyadh'  // Fix: pass timezone
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
    // New endpoints
    else if (action === 'getVendors') {
      result = getVendors();
    }
    else if (action === 'getMenuByVendor') {
      result = getMenuByVendor(e.parameter.vendorId);
    }
    else if (action === 'getSchedule') {
      result = getSchedule();
    }
    else if (action === 'getOrderById') {
      result = getOrderById(e.parameter.orderId);
    }
    // Phase 3: Admin endpoints
    else if (action === 'getAllOrders') {
      result = getAllOrders();
    }
    else if (action === 'getOrdersByStatus') {
      result = getOrdersByStatus(e.parameter.status);
    }
    else if (action === 'getAnalytics') {
      result = getAnalytics(e.parameter.period || 'month');
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
    const userTimezone = data.userTimezone || 'Asia/Riyadh';
    const userTimestamp = data.userTimestamp || '';
    const sheetName = data.sheet || SHEET_ORDERS;
    const vendor = data.vendor || '';

    let result;

    if (action === 'createOrUpdateCustomer') {
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
    else if (action === 'sendEmailNotification') {
      const email = data.email || '';
      const subject = data.subject || 'تأكيد الطلب';
      const orderDetails = typeof data.orderDetails === 'string' ? JSON.parse(data.orderDetails) : data.orderDetails;
      result = sendEmailNotification(email, subject, orderDetails);
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

// ========== Core Functions ==========

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
    console.error('Error in getOrderStatus:', error);
    return { success: true, status: 'Active', round: '' };
  }
}

function getCustomer(phone) {
  // Fix: replaced cell-by-cell reads with a single bulk getValues() call — 10-100x faster
  try {
    if (!phone) return { success: false, message: 'Phone number is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'Database sheet not found' };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, customer: null };

    const headers = getHeaders(sheet);
    const latCol = (getColumnIndex(headers, 'Latitude') || 15) - 1;   // 0-based for array
    const lngCol = (getColumnIndex(headers, 'Longitude') || 16) - 1;
    const mapsCol = (getColumnIndex(headers, 'GoogleMapsLink') || 17) - 1;
    const numCols = Math.max(mapsCol + 1, 17);

    const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rawPhone = row[2] ? row[2].toString().trim() : '';
      const cleanPhone = rawPhone.startsWith("'") ? rawPhone.substring(1) : rawPhone;
      if (cleanPhone === phone || rawPhone === "'" + phone ||
          (phone.startsWith('0') && cleanPhone === phone.substring(1)) ||
          (!phone.startsWith('0') && cleanPhone === '0' + phone)) {
        return {
          success: true,
          customer: {
            id: row[0] || '',
            name: row[1] || '',
            phone: cleanPhone,
            whatsapp: row[3] || '',
            area: row[4] || '',
            address: row[5] || '',
            location: row[6] || '',
            notes: row[10] || '',
            latitude: row[latCol] || '',
            longitude: row[lngCol] || '',
            mapsLink: row[mapsCol] || '',
            isActive: true,
            accountStatus: 'Active',
            rowNumber: i + 2  // 1-based sheet row
          }
        };
      }
    }
    return { success: true, customer: null, message: 'Customer not found' };
  } catch (error) {
    console.error('Error in getCustomer:', error);
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function createOrUpdateCustomer(data) {
  try {
    if (!data.phone || data.phone.trim() === '') return { success: false, message: 'Phone number is required' };
    if (!data.name || data.name.trim() === '') return { success: false, message: 'Name is required' };
    if (!data.area || data.area.trim() === '') return { success: false, message: 'Area is required' };
    if (!data.address || data.address.trim() === '') return { success: false, message: 'Address is required' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('DataBase');

    if (!sheet) {
      sheet = ss.insertSheet('DataBase');
      const headers = ['ID', 'Name', 'Phone', 'WhatsApp', 'Area', 'Address', 'Location',
                       'CreatedAt', 'UpdatedAt', 'IsActive', 'Notes', 'Round', 'Round Status',
                       'LocationVerified', 'Latitude', 'Longitude', 'GoogleMapsLink'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(2, 12).setValue('الرحلة 1');
      sheet.getRange(2, 13).setValue('Active');
      sheet.getRange(2, 14).setValue('Pending');
    }

    let timestamp;
    if (data.userTimestamp && data.userTimestamp.trim() !== '') {
      timestamp = data.userTimestamp;
    } else {
      const now = new Date();
      timestamp = Utilities.formatDate(now, data.userTimezone || 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss');
    }

    const headers = getHeaders(sheet);
    const latCol = getColumnIndex(headers, 'Latitude') || 15;
    const lngCol = getColumnIndex(headers, 'Longitude') || 16;
    const mapsCol = getColumnIndex(headers, 'GoogleMapsLink') || 17;
    const verifiedCol = getColumnIndex(headers, 'LocationVerified') || 14;

    let customerId = '';
    let customerRow = -1;
    const lastRow = sheet.getLastRow();
    const inputPhone = data.phone.trim();

    for (let i = 2; i <= lastRow; i++) {
      const rowPhone = sheet.getRange(i, 3).getValue();
      const phoneString = rowPhone ? rowPhone.toString().trim() : '';
      const cleanPhone = phoneString.startsWith("'") ? phoneString.substring(1) : phoneString;
      if (cleanPhone === inputPhone ||
          phoneString === "'" + inputPhone ||
          (inputPhone.startsWith('0') && cleanPhone === inputPhone.substring(1)) ||
          (!inputPhone.startsWith('0') && cleanPhone === '0' + inputPhone)) {
        customerRow = i;
        customerId = sheet.getRange(i, 1).getValue();
        break;
      }
    }

    const phoneToStore = data.phone.trim();
    const whatsappToStore = (data.whatsapp || data.phone).trim();

    if (customerRow > 0) {
      sheet.getRange(customerRow, 2).setValue(data.name.trim());
      sheet.getRange(customerRow, 3).setValue(phoneToStore);
      sheet.getRange(customerRow, 4).setValue(whatsappToStore);
      sheet.getRange(customerRow, 5).setValue(data.area.trim());
      sheet.getRange(customerRow, 6).setValue(data.address.trim());
      if (data.latitude && data.longitude && data.latitude.trim() !== '' && data.longitude.trim() !== '') {
        sheet.getRange(customerRow, latCol).setValue(parseFloat(data.latitude));
        sheet.getRange(customerRow, lngCol).setValue(parseFloat(data.longitude));
        const mapsLink = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
        sheet.getRange(customerRow, mapsCol).setValue(mapsLink);
        if (data.location && data.location.trim() !== '') {
          sheet.getRange(customerRow, 7).setValue(data.location.trim());
        }
        sheet.getRange(customerRow, verifiedCol).setValue('Verified');
      }
      sheet.getRange(customerRow, 9).setValue(timestamp);
      if (data.round && data.round.trim() !== '') sheet.getRange(customerRow, 12).setValue(data.round.trim());
    } else {
      customerId = 'C' + Date.now();
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1).setValue(customerId);
      sheet.getRange(newRow, 2).setValue(data.name.trim());
      sheet.getRange(newRow, 3).setValue(phoneToStore);
      sheet.getRange(newRow, 4).setValue(whatsappToStore);
      sheet.getRange(newRow, 5).setValue(data.area.trim());
      sheet.getRange(newRow, 6).setValue(data.address.trim());
      sheet.getRange(newRow, 7).setValue(data.location || '');
      sheet.getRange(newRow, 8).setValue(timestamp);
      sheet.getRange(newRow, 9).setValue(timestamp);
      sheet.getRange(newRow, 10).setValue(true);
      sheet.getRange(newRow, 11).setValue(data.notes || '');
      if (data.latitude && data.longitude && data.latitude.trim() !== '' && data.longitude.trim() !== '') {
        sheet.getRange(newRow, latCol).setValue(parseFloat(data.latitude));
        sheet.getRange(newRow, lngCol).setValue(parseFloat(data.longitude));
        const mapsLink = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
        sheet.getRange(newRow, mapsCol).setValue(mapsLink);
        sheet.getRange(newRow, verifiedCol).setValue('Verified');
      } else {
        sheet.getRange(newRow, verifiedCol).setValue('Pending');
      }
      if (data.round && data.round.trim() !== '') sheet.getRange(newRow, 12).setValue(data.round.trim());
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
    console.error('Error in createOrUpdateCustomer:', error);
    return { success: false, message: 'Error while saving customer: ' + error.toString() };
  }
}

// ========== CRITICAL: submitOrder - Routes to correct sheet based on orderData.sheet ==========
function submitOrder(orderData) {
  try {
    if (!orderData.phone || orderData.phone.trim() === '') return { success: false, message: 'Phone number is required' };
    if (!orderData.orderText || orderData.orderText.trim() === '') return { success: false, message: 'Order text is required' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    const statusResult = getOrderStatus();
    if (statusResult.status && statusResult.status.toLowerCase() === 'inactive') {
      return { success: false, message: 'Orders are currently closed.' };
    }

    // Determine target sheet from orderData.sheet (sent by HTML)
    let targetSheetName = orderData.sheet || SHEET_ORDERS;
    // Validate sheet name - if invalid, default to Orders
    if (targetSheetName !== SHEET_ORDERS && targetSheetName !== SHEET_FAYOUMI) {
      console.warn('Invalid sheet name, defaulting to Orders:', targetSheetName);
      targetSheetName = SHEET_ORDERS;
    }
    console.log('📋 Routing order to sheet:', targetSheetName);
    console.log('📋 Vendor:', orderData.vendor);

    // Find or create customer
    let customerId = '';
    let customerLocation = '';
    const dbSheet = ss.getSheetByName('DataBase');

    if (dbSheet && dbSheet.getLastRow() >= 2) {
      const lastRow = dbSheet.getLastRow();
      const inputPhone = orderData.phone.trim();
      const headers = getHeaders(dbSheet);
      const latCol = getColumnIndex(headers, 'Latitude') || 15;
      const lngCol = getColumnIndex(headers, 'Longitude') || 16;

      for (let i = 2; i <= lastRow; i++) {
        const rowPhone = dbSheet.getRange(i, 3).getValue();
        const phoneString = rowPhone ? rowPhone.toString().trim() : '';
        const cleanPhone = phoneString.startsWith("'") ? phoneString.substring(1) : phoneString;
        if (cleanPhone === inputPhone ||
            phoneString === "'" + inputPhone ||
            (inputPhone.startsWith('0') && cleanPhone === inputPhone.substring(1))) {
          customerId = dbSheet.getRange(i, 1).getValue();
          const storedLocation = dbSheet.getRange(i, 7).getValue();
          if (storedLocation) { customerLocation = storedLocation; }
          if (orderData.name && orderData.name.trim() !== '') dbSheet.getRange(i, 2).setValue(orderData.name.trim());
          if (orderData.whatsapp && orderData.whatsapp.trim() !== '') dbSheet.getRange(i, 4).setValue(orderData.whatsapp.trim());
          if (orderData.area && orderData.area.trim() !== '') dbSheet.getRange(i, 5).setValue(orderData.area.trim());
          if (orderData.address && orderData.address.trim() !== '') dbSheet.getRange(i, 6).setValue(orderData.address.trim());
          if (orderData.location && orderData.location.trim() !== '') {
            const currentLocation = dbSheet.getRange(i, 7).getValue();
            if (orderData.location !== currentLocation) {
              dbSheet.getRange(i, 7).setValue(orderData.location.trim());
              customerLocation = orderData.location;
            }
          }
          if (orderData.notes && orderData.notes.trim() !== '') dbSheet.getRange(i, 11).setValue(orderData.notes.trim());
          if (orderData.latitude && orderData.longitude &&
              orderData.latitude.trim() !== '' && orderData.longitude.trim() !== '') {
            dbSheet.getRange(i, latCol).setValue(parseFloat(orderData.latitude));
            dbSheet.getRange(i, lngCol).setValue(parseFloat(orderData.longitude));
          }
          const now = new Date();
          const ts = Utilities.formatDate(now, orderData.userTimezone || 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss');
          dbSheet.getRange(i, 9).setValue(ts);
          break;
        }
      }
    }

    if (!customerId) {
      const customerResult = createOrUpdateCustomer({
        phone: orderData.phone,
        name: orderData.name || 'Customer',
        whatsapp: orderData.whatsapp || orderData.phone,
        area: orderData.area || '',
        address: orderData.address || '',
        location: orderData.location || '',
        notes: orderData.notes || '',
        round: orderData.round || '',
        latitude: orderData.latitude || '',
        longitude: orderData.longitude || '',
        userTimezone: orderData.userTimezone || 'Asia/Riyadh',
        userTimestamp: orderData.userTimestamp || ''
      });
      if (!customerResult.success) return customerResult;
      customerId = customerResult.customerId;
      customerLocation = orderData.location || '';
    }

    // Get or create the target orders sheet (Orders or AlFayoumi)
    let ordersSheet = ss.getSheetByName(targetSheetName);
    if (!ordersSheet) {
      ordersSheet = ss.insertSheet(targetSheetName);
      const headers = ['OrderID', 'CustomerID', 'Items', 'CustomerName', 'Phone',
                       'OrderDate', 'Status', 'LastUpdated', 'Notes', 'Location',
                       'Latitude', 'Longitude', 'GoogleMapsLink', 'Round', 'Vendor'];
      ordersSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      console.log('✅ Created new sheet:', targetSheetName);
    }

    // Timestamp
    let timestamp;
    if (orderData.userTimestamp && orderData.userTimestamp.trim() !== '') {
      timestamp = orderData.userTimestamp;
    } else {
      const now = new Date();
      timestamp = Utilities.formatDate(now, orderData.userTimezone || 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss');
    }

    // Find existing order to replace (search ONLY within the target sheet)
    let existingOrderId = orderData.replaceOrderId || '';

    if (!existingOrderId || existingOrderId.trim() === '') {
      const lastRow = ordersSheet.getLastRow();
      let latestDate = null;
      let latestOrderId = null;
      for (let i = 2; i <= lastRow; i++) {
        const orderCustomerId = ordersSheet.getRange(i, 2).getValue();
        if (orderCustomerId && orderCustomerId.toString().trim() === customerId.toString().trim()) {
          const orderDate = ordersSheet.getRange(i, 6).getValue();
          if (!latestDate || (orderDate && orderDate > latestDate)) {
            latestDate = orderDate;
            latestOrderId = ordersSheet.getRange(i, 1).getValue();
          }
        }
      }
      if (latestOrderId) {
        existingOrderId = latestOrderId;
        console.log('Auto-detected latest order in', targetSheetName, ':', existingOrderId);
      }
    }

    // Update existing order if found
    if (existingOrderId && existingOrderId.trim() !== '') {
      let orderRow = -1;
      const lastRow = ordersSheet.getLastRow();
      for (let i = 2; i <= lastRow; i++) {
        if (ordersSheet.getRange(i, 1).getValue() === existingOrderId) {
          orderRow = i;
          break;
        }
      }

      if (orderRow > 0) {
        ordersSheet.getRange(orderRow, 3).setValue(orderData.orderText.trim());
        ordersSheet.getRange(orderRow, 4).setValue(orderData.name || 'Customer');
        ordersSheet.getRange(orderRow, 5).setValue(orderData.phone);
        ordersSheet.getRange(orderRow, 7).setValue('تم التحديث');
        ordersSheet.getRange(orderRow, 8).setValue(timestamp);
        ordersSheet.getRange(orderRow, 9).setValue(orderData.notes || '');
        if (customerLocation) ordersSheet.getRange(orderRow, 10).setValue(customerLocation);
        if (orderData.latitude && orderData.longitude &&
            orderData.latitude.trim() !== '' && orderData.longitude.trim() !== '') {
          ordersSheet.getRange(orderRow, 11).setValue(parseFloat(orderData.latitude));
          ordersSheet.getRange(orderRow, 12).setValue(parseFloat(orderData.longitude));
          ordersSheet.getRange(orderRow, 13).setValue(`https://www.google.com/maps?q=${orderData.latitude},${orderData.longitude}`);
        }
        if (orderData.round) ordersSheet.getRange(orderRow, 14).setValue(orderData.round);
        if (orderData.vendor) ordersSheet.getRange(orderRow, 15).setValue(orderData.vendor);

        console.log('✅ Updated order', existingOrderId, 'in sheet', targetSheetName);
        return {
          success: true,
          message: 'Order updated successfully',
          orderId: existingOrderId,
          customerId: customerId,
          timestamp: timestamp,
          location: customerLocation,
          sheet: targetSheetName,
          isUpdated: true
        };
      }
    }

    // Create new order row in target sheet
    const orderId = 'O' + Date.now();
    const newOrderRow = ordersSheet.getLastRow() + 1;

    ordersSheet.getRange(newOrderRow, 1).setValue(orderId);
    ordersSheet.getRange(newOrderRow, 2).setValue(customerId);
    ordersSheet.getRange(newOrderRow, 3).setValue(orderData.orderText.trim());
    ordersSheet.getRange(newOrderRow, 4).setValue(orderData.name || 'Customer');
    ordersSheet.getRange(newOrderRow, 5).setValue(orderData.phone);
    ordersSheet.getRange(newOrderRow, 6).setValue(timestamp);
    ordersSheet.getRange(newOrderRow, 7).setValue('جديد');
    ordersSheet.getRange(newOrderRow, 8).setValue(timestamp);
    ordersSheet.getRange(newOrderRow, 9).setValue(orderData.notes || '');

    // Location
    if (customerLocation) {
      ordersSheet.getRange(newOrderRow, 10).setValue(customerLocation);
    } else if (orderData.location && orderData.location.trim() !== '') {
      ordersSheet.getRange(newOrderRow, 10).setValue(orderData.location);
    }

    if (orderData.latitude && orderData.longitude &&
        orderData.latitude.trim() !== '' && orderData.longitude.trim() !== '') {
      ordersSheet.getRange(newOrderRow, 11).setValue(parseFloat(orderData.latitude));
      ordersSheet.getRange(newOrderRow, 12).setValue(parseFloat(orderData.longitude));
      ordersSheet.getRange(newOrderRow, 13).setValue(`https://www.google.com/maps?q=${orderData.latitude},${orderData.longitude}`);
    }

    if (orderData.round) ordersSheet.getRange(newOrderRow, 14).setValue(orderData.round);
    if (orderData.vendor) ordersSheet.getRange(newOrderRow, 15).setValue(orderData.vendor);

    console.log('✅ New order created:', orderId, 'in sheet:', targetSheetName);

    return {
      success: true,
      message: 'Order submitted successfully',
      orderId: orderId,
      customerId: customerId,
      timestamp: timestamp,
      location: customerLocation,
      sheet: targetSheetName,
      isUpdated: false
    };

  } catch (error) {
    console.error('Error in submitOrder:', error);
    return { success: false, message: 'Error submitting order: ' + error.toString() };
  }
}

// ========== getOrderByCustomer - Supports sheet param ==========
function getOrderByCustomer(customerId, sheetName) {
  // Fix: replaced cell-by-cell reads with a single bulk getValues() call
  try {
    if (!customerId || customerId.trim() === '') return { success: false, message: 'Customer ID is required' };

    const targetSheet = sheetName || SHEET_ORDERS;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(targetSheet);

    if (!sheet) return { success: true, order: null, sheet: targetSheet };

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, order: null, sheet: targetSheet };

    const data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
    let latestOrder = null;
    let latestDate = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowCustId = row[1] ? row[1].toString().trim() : '';
      if (rowCustId === customerId) {
        const orderDate = row[5];
        if (!latestOrder || (orderDate && (!latestDate || orderDate > latestDate))) {
          latestOrder = {
            id: row[0],
            customerId: row[1],
            items: row[2],
            date: orderDate,
            status: row[6] || 'جديد',
            notes: row[8] || '',
            address: row[9] || '',
            latitude: row[10] || '',
            longitude: row[11] || '',
            location: row[9] || '',
            vendor: row[14] || '',
            sheet: targetSheet
          };
          latestDate = orderDate;
        }
      }
    }

    return { success: true, order: latestOrder, sheet: targetSheet };
  } catch (error) {
    console.error('Error in getOrderByCustomer:', error);
    return { success: false, message: error.toString() };
  }
}

// ========== updateOrder - Supports sheet param ==========
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
      const orderId = sheet.getRange(i, 1).getValue();
      if (orderId && orderId.toString().trim() === data.orderId) {
        orderRow = i;
        break;
      }
    }
    if (orderRow === -1) return { success: false, message: 'Order not found' };

    const now = new Date();
    // Fix: use dynamic timezone from caller instead of hardcoded 'Asia/Riyadh'
    const tz = data.userTimezone || 'Asia/Riyadh';
    const timestamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(orderRow, 3).setValue(data.orderText.trim());
    sheet.getRange(orderRow, 7).setValue(data.status || 'تم التحديث');
    sheet.getRange(orderRow, 8).setValue(timestamp);

    return { success: true, message: 'Order updated successfully', orderId: data.orderId, timestamp: timestamp, sheet: targetSheetName };
  } catch (error) {
    console.error('Error in updateOrder:', error);
    return { success: false, message: error.toString() };
  }
}

// ========== Helper Functions ==========

function getHeaders(sheet) {
  const headers = [];
  const lastCol = sheet.getLastColumn();
  for (let col = 1; col <= lastCol; col++) {
    const header = sheet.getRange(1, col).getValue();
    headers.push(header ? header.toString().trim() : '');
  }
  return headers;
}

function getColumnIndex(headers, columnName) {
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].toLowerCase() === columnName.toLowerCase()) return i + 1;
  }
  return null;
}

function isCustomerExists(phone) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return false;
    const lastRow = sheet.getLastRow();
    const inputPhone = phone.trim();
    for (let i = 2; i <= lastRow; i++) {
      const rowPhone = sheet.getRange(i, 3).getValue();
      const phoneString = rowPhone ? rowPhone.toString().trim() : '';
      const cleanPhone = phoneString.startsWith("'") ? phoneString.substring(1) : phoneString;
      if (cleanPhone === inputPhone ||
          phoneString === "'" + inputPhone ||
          (inputPhone.startsWith('0') && cleanPhone === inputPhone.substring(1)) ||
          (!inputPhone.startsWith('0') && cleanPhone === '0' + inputPhone)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

function updateCustomerLocation(customerId, latitude, longitude) {
  try {
    if (!customerId || !latitude || !longitude) return { success: false, message: 'Missing required parameters' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'Database sheet not found' };
    const lastRow = sheet.getLastRow();
    const headers = getHeaders(sheet);
    const latCol = getColumnIndex(headers, 'Latitude') || 15;
    const lngCol = getColumnIndex(headers, 'Longitude') || 16;
    const mapsCol = getColumnIndex(headers, 'GoogleMapsLink') || 17;
    const verifiedCol = getColumnIndex(headers, 'LocationVerified') || 14;
    for (let i = 2; i <= lastRow; i++) {
      const rowCustomerId = sheet.getRange(i, 1).getValue();
      if (rowCustomerId && rowCustomerId.toString().trim() === customerId) {
        sheet.getRange(i, latCol).setValue(parseFloat(latitude));
        sheet.getRange(i, lngCol).setValue(parseFloat(longitude));
        const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        sheet.getRange(i, mapsCol).setValue(mapsLink);
        sheet.getRange(i, 7).setValue(mapsLink);
        sheet.getRange(i, verifiedCol).setValue('Verified');
        const now = new Date();
        sheet.getRange(i, 9).setValue(Utilities.formatDate(now, 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss'));
        return { success: true, message: 'Location updated successfully', customerId, latitude, longitude };
      }
    }
    return { success: false, message: 'Customer not found' };
  } catch (error) {
    return { success: false, message: 'Error updating location: ' + error.toString() };
  }
}

function getCustomerLocation(customerId) {
  try {
    if (!customerId) return { success: false, message: 'Customer ID is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DataBase');
    if (!sheet) return { success: false, message: 'Database sheet not found' };
    const lastRow = sheet.getLastRow();
    const headers = getHeaders(sheet);
    const latCol = getColumnIndex(headers, 'Latitude') || 15;
    const lngCol = getColumnIndex(headers, 'Longitude') || 16;
    for (let i = 2; i <= lastRow; i++) {
      const rowCustomerId = sheet.getRange(i, 1).getValue();
      if (rowCustomerId && rowCustomerId.toString().trim() === customerId) {
        const latitude = sheet.getRange(i, latCol).getValue();
        const longitude = sheet.getRange(i, lngCol).getValue();
        const location = sheet.getRange(i, 7).getValue();
        if (latitude && longitude) {
          return { success: true, customerId, latitude, longitude, location: location || '', message: 'Location found' };
        } else {
          return { success: true, customerId, latitude: null, longitude: null, location: location || '', message: 'No location stored' };
        }
      }
    }
    return { success: false, message: 'Customer not found' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function getLatestOrderByPhone(phone) {
  // Fix: now checks BOTH Orders and AlFayoumi sheets (previously only checked Orders)
  // Fix: replaced cell-by-cell reads with bulk getValues()
  try {
    if (!phone) return { success: false, message: 'Phone number is required' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dbSheet = ss.getSheetByName('DataBase');
    if (!dbSheet) return { success: false, message: 'Database sheet not found' };

    // Bulk-read DataBase to find customerId
    const lastRowDB = dbSheet.getLastRow();
    let customerId = null;
    if (lastRowDB > 1) {
      const dbData = dbSheet.getRange(2, 1, lastRowDB - 1, 3).getValues();
      for (let i = 0; i < dbData.length; i++) {
        const rawPhone = dbData[i][2] ? dbData[i][2].toString().trim() : '';
        const cleanPhone = rawPhone.startsWith("'") ? rawPhone.substring(1) : rawPhone;
        if (cleanPhone === phone || rawPhone === "'" + phone ||
            (phone.startsWith('0') && cleanPhone === phone.substring(1)) ||
            (!phone.startsWith('0') && cleanPhone === '0' + phone)) {
          customerId = dbData[i][0];
          break;
        }
      }
    }
    if (!customerId) return { success: true, order: null, message: 'No customer found for this phone number' };

    let latestOrder = null;
    let latestDate = null;

    // Search both vendor sheets
    [SHEET_ORDERS, SHEET_FAYOUMI].forEach(function(sheetName) {
      const ordersSheet = ss.getSheetByName(sheetName);
      if (!ordersSheet || ordersSheet.getLastRow() <= 1) return;
      const rows = ordersSheet.getRange(2, 1, ordersSheet.getLastRow() - 1, 15).getValues();
      rows.forEach(function(row) {
        if (row[1] && row[1].toString().trim() === customerId.toString().trim()) {
          const orderDate = row[5];
          if (!latestOrder || (orderDate && (!latestDate || orderDate > latestDate))) {
            latestOrder = {
              id: row[0], customerId: row[1], items: row[2],
              date: orderDate, status: row[6] || 'جديد',
              latitude: row[10], longitude: row[11], location: row[9],
              sheet: sheetName
            };
            latestDate = orderDate;
          }
        }
      });
    });

    return latestOrder
      ? { success: true, order: latestOrder, message: 'Latest order found' }
      : { success: true, order: null, message: 'No orders found' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function getCustomerAndLatestOrder(phone) {
  try {
    if (!phone) return { success: false, message: 'Phone number is required' };
    const customerResult = getCustomer(phone);
    if (!customerResult.success || !customerResult.customer) {
      return { success: true, customer: null, latestOrder: null, message: 'Customer not found' };
    }
    const customer = customerResult.customer;
    const customerId = customer.id;
    if (!customerId) return { success: true, customer, latestOrder: null, message: 'Customer has no ID' };

    // Fix: check both vendor sheets + use bulk reads (was cell-by-cell, Orders only)
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let latestOrder = null;
    let latestDate = null;

    [SHEET_ORDERS, SHEET_FAYOUMI].forEach(function(sheetName) {
      const ordersSheet = ss.getSheetByName(sheetName);
      if (!ordersSheet || ordersSheet.getLastRow() <= 1) return;
      const rows = ordersSheet.getRange(2, 1, ordersSheet.getLastRow() - 1, 15).getValues();
      rows.forEach(function(row) {
        if (row[1] && row[1].toString().trim() === customerId.toString().trim()) {
          const orderDate = row[5];
          if (!latestOrder || (orderDate && (!latestDate || orderDate > latestDate))) {
            latestOrder = {
              id: row[0], customerId: row[1], items: row[2],
              date: orderDate, status: row[6] || 'جديد',
              latitude: row[10] || '', longitude: row[11] || '', location: row[9] || '',
              sheet: sheetName
            };
            latestDate = orderDate;
          }
        }
      });
    });

    return { success: true, customer, latestOrder, message: latestOrder ? 'Customer and latest order found' : 'Customer found but no orders' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
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
      const rowPhone = sheet.getRange(i, 5).getValue();
      const phoneString = rowPhone ? rowPhone.toString().trim() : '';
      const cleanPhone = phoneString.startsWith("'") ? phoneString.substring(1) : phoneString;
      if (cleanPhone === inputPhone || phoneString === "'" + inputPhone ||
          (inputPhone.startsWith('0') && cleanPhone === inputPhone.substring(1))) {
        orders.push({
          id: sheet.getRange(i, 1).getValue(),
          customerId: sheet.getRange(i, 2).getValue(),
          items: sheet.getRange(i, 3).getValue(),
          date: sheet.getRange(i, 6).getValue(),
          status: sheet.getRange(i, 7).getValue() || 'جديد',
          latitude: sheet.getRange(i, 11).getValue(),
          longitude: sheet.getRange(i, 12).getValue(),
          location: sheet.getRange(i, 10).getValue()
        });
      }
    }
    return { success: true, orders };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
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
    const latCol = getColumnIndex(headers, 'Latitude') || 15;
    const lngCol = getColumnIndex(headers, 'Longitude') || 16;
    for (let i = 2; i <= lastRow; i++) {
      const rowCustomerId = sheet.getRange(i, 1).getValue();
      if (rowCustomerId && rowCustomerId.toString().trim() === customerId) {
        const rowPhone = sheet.getRange(i, 3).getValue();
        const phoneString = rowPhone ? rowPhone.toString().trim() : '';
        const cleanPhone = phoneString.startsWith("'") ? phoneString.substring(1) : phoneString;
        return {
          success: true,
          customer: {
            id: rowCustomerId,
            name: sheet.getRange(i, 2).getValue(),
            phone: cleanPhone,
            whatsapp: sheet.getRange(i, 4).getValue(),
            area: sheet.getRange(i, 5).getValue(),
            address: sheet.getRange(i, 6).getValue(),
            location: sheet.getRange(i, 7).getValue(),
            notes: sheet.getRange(i, 11).getValue(),
            latitude: sheet.getRange(i, latCol).getValue(),
            longitude: sheet.getRange(i, lngCol).getValue()
          }
        };
      }
    }
    return { success: true, customer: null };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ========== Sheet Setup ==========
function setupSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // DataBase sheet
    let dbSheet = ss.getSheetByName('DataBase');
    if (!dbSheet) {
      dbSheet = ss.insertSheet('DataBase');
      const headers = ['ID', 'Name', 'Phone', 'WhatsApp', 'Area', 'Address', 'Location',
                       'CreatedAt', 'UpdatedAt', 'IsActive', 'Notes', 'Round', 'Round Status',
                       'LocationVerified', 'Latitude', 'Longitude', 'GoogleMapsLink'];
      dbSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      dbSheet.getRange(2, 12).setValue('الرحلة 1');
      dbSheet.getRange(2, 13).setValue('Active');
      dbSheet.getRange(2, 14).setValue('Pending');
    } else {
      const headers = getHeaders(dbSheet);
      const toAdd = ['LocationVerified', 'Latitude', 'Longitude', 'GoogleMapsLink'];
      toAdd.forEach(col => {
        if (!getColumnIndex(headers, col)) {
          dbSheet.getRange(1, dbSheet.getLastColumn() + 1).setValue(col);
        }
      });
    }

    // Orders sheet (malhama - الركن المصري)
    // AlFayoumi sheet (الفيومي للطيور)
    const orderSheets = [SHEET_ORDERS, SHEET_FAYOUMI];
    const orderHeaders = ['OrderID', 'CustomerID', 'Items', 'CustomerName', 'Phone',
                          'OrderDate', 'Status', 'LastUpdated', 'Notes', 'Location',
                          'Latitude', 'Longitude', 'GoogleMapsLink', 'Round', 'Vendor'];
    orderSheets.forEach(name => {
      let s = ss.getSheetByName(name);
      if (!s) {
        s = ss.insertSheet(name);
        s.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]);
        console.log('✅ Created sheet:', name);
      } else {
        const h = getHeaders(s);
        const cols = ['Location', 'Latitude', 'Longitude', 'GoogleMapsLink', 'Round', 'Vendor'];
        cols.forEach(col => {
          if (!getColumnIndex(h, col)) {
            s.getRange(1, s.getLastColumn() + 1).setValue(col);
          }
        });
      }
    });

    return { success: true, message: 'Sheets setup completed' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ========== NEW: VENDORS API ==========
function getVendors() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Vendors');
    if (!sheet) {
      sheet = ss.insertSheet('Vendors');
      const headers = ['VendorID', 'Name', 'Phone', 'Area', 'DeliveryFee', 'MinOrder', 'ImageURL', 'IsActive', 'CreatedAt'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Example vendors
      sheet.getRange(2, 1, 2, 9).setValues([
        ['V1', 'ملحمة الركن المصري', '0501234567', 'الشارقة', 15, 50, 'https://via.placeholder.com/200?text=Meat', true, new Date()],
        ['V2', 'الفيومي للطيور', '0509876543', 'الشارقة', 20, 60, 'https://via.placeholder.com/200?text=Chicken', true, new Date()]
      ]);
    }
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
    const vendors = data.map(row => ({
      id: row[0], name: row[1], phone: row[2], area: row[3],
      deliveryFee: row[4], minOrder: row[5], imageUrl: row[6], isActive: row[7]
    })).filter(v => v.isActive);
    return { success: true, vendors: vendors };
  } catch (error) {
    console.error('Error in getVendors:', error);
    return { success: false, message: error.toString() };
  }
}

// ========== NEW: MENU/PRODUCTS API ==========
function getMenuByVendor(vendorId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Menu');
    if (!sheet) {
      sheet = ss.insertSheet('Menu');
      const headers = ['ProductID', 'VendorID', 'Name', 'Category', 'Price', 'ImageURL', 'Description', 'IsActive'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Example menu items
      sheet.getRange(2, 1, 4, 8).setValues([
        ['P1', 'V1', 'لحم غنم', 'اللحوم', 0, 'https://via.placeholder.com/150?text=Lamb', 'لحم غنم طازج', true],
        ['P2', 'V1', 'دجاج كامل', 'الدواجن', 0, 'https://via.placeholder.com/150?text=Whole+Chicken', 'دجاج طازج', true],
        ['P3', 'V2', 'صدور دجاج', 'الدواجن', 45, 'https://via.placeholder.com/150?text=Chicken+Breast', 'صدور دجاج بدون عظم', true],
        ['P4', 'V2', 'أرجل دجاج', 'الدواجن', 35, 'https://via.placeholder.com/150?text=Chicken+Legs', 'أرجل دجاج طازجة', true]
      ]);
    }
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    const products = data.filter(row => row[1] === vendorId && row[7]).map(row => ({
      id: row[0], vendorId: row[1], name: row[2], category: row[3], price: row[4],
      imageUrl: row[5], description: row[6]
    }));
    return { success: true, products: products };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ========== NEW: SCHEDULE API ==========
function getSchedule() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Schedule');
    if (!sheet) {
      sheet = ss.insertSheet('Schedule');
      const headers = ['DayOfWeek', 'OpenTime', 'CloseTime', 'IsActive'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const scheduleData = days.map(day => [day, '10:00', '20:00', true]);
      sheet.getRange(2, 1, 7, 4).setValues(scheduleData);
    }
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    const schedule = {};
    data.forEach(row => {
      if (row[3]) schedule[row[0]] = { openTime: row[1], closeTime: row[2] };
    });
    const today = getDayName(new Date());
    const todaySchedule = schedule[today];
    return { success: true, schedule: schedule, today: today, todaySchedule: todaySchedule };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getDayName(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// ========== NEW: ENHANCED ORDER TRACKING ==========
function getOrderById(orderId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    // Check both Orders and AlFayoumi sheets
    const sheets = [SHEET_ORDERS, SHEET_FAYOUMI];
    for (let s = 0; s < sheets.length; s++) {
      const sheet = ss.getSheetByName(sheets[s]);
      if (!sheet || sheet.getLastRow() <= 1) continue;
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === orderId) {
          return {
            success: true, order: {
              id: data[i][0], customerId: data[i][1], items: data[i][2],
              customerName: data[i][3], phone: data[i][4], date: data[i][5],
              status: data[i][6], notes: data[i][8], location: data[i][9],
              latitude: data[i][10], longitude: data[i][11], vendor: data[i][14],
              sheet: sheets[s]
            }
          };
        }
      }
    }
    return { success: false, message: 'Order not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ========== PHASE 3: ADMIN FUNCTIONS ==========

function getAllOrders() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = [SHEET_ORDERS, SHEET_FAYOUMI];
    let allOrders = [];

    sheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return;

      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
      data.forEach(row => {
        if (row[0]) { // If order ID exists
          allOrders.push({
            id: row[0],
            customerId: row[1],
            items: row[2],
            customerName: row[3],
            phone: row[4],
            date: row[5],
            status: row[6],
            total: row[7],
            notes: row[8],
            location: row[9],
            vendor: row[14],
            sheet: sheetName
          });
        }
      });
    });

    // Sort by date (newest first)
    allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { success: true, orders: allOrders, count: allOrders.length };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getOrdersByStatus(status) {
  try {
    const allOrders = getAllOrders();
    if (!allOrders.success) return allOrders;

    const filtered = allOrders.orders.filter(order => order.status === status);
    return { success: true, orders: filtered, count: filtered.length };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getAnalytics(period) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const allOrders = getAllOrders();
    if (!allOrders.success) return allOrders;

    const now = new Date();
    const orders = allOrders.orders;

    let filteredOrders = orders;
    if (period === 'day') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filteredOrders = orders.filter(order => new Date(order.date) >= today);
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredOrders = orders.filter(order => new Date(order.date) >= monthStart);
    }

    // Calculate statistics
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

    // Count by status
    const byStatus = {
      'New': 0,
      'Processing': 0,
      'Delivery': 0,
      'Delivered': 0,
      'Cancelled': 0
    };

    filteredOrders.forEach(order => {
      if (byStatus.hasOwnProperty(order.status)) {
        byStatus[order.status]++;
      }
    });

    return {
      success: true,
      period: period,
      totalOrders: totalOrders,
      totalRevenue: totalRevenue.toFixed(2),
      avgOrderValue: avgOrderValue,
      byStatus: byStatus,
      orders: filteredOrders
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ========== PHASE 2: PDF & EMAIL FUNCTIONS ==========

function generateInvoiceHTML(order, vendor) {
  // Create beautiful invoice HTML that can be converted to PDF
  const invoiceHTML = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: white; padding: 20px; direction: rtl; text-align: right; }
    .invoice { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; background: white; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2e5cff; padding-bottom: 20px; }
    .header h1 { color: #2e5cff; font-size: 28px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 14px; }
    .order-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .info-block { font-size: 13px; line-height: 1.8; }
    .info-block label { font-weight: bold; color: #333; display: block; margin-top: 10px; }
    .info-block span { color: #666; }
    .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .items-table th { background: #f0f0f0; padding: 10px; text-align: right; font-weight: bold; border-bottom: 2px solid #ddd; }
    .items-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .totals { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 5px; }
    .total-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
    .total-row.grand { font-weight: bold; font-size: 16px; color: #2e5cff; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ddd; }
    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
    .badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-size: 12px; font-weight: bold; }
    .badge.new { background: #e3f2fd; color: #1976d2; }
    .badge.processing { background: #fff3e0; color: #f57c00; }
    .badge.delivery { background: #f3e5f5; color: #7b1fa2; }
    .badge.delivered { background: #e8f5e9; color: #388e3c; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <h1>فاتورة الطلب / Invoice</h1>
      <p>رقم الطلب: ${order.id}</p>
    </div>

    <div class="order-info">
      <div class="info-block">
        <label>اسم العميل:</label>
        <span>${order.customerName}</span>
        <label>رقم الهاتف:</label>
        <span>${order.phone}</span>
        <label>المنطقة:</label>
        <span>${order.area}</span>
      </div>
      <div class="info-block">
        <label>الجهة المموّلة:</label>
        <span>${vendor?.name || 'HomiCart'}</span>
        <label>تاريخ الطلب:</label>
        <span>${order.date}</span>
        <label>حالة الطلب:</label>
        <span class="badge badge-${order.status}">${getStatusLabel(order.status)}</span>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>السعر</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${order.items?.split('\\n').map(item => {
          const parts = item.split(' × ');
          if (parts.length < 2) return '';
          const name = parts[0].trim();
          const qty = parts[1].trim();
          const price = parts[2]?.trim() || '0';
          return \`<tr>
            <td>\${name}</td>
            <td>\${qty}</td>
            <td>\${price} درهم</td>
            <td>\${(parseFloat(qty) * parseFloat(price)).toFixed(2)} درهم</td>
          </tr>\`;
        }).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>الإجمالي الجزئي:</span>
        <span>${order.subtotal || '0'} درهم</span>
      </div>
      <div class="total-row">
        <span>رسوم التوصيل:</span>
        <span>${order.deliveryFee || '0'} درهم</span>
      </div>
      <div class="total-row grand">
        <span>الإجمالي النهائي:</span>
        <span>${order.total || '0'} درهم</span>
      </div>
    </div>

    <div class="footer">
      <p>شكراً لتعاملك معنا! تم إنشاء هذه الفاتورة من نظام HomiCart</p>
      <p>Thank you for your order! Generated by HomiCart System</p>
      <p style="margin-top: 10px; color: #ccc;">${new Date().toLocaleString('ar-SA')}</p>
    </div>
  </div>
</body>
</html>
  `;
  return invoiceHTML;
}

function getStatusLabel(status) {
  const labels = {
    'New': 'طلب جديد',
    'Processing': 'قيد المعالجة',
    'Delivery': 'قيد التوصيل',
    'Delivered': 'تم التوصيل'
  };
  return labels[status] || status;
}

function sendEmailNotification(email, subject, orderDetails) {
  try {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Invalid email address' };
    }

    const body = \`
السلام عليكم ورحمة الله وبركاته

تم استقبال طلبك بنجاح ✅

تفاصيل الطلب:
- رقم الطلب: \${orderDetails.orderId}
- الاسم: \${orderDetails.name}
- الهاتف: \${orderDetails.phone}
- المنطقة: \${orderDetails.area}
- العنوان: \${orderDetails.address}
- الإجمالي: \${orderDetails.total} درهم

يمكنك تتبع طلبك من خلال رقم الطلب أعلاه

شكراً لاختيارك HomiCart
    \`;

    MailApp.sendEmail(email, subject, body);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, message: error.toString() };
  }
}

function generateWhatsAppLink(phone, message) {
  // Generate WhatsApp share link
  const encodedMessage = encodeURIComponent(message);
  const cleanPhone = phone.replace(/\D/g, '');
  return \`https://wa.me/\${cleanPhone}?text=\${encodedMessage}\`;
}

function generateInvoiceData(orderRecord) {
  // Format order data for invoice display
  return {
    orderId: orderRecord.orderId,
    customerName: orderRecord.customerName,
    phone: orderRecord.phone,
    area: orderRecord.area,
    address: orderRecord.address,
    items: orderRecord.items,
    total: orderRecord.total,
    subtotal: orderRecord.subtotal,
    deliveryFee: orderRecord.deliveryFee,
    date: orderRecord.date,
    status: orderRecord.status,
    invoiceUrl: orderRecord.invoiceUrl || ''
  };
}

function onOpen() {
  console.log('HomiCart API - Multi-Vendor Version (v15.0) with Phase 2 features initialized');
  setupSheets();
}