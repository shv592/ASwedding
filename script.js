const IMG_TRAVEL = "images/travel.jpg";
const IMG_RSVP_BG = "images/rsvp-bg.jpg";
const IMG_FAQ_BG = "images/faq-bg.jpg";
const IMG_GATE_BG = "images/gate-bg.jpg";
const IMG_WELCOME_BG = "images/welcome-bg.jpg";
const IMG_HERO_INVITE = "images/hero-invite.jpg";
const IMG_HALDI = "images/haldi.jpg";
const IMG_MEHNDI = "images/mehndi.jpg";
const IMG_SANGEET = "images/sangeet.jpg";
const IMG_BARAAT = "images/baraat.jpg";
const IMG_LAGAN = "images/lagan.jpg";
const IMG_RECEPTION = "images/reception.jpg";
const IMG_INDIA = "images/india.jpg";

const CORRECT_PW = "wedding2026";

  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("gate").style.backgroundImage       = `url(${IMG_GATE_BG})`;
    document.getElementById("welcome-bg").style.backgroundImage = `url(${IMG_GATE_BG})`;
    document.getElementById("img-haldi").src     = IMG_HALDI;
    document.getElementById("img-mehndi").src    = IMG_MEHNDI;
    document.getElementById("img-sangeet").src   = IMG_SANGEET;
    document.getElementById("img-baraat").src    = IMG_BARAAT;
    document.getElementById("img-lagan").src     = IMG_LAGAN;
    document.getElementById("img-reception").src = IMG_RECEPTION;
    document.getElementById("img-india").src     = IMG_INDIA;
    document.getElementById("img-travel").style.backgroundImage = `url(${IMG_TRAVEL})`;
    document.getElementById("rsvp").style.backgroundImage = `url(${IMG_RSVP_BG})`;
    document.getElementById("faq").style.backgroundImage  = `url(${IMG_FAQ_BG})`;
  });

  function checkPw() {
    const val = document.getElementById("pw-input").value.trim();
    if (val === CORRECT_PW) {
      const gate = document.getElementById("gate");
      gate.style.transition = "opacity 0.6s ease";
      gate.style.opacity = "0";
      setTimeout(() => {
        gate.style.display = "none";
        document.getElementById("site").classList.add("visible");
        initScroll();
      }, 600);
    } else {
      document.getElementById("pw-error").textContent = "Incorrect password — please try again.";
      document.getElementById("pw-input").value = "";
      document.getElementById("pw-input").focus();
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("pw-input").addEventListener("keydown", e => {
      if (e.key === "Enter") checkPw();
      document.getElementById("pw-error").textContent = "";
    });
  });

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
  function initScroll() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add("in-view"), Number(e.target.dataset.delay) || 0);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".event-card").forEach((el,i) => { el.dataset.delay = i*80; io.observe(el); });
    document.querySelectorAll(".tip-card").forEach((el,i)  => { el.dataset.delay = i*100; io.observe(el); });
  }
