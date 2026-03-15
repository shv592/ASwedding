// ============================================================
//  RSVP Page JavaScript
// ============================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyWGnHQ9fE8tRoLolgLiuykcAC9IholKxzBrjJUidkUtIgFTYImMBKKMHqArN01oHk/exec';

// RSVP deadline check
const RSVP_DEADLINE = new Date('2026-04-15T23:59:59');

// Event metadata: tag → { name, date }
const EVENT_META = {
  haldi:           { name: 'Haldi & Devgon',          date: 'August 21' },
  sangeet:         { name: 'Mehndi & Sangeet Night',  date: 'August 21, Evening' },
  lagan:           { name: 'Baraat & Lagan Ceremony', date: 'August 22' },
  canadaReception: { name: 'Cocktail & Reception',    date: 'August 22, Evening' },
  indiaReception:  { name: 'India Reception',         date: 'October 24, Delhi' },
};

// Store fetched group data for submission
let _groupData = null;
// Cache group data fetched during match preview so selectMatch never re-fetches
let _groupCache = {};
// Name to show in the welcome heading (what the user searched)
let _pendingWelcomeName = '';

// ── showAlreadyRsvped ─────────────────────────────────────────
function showAlreadyRsvped() {
  showStep('step-search');
  var prior = document.getElementById('already-notice-el');
  if (prior) prior.remove();
  var notice = document.createElement('div');
  notice.className = 'already-notice';
  notice.id = 'already-notice-el';
  notice.innerHTML = '<p>It looks like your group has already RSVP\u2019d \u2014 thank you! If you need to make any changes to your response, please email us at <a href="mailto:shivani.akshaypathak@hotmail.com" style="color:var(--crimson)">shivani.akshaypathak@hotmail.com</a> and we\u2019ll sort it out.</p>';
  document.getElementById('open-state').appendChild(notice);
}

// ── buildEventRow ─────────────────────────────────────────────
function buildEventRow(tag, idx, type) {
  var meta = EVENT_META[tag];
  if (!meta) return null;
  var row = document.createElement('div');
  row.className = 'event-row';
  var labelWrap = document.createElement('div');
  labelWrap.className = 'event-label-wrap';
  var labelName = document.createElement('div');
  labelName.className = 'event-label-name';
  labelName.textContent = meta.name;
  var labelDate = document.createElement('div');
  labelDate.className = 'event-label-date';
  labelDate.textContent = meta.date;
  labelWrap.appendChild(labelName);
  labelWrap.appendChild(labelDate);
  var toggleGroup = document.createElement('div');
  toggleGroup.className = 'toggle-group';
  toggleGroup.dataset.tag = tag;
  toggleGroup.dataset.type = type;
  if (type === 'member') { toggleGroup.dataset.memberIdx = idx; }
  else                   { toggleGroup.dataset.guestIdx  = idx; }
  toggleGroup.appendChild(createToggleBtn('Yes', true));
  toggleGroup.appendChild(createToggleBtn('No',  false));
  row.appendChild(labelWrap);
  row.appendChild(toggleGroup);
  return row;
}

// ── collectRsvp ───────────────────────────────────────────────
function collectRsvp(type, idx) {
  var attr = type === 'member' ? 'data-member-idx' : 'data-guest-idx';
  var rsvp = {};
  document.querySelectorAll('.toggle-group[data-type="' + type + '"][' + attr + '="' + idx + '"]').forEach(function(group) {
    var active = group.querySelector('.toggle-btn.active, .toggle-btn.active-no');
    rsvp[group.dataset.tag] = active ? active.dataset.value : 'Yes';
  });
  return rsvp;
}

// ── On page load: check deadline ────────────────────────────
(function checkDeadline() {
  const now = new Date();
  if (now > RSVP_DEADLINE) {
    document.getElementById('open-state').style.display   = 'none';
    document.getElementById('closed-state').style.display = 'block';
  }
})();

// ── showStep ─────────────────────────────────────────────────
function showStep(id) {
  var current = document.querySelector('.rsvp-step.active');
  var next    = document.getElementById(id);
  if (!next || current === next) return;

  if (current) {
    current.classList.add('leaving');
    setTimeout(function() {
      current.classList.remove('active', 'leaving');
      next.classList.add('active');
    }, 220);
  } else {
    next.classList.add('active');
  }
}

