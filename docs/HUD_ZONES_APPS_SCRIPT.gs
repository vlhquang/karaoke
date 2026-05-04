/**
 * HUD Speed Zones - Google Apps Script
 * 
 * Sheet name: SpeedZones
 * Columns: id | lat | lng | heading | roadId | zone | roadType | maxSpeed | label | createdAt
 *
 * Deploy: Web app → Execute as: Me → Who has access: Anyone
 */

const SHEET_NAME = "SpeedZones";
const HEADERS = ["id", "lat", "lng", "heading", "roadId", "zone", "roadType", "maxSpeed", "label", "createdAt", "status"];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

function generateId() {
  return "sz_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = (body.action || "").toLowerCase();

    if (action === "get_zones") {
      return handleGetZones();
    } else if (action === "add_zone") {
      return handleAddZone(body.data);
    } else if (action === "delete_zone") {
      return handleDeleteZone(body.id);
    } else if (action === "toggle_status") {
      return handleToggleStatus(body.id, body.status);
    } else {
      return jsonResponse({ ok: false, message: "Unsupported action: " + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, message: "Server error: " + err.message });
  }
}

function doGet(e) {
  return handleGetZones();
}

function handleGetZones() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({ ok: true, zones: [] });
  }

  const headers = data[0];
  const zones = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // skip empty rows
    const zone = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      let val = row[j];
      // Convert numeric fields
      if (["lat", "lng", "heading", "maxSpeed"].includes(key) && val !== "") {
        val = Number(val);
      }
      zone[key] = val === "" ? undefined : val;
    }
    // Default status if missing
    if (!zone.status) zone.status = "active";
    zones.push(zone);
  }

  return jsonResponse({ ok: true, zones: zones });
}

function handleAddZone(data) {
  if (!data || !data.lat || !data.lng) {
    return jsonResponse({ ok: false, message: "Missing lat/lng" });
  }

  const sheet = getOrCreateSheet();
  const id = generateId();
  const row = [
    id,
    data.lat,
    data.lng,
    data.heading || 0,
    data.roadId || "",
    data.zone || "outside",
    data.roadType || "manual",
    data.maxSpeed || 60,
    data.label || "",
    data.createdAt || new Date().toISOString(),
    data.status || "active"
  ];

  sheet.appendRow(row);
  return jsonResponse({ ok: true, id: id, message: "Zone added" });
}

function handleDeleteZone(id) {
  if (!id) {
    return jsonResponse({ ok: false, message: "Missing id" });
  }

  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1); // 1-indexed
      return jsonResponse({ ok: true, message: "Zone deleted" });
    }
  }

  return jsonResponse({ ok: false, message: "Zone not found: " + id });
}

function handleToggleStatus(id, newStatus) {
  if (!id || !newStatus) {
    return jsonResponse({ ok: false, message: "Missing id or status" });
  }

  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const statusColIndex = headers.indexOf("status");

  // If status column doesn't exist, append it
  let colToUpdate = statusColIndex + 1;
  if (statusColIndex === -1) {
    sheet.getRange(1, headers.length + 1).setValue("status");
    colToUpdate = headers.length + 1;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, colToUpdate).setValue(newStatus);
      return jsonResponse({ ok: true, message: "Status updated to " + newStatus });
    }
  }

  return jsonResponse({ ok: false, message: "Zone not found: " + id });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
