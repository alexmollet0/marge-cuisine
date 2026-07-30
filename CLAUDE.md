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

## EN COURS — prochaine étape demandée par l'utilisateur (pas encore codée)
1. Refonte esthétique complète (uniquement visuelle) — le design actuel est jugé trop générique, carte blanche sur la nouvelle identité, mais garder les couleurs rouge/orange/vert de marge intactes
2. Nouveau logo, plus reconnaissable

## Notes
- L'utilisateur n'est pas développeur, donne des retours simples et concrets
- Ne jamais écraser une donnée sans validation explicite de l'utilisateur
- Node.js n'est pas installé sur l'ordinateur de l'utilisateur (juillet 2026) : impossible de lancer `npm run dev` en local pour tester visuellement avant de pousser. Les changements de `src/App.jsx` sont relus attentivement mais testés en conditions réelles seulement une fois déployés sur Vercel.
