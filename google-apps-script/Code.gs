/**
 * Brandex Google Sheets Backend — v2.0
 *
 * Deploy: Deploy > New deployment > Web app
 * Execute as: Me
 * Who has access: Anyone with the link
 *
 * === SHEET STRUCTURE REQUIRED ===
 *
 * Tab "DATABASE":
 *   ID | DATE | TYPE | CLIENT CODE | CASE NUMBER | CLIENT NAME | APPLICATION NAME |
 *   TM/CPR NUMBER | CLASS | STATUS | SUB STATUS | CASE TYPE | AGENT | CITY | NOTES |
 *   TM5 | TM6 | TM11 | TM16 | TM56 | JOURNAL NUMBER | JOURNAL DATE | LAST MODIFIED | IMAGE
 *
 * Tab "CLIENTS":
 *   CLIENT CODE | CLIENT NAME | ...
 *
 * Tabs "TM5", "TM6", "TM11", "TM16", "TM56":
 *   TM NUMBER | ... (other columns)
 *
 * Tab "JOURNAL":
 *   Application No | Journal No | Journal Date | Title | Class |
 *   Applicant Name and Address | Agent Name and Address | Date of Filing
 *
 * Tab "LOGS" (was "Audit Log"):
 *   Timestamp | User | Action | Record ID | Case Number | Field | Old Value | New Value
 *
 * === API ===
 *
 * GET  ?action=list                          → all DATABASE rows (24 cols) as JSON
 * GET  ?action=stats                         → summary statistics
 * GET  ?action=getRecord&id=X               → single enriched record (TM matches + Journal)
 * GET  ?action=searchTm&tmNo=X              → TM card: record + TM matches + Journal
 * GET  ?action=listLogs&limit=N&offset=N    → LOGS rows (newest first)
 * GET  ?action=listAgents                   → distinct agent list from DATABASE
 *
 * POST { action: "create", record: {...} }   → create new row
 * POST { action: "update", id: "...", record: {...} }  → update by ID
 * POST { action: "delete", id: "..." }       → delete by ID
 */

// These are the PREFERRED tab names.
// The lookup is case-insensitive and also checks legacy names,
// so existing sheets named "Database" or "Audit Log" will be found correctly.
var DB_SHEET_NAME  = "DATABASE";
var LOG_SHEET_NAME = "LOGS";
var ARCHIVE_SHEET_NAME = "ARCHIVE";

var DB_HEADERS = [
  "ID", "DATE", "TYPE", "CLIENT CODE", "CASE NUMBER", "CLIENT NAME",
  "APPLICATION NAME", "TM/CPR NUMBER", "CLASS", "STATUS", "SUB STATUS",
  "CASE TYPE", "AGENT", "CITY", "NOTES",
  "TM5", "TM6", "TM11", "TM16", "TM56",
  "JOURNAL NUMBER", "JOURNAL DATE", "LAST MODIFIED", "IMAGE"
];

var LOG_HEADERS = [
  "Timestamp", "User", "Action", "Record ID", "Case Number",
  "Field", "Old Value", "New Value"
];

var TM_SHEETS = ["TM5", "TM6", "TM11", "TM16", "TM56"];

// ---------------------------------------------------------------------------
// GET handler — read-only operations
// ---------------------------------------------------------------------------
function doGet(e) {
  return json({ ok: true, data: { service: "Brandex Sheet Mirror", writeMode: "Supabase only" } });
}

// ---------------------------------------------------------------------------
// POST handler — write operations
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents || "{}");
    var action = body.action;

    // Supabase -> Google Sheet mirror operations are authenticated with a
    // server-side secret stored in Apps Script Properties. The secret must
    // never be placed in a VITE_* environment variable.
    if (action === "mirrorUpsert" || action === "mirrorDelete" || action === "mirrorExport") {
      requireMirrorSecret(body.secret);
      if (action === "mirrorExport") {
        return json({ ok: true, data: getDbRows() });
      }
      if (action === "mirrorUpsert") {
        var mirrorResult = mirrorUpsertRecord(body.id, body.record || {});
        return json({ ok: true, data: mirrorResult });
      }
      mirrorDeleteRecord(body.id);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Legacy writes are disabled; use the secure Datasheet" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function requireMirrorSecret(providedSecret) {
  var expectedSecret = PropertiesService.getScriptProperties().getProperty("BRANDEX_MIRROR_SECRET");
  if (!expectedSecret) throw new Error("BRANDEX_MIRROR_SECRET is not configured");
  if (!providedSecret || String(providedSecret) !== String(expectedSecret)) {
    throw new Error("Unauthorized mirror request");
  }
}

