// ============================================================
//  Shivani & Akshay Wedding — RSVP Google Apps Script Backend
//  Deploy as: Web App → Execute as Me → Anyone (or Anyone with link)
// ============================================================

const SPREADSHEET_ID      = '1A31Vkz79SiVJ83m7D3BbtB1ZUIcmeFj7cqnmcUxKDS4';
const MASTER_SHEET_NAME   = 'Sheet1';
const RESPONSE_SHEET_NAME = 'RSVP Responses';

// Column indices (0-based)
const COL_NAME   = 1;  // B: INDIVIDUALS
const COL_GROUP  = 3;  // D: GROUP ID
const COL_EXTRA  = 4;  // E: Extra Persons
const COL_HALDI  = 8;  // I
const COL_SANGEET= 9;  // J
const COL_LAGAN  = 10; // K
const COL_CANADA = 11; // L
const COL_INDIA  = 12; // M

// ── CORS / JSON response helper ──────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Entry point ──────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    if (action === 'lookup')   return handleLookup(e.parameter);
    if (action === 'getGroup') return handleGetGroup(e.parameter);
    if (action === 'submit')   return handleSubmit(e.parameter);
    return corsResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return corsResponse({ error: err.message });
  }
}

// ── LOOKUP ───────────────────────────────────────────────────
// Accepts first and/or last name — at least one required.
// Returns a single group, or a list of name matches to pick from.
function handleLookup(params) {
  const firstRaw = (params.first || '').trim().toLowerCase();
  const lastRaw  = (params.last  || '').trim().toLowerCase();

  if (!firstRaw && !lastRaw) {
    return corsResponse({ error: 'Please enter at least your first or last name.' });
  }

  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master  = ss.getSheetByName(MASTER_SHEET_NAME);
  const data    = master.getDataRange().getValues();
  const headers = data[0];

  let rsvpSubmittedCol = -1;
  for (let c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim() === 'RSVP Submitted') {
      rsvpSubmittedCol = c;
      break;
    }
  }

  // Find all matching rows
  const matchingRows = [];
  for (let r = 1; r < data.length; r++) {
    const fullName = String(data[r][COL_NAME] || '').trim();
    if (!fullName) continue;

    const parts     = fullName.toLowerCase().split(' ');
    const rowFirst  = parts[0] || '';
    const rowLast   = parts.slice(1).join(' ');

    let matched = false;
    if (firstRaw && lastRaw) {
      // Both entered — match exact full name
      matched = (rowFirst === firstRaw && rowLast === lastRaw);
    } else if (firstRaw) {
      matched = rowFirst === firstRaw;
    } else {
      matched = rowLast === lastRaw;
    }

    if (matched) matchingRows.push(r);
  }

  if (matchingRows.length === 0) {
    return corsResponse({ found: false });
  }

  // Deduplicate by group — collect unique groups
  const groupsSeen = {};
  const uniqueMatches = [];
  for (let i = 0; i < matchingRows.length; i++) {
    const r   = matchingRows[i];
    const gId = String(data[r][COL_GROUP]);
    if (!groupsSeen[gId]) {
      groupsSeen[gId] = true;
      uniqueMatches.push({
        name:    String(data[r][COL_NAME] || '').trim(),
        groupId: data[r][COL_GROUP],
      });
    }
  }

  // Multiple groups match — ask user to pick
  if (uniqueMatches.length > 1) {
    return corsResponse({
      found:           true,
      multipleMatches: true,
      matches:         uniqueMatches,
    });
  }

  // Single match — return full group
  return buildGroupResponse(data, uniqueMatches[0].groupId, rsvpSubmittedCol);
}

// ── GET GROUP BY ID ──────────────────────────────────────────
function handleGetGroup(params) {
  const groupId = params.groupId;
  if (!groupId) return corsResponse({ error: 'groupId is required.' });

  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master = ss.getSheetByName(MASTER_SHEET_NAME);
  const data   = master.getDataRange().getValues();
  const headers= data[0];

  let rsvpSubmittedCol = -1;
  for (let c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim() === 'RSVP Submitted') {
      rsvpSubmittedCol = c;
      break;
    }
  }

  return buildGroupResponse(data, groupId, rsvpSubmittedCol);
}

