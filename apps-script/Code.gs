// ============================================================
//  Shivani & Akshay Wedding — RSVP Google Apps Script Backend
//  Deploy as: Web App → Execute as Me → Anyone (or Anyone with link)
// ============================================================

const SPREADSHEET_ID      = '1A31Vkz79SiVJ83m7D3BbtB1ZUIcmeFj7cqnmcUxKDS4';
const MASTER_SHEET_NAME   = 'BothLists';
const RESPONSE_SHEET_NAME = 'RSVP Responses';

// Column indices (0-based) matching current sheet layout:
// A(0)  NO
// B(1)  INDIVIDUALS
// C(2)  RELATIONSHIP
// D(3)  GROUP ID
// E(4)  EXTRA PERSONS
// F(5)  MILNI
// G(6)  EMAIL
// H(7)  PHONE NUMBER
// I(8)  SAVE DATE SENT
// J(9)  HALDI
// K(10) SANGEET
// L(11) LAGAN
// M(12) CANADA RECEPTION
// N(13) INDIA RECEPTION
// O(14) ROOMS
// P(15) CANADA ATTENDANCE
// Q(16) INDIA ATTENDANCE
// R(17) SIDE  ← new
// S(18) RSVP Submitted
const COL_NAME    = 1;
const COL_GROUP   = 3;
const COL_EXTRA   = 4;
const COL_HALDI   = 9;
const COL_SANGEET = 10;
const COL_LAGAN   = 11;
const COL_CANADA  = 12;
const COL_INDIA   = 13;
const COL_SIDE    = 17;

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
    if (action === 'lookup')        return handleLookup(e.parameter);
    if (action === 'getGroup')      return handleGetGroup(e.parameter);
    if (action === 'submit')        return handleSubmit(e.parameter);
    if (action === 'submitMessage') return handleSubmitMessage(e.parameter);
    if (action === 'getMessages')   return handleGetMessages();
    return corsResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return corsResponse({ error: err.message });
  }
}

// ── FUZZY MATCH HELPERS ───────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
    for (let j = 1; j <= n; j++) dp[i][j] = i === 0 ? j : 0;
  }
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// Allow 1 edit for short names (≤4 chars), 2 edits for longer names
function fuzzyMatch(search, candidate) {
  if (!search || !candidate) return false;
  if (search === candidate) return true;
  const maxDist = search.length <= 4 ? 1 : 2;
  return levenshtein(search, candidate) <= maxDist;
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
    const cellVal = String(data[r][COL_NAME] || '').trim();
    if (!cellVal) continue;

    const nameLower = cellVal.toLowerCase();
    const parts     = nameLower.split(' ');
    const rowFirst  = parts[0] || '';
    const rowLast   = parts.slice(1).join(' ');

    let matched = false;

    if (firstRaw && lastRaw) {
      // Both fields filled — exact first name, fuzzy last name
      matched = (rowFirst === firstRaw && fuzzyMatch(lastRaw, rowLast));
    } else {
      // Only one field — fuzzy match against first name, last name, or full name
      const term = firstRaw ? firstRaw : lastRaw;
      matched = (rowFirst === term || rowLast === term || nameLower === term ||
                 fuzzyMatch(term, rowFirst) || fuzzyMatch(term, rowLast));
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
      side:      String(data[r][COL_SIDE] || '').trim(),
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
      'Cocktail & Reception', 'India Reception', 'Side',
    ]);
    respSheet.setFrozenRows(1);
    respSheet.getRange(1, 1, 1, 12).setFontWeight('bold');
  }

  const timestamp   = new Date().toISOString();
  const groupId     = payload.groupId;
  const submittedBy = payload.submittedBy || '';
  const email       = payload.email || '';

  function buildRow(name, guestType, side, rsvp) {
    return [
      timestamp, groupId, submittedBy, email, name, guestType,
      rsvp['haldi']           || '',
      rsvp['sangeet']         || '',
      rsvp['lagan']           || '',
      rsvp['canadaReception'] || '',
      rsvp['indiaReception']  || '',
      side,
    ];
  }

  // Family members
  const members = payload.members || [];
  for (let i = 0; i < members.length; i++) {
    const m    = members[i];
    const name = m.displayName || m.fullName || ((m.firstName + ' ' + m.lastName).trim());
    respSheet.appendRow(buildRow(name, 'Family', m.side || '', m.rsvp || {}));
  }

  // Additional guests (skip blank names) — inherit side from the first member
  const groupSide  = members.length > 0 ? (members[0].side || '') : '';
  const additional = payload.additionalGuests || [];
  for (let i = 0; i < additional.length; i++) {
    const guestName = (additional[i].name || '').trim();
    if (!guestName) continue;
    respSheet.appendRow(buildRow(guestName, 'Additional Guest', groupSide, additional[i].rsvp || {}));
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

  // Send confirmation email if an address was provided
  if (email) {
    try {
      sendConfirmationEmail(email, submittedBy, members, additional);
    } catch(emailErr) {
      // Email failed but RSVP was saved — don't surface this to the user
    }
  }

  return corsResponse({ success: true });
}

