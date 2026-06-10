# GUIDE — Connecter WhatsApp au Bot Denti Luxe
## Numéro dédié au bot : +212772207947

> Objectif : quand un client clique sur ta pub WhatsApp et envoie un message,
> l'agent IA répond automatiquement en < 30 secondes.

---

## ⚠️ AVANT DE COMMENCER — Libérer le numéro

Le numéro +212772207947 ne doit PAS être actif sur l'app WhatsApp normale.
Si tu as WhatsApp installé avec ce numéro :

1. Ouvre WhatsApp → Paramètres → Compte → **Supprimer mon compte**
2. Entre le numéro → confirme
3. Le numéro est maintenant libre pour la Cloud API

(Si ce numéro n'a jamais eu WhatsApp, passe directement à l'étape 1.)

---

## ÉTAPE 1 — Créer l'app Meta (10 min)

1. Va sur → https://developers.facebook.com
2. Connecte-toi avec ton compte Facebook
3. En haut à droite → **"My Apps"** → **"Create App"**
4. Cas d'usage : choisis **"Other"** → **"Next"**
5. Type : **"Business"** → **"Next"**
6. Nom de l'app : `Denti Luxe Bot`
7. Email de contact : le tien
8. Compte business : crée-en un si demandé (nom : Denti Luxe)
9. Clique **"Create App"**

✅ Tu arrives sur le dashboard de ton app.

---

## ÉTAPE 2 — Ajouter WhatsApp (5 min)

1. Sur le dashboard de l'app → descends jusqu'à **"Add a product"**
2. Trouve la carte **"WhatsApp"** → clique **"Set up"**
3. Sélectionne ton Business Account → **"Continue"**

✅ Tu arrives sur **"WhatsApp > API Setup"**.
Tu vois :
- Un numéro de TEST gratuit fourni par Meta
- Un "Temporary access token"
- Une section "Send and receive messages"
- Des IDs : "Phone number ID" et "WhatsApp Business Account ID"

---

## ÉTAPE 3 — Récupérer les 3 infos importantes

Sur cette page "API Setup", note (copie) :

| Info | Où la trouver |
|------|---------------|
| **Temporary access token** | En haut, bouton "Copy" (valable 24h — on fera un token permanent après) |
| **Phone number ID** | Sous "From", le numéro `Phone number ID: 1234...` |
| **WhatsApp Business Account ID** | Plus bas dans la page |

⚠️ Le token temporaire expire en 24h. On le remplacera par un token PERMANENT
à l'étape 6. Mais pour tester, le temporaire suffit.

---

## ÉTAPE 4 — Configurer le webhook (5 min)

1. Sur la page WhatsApp → menu gauche → **"Configuration"**
2. Section **"Webhook"** → clique **"Edit"**
3. Callback URL :
   ```
   https://denti-luxe-theme-production.up.railway.app/webhooks/whatsapp
   ```
4. Verify token :
   ```
   denti_luxe_secret_2024
   ```
5. Clique **"Verify and save"**
   → Si ça réussit, le webhook est connecté ✅
6. Juste en dessous → **"Webhook fields"** → trouve **"messages"** → clique **"Subscribe"**

---

## ÉTAPE 5 — Ajouter les variables sur Railway (5 min)

1. Va sur Railway → ton projet → onglet **"Variables"**
2. Ajoute / vérifie ces variables :

```
WHATSAPP_TOKEN            = (le Temporary access token de l'étape 3)
WHATSAPP_PHONE_ID         = (le Phone number ID de l'étape 3)
WHATSAPP_VERIFY_TOKEN     = denti_luxe_secret_2024
OWNER_WHATSAPP            = +212772207947
```

3. Railway redémarre automatiquement (1-2 min).

---

## ÉTAPE 6 — TEST : l'agent répond

Sur la page "API Setup", section "Send and receive messages" :
1. Ajoute ton téléphone personnel comme "To" (numéro de test autorisé)
2. Avec ton téléphone perso, envoie un WhatsApp au numéro de test Meta :
   ```
   Salam bghit n3rf 3la les facettes
   ```
3. **L'agent doit répondre en < 30 secondes** en darija/français 🎉

Si ça marche → la boucle complète fonctionne !

---

## ÉTAPE 7 — Token PERMANENT (important, sinon ça coupe après 24h)

Le token temporaire expire. Pour un token qui ne meurt jamais :

1. Va sur → https://business.facebook.com/settings
2. Menu gauche → **"Users"** → **"System users"**
3. Clique **"Add"** → nom : `denti-luxe-bot` → rôle : **Admin** → crée
4. Sélectionne ce system user → **"Add assets"** → choisis ton app → coche "Manage"
5. Clique **"Generate new token"**
6. Sélectionne ton app
7. Permissions : coche **`whatsapp_business_messaging`** et **`whatsapp_business_management`**
8. Génère → **COPIE le token** (il ne s'affiche qu'une fois !)
9. Sur Railway → remplace `WHATSAPP_TOKEN` par ce nouveau token permanent

✅ Maintenant le bot tourne pour toujours.

---

## ÉTAPE 8 — Passer en production (envoyer à tout le monde)

Par défaut, le bot ne répond qu'aux numéros de test. Pour répondre à TOUS les clients :

1. Ajoute ton vrai numéro +212772207947 :
   - Page WhatsApp → "API Setup" → "Add phone number"
   - Entre +212772207947 → vérifie par SMS/appel
2. Demande l'accès avancé :
   - App → **"App Review"** → demande `whatsapp_business_messaging`
   - Remplis le formulaire (cas d'usage : prise de RDV dentaire)
   - Soumets → approbation 1-4 semaines
3. Pendant l'attente, le bot marche déjà avec les numéros de test.

---

## ÉTAPE 9 — Créer la pub Click-to-WhatsApp

Une fois le bot connecté :
1. Meta Ads Manager → **"Créer"**
2. Objectif : **"Engagement"** → **"Messages"**
3. Destination : **"WhatsApp"** → sélectionne ton numéro
4. Message d'accueil pré-rempli : `Salam, bghit n3rf 3la les facettes 😊`
5. Créatif : utilise les visuels de `scripts/meta-ad-creatives.md`
6. Budget : 100 DH/jour
7. Lance 🚀

→ Le client clique "Envoyer un message" → WhatsApp s'ouvre → il envoie →
   l'agent répond automatiquement → qualifie → prend le RDV.

---

## RÉCAP DES VARIABLES RAILWAY FINALES

```
ANTHROPIC_API_KEY      = sk-ant-xxx
API_SECRET_KEY         = DentiLuxe2024Secret
NODE_ENV               = production
COMMISSION_RATE        = 0.20
OWNER_WHATSAPP         = +212772207947
WHATSAPP_TOKEN         = (token permanent)
WHATSAPP_PHONE_ID      = (phone number ID)
WHATSAPP_VERIFY_TOKEN  = denti_luxe_secret_2024
```
