require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './db/denti_luxe.db';

let _db = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

// ========================================
// LEADS
// ========================================
const LeadOps = {
  findByPhone(phone) {
    return getDb().prepare('SELECT * FROM leads WHERE phone = ?').get(phone);
  },

  create(data) {
    const stmt = getDb().prepare(`
      INSERT INTO leads (phone, name, source, utm_campaign, utm_content, language, treatment_interest, city, meta_lead_id)
      VALUES (@phone, @name, @source, @utm_campaign, @utm_content, @language, @treatment_interest, @city, @meta_lead_id)
    `);
    const result = stmt.run(data);
    return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
  },

  update(id, data) {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    getDb().prepare(`UPDATE leads SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id });
    return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id);
  },

  updateScore(id) {
    const lead = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!lead) return;

    let score = 0;
    if (lead.temperature === 'hot') score += 40;
    else if (lead.temperature === 'warm') score += 20;
    if (lead.urgency === 'high') score += 30;
    else if (lead.urgency === 'medium') score += 15;
    if (lead.treatment_interest) score += 10;
    if (lead.budget_range) score += 10;
    if (lead.city) score += 5;
    const convCount = getDb().prepare('SELECT COUNT(*) as c FROM conversations WHERE lead_id = ?').get(id).c;
    score += Math.min(convCount * 2, 10);

    getDb().prepare('UPDATE leads SET lead_score = ?, updated_at = datetime(\'now\') WHERE id = ?').run(score, id);
    return score;
  },

  getByStatus(status) {
    return getDb().prepare('SELECT * FROM leads WHERE status = ? ORDER BY lead_score DESC').all(status);
  },

  getPendingFollowups() {
    return getDb().prepare(`
      SELECT l.*, fq.id as fq_id, fq.template_key, fq.scheduled_at as followup_at
      FROM leads l
      JOIN followup_queue fq ON fq.lead_id = l.id
      WHERE fq.status = 'pending' AND fq.scheduled_at <= datetime('now')
      ORDER BY fq.scheduled_at ASC
    `).all();
  },

  getHotLeads() {
    return getDb().prepare(`
      SELECT * FROM leads
      WHERE temperature = 'hot' AND status NOT IN ('treated', 'lost')
      ORDER BY lead_score DESC, last_contact ASC
      LIMIT 20
    `).all();
  },

  getDashboardStats() {
    const db = getDb();
    return {
      total: db.prepare('SELECT COUNT(*) as c FROM leads').get().c,
      today: db.prepare("SELECT COUNT(*) as c FROM leads WHERE date(created_at) = date('now')").get().c,
      hot: db.prepare("SELECT COUNT(*) as c FROM leads WHERE temperature = 'hot'").get().c,
      qualified: db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'qualified'").get().c,
      appointment_set: db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'appointment_set'").get().c,
      treated: db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'treated'").get().c,
      bySource: db.prepare("SELECT source, COUNT(*) as c FROM leads GROUP BY source").all(),
      conversionRate: (() => {
        const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
        const treated = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'treated'").get().c;
        return total > 0 ? ((treated / total) * 100).toFixed(1) : 0;
      })()
    };
  }
};

// ========================================
// CONVERSATIONS
// ========================================
const ConversationOps = {
  save(data) {
    return getDb().prepare(`
      INSERT OR IGNORE INTO conversations (lead_id, direction, message_id, content, media_type, agent_type, sentiment, intent, tokens_used)
      VALUES (@lead_id, @direction, @message_id, @content, @media_type, @agent_type, @sentiment, @intent, @tokens_used)
    `).run(data);
  },

  getHistory(leadId, limit = 20) {
    return getDb().prepare(`
      SELECT * FROM conversations WHERE lead_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(leadId, limit);
  },

  getLastN(leadId, n = 10) {
    const rows = getDb().prepare(`
      SELECT direction, content, created_at FROM conversations
      WHERE lead_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(leadId, n);
    return rows.reverse();
  }
};

// ========================================
// APPOINTMENTS
// ========================================
const AppointmentOps = {
  create(data) {
    const stmt = getDb().prepare(`
      INSERT INTO appointments (lead_id, dentist_id, scheduled_at, duration_min, treatment, notes)
      VALUES (@lead_id, @dentist_id, @scheduled_at, @duration_min, @treatment, @notes)
    `);
    const result = stmt.run(data);
    return getDb().prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);
  },

  update(id, data) {
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ');
    getDb().prepare(`UPDATE appointments SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id });
  },

  getUpcoming(hours = 24) {
    return getDb().prepare(`
      SELECT a.*, l.phone, l.name as lead_name, d.name as dentist_name, d.clinic
      FROM appointments a
      JOIN leads l ON l.id = a.lead_id
      LEFT JOIN dentists d ON d.id = a.dentist_id
      WHERE a.status IN ('scheduled', 'confirmed')
      AND a.scheduled_at BETWEEN datetime('now') AND datetime('now', '+${hours} hours')
      ORDER BY a.scheduled_at ASC
    `).all();
  },

  getNoShows() {
    return getDb().prepare(`
      SELECT a.*, l.phone, l.name as lead_name
      FROM appointments a
      JOIN leads l ON l.id = a.lead_id
      WHERE a.status = 'scheduled'
      AND a.scheduled_at < datetime('now', '-2 hours')
    `).all();
  }
};

