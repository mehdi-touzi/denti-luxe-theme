require('dotenv').config();
const { getClient } = require('./claude-client');
const { AnalyticsOps, LeadOps, PatientOps } = require('../db/database');
const { ANALYTICS_SYSTEM_PROMPT, CEO_SYSTEM_PROMPT } = require('../config/prompts');

// ========================================
// RAPPORT QUOTIDIEN CEO
// ========================================
async function generateDailyReport() {
  const dashboard = AnalyticsOps.getDashboard();
  const roas30 = AnalyticsOps.getROAS(30);
  const roas7 = AnalyticsOps.getROAS(7);
  const trend = PatientOps.getMonthlyTrend();
  const hotLeads = LeadOps.getHotLeads();

  const dataForAgent = `
DONNÉES DU JOUR (${new Date().toLocaleDateString('fr-MA')}):

LEADS:
- Total leads: ${dashboard.leads.total}
- Nouveaux aujourd'hui: ${dashboard.leads.today}
- Leads chauds: ${dashboard.leads.hot}
- Qualifiés: ${dashboard.leads.qualified}
- RDV pris: ${dashboard.leads.appointment_set}
- Traités: ${dashboard.leads.treated}
- Taux conversion: ${dashboard.leads.conversionRate}%

REVENUS (30 jours):
- Patients traités: ${dashboard.revenue?.patients_count || 0}
- CA total: ${dashboard.revenue?.total_revenue?.toFixed(0) || 0} DH
- Commission totale: ${dashboard.revenue?.total_commission?.toFixed(0) || 0} DH
- Ticket moyen: ${dashboard.revenue?.avg_ticket?.toFixed(0) || 0} DH

PERFORMANCE PUBLICITAIRE:
- Budget pub 30j: ${dashboard.adSpend?.toFixed(0) || 0} DH
- ROAS 30j: ${roas30.roas}x
- ROAS 7j: ${roas7.roas}x

LEADS CHAUDS EN ATTENTE: ${hotLeads.length}

TENDANCE MENSUELLE:
${trend.slice(0, 3).map(m => `${m.month}: ${m.patients} patients, ${m.revenue?.toFixed(0)} DH CA, ${m.commission?.toFixed(0)} DH commission`).join('\n')}
`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: CEO_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Génère le rapport CEO du jour et les 3 actions prioritaires:\n${dataForAgent}` }]
    });

    return {
      report: response.content[0].text,
      data: dashboard,
      roas30,
      hotLeads: hotLeads.length,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Analytics Agent] Erreur:', error.message);
    return generateFallbackReport(dashboard, roas30);
  }
}

function generateFallbackReport(dashboard, roas) {
  const today = new Date().toLocaleDateString('fr-MA');
  return {
    report: `📊 DENTI LUXE — Rapport ${today}
━━━━━━━━━━━━━━━━━━
💰 Commission 30j: ${dashboard.revenue?.total_commission?.toFixed(0) || 0} DH
📱 Leads aujourd'hui: ${dashboard.leads.today}
🔥 Leads chauds: ${dashboard.leads.hot}
📅 RDV pris: ${dashboard.leads.appointment_set}
📈 ROAS 30j: ${roas.roas}x
━━━━━━━━━━━━━━━━━━
⚡ Actions recommandées:
1. Relancer les ${dashboard.leads.hot} leads chauds
2. Confirmer les RDV de demain
3. Analyser les campagnes Meta`,
    data: dashboard,
    roas30: roas,
    generatedAt: new Date().toISOString()
  };
}

// ========================================
// ALERTES AUTOMATIQUES
// ========================================
async function checkAlerts() {
  const alerts = [];
  const roas7 = AnalyticsOps.getROAS(7);
  const dashboard = AnalyticsOps.getDashboard();

  // Alerte ROAS faible
  if (roas7.roas < 5 && roas7.spend > 0) {
    alerts.push({
      level: 'critical',
      message: `⚠️ ROAS 7 jours trop bas: ${roas7.roas}x (objectif >10x). Budget pub: ${roas7.spend} DH → Commission: ${roas7.commission} DH`,
      action: 'Vérifier les créatifs et audiences Meta Ads'
    });
  }

  // Alerte beaucoup de leads chauds non traités
  if (dashboard.leads.hot > 20) {
    alerts.push({
      level: 'warning',
      message: `🔥 ${dashboard.leads.hot} leads chauds en attente de suivi!`,
      action: 'Relancer immédiatement via WhatsApp'
    });
  }

  // Alerte taux de conversion faible
  if (parseFloat(dashboard.leads.conversionRate) < 15 && dashboard.leads.total > 10) {
    alerts.push({
      level: 'warning',
      message: `📉 Taux de conversion: ${dashboard.leads.conversionRate}% (objectif >30%)`,
      action: 'Revoir le script WhatsApp et les critères de qualification'
    });
  }

  return alerts;
}

// ========================================
// ANALYSE CAMPAGNE META
// ========================================
async function analyzeCampaignPerformance(campaignData) {
  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: ANALYTICS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Analyse ces données de campagne Meta Ads et donne 3 optimisations concrètes:\n${JSON.stringify(campaignData, null, 2)}`
      }]
    });

    return { analysis: response.content[0].text, raw: campaignData };
  } catch (error) {
    return { error: error.message, raw: campaignData };
  }
}

// ========================================
// SCORE HEBDOMADAIRE BUSINESS
// ========================================
function getBusinessScore() {
  const roas = AnalyticsOps.getROAS(7);
  const dashboard = AnalyticsOps.getDashboard();

  let score = 0;
  const max = 100;

  // ROAS (40 points)
  if (roas.roas >= 15) score += 40;
  else if (roas.roas >= 10) score += 30;
  else if (roas.roas >= 5) score += 15;

  // Taux de conversion (30 points)
  const cr = parseFloat(dashboard.leads.conversionRate);
  if (cr >= 40) score += 30;
  else if (cr >= 25) score += 20;
  else if (cr >= 15) score += 10;

  // Volume leads (20 points)
  if (dashboard.leads.today >= 10) score += 20;
  else if (dashboard.leads.today >= 5) score += 12;
  else if (dashboard.leads.today >= 1) score += 5;

  // Commission (10 points)
  const commission = dashboard.revenue?.total_commission || 0;
  if (commission >= 10000) score += 10;
  else if (commission >= 5000) score += 6;
  else if (commission >= 1000) score += 3;

  return {
    score,
    max,
    grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
    breakdown: { roas: roas.roas, conversionRate: cr, leadsToday: dashboard.leads.today, commission30d: commission }
  };
}

module.exports = {
  generateDailyReport,
  checkAlerts,
  analyzeCampaignPerformance,
  getBusinessScore
};
