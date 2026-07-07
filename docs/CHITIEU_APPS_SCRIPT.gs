const TRANSACTION_SHEET = "transactions";
const CATEGORY_SHEET = "categories";
const CONFIG_SHEET = "config";
const PALETTE = [
  "#0D9488",
  "#7C3AED",
  "#2563EB",
  "#DB2777",
  "#D97706",
  "#059669",
  "#DC2626",
  "#4F46E5",
  "#BE185D",
  "#0891B2",
  "#65A30D",
  "#A21CAF",
];

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
    if (action === "upsert_category") {
      return handleUpsertCategory(payload);
    }
    if (action === "list") {
      return handleList(payload);
    }
    if (action === "list_categories") {
      return handleListCategories(payload);
    }
    if (action === "update") {
      return handleUpdate(payload);
    }
    if (action === "delete") {
      return handleDelete(payload);
    }
    if (action === "get_config") {
      return handleGetConfig(payload);
    }
    if (action === "save_config") {
      return handleSaveConfig(payload);
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

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, TRANSACTION_SHEET);
  ensureSheet(ss, CATEGORY_SHEET);
  ensureSheet(ss, CONFIG_SHEET);
  const configSheet = ss.getSheetByName(CONFIG_SHEET);
  const range = configSheet.getDataRange();
  const values = range.getValues();
  const keys = {};
  for (let i = 0; i < values.length; i++) {
    const key = String(values[i][0] || "").trim().toUpperCase();
    if (key) keys[key] = true;
  }
  const rows = [];
  if (!keys["ACCESS_CODE"]) rows.push(["ACCESS_CODE", "1234"]);
  if (!keys["SALARY_DAY"]) rows.push(["SALARY_DAY", 5]);
  if (rows.length) {
    configSheet.getRange(configSheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
  }
}

function ensureSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (name === TRANSACTION_SHEET) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) {
      sheet.appendRow(["id", "loai", "category", "soTien", "note", "createdAt"]);
    }
  } else if (name === CATEGORY_SHEET) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) {
      sheet.appendRow(["ten", "loai", "mau"]);
    }
  } else if (name === CONFIG_SHEET) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) {
      sheet.appendRow(["key", "value"]);
    }
  }
}

function handleLogin(payload) {
  if (!isValidAccessCode(payload.accessCode)) {
    return jsonResponse({ ok: false, message: "Sai ma truy cap" });
  }
  return jsonResponse({ ok: true });
}

function handleAdd(payload) {
  const loai = String(payload.loai || "").trim().toLowerCase();
  const category = String(payload.category || "").trim();
  const soTien = Number(payload.soTien);
  const note = String(payload.note || "").trim();

  if (loai !== "thu" && loai !== "chi") {
    return jsonResponse({ ok: false, message: "Loai khong hop le" });
  }
  if (!category) {
    return jsonResponse({ ok: false, message: "Thieu category" });
  }
  if (!isFinite(soTien) || soTien <= 0) {
    return jsonResponse({ ok: false, message: "So tien khong hop le" });
  }

  const id = Date.now();
  const createdAt = new Date().toISOString();
  const sheet = getSheet(TRANSACTION_SHEET);
  sheet.appendRow([id, loai, category, soTien, note, createdAt]);

  let categoryData = null;
  const catRows = getCategoryRows();
  for (let i = 0; i < catRows.length; i++) {
    const row = catRows[i];
    const ten = String(row[0] || "").trim();
    if (ten === category) {
      categoryData = { ten: ten, loai: String(row[1] || "").trim(), mau: String(row[2] || "").trim() };
      break;
    }
  }
  if (!categoryData) {
    const mau = hashColor(category);
    const catSheet = getSheet(CATEGORY_SHEET);
    catSheet.appendRow([category, loai, mau]);
    categoryData = { ten: category, loai: loai, mau: mau };
  }

  return jsonResponse({ ok: true, data: { id, category: categoryData } });
}

function handleUpsertCategory(payload) {
  const ten = String(payload.ten || "").trim();
  const loai = String(payload.loai || "").trim().toLowerCase();
  if (!ten) {
    return jsonResponse({ ok: false, message: "Thieu ten category" });
  }
  if (loai !== "thu" && loai !== "chi") {
    return jsonResponse({ ok: false, message: "Loai khong hop le" });
  }
  const catSheet = getSheet(CATEGORY_SHEET);
  const lastRow = catSheet.getLastRow();
  let exists = false;
  if (lastRow > 1) {
    const values = catSheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < values.length; i++) {
      const rowTen = String(values[i][0] || "").trim();
      if (rowTen === ten) {
        exists = true;
        break;
      }
    }
  }
  if (!exists) {
    const mau = hashColor(ten);
    catSheet.appendRow([ten, loai, mau]);
  }
  return jsonResponse({ ok: true });
}