// ── searchGuest ──────────────────────────────────────────────
function searchGuest(e) {
  if (e) e.preventDefault();

  const firstName = (document.getElementById('inp-first').value || '').trim();
  const lastName  = (document.getElementById('inp-last').value  || '').trim();
  const errorEl   = document.getElementById('search-error');
  const btn       = document.getElementById('search-btn');

  errorEl.textContent = '';

  if (!firstName && !lastName) {
    errorEl.textContent = 'Please enter at least your first or last name.';
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;

  const url = APPS_SCRIPT_URL
    + '?action=lookup'
    + '&first=' + encodeURIComponent(firstName)
    + '&last='  + encodeURIComponent(lastName);

  fetch(url, { credentials: 'omit' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.classList.remove('loading');
      btn.disabled = false;

      if (data.error) {
        errorEl.textContent = 'Something went wrong. Please try again.';
        return;
      }

      if (!data.found) {
        errorEl.textContent = 'We couldn\u2019t find your name on the guest list. Please double-check the spelling and try again.';
        return;
      }

      if (data.multipleMatches) {
        buildMatchSelection(data.matches);
        showStep('step-select');
        return;
      }

      if (data.alreadyRsvped) {
        errorEl.innerHTML = '';
        showAlreadyRsvped();
        return;
      }

      // Remove any prior "already RSVP'd" notice if they searched again
      var prior = document.getElementById('already-notice-el');
      if (prior) prior.remove();

      // Store data and show "Is this you?" confirmation before the form
      _groupData = data;
      // Find the member whose name best matches the search inputs so we always
      // show the full name (first + last) regardless of what the user typed.
      var searchTerm = (firstName + ' ' + lastName).trim().toLowerCase();
      var matched = data.members.find(function(m) {
        var full = (m.firstName + ' ' + m.lastName).trim().toLowerCase();
        return full === searchTerm
          || m.firstName.toLowerCase() === searchTerm
          || m.lastName.toLowerCase() === searchTerm;
      }) || data.members[0];
      _pendingWelcomeName = (matched.firstName + ' ' + matched.lastName).trim();
      showVerifyStep(data);
    })
    .catch(function() {
      btn.classList.remove('loading');
      btn.disabled = false;
      errorEl.textContent = 'Network error. Please check your connection and try again.';
    });
}

// Allow pressing Enter in the name inputs to trigger search
document.getElementById('inp-first').addEventListener('keydown', function(e) { if (e.key === 'Enter') searchGuest(e); });
document.getElementById('inp-last').addEventListener('keydown',  function(e) { if (e.key === 'Enter') searchGuest(e); });

// ── showVerifyStep ───────────────────────────────────────────
function showVerifyStep(data) {
  var container = document.getElementById('verify-names');
  container.innerHTML = '';
  data.members.forEach(function(m) {
    var el = document.createElement('div');
    el.className = 'verify-name-item';
    el.textContent = m.firstName + ' ' + m.lastName;
    container.appendChild(el);
  });
  showStep('step-verify');
}

// ── confirmIdentity ──────────────────────────────────────────
function confirmIdentity(yes) {
  if (yes) {
    buildForm(_pendingWelcomeName, _groupData);
    showStep('step-form');
  } else {
    showStep('step-search');
    var errorEl = document.getElementById('search-error');
    errorEl.textContent = 'No problem — please try searching with a different name or spelling.';
  }
}

// ── buildMatchSelection ──────────────────────────────────────
function buildMatchSelection(matches) {
  var container = document.getElementById('matches-container');
  container.innerHTML = '';
  matches.forEach(function(match) {
    var btn = document.createElement('button');
    btn.className = 'match-btn';
    btn.style.animationDelay = (matches.indexOf(match) * 80) + 'ms';

    var nameDiv = document.createElement('div');
    nameDiv.style.fontWeight = '600';
    nameDiv.textContent = match.name;

    var familyDiv = document.createElement('div');
    familyDiv.style.fontSize = '0.88rem';
    familyDiv.style.color = 'var(--text-mid)';
    familyDiv.style.marginTop = '0.3rem';
    familyDiv.style.fontStyle = 'italic';
    familyDiv.textContent = 'Loading group\u2026';

    btn.appendChild(nameDiv);
    btn.appendChild(familyDiv);
    btn.onclick = function() { selectMatch(match.groupId, match.name); };
    container.appendChild(btn);

    // Fetch this group's members so the user can tell which entry is theirs.
    // Cache the result so selectMatch never needs to re-fetch the same group.
    fetch(APPS_SCRIPT_URL + '?action=getGroup&groupId=' + encodeURIComponent(match.groupId), { credentials: 'omit' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _groupCache[match.groupId] = data;
        if (data.members && data.members.length > 0) {
          var names = data.members.map(function(m) { return m.firstName + ' ' + m.lastName; });
          familyDiv.textContent = 'Party: ' + names.join(', ');
        } else {
          familyDiv.textContent = '';
        }
      })
      .catch(function() { familyDiv.textContent = ''; });
  });
}

// ── selectMatch ──────────────────────────────────────────────
function selectMatch(groupId, clickedName) {
  function handleGroup(data) {
    if (data.alreadyRsvped) { showAlreadyRsvped(); return; }
    _groupData = data;
    _pendingWelcomeName = clickedName || (data.members[0].firstName + ' ' + data.members[0].lastName).trim();
    buildForm(_pendingWelcomeName, data);
    showStep('step-form');
  }

  fetch(APPS_SCRIPT_URL + '?action=getGroup&groupId=' + encodeURIComponent(groupId), { credentials: 'omit' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _groupCache[groupId] = data;
      handleGroup(data);
    })
    .catch(function() { alert('Network error. Please try again.'); });
}

// ── buildForm ────────────────────────────────────────────────
function buildForm(firstName, data) {
  // Update welcome heading
  document.getElementById('form-welcome').textContent = 'Welcome, ' + firstName + '!';

  // Build member cards
  var membersContainer = document.getElementById('members-container');
  membersContainer.innerHTML = '';

  data.members.forEach(function(member, idx) {
    var card = document.createElement('div');
    card.className = 'member-card';
    card.style.animationDelay = (idx * 90) + 'ms';

    var nameLabel = document.createElement('span');
    nameLabel.className = 'member-name-label';
    nameLabel.textContent = 'Name (edit if misspelled)';
    card.appendChild(nameLabel);

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'member-name-input';
    nameInput.value = member.firstName + ' ' + member.lastName;
    nameInput.dataset.memberIdx = idx;
    card.appendChild(nameInput);

    // One event row per invited event
    member.events.forEach(function(tag) {
      var row = buildEventRow(tag, idx, 'member');
      if (row) card.appendChild(row);
    });

    membersContainer.appendChild(card);
  });

  // Build additional guests section
  var addlContainer = document.getElementById('addl-container');
  addlContainer.innerHTML = '';

  var allowed = data.additionalGuestsAllowed || 0;
  if (allowed > 0) {
    // Determine which events the group can attend (union of all member events)
    var groupEvents = [];
    data.members.forEach(function(m) {
      m.events.forEach(function(tag) {
        if (groupEvents.indexOf(tag) === -1) groupEvents.push(tag);
      });
    });

    var section = document.createElement('div');
    section.className = 'addl-section';

    var addlHead = document.createElement('div');
    addlHead.className = 'addl-head';
    addlHead.textContent = 'Additional Guests';

    var addlNote = document.createElement('p');
    addlNote.className = 'addl-note';
    addlNote.textContent = 'You may bring up to ' + allowed + ' additional guest' + (allowed === 1 ? '' : 's') + '.';

    section.appendChild(addlHead);
    section.appendChild(addlNote);

    for (var g = 0; g < allowed; g++) {
      var gCard = document.createElement('div');
      gCard.className = 'addl-guest-card';

      var gNum = document.createElement('div');
      gNum.className = 'addl-guest-num';
      gNum.textContent = 'Guest ' + (g + 1);

      var gInput = document.createElement('input');
      gInput.type = 'text';
      gInput.className = 'addl-name-input';
      gInput.placeholder = 'Guest Name (optional)';
      gInput.dataset.guestIdx = g;

      gCard.appendChild(gNum);
      gCard.appendChild(gInput);

      // Event rows for additional guests (same events as group)
      groupEvents.forEach(function(tag) {
        var row = buildEventRow(tag, g, 'guest');
        if (row) gCard.appendChild(row);
      });

      section.appendChild(gCard);
    }

    addlContainer.appendChild(section);
  }
}

// ── createToggleBtn ──────────────────────────────────────────
function createToggleBtn(label, isYes) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = 'toggle-btn' + (isYes ? ' active' : ''); // YES starts active
  btn.dataset.value = label;
  btn.addEventListener('click', function() { selectToggle(btn); });
  return btn;
}

