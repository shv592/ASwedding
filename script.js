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
