# Chefup — contexte du projet

App SaaS de calcul de marges pour restaurateurs, nom commercial **Chefup** (ne jamais
traduire ce nom, dans aucune langue). React + Vite, déployée sur Vercel, code sur GitHub
(dépôt encore nommé `marge-cuisine` — pas renommé, `gh`/`vercel` CLI absents de l'environnement), branche `main`.

**📖 Historique détaillé** : `docs/HISTORIQUE-FONCTIONNALITES.md` contient le récit complet, session par session, de chaque fonctionnalité/bug/décision depuis le début du projet — **pas chargé automatiquement** (contrairement à ce fichier). Lis-le seulement si tu as besoin du détail exact d'un point résumé ci-dessous (raisonnement d'une décision, code précis d'un correctif passé, etc.).

## Fichiers clés
- `src/App.jsx` — cœur de l'application (composant `App`, état/handlers). Depuis le découpage du 2026-08-28 (9020→5131 lignes), la plupart des sous-composants/utilitaires vivent dans des fichiers dédiés réexportés depuis `App.jsx` pour compat (`TR`, `ALLERGEN_LABELS`, `TIER_COLORS`, `PRICING`, `BRAND_SOLID`/`BRAND_GRADIENT`/`BRAND_SHADOW`, `Logo`, `categoryLabel`) : `src/translations.js`, `src/catalog.js`, `src/seedData.js`, `src/pricing.js`, `src/brand.js`, `src/formComponents.jsx` (NumField/QtyField/QuickAddLine/IngredientPicker), `src/utils.js`, `src/Logo.jsx`, `src/scannerComponents.jsx` (composants scanner/carte digitale), `src/adminAndOnboarding.jsx` (AdminDashboard, FirstRunWizard), `src/MenuWizard.jsx` (assistant carte digitale).
  **⚠️ Piège déjà rencontré 2x** : un identifiant utilisé dans un fichier extrait sans y être importé ne casse PAS le build (Vite ne le détecte pas), seulement à l'exécution → écran blanc. Script de garde `check_undefined.js` (scratchpad) à relancer après toute extraction/déplacement de code.
  **⚠️ Autre piège déjà rencontré 2x** : ne jamais brancher un `onClick` directement sur une fonction qui accepte un paramètre (`onClick={fn}` passe l'event comme argument) — toujours `onClick={() => fn()}`.
  **⚠️ Règle anti-bug "+70%"** : ne jamais écrire dans un historique de prix (`ing.history`, `item.priceHistory`...) sur `onChange` d'un champ numérique (se déclenche à chaque frappe) — toujours sur `onCommit`/blur.
- `src/Landing.jsx` — page d'accueil publique, affichée par `AuthGate` tant qu'aucune session n'existe. Calculateur de marge interactif en première position (`MarginCalculator`), offre de lancement, pixel pub TikTok optionnel (`src/adPixel.js`, inerte sans `VITE_TIKTOK_PIXEL_ID`).
- `src/MenuWizard.jsx` — assistant guidé 4 étapes de création de carte digitale (nom du resto → plats en rafale avec sections → design → QR code), navigation libre entre étapes, tout enregistré au fil de l'eau. Bascule vers le mode avancé (`DigitalMenuModal`, réglages complets) une fois `menuSettings.setupDone`.
- `api/scan-invoice.js` — lit les factures scannées via **Claude Sonnet 5** (depuis 2026-08-25, palier "high-resolution" 2576px, plus fiable que Haiku sur factures denses ; `temperature` non supporté par Sonnet 5 sur cet endpoint, `thinking: disabled` explicite). Accepte image (photo), PDF brut (`pdfBase64`, lu nativement par Claude — `pdfjs-dist` entièrement retiré du projet depuis le 2026-08-25) ou texte PDF natif.
- `api/scan-recipe.js` — lit une fiche technique/recette existante scannée pour pré-remplir une recette. Isolé de `scan-invoice.js` (autre prompt). Bouton d'accès retiré de l'UI (2026-08-18, jugé pas assez utile par l'utilisateur) mais code intact.
- `api/send-reminders.js` — cron Vercel quotidien (`vercel.json`, 08h UTC) + POST authentifié pour mail de bienvenue programmé : rappel d'inactivité, digest marge sous objectif (2 lectures consécutives requises, anti faux-positif), relance J-2 avant fin d'essai, mail fin d'essai, mail de bienvenue (Resend `scheduled_at`, 3h après inscription ou lendemain 9h si soir/nuit). Calcul de marge dupliqué depuis `src/App.jsx` (`recipeMarginPercent`) — **à resynchroniser à la main si la formule change**.
- `src/storage.js` — stockage par compte (table Postgres `kv_store` Supabase, RLS par `user_id`), interface `get/set/delete/list` identique à l'ancien localStorage.
- `src/supabaseClient.js` — client Supabase (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, clé anon volontairement publique).
- `src/Auth.jsx` — `AuthGate` : connexion obligatoire, pas de mode démo. Mot de passe (par défaut), code à 6 chiffres par email (`signInWithOtp`/`verifyOtp`, alternative rapide), Google OAuth en 1 clic, trilingue FR/ES/EN.
- `src/Billing.jsx` — `SubscriptionGate` (imbriqué `AuthGate > SubscriptionGate > App`) : essai 7 jours sans CB (calculé depuis `session.user.created_at`, Stripe n'intervient pas pendant l'essai), paywall après si aucun abonnement actif. Comptes internes (`INTERNAL_EMAILS`) jamais bloqués.
- `api/_lib.js` — utilitaires serveur partagés (client Stripe, client Supabase admin `service_role`, vérif token utilisateur `requireUser`/`checkUserSoft`, envoi email Resend `sendEmail`+`wrapEmailHtml`, `getFoundingState` avec cache 20s, `INTERNAL_EMAILS`/`isInternalEmail`, `FOUNDING_SPOTS`/`TRIAL_DAYS`). Préfixe `_` = pas déployé comme route Vercel.
- `api/contact.js` — formulaire "Nous contacter" in-app → email Resend à `CONTACT_EMAIL`, `replyTo` = email du client (corrigé 2026-08-27, manquait avant).
- `api/scan-events.js` — POST journal scanner (`scan_events` + miroir `activity_events`) incl. `scan_failed` avec code d'erreur ; GET lecture protégée `ADMIN_SECRET`.
- `api/landing.js` — POST compteur visite landing (public, agrégation SQL `landing_events_summary` RPC — **jamais de comptage JS naïf, plafonné à 1000 lignes côté Supabase**) ; GET funnel + `?spots=1` compteur places fondateur public.
- `api/admin-dashboard.js` — tableau de bord admin (onglets Comptes/Aperçu), visible uniquement `alexmollet0@gmail.com` (vérifié serveur). Actions POST : `reset_trial`, `send_unlock_emails`.
- **⚠️ Limite Vercel — PLUS AUCUNE MARGE** : plan Hobby plafonné à **12 fonctions serverless/déploiement** (`_lib.js` exclu), projet **exactement à 12**. Un dépassement fait échouer le build **silencieusement** (déjà arrivé une fois). Avant tout nouvel endpoint : fusionner avec un fichier existant proche, vérifier `ls api/*.js | grep -v _lib | wc -l` ≤ 12.
- `api/create-checkout-session.js`, `api/create-portal-session.js`, `api/stripe-webhook.js` — Stripe (Live depuis 2026-08-05). GET checkout-session = statut fondateur + `internal`.
- `api/public-menu.js` / `src/PublicMenu.jsx` — carte digitale publique sans auth (`/menu/<userId>`, rewrite `vercel.json`), ne renvoie jamais coût/marge/fournisseur.
- `api/translate-menu-description.js` — traduction auto (Claude Haiku) des descriptions/noms de plats/sections de la carte digitale.
- `public/manifest.webmanifest`, `public/sw.js` (aucun cache — ne jamais y ajouter de cache sans repenser l'anti-bundle-périmé de `src/main.jsx`), `public/icons/*.png` — PWA installable.

## Déploiement
Vercel redéploie automatiquement à chaque push sur `main`. Domaine de référence : `getchefup.com` (Site URL Supabase). Variables d'environnement Vercel (ne pas y toucher) :
- `ANTHROPIC_API_KEY` — ⚠️ **compte Anthropic recréé le 2026-08-25** (l'original a été perdu, identifiants introuvables). Vérifier périodiquement le solde de crédits (pas de rechargement auto connu) — une panne de crédits a déjà causé un arrêt total du scan.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (49€, tarif normal), `STRIPE_FOUNDING_PRICE_ID` (29€, tarif fondateur), `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `CRON_SECRET`, `CONTACT_EMAIL` (`contactchefup.app@gmail.com`), `ADMIN_SECRET`
- `VITE_TIKTOK_PIXEL_ID` (optionnel, inactif si absent)
- Email transactionnel via Resend (SMTP custom Supabase, domaine `getchefup.com` vérifié — SPF+DKIM+DMARC tous corrects depuis 2026-08-25). Templates "Confirm signup"/"Reset Password"/"Magic Link" brandés Chefup dans Supabase.
- **`hello@getchefup.com` n'a toujours pas de vraie boîte de réception** (à faire : redirection ImprovMX vers la vraie boîte de l'utilisateur) — tous les emails automatiques ont un `replyTo` vers `CONTACT_EMAIL` en compensation.

## Fonctionnalités déjà en place
Résumé par grand système — voir `docs/HISTORIQUE-FONCTIONNALITES.md` pour le détail de chaque itération/bug/date.

- **Calcul de marge** : coût ingrédients vs prix de vente, TVA configurable, objectif de marge par recette (`targetMargin`) ou global, badges TOP1/2/3, suggestions contextuelles, pertes/rendement à la préparation (`lossPercent`, partagé entre recettes), flèches de variation de prix.
- **Garde-manger** : fournisseurs multiples, historique de prix (filtré par fournisseur actif), catégories, recherche insensible accents/casse/œ, reclassement catalogue en un clic, unité manuelle.
- **Recettes** : saisie en rafale (`QuickAddLine`, nom→Entrée→qty→Entrée), quantités auto kg/g/L/mL à l'affichage (toujours g/mL à la saisie), adaptation à N portions, une recette utilisable comme sous-recette **pas encore implémenté** (voir EN COURS), fiche imprimable (ticket + fiche allergènes), vue liste/grille.
- **Scanner de factures** (`api/scan-invoice.js`) : extraction IA (Sonnet 5), matching flou avec le garde-manger (mémoire des rapprochements multi-clés), calculateur de prix kg/L pour produits vendus à la pièce, détection multipack (tous sens/unités), pile de vérification "un par un", écran d'erreur clair avec codes non techniques (jamais de détail brut de l'IA exposé), journal des échecs (`scan_failed`).
- **Scanner de fiche recette** (`api/scan-recipe.js`) : pré-remplit une recette depuis une fiche technique scannée. Bouton d'accès masqué dans l'UI actuelle.
- **Carte digitale publique** (`api/public-menu.js`, `src/PublicMenu.jsx`, `src/MenuWizard.jsx`) : QR code, 4 designs, sections réordonnables, traduction auto FR/ES/EN. **Réglages accessibles avant publication** (2026-08-30) + aperçu "Voir la carte" fonctionnel même non publiée (`previewToken`, vérifié serveur). Ajout rapide utilise une pastille de section active (comme l'assistant guidé) pour ne plus jamais créer un plat "sans section" par erreur.
  **Refonte 2026-08-30 (simplification demandée par l'utilisateur)** : plus de séparation "recettes cochées" vs "articles simples" — une seule liste "Plats de la carte" (`SimpleItemsSection`, réécrit), avec deux façons d'ajouter : saisie rapide, ou nouveau sélecteur "Ajouter une recette déjà existante" (recherche, plus besoin de faire défiler une longue liste à cocher). Nom/logo/design/couleur repliés derrière un bouton "Personnalisation". Bouton "Ajouter à la carte digitale" + choix de section directement depuis la fiche recette (`App.jsx`).
  **⚠️ Prix décorrélé du prix de vente réel (changement de comportement important)** : le prix affiché sur la carte publique n'est plus synchronisé en direct avec `sellPrice` — nouveau champ `menuPrice` (snapshot), pris tel quel à l'ajout, modifiable seulement via un bouton dédié "Mettre à jour sur la carte" (+ message de succès) qui apparaît sur la fiche recette dès que `sellPrice ≠ menuPrice`. Décision explicite de l'utilisateur : tester un prix pour voir l'effet sur sa marge ne doit plus jamais le pousser publiquement tout seul. **Implication à surveiller** : la Landing page (`src/Landing.jsx`) et son pitch ("le prix se met à jour tout seul dès que tu le changes") ne sont **plus exacts pour les recettes** — restent vrais uniquement pour les plats simples (sans recette liée), dont le prix reste toujours en direct. Pas encore corrigé côté marketing, à trancher avec l'utilisateur si ça revient.
- **Authentification** (`src/Auth.jsx`) : mot de passe, code 6 chiffres par email, Google OAuth, confirmation email non-bloquante (`mailer_autoconfirm`), badge "email non confirmé" + renvoi dans le tableau de bord admin.
- **Abonnement Stripe** (`src/Billing.jsx`) : essai 7j sans CB, 49€/mois tarif normal, offre de lancement 29€/mois à vie pour les 50 premiers comptes (places recalculées à la volée, jamais un compteur stocké — `getFoundingState`), portail client Stripe pour gérer/annuler.
- **Emails automatiques** (`api/send-reminders.js`) : bienvenue programmé, rappel inactivité, digest marge, relance fin d'essai, tous avec `replyTo` vers le support.
- **Tableau de bord admin** (`api/admin-dashboard.js`, visible `alexmollet0@gmail.com` seul) : onglet Comptes (cartes triées par activité, statut "en ligne" temps réel, chronologie par compte, bouton "Supprimer ce compte" armé-puis-confirmé — 2026-08-29, jamais disponible pour un compte interne) et Aperçu (KPI, provenance de trafic par source, graphique visites/jour). Comptes internes exclus des stats.
- **Landing page** (`src/Landing.jsx`) : calculateur de marge interactif en tête, offre de lancement, "comment ça marche", entrée alternative via carte digitale, pixel pub TikTok opt-in.
- **PWA** : installable sur écran d'accueil (manifest + service worker sans cache), bouton d'installation in-app avec instructions par plateforme.
- **Bilingue/trilingue** FR/ES/EN sur toute l'app + carte digitale + landing + emails.
- **Identité visuelle "Ardoise de cuisine" (2026-08-29)** : refonte complète, remplace le dégradé violet→cyan jugé "trop appli IA" par du cuivre/laiton chaud (`BRAND_SOLID` `#C9793B`, `BRAND_GRADIENT` cuivre→ambre) sur le fond ardoise déjà en place (`#16130F`/`#201B15`, mêmes tons resserrés). Polices Oswald/Manrope → **Big Shoulders Display** (titres) / **Work Sans** (corps), déplacées de `App.jsx` vers `src/index.css` (bug latent corrigé au passage : Landing/Auth ne chargeaient jamais la bonne police avant connexion). Logo hirondelle (`src/Logo.jsx`) conservé, dégradé mis à jour — **favicon.svg + icônes PWA mis à jour séparément le jour même** (fichiers indépendants, oubliés au premier passage, c'est ce qui restait bleu sur TikTok). Message d'accueil "Bonjour Chef" → "Service, Chef." (FR/EN), "En cocina, Chef." (ES). Appliqué à Landing/Auth/App principale ; la carte digitale publique (`PublicMenu.jsx`) garde son propre système de couleurs/polices, volontairement hors périmètre. 3 directions proposées visuellement (canvas Claude Design) avant exécution, "Ardoise de cuisine" choisie par l'utilisateur. Vérifié visuellement en local (Landing, connexion, et l'app connectée via le contournement d'authentification documenté dans "Notes" ci-dessous).
- **Hiérarchie visuelle de l'écran Recettes + fiche recette (2026-08-29)** : suite explicitement demandée après la refonte ci-dessus, jugée "juste les couleurs" et pas assez structurante. Mockup validé puis exécuté dans `src/App.jsx` : repère chiffré sous "Service, Chef." (`{n} recettes · marge moyenne {x}%`, pastille de couleur, nouvelle clé `avgMarginLabel`), cartes recette (vue liste) avec badge de marge à pastille + étiquette de catégorie si `r.menuCategory` déjà renseigné (jamais inventée) + ombre/relief, et surtout un **nouveau panneau "en un coup d'œil"** sur la fiche recette (anneau SVG coloré selon `TIER_COLORS[tier]`, coût/prix/portions) juste sous le titre, `print:hidden` — vient EN PLUS du bloc marge existant plus bas (légende/suggestion/coefficient, inchangé, toujours celui imprimé). **Scanner et Garde-manger n'ont reçu que le rebrand couleur/police, pas cette 2e passe de hiérarchie** — à voir avec l'utilisateur si demandé.

## 🔴 BACKLOG PRIORITAIRE

Liste tenue à jour au fil des sessions. **Cocher au fur et à mesure, ne jamais supprimer une ligne sans qu'elle soit faite ou explicitement abandonnée.** Détail complet de chaque point ✅ : `docs/HISTORIQUE-FONCTIONNALITES.md`.

1. ✅ Refonte de la création de recette (saisie rafale, quantités g/mL auto, fiche visuelle non-ticket, prix éditable inline, adaptation portions) — 2026-08-27.
2. ✅ Inscription par code à 6 chiffres sans mot de passe, template email Magic Link brandé — 2026-08-27/28.
3. ✅ Refonte landing hyper conversion (calculateur en tête, offre après, un seul CTA) — 2026-08-27.
4. ⏳ **Découpage de `src/App.jsx` — Pass 1 fait (2026-08-28)**, 9020→5131 lignes. Reste dans `App.jsx` : le composant `App()` lui-même (état/handlers fortement couplés) — chantier à part si repris, pas prioritaire.
   - ✅ Carte digitale mise en avant (onglet dédié, bandeau, bloc landing) — 2026-08-28.
   - ✅ Assistant guidé `MenuWizard` (4 étapes, navigation libre, édition sur place) — 2026-08-28.
5. ✅ Bouton « S'abonner » visible dans le bandeau d'essai — 2026-08-27.
6. ✅ Bug fausse hausse de prix +70% (écriture d'historique sur `onChange` au lieu de `onCommit`) — 2026-08-27.
7. ✅ Compteur de visites du tableau de bord plafonné à 1000 lignes par Supabase → agrégation SQL — 2026-08-27.
8. ✅ Renommage d'une nouvelle recette rendu évident (focus+sélection auto du nom) — 2026-08-28.
9. ✅ Assistant "Ton premier plat" revalidé — 2026-08-28.
10. ✅ Connexion Google en 1 clic — 2026-08-28. Limite connue : provenance de campagne (`?src=`) non attribuable pour ces comptes.
11. ✅ Template email Magic Link brandé (doublon du point 2) — 2026-08-28.
12. ✅ **Comptes de test supprimés** (2026-08-29) — via le bouton "Supprimer ce compte" du tableau de bord admin (livré le même jour). Outil réutilisable pour tout futur ménage de comptes de test.
13. ✅ **Refonte esthétique complète — identité "Ardoise de cuisine"** (2026-08-29). Brief clarifié d'abord (écrans : Landing/Auth/App principale ; nature : ton+couleurs+typo ; repartir de zéro plutôt que d'affiner l'existant), 3 directions proposées visuellement puis choix de l'utilisateur — voir "Fonctionnalités déjà en place" pour le détail. **Correctif le jour même** : favicon.svg + icônes PWA (fichiers séparés du logo `App.jsx`, jamais touchés par le rebrand initial) étaient restés en violet-cyan — c'est ce qui s'affichait encore en bleu sur TikTok, corrigé.
    **Suite demandée le jour même** : l'utilisateur a précisé que la refonte visuelle seule ne suffisait pas — il voulait une vraie restructuration de l'**app elle-même** (pas la landing), pour une meilleure hiérarchie visuelle (jugée plate) et moins "l'air pas fini". Mockup proposé et validé (repère chiffré sous le titre, cartes recette avec badge de marge à pastille, panneau margé en anneau coloré sur la fiche), puis exécuté sur l'écran Recettes + la fiche recette — voir "Fonctionnalités déjà en place". **✅ Étendu à Scanner et Garde-manger le même jour** (2026-08-29/30) : ombre/relief sur les cartes Scanner (carte principale + conseil), conteneur de liste + en-tête de catégorie (pastille cuivre) + prix mis en avant sur Garde-manger. Les 3 écrans demandés (Recettes/Scanner/Garde-manger) ont maintenant le même niveau de finition.
14. ✅ Bug lenteur page de paiement Stripe (`listUsers` non caché, appelé 2x) — 2026-08-27.

## EN COURS

### 🎯 PROCHAINE FONCTIONNALITÉ DEMANDÉE : recette utilisable comme ingrédient d'une autre recette
Idée retenue après discussion (calculateur de conditionnement et suggestion auto de portions explicitement abandonnés — trop d'exceptions réelles pour être fiables). Permet d'utiliser une recette (ex: "Sauce cheddar", 25 portions) comme ligne d'une autre recette, avec une unité "portion" — résout aussi le problème des ingrédients agrégés du scanner de fiche recette.

**Plan validé, à suivre à la prochaine session sur ce sujet** :
1. **Modèle** : un seul tableau `lines`, chaque ligne référence SOIT `ingredientId` SOIT un nouveau `subRecipeId` (jamais les deux). Quantité = nombre de portions de la sous-recette.
2. **Coût** : `lineCost` pour une ligne `subRecipeId` = `recipeCostPerPortion(sousRecette) × qty` — se recalcule automatiquement (rien n'est mis en cache dans l'app).
3. **Anti-boucle (point critique)** : (a) helper qui détecte un cycle pour EXCLURE ces recettes du sélecteur, ET (b) garde-fou anti-boucle infinie dans le calcul de coût lui-même (ensemble de recettes déjà visitées en paramètre récursif), au cas où.
4. **Interface** : sélecteur "une recette" parallèle à `IngredientPicker`, cherchant dans `recipes` (cycles déjà filtrés), champ quantité simple (NumField "portions", pas `QtyField`).
5. **Impression/allergènes/pertes** : ligne sous-recette affichée différemment (nom + portions, pas kg/L), ses allergènes déjà connus s'intègrent à `detectAllergens`, jamais dans la fenêtre "Pertes" ni les badges prix estimé/variation.
6. **Suppression prudente** : avertir si une recette à supprimer est utilisée comme sous-recette ailleurs.
7. **Pas dans cette v1** : lier un ingrédient agrégé détecté par le scanner de fiche recette à une sous-recette existante (à faire séparément plus tard).

### Checklist pré-lancement — état actuel
Le chantier technique de base (scan fiabilisé, revue fonctionnalité par fonctionnalité, refonte UX, auth, Stripe) est **terminé**. Reste :
1. ✅ Favicon, meta description/OG, auto-entrepreneur (SIRET `10839834800012`), Stripe Live, pages légales publiées (`public/mentions-legales.html`/`cgv.html`/`confidentialite.html`).
2. ⏳ **Domiciliation d'entreprise (Kandbaz)** toujours en attente de confirmation — l'adresse d'inscription actuelle est celle des grands-parents de l'utilisateur (ne doivent pas recevoir de courrier Chefup). **Dès confirmation Kandbaz** : mettre à jour l'adresse placeholder dans `mentions-legales.html` + redéployer, faire la déclaration de changement d'adresse URSSAF, éventuellement mettre à jour Stripe.
3. ⏳ **`hello@getchefup.com` sans vraie boîte de réception** — redirection ImprovMX à faire avant un vrai lancement (mitigé pour l'instant par `replyTo: CONTACT_EMAIL` sur tous les emails auto).

Une fois cette checklist vidée, la suite est le lancement/GTM (voir mémoire `[[project-chefup-gtm-plan]]`), pas du code.

### 🟡 Support client — `casavostra.ajaccio@gmail.com`, premier vrai client
Saga du 2026-08-24/25 (plusieurs échecs de scan réels, causes différentes à chaque fois : bug de code, format photo, bug PDF.js iOS, puis panne de crédits Anthropic) — **très probablement résolue** (refonte PDF + passage Sonnet 5 + correctifs de prix + essai réinitialisé), mais tous les tests de vérification ont été faits par l'utilisateur lui-même, jamais reconfirmé par la cliente depuis. Prochaine étape : vérifier dans le tableau de bord qu'aucun `scan_failed` ne réapparaît pour son compte lors d'un nouvel essai réel. Détail complet dans l'archive.

### Reste, secondaire (fiabilité scanner déjà largement traitée)
- Toujours pas testé avec un vrai PDF numérique fourni par l'utilisateur (le chemin texte natif a été validé par simulation, 8/8).
- Backlog "revue stratégique" 2026-07-30 non traité, priorité basse : matching insensible à la langue d'interface pour `guessIngredientId` (déjà fait pour les allergènes), vigilance HT/TTC non précisé, listes `DISTINCTIVE_MODIFIERS`/`FECULENT_NAME_KEYWORDS` non exhaustives (à enrichir avec l'usage réel), renommage dépôt GitHub/projet Vercel (`marge-cuisine`→`chefup`, bloqué par absence de `gh`/`vercel` CLI).
- **Volontairement abandonnées** (ne pas reproposer sauf si l'utilisateur en reparle) : support multi-page en un seul scan, accélération des flèches +/- quantité, annuler un import déjà écrit dans le garde-manger.

## Notes
- L'utilisateur n'est pas développeur, donne des retours simples et concrets.
- Ne jamais écraser une donnée sans validation explicite de l'utilisateur.
- **Node.js EST installé depuis le 2026-08-25** (Node 24 LTS, `winget install --id OpenJS.NodeJS.LTS`). **Toujours vérifier avec un vrai `npm run build` local avant de pousser un changement de `src/App.jsx`/`api/*.js`.** `node`/`npm` pas forcément dans le PATH d'une session fraîche (`export PATH="/c/Program Files/nodejs:$PATH"` si besoin). `.env.local` (gitignored) a les vars Supabase. `.claude/launch.json` pointe `node.exe` directement sur `node_modules/vite/bin/vite.js` (pas `npm.cmd`, qui échoue dans ce contexte). `package-lock.json` committé.
  **Limite qui reste entière** : Claude ne se connecte jamais à un compte — tout ce qui est DERRIÈRE l'authentification (Scanner, Recettes, Garde-manger...) reste testable seulement par build/lecture de code, jamais par un vrai clic, sauf contournement temporaire documenté dans l'archive (remplacer `AuthGate` par `<App/>` + stub `storage.js`, jamais commité).
- **⚠️ Compte Anthropic recréé le 2026-08-25** (l'original perdu, identifiants introuvables) — voir Déploiement ci-dessus. Vérifier le solde de crédits périodiquement.
- **⚠️ Diagnostic panne scan** : si panne totale généralisée, vérifier d'abord les logs Vercel pour `upstreamStatus` dans `activity_events`/logs serveur — `400` = probable épuisement de crédits Anthropic, pas un bug de code.

## Tenue à jour de ce fichier (important)
**Ce fichier (`CLAUDE.md`) est chargé intégralement à CHAQUE message dans ce projet — il doit rester court.** Le détail narratif complet (sagas de debug, historique session par session) va dans `docs/HISTORIQUE-FONCTIONNALITES.md`, jamais ici.

Avant de terminer ta réponse, si la tâche a modifié le code, les fonctionnalités, ou les prochaines étapes du projet :
- **Dans `docs/HISTORIQUE-FONCTIONNALITES.md`** : ajoute le récit complet (contexte, cause, correctif, ce qui reste à vérifier) de ce qui vient d'être fait.
- **Dans `CLAUDE.md`** : ajoute/complète une ligne courte (1-3 lignes) dans "Fonctionnalités déjà en place" ou "Fichiers clés" si un système/fichier a changé, avec un pointeur implicite vers l'archive pour le détail. Mets à jour "EN COURS"/"BACKLOG" en conséquence (retire ce qui est terminé, condense en une ligne).
- Note tout changement d'architecture, de contrainte, ou de préférence de l'utilisateur qui serait utile de connaître dans une prochaine conversation.
- **Ne recopie jamais un paragraphe long directement dans `CLAUDE.md`** — s'il dépasse 2-3 lignes, il appartient à l'archive avec juste un résumé ici.

Ce fichier est le seul moyen pour une future session de savoir où en est le projet — s'il n'est pas à jour, la prochaine conversation repart avec une image fausse de l'état du code. Mais un fichier à jour et énorme coûte cher à chaque message : privilégie la concision ici, la complétude dans l'archive.
