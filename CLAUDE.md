# Marge en Cuisine — contexte du projet

App SaaS de calcul de marges pour restaurateurs. React + Vite, déployée sur Vercel,
code sur GitHub (github.com/alexmollet0/marge-cuisine, branche `main`).

## Fichiers clés
- `src/App.jsx` — toute l'application (un seul gros fichier)
- `api/scan-invoice.js` — fonction serveur Vercel qui appelle l'IA (Claude Haiku) pour lire les factures scannées
- `src/storage.js` — stockage local (localStorage)

## Déploiement
Vercel redéploie automatiquement à chaque push sur `main`. Variable d'environnement
`ANTHROPIC_API_KEY` déjà configurée sur Vercel (ne pas y toucher).

## Fonctionnalités déjà en place
- Calcul de marge par recette (coût ingrédients vs prix de vente, TVA configurable)
- Garde-manger avec fournisseurs, historique de prix, catégories
- Scan de factures par IA : extraction des lignes, détection des articles non-alimentaires, détection des prix non calculables (ticket de caisse), pile de vérification produit par produit avec choix garder/renommer, prix estimés vs vérifiés
- Assistant d'ajout/modification d'ingrédient en 2-3 étapes : recherche unique (catalogue + ingrédients existants, pas de liste par défaut), prix+unité fusionnés en une étape, catégorie (uniquement pour une création), bouton "Modifier" sur chaque ligne du garde-manger qui pré-remplit l'assistant pour mettre à jour un prix existant sans dupliquer
- Impression : ticket recette avec/sans prix (fiche technique), fiche allergènes de toutes les recettes
- Bilingue FR/ES
- Identité visuelle (2026-07-30) : nouveau logo en forme de cachet (toque + flèche de marge, anneau laiton) réutilisé dans l'en-tête, la liste des recettes et la fiche allergènes via le composant `Logo` dans `src/App.jsx`. Fond "ardoise" chaud (#1B1815/#26221C) à la place du gris-bleu générique, police Manrope à la place d'Inter, boutons/cartes principaux avec ombre douce et léger relief au survol. Les couleurs rouge/orange/vert de marge (tiers `TIER_COLORS`) n'ont pas changé — elles ne servent qu'à la marge, jamais à la décoration.
- Scanner de factures, 3 corrections (2026-07-30) :
  1. Le prompt IA (`api/scan-invoice.js`) nettoie maintenant strictement le champ `name` : retire conditionnements (10kg, sac, colis, PCE, CT...) et termes de traitement/état (lavé, épluché, surgelé, FRS...), garde uniquement ce qui est distinctif du produit (ex: "filet" pour une découpe). `rawLabel` reste toujours le texte brut intact.
  2. Matching flou amélioré dans `guessIngredientId` (`src/App.jsx`) : au-delà du pluriel déjà géré, gère aussi les abréviations fournisseur (préfixe commun ≥4 lettres, ex: "MOZZA"/"Mozzarella") et les fautes OCR (distance de Levenshtein 1-2). Un match qui repose sur une approximation (pas une égalité exacte) n'est **jamais** marqué "confiant" — il part toujours en section "À vérifier" avec suggestion, jamais en "Nouveau" auto-importable.
  3. Mémoire des rapprochements fournisseur → ingrédient, en **localStorage** (pas de backend Supabase — l'app n'en a pas et l'utilisateur a choisi de rester sur le même mécanisme que le reste des données). Nouvelle clé `supplierMappings` : à chaque import validé (`importScanItem`), on retient `texte brut de la ligne → id ingrédient`. Au scan suivant, si ce texte brut est reconnu, l'ingrédient est réutilisé automatiquement (confiant, sans repasser par "À vérifier"), qu'il s'agisse d'un rapprochement accepté, corrigé manuellement, ou d'une création qui a débouché sur un nouvel ingrédient.

## EN COURS — prochaine étape demandée par l'utilisateur (pas encore codée)
_Rien en attente pour l'instant._ Aucun test réel effectué : Node.js indisponible (ni chez l'utilisateur, ni dans l'environnement de dev), donc à valider en conditions réelles une fois déployé sur Vercel (scanner une vraie facture, vérifier que "À vérifier" propose bien les bonnes suggestions et que le 2e scan du même fournisseur saute la vérification).

## Notes
- L'utilisateur n'est pas développeur, donne des retours simples et concrets
- Ne jamais écraser une donnée sans validation explicite de l'utilisateur
- Node.js n'est pas installé sur l'ordinateur de l'utilisateur (juillet 2026) : impossible de lancer `npm run dev` en local pour tester visuellement avant de pousser. Les changements de `src/App.jsx` sont relus attentivement mais testés en conditions réelles seulement une fois déployés sur Vercel.

## Tenue à jour de ce fichier (important)
Avant de terminer ta réponse, si la tâche a modifié le code, les fonctionnalités, ou les
prochaines étapes du projet, mets à jour ce fichier en conséquence :
- Ajoute/complète une ligne dans "Fonctionnalités déjà en place" pour ce qui vient d'être livré.
- Ajoute dans "EN COURS" ce que l'utilisateur a demandé mais qui n'est pas encore fait, et retire ce qui vient d'être terminé.
- Note tout changement d'architecture, de contrainte, ou de préférence de l'utilisateur qui serait utile de connaître dans une prochaine conversation (nouvelle fenêtre de chat).
Ce fichier est le seul moyen pour une future session de savoir où en est le projet — s'il n'est pas à jour, la prochaine conversation repart avec une image fausse de l'état du code.
