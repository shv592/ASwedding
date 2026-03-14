// ============================================================
//  Shivani & Akshay Wedding — RSVP Google Apps Script Backend
//  Deploy as: Web App → Execute as Me → Anyone (or Anyone with link)
// ============================================================

const SPREADSHEET_ID      = 'YOUR_SPREADSHEET_ID_HERE';
const MASTER_SHEET_NAME   = 'Sheet1';
const RESPONSE_SHEET_NAME = 'RSVP Responses';

// Column indices (0-based) — matches the Formatted Brides List layout
// A=0  B=1        C=2            D=3        E=4           F=5     G=6       H=7
// No   INDIVIDUAL RELATIONSHIP   GROUP ID   Extra Person  MILNI   PHONE NO  SAVE DATE
// I=8   J=9      K=10   L=11             M=12
// HALDI SANGEET  LAGAN  CANADA RECEPTION INDIA RECEPTION
const COL_NAME   = 1;
const COL_GROUP  = 3;
const COL_EXTRA  = 4;
const COL_HALDI  = 8;
const COL_SANGEET= 9;
const COL_LAGAN  = 10;
const COL_CANADA = 11;
const COL_INDIA  = 12;

// Event key → response sheet column header
const EVENT_DISPLAY = {
  haldi:            'Haldi & Devgon',
  sangeet:          'Mehndi & Sangeet',
  lagan:            'Baraat & Lagan',
  canadaReception:  'Cocktail & Reception',
  indiaReception:   'India Reception',
};

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
    if (action === 'lookup') return handleLookup(e.parameter);
    if (action === 'submit') return handleSubmit(e.parameter);
    return corsResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return corsResponse({ error: err.message });
  }
}

// ── LOOKUP ───────────────────────────────────────────────────
function handleLookup(params) {
  const firstRaw = (params.first || '').trim().toLowerCase();
  const lastRaw  = (params.last  || '').trim().toLowerCase();

  if (!firstRaw || !lastRaw) {
    return corsResponse({ error: 'First and last name are required.' });
  }

  const fullName = (firstRaw + ' ' + lastRaw).toLowerCase();

  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master  = ss.getSheetByName(MASTER_SHEET_NAME);
  const data    = master.getDataRange().getValues();
  const headers = data[0];

  // Find "RSVP Submitted" column if it already exists
  let rsvpSubmittedCol = -1;
  for (let c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim() === 'RSVP Submitted') {
      rsvpSubmittedCol = c;
      break;
    }
  }

  // Find the row whose INDIVIDUAL column matches the entered name
  let matchedRow = null;
  for (let r = 1; r < data.length; r++) {
    const rowName = String(data[r][COL_NAME] || '').trim().toLowerCase();
    if (rowName === fullName) {
      matchedRow = r;
      break;
    }
  }

  if (matchedRow === null) {
    return corsResponse({ found: false });
  }

  const groupId = data[matchedRow][COL_GROUP];

  // Collect all rows in the same group
  const members = [];
  let maxExtra   = 0;
  let alreadyRsvped = false;

  for (let r = 1; r < data.length; r++) {
    if (data[r][COL_GROUP] != groupId) continue; // loose == handles number/string mix

    // Build events list from individual boolean columns
    const events = [];
    if (data[r][COL_HALDI]   == 1) events.push('haldi');
    if (data[r][COL_SANGEET] == 1) events.push('sangeet');
    if (data[r][COL_LAGAN]   == 1) events.push('lagan');
    if (data[r][COL_CANADA]  == 1) events.push('canadaReception');
    if (data[r][COL_INDIA]   == 1) events.push('indiaReception');

    const extra = parseInt(data[r][COL_EXTRA], 10);
    if (!isNaN(extra) && extra > maxExtra) maxExtra = extra;

    // Split the full name into first / last for the frontend
    const nameParts = String(data[r][COL_NAME] || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || '';

    members.push({
      firstName: firstName,
      lastName:  lastName,
      fullName:  String(data[r][COL_NAME] || '').trim(),
      events:    events,
    });

    // Check if already submitted
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
  // payload: { groupId, submittedBy, members: [...], additionalGuests: [...] }

  const ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master = ss.getSheetByName(MASTER_SHEET_NAME);

  // ── Ensure RSVP Responses sheet exists with headers ──────
  let respSheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  if (!respSheet) {
    respSheet = ss.insertSheet(RESPONSE_SHEET_NAME);
    respSheet.appendRow([
      'Timestamp',
      'Group ID',
      'Submitted By',
      'Name',
      'Guest Type',
      'Haldi & Devgon',
      'Mehndi & Sangeet',
      'Baraat & Lagan',
      'Cocktail & Reception',
      'India Reception',
    ]);
    respSheet.setFrozenRows(1);
    respSheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }

  const timestamp   = new Date().toISOString();
  const groupId     = payload.groupId;
  const submittedBy = payload.submittedBy || '';

  function buildRow(name, guestType, rsvp) {
    return [
      timestamp,
      groupId,
      submittedBy,
      name,
      guestType,
      rsvp['haldi']           || '',
      rsvp['sangeet']         || '',
      rsvp['lagan']           || '',
      rsvp['canadaReception'] || '',
      rsvp['indiaReception']  || '',
    ];
  }

  // Append family members
  const members = payload.members || [];
  for (let i = 0; i < members.length; i++) {
    const m    = members[i];
    const name = m.fullName || ((m.firstName + ' ' + m.lastName).trim());
    respSheet.appendRow(buildRow(name, 'Family', m.rsvp || {}));
  }

  // Append additional guests (skip blank names)
  const additional = payload.additionalGuests || [];
  for (let i = 0; i < additional.length; i++) {
    const guestName = (additional[i].name || '').trim();
    if (!guestName) continue;
    respSheet.appendRow(buildRow(guestName, 'Additional Guest', additional[i].rsvp || {}));
  }

  // ── Mark RSVP Submitted in MASTER SHEET ──────────────────
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
