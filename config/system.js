/**
 * Configuration centrale du système Denti Luxe
 * Modifiez ici les paramètres business sans toucher au code
 */

module.exports = {
  business: {
    name: 'Denti Luxe',
    country: 'MA',
    currency: 'DH',
    timezone: 'Africa/Casablanca',
    commissionRate: parseFloat(process.env.COMMISSION_RATE || '0.20'),
    referralRewardDh: 200,
    language: ['fr', 'darija', 'arabizi', 'mixed']
  },

  treatments: {
    'facettes composites': { minPrice: 3200, maxPrice: 5000, duration: 60, popular: true },
    'facettes céramiques': { minPrice: 8000, maxPrice: 15000, duration: 90, popular: false },
    'blanchiment': { minPrice: 800, maxPrice: 1200, duration: 45, popular: true },
    'couronne esthétique': { minPrice: 3000, maxPrice: 6000, duration: 90, popular: false },
    'implant': { minPrice: 8000, maxPrice: 15000, duration: 120, popular: false },
    'consultation': { minPrice: 0, maxPrice: 0, duration: 30, popular: true }
  },

  leadScoring: {
    temperature: { hot: 40, warm: 20, cold: 0 },
    urgency: { high: 30, medium: 15, low: 5 },
    hasInterest: 10,
    hasBudget: 10,
    hasCity: 5,
    perConversation: 2,
    maxConversationBonus: 10
  },

  followup: {
    delays: [1, 3, 7, 14],
    maxAttempts: 4,
    sendHour: 10, // 10h du matin heure Maroc
    stopOnStatus: ['appointment_set', 'treated', 'lost']
  },

  kpiTargets: {
    roas: 10,
    cpl: 50,
    conversionRate: 30,
    noShowRate: 10,
    avgResponseTimeSec: 120,
    avgTicketDh: 2000
  },

  meta: {
    apiVersion: 'v18.0',
    webhookFields: ['messages', 'leadgen']
  },

  agents: {
    model: 'claude-sonnet-4-6',
    whatsapp: { maxTokens: 500, temperature: 0.7 },
    analytics: { maxTokens: 1000, temperature: 0.3 },
    content: { maxTokens: 800, temperature: 0.9 },
    ceo: { maxTokens: 1000, temperature: 0.4 }
  },

  cities: [
    'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger',
    'Agadir', 'Meknès', 'Oujda', 'Kénitra', 'Tétouan'
  ]
};
