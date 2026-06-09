const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { LeadOps, FollowupOps } = require('../db/database');
const { processInboundMessage } = require('../agents/whatsapp-agent');

// ========================================
// VÉRIFICATION SIGNATURE META
// ========================================
function verifyMetaSignature(req, rawBody) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !process.env.META_APP_SECRET) return true; // skip if not configured

  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ========================================
// LEADS FORMS META ADS — Réception instantanée
// ========================================
router.post('/leads', express.raw({ type: 'application/json' }), async (req, res) => {
  res.sendStatus(200);

  try {
    const body = JSON.parse(req.body);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;

        const leadData = change.value;
        const { leadgen_id, form_id, page_id, created_time } = leadData;

        console.log(`[Meta Leads] Nouveau lead form: ${leadgen_id}`);

        // Récupérer les détails du lead via Meta API
        try {
          const axios = require('axios');
          const response = await axios.get(
            `https://graph.facebook.com/v18.0/${leadgen_id}`,
            {
              params: {
                access_token: process.env.META_ACCESS_TOKEN,
                fields: 'field_data,created_time,ad_id,campaign_id,form_id'
              }
            }
          );

          const metaLead = response.data;
          const fields = {};
          (metaLead.field_data || []).forEach(f => {
            fields[f.name.toLowerCase().replace(/\s/g, '_')] = f.values?.[0];
          });

          const phone = fields.phone_number || fields.phone || fields.numéro || fields.numero;
          const name = fields.full_name || fields.name || fields.nom || null;
          const city = fields.city || fields.ville || null;

          if (!phone) {
            console.warn('[Meta Leads] Lead sans téléphone:', fields);
            continue;
          }

          // Créer le lead dans le CRM
          let lead = LeadOps.findByPhone(phone);
          if (!lead) {
            lead = LeadOps.create({
              phone: phone.startsWith('+') ? phone : `+212${phone.replace(/^0/, '')}`,
              name,
              source: 'meta_leads',
              utm_campaign: metaLead.campaign_id || null,
              utm_content: metaLead.ad_id || null,
              language: 'mixed',
              treatment_interest: fields.treatment || fields.traitement || null,
              city,
              meta_lead_id: leadgen_id
            });

            // Programmer les relances
            FollowupOps.schedule(lead.id, 'day1', 1);
            FollowupOps.schedule(lead.id, 'day3', 3);
            FollowupOps.schedule(lead.id, 'day7', 7);

            // Envoyer le message de bienvenue immédiatement
            const welcomeMessages = {
              mixed: `Salam! Ana Sofia mn Denti Luxe 😊 Merci du contact via notre pub! Wach bghiti t3rf plus 3la les facettes dentaires?`
            };
            await processInboundMessage(
              lead.phone,
              '[META_LEAD_FORM]',
              leadgen_id
            );

            console.log(`[Meta Leads] Lead créé: ${lead.id} (${phone})`);
          } else {
            console.log(`[Meta Leads] Lead existant: ${lead.id} (${phone})`);
          }
        } catch (apiError) {
          console.error('[Meta Leads] Erreur API Meta:', apiError.message);
        }
      }
    }
  } catch (error) {
    console.error('[Meta Leads Webhook] Erreur:', error.message);
  }
});

// ========================================
// VÉRIFICATION META WEBHOOK
// ========================================
router.get('/leads', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

module.exports = router;
