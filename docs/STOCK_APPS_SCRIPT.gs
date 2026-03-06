/**
 * Google Apps Script backend for personal Vietnamese stock buy manager.
 * Sheets required:
 * - transactions: id | symbol | date | price | quantity | status | sellPrice | sellDate
 * - config: key | value (must include ACCESS_CODE)
 */

const TRANSACTION_SHEET = "transactions";
const CONFIG_SHEET = "config";
const PRICES_SHEET = "prices";

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || "").trim().toLowerCase();

    if (!action) {
      return jsonResponse({ ok: false, message: "Missing action" });
    }

    if (action === "login") {
      return handleLogin(payload);
    }

    if (!isValidAccessCode(payload.accessCode)) {
      return jsonResponse({ ok: false, message: "Invalid access code" });
    }

    if (action === "add") return handleAdd(payload);
    if (action === "list") return handleList();
    if (action === "sell") return handleSell(payload);
    if (action === "delete") return handleDelete(payload);
    
    // New actions for server-side auto-refresh
    if (action === "get_prices") return handleGetPrices();
    if (action === "update_prices") return handleUpdatePrices(payload);
    if (action === "get_config") return handleGetConfig();
    if (action === "save_config") return handleSaveConfig(payload);

    return jsonResponse({ ok: false, message: "Unsupported action" });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: "Server error",
      details: error && error.message ? String(error.message) : "Unknown"
    });
  }
}

function handleLogin(payload) {
  if (!isValidAccessCode(payload.accessCode)) {
    return jsonResponse({ ok: false, message: "Sai ma truy cap" });
  }
  return jsonResponse({ ok: true });
}

function handleAdd(payload) {
  const symbol = String(payload.symbol || "").trim().toUpperCase();
  const date = String(payload.date || "").trim();
  const price = Number(payload.price);
  const quantity = Number(payload.quantity);

  if (!/^[A-Z]{1,10}$/.test(symbol)) {
    return jsonResponse({ ok: false, message: "Symbol khong hop le" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ ok: false, message: "Ngay phai theo dinh dang YYYY-MM-DD" });
  }
  if (!isFinite(price) || price <= 0) {
    return jsonResponse({ ok: false, message: "Gia mua khong hop le" });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return jsonResponse({ ok: false, message: "So luong khong hop le" });
  }

  const id = Date.now();
  const sheet = getSheet(TRANSACTION_SHEET);
  sheet.appendRow([id, symbol, date, price, quantity, "HOLD", "", ""]);
  return jsonResponse({ ok: true, data: { id } });
}

function handleList() {
  const sheet = getSheet(TRANSACTION_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: true, data: [] });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var status = String(row[5] || "HOLD").toUpperCase();
    
    // Skip if status is not HOLD or SOLD (e.g. DELETED, ARCHIVED)
    if (status !== "HOLD" && status !== "SOLD") continue;

    var tx = {
      id: Number(row[0]),
      symbol: String(row[1] || "").toUpperCase(),
      date: String(row[2] || ""),
      price: Number(row[3]),
      quantity: Number(row[4]),
      status: status
    };
    if (status === "SOLD") {
      tx.sellPrice = Number(row[6]) || 0;
      tx.sellDate = String(row[7] || "");
    }
    rows.push(tx);
  }

  rows.sort(function (a, b) {
    return b.id - a.id;
  });

  return jsonResponse({ ok: true, data: rows });
}

function handleSell(payload) {
  var id = Number(payload.id);
  var sellPrice = Number(payload.sellPrice);
  if (!isFinite(id)) {
    return jsonResponse({ ok: false, message: "ID khong hop le" });
  }
  if (!isFinite(sellPrice) || sellPrice <= 0) {
    return jsonResponse({ ok: false, message: "Gia ban khong hop le" });
  }

  var sheet = getSheet(TRANSACTION_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: false, message: "Khong tim thay giao dich" });
  }

  var now = new Date();
  var sellDate = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");

  var values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowId = Number(values[i][0]);
    if (rowId === id) {
      var rowIndex = i + 2;
      sheet.getRange(rowIndex, 6).setValue("SOLD");
      sheet.getRange(rowIndex, 7).setValue(sellPrice);
      sheet.getRange(rowIndex, 8).setValue(sellDate);
      return jsonResponse({ ok: true, data: { sellPrice: sellPrice, sellDate: sellDate } });
    }
  }

  return jsonResponse({ ok: false, message: "Khong tim thay giao dich" });
}

