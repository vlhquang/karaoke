/**
 * Google Apps Script backend for personal Vietnamese stock buy manager.
 * Sheets required:
 * - transactions: id | symbol | date | price | quantity | status
 * - config: key | value (must include ACCESS_CODE)
 */

const TRANSACTION_SHEET = "transactions";
const CONFIG_SHEET = "config";

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

    if (action === "add") {
      return handleAdd(payload);
    }
    if (action === "list") {
      return handleList();
    }
    if (action === "sell") {
      return handleSell(payload);
    }

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
  sheet.appendRow([id, symbol, date, price, quantity, "HOLD"]);
  return jsonResponse({ ok: true, data: { id } });
}

function handleList() {
  const sheet = getSheet(TRANSACTION_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: true, data: [] });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const rows = values
    .map(function (row) {
      return {
        id: Number(row[0]),
        symbol: String(row[1] || "").toUpperCase(),
        date: String(row[2] || ""),
        price: Number(row[3]),
        quantity: Number(row[4]),
        status: String(row[5] || "HOLD").toUpperCase()
      };
    })
    .filter(function (tx) {
      return tx.status === "HOLD";
    })
    .sort(function (a, b) {
      return b.id - a.id;
    });

  return jsonResponse({ ok: true, data: rows });
}

function handleSell(payload) {
  const id = Number(payload.id);
  if (!isFinite(id)) {
    return jsonResponse({ ok: false, message: "ID khong hop le" });
  }

  const sheet = getSheet(TRANSACTION_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: false, message: "Khong tim thay giao dich" });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (var i = 0; i < values.length; i++) {
    const rowId = Number(values[i][0]);
    if (rowId === id) {
      sheet.getRange(i + 2, 6).setValue("SOLD");
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
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error("Missing sheet: " + name);
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
