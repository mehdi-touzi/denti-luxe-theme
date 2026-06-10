const express = require('express');
const router = express.Router();
const { processInboundMessage } = require('../agents/whatsapp-agent');

// ========================================
// VÉRIFICATION WEBHOOK META (setup initial)
// ========================================
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Webhook vérifié ✅');
    res.status(200).send(challenge);
  } else {
    console.warn('[WhatsApp Webhook] Vérification échouée');
    res.sendStatus(403);
  }
});

// ========================================
// RÉCEPTION MESSAGES ENTRANTS
// ========================================
router.post('/webhook', async (req, res) => {
  // Répondre immédiatement 200 à Meta (obligatoire < 5s)
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Ignorer les statuts de livraison (read, delivered, sent)
        if (value.statuses) continue;

        for (const message of value.messages || []) {
          const phone = message.from;
          const messageId = message.id;
          const timestamp = message.timestamp;

          // Types de messages supportés
          let text = null;

          if (message.type === 'text') {
            text = message.text.body;
          } else if (message.type === 'interactive') {
            // Boutons ou listes de réponse
            text = message.interactive?.button_reply?.title
              || message.interactive?.list_reply?.title
              || '[interaction]';
          } else if (message.type === 'image' || message.type === 'video') {
            text = '[Photo/Vidéo reçue]';
          } else if (message.type === 'audio') {
            text = '[Message vocal reçu]';
          } else {
            text = '[Message non textuel]';
          }

          if (text && phone) {
            console.log(`[WhatsApp] Message reçu de ${phone}: ${text.substring(0, 50)}`);

            // Traiter de manière asynchrone
            processInboundMessage(phone, text, messageId).catch(err => {
              console.error('[WhatsApp] Erreur traitement:', err.message);
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] Erreur:', error.message);
  }
});

module.exports = router;
