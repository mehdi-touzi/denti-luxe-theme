require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Client Claude à initialisation paresseuse.
 *
 * Le SDK Anthropic lève une erreur dès la construction si ANTHROPIC_API_KEY
 * est absente. En instanciant le client au premier appel (et non au chargement
 * du module), le serveur peut démarrer — et passer son healthcheck — même avant
 * que la clé ne soit configurée (ex. premier déploiement Railway). Les appels IA
 * échouent alors proprement via les try/catch des agents, avec messages de repli.
 */
let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configurée — agent IA indisponible');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

module.exports = { getClient, isConfigured };
