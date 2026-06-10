const express = require('express');
const router = express.Router();
const { LeadOps, ConversationOps, AppointmentOps, PatientOps, AnalyticsOps, FollowupOps } = require('../db/database');
const { processInboundMessage, sendWhatsAppMessage } = require('../agents/whatsapp-agent');
const { getPipeline, markPatientTreated, prioritizeLeads } = require('../agents/crm-agent');
const { generateDailyReport, checkAlerts, getBusinessScore } = require('../agents/analytics-agent');
const { generateContent, generateAdCopy, getScheduledContent } = require('../agents/content-agent');
const { getOrchestratorStatus } = require('../agents/orchestrator');

// ── Middleware auth simple (token)
function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ========================================
// DASHBOARD — Stats globales
// ========================================
router.get('/dashboard', auth, (req, res) => {
  try {
    const stats = AnalyticsOps.getDashboard();
    const score = getBusinessScore();
    const priorities = prioritizeLeads();
    const status = getOrchestratorStatus();

    res.json({ stats, score, priorities, orchestrator: status, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========================================
// LEADS
// ========================================
router.get('/leads', auth, (req, res) => {
  const { status, limit = 50 } = req.query;
  const db = require('../db/database').getDb();
  const leads = status
    ? db.prepare(`SELECT * FROM leads WHERE status = ? ORDER BY lead_score DESC LIMIT ?`).all(status, parseInt(limit))
    : db.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT ?`).all(parseInt(limit));
  res.json({ leads, count: leads.length });
});

router.get('/leads/pipeline', auth, (req, res) => {
  res.json(getPipeline());
});

router.get('/leads/hot', auth, (req, res) => {
  res.json(LeadOps.getHotLeads());
});

router.get('/leads/:id', auth, (req, res) => {
  const db = require('../db/database').getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead introuvable' });

  const conversations = ConversationOps.getHistory(lead.id);
  const appointments = db.prepare('SELECT * FROM appointments WHERE lead_id = ?').all(lead.id);
  const patient = db.prepare('SELECT * FROM patients WHERE lead_id = ?').get(lead.id);

  res.json({ lead, conversations, appointments, patient });
});

router.patch('/leads/:id', auth, (req, res) => {
  const updated = LeadOps.update(parseInt(req.params.id), req.body);
  LeadOps.updateScore(parseInt(req.params.id));
  res.json(updated);
});

// ========================================
// MESSAGES MANUELS
// ========================================
router.post('/send-message', auth, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone et message requis' });

  const result = await sendWhatsAppMessage(phone, message);
  if (result.success) {
    const lead = LeadOps.findByPhone(phone);
    if (lead) {
      ConversationOps.save({
        lead_id: lead.id, direction: 'outbound', message_id: null,
        content: message, media_type: 'text', agent_type: 'manual',
        sentiment: null, intent: 'manual', tokens_used: 0
      });
    }
  }
  res.json(result);
});

// Simuler un message entrant (pour tests)
router.post('/simulate-message', auth, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone et message requis' });

  const result = await processInboundMessage(phone, message);
  res.json(result);
});

// ========================================
// APPOINTMENTS
// ========================================
router.get('/appointments', auth, (req, res) => {
  const upcoming = AppointmentOps.getUpcoming(72);
  res.json({ appointments: upcoming, count: upcoming.length });
});

router.post('/appointments', auth, (req, res) => {
  const apt = AppointmentOps.create(req.body);
  LeadOps.update(req.body.lead_id, { status: 'appointment_set', temperature: 'hot' });
  res.json(apt);
});

router.patch('/appointments/:id', auth, (req, res) => {
  AppointmentOps.update(parseInt(req.params.id), req.body);
  res.json({ success: true });
});

// Marquer un patient comme traité
router.post('/patients/treated', auth, (req, res) => {
  const { leadId, dentistId, treatment, amountDh } = req.body;
  if (!leadId || !amountDh) return res.status(400).json({ error: 'leadId et amountDh requis' });

  const patient = markPatientTreated(leadId, { dentistId, treatment, amountDh });
  res.json({ success: true, patient, commission: amountDh * parseFloat(process.env.COMMISSION_RATE || '0.20') });
});

// ========================================
// ANALYTICS
// ========================================
router.get('/analytics/dashboard', auth, (req, res) => {
  res.json(AnalyticsOps.getDashboard());
});

router.get('/analytics/roas', auth, (req, res) => {
  const days = parseInt(req.query.days || 30);
  res.json(AnalyticsOps.getROAS(days));
});

router.get('/analytics/report', auth, async (req, res) => {
  const report = await generateDailyReport();
  res.json(report);
});

router.get('/analytics/alerts', auth, async (req, res) => {
  const alerts = await checkAlerts();
  res.json({ alerts });
});

router.get('/analytics/score', auth, (req, res) => {
  res.json(getBusinessScore());
});

router.get('/analytics/revenue/trend', auth, (req, res) => {
  res.json(PatientOps.getMonthlyTrend());
});

// ========================================
// CONTENU
// ========================================
router.post('/content/generate', auth, async (req, res) => {
  const { type, platform, context } = req.body;
  if (!type || !platform) return res.status(400).json({ error: 'type et platform requis' });

  const content = await generateContent(type, platform, context || {});
  res.json(content);
});

router.post('/content/ad-copy', auth, async (req, res) => {
  const copy = await generateAdCopy(parseInt(req.body.variant || 1));
  res.json(copy);
});

router.get('/content/scheduled', auth, (req, res) => {
  const { platform, limit } = req.query;
  res.json(getScheduledContent(platform, parseInt(limit || 10)));
});

// ========================================
// ORCHESTRATEUR
// ========================================
router.get('/orchestrator/status', auth, (req, res) => {
  res.json(getOrchestratorStatus());
});

module.exports = router;
