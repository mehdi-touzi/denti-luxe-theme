require('dotenv').config();
const { getClient } = require('./claude-client');
const { LeadOps, ConversationOps, AppointmentOps, FollowupOps } = require('../db/database');
const { WHATSAPP_SYSTEM_PROMPT } = require('../config/prompts');
const axios = require('axios');

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

// ========================================
// DÉTECTION DE LANGUE
// ========================================
function detectLanguage(text) {
  const arabizi = /[0-9]{1,2}|[3679]/.test(text) && /[a-zA-Z]/.test(text);
  const arabic = /[؀-ۿ]/.test(text);
  const french = /\b(bonjour|merci|je|vous|les|des|pour|avec|dans|sur|est|pas|plus|bien|que|qui|comment|quand|où|prix|rendez|voudrais|voudrais|information)\b/i.test(text);
  const darija = /\b(salam|wach|bghit|3andi|3andek|mzyan|mezyan|kayen|daba|hna|smea|inshallah|mashallah|walou|bzzaf|shwiya|golili|ntshawfo)\b/i.test(text);

  if (arabizi && french) return 'mixed';
  if (darija && french) return 'mixed';
  if (arabic) return 'arabic';
  if (arabizi || darija) return 'darija';
  if (french) return 'fr';
  return 'mixed';
}

// ========================================
// ENVOI MESSAGE WHATSAPP
// ========================================
async function sendWhatsAppMessage(phone, text) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[WhatsApp MOCK] → ${phone}: ${text}`);
    return { success: true, mock: true };
  }

  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phone.replace('+', '').replace(/\s/g, ''),
        type: 'text',
        text: { body: text, preview_url: false }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    console.error('[WhatsApp] Erreur envoi:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// ========================================
// AGENT PRINCIPAL — TRAITEMENT MESSAGE
// ========================================
async function processInboundMessage(phone, messageText, messageId = null) {
  // 1. Trouver ou créer le lead
  let lead = LeadOps.findByPhone(phone);
  const isNew = !lead;

  if (isNew) {
    lead = LeadOps.create({
      phone,
      name: null,
      source: 'whatsapp',
      utm_campaign: null,
      utm_content: null,
      language: detectLanguage(messageText),
      treatment_interest: null,
      city: null,
      meta_lead_id: null
    });
    // Programmer les relances automatiques
    FollowupOps.schedule(lead.id, 'day1', 1);
    FollowupOps.schedule(lead.id, 'day3', 3);
    FollowupOps.schedule(lead.id, 'day7', 7);
    FollowupOps.schedule(lead.id, 'day14', 14);
  }

  // Mettre à jour la langue si détection plus précise maintenant
  const detectedLang = detectLanguage(messageText);
  if (detectedLang !== lead.language) {
    LeadOps.update(lead.id, { language: detectedLang });
    lead.language = detectedLang;
  }

  // 2. Sauvegarder le message entrant
  ConversationOps.save({
    lead_id: lead.id,
    direction: 'inbound',
    message_id: messageId,
    content: messageText,
    media_type: 'text',
    agent_type: 'whatsapp',
    sentiment: null,
    intent: null,
    tokens_used: 0
  });

  // 3. Construire l'historique de conversation pour le contexte
  const history = ConversationOps.getLastN(lead.id, 12);
  const conversationHistory = history
    .filter(m => m.content !== messageText || m.direction !== 'inbound')
    .map(m => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content
    }));

  // Ajouter le message actuel
  conversationHistory.push({ role: 'user', content: messageText });

  // 4. Contexte lead pour l'agent
  const leadContext = `