// ── BUILD GROUP RESPONSE (shared helper) ─────────────────────
function buildGroupResponse(data, groupId, rsvpSubmittedCol) {
  const members = [];
  let maxExtra      = 0;
  let alreadyRsvped = false;

  for (let r = 1; r < data.length; r++) {
    if (data[r][COL_GROUP] != groupId) continue;

    const events = [];
    if (data[r][COL_HALDI]   == 1) events.push('haldi');
    if (data[r][COL_SANGEET] == 1) events.push('sangeet');
    if (data[r][COL_LAGAN]   == 1) events.push('lagan');
    if (data[r][COL_CANADA]  == 1) events.push('canadaReception');
    if (data[r][COL_INDIA]   == 1) events.push('indiaReception');

    const extra = parseInt(data[r][COL_EXTRA], 10);
    if (!isNaN(extra) && extra > maxExtra) maxExtra = extra;

    const nameParts = String(data[r][COL_NAME] || '').trim().split(' ');
    members.push({
      firstName: nameParts[0] || '',
      lastName:  nameParts.slice(1).join(' ') || '',
      fullName:  String(data[r][COL_NAME] || '').trim(),
      events:    events,
    });

    if (rsvpSubmittedCol !== -1) {
      if (String(data[r][rsvpSubmittedCol] || '').trim() === 'Yes') {
        alreadyRsvped = true;
      }
    }
  }

  return corsResponse({
    found:                   true,
    groupId:                 groupId,
    members:                 members,
    additionalGuestsAllowed: maxExtra,
    alreadyRsvped:           alreadyRsvped,
  });
}

// ── SUBMIT ───────────────────────────────────────────────────
function handleSubmit(params) {
  const rawData = params.data || '';
  if (!rawData) return corsResponse({ error: 'No data provided.' });

  const payload = JSON.parse(decodeURIComponent(rawData));

  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master = ss.getSheetByName(MASTER_SHEET_NAME);

  // Ensure RSVP Responses sheet exists
  let respSheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  if (!respSheet) {
    respSheet = ss.insertSheet(RESPONSE_SHEET_NAME);
    respSheet.appendRow([
      'Timestamp', 'Group ID', 'Submitted By', 'Email', 'Name', 'Guest Type',
      'Haldi & Devgon', 'Mehndi & Sangeet', 'Baraat & Lagan',
      'Cocktail & Reception', 'India Reception',
    ]);
    respSheet.setFrozenRows(1);
    respSheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  }

  const timestamp   = new Date().toISOString();
  const groupId     = payload.groupId;
  const submittedBy = payload.submittedBy || '';
  const email       = payload.email || '';

  function buildRow(name, guestType, rsvp) {
    return [
      timestamp, groupId, submittedBy, email, name, guestType,
      rsvp['haldi']           || '',
      rsvp['sangeet']         || '',
      rsvp['lagan']           || '',
      rsvp['canadaReception'] || '',
      rsvp['indiaReception']  || '',
    ];
  }

  // Family members
  const members = payload.members || [];
  for (let i = 0; i < members.length; i++) {
    const m    = members[i];
    const name = m.displayName || m.fullName || ((m.firstName + ' ' + m.lastName).trim());
    respSheet.appendRow(buildRow(name, 'Family', m.rsvp || {}));
  }

  // Additional guests (skip blank names)
  const additional = payload.additionalGuests || [];
  for (let i = 0; i < additional.length; i++) {
    const guestName = (additional[i].name || '').trim();
    if (!guestName) continue;
    respSheet.appendRow(buildRow(guestName, 'Additional Guest', additional[i].rsvp || {}));
  }

  // Mark RSVP Submitted in master sheet
  const masterData    = master.getDataRange().getValues();
  const masterHeaders = masterData[0];

  let rsvpCol = -1;
  for (let c = 0; c < masterHeaders.length; c++) {
    if (String(masterHeaders[c]).trim() === 'RSVP Submitted') {
      rsvpCol = c;
      break;
    }
  }
  if (rsvpCol === -1) {
    rsvpCol = masterHeaders.length;
    master.getRange(1, rsvpCol + 1).setValue('RSVP Submitted');
  }

  for (let r = 1; r < masterData.length; r++) {
    if (masterData[r][COL_GROUP] != groupId) continue;
    master.getRange(r + 1, rsvpCol + 1).setValue('Yes');
  }

  return corsResponse({ success: true });
}
