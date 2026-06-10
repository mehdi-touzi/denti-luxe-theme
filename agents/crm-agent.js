require('dotenv').config();
const { LeadOps, AppointmentOps, PatientOps, FollowupOps, ConversationOps } = require('../db/database');
const { sendWhatsAppMessage } = require('./whatsapp-agent');

// ========================================
// PIPELINE CRM — VUE KANBAN
// ========================================
function getPipeline() {
  return {
    new: LeadOps.getByStatus('new'),
    contacted: LeadOps.getByStatus('contacted'),
    qualified: LeadOps.getByStatus('qualified'),
    appointment_set: LeadOps.getByStatus('appointment_set'),
    treated: LeadOps.getByStatus('treated'),
    cold: LeadOps.getByStatus('cold'),
    lost: LeadOps.getByStatus('lost')
  };
}

// ========================================
// RAPPELS RENDEZ-VOUS AUTOMATIQUES
// ========================================
async function sendAppointmentReminders() {
  let sent = 0;

  // Rappels 24h avant
  const upcoming24h = AppointmentOps.getUpcoming(25).filter(a => !a.reminder_sent_24h);
  for (const apt of upcoming24h) {
    const time = new Date(apt.scheduled_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
    const messages = {
      fr: `Bonjour ! Rappel de votre rendez-vous demain 😊 ${time} au ${apt.clinic || 'cabinet partenaire Denti Luxe'}. À demain !`,
      darija: `Salam! Rappel maw3id ghedda ${time} f ${apt.clinic || 'cabinet Denti Luxe'} 😊 Ntshawfo!`,
      mixed: `Salam! Rappel ton RDV ghedda ${time} — ${apt.clinic || 'Denti Luxe'} 😊 À demain!`
    };

    const lead = LeadOps.findByPhone(apt.phone);
    const lang = lead?.language || 'mixed';
    const message = messages[lang] || messages.mixed;

    const result = await sendWhatsAppMessage(apt.phone, message);
    if (result.success) {
      AppointmentOps.update(apt.id, { reminder_sent_24h: 1 });
      sent++;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  // Rappels 2h avant
  const upcoming2h = AppointmentOps.getUpcoming(2.5).filter(a => a.reminder_sent_24h && !a.reminder_sent_2h);
  for (const apt of upcoming2h) {
    const time = new Date(apt.scheduled_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
    const messages = {
      fr: `Votre rendez-vous est dans 2h ! 😊 ${time} - ${apt.clinic || 'cabinet Denti Luxe'}. On vous attend !`,
      darija: `Maw3id dyalek f 2h! ${time} - ${apt.clinic || 'Denti Luxe'} 😊`,
      mixed: `RDV f 2h — ${time} à ${apt.clinic || 'Denti Luxe'} 😊 À toute!`
    };

    const lead = LeadOps.findByPhone(apt.phone);
    const lang = lead?.language || 'mixed';
    const message = messages[lang] || messages.mixed;

    const result = await sendWhatsAppMessage(apt.phone, message);
    if (result.success) {
      AppointmentOps.update(apt.id, { reminder_sent_2h: 1 });
      sent++;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  return sent;
}

// ========================================
// DÉTECTION NO-SHOWS
// ========================================
async function handleNoShows() {
  const noShows = AppointmentOps.getNoShows();
  let processed = 0;

  for (const apt of noShows) {
    AppointmentOps.update(apt.id, { status: 'no_show' });
    LeadOps.update(apt.lead_id, { status: 'cold', temperature: 'cold' });

    // Message de récupération no-show
    const messages = {
      fr: `Bonjour ! On ne vous a pas vu aujourd'hui pour votre rendez-vous 😊 Pas de souci, ça arrive ! Je peux vous proposer un autre créneau si vous souhaitez toujours transformer votre sourire ?`,
      darija: `Salam! Ma shoufnakch l yom 😊 Mashi mushkil! Wach bghiti ndir lik maw3id akhor bach tobdl smile dyalek?`,
      mixed: `Salam! On vous a pas vu aujourd'hui 😊 Pas de souci! Wach bghiti un autre créneau?`
    };

    const lead = LeadOps.findByPhone(apt.phone);
    const lang = lead?.language || 'mixed';
    await sendWhatsAppMessage(apt.phone, messages[lang] || messages.mixed);

    // Reprogrammer une relance dans 2 jours
    FollowupOps.schedule(apt.lead_id, 'day3', 2);
    processed++;

    await new Promise(r => setTimeout(r, 2000));
  }

  return processed;
}

// ========================================
// DEMANDE D'AVIS APRÈS TRAITEMENT
// ========================================
async function requestPatientReview(leadId) {
  const lead = LeadOps.findByPhone(
    require('../db/database').getDb().prepare('SELECT phone FROM leads WHERE id = ?').get(leadId)?.phone || ''
  );

  if (!lead) return;

  const messages = {
    fr: `Bonjour ! J'espère que vous êtes ravi(e) de votre nouveau sourire ✨ Votre avis compte beaucoup pour nous et aide d'autres personnes à franchir le pas. Pourriez-vous partager votre expérience sur notre page Google ? Merci infiniment ! 🙏`,
    darija: `Salam! Inshallah ma3jbak smile dyalek l jdid ✨ Ra'yak muhim bzzaf — wach momkin tktb chi kelmtin 3la Google dyalna? Shukran bzaf! 🙏`,
    mixed: `Salam! On espère que vous adorez votre nouveau smile ✨ Wach momkin ktb avis sur notre Google? Katsa3ed bzzaf! 🙏`
  };

  const lang = lead.language || 'mixed';
  await sendWhatsAppMessage(lead.phone, messages[lang] || messages.mixed);
}

// ========================================
// DEMANDE PARRAINAGE
// ========================================
async function requestReferral(leadId) {
  const db = require('../db/database').getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) return;

  const messages = {
    fr: `Bonjour ! Content que vous soyez satisfait ✨ Saviez-vous que si vous recommandez Denti Luxe à un(e) ami(e) qui se fait traiter, vous gagnez 200 DH de réduction sur votre prochain soin ? Partagez juste notre numéro ! 😊`,
    darija: `Salam! Mabsout bli 3jbak ✨ Wach 3arfti: ila 3refti shi saheb yjib l Denti Luxe, ghadi trbah 200 DH réduction f prochain soin! Dir share l numero dyalna 😊`,
    mixed: `Salam! Ravi que vous adorez ✨ Rappel: si tu parrain un ami → -200 DH sur prochain soin. Share just notre numéro! 😊`
  };

  const lang = lead.language || 'mixed';
  await sendWhatsAppMessage(lead.phone, messages[lang] || messages.mixed);
}

// ========================================
// SCORING ET PRIORISATION
// ========================================
function prioritizeLeads() {
  const hot = LeadOps.getHotLeads();
  const pipeline = getPipeline();

  return {
    immediate_action: hot.slice(0, 5),
    in_qualification: pipeline.qualified.slice(0, 10),
    pending_appointment: pipeline.appointment_set,
    to_recover: pipeline.cold.filter(l => l.followup_count < 3).slice(0, 5),
    total_active: hot.length + pipeline.qualified.length
  };
}

// ========================================
// MARQUER PATIENT TRAITÉ
// ========================================
function markPatientTreated(leadId, treatmentData) {
  const { dentistId, treatment, amountDh, treatmentDate } = treatmentData;

  const patient = PatientOps.create({
    lead_id: leadId,
    dentist_id: dentistId,
    treatment,
    treatment_date: treatmentDate || new Date().toISOString().split('T')[0],
    amount_dh: amountDh,
    commission_rate: parseFloat(process.env.COMMISSION_RATE || '0.20'),
    commission_dh: amountDh * parseFloat(process.env.COMMISSION_RATE || '0.20'),
    referred_by: null,
    notes: null
  });

  LeadOps.update(leadId, { status: 'treated', temperature: 'warm' });
  FollowupOps.cancel(leadId);

  // Programmer la demande d'avis + parrainage
  setTimeout(() => requestPatientReview(leadId), 24 * 60 * 60 * 1000); // 24h après
  setTimeout(() => requestReferral(leadId), 3 * 24 * 60 * 60 * 1000); // 3 jours après

  return patient;
}

module.exports = {
  getPipeline,
  sendAppointmentReminders,
  handleNoShows,
  requestPatientReview,
  requestReferral,
  prioritizeLeads,
  markPatientTreated
};
