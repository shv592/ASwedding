// ============================================================
//  Shivani & Akshay Wedding — Contact Form Google Apps Script
//  Deploy as: Web App → Execute as Me → Anyone
// ============================================================

const SPREADSHEET_ID = '1cvRdHdkQrd70lNqERnjcT3o_Azs1sQj8Y5S14rS5pC4';

function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = (e.parameter.action || '');
    if (action === 'contact') return handleContact(e.parameter);
    return corsResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return corsResponse({ error: err.message });
  }
}

function handleContact(params) {
  const rawData = params.data || '';
  if (!rawData) return corsResponse({ error: 'No data provided.' });

  const payload  = JSON.parse(decodeURIComponent(rawData));
  const name     = (payload.name     || '').trim();
  const phone    = (payload.phone    || '').trim();
  const email    = (payload.email    || '').trim();
  const street   = (payload.street   || '').trim();
  const city     = (payload.city     || '').trim();
  const country  = (payload.country  || '').trim();
  const postcode = (payload.postcode || '').trim();

  if (!name) return corsResponse({ error: 'Name is required.' });

  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0]; // Sheet1

  sheet.appendRow([name, phone, email, street, city, country, postcode]);

  return corsResponse({ success: true });
}