// ---------------------------------------------------------------------------
// Sheet lookup helpers
// ---------------------------------------------------------------------------

/**
 * Find a sheet by name, case-insensitively.
 * Also accepts an array of legacy fallback names.
 * Returns null if not found.
 */
function findSheet(preferredName, legacyNames) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var all = ss.getSheets();
  var needle = preferredName.trim().toLowerCase();

  // 1. Exact match first
  var exact = ss.getSheetByName(preferredName);
  if (exact) return exact;

  // 2. Case-insensitive match
  for (var i = 0; i < all.length; i++) {
    if (all[i].getName().trim().toLowerCase() === needle) return all[i];
  }

  // 3. Legacy names (also case-insensitive)
  if (legacyNames) {
    for (var j = 0; j < legacyNames.length; j++) {
      var leg = legacyNames[j].trim().toLowerCase();
      for (var k = 0; k < all.length; k++) {
        if (all[k].getName().trim().toLowerCase() === leg) return all[k];
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core DB operations
// ---------------------------------------------------------------------------
function getDbSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Legacy names: "Database" (mixed case from old Code.gs)
  var sheet = findSheet(DB_SHEET_NAME, ["Database", "database", "Sheet1"]);

  if (!sheet) {
    // No matching sheet found — create it
    sheet = ss.insertSheet(DB_SHEET_NAME);
    sheet.appendRow(DB_HEADERS);
    return sheet;
  }

  // Ensure row 1 is the header row
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DB_HEADERS);
  } else {
    var firstCell = String(sheet.getRange(1, 1).getValue()).trim();
    if (firstCell !== "ID") {
      // Row 1 is not a header — insert one
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, DB_HEADERS.length).setValues([DB_HEADERS]);
    }
  }
  return sheet;
}

function getArchiveSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ARCHIVE_SHEET_NAME, ["Archive", "archive"]);
  var headers = DB_HEADERS.concat(["DELETED AT"]);
  if (!sheet) {
    sheet = ss.insertSheet(ARCHIVE_SHEET_NAME);
    sheet.appendRow(headers);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function getLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Legacy names: "Audit Log" (old Code.gs name)
  var sheet = findSheet(LOG_SHEET_NAME, ["Audit Log", "audit log", "AUDIT LOG", "Logs"]);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(LOG_HEADERS);
  }
  return sheet;
}

function getHeaderMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) {
    map[String(h).trim().toUpperCase()] = i;
  });
  return map;
}

function normalizeTmNo(val) {
  return String(val || "").trim().replace(/\.0$/, "").replace(/^["']|["']$/g, "");
}

function getDbRows() {
  var sheet = getDbSheet();
  var last  = sheet.getLastRow();
  if (last < 2) return [];

  var data    = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  return data
    .filter(function (row) {
      return String(row[0]).trim() !== "";
    })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        var key = String(h).trim();
        var val = row[i];
        if (val instanceof Date) {
          obj[key] = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
        } else {
          obj[key] = String(val === null || val === undefined ? "" : val);
        }
      });
      return obj;
    });
}

function findRowById(id) {
  var sheet = getDbSheet();
  var last  = sheet.getLastRow();
  if (last < 2) return null;

  var idCol = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < idCol.length; i++) {
    if (String(idCol[i][0]).trim() === String(id).trim()) {
      return { rowIndex: i + 2 };
    }
  }
  return null;
}

