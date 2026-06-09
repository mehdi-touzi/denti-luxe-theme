require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors());

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Trop de requêtes' }
}));

// Rate limiting strict pour les webhooks Meta
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200
});

// Parser JSON sauf pour les webhooks Meta (qui ont besoin du raw body)
app.use((req, res, next) => {
  if (req.path.includes('/webhooks/meta')) return next();
  express.json({ limit: '10mb' })(req, res, next);
});

// ========================================
// ROUTES STATIQUES — Dashboard
// ========================================
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));

// Page d'accueil redirige vers dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// ========================================
// WEBHOOKS META
// ========================================
app.use('/webhooks/whatsapp', webhookLimiter, require('./webhooks/whatsapp'));
app.use('/webhooks/meta', webhookLimiter, require('./webhooks/meta-leads'));

// ========================================
// API INTERNE
// ========================================
app.use('/api', require('./routes/api'));

// ========================================
// SANTÉ DU SERVEUR
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Denti Luxe Automation',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ========================================
// GESTION ERREURS
// ========================================
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ========================================
// DÉMARRAGE
// ========================================
async function start() {
  // Initialiser la base de données
  try {
    require('./db/migrations').migrate();
  } catch (e) {
    console.log('DB déjà initialisée ou', e.message);
  }

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║     🦷 DENTI LUXE AUTOMATION v2      ║
╠══════════════════════════════════════╣
║  Serveur    : http://localhost:${PORT}  ║
║  Dashboard  : http://localhost:${PORT}/dashboard  ║
║  Health     : http://localhost:${PORT}/health     ║
║  WhatsApp   : POST /webhooks/whatsapp ║
║  Meta Leads : POST /webhooks/meta/leads║
╚══════════════════════════════════════╝
    `);

    // Démarrer l'orchestrateur des agents
    const { startOrchestrator } = require('./agents/orchestrator');
    startOrchestrator();
  });
}

start().catch(console.error);

module.exports = app;