// ── selectToggle ─────────────────────────────────────────────
function selectToggle(btn) {
  var group = btn.closest('.toggle-group');
  var btns  = group.querySelectorAll('.toggle-btn');

  btns.forEach(function(b) {
    b.classList.remove('active', 'active-no');
  });

  btn.classList.add(btn.dataset.value === 'Yes' ? 'active' : 'active-no');
}

// ── collectAndSubmit ─────────────────────────────────────────
function collectAndSubmit() {
  if (!_groupData) return;

  var submitBtn = document.getElementById('submit-btn');
  submitBtn.textContent = 'Submitting\u2026';
  submitBtn.disabled = true;

  // Collect member RSVPs
  var membersOut = _groupData.members.map(function(member, idx) {
    var rsvp = collectRsvp('member', idx);
    var nameInput = document.querySelector('.member-name-input[data-member-idx="' + idx + '"]');
    var displayName = nameInput ? nameInput.value.trim() : (member.firstName + ' ' + member.lastName);
    return {
      firstName:   member.firstName,
      lastName:    member.lastName,
      fullName:    member.fullName,
      displayName: displayName,
      rsvp:        rsvp,
    };
  });

  // Collect the name of the person who submitted (first listed member)
  var submittedBy = (_groupData.members[0].firstName + ' ' + _groupData.members[0].lastName).trim();

  // Collect additional guests
  var additionalOut = [];
  var allowed = _groupData.additionalGuestsAllowed || 0;
  for (var g = 0; g < allowed; g++) {
    var nameInput = document.querySelector('.addl-name-input[data-guest-idx="' + g + '"]');
    var guestName = nameInput ? nameInput.value.trim() : '';

    additionalOut.push({ name: guestName, rsvp: collectRsvp('guest', g) });
  }

  var emailInput = document.getElementById('inp-email');
  var email = emailInput ? emailInput.value.trim() : '';

  var payload = {
    groupId:          _groupData.groupId,
    submittedBy:      submittedBy,
    email:            email,
    members:          membersOut,
    additionalGuests: additionalOut,
  };

  var url = APPS_SCRIPT_URL + '?action=submit&data=' + encodeURIComponent(JSON.stringify(payload));

  fetch(url, { credentials: 'omit' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        if (checkAllDeclined()) {
          // Pre-fill name from submitted RSVP
          var prefill = _groupData && _groupData.members.length
            ? (_groupData.members[0].firstName + ' ' + _groupData.members[0].lastName).trim()
            : '';
          document.getElementById('rsvp-msg-name').value = prefill;
          showStep('step-message');
        } else {
          showStep('step-confirm');
        }
      } else {
        submitBtn.textContent = 'Submit RSVP';
        submitBtn.disabled    = false;
        alert('There was an error submitting your RSVP: ' + (data.error || 'Unknown error') + '. Please try again or contact us.');
      }
    })
    .catch(function() {
      submitBtn.textContent = 'Submit RSVP';
      submitBtn.disabled    = false;
      alert('Network error. Please check your connection and try again.');
    });
}

