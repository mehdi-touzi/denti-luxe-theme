/**
 * waitlist.js — gestion de la liste d'attente ExoFix
 *
 * Fonctionne sans backend : les inscriptions sont enregistrées localement
 * (localStorage) et envoyées à un endpoint si vous en configurez un.
 *
 * ── Pour collecter réellement les e-mails ──────────────────────────────
 * Renseignez WAITLIST_ENDPOINT ci-dessous avec l'URL d'un service de
 * formulaire, par exemple :
 *   • Formspree  : https://formspree.io/f/VOTRE_ID
 *   • Netlify    : laissez vide et ajoutez `data-netlify="true"` au <form>
 *   • Google Forms / votre propre API : l'URL qui accepte un POST JSON
 *
 * Si WAITLIST_ENDPOINT est vide, l'inscription est tout de même confirmée
 * et stockée localement (utile en démo / développement).
 */
(function () {
  'use strict';

  // ⚙️  À configurer pour la mise en production :
  const WAITLIST_ENDPOINT = ''; // ex. 'https://formspree.io/f/xxxxxxx'

  const STORAGE_KEY = 'exofix_waitlist';

  const form     = document.getElementById('waitlist-form');
  const emailEl  = document.getElementById('wl-email');
  const labEl    = document.getElementById('wl-lab');
  const submitEl = document.getElementById('wl-submit');
  const msgEl    = document.getElementById('wl-msg');
  const countEl  = document.getElementById('wl-count');

  if (!form) return;

  // Affiche le nombre d'inscrits déjà connus localement
  renderCount();
  // Si l'utilisateur s'est déjà inscrit sur cet appareil, on le rappelle
  const existing = getEntries();
  if (existing.length && getMyEmail()) {
    setMessage('Vous êtes déjà inscrit·e avec ' + getMyEmail() + ' — merci ! 🎉', 'ok');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setMessage('', '');

    const email = (emailEl.value || '').trim();
    const lab   = (labEl ? labEl.value || '' : '').trim();

    if (!isValidEmail(email)) {
      setMessage('Merci de saisir une adresse e-mail valide.', 'err');
      emailEl.focus();
      return;
    }

    if (hasEmail(email)) {
      setMessage('Cette adresse est déjà inscrite. À bientôt ! 🎉', 'ok');
      return;
    }

    setLoading(true);

    const entry = {
      email: email,
      lab: lab,
      date: new Date().toISOString(),
      source: location.pathname,
    };

    try {
      if (WAITLIST_ENDPOINT) {
        const res = await fetch(WAITLIST_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      }

      saveEntry(entry);
      setMyEmail(email);
      form.reset();
      setMessage('Inscription confirmée — vous serez prévenu·e du lancement. Merci ! 🎉', 'ok');
      renderCount();
    } catch (err) {
      // En cas d'échec réseau, on enregistre quand même localement.
      saveEntry(entry);
      setMyEmail(email);
      setMessage(
        "Votre inscription est enregistrée. (Envoi différé — vérifiez votre connexion.)",
        'ok'
      );
      renderCount();
      console.warn('Waitlist endpoint error:', err);
    } finally {
      setLoading(false);
    }
  });

  // ── Helpers ─────────────────────────────────────────────────────────
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function getEntries() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (_) { return []; }
  }

  function saveEntry(entry) {
    const list = getEntries();
    list.push(entry);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function hasEmail(email) {
    const t = email.toLowerCase();
    return getEntries().some(function (e) { return (e.email || '').toLowerCase() === t; });
  }

  function getMyEmail() { try { return localStorage.getItem(STORAGE_KEY + '_me') || ''; } catch (_) { return ''; } }
  function setMyEmail(v) { try { localStorage.setItem(STORAGE_KEY + '_me', v); } catch (_) {} }

  function renderCount() {
    if (!countEl) return;
    const n = getEntries().length;
    if (n > 0) {
      countEl.hidden = false;
      countEl.textContent = '✅ ' + n + ' inscription' + (n > 1 ? 's' : '') + ' enregistrée' + (n > 1 ? 's' : '') + ' sur cet appareil.';
    } else {
      countEl.hidden = true;
    }
  }

  function setMessage(text, type) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = 'form-msg' + (type ? ' ' + type : '');
  }

  function setLoading(on) {
    if (!submitEl) return;
    submitEl.disabled = on;
    submitEl.textContent = on ? 'Envoi…' : "Je m'inscris";
  }
})();
