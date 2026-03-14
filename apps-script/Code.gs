// ============================================================
//  Shivani & Akshay Wedding — RSVP Google Apps Script Backend
//  Deploy as: Web App → Execute as Me → Anyone (or Anyone with link)
// ============================================================

const SPREADSHEET_ID      = 'YOUR_SPREADSHEET_ID_HERE';
const MASTER_SHEET_NAME   = 'MASTER SHEET';
const RESPONSE_SHEET_NAME = 'RSVP Responses';
const EVENT_TAGS          = ['haldi', 'sangeet', 'lagan', 'canadaReception', 'indiaReception'];

// Maps event tag → display column header
const EVENT_DISPLAY = {
  haldi:            'Haldi & Devgon',
  sangeet:          'Mehndi & Sangeet',
  lagan:            'Baraat & Lagan',
  canadaReception:  'Cocktail & Reception',
  indiaReception:   'India Reception',
};

// ── CORS helper ──────────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script automatically adds CORS headers when deployed
  // as a web app with "Anyone" access. No manual header manipulation needed.
}

// ── Entry point ──────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || '';

    if (action === 'lookup') {
      return handleLookup(e.parameter);
    }

    if (action === 'submit') {
      return handleSubmit(e.parameter);
    }

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

  const ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master      = ss.getSheetByName(MASTER_SHEET_NAME);
  const data        = master.getDataRange().getValues();
  const headers     = data[0];

  // Locate columns (0-indexed)
  const COL_TITLE   = 0; // A
  const COL_FIRST   = 1; // B
  const COL_LAST    = 2; // C
  const COL_EMAIL   = 3; // D
  const COL_GROUP   = 4; // E
  const COL_ADDL    = 5; // F
  const COL_TAGS    = 6; // G

  // Find "RSVP Submitted" column if it exists
  let rsvpSubmittedCol = -1;
  for (let c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim() === 'RSVP Submitted') {
      rsvpSubmittedCol = c;
      break;
    }
  }

  // Find the matching row (case-insensitive)
  let matchedRow = null;
  for (let r = 1; r < data.length; r++) {
    const fn = String(data[r][COL_FIRST] || '').trim().toLowerCase();
    const ln = String(data[r][COL_LAST]  || '').trim().toLowerCase();
    if (fn === firstRaw && ln === lastRaw) {
      matchedRow = r;
      break;
    }
  }

  if (matchedRow === null) {
    return corsResponse({ found: false });
  }

  const groupId = data[matchedRow][COL_GROUP];

  // Collect all rows with the same GROUP ID
  const members = [];
  let maxAdditionalGuests = 0;
  let alreadyRsvped = false;

  for (let r = 1; r < data.length; r++) {
    if (data[r][COL_GROUP] != groupId) continue; // loose equality handles number/string mix

    const rawTags = String(data[r][COL_TAGS] || '');
    const allTags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
    const events  = allTags.filter(t => EVENT_TAGS.indexOf(t) !== -1);

    const addlRaw = parseInt(data[r][COL_ADDL], 10);
    const addl    = isNaN(addlRaw) ? 0 : addlRaw;
    if (addl > maxAdditionalGuests) maxAdditionalGuests = addl;

    members.push({
      firstName:       String(data[r][COL_FIRST] || '').trim(),
      lastName:        String(data[r][COL_LAST]  || '').trim(),
      title:           String(data[r][COL_TITLE] || '').trim(),
      events:          events,
      additionalGuests: addl,
    });

    // Check RSVP Submitted flag for any member in the group
    if (rsvpSubmittedCol !== -1) {
      const flag = String(data[r][rsvpSubmittedCol] || '').trim();
      if (flag === 'Yes') alreadyRsvped = true;
    }
  }

  return corsResponse({
    found:                   true,
    groupId:                 groupId,
    members:                 members,
    additionalGuestsAllowed: maxAdditionalGuests,
    alreadyRsvped:           alreadyRsvped,
  });
}

// ── SUBMIT ───────────────────────────────────────────────────
function handleSubmit(params) {
  const rawData = params.data || '';
  if (!rawData) {
    return corsResponse({ error: 'No data provided.' });
  }

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
    // Freeze header row
    respSheet.setFrozenRows(1);
  }

  const timestamp   = new Date().toISOString();
  const groupId     = payload.groupId;
  const submittedBy = payload.submittedBy || '';

  // Helper: build a response row from a name + rsvp object
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

  // ── Append rows for family members ───────────────────────
  const members = payload.members || [];
  for (let i = 0; i < members.length; i++) {
    const m    = members[i];
    const name = (m.firstName + ' ' + m.lastName).trim();
    respSheet.appendRow(buildRow(name, 'Family', m.rsvp || {}));
  }

  // ── Append rows for additional guests ────────────────────
  const additional = payload.additionalGuests || [];
  for (let i = 0; i < additional.length; i++) {
    const g = additional[i];
    const guestName = (g.name || '').trim();
    if (!guestName) continue; // skip blank guest slots
    respSheet.appendRow(buildRow(guestName, 'Additional Guest', g.rsvp || {}));
  }

  // ── Mark RSVP Submitted in MASTER SHEET ──────────────────
  const masterData = master.getDataRange().getValues();
  const masterHeaders = masterData[0];

  // Find or create "RSVP Submitted" column
  let rsvpCol = -1;
  for (let c = 0; c < masterHeaders.length; c++) {
    if (String(masterHeaders[c]).trim() === 'RSVP Submitted') {
      rsvpCol = c;
      break;
    }
  }
  if (rsvpCol === -1) {
    // Create it in the next empty column
    rsvpCol = masterHeaders.length;
    master.getRange(1, rsvpCol + 1).setValue('RSVP Submitted');
  }

  // Set "Yes" for all rows in this group
  for (let r = 1; r < masterData.length; r++) {
    if (masterData[r][4] != groupId) continue; // col E = index 4
    master.getRange(r + 1, rsvpCol + 1).setValue('Yes');
  }

  return corsResponse({ success: true });
}