// ── checkAllDeclined ─────────────────────────────────────────
function checkAllDeclined() {
  var groups = document.querySelectorAll('.toggle-group[data-type="member"]');
  if (!groups.length) return false;
  for (var i = 0; i < groups.length; i++) {
    var active = groups[i].querySelector('.toggle-btn.active, .toggle-btn.active-no');
    if (!active || active.dataset.value === 'Yes') return false;
  }
  return true;
}

// ── submitRsvpMessage ────────────────────────────────────────
function submitRsvpMessage() {
  var name    = (document.getElementById('rsvp-msg-name').value || '').trim();
  var text    = (document.getElementById('rsvp-msg-text').value || '').trim();
  var errorEl = document.getElementById('rsvp-msg-error');
  var btn     = document.getElementById('rsvp-msg-btn');

  if (!text) { errorEl.textContent = 'Please write a message before sending.'; return; }

  btn.classList.add('loading');
  btn.disabled = true;
  errorEl.textContent = '';

  var payload = { name: name || 'Anonymous', message: text };
  fetch(APPS_SCRIPT_URL + '?action=submitMessage&data=' + encodeURIComponent(JSON.stringify(payload)), { credentials: 'omit' })
    .then(function(r) { return r.json(); })
    .then(function() { showStep('step-confirm'); })
    .catch(function() {
      // Still proceed to confirm even if message send fails
      showStep('step-confirm');
    });
}

// Fade in on load
window.addEventListener('DOMContentLoaded', function() {
  var veil = document.getElementById('page-veil');
  requestAnimationFrame(function() { veil.style.opacity = '0'; });
});
