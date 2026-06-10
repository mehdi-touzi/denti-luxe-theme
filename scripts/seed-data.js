/**
 * Données de test — simule une semaine d'activité Denti Luxe
 * Usage: node scripts/seed-data.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('../db/migrations').migrate();

const { getDb, LeadOps, ConversationOps, AppointmentOps, PatientOps, FollowupOps } = require('../db/database');

const db = getDb();

const mockLeads = [
  { phone: '+212661234567', name: 'Fatima Z.', source: 'instagram', language: 'mixed', treatment_interest: 'facettes composites', city: 'Casablanca', status: 'hot', temperature: 'hot', urgency: 'high' },
  { phone: '+212662345678', name: 'Nadia M.', source: 'facebook', language: 'fr', treatment_interest: 'blanchiment', city: 'Rabat', status: 'qualified', temperature: 'warm' },
  { phone: '+212663456789', name: 'Karim B.', source: 'whatsapp', language: 'darija', treatment_interest: 'facettes composites', city: 'Casablanca', status: 'appointment_set', temperature: 'hot' },
  { phone: '+212664567890', name: 'Sara A.', source: 'meta_leads', language: 'mixed', treatment_interest: 'facettes composites', city: 'Marrakech', status: 'treated', temperature: 'warm' },
  { phone: '+212665678901', name: 'Yasmine L.', source: 'instagram', language: 'fr', treatment_interest: null, city: null, status: 'new', temperature: 'warm' },
  { phone: '+212666789012', name: 'Amine R.', source: 'whatsapp', language: 'arabizi', treatment_interest: 'facettes céramiques', city: 'Fès', status: 'qualified', temperature: 'hot' },
  { phone: '+212667890123', name: 'Houda K.', source: 'facebook', language: 'mixed', treatment_interest: 'blanchiment', city: 'Casablanca', status: 'treated', temperature: 'warm' },
  { phone: '+212668901234', name: 'Omar S.', source: 'meta_leads', language: 'darija', treatment_interest: null, city: 'Rabat', status: 'cold', temperature: 'cold' },
  { phone: '+212669012345', name: 'Meryem T.', source: 'instagram', language: 'fr', treatment_interest: 'facettes composites', city: 'Casablanca', status: 'new', temperature: 'hot' },
  { phone: '+212660123456', name: 'Aicha D.', source: 'whatsapp', language: 'mixed', treatment_interest: 'facettes composites', city: 'Agadir', status: 'new', temperature: 'warm' },
];

const sampleConversations = [
  { direction: 'inbound', content: 'Salam! bghit n3rf 3la les facettes', intent: 'inquiry' },
  { direction: 'outbound', content: 'Salam! Ana Sofia mn Denti Luxe 😊 Les facettes composites kaybeddlo smile f séance wahda...', intent: 'inquiry' },
  { direction: 'inbound', content: 'wach cher? chhal kaykolef?', intent: 'qualification' },
  { direction: 'outbound', content: 'Les facettes kaybdaw mn 400 DH par dent. Pour 8 dents complets: 3200 DH. Kayna aussi facilité de paiement 😊', intent: 'qualification' },
  { direction: 'inbound', content: 'mzeyan, bghit ndir rendez-vous', intent: 'booking' },
  { direction: 'outbound', content: 'Excellent! Wach momkin Saturday 10h f cabinet Casablanca Centre?', intent: 'booking' },
];

console.log('🌱 Seed data Denti Luxe...\n');

// Vider les données existantes (dev only)
if (process.env.NODE_ENV !== 'production') {
  db.exec(`
    DELETE FROM patients; DELETE FROM appointments; DELETE FROM conversations;
    DELETE FROM followup_queue; DELETE FROM leads WHERE id > 1;
  `);
}

// Insérer les leads
for (const leadData of mockLeads) {
  const existing = LeadOps.findByPhone(leadData.phone);
  if (existing) continue;

  const lead = LeadOps.create({
    phone: leadData.phone,
    name: leadData.name,
    source: leadData.source,
    utm_campaign: null,
    utm_content: null,
    language: leadData.language,
    treatment_interest: leadData.treatment_interest,
    city: leadData.city,
    meta_lead_id: null
  });

  LeadOps.update(lead.id, {
    status: leadData.status,
    temperature: leadData.temperature,
    urgency: leadData.urgency || 'medium'
  });

  // Ajouter conversations
  for (const conv of sampleConversations.slice(0, 3 + Math.floor(Math.random() * 4))) {
    ConversationOps.save({
      lead_id: lead.id,
      direction: conv.direction,
      message_id: null,
      content: conv.content,
      media_type: 'text',
      agent_type: 'whatsapp',
      sentiment: null,
      intent: conv.intent,
      tokens_used: 150
    });
  }

  // RDV pour les leads avec appointment_set
  if (leadData.status === 'appointment_set') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    AppointmentOps.create({
      lead_id: lead.id,
      dentist_id: 1,
      scheduled_at: tomorrow.toISOString(),
      duration_min: 60,
      treatment: leadData.treatment_interest || 'Consultation',
      notes: 'RDV seed'
    });
  }

  // Patients traités
  if (leadData.status === 'treated') {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 20));

    PatientOps.create({
      lead_id: lead.id,
      dentist_id: 1,
      treatment: leadData.treatment_interest || 'facettes composites',
      treatment_date: pastDate.toISOString().split('T')[0],
      amount_dh: leadData.treatment_interest?.includes('blanchiment') ? 900 : 3200,
      commission_rate: 0.20,
      commission_dh: leadData.treatment_interest?.includes('blanchiment') ? 180 : 640
    });
  }

  LeadOps.updateScore(lead.id);
  console.log(`✅ Lead créé: ${leadData.name} (${leadData.phone}) — ${leadData.status}`);
}

// Métriques pub fictives
const today = new Date();
for (let i = 0; i < 30; i++) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const dateStr = d.toISOString().split('T')[0];

  try {
    db.prepare(`
      INSERT OR IGNORE INTO ad_metrics (campaign_id, date, spend_dh, impressions, clicks, leads_count)
      VALUES (1, ?, ?, ?, ?, ?)
    `).run(dateStr,
      Math.round(8 + Math.random() * 12),
      Math.round(1200 + Math.random() * 800),
      Math.round(30 + Math.random() * 50),
      Math.round(0 + Math.random() * 3)
    );
  } catch(e) {}
}

// Campagne par défaut
try {
  db.prepare(`
    INSERT OR IGNORE INTO ad_campaigns (id, name, meta_campaign_id, objective, budget_dh, start_date)
    VALUES (1, 'Facettes Composites — Casablanca', 'META001', 'LEAD_GENERATION', 300, date('now', '-30 days'))
  `).run();
} catch(e) {}

console.log('\n✅ Seed terminé! Lancez: node server.js');