// ── EMAIL CONFIRMATION ────────────────────────────────────────
function sendConfirmationEmail(email, submittedBy, members, additional) {
  members    = members    || [];
  additional = additional || [];
  const EVENT_LABELS = {
    haldi:           { name: 'Haldi & Devgon',           date: 'August 21' },
    sangeet:         { name: 'Mehndi & Sangeet Night',   date: 'August 21, Evening' },
    lagan:           { name: 'Baraat & Lagan Ceremony',  date: 'August 22' },
    canadaReception: { name: 'Cocktail & Reception',     date: 'August 22, Evening' },
    indiaReception:  { name: 'India Reception',          date: 'October 2026, Delhi' },
  };

  function personBlock(name, rsvp, isGuest) {
    const keys = Object.keys(EVENT_LABELS).filter(k => rsvp[k]);
    if (!keys.length) return '';
    const label = isGuest
      ? name + ' &nbsp;<span style="font-size:0.78em;color:#9a8070;font-style:italic;">(Additional Guest)</span>'
      : name;
    const rows = keys.map(k => {
      const attending = rsvp[k] === 'Yes';
      return '<tr>'
        + '<td style="padding:10px 16px 10px 0;border-bottom:1px solid #f0e8df;font-family:Georgia,serif;font-size:15px;color:#5a4a42;">'
        +   EVENT_LABELS[k].name
        +   '<div style="font-size:11px;letter-spacing:0.1em;color:#c9a84c;margin-top:2px;text-transform:uppercase;">' + EVENT_LABELS[k].date + '</div>'
        + '</td>'
        + '<td style="padding:10px 0;border-bottom:1px solid #f0e8df;text-align:right;white-space:nowrap;">'
        +   '<span style="display:inline-block;padding:3px 12px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-family:Arial,sans-serif;border-radius:2px;'
        +   (attending
            ? 'background:#8B1A2B;color:#fff;'
            : 'background:#f0e8df;color:#9a8070;')
        +   '">' + (attending ? '✓ &nbsp;Attending' : '✗ &nbsp;Unable to attend') + '</span>'
        + '</td>'
        + '</tr>';
    }).join('');
    return '<div style="margin-bottom:1.5rem;">'
      + '<div style="font-family:Georgia,serif;font-size:18px;color:#8B1A2B;font-weight:600;margin-bottom:0.6rem;padding-bottom:0.5rem;border-bottom:2px solid #c9a84c;">' + label + '</div>'
      + '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>'
      + '</div>';
  }

  let allBlocks = '';
  for (let i = 0; i < members.length; i++) {
    const m    = members[i];
    const name = m.displayName || m.fullName || ((m.firstName + ' ' + m.lastName).trim());
    allBlocks += personBlock(name, m.rsvp || {}, false);
  }
  for (let i = 0; i < additional.length; i++) {
    const guestName = (additional[i].name || '').trim();
    if (!guestName) continue;
    allBlocks += personBlock(guestName, additional[i].rsvp || {}, true);
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Great+Vibes&display=swap');
</style>
</head>
<body style="margin:0;padding:0;background:#f5ede4;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede4;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fffaf5;border:1px solid #e8d9cc;">

  <!-- HEADER -->
  <tr>
    <td style="background:#6b1220;background-image:linear-gradient(rgba(60,6,14,0.72),rgba(60,6,14,0.72)),url('https://shv592.github.io/ASwedding/images/gate-bg.png');background-size:cover;background-position:center;padding:52px 40px 44px;text-align:center;">
      <div style="width:100px;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:0 auto 22px;"></div>
      <div style="font-family:'Great Vibes',Georgia,serif;font-size:56px;color:#e4c97e;line-height:1.1;margin-bottom:8px;">Shivani &amp; Akshay</div>
      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.45em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:22px;">August 21 &ndash; 22, 2026 &middot; Vaughan, Ontario</div>
      <div style="width:100px;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:0 auto;"></div>
    </td>
  </tr>

  <!-- EYEBROW -->
  <tr>
    <td style="background:#8B1A2B;padding:10px 40px;text-align:center;">
      <span style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.4em;text-transform:uppercase;color:#e4c97e;">RSVP Confirmation</span>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:40px 40px 32px;">
      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:18px;color:#5a4a42;line-height:1.8;margin:0 0 12px;">Dear ${submittedBy},</p>
      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:16px;color:#5a4a42;line-height:1.9;margin:0 0 28px;">
        Thank you so much for your RSVP — we are overjoyed to be sharing these moments with you! Below is a summary of the responses we received for your party.
      </p>

      <!-- DIVIDER -->
      <div style="width:40px;height:1px;background:#c9a84c;margin-bottom:28px;"></div>

      <!-- RSVP SUMMARY -->
      ${allBlocks}

      <!-- DIVIDER -->
      <div style="width:100%;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:28px 0;"></div>

      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:15px;color:#5a4a42;line-height:1.9;margin:0 0 12px;">
        If anything looks incorrect or you need to make changes, simply reply to this email or reach us at
        <a href="mailto:shivani.akshaypathak@hotmail.com" style="color:#8B1A2B;text-decoration:none;border-bottom:1px solid rgba(139,26,43,0.3);">shivani.akshaypathak@hotmail.com</a>.
      </p>
      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:15px;color:#5a4a42;line-height:1.9;margin:0;">
        We cannot wait to celebrate with you. See you soon!
      </p>
      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:16px;color:#5a4a42;margin:24px 0 4px;">With love,</p>
      <p style="font-family:'Great Vibes',Georgia,serif;font-size:32px;color:#8B1A2B;margin:0;">Shivani &amp; Akshay</p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#5c0e1a;padding:24px 40px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;color:rgba(255,255,255,0.3);">Vaughan, Ontario &middot; August 2026</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  MailApp.sendEmail({
    to:       email,
    replyTo:  'shivani.akshaypathak@hotmail.com',
    subject:  'Your RSVP is confirmed \u2014 Shivani & Akshay, August 2026',
    htmlBody: html,
    name:     'Shivani and Akshay',
  });
}

// ── SUBMIT MESSAGE ────────────────────────────────────────────
function handleSubmitMessage(params) {
  const rawData = params.data || '';
  if (!rawData) return corsResponse({ error: 'No data provided.' });

  const payload = JSON.parse(decodeURIComponent(rawData));
  const message = (payload.message || '').trim();
  if (!message) return corsResponse({ error: 'Message is empty.' });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Messages');
  if (!sheet) {
    sheet = ss.insertSheet('Messages');
    sheet.appendRow(['Timestamp', 'Name', 'Message']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }

  sheet.appendRow([
    new Date().toISOString(),
    (payload.name || '').trim() || 'Anonymous',
    message,
  ]);

  return corsResponse({ success: true });
}

// ── GET MESSAGES ──────────────────────────────────────────────
function handleGetMessages() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Messages');
  if (!sheet) return corsResponse({ messages: [] });

  const data     = sheet.getDataRange().getValues();
  const messages = [];
  for (let r = 1; r < data.length; r++) {
    const msg = String(data[r][2] || '').trim();
    if (msg) {
      messages.push({
        name:    String(data[r][1] || 'Anonymous').trim(),
        message: msg,
      });
    }
  }
  return corsResponse({ messages });
}