function generateId() {
  return "BX-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// ---------------------------------------------------------------------------
// Field mapping helper — maps API field names to DB_HEADERS
// ---------------------------------------------------------------------------
function buildRowFromRecord(record, existing) {
  var tz  = Session.getScriptTimeZone();
  var now = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");

  var row = existing ? existing.slice() : new Array(DB_HEADERS.length).fill("");

  function set(header, val) {
    var idx = DB_HEADERS.indexOf(header);
    if (idx >= 0 && val !== undefined && val !== null) row[idx] = sheetLiteral(val);
  }

  if (record.date      !== undefined) set("DATE",           record.date);
  if (record.type      !== undefined) set("TYPE",           record.type);
  // legacy prefix field
  if (record.prefix    !== undefined) set("TYPE",           record.prefix);
  if (record.clientCode !== undefined) set("CLIENT CODE",   record.clientCode);
  // legacy clientNo field
  if (record.clientNo  !== undefined) set("CLIENT CODE",    record.clientNo);
  if (record.caseNumber !== undefined) set("CASE NUMBER",   record.caseNumber);
  // legacy caseNo / folderNo field
  if (record.caseNo    !== undefined) set("CASE NUMBER",    record.caseNo);
  if (record.folderNo  !== undefined) set("CASE NUMBER",    record.folderNo);
  if (record.clientName !== undefined) set("CLIENT NAME",   record.clientName);
  if (record.appName   !== undefined) set("APPLICATION NAME", record.appName);
  if (record.tmCprNo   !== undefined) set("TM/CPR NUMBER",  record.tmCprNo);
  // legacy tmNo field
  if (record.tmNo      !== undefined) set("TM/CPR NUMBER",  record.tmNo);
  if (record.appClass  !== undefined) set("CLASS",          record.appClass);
  if (record.stage     !== undefined) set("STATUS",         record.stage);
  if (record.subStage  !== undefined) set("SUB STATUS",     record.subStage);
  if (record.caseType  !== undefined) set("CASE TYPE",      record.caseType);
  if (record.agent     !== undefined) set("AGENT",          record.agent);
  if (record.city      !== undefined) set("CITY",           record.city);
  if (record.notes     !== undefined) set("NOTES",          record.notes);
  if (record.image     !== undefined) set("IMAGE",          record.image);

  // Always update LAST MODIFIED
  set("LAST MODIFIED", now);

  // Existing cells may predate this guard, so sanitize the complete outgoing row.
  return row.map(sheetLiteral);
}

// Imported case details are data, even if they resemble a Sheet formula.
function sheetLiteral(value) {
  if (typeof value !== "string") return value;
  return /^[\s\x00-\x1f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)
    ? "'" + value
    : value;
}

// Maps the Supabase snake_case record to the existing 24-column Sheet layout.
function buildRowFromSupabase(record, existing) {
  var mapped = {
    date: record.filing_date,
    type: record.type,
    clientCode: record.client_code,
    clientName: record.client_name,
    caseNumber: record.case_number,
    appName: record.application_name,
    tmCprNo: record.tm_cpr_number,
    appClass: record.nice_class,
    stage: record.status,
    subStage: record.sub_status,
    caseType: record.case_type,
    agent: record.agent,
    city: record.city,
    notes: record.notes,
    image: record.logo_path || record.legacy_image_url
  };

  var row = buildRowFromRecord(mapped, existing);
  row[DB_HEADERS.indexOf("TM5")] = record.tm5 ? "YES" : "";
  row[DB_HEADERS.indexOf("TM6")] = record.tm6 ? "YES" : "";
  row[DB_HEADERS.indexOf("TM11")] = record.tm11 ? "YES" : "";
  row[DB_HEADERS.indexOf("TM16")] = record.tm16 ? "YES" : "";
  row[DB_HEADERS.indexOf("TM56")] = record.tm56 ? "YES" : "";
  row[DB_HEADERS.indexOf("JOURNAL NUMBER")] = sheetLiteral(record.journal_number || "");
  row[DB_HEADERS.indexOf("JOURNAL DATE")] = sheetLiteral(record.journal_date || "");
  return row;
}

function mirrorUpsertRecord(id, record) {
  if (!id) throw new Error("Mirror record id is required");

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var sheet = getDbSheet();
    var found = findRowById(id);
    var row;

    if (found) {
      var existing = sheet.getRange(found.rowIndex, 1, 1, DB_HEADERS.length).getValues()[0];
      row = buildRowFromSupabase(record, existing);
      row[DB_HEADERS.indexOf("ID")] = id;
      sheet.getRange(found.rowIndex, 1, 1, DB_HEADERS.length).setValues([row]);
    } else {
      row = buildRowFromSupabase(record, new Array(DB_HEADERS.length).fill(""));
      row[DB_HEADERS.indexOf("ID")] = id;
      sheet.appendRow(row);
    }
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function mirrorDeleteRecord(id) {
  if (!id) throw new Error("Mirror record id is required");

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var sheet = getDbSheet();
    var found = findRowById(id);
    if (found) {
      var row = sheet.getRange(found.rowIndex, 1, 1, DB_HEADERS.length).getValues()[0];
      getArchiveSheet().appendRow(row.concat([new Date().toISOString()]));
      sheet.deleteRow(found.rowIndex);
    }
  } finally {
    lock.releaseLock();
  }
}

function createRecord(record) {
  var sheet     = getDbSheet();
  var id        = record.id || generateId();
  var tz        = Session.getScriptTimeZone();
  var now       = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");

  var row = new Array(DB_HEADERS.length).fill("");
  row[DB_HEADERS.indexOf("ID")]   = id;
  row[DB_HEADERS.indexOf("DATE")] = record.date || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  row = buildRowFromRecord(record, row);
  row[DB_HEADERS.indexOf("ID")]   = id; // Ensure ID is not overwritten
  row[DB_HEADERS.indexOf("LAST MODIFIED")] = now;

  sheet.appendRow(row);

  var caseNo = row[DB_HEADERS.indexOf("CASE NUMBER")] || "";
  appendLog("CREATE", id, caseNo, record.appName || id, "CREATE", "", "CREATED");

  return { id: id, caseNumber: caseNo };
}

function updateRecord(id, record) {
  var sheet = getDbSheet();
  var found = findRowById(id);
  if (!found) throw new Error("Record not found: " + id);

  var rowNum    = found.rowIndex;
  var lastCol   = sheet.getLastColumn();
  var oldRowArr = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];

  // Pad to full DB_HEADERS length if sheet has fewer cols
  while (oldRowArr.length < DB_HEADERS.length) oldRowArr.push("");

  var newRowArr = buildRowFromRecord(record, oldRowArr.slice());

  var label  = record.appName || id;
  var caseNo = oldRowArr[DB_HEADERS.indexOf("CASE NUMBER")] || "";

  // Write changed cells and log each change
  for (var i = 0; i < DB_HEADERS.length; i++) {
    var header = DB_HEADERS[i];
    if (header === "ID" || header === "LAST MODIFIED") continue;
    var oldVal = String(oldRowArr[i] || "");
    var newVal = String(newRowArr[i] === undefined ? "" : newRowArr[i]);
    if (oldVal !== newVal) {
      sheet.getRange(rowNum, i + 1).setValue(newRowArr[i]);
      appendLog("UPDATE", id, caseNo, label, header, oldVal, newVal);
    }
  }

  // Always update LAST MODIFIED
  var lmIdx = DB_HEADERS.indexOf("LAST MODIFIED") + 1;
  var tz  = Session.getScriptTimeZone();
  var now = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");
  sheet.getRange(rowNum, lmIdx).setValue(now);

  return { id: id };
}

