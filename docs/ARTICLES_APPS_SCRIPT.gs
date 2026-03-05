/**
 * Google Apps Script backend for Articles (Bài viết) in Học tập module.
 *
 * Google Sheet required:
 *   Sheet 1 — "articles": id | title | contentType | content | createdAt | updatedAt | status
 *   Sheet 2 — "config":   key | value   (must include ACCESS_CODE row)
 *
 * contentType values: "html" | "link"
 * status values:      "ACTIVE" | "DELETED"
 */

var ARTICLE_SHEET = "articles";
var CONFIG_SHEET  = "config";

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action  = String(payload.action || "").trim().toLowerCase();

    if (!action) {
      return jsonResponse({ ok: false, message: "Missing action" });
    }

    if (action === "login") {
      return handleLogin(payload);
    }

    if (!isValidAccessCode(payload.accessCode)) {
      return jsonResponse({ ok: false, message: "Invalid access code" });
    }

    if (action === "list")   return handleList();
    if (action === "add")    return handleAdd(payload);
    if (action === "update") return handleUpdate(payload);
    if (action === "delete") return handleDelete(payload);

    return jsonResponse({ ok: false, message: "Unsupported action" });
  } catch (err) {
    return jsonResponse({
      ok: false,
      message: "Server error",
      details: err && err.message ? String(err.message) : "Unknown"
    });
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function handleLogin(payload) {
  if (!isValidAccessCode(payload.accessCode)) {
    return jsonResponse({ ok: false, message: "Sai mã truy cập" });
  }
  return jsonResponse({ ok: true });
}

function isValidAccessCode(inputCode) {
  var code = String(inputCode || "").trim();
  if (!code) return false;
  return code === getAccessCode();
}

function getAccessCode() {
  var sheet  = getSheet(CONFIG_SHEET);
  var values = sheet.getDataRange().getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || "").trim().toUpperCase();
    if (key === "ACCESS_CODE") {
      return String(values[i][1] || "").trim();
    }
  }
  throw new Error("Missing ACCESS_CODE in config sheet");
}

// ── List ──────────────────────────────────────────────────────────────────────

function handleList() {
  var sheet   = getSheet(ARTICLE_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: true, data: [] });
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var rows   = [];

  for (var i = 0; i < values.length; i++) {
    var row    = values[i];
    var status = String(row[6] || "ACTIVE").toUpperCase();
    if (status === "DELETED") continue;

    rows.push({
      id:          String(row[0]),
      title:       String(row[1] || ""),
      contentType: String(row[2] || "html"),
      content:     String(row[3] || ""),
      createdAt:   String(row[4] || ""),
      updatedAt:   String(row[5] || "")
    });
  }

  // newest first (by createdAt desc)
  rows.sort(function (a, b) {
    return b.createdAt.localeCompare(a.createdAt);
  });

  return jsonResponse({ ok: true, data: rows });
}

// ── Add ───────────────────────────────────────────────────────────────────────

function handleAdd(payload) {
  var title       = String(payload.title       || "").trim();
  var contentType = String(payload.contentType || "html").trim().toLowerCase();
  var content     = String(payload.content     || "").trim();

  if (!title)                              return jsonResponse({ ok: false, message: "Tiêu đề không được để trống" });
  if (contentType !== "html" && contentType !== "link") return jsonResponse({ ok: false, message: "contentType phải là html hoặc link" });
  if (!content)                            return jsonResponse({ ok: false, message: "Nội dung không được để trống" });

  var now = isoNow();
  var id  = String(Date.now());

  var sheet = getSheet(ARTICLE_SHEET);
  sheet.appendRow([id, title, contentType, content, now, now, "ACTIVE"]);

  return jsonResponse({ ok: true, data: { id: id, createdAt: now, updatedAt: now } });
}

// ── Update ────────────────────────────────────────────────────────────────────

function handleUpdate(payload) {
  var id          = String(payload.id          || "").trim();
  var title       = String(payload.title       || "").trim();
  var contentType = String(payload.contentType || "html").trim().toLowerCase();
  var content     = String(payload.content     || "").trim();

  if (!id)      return jsonResponse({ ok: false, message: "Thiếu id" });
  if (!title)   return jsonResponse({ ok: false, message: "Tiêu đề không được để trống" });
  if (!content) return jsonResponse({ ok: false, message: "Nội dung không được để trống" });

  var sheet   = getSheet(ARTICLE_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ ok: false, message: "Không tìm thấy bài viết" });

  var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      var rowIndex = i + 2;
      var now = isoNow();
      sheet.getRange(rowIndex, 2).setValue(title);
      sheet.getRange(rowIndex, 3).setValue(contentType);
      sheet.getRange(rowIndex, 4).setValue(content);
      sheet.getRange(rowIndex, 6).setValue(now);
      return jsonResponse({ ok: true, data: { updatedAt: now } });
    }
  }

  return jsonResponse({ ok: false, message: "Không tìm thấy bài viết" });
}

// ── Delete (soft) ─────────────────────────────────────────────────────────────

function handleDelete(payload) {
  var id = String(payload.id || "").trim();
  if (!id) return jsonResponse({ ok: false, message: "Thiếu id" });

  var sheet   = getSheet(ARTICLE_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ ok: false, message: "Không tìm thấy bài viết" });

  var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === id) {
      sheet.getRange(i + 2, 7).setValue("DELETED");
      return jsonResponse({ ok: true });
    }
  }

  return jsonResponse({ ok: false, message: "Không tìm thấy bài viết" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSheet(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Missing sheet: " + name);
  return sheet;
}

function isoNow() {
  var now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