// ========================================
// PATIENTS & REVENUS
// ========================================
const PatientOps = {
  create(data) {
    const commission = (data.amount_dh || 0) * (data.commission_rate || 0.20);
    return getDb().prepare(`
      INSERT INTO patients (lead_id, dentist_id, treatment, treatment_date, amount_dh, commission_rate, commission_dh, referred_by, notes)
      VALUES (@lead_id, @dentist_id, @treatment, @treatment_date, @amount_dh, @commission_rate, @commission_dh, @referred_by, @notes)
    `).run({ ...data, commission_dh: commission });
  },

  getRevenueSummary(days = 30) {
    return getDb().prepare(`
      SELECT
        COUNT(*) as patients_count,
        SUM(amount_dh) as total_revenue,
        SUM(commission_dh) as total_commission,
        AVG(amount_dh) as avg_ticket,
        AVG(commission_dh) as avg_commission
      FROM patients
      WHERE treatment_date >= date('now', '-${days} days')
    `).get();
  },

  getMonthlyTrend() {
    return getDb().prepare(`
      SELECT
        strftime('%Y-%m', treatment_date) as month,
        COUNT(*) as patients,
        SUM(amount_dh) as revenue,
        SUM(commission_dh) as commission
      FROM patients
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `).all();
  }
};

// ========================================
// ANALYTICS
// ========================================
const AnalyticsOps = {
  getDashboard() {
    const db = getDb();
    const revenue = PatientOps.getRevenueSummary(30);
    const leads = LeadOps.getDashboardStats();

    const adSpend = db.prepare(`
      SELECT SUM(spend_dh) as total FROM ad_metrics WHERE date >= date('now', '-30 days')
    `).get();

    const roas = adSpend?.total > 0
      ? (revenue?.total_commission / adSpend.total).toFixed(2)
      : null;

    return {
      revenue,
      leads,
      adSpend: adSpend?.total || 0,
      roas,
      period: '30 derniers jours'
    };
  },

  getROAS(days = 30) {
    const db = getDb();
    const spend = db.prepare(`SELECT SUM(spend_dh) as s FROM ad_metrics WHERE date >= date('now', '-${days} days')`).get().s || 0;
    const commission = db.prepare(`SELECT SUM(commission_dh) as c FROM patients WHERE treatment_date >= date('now', '-${days} days')`).get().c || 0;
    return { spend, commission, roas: spend > 0 ? (commission / spend).toFixed(2) : 0 };
  }
};

// ========================================
// FOLLOWUP QUEUE
// ========================================
const FollowupOps = {
  schedule(leadId, templateKey, delayDays = 1) {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + delayDays);
    // Envoyer à 10h du matin heure Maroc
    scheduledAt.setHours(10, 0, 0, 0);

    getDb().prepare(`
      INSERT OR IGNORE INTO followup_queue (lead_id, scheduled_at, template_key)
      VALUES (?, datetime(?), ?)
    `).run(leadId, scheduledAt.toISOString(), templateKey);
  },

  markSent(id, messagePreview) {
    getDb().prepare(`
      UPDATE followup_queue SET status = 'sent', sent_at = datetime('now'), message_preview = ? WHERE id = ?
    `).run(messagePreview, id);
  },

  cancel(leadId) {
    getDb().prepare(`
      UPDATE followup_queue SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'
    `).run(leadId);
  },

  getPending() {
    return getDb().prepare(`
      SELECT fq.*, l.phone, l.name, l.language, l.treatment_interest, l.followup_count
      FROM followup_queue fq
      JOIN leads l ON l.id = fq.lead_id
      WHERE fq.status = 'pending' AND fq.scheduled_at <= datetime('now')
      ORDER BY fq.scheduled_at ASC
      LIMIT 50
    `).all();
  }
};

module.exports = {
  getDb,
  LeadOps,
  ConversationOps,
  AppointmentOps,
  PatientOps,
  AnalyticsOps,
  FollowupOps
};