function deleteRecord(id) {
  var sheet = getDbSheet();
  var found = findRowById(id);
  if (!found) throw new Error("Record not found: " + id);

  var rowNum = found.rowIndex;
  var caseNo = String(sheet.getRange(rowNum, DB_HEADERS.indexOf("CASE NUMBER") + 1).getValue() || "");
  appendLog("DELETE", id, caseNo, id, "DELETE", "", "DELETED");
  sheet.deleteRow(rowNum);
}

// ---------------------------------------------------------------------------
// Enriched record (single record with TM matching + Journal)
// ---------------------------------------------------------------------------
function getEnrichedRecord(id) {
  var rows = getDbRows();
  var record = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]["ID"]).trim() === String(id).trim()) {
      record = rows[i];
      break;
    }
  }
  if (!record) return null;
  return enrichRecord(record);
}

function enrichRecord(record) {
  var tmNo   = normalizeTmNo(record["TM/CPR NUMBER"]);
  var matches = getTmSheetMatches(tmNo);
  var journal = tmNo ? getJournalMatch(tmNo) : null;
  record["_tmMatches"]  = matches;
  record["_journal"]    = journal;
  return record;
}

// ---------------------------------------------------------------------------
// Search by TM Number (for the Search TM card)
// ---------------------------------------------------------------------------
function searchByTmNumber(tmNo) {
  var normalized = normalizeTmNo(tmNo);
  var rows  = getDbRows();
  var found = [];

  for (var i = 0; i < rows.length; i++) {
    if (normalizeTmNo(rows[i]["TM/CPR NUMBER"]) === normalized) {
      found.push(rows[i]);
    }
  }

  var matches = getTmSheetMatches(normalized);
  var journal = getJournalMatch(normalized);

  return {
    records: found,
    tmMatches: matches,
    journal: journal
  };
}

