require('dotenv').config();
const cron = require('node-cron');
const { processFollowups } = require('./whatsapp-agent');
const { generateDailyReport, checkAlerts } = require('./analytics-agent');
const { sendAppointmentReminders, handleNoShows } = require('./crm-agent');
const { sendWhatsAppMessage } = require('./whatsapp-agent');

let isRunning = false;
const taskLog = [];

function log(agent, event, data = {}) {
  const entry = { agent, event, data, timestamp: new Date().toISOString() };
  taskLog.unshift(entry);
  if (taskLog.length > 500) taskLog.pop();
  console.log(`[${entry.timestamp}] [${agent}] ${event}`, Object.keys(data).length ? data : '');
  return entry;
}

// ========================================
// TÂCHES PROGRAMMÉES — ORCHESTRATEUR
// ========================================
function startOrchestrator() {
  if (isRunning) return;
  isRunning = true;
  console.log('🤖 Orchestrateur Denti Luxe démarré');

  // ── TOUTES LES 5 MINUTES : Traiter les relances en attente
  cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await processFollowups();
      if (count > 0) log('followup-agent', `${count} relances envoyées`);
    } catch (e) {
      log('followup-agent', 'ERREUR', { error: e.message });
    }
  }, { timezone: 'Africa/Casablanca' });

  // ── TOUTES LES 30 MINUTES : Rappels de rendez-vous
  cron.schedule('*/30 * * * *', async () => {
    try {
      const sent = await sendAppointmentReminders();
      if (sent > 0) log('crm-agent', `${sent} rappels RDV envoyés`);
    } catch (e) {
      log('crm-agent', 'ERREUR rappels', { error: e.message });
    }
  }, { timezone: 'Africa/Casablanca' });

  // ── TOUTES LES 2 HEURES : Détecter les no-shows
  cron.schedule('0 */2 * * *', async () => {
    try {
      const count = await handleNoShows();
      if (count > 0) log('crm-agent', `${count} no-shows traités`);
    } catch (e) {
      log('crm-agent', 'ERREUR no-shows', { error: e.message });
    }
  }, { timezone: 'Africa/Casablanca' });

  // ── 08:00 : Rapport CEO quotidien
  cron.schedule('0 8 * * *', async () => {
    try {
      log('analytics-agent', 'Génération rapport CEO');
      const report = await generateDailyReport();
      const ownerPhone = process.env.OWNER_WHATSAPP;
      if (ownerPhone && report.report) {
        await sendWhatsAppMessage(ownerPhone, report.report);
      }
      log('analytics-agent', 'Rapport CEO envoyé', { hotLeads: report.hotLeads });
    } catch (e) {
      log('analytics-agent', 'ERREUR rapport CEO', { error: e.message });
    }
  }, { timezone: 'Africa/Casablanca' });

  // ── 10:00 : Vérification alertes business
  cron.schedule('0 10 * * *', async () => {
    try {
      const alerts = await checkAlerts();
      if (alerts.length > 0) {
        log('analytics-agent', `${alerts.length} alertes détectées`);
        const ownerPhone = process.env.OWNER_WHATSAPP;
        if (ownerPhone) {
          const alertsText = alerts.map(a => `${a.level === 'critical' ? '🚨' : '⚠️'} ${a.message}\n→ ${a.action}`).join('\n\n');
          await sendWhatsAppMessage(ownerPhone, `🤖 ALERTES DENTI LUXE\n\n${alertsText}`);
        }
      }
    } catch (e) {
      log('analytics-agent', 'ERREUR alertes', { error: e.message });
    }
  }, { timezone: 'Africa/Casablanca' });

  // ── 21:00 : Résumé de fin de journée
  cron.schedule('0 21 * * *', async () => {
    try {
      const { AnalyticsOps, LeadOps } = require('../db/database');
      const stats = LeadOps.getDashboardStats();
      const roas = AnalyticsOps.getROAS(1);
      const ownerPhone = process.env.OWNER_WHATSAPP;

      if (ownerPhone) {
        const summary = `📊 RÉSUMÉ ${new Date().toLocaleDateString('fr-MA')}
━━━━━━━━━━━━━━━
📱 Nouveaux leads: ${stats.today}
🔥 Leads chauds: ${stats.hot}
📅 RDV pris: ${stats.appointment_set}
💰 ROAS jour: ${roas.roas}x
━━━━━━━━━━━━━━━
Bonne nuit! 🌙`;
        await sendWhatsAppMessage(ownerPhone, summary);
      }
    } catch (e) {
      log('orchestrator', 'ERREUR résumé soir', { error: e.message });
    }
  }, { timezone: 'Africa/Casablanca' });

  log('orchestrator', 'Tous les agents planifiés et actifs');
}

function stopOrchestrator() {
  isRunning = false;
  console.log('⛔ Orchestrateur arrêté');
}

function getTaskLog(limit = 50) {
  return taskLog.slice(0, limit);
}

function getOrchestratorStatus() {
  return {
    running: isRunning,
    tasks: [
      { name: 'followup-agent', schedule: 'Toutes les 5 min', description: 'Relances WhatsApp automatiques' },
      { name: 'crm-agent/reminders', schedule: 'Toutes les 30 min', description: 'Rappels rendez-vous' },
      { name: 'crm-agent/no-shows', schedule: 'Toutes les 2h', description: 'Détection no-shows' },
      { name: 'analytics-agent/daily', schedule: '08:00', description: 'Rapport CEO quotidien' },
      { name: 'analytics-agent/alerts', schedule: '10:00', description: 'Alertes business' },
      { name: 'orchestrator/summary', schedule: '21:00', description: 'Résumé de fin de journée' }
    ],
    recentLog: taskLog.slice(0, 10)
  };
}

module.exports = {
  startOrchestrator,
  stopOrchestrator,
  getTaskLog,
  getOrchestratorStatus
};
