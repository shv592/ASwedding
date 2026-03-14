const IMG_HALDI = "images/haldi.png";
const IMG_MEHNDI = "images/mehndi.png";
const IMG_SANGEET = "images/sangeet.png";
const IMG_BARAAT = "images/baraat.png";
const IMG_LAGAN = "images/lagan.png";
const IMG_RECEPTION = "images/reception.png";
const IMG_INDIA = "images/india.png";

const CORRECT_PW = "wedding2026";

  function unlockSite() {
    const gate = document.getElementById("gate");
    gate.style.transition = "opacity 0.6s ease";
    gate.style.opacity = "0";
    setTimeout(() => {
      gate.style.display = "none";
      document.getElementById("site").classList.add("visible");
      initScroll();
      initMessages();
    }, 600);
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("img-haldi").src     = IMG_HALDI;
    document.getElementById("img-mehndi").src    = IMG_MEHNDI;
    document.getElementById("img-sangeet").src   = IMG_SANGEET;
    document.getElementById("img-baraat").src    = IMG_BARAAT;
    document.getElementById("img-lagan").src     = IMG_LAGAN;
    document.getElementById("img-reception").src = IMG_RECEPTION;
    document.getElementById("img-india").src     = IMG_INDIA;

    // Already unlocked this browser session — skip the gate
    if (sessionStorage.getItem("siteUnlocked") === "1") {
      document.getElementById("gate").style.display = "none";
      document.getElementById("site").classList.add("visible");
      initScroll();
      initMessages();
      return;
    }

    document.getElementById("pw-input").addEventListener("keydown", e => {
      if (e.key === "Enter") checkPw();
      document.getElementById("pw-error").textContent = "";
    });
  });

  function checkPw() {
    const val = document.getElementById("pw-input").value.trim();
    if (val === CORRECT_PW) {
      sessionStorage.setItem("siteUnlocked", "1");
      unlockSite();
    } else {
      document.getElementById("pw-error").textContent = "Incorrect password — please try again.";
      document.getElementById("pw-input").value = "";
      document.getElementById("pw-input").focus();
    }
  }

  window.addEventListener("scroll", () => {
    document.getElementById("nav").classList.toggle("scrolled", window.scrollY > 50);
  });
  function openNav()  { document.getElementById("mob-nav").classList.add("open"); }
  function closeNav() { document.getElementById("mob-nav").classList.remove("open"); }
  function toggleFaq(el) {
    const was = el.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach(i => i.classList.remove("open"));
    if (!was) el.classList.add("open");
  }
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxv6N-YwdF6EOMvVD4JHHKZ5V3tEZyfucRJ0i3Vv2dFjcjwuBK3Bimso1-ZsxhYI9d_/exec';

  // ── Messages carousel ────────────────────────────────────────
  let _msgTimer = null;
  let _msgIdx   = 0;

  function initMessages() {
    fetch(APPS_SCRIPT_URL + '?action=getMessages', { credentials: 'omit' })
      .then(r => r.json())
      .then(data => {
        const msgs = data.messages || [];
        if (msgs.length === 0) return;
        buildCarousel(msgs);
      })
      .catch(() => {});
  }

  function buildCarousel(msgs) {
    const carousel = document.getElementById('msg-carousel');
    const dotsEl   = document.getElementById('msg-dots');
    if (!carousel || !dotsEl) return;

    msgs.forEach((m, i) => {
      const slide = document.createElement('div');
      slide.className = 'msg-slide' + (i === 0 ? ' active' : '');
      slide.innerHTML =
        '<span class="msg-quote-mark">\u201C</span>' +
        '<p class="msg-text">' + escHtml(m.message) + '</p>' +
        '<span class="msg-name">— ' + escHtml(m.name) + '</span>';
      carousel.appendChild(slide);

      const dot = document.createElement('button');
      dot.className = 'msg-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Message ' + (i + 1));
      dot.addEventListener('click', () => goToSlide(i, msgs.length));
      dotsEl.appendChild(dot);
    });

    if (msgs.length > 1) {
      _msgTimer = setInterval(() => goToSlide((_msgIdx + 1) % msgs.length, msgs.length), 5000);
    }
  }

  function goToSlide(idx, total) {
    const slides = document.querySelectorAll('.msg-slide');
    const dots   = document.querySelectorAll('.msg-dot');
    if (!slides.length) return;

    slides[_msgIdx].classList.remove('active');
    dots[_msgIdx].classList.remove('active');
    _msgIdx = (idx + total) % total;
    slides[_msgIdx].classList.add('active');
    dots[_msgIdx].classList.add('active');

    // Reset auto-advance timer on manual click
    if (_msgTimer) { clearInterval(_msgTimer); _msgTimer = setInterval(() => goToSlide(_msgIdx + 1, total), 5000); }
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Submit message from index page ───────────────────────────
  window.submitIndexMessage = function submitIndexMessage() {
    const name    = (document.getElementById('msg-form-name').value || '').trim();
    const text    = (document.getElementById('msg-form-text').value || '').trim();
    const statusEl = document.getElementById('msg-form-status');
    const btn      = document.getElementById('msg-submit-btn');

    if (!text) { statusEl.textContent = 'Please write a message before sending.'; return; }

    btn.disabled = true;
    statusEl.textContent = '';

    const payload = { name: name || 'Anonymous', message: text };
    fetch(APPS_SCRIPT_URL + '?action=submitMessage&data=' + encodeURIComponent(JSON.stringify(payload)), { credentials: 'omit' })
      .then(r => r.json())
      .then(() => {
        document.getElementById('msg-form-name').value = '';
        document.getElementById('msg-form-text').value = '';
        btn.disabled = false;
        statusEl.textContent = 'Your message has been sent \u2014 thank you! \u2665';
      })
      .catch(() => {
        btn.disabled = false;
        statusEl.textContent = 'Something went wrong. Please try again.';
      });
  };

  function initScroll() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add("in-view"), Number(e.target.dataset.delay) || 0);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".event-card").forEach((el,i) => { el.dataset.delay = i*80;  io.observe(el); });
    document.querySelectorAll(".tm-panel").forEach((el,i)  => { el.dataset.delay = i*100; io.observe(el); });
  }