function handleList(payload) {
  const from = payload && payload.from ? String(payload.from).trim() : null;
  const to = payload && payload.to ? String(payload.to).trim() : null;
  const sheet = getSheet(TRANSACTION_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: true, data: [] });
  }
  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const rows = values.map(function(row) {
    return {
      id: Number(row[0]),
      loai: String(row[1] || "").toLowerCase(),
      category: String(row[2] || ""),
      soTien: Number(row[3]),
      note: String(row[4] || ""),
      createdAt: String(row[5] || "")
    };
  }).filter(function(rx) {
    return rx.id > 0;
  });
  if (from || to) {
    const fromStamp = from ? new Date(from).getTime() : null;
    const toStamp = to ? new Date(to).getTime() + 86400000 : null;
    rows.forEach(function(rx) {
      const ts = new Date(rx.createdAt).getTime();
      if (!Number.isNaN(ts)) {
        rx._ts = ts;
      } else {
        rx._ts = null;
      }
    });
    const filtered = rows.filter(function(rx) {
      if (rx._ts === null) return false;
      if (fromStamp !== null && rx._ts < fromStamp) return false;
      if (toStamp !== null && rx._ts >= toStamp) return false;
      return true;
    });
    return jsonResponse({ ok: true, data: filtered.sort(sortDesc) });
  }
  return jsonResponse({ ok: true, data: rows.sort(sortDesc) });
}

function handleListCategories(payload) {
  const loaiFilter = payload && payload.loai ? String(payload.loai).trim().toLowerCase() : null;
  const sheet = getSheet(CATEGORY_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: true, data: [] });
  }
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const rows = values.map(function(row) {
    return {
      ten: String(row[0] || "").trim(),
      loai: String(row[1] || "").trim().toLowerCase(),
      mau: String(row[2] || "").trim()
    };
  }).filter(function(rx) {
    if (loaiFilter && rx.loai !== loaiFilter) return false;
    return Boolean(rx.ten);
  });
  return jsonResponse({ ok: true, data: rows });
}

function handleUpdate(payload) {
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
  for (let i = 0; i < values.length; i++) {
    const rowId = Number(values[i][0]);
    if (rowId === id) {
      const loai = payload.loai !== undefined ? String(payload.loai).trim().toLowerCase() : values[i][1];
      const category = payload.category !== undefined ? String(payload.category).trim() : values[i][2];
      const soTien = payload.soTien !== undefined ? Number(payload.soTien) : values[i][3];
      const note = payload.note !== undefined ? String(payload.note).trim() : values[i][4];
      if (!["thu", "chi"].includes(loai)) {
        return jsonResponse({ ok: false, message: "Loai khong hop le" });
      }
      if (!category) {
        return jsonResponse({ ok: false, message: "Thieu category" });
      }
      if (!isFinite(soTien) || soTien <= 0) {
        return jsonResponse({ ok: false, message: "So tien khong hop le" });
      }
      sheet.getRange(i + 2, 2, 1, 4).setValues([[loai, category, soTien, note]]);
      return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, message: "Khong tim thay giao dich" });
}

function handleDelete(payload) {
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
  for (let i = 0; i < values.length; i++) {
    const rowId = Number(values[i][0]);
    if (rowId === id) {
      sheet.deleteRow(i + 2);
      return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, message: "Khong tim thay giao dich" });
}

function handleGetConfig(payload) {
  const sheet = getSheet(CONFIG_SHEET);
  const values = sheet.getDataRange().getValues();
  const obj = {};
  for (let i = 0; i < values.length; i++) {
    const key = String(values[i][0] || "").trim().toUpperCase();
    if (key) {
      obj[key] = values[i][1];
    }
  }
  return jsonResponse({ ok: true, data: obj });
}

function handleSaveConfig(payload) {
  const sheet = getSheet(CONFIG_SHEET);
  const lastRow = sheet.getLastRow();
  const updates = payload && payload.data ? payload.data : {};
  if (!updates || typeof updates !== "object") {
    return jsonResponse({ ok: false, message: "Thieu data config" });
  }
  const keys = {};
  if (lastRow > 1) {
    const values = sheet.getRange(1, 1, lastRow, 2).getValues();
    for (let i = 0; i < values.length; i++) {
      const key = String(values[i][0] || "").trim().toUpperCase();
      if (key) keys[key] = i + 1;
    }
  }
  let wrote = false;
  for (const key in updates) {
    const upper = String(key).trim().toUpperCase();
    if (!upper) continue;
    let row = keys[upper];
    if (row) {
      sheet.getRange(row, 2).setValue(updates[key]);
    } else {
      sheet.appendRow([upper, updates[key]]);
      keys[upper] = sheet.getLastRow();
    }
    wrote = true;
  }
  if (!wrote) {
    return jsonResponse({ ok: false, message: "Khong co key de luu" });
  }
  return jsonResponse({ ok: true });
}

function isValidAccessCode(inputCode) {
  const code = String(inputCode || "").trim();
  if (!code) return false;
  return String(code) === String(getAccessCode());
}

function getAccessCode() {
  const sheet = getSheet(CONFIG_SHEET);
  const values = sheet.getDataRange().getValues();
  for (let i = 0; i < values.length; i++) {
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

function getCategoryRows() {
  const sheet = getSheet(CATEGORY_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 3).getValues();
}

function hashColor(text) {
  let hash = 0;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

function sortDesc(a, b) {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  const aNum = Number.isNaN(aTime) ? a.id : aTime;
  const bNum = Number.isNaN(bTime) ? b.id : bTime;
  if (aNum > bNum) return -1;
  if (aNum < bNum) return 1;
  return 0;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

ensureSheets();