function handleDelete(payload) {
  var id = Number(payload.id);
  if (!isFinite(id)) {
    return jsonResponse({ ok: false, message: "ID khong hop le" });
  }

  var sheet = getSheet(TRANSACTION_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: false, message: "Khong tim thay giao dich" });
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowId = Number(values[i][0]);
    if (rowId === id) {
      var rowIndex = i + 2;
      // Soft delete: keep row for audit/history, hide from UI by status filter.
      sheet.getRange(rowIndex, 6).setValue("DELETED");
      sheet.getRange(rowIndex, 7).setValue("");
      sheet.getRange(rowIndex, 8).setValue("");
      return jsonResponse({ ok: true });
    }
  }

  return jsonResponse({ ok: false, message: "Khong tim thay giao dich" });
}

function isValidAccessCode(inputCode) {
  const code = String(inputCode || "").trim();
  if (!code) return false;
  return code === getAccessCode();
}

function getAccessCode() {
  const sheet = getSheet(CONFIG_SHEET);
  const values = sheet.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    const key = String(values[i][0] || "").trim().toUpperCase();
    if (key === "ACCESS_CODE") {
      return String(values[i][1] || "").trim();
    }
  }
  throw new Error("Missing ACCESS_CODE in config sheet");
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    // Auto-create sheets if they don't exist
    if (name === PRICES_SHEET) {
      sheet = ss.insertSheet(PRICES_SHEET);
      sheet.appendRow(["symbol", "price", "openingPrice", "referencePrice", "timestamp"]);
    } else if (name === CONFIG_SHEET) {
      sheet = ss.insertSheet(CONFIG_SHEET);
      sheet.appendRow(["key", "value"]);
    } else {
      throw new Error("Missing sheet: " + name);
    }
  }
  return sheet;
}

function handleGetPrices() {
  const sheet = getSheet(PRICES_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ ok: true, data: {} });
  
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const prices = {};
  for (var i = 0; i < values.length; i++) {
    const symbol = String(values[i][0]);
    prices[symbol] = {
      price: Number(values[i][1]),
      openingPrice: Number(values[i][2]),
      referencePrice: Number(values[i][3]),
      timestamp: String(values[i][4])
    };
  }
  return jsonResponse({ ok: true, data: prices });
}

function handleUpdatePrices(payload) {
  const prices = payload.prices; // Expecting { "VND": { price, openingPrice, referencePrice, timestamp }, ... }
  if (!prices) return jsonResponse({ ok: false, message: "Missing prices data" });

  const sheet = getSheet(PRICES_SHEET);
  const lastRow = sheet.getLastRow();
  const dataRange = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 5) : null;
  const values = dataRange ? dataRange.getValues() : [];
  
  for (const symbol in prices) {
    const p = prices[symbol];
    var found = false;
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === symbol) {
        values[i][1] = p.price;
        values[i][2] = p.openingPrice;
        values[i][3] = p.referencePrice;
        values[i][4] = p.timestamp;
        found = true;
        break;
      }
    }
    if (!found) {
      values.push([symbol, p.price, p.openingPrice, p.referencePrice, p.timestamp]);
    }
  }

  if (values.length > 0) {
    sheet.getRange(2, 1, values.length, 5).setValues(values);
  }
  return jsonResponse({ ok: true });
}

function handleGetConfig() {
  const sheet = getSheet(CONFIG_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return jsonResponse({ ok: true, data: {} });
  
  const values = sheet.getDataRange().getValues();
  const config = {};
  for (var i = 0; i < values.length; i++) {
    const key = String(values[i][0]).trim();
    if (key) config[key] = String(values[i][1]).trim();
  }
  return jsonResponse({ ok: true, data: config });
}

function handleSaveConfig(payload) {
  const key = String(payload.key || "").trim();
  const value = String(payload.value || "").trim();
  if (!key) return jsonResponse({ ok: false, message: "Missing key" });

  const sheet = getSheet(CONFIG_SHEET);
  const lastRow = sheet.getLastRow();
  const dataRange = lastRow > 0 ? sheet.getDataRange() : null;
  const values = dataRange ? dataRange.getValues() : [];
  
  var found = false;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      found = true;
      break;
    }
  }
  if (!found) {
    sheet.appendRow([key, value]);
  }
  return jsonResponse({ ok: true });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
