require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './db/denti_luxe.db';

function migrate() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ========================================
    -- DENTISTES PARTENAIRES
    -- ========================================
    CREATE TABLE IF NOT EXISTS dentists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      phone       TEXT,
      clinic      TEXT,
      city        TEXT DEFAULT 'Casablanca',
      specialties TEXT DEFAULT 'facettes,blanchiment',
      commission_rate REAL DEFAULT 0.20,
      capacity_per_day INTEGER DEFAULT 5,
      is_active   INTEGER DEFAULT 1,
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- LEADS (prospects entrants)
    -- ========================================
    CREATE TABLE IF NOT EXISTS leads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phone           TEXT UNIQUE NOT NULL,
      name            TEXT,
      source          TEXT DEFAULT 'whatsapp',
      utm_campaign    TEXT,
      utm_content     TEXT,
      status          TEXT DEFAULT 'new',
      -- new | contacted | qualified | appointment_set | treated | lost | cold
      temperature     TEXT DEFAULT 'warm',
      -- hot | warm | cold
      language        TEXT DEFAULT 'mixed',
      -- fr | darija | arabizi | mixed
      treatment_interest TEXT,
      budget_range    TEXT,
      urgency         TEXT DEFAULT 'medium',
      -- high | medium | low
      city            TEXT,
      lead_score      INTEGER DEFAULT 0,
      assigned_dentist INTEGER REFERENCES dentists(id),
      last_contact    TEXT,
      next_followup   TEXT,
      followup_count  INTEGER DEFAULT 0,
      notes           TEXT,
      meta_lead_id    TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- CONVERSATIONS WHATSAPP
    -- ========================================
    CREATE TABLE IF NOT EXISTS conversations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id     INTEGER REFERENCES leads(id),
      direction   TEXT NOT NULL,
      -- inbound | outbound
      message_id  TEXT UNIQUE,
      content     TEXT NOT NULL,
      media_type  TEXT,
      -- text | image | audio | video
      agent_type  TEXT DEFAULT 'whatsapp',
      sentiment   TEXT,
      -- positive | neutral | negative
      intent      TEXT,
      -- inquiry | qualification | objection | booking | confirmation | thanks
      tokens_used INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- RENDEZ-VOUS
    -- ========================================
    CREATE TABLE IF NOT EXISTS appointments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id         INTEGER REFERENCES leads(id),
      dentist_id      INTEGER REFERENCES dentists(id),
      scheduled_at    TEXT NOT NULL,
      duration_min    INTEGER DEFAULT 60,
      treatment       TEXT,
      status          TEXT DEFAULT 'scheduled',
      -- scheduled | confirmed | completed | no_show | cancelled | rescheduled
      reminder_sent_24h INTEGER DEFAULT 0,
      reminder_sent_2h  INTEGER DEFAULT 0,
      confirmed_by_patient INTEGER DEFAULT 0,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- PATIENTS TRAITÉS (revenus confirmés)
    -- ========================================
    CREATE TABLE IF NOT EXISTS patients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id         INTEGER REFERENCES leads(id),
      dentist_id      INTEGER REFERENCES dentists(id),
      treatment       TEXT NOT NULL,
      treatment_date  TEXT,
      amount_dh       REAL NOT NULL,
      commission_rate REAL DEFAULT 0.20,
      commission_dh   REAL,
      commission_paid INTEGER DEFAULT 0,
      commission_paid_date TEXT,
      satisfaction    INTEGER,
      -- 1-5
      referral_count  INTEGER DEFAULT 0,
      referred_by     INTEGER REFERENCES leads(id),
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- CAMPAGNES PUBLICITAIRES META
    -- ========================================
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      meta_campaign_id TEXT UNIQUE,
      name            TEXT NOT NULL,
      objective       TEXT DEFAULT 'LEAD_GENERATION',
      status          TEXT DEFAULT 'active',
      budget_dh       REAL,
      start_date      TEXT,
      end_date        TEXT,
      target_audience TEXT,
      creative_notes  TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ad_metrics (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id     INTEGER REFERENCES ad_campaigns(id),
      date            TEXT NOT NULL,
      spend_dh        REAL DEFAULT 0,
      impressions     INTEGER DEFAULT 0,
      clicks          INTEGER DEFAULT 0,
      leads_count     INTEGER DEFAULT 0,
      cpm_dh          REAL,
      cpc_dh          REAL,
      cpl_dh          REAL,
      roas            REAL,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(campaign_id, date)
    );

    -- ========================================
    -- SUIVI DES RELANCES AUTOMATIQUES
    -- ========================================
    CREATE TABLE IF NOT EXISTS followup_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id         INTEGER REFERENCES leads(id),
      scheduled_at    TEXT NOT NULL,
      template_key    TEXT NOT NULL,
      -- day1 | day3 | day7 | day14 | pre_appointment | post_appointment | referral_ask
      status          TEXT DEFAULT 'pending',
      -- pending | sent | cancelled | failed
      sent_at         TEXT,
      message_preview TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- CONTENU GÉNÉRÉ (Reels, posts, stories)
    -- ========================================
    CREATE TABLE IF NOT EXISTS content_calendar (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      type            TEXT NOT NULL,
      -- reel | post | story | broadcast
      platform        TEXT NOT NULL,
      -- instagram | facebook | whatsapp
      title           TEXT,
      content         TEXT NOT NULL,
      hashtags        TEXT,
      scheduled_at    TEXT,
      status          TEXT DEFAULT 'draft',
      -- draft | scheduled | published | archived
      engagement      TEXT,
      -- JSON: {likes, comments, shares, reach}
      created_by      TEXT DEFAULT 'content-agent',
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- PARRAINAGES
    -- ========================================
    CREATE TABLE IF NOT EXISTS referrals (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id     INTEGER REFERENCES leads(id),
      referred_id     INTEGER REFERENCES leads(id),
      reward_dh       REAL DEFAULT 50,
      reward_paid     INTEGER DEFAULT 0,
      reward_paid_date TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- ANALYTICS QUOTIDIENNES (snapshot)
    -- ========================================
    CREATE TABLE IF NOT EXISTS daily_analytics (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      date            TEXT UNIQUE NOT NULL,
      new_leads       INTEGER DEFAULT 0,
      qualified_leads INTEGER DEFAULT 0,
      appointments    INTEGER DEFAULT 0,
      treated_patients INTEGER DEFAULT 0,
      no_shows        INTEGER DEFAULT 0,
      total_revenue_dh REAL DEFAULT 0,
      total_commission_dh REAL DEFAULT 0,
      ad_spend_dh     REAL DEFAULT 0,
      roas            REAL,
      avg_response_time_sec INTEGER,
      conversion_rate REAL,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ========================================
    -- INDEX pour performances
    -- ========================================
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(temperature);
    CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup);
    CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_followup_queue_status ON followup_queue(status, scheduled_at);
  `);

  // Données initiales : dentistes partenaires (exemple)
  const existingDentist = db.prepare('SELECT id FROM dentists WHERE id = 1').get();
  if (!existingDentist) {
    db.prepare(`
      INSERT INTO dentists (name, phone, clinic, city, specialties, capacity_per_day)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Dr. Partenaire 1', '+212600000001', 'Cabinet Central', 'Casablanca', 'facettes,blanchiment,composites', 6);
  }

  console.log('✅ Base de données initialisée avec succès');
  db.close();
}

migrate();
module.exports = { migrate };
