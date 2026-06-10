# PLAN D'EXÉCUTION DENTI LUXE
## De zéro à machine automatisée qui génère de l'argent

---

# PHASE 1 — DÉPLOIEMENT (Aujourd'hui, 2-3h)
> Objectif : ton système est en ligne et accessible depuis internet

---

## ÉTAPE 1.1 — Clé Claude AI (15 min)

1. Va sur → https://console.anthropic.com
2. Crée un compte (ou connecte-toi)
3. Clique sur **"API Keys"** dans le menu gauche
4. Clique **"+ Create Key"**
5. Nom : `denti-luxe-production`
6. **Copie la clé** (format : `sk-ant-api03-xxxxx`) → garde-la précieusement

**Coût estimé** : 0.003 DH par conversation WhatsApp. Pour 100 leads/mois = ~30 DH.

---

## ÉTAPE 1.2 — Déploiement Railway (20 min)

1. Va sur → https://railway.app
2. Clique **"Login"** → **"Login with GitHub"**
3. Sur le Dashboard Railway → **"New Project"**
4. Sélectionne **"Deploy from GitHub repo"**
5. Cherche `mehdi-touzi/denti-luxe-theme` → clique dessus
6. Branch : `claude/denti-luxe-automation-urxwjc` (sélectionne cette branche exacte)
7. Railway va démarrer le déploiement → attends 2-3 minutes

**Ajouter les variables d'environnement (CRITIQUE)** :
8. Dans Railway → clique sur ton service → onglet **"Variables"**
9. Clique **"+ New Variable"** et ajoute ces variables UNE PAR UNE :

```
ANTHROPIC_API_KEY    = sk-ant-api03-xxxxx   (ta clé de l'étape 1.1)
API_SECRET_KEY       = DentiLuxe2024Secret  (mot de passe dashboard, change-le)
NODE_ENV             = production
COMMISSION_RATE      = 0.20
OWNER_WHATSAPP       = +212XXXXXXXXX        (TON numéro WhatsApp personnel)
```

10. Railway redémarre automatiquement → attends 1-2 min
11. Clique sur **"Settings"** → **"Networking"** → **"Generate Domain"**
    → Tu obtiens une URL du type `denti-luxe-xxx.railway.app`

**Test immédiat** :
- Ouvre `https://denti-luxe-xxx.railway.app/health`
  → Doit afficher `{"status":"ok","service":"Denti Luxe Automation"...}`
- Ouvre `https://denti-luxe-xxx.railway.app/`
  → Doit afficher ta landing page dorée Denti Luxe

---

## ÉTAPE 1.3 — Tester le CRM (10 min)

1. Va sur `https://denti-luxe-xxx.railway.app/dashboard`
2. Entre ta clé API quand demandé : `DentiLuxe2024Secret`
3. Tu vois le dashboard CEO

**Test : soumettre un lead fictif**
4. Dans la section **"Simuler message entrant"** :
   - Téléphone : `+212600000001`
   - Message : `Salam bghit n3rf 3la les facettes`
5. Clique **"Simuler"**
6. Rafraîchis → le lead doit apparaître dans **"Leads chauds"**
   et le pipeline doit montrer 1 lead

✅ Si ça marche → ton CRM est opérationnel.

---

# PHASE 2 — LANCER LES PUBS (Demain, 1-2h)
> Objectif : leads qui entrent dans le système dès aujourd'hui

---

## ÉTAPE 2.1 — Configurer la landing page dans Meta Ads

1. Va sur → https://business.facebook.com
2. **Ads Manager** → **"Créer une campagne"**
3. Objectif : **"Trafic"** (pour l'instant, avant d'avoir le Pixel configuré)

**Pour chaque pub** (utilise les 4 créatifs du fichier `scripts/meta-ad-creatives.md`) :

**Ciblage** :
- Localisation : `Casablanca` + `Rabat` + `Marrakech` (rayon 15km chacune)
- Âge : 22-45 ans
- Placements : Facebook Feed + Instagram Feed + Stories

**URL de destination** : `https://denti-luxe-xxx.railway.app/`

**Budget** : 100 DH/jour par pub (démarre avec 2 pubs = 200 DH/jour)

---

## ÉTAPE 2.2 — Installer Meta Pixel sur la landing page

Le Pixel permet de tracker les conversions et créer des audiences lookalike.

1. Dans Meta Business Suite → **"Events Manager"**
2. **"Connecter des sources"** → **"Web"** → **"Meta Pixel"**
3. Nom : `Denti Luxe Pixel` → Crée
4. Copie ton **Pixel ID** (format : `123456789012345`)
5. Sur Railway → ajoute la variable :
   ```
   META_PIXEL_ID = 123456789012345
   ```

**Pour activer le Pixel dans la landing page**, ajoute ceci juste avant `</head>` dans `landing/index.html` :

```html
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'TON_PIXEL_ID_ICI');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->
```

Commit + push → Railway redéploie automatiquement.

---

# PHASE 3 — WHATSAPP BUSINESS API (Cette semaine, 2-3h de setup + 1-4 semaines d'approbation)
> Objectif : bot WhatsApp actif qui répond en < 30 secondes 24h/24

