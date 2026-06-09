# Denti Luxe — Architecture Système IA

## Vue d'ensemble

```
                    ┌─────────────────────────────────────┐
                    │        DENTI LUXE AUTOMATION         │
                    │     Machine semi-autonome v2.0       │
                    └─────────────────────────────────────┘

  ENTRÉES (LEADS)              AGENTS IA               SORTIES (ACTIONS)
  ─────────────────            ──────────              ──────────────────
  Instagram Ads  ──┐
  Facebook Ads  ──┤           ┌──────────┐            ┌─ WhatsApp auto
  Meta Lead Forms─┤──────────►│ Orches-  │────────────► Rappels RDV
  WhatsApp direct─┤           │ trateur  │            ├─ Rapport CEO
  Organique ──────┘           └────┬─────┘            ├─ Alertes
                                   │                   └─ Contenu social
                         ┌─────────┼──────────┐
                         ▼         ▼          ▼
                   ┌─────────┐ ┌──────┐ ┌─────────┐
                   │WhatsApp │ │ CRM  │ │Analytics│
                   │ Agent   │ │Agent │ │  Agent  │
                   └────┬────┘ └──┬───┘ └────┬────┘
                        │         │           │
                   ┌────▼─────────▼───────────▼────┐
                   │       BASE DE DONNÉES SQLite    │
                   │  leads | conversations | rdv    │
                   │  patients | contenu | analytics │
                   └────────────────────────────────┘
```

## 8 Agents IA

| Agent | Rôle | Fréquence | Modèle |
|-------|------|-----------|--------|
| **WhatsApp Agent** | Réponse auto, qualification, booking | Temps réel | Claude Sonnet |
| **Followup Agent** | Relances J+1/3/7/14 | Toutes les 5 min | Templates + Claude |
| **CRM Agent** | Rappels RDV, no-shows, parrainage | 30 min | Rule-based |
| **Analytics Agent** | KPIs, ROAS, alertes | 08h + 10h | Claude Sonnet |
| **Content Agent** | Posts, Reels, broadcasts | À la demande | Claude Sonnet |
| **Orchestrator** | Coordonne tous les agents | Permanent | Cron + Logic |
| **CEO Agent** | Rapport quotidien, décisions | 08h00 | Claude Sonnet |
| **Meta Leads Agent** | Ingestion leads Meta Ads | Webhook temps réel | Rule-based |

## Flux principal d'un lead

```
1. Lead arrive (WhatsApp / Meta Form)
   ↓
2. Création en BDD + détection langue (fr/darija/arabizi/mixed)
   ↓
3. WhatsApp Agent répond en < 30 secondes
   ↓
4. Conversation multi-tours : qualification automatique
   (traitement, ville, budget, urgence)
   ↓
5. Lead score mis à jour (0-100)
   ↓
6. Si qualifié → proposition RDV
   ↓
7. RDV créé → relances automatiques 24h + 2h avant
   ↓
8. Patient traité → commission enregistrée
   ↓
9. Demande avis (J+1) + parrainage (J+3)
   ↓
10. Analytics mis à jour → rapport CEO
```

## Variables d'environnement requises

```
ANTHROPIC_API_KEY      # Claude AI (obligatoire)
WHATSAPP_TOKEN         # WhatsApp Business API
WHATSAPP_PHONE_ID      # Numéro Business
WHATSAPP_VERIFY_TOKEN  # Sécurité webhook
META_ACCESS_TOKEN      # Meta Ads API (optionnel)
OWNER_WHATSAPP         # Votre numéro pour rapports
API_SECRET_KEY         # Sécurité API interne
```

## Déploiement rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos clés

# 3. Initialiser la base de données
npm run migrate

# 4. (Optionnel) Charger des données de test
npm run seed

# 5. Démarrer le serveur
npm start

# 6. Configurer les webhooks Meta
# → WhatsApp: https://votre-domaine.com/webhooks/whatsapp
# → Meta Leads: https://votre-domaine.com/webhooks/meta/leads
```

## Endpoints API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `GET /dashboard` | GET | Stats globales CEO |
| `GET /api/leads` | GET | Liste des leads |
| `GET /api/leads/hot` | GET | Leads prioritaires |
| `POST /api/simulate-message` | POST | Tester le bot |
| `POST /api/send-message` | POST | Message manuel |
| `POST /api/patients/treated` | POST | Confirmer traitement |
| `GET /api/analytics/report` | GET | Rapport IA |
| `POST /api/content/generate` | POST | Générer contenu |
| `GET /api/orchestrator/status` | GET | Status agents |

## ROI estimé du système

| Levier | Impact estimé/mois |
|--------|-------------------|
| Réponse < 30s (vs minutes) | +40% conversion |
| Relances automatiques | +25% leads récupérés |
| Zéro no-show manqué | +15% CA |
| Parrainage automatisé | -20% CAC |
| **Total estimé** | **+80-100% commission** |
