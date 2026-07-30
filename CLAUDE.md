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
- Scanner de factures, 2 corrections supplémentaires (2026-07-30) — bug réel observé : une ligne "prix par colis" sans poids indiqué (ex: frites surgelées vendues au colis sans mention de poids) ressortait à un prix aberrant (prix du colis affiché tel quel en €/kg) au lieu d'être bloquée :
  1. Calcul universel du prix/kg-L (`api/scan-invoice.js` + `computeItemPricing` dans `src/App.jsx`) : le prompt IA doit désormais renvoyer `packageContent: null` (jamais un chiffre inventé) quand un prix est donné par colis pour un produit pesable sans qu'aucun poids/volume ne soit écrit sur la ligne. Le filet de sécurité côté code (`pricingUnknown`) a été corrigé : il ne dépend plus de `packageContentUnit === "pièce"` (c'était la vraie faille — l'IA pouvait renvoyer une unité "kg" hallucinée qui contournait le filet) ; il se déclenche maintenant dès que le poids réel manque, quelle que soit l'unité renvoyée par l'IA.
  2. Nouveau champ `priceUnusable` (prix introuvable/incalculable) introduit pour empêcher tout import silencieux à 0€ (sert de garde-fou uniquement, voir routage ci-dessous).
- Scanner de factures, tri Ignorés vs À vérifier corrigé + consignes/frais (2026-07-30), suite à une revue stratégique du produit :
  1. **Routage corrigé** : SEUL `isFood === false` envoie une ligne vers "Ignorés" (`excludedItems`). Un ingrédient alimentaire dont le prix est introuvable/incalculable (`priceUnusable`) reste désormais dans le flux normal "À vérifier" — il ne doit jamais disparaître silencieusement d'une recette (ex: Crème, Lait, Emmental sans prix lisible restent visibles avec le panneau "prix à saisir toi-même" déjà existant). `priceUnusable` sert uniquement de garde-fou pour empêcher l'auto-import à 0€ (`isSafeScanItem`), plus à exclure la ligne.
  2. **Lignes de récapitulatif jamais incluses** : le prompt IA exclut désormais explicitement remises/escompte, récapitulatif TVA par taux, totaux, acomptes, mentions de règlement — traitées comme illisibles, jamais comme un article.
  3. **Consignes et frais** : nouveau champ `isDeposit` dans le JSON de l'IA (consigne, emballage consigné, frais de port/service), distinct du binaire alimentaire/non-alimentaire — une consigne contenant un mot alimentaire (ex: "CONSIGNE FÛT BIÈRE") n'est plus jamais classée comme un ingrédient. Ces lignes sont routées vers "Ignorés" comme les non-alimentaires, avec un tooltip distinct ("Consigne / frais...").
- Scanner de factures, correction du prix quand la contenance est dans le titre (2026-07-30) — régression trouvée dans le filet `pricingUnknown` de la correction du 2026-07-30 (frites) : un `packageContent` de 1 (ex: "LAIT ENTIER UHT 1L" vendu à la pièce = 1L/pièce, "EMMENTAL RAPE 1KG" = 1kg/pièce) était à tort traité comme une valeur inconnue simplement parce qu'elle valait 1, alors que c'est une contenance réelle et correcte. Corrigé : `pricingUnknown` (`computeItemPricing` dans `src/App.jsx`) ne se base plus que sur `packageContent` absent (null/0), plus jamais sur `<= 1`. En contrepartie, le prompt (`api/scan-invoice.js`) a été aligné pour que `packageContent: null` soit désormais le SEUL signal d'inconnue partout (y compris pour le ticket de caisse simple, qui renvoyait `1`/"pièce" avant) — et une règle explicite a été ajoutée pour le cas fréquent "contenance dans le titre + prix par PCE" (ex: "36 PCE 1.12€" sur "LAIT ENTIER UHT 1L" → 1.12€/L).

## EN COURS — prochaine étape demandée par l'utilisateur (pas encore codée)
Backlog identifié lors de la revue stratégique du 2026-07-30 (angles morts pour des factures réelles complexes), pas encore traité, par ordre de priorité suggéré :
- Signal de confiance OCR par ligne (distinguer un chiffre halluciné sur un ticket thermique effacé d'un chiffre net).
- Matching insensible à la langue d'interface (comparer toujours au nom source français des fournisseurs, pas au nom traduit selon `lang`).
- Support multi-page (regrouper plusieurs photos d'une même facture en un seul scan).
- Vigilance HT/TTC quand un fournisseur n'affiche que du TTC sans le préciser (pas de solution automatique fiable identifiée — probablement un signal d'alerte visible plutôt qu'une correction silencieuse).

Aucun test réel effectué sur les 4 sessions de corrections du scanner : Node.js indisponible (ni chez l'utilisateur, ni dans l'environnement de dev), donc à valider en conditions réelles une fois déployé sur Vercel : rescanner une facture avec un produit non-alimentaire, une consigne, un ingrédient alimentaire à prix illisible (doit rester en "À vérifier"), et un produit dont la contenance est dans le titre avec un prix "par pièce" (ex: lait 1L, emmental 1kg — doit calculer le bon prix/kg-L directement, sans passer par "À vérifier").

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