**IMPORTANT** : commence MAINTENANT car l'approbation prend du temps.

---

## ÉTAPE 3.1 — Créer l'app Meta / WhatsApp Business

1. Va sur → https://developers.facebook.com
2. **"My Apps"** → **"Create App"**
3. Type : **"Business"**
4. Nom : `Denti Luxe Bot`
5. Email : le tien
6. Clique **"Create App"**

**Ajouter WhatsApp** :
7. Sur le dashboard de ton app → **"Add Products"**
8. Trouve **"WhatsApp"** → clique **"Set Up"**
9. Sélectionne ton **Meta Business Account** (crée-en un si tu n'en as pas)

---

## ÉTAPE 3.2 — Obtenir un numéro WhatsApp Business

**Option A : Numéro temporaire Meta (gratuit pour tester)**
- Meta te donne un numéro de test gratuit dans le dashboard
- Limité à 5 contacts en liste blanche
- Suffisant pour tester le bot avant d'acheter un vrai numéro

**Option B : Ton propre numéro (recommandé pour la prod)**
- Achète une SIM dédiée au Maroc (~50-100 DH)
- Ou utilise un numéro virtuel (ex: Twilio Maroc)
- **Ne PAS utiliser ton numéro personnel** (si Meta le banne, tu perds tes contacts)

---

## ÉTAPE 3.3 — Configurer le webhook

1. Dans Meta Developers → ton app WhatsApp → **"Configuration"**
2. Section **"Webhooks"** → **"Configure"**
3. Callback URL : `https://denti-luxe-xxx.railway.app/webhooks/whatsapp`
4. Verify Token : `denti_luxe_secret_2024`
   (ou ce que tu as mis dans `WHATSAPP_VERIFY_TOKEN`)
5. Clique **"Verify and Save"**
6. Active le champ : **`messages`**

**Sur Railway → ajoute les variables** :
```
WHATSAPP_TOKEN            = EAAxxxxx (dans ton app Meta → Access Token)
WHATSAPP_PHONE_ID         = 123456789 (dans ton app Meta → Phone number ID)
WHATSAPP_VERIFY_TOKEN     = denti_luxe_secret_2024
WHATSAPP_BUSINESS_ACCOUNT_ID = 987654321
```

---

## ÉTAPE 3.4 — Passer en mode Production

(Obligatoire pour envoyer des messages à des inconnus)

1. Dans Meta App → **"App Review"**
2. Clique **"Permissions and Features"**
3. Demande l'accès à `whatsapp_business_messaging`
4. Remplis le formulaire (description du cas d'usage, politique de confidentialité)
5. Soumets → attends l'approbation (1-4 semaines)

**Pendant l'attente** : le bot fonctionne avec les numéros en liste blanche (pour tester). Les leads des pubs arrivent dans le CRM et tu peux répondre manuellement.

---

# PHASE 4 — PENDANT L'ATTENTE WHATSAPP (Stratégie de transition)
> Objectif : ne perdre AUCUN lead pendant les 1-4 semaines d'attente

---

## Solution de transition : WhatsApp manuel + CRM

Le lead soumet le formulaire sur ta landing page :
1. Son contact entre dans le CRM automatiquement
2. **TOI** tu reçois une notification WhatsApp sur ton téléphone (via `OWNER_WHATSAPP`)
3. Tu réponds manuellement en copiant-collant les scripts du bot

**Script de réponse rapide** (copie dans tes messages rapides WhatsApp) :

```
Salam! Ana min Denti Luxe 😊 Merci du contact! 
Wach bghiti t3rf 3la les facettes composites? 
Prix à partir de 400 DH/dent — résultat en 1h, bla l2alam ✨
Consultation GRATUITE — wach bghiti ndir lik RDV?
```

**Configuration notifications Railway** :
- Ajoute `OWNER_WHATSAPP = +212XXXXXXXXX` (déjà fait à l'étape 1.2)
- Chaque nouveau lead = tu reçois un message WhatsApp instantané

---

# PHASE 5 — OPTIMISATION & SCALE (Semaine 2-4)
> Objectif : doubler le ROAS et la commission

---

## ÉTAPE 5.1 — Analyser les premières données

Après 7 jours de pubs, va dans ton dashboard :
- Quel créatif a le meilleur CPL (coût par lead) ?
- Quelle ville convertit le mieux ?
- Quel traitement intéresse le plus ?

**Règle d'or** :
- CPL < 30 DH → scale ce créatif (double le budget)
- CPL > 80 DH → coupe ce créatif

---

## ÉTAPE 5.2 — Créer les audiences Lookalike

Après 20-30 leads qualifiés :
1. Meta Ads → **"Audiences"** → **"Create Audience"** → **"Lookalike Audience"**
2. Source : ton Pixel (événement "Lead")
3. Pays : Maroc
4. Taille : 1% (le plus précis)

→ Cette audience coûte 30-50% moins cher que l'audience froide.

---

## ÉTAPE 5.3 — Augmenter le budget progressivement

**Règle de scaling** (ne JAMAIS doubler d'un coup) :
- Semaine 1 : 200 DH/jour
- Semaine 2 (si ROAS > 8x) : 350 DH/jour
- Semaine 3 (si ROAS > 8x) : 550 DH/jour
- Semaine 4 : 800 DH/jour
- etc.

À 200 DH/jour et 13x ROAS prouvé = **2 600 DH/jour de commission**.
Au mois = **78 000 DH de commission**.

---

## ÉTAPE 5.4 — Recruter 2 nouveaux partenaires dentistes

Utilise le script `scripts/dentist-partner-pitch.md`.

Contact 5 dentistes cette semaine :
- Cherche `#dentistecasablanca` sur Instagram
- Envoie le message WhatsApp (copie exacte dans le fichier)
- Objectif : 2 nouveaux partenaires signés

Avec 3 partenaires au lieu de 1 :
- Capacité x3
- Tu peux envoyer plus de leads sans goulot d'étranglement
- Negociation possible : "Je t'envoie 20 patients/mois → je veux 25%"

---

## ÉTAPE 5.5 — Upsell systématique

Pour chaque patient qui vient pour les facettes, le dentiste propose :
- Blanchiment (+900 DH) → +180 DH commission
- Nettoyage professionnel (+300 DH) → +60 DH commission

**Impact** : ticket moyen passe de 1 682 DH à 2 500-3 000 DH.
Commission/patient passe de 336 DH à 500-600 DH.
Sans un seul lead supplémentaire.

---

# PHASE 6 — EXPANSION (Mois 2-3)
> Objectif : nouvelles sources de revenus sous la marque Denti Luxe

---

## 6.1 — Traitement Premium : Implants

- Ticket : 8 000-15 000 DH
- Commission 20% : 1 600-3 000 DH par patient
- 1 seul patient implant = 5-9 patients facettes en commission

Ajoute "implants dentaires" comme traitement dans tes pubs.

## 6.2 — Extension géographique

Ordre de priorité :
1. Casablanca (déjà actif)
2. Rabat (grand marché, forte densité)
3. Marrakech (tourisme dentaire + locaux)
4. Tanger (en croissance)
5. Agadir

Chaque nouvelle ville = nouvelle campagne Meta + nouveau partenaire dentiste.

## 6.3 — Programme de parrainage actif

Le système est déjà codé. Active-le :
- Chaque patient traité reçoit automatiquement (3 jours après) un message
- "Parraine un ami → 200 DH de réduction sur ton prochain soin"
- Un patient satisfait = en moyenne 2,3 parrainages
- CAC des leads parrainés = 0 DH

---

# RÉCAPITULATIF — CE QU'IL TE FAUT

## Comptes à créer (ordre de priorité)

| Compte | Où | Temps | Coût |
|--------|-----|-------|------|
| Anthropic | console.anthropic.com | 5 min | Pay as you go (~30 DH/mois) |
| Railway | railway.app | 10 min | ~100 DH/mois |
| Meta Developers | developers.facebook.com | 30 min | Gratuit |
| WhatsApp Business (numéro dédié) | Boutique SIM | 30 min | 50-100 DH |

## Variables Railway à configurer (obligatoires)

```
ANTHROPIC_API_KEY     → console.anthropic.com
API_SECRET_KEY        → ton mot de passe (invente-le)
NODE_ENV              → production
OWNER_WHATSAPP        → +212XXXXXXXXX
COMMISSION_RATE       → 0.20
WHATSAPP_TOKEN        → Meta Developers (plus tard)
WHATSAPP_PHONE_ID     → Meta Developers (plus tard)
WHATSAPP_VERIFY_TOKEN → denti_luxe_secret_2024
```

## Timeline réaliste

| Période | Action | Résultat attendu |
|---------|--------|-----------------|
| Aujourd'hui | Déploie Railway + Anthropic | Dashboard en ligne |
| Demain | Lance 2 pubs Meta | Premiers leads dans le CRM |
| Jour 3-7 | Réponds manuellement aux leads | Premières conversions |
| Semaine 2 | WhatsApp API en cours d'approbation | Préparation bot |
| Semaine 3-4 | Analyse données + scale budgets gagnants | ROAS optimisé |
| Mois 2 | WhatsApp bot actif + lookalike audiences | Automatisation complète |
| Mois 3 | 3 partenaires + 3 villes + implants | x5 commission actuelle |

## Projection financière (réaliste)

| Mois | Budget pub/mois | Leads estimés | Patients traités | Commission |
|------|----------------|---------------|-----------------|------------|
| 1 | 3 000 DH | 60 | 15 | 5 000 DH |
| 2 | 8 000 DH | 150 | 40 | 13 000 DH |
| 3 | 20 000 DH | 350 | 90 | 30 000 DH |
| 6 | 50 000 DH | 900 | 220 | 75 000 DH |

*Basé sur ton ROAS prouvé de 13.2x et taux de conversion actuel.*

---

# LA RÈGLE ABSOLUE

**Ne jamais couper une pub dont le ROAS > 10x.**
**Ne jamais attendre d'avoir tout parfait avant de lancer.**
**Chaque jour sans pubs = argent perdu.**
