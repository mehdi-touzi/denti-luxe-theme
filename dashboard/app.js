const API = window.location.origin;
const API_KEY = window.DENTI_LUXE_API_KEY || localStorage.getItem('dl_api_key') || '';

// ========================================
// UTILITAIRES
// ========================================
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => el.className = 'toast', 3500);
}

function fmt(n, decimals = 0) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Horloge temps réel
setInterval(() => {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('fr-MA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Casablanca'
  });
}, 1000);

// ========================================
// CHARGEMENT DASHBOARD
// ========================================
async function loadDashboard() {
  try {
    const data = await apiFetch('/dashboard');

    // KPIs
    const rev = data.stats?.revenue;
    const leads = data.stats?.leads;
    const roas = data.stats?.roas;
    const spend = data.stats?.adSpend;

    document.getElementById('kpiCommission').textContent = fmt(rev?.total_commission) + ' DH';
    document.getElementById('kpiRevenue').textContent = `CA total: ${fmt(rev?.total_revenue)} DH`;

    document.getElementById('kpiROAS').textContent = roas ? `${roas}x` : '—x';
    document.getElementById('kpiSpend').textContent = `Budget pub: ${fmt(spend)} DH`;

    document.getElementById('kpiLeadsToday').textContent = leads?.today ?? '—';
    document.getElementById('kpiLeadsTotal').textContent = `Total: ${leads?.total ?? '—'}`;

    document.getElementById('kpiConversion').textContent = (leads?.conversionRate ?? '—') + '%';
    document.getElementById('kpiTreated').textContent = `Traités: ${leads?.treated ?? '—'}`;

    document.getElementById('kpiScore').textContent = data.score?.score ?? '—';
    document.getElementById('kpiScoreGrade').textContent = `Grade: ${data.score?.grade ?? '—'}`;

    // Pipeline
    const priorities = data.priorities;
    document.getElementById('pNew').textContent = leads?.total - (leads?.qualified + leads?.appointment_set + leads?.treated + leads?.hot) || '—';
    document.getElementById('pContacted').textContent = leads?.hot ?? '—';
    document.getElementById('pQualified').textContent = leads?.qualified ?? '—';
    document.getElementById('pApt').textContent = leads?.appointment_set ?? '—';
    document.getElementById('pTreated').textContent = leads?.treated ?? '—';
    document.getElementById('pCold').textContent = '—';

    // Hot leads
    const hotList = document.getElementById('hotLeadsList');
    const hotLeads = priorities?.immediate_action || [];
    if (hotLeads.length === 0) {
      hotList.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">Aucun lead chaud en ce moment</div>';
    } else {
      hotList.innerHTML = hotLeads.map(l => `
        <div class="hot-lead-item">
          <div>
            <div class="hot-lead-phone">${l.phone}</div>
            <div class="hot-lead-meta">${l.treatment_interest || 'Intérêt inconnu'} · ${l.city || 'Ville inconnue'}</div>
          </div>
          <span class="lead-score">Score ${l.lead_score}</span>
        </div>
      `).join('');
    }

    // Agents
    const agents = data.orchestrator?.tasks || [];
    document.getElementById('agentsList').innerHTML = agents.map(a => `
      <div class="agent-item">
        <div class="agent-icon">${agentIcon(a.name)}</div>
        <div>
          <div class="agent-name">${agentLabel(a.name)}</div>
          <div class="agent-schedule">${a.schedule}</div>
          <div class="agent-desc">${a.description}</div>
        </div>
      </div>
    `).join('');

    // Alertes
    loadAlerts();

  } catch (e) {
    console.error('Dashboard error:', e);
    toast('Erreur chargement dashboard — vérifiez la clé API', 'error');
  }
}

function agentIcon(name) {
  const icons = {
    'followup-agent': '📲',
    'crm-agent/reminders': '📅',
    'crm-agent/no-shows': '⚠️',
    'analytics-agent/daily': '📊',
    'analytics-agent/alerts': '🚨',
    'orchestrator/summary': '🌙'
  };
  return icons[name] || '🤖';
}

function agentLabel(name) {
  const labels = {
    'followup-agent': 'Agent Relances',
    'crm-agent/reminders': 'Agent Rappels RDV',
    'crm-agent/no-shows': 'Agent No-Shows',
    'analytics-agent/daily': 'Agent Analytics',
    'analytics-agent/alerts': 'Agent Alertes',
    'orchestrator/summary': 'Rapport Soir'
  };
  return labels[name] || name;
}