// ---------------------------------------------------------------------------
// TM Sheet matching
// ---------------------------------------------------------------------------
function getTmSheetMatches(tmNo) {
  if (!tmNo) return { TM5: false, TM6: false, TM11: false, TM16: false, TM56: false };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};

  TM_SHEETS.forEach(function (sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) { result[sheetName] = false; return; }

    var last = sheet.getLastRow();
    if (last < 2) { result[sheetName] = false; return; }

    // Find "TM NUMBER" column
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var tmColIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).trim().toUpperCase();
      if (h === "TM NUMBER" || h === "TM/CPR NUMBER" || h === "TM NO") {
        tmColIdx = i + 1;
        break;
      }
    }
    if (tmColIdx < 0) { result[sheetName] = false; return; }

    var tmValues = sheet.getRange(2, tmColIdx, last - 1, 1).getValues();
    var found = false;
    for (var j = 0; j < tmValues.length; j++) {
      if (normalizeTmNo(tmValues[j][0]) === tmNo) {
        found = true;
        break;
      }
    }
    result[sheetName] = found;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Journal matching
// ---------------------------------------------------------------------------
function getJournalMatch(tmNo) {
  if (!tmNo) return null;
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("JOURNAL");
  if (!sheet) return null;

  var last = sheet.getLastRow();
  if (last < 2) return null;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerMap = {};
  headers.forEach(function (h, i) {
    headerMap[String(h).trim().toUpperCase()] = i;
  });

  var appNoIdx = headerMap["APPLICATION NO"] !== undefined ? headerMap["APPLICATION NO"] : -1;
  if (appNoIdx < 0) {
    // Try alternate names
    for (var key in headerMap) {
      if (key.indexOf("APPLICATION") >= 0 && key.indexOf("NO") >= 0) {
        appNoIdx = headerMap[key];
        break;
      }
    }
  }
  if (appNoIdx < 0) return null;

  var data = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (normalizeTmNo(row[appNoIdx]) === tmNo) {
      var result = { found: true };
      headers.forEach(function (h, idx) {
        var val = row[idx];
        result[String(h).trim()] = val instanceof Date
          ? Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd")
          : String(val || "");
      });
      return result;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Distinct values helper
// ---------------------------------------------------------------------------
function getDistinctValues(columnHeader) {
  var rows = getDbRows();
  var seen = {};
  var result = [];
  rows.forEach(function (row) {
    var val = String(row[columnHeader] || "").trim();
    if (val && !seen[val]) {
      seen[val] = true;
      result.push(val);
    }
  });
  return result.sort();
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------
function appendLog(action, recordId, caseNo, label, field, oldVal, newVal) {
  var sheet = getLogSheet();
  var user  = "Brandex";
  try { user = Session.getActiveUser().getEmail() || "Brandex"; } catch (e) {}
  var tz  = Session.getScriptTimeZone();
  var now = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");
  sheet.appendRow([
    now,
    user,
    action,
    recordId || "",
    caseNo   || "",
    field    || "",
    oldVal   || "",
    newVal   || ""
  ]);
}

function getLogRows(limit, offset) {
  var sheet = getLogSheet();
  var last  = sheet.getLastRow();
  if (last < 2) return [];

  var startRow = Math.max(2, last - offset - limit + 1);
  var numRows  = Math.min(limit, last - startRow);
  if (numRows < 1) return [];

  var data   = sheet.getRange(startRow, 1, numRows, 8).getValues();
  var result = [];
  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    var ts  = row[0];
    result.push({
      id:         startRow + i - 1,
      changedAt:  ts instanceof Date ? Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") : String(ts || ""),
      changedBy:  String(row[1] || ""),
      action:     String(row[2] || ""),
      recordId:   String(row[3] || ""),
      caseNo:     String(row[4] || ""),
      field:      String(row[5] || ""),
      oldValue:   String(row[6] || ""),
      newValue:   String(row[7] || ""),
      // Legacy compat: "record" field for old log format
      record:     String(row[4] || row[3] || ""),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function computeStats(rows) {
  var total      = rows.length;
  var byStatus   = {};
  var byCity     = {};
  var stageCounts = {};
  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  var recentlyModified = 0;

  rows.forEach(function (row) {
    var status = row["STATUS"] || "UNKNOWN";
    byStatus[status] = (byStatus[status] || 0) + 1;

    var city = row["CITY"] || "UNSPECIFIED";
    byCity[city] = (byCity[city] || 0) + 1;

    if (status.match(/STAGE \d/i)) {
      var s = status.toUpperCase();
      stageCounts[s] = (stageCounts[s] || 0) + 1;
    }

    var lastMod = row["LAST MODIFIED"];
    if (lastMod) {
      var d = new Date(lastMod);
      if (!isNaN(d) && d >= sevenDaysAgo) recentlyModified++;
    }
  });

  return {
    total:           total,
    recentlyModified: recentlyModified,
    byStage:         Object.keys(byStatus).map(function (k) { return { stage: k, count: byStatus[k] }; }),
    byCity:          Object.keys(byCity).map(function (k) { return { city: k, count: byCity[k] }; }),
    byNumericStage:  Object.keys(stageCounts).map(function (k) { return { stage: k, count: stageCounts[k] }; })
  };
}

// ---------------------------------------------------------------------------
// Image Upload (Google Drive)
// ---------------------------------------------------------------------------
function uploadImageToDrive(fileName, mimeType, base64Data) {
  if (!base64Data) throw new Error("No image data provided");
  var folderName = "Brandex Trademark Images";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, mimeType || "image/jpeg", fileName || ("trademark-" + Date.now() + ".jpg"));
  var file = folder.createFile(blob);
  
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // If domain restricts public sharing, file will still have view access by owner
  }

  var fileId = file.getId();
  return {
    fileId: fileId,
    url: file.getUrl(),
    thumbnailUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400"
  };
}

// ---------------------------------------------------------------------------
// Client reference list
// ---------------------------------------------------------------------------
function getClientsList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet("CLIENTS", ["Clients", "clients", "Client List"]);
  var clientMap = {};
  var result = [];

  if (sheet && sheet.getLastRow() >= 2) {
    var last = sheet.getLastRow();
    var data = sheet.getRange(2, 1, last - 1, Math.min(sheet.getLastColumn(), 5)).getValues();
    var headers = sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), 5)).getValues()[0];
    
    var codeIdx = -1;
    var nameIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).trim().toUpperCase();
      if (h.indexOf("CODE") >= 0 || h === "CLIENT CODE") codeIdx = i;
      if (h.indexOf("NAME") >= 0 || h === "CLIENT NAME") nameIdx = i;
    }
    if (codeIdx < 0) codeIdx = 0;
    if (nameIdx < 0) nameIdx = 1;

    for (var j = 0; j < data.length; j++) {
      var code = String(data[j][codeIdx] || "").trim();
      var name = String(data[j][nameIdx] || "").trim();
      if (code && !clientMap[code]) {
        clientMap[code] = name;
        result.push({ code: code, name: name });
      }
    }
  }

  // Also extract from DATABASE rows to ensure existing client codes are mapped
  var dbRows = getDbRows();
  dbRows.forEach(function (r) {
    var code = String(r["CLIENT CODE"] || "").trim();
    var name = String(r["CLIENT NAME"] || "").trim();
    if (code && !clientMap[code]) {
      clientMap[code] = name;
      result.push({ code: code, name: name });
    }
  });

  return result.sort(function (a, b) {
    return a.code.localeCompare(b.code);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
