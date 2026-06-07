/* ============================================================
   DENTI LUXE — Main JavaScript
   ============================================================ */

const WA_NUMBER = '212600000000'; // ← Remplacez par votre numéro WhatsApp

const WA_MESSAGES = {
  general: "Bonjour Denti Luxe 👋\nJe suis intéressé(e) par vos facettes composites. Pouvez-vous me donner plus d'informations et les disponibilités ?",
  pack8:   "Bonjour Denti Luxe 👋\nJe suis intéressé(e) par le *Pack Essentiel — 8 facettes à 1500 DH*.\nPouvez-vous m'indiquer les prochaines disponibilités pour une consultation gratuite ?",
  pack16:  "Bonjour Denti Luxe 👋\nJe suis intéressé(e) par le *Pack Premium — 16 facettes à 2500 DH*.\nPouvez-vous m'indiquer les prochaines disponibilités pour une consultation gratuite ?",
  pack20:  "Bonjour Denti Luxe 👋\nJe suis intéressé(e) par le *Pack Complet — 20 facettes à 3000 DH*.\nPouvez-vous m'indiquer les prochaines disponibilités pour une consultation gratuite ?",
  promo:   "Bonjour Denti Luxe 👋\nJ'ai vu votre offre promotionnelle sur le site et je souhaite en profiter avant qu'elle n'expire. Pouvez-vous me rappeler les détails ?",
  rdv:     "Bonjour Denti Luxe 👋\nJe souhaite prendre rendez-vous pour une *consultation gratuite*. Quels sont vos créneaux disponibles ?"
};

function buildWALink(key) {
  const msg = encodeURIComponent(WA_MESSAGES[key] || WA_MESSAGES.general);
  return `https://wa.me/${WA_NUMBER}?text=${msg}`;
}

/* ---------- Attach WhatsApp links ---------- */
function initWhatsAppButtons() {
  document.querySelectorAll('[data-wa]').forEach(el => {
    const key = el.dataset.wa || 'general';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(buildWALink(key), '_blank');
    });
  });

  document.querySelectorAll('a[href="#whatsapp"]').forEach(el => {
    el.href = buildWALink('general');
    el.target = '_blank';
    el.rel = 'noopener';
  });
}

/* ---------- Sticky Header ---------- */
function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  const onScroll = () => {
    if (window.scrollY > 60) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- Mobile Nav ---------- */
function initMobileNav() {
  const toggle = document.getElementById('mobile-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const closeBtn = document.getElementById('mobile-nav-close');
  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => mobileNav.classList.add('open'));
  closeBtn?.addEventListener('click', () => mobileNav.classList.remove('open'));
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mobileNav.classList.remove('open'));
  });
}

/* ---------- Notification Bar ---------- */
function initNotifBar() {
  const bar = document.getElementById('notif-bar');
  const closeBtn = bar?.querySelector('.notif-close');
  if (!closeBtn) return;
  closeBtn.addEventListener('click', () => {
    bar.style.display = 'none';
    sessionStorage.setItem('notif-closed', '1');
  });
  if (sessionStorage.getItem('notif-closed')) bar.style.display = 'none';
}

/* ---------- FAQ Accordion ---------- */
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

/* ---------- Countdown Timer ---------- */
function initCountdown() {
  const els = {
    hours:   document.getElementById('cd-hours'),
    minutes: document.getElementById('cd-minutes'),
    seconds: document.getElementById('cd-seconds')
  };
  if (!els.hours) return;

  // Ends at midnight tonight
  const stored = sessionStorage.getItem('countdown-end');
  let end;
  if (stored) {
    end = parseInt(stored);
    if (end < Date.now()) {
      end = Date.now() + 3 * 60 * 60 * 1000; // reset 3h
      sessionStorage.setItem('countdown-end', end);
    }
  } else {
    const tonight = new Date();
    tonight.setHours(23, 59, 59, 0);
    end = tonight.getTime();
    if (end < Date.now()) end = Date.now() + 23 * 60 * 60 * 1000;
    sessionStorage.setItem('countdown-end', end);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const diff = Math.max(0, end - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (els.hours)   els.hours.textContent   = pad(h);
    if (els.minutes) els.minutes.textContent = pad(m);
    if (els.seconds) els.seconds.textContent = pad(s);
  }

  setInterval(tick, 1000);
  tick();
}

/* ---------- Scroll Reveal ---------- */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
}