// ========================================
// ALERTES
// ========================================
async function loadAlerts() {
  try {
    const data = await apiFetch('/analytics/alerts');
    const section = document.getElementById('alertsSection');
    const list = document.getElementById('alertsList');

    if (!data.alerts?.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = data.alerts.map(a => `
      <div class="alert-item">
        <span class="alert-badge ${a.level}">${a.level}</span>
        <div class="alert-message">
          <div>${a.message}</div>
          <div class="alert-action">→ ${a.action}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    // Silencieux si pas d'alertes
  }
}

// ========================================
// RAPPORT CEO
// ========================================
async function loadReport() {
  const el = document.getElementById('reportContent');
  el.innerHTML = '<span class="spin">⟳</span> Génération en cours...';

  try {
    const data = await apiFetch('/analytics/report');
    el.textContent = data.report || 'Rapport indisponible';
  } catch (e) {
    el.innerHTML = '<span style="color:var(--red)">Erreur génération rapport</span>';
  }
}

// ========================================
// ENVOI MESSAGE MANUEL
// ========================================
async function sendManualMessage() {
  const phone = document.getElementById('msgPhone').value.trim();
  const message = document.getElementById('msgText').value.trim();

  if (!phone || !message) { toast('Remplissez le téléphone et le message', 'error'); return; }

  try {
    const result = await apiFetch('/send-message', {
      method: 'POST',
      body: JSON.stringify({ phone, message })
    });
    toast(result.success ? '✓ Message envoyé' : '✗ Erreur envoi', result.success ? 'success' : 'error');
    if (result.success) {
      document.getElementById('msgText').value = '';
    }
  } catch (e) {
    toast('Erreur: ' + e.message, 'error');
  }
}

// ========================================
// SIMULER MESSAGE ENTRANT
// ========================================
async function simulateMessage() {
  const phone = document.getElementById('simPhone').value.trim();
  const msg = document.getElementById('simMsg').value.trim();

  if (!phone || !msg) { toast('Remplissez téléphone et message', 'error'); return; }

  try {
    const result = await apiFetch('/simulate-message', {
      method: 'POST',
      body: JSON.stringify({ phone, message: msg })
    });
    toast(`Lead ${result.isNewLead ? 'créé' : 'mis à jour'} — Intent: ${result.intent}`, 'success');
    setTimeout(loadDashboard, 1000);
  } catch (e) {
    toast('Erreur: ' + e.message, 'error');
  }
}

// ========================================
// MARQUER PATIENT TRAITÉ
// ========================================
async function markTreated() {
  const leadId = parseInt(document.getElementById('treatLeadId').value);
  const amountDh = parseFloat(document.getElementById('treatAmount').value);
  const treatment = document.getElementById('treatTreatment').value.trim();

  if (!leadId || !amountDh) { toast('ID Lead et montant requis', 'error'); return; }

  try {
    const result = await apiFetch('/patients/treated', {
      method: 'POST',
      body: JSON.stringify({ leadId, amountDh, treatment: treatment || 'Traitement dentaire' })
    });
    toast(`✓ Patient traité! Commission: ${fmt(result.commission)} DH`, 'success');
    document.getElementById('treatLeadId').value = '';
    document.getElementById('treatAmount').value = '';
    document.getElementById('treatTreatment').value = '';
    setTimeout(loadDashboard, 500);
  } catch (e) {
    toast('Erreur: ' + e.message, 'error');
  }
}

// ========================================
// GÉNÉRATION DE CONTENU
// ========================================
async function generateContent() {
  const type = document.getElementById('contentType').value;
  const platform = document.getElementById('contentPlatform').value;
  const output = document.getElementById('contentOutput');

  output.innerHTML = '<span class="spin">⟳</span> Génération en cours...';

  try {
    const result = await apiFetch('/content/generate', {
      method: 'POST',
      body: JSON.stringify({ type, platform, context: {} })
    });
    output.textContent = result.content;
    toast('Contenu généré!', 'success');
  } catch (e) {
    output.innerHTML = '<span style="color:var(--red)">Erreur génération</span>';
  }
}

async function generateAdCopy() {
  const output = document.getElementById('contentOutput');
  output.innerHTML = '<span class="spin">⟳</span> Génération copy pub...';

  try {
    const result = await apiFetch('/content/ad-copy', {
      method: 'POST',
      body: JSON.stringify({ variant: Math.floor(Math.random() * 4) + 1 })
    });
    output.textContent = `Style: ${result.style}\n\n${result.copy}`;
    toast('Copy publicitaire généré!', 'success');
  } catch (e) {
    output.innerHTML = '<span style="color:var(--red)">Erreur génération</span>';
  }
}

// ========================================
// INIT
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier la clé API
  if (!API_KEY) {
    const key = prompt('Entrez votre clé API Denti Luxe:');
    if (key) {
      localStorage.setItem('dl_api_key', key);
      location.reload();
    }
    return;
  }

  loadDashboard();
  // Rafraîchir toutes les 60 secondes
  setInterval(loadDashboard, 60000);
});