CONTEXTE LEAD ACTUEL :
- ID: ${lead.id}
- Statut: ${lead.status}
- Température: ${lead.temperature}
- Langue détectée: ${lead.language}
- Traitement intérêt: ${lead.treatment_interest || 'inconnu'}
- Ville: ${lead.city || 'inconnue'}
- Budget: ${lead.budget_range || 'inconnu'}
- Nombre de messages précédents: ${history.length}
- Client nouveau: ${isNew ? 'OUI' : 'NON'}
- Score: ${lead.lead_score}
`;

  // 5. Appel Claude
  let agentResponse;
  let tokensUsed = 0;

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: WHATSAPP_SYSTEM_PROMPT + '\n\n' + leadContext + '\n\nRéponds UNIQUEMENT avec un JSON valide.',
      messages: conversationHistory
    });

    tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    const rawContent = response.content[0].text.trim();

    // Parser la réponse JSON
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      agentResponse = JSON.parse(jsonMatch[0]);
    } else {
      agentResponse = { message: rawContent, intent: 'inquiry', extracted: {}, lead_update: {}, next_action: 'wait' };
    }
  } catch (error) {
    console.error('[WhatsApp Agent] Erreur Claude:', error.message);
    // Fallback message
    const fallbacks = {
      fr: 'Bonjour ! Je suis Sofia de Denti Luxe 😊 Merci de nous avoir contacté. Je reviens vers vous dans quelques instants !',
      darija: 'Salam! Ana Sofia mn Denti Luxe 😊 Shukran 3la t2assal. Ghadi nrja3 3lik daba shwiya!',
      mixed: 'Salam! Ana Sofia mn Denti Luxe 😊 Merci du contact! Ghadi nrja3 3lik très vite!'
    };
    agentResponse = {
      message: fallbacks[lead.language] || fallbacks.mixed,
      intent: 'inquiry',
      extracted: {},
      lead_update: {},
      next_action: 'wait'
    };
  }

  // 6. Mettre à jour le lead avec les infos extraites
  const updates = {};
  if (agentResponse.extracted?.treatment) updates.treatment_interest = agentResponse.extracted.treatment;
  if (agentResponse.extracted?.city) updates.city = agentResponse.extracted.city;
  if (agentResponse.extracted?.urgency) updates.urgency = agentResponse.extracted.urgency;
  if (agentResponse.extracted?.budget_range) updates.budget_range = agentResponse.extracted.budget_range;
  if (agentResponse.lead_update?.status) updates.status = agentResponse.lead_update.status;
  if (agentResponse.lead_update?.temperature) updates.temperature = agentResponse.lead_update.temperature;

  // Si RDV booking détecté
  if (agentResponse.extracted?.appointment_date && agentResponse.extracted?.appointment_time) {
    updates.status = 'appointment_set';
    updates.temperature = 'hot';

    // Créer le RDV en base
    const dentistId = lead.assigned_dentist || 1;
    const scheduledAt = `${agentResponse.extracted.appointment_date} ${agentResponse.extracted.appointment_time}`;
    const appointment = AppointmentOps.create({
      lead_id: lead.id,
      dentist_id: dentistId,
      scheduled_at: scheduledAt,
      duration_min: 60,
      treatment: agentResponse.extracted.treatment || 'Consultation',
      notes: 'RDV pris via WhatsApp bot'
    });

    // Programmer les rappels
    FollowupOps.schedule(lead.id, 'pre_appointment_24h', 0);
    // Annuler les relances marketing (lead déjà converti)
    FollowupOps.cancel(lead.id);

    // Notifier le propriétaire
    notifyOwner(`🔥 NOUVEAU RDV!\nLead: ${phone}\nRDV: ${scheduledAt}\nTraitement: ${agentResponse.extracted.treatment || 'N/A'}`);
  }

  updates.last_contact = new Date().toISOString();
  updates.followup_count = (lead.followup_count || 0) + 1;

  // Qualifier automatiquement si assez d'infos
  if (updates.treatment_interest && updates.city && !['appointment_set', 'treated'].includes(updates.status)) {
    if (!updates.status) updates.status = 'qualified';
    if (!updates.temperature) updates.temperature = 'warm';
  }

  if (Object.keys(updates).length > 0) {
    LeadOps.update(lead.id, updates);
    LeadOps.updateScore(lead.id);
  }

  // 7. Sauvegarder la réponse sortante
  ConversationOps.save({
    lead_id: lead.id,
    direction: 'outbound',
    message_id: null,
    content: agentResponse.message,
    media_type: 'text',
    agent_type: 'whatsapp',
    sentiment: null,
    intent: agentResponse.intent,
    tokens_used: tokensUsed
  });

  // 8. Envoyer la réponse WhatsApp
  const sendResult = await sendWhatsAppMessage(phone, agentResponse.message);

  return {
    success: sendResult.success,
    leadId: lead.id,
    isNewLead: isNew,
    intent: agentResponse.intent,
    nextAction: agentResponse.next_action
  };
}

// ========================================
// AGENT RELANCES AUTOMATIQUES
// ========================================
async function processFollowups() {
  const pending = FollowupOps.getPending();
  console.log(`[Followup Agent] ${pending.length} relances à envoyer`);

  for (const followup of pending) {
    try {
      const message = await generateFollowupMessage(followup);
      const result = await sendWhatsAppMessage(followup.phone, message);

      if (result.success) {
        FollowupOps.markSent(followup.fq_id || followup.id, message.substring(0, 100));
        LeadOps.update(followup.lead_id, {
          last_contact: new Date().toISOString(),
          followup_count: (followup.followup_count || 0) + 1
        });
      }

      // Pause entre messages pour éviter spam
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`[Followup] Erreur pour lead ${followup.lead_id}:`, error.message);
    }
  }

  return pending.length;
}

async function generateFollowupMessage(followup) {
  const { FOLLOWUP_TEMPLATES } = require('../config/prompts');
  const template = FOLLOWUP_TEMPLATES[followup.template_key];

  if (!template) {
    throw new Error(`Template inconnu: ${followup.template_key}`);
  }

  const lang = followup.language || 'mixed';
  let baseMessage = template[lang] || template.mixed || template.fr;

  // Personnalisation avec le nom si disponible
  if (followup.name) {
    baseMessage = baseMessage.replace(/^(Salam|Bonjour)!/, `$1 ${followup.name.split(' ')[0]}!`);
  }

  // Personnalisation traitement si disponible
  if (followup.treatment_interest) {
    baseMessage = baseMessage.replace('les facettes', `les ${followup.treatment_interest}`);
  }

  return baseMessage;
}

// ========================================
// NOTIFICATION PROPRIÉTAIRE
// ========================================
async function notifyOwner(message) {
  const ownerPhone = process.env.OWNER_WHATSAPP;
  if (ownerPhone) {
    await sendWhatsAppMessage(ownerPhone, `🤖 DENTI LUXE BOT\n${message}`);
  }
}

module.exports = {
  processInboundMessage,
  processFollowups,
  sendWhatsAppMessage,
  detectLanguage
};