/* ---------- Lead Form ---------- */
function initLeadForm() {
  const form = document.getElementById('lead-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name    = form.querySelector('[name="name"]')?.value.trim() || '';
    const phone   = form.querySelector('[name="phone"]')?.value.trim() || '';
    const offer   = form.querySelector('[name="offer"]')?.value || '';
    const message = form.querySelector('[name="message"]')?.value.trim() || '';

    const waKey = offer.includes('8') ? 'pack8' : offer.includes('16') ? 'pack16' : offer.includes('20') ? 'pack20' : 'rdv';
    const custom = `Bonjour Denti Luxe 👋\nJe m'appelle *${name}*, mon numéro est *${phone}*.\n${offer ? `Je suis intéressé(e) par : *${offer}*.\n` : ''}${message ? `Message : ${message}\n` : ''}Je souhaite prendre rendez-vous pour une consultation gratuite. Merci !`;
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(custom)}`;

    window.open(url, '_blank');

    // Success feedback
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Message envoyé !';
    btn.disabled = true;
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 4000);
  });
}

/* ---------- Smooth scroll for internal links ---------- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ---------- Animate counters ---------- */
function initCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const target = parseInt(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      let current = 0;
      const step = Math.ceil(target / 60);
      const interval = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current + suffix;
        if (current >= target) clearInterval(interval);
      }, 25);
    }, { threshold: 0.5 });
    io.observe(el);
  });
}

/* ---------- Live social proof notifications ---------- */
const NOTIFICATIONS = [
  { city: 'Casablanca', pack: '16 facettes', time: '2 min' },
  { city: 'Rabat',      pack: '20 facettes', time: '5 min' },
  { city: 'Marrakech',  pack: '8 facettes',  time: '7 min' },
  { city: 'Fès',        pack: '16 facettes', time: '12 min' },
  { city: 'Agadir',     pack: '20 facettes', time: '18 min' },
  { city: 'Tanger',     pack: '8 facettes',  time: '25 min' },
  { city: 'Meknès',     pack: '16 facettes', time: '32 min' },
];

function showSocialProofNotif() {
  const n = NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)];
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:100px; left:20px; z-index:9998;
    background:#fff; border-radius:12px; padding:14px 18px;
    box-shadow:0 8px 32px rgba(0,0,0,.15); border-left:4px solid #25D366;
    display:flex; align-items:center; gap:12px; max-width:300px;
    font-family:Inter,sans-serif; font-size:.82rem; color:#333;
    transform:translateX(-340px); transition:.4s cubic-bezier(.4,0,.2,1);
  `;
  el.innerHTML = `
    <span style="font-size:1.6rem">🦷</span>
    <div>
      <strong style="display:block;color:#0a1628;font-size:.88rem">${n.city}</strong>
      Vient de réserver ${n.pack}<br>
      <span style="color:#999;font-size:.75rem">Il y a ${n.time}</span>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translateX(0)'; });
  setTimeout(() => { el.style.transform = 'translateX(-340px)'; setTimeout(() => el.remove(), 400); }, 4000);
}

function initSocialProof() {
  setTimeout(() => {
    showSocialProofNotif();
    setInterval(showSocialProofNotif, 12000);
  }, 6000);
}

/* ---------- Reservation page multi-step ---------- */
function initReservationSteps() {
  const form = document.getElementById('reservation-form');
  if (!form) return;

  const steps = form.querySelectorAll('.step-content');
  const nextBtns = form.querySelectorAll('.step-next');
  const prevBtns = form.querySelectorAll('.step-prev');
  const progressBar = document.getElementById('progress-bar');
  let current = 0;

  function show(i) {
    steps.forEach((s, idx) => {
      s.style.display = idx === i ? 'block' : 'none';
    });
    if (progressBar) progressBar.style.width = ((i + 1) / steps.length * 100) + '%';

    document.querySelectorAll('.step-indicator').forEach((dot, idx) => {
      dot.classList.toggle('active', idx <= i);
    });
    current = i;
  }

  nextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (current < steps.length - 1) show(current + 1);
    });
  });

  prevBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (current > 0) show(current - 1);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const entries = Object.fromEntries(data);
    const packKey = entries.offer?.includes('8') ? 'pack8' : entries.offer?.includes('16') ? 'pack16' : 'pack20';
    const msg = `Bonjour Denti Luxe 👋\nNom: *${entries.name || ''}*\nTél: *${entries.phone || ''}*\nVille: *${entries.city || ''}*\nOffre souhaitée: *${entries.offer || ''}*\nDate préférée: *${entries.date || ''}*\n\nMerci de confirmer mon rendez-vous de consultation gratuite.`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  });

  show(0);
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileNav();
  initNotifBar();
  initWhatsAppButtons();
  initFAQ();
  initCountdown();
  initReveal();
  initLeadForm();
  initSmoothScroll();
  initCounters();
  initSocialProof();
  initReservationSteps();
});
