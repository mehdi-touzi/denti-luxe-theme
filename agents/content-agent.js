require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../db/database');
const { CONTENT_SYSTEM_PROMPT } = require('../config/prompts');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ========================================
// GÉNÉRATION DE CONTENU
// ========================================
async function generateContent(type, platform, context = {}) {
  const prompts = {
    reel_avant_apres: `Génère un script Reel Instagram avant/après pour des facettes dentaires.
      Hook fort les 3 premières secondes. Durée: 30-45 secondes.
      Inclure: hook, problème, solution, CTA.
      Langue: mélange naturel français + darija marocaine.
      ${context.patientCount ? `Contexte: déjà ${context.patientCount} patients transformés` : ''}`,

    post_educatif: `Génère un post carrousel Instagram éducatif sur: ${context.topic || 'facettes composites vs céramiques'}.
      7 slides maximum. Slide 1 = hook accrocheur. Slide finale = CTA consultation gratuite.
      Style: professionnel mais accessible. Langue: français avec touches de darija.`,

    broadcast_whatsapp: `Génère un message WhatsApp broadcast naturel pour des prospects qui n'ont pas encore réservé.
      Max 150 mots. Doit paraître personnel, pas publicitaire.
      Langue: ${context.language || 'mélange français + darija'}.
      Objectif: ${context.objective || 'réactiver les leads tièdes'}`,

    story_sondage: `Génère 3 questions sondage Instagram Story pour engager l'audience autour du sourire et des facettes dentaires.
      Questions simples, binaires (oui/non ou A/B).
      Langue: français + darija naturel.`,

    testimonial: `Génère un témoignage patient fictif mais réaliste pour Denti Luxe.
      Profil: ${context.profile || 'femme 28 ans Casablanca'}.
      Traitement: ${context.treatment || 'facettes composites 8 dents'}.
      Format: 3-4 phrases naturelles, émotionnel, authentique.
      Langue: ${context.language || 'français'}`,

    caption_photo: `Génère une légende Instagram pour une photo de transformation sourire.
      ${context.description || 'Avant: dents légèrement irrégulières. Après: sourire parfait aligné.'}
      Include: storytelling, hashtags pertinents Maroc, CTA doux.
      Langue: ${context.language || 'mélange français + darija'}`
  };

  const prompt = prompts[type] || `Génère du contenu ${type} pour ${platform} pour Denti Luxe Maroc.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    // Sauvegarder en base
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO content_calendar (type, platform, title, content, created_by)
      VALUES (?, ?, ?, ?, 'content-agent')
    `).run(type, platform, `${type} - ${new Date().toLocaleDateString('fr-MA')}`, content);

    return {
      id: result.lastInsertRowid,
      type,
      platform,
      content,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Content Agent] Erreur:', error.message);
    throw error;
  }
}

// ========================================
// CALENDRIER ÉDITORIAL HEBDOMADAIRE
// ========================================
async function generateWeeklyCalendar() {
  const plan = [
    { day: 'Lundi', type: 'reel_avant_apres', platform: 'instagram' },
    { day: 'Mardi', type: 'post_educatif', platform: 'facebook', context: { topic: 'les facettes composites — tout savoir' } },
    { day: 'Mercredi', type: 'story_sondage', platform: 'instagram' },
    { day: 'Jeudi', type: 'broadcast_whatsapp', platform: 'whatsapp', context: { objective: 'relancer les leads de la semaine dernière' } },
    { day: 'Vendredi', type: 'testimonial', platform: 'instagram' },
    { day: 'Samedi', type: 'reel_avant_apres', platform: 'instagram', context: { special: 'weekend engagement' } },
    { day: 'Dimanche', type: 'caption_photo', platform: 'facebook' }
  ];

  const results = [];
  for (const item of plan) {
    try {
      const content = await generateContent(item.type, item.platform, item.context || {});
      results.push({ ...item, contentId: content.id, preview: content.content.substring(0, 100) + '...' });
      // Pause pour ne pas surcharger l'API
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      results.push({ ...item, error: error.message });
    }
  }

  return results;
}

// ========================================
// CONTENU URGENCE (offres limitées)
// ========================================
async function generateUrgencyContent(offer) {
  const context = {
    offer: offer || '3 créneaux consultation gratuite disponibles cette semaine',
    urgency: 'limitée',
    language: 'mixed'
  };

  return generateContent('broadcast_whatsapp', 'whatsapp', {
    objective: `Communiquer l'offre: ${context.offer}`,
    language: context.language
  });
}

// ========================================
// OPTIMISATION COPY ADS META
// ========================================
async function generateAdCopy(variant = 1) {
  const variants = {
    1: 'accrocheur émotionnel — axé transformation',
    2: 'social proof — chiffres et témoignages',
    3: 'éducatif — comment ça marche',
    4: 'urgence — offre limitée'
  };

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Génère une publicité Facebook/Instagram (style ${variants[variant] || variants[1]}) pour Denti Luxe.
Format:
- TITRE (max 40 caractères)
- DESCRIPTION (max 125 caractères)
- CTA bouton: [Réserver] ou [En savoir plus]
- TEXTE du post (max 300 mots)
Langue: mélange naturel français + darija marocaine`
      }]
    });

    return {
      variant,
      style: variants[variant],
      copy: response.content[0].text,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    throw error;
  }
}

// ========================================
// RÉCUPÉRER LE CONTENU PLANIFIÉ
// ========================================
function getScheduledContent(platform = null, limit = 10) {
  const db = getDb();
  const query = platform
    ? `SELECT * FROM content_calendar WHERE platform = ? AND status = 'draft' ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM content_calendar WHERE status = 'draft' ORDER BY created_at DESC LIMIT ?`;

  return platform
    ? db.prepare(query).all(platform, limit)
    : db.prepare(query).all(limit);
}

module.exports = {
  generateContent,
  generateWeeklyCalendar,
  generateUrgencyContent,
  generateAdCopy,
  getScheduledContent
};
