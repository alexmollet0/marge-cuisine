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
- Assistant en 4 étapes pour ajouter un ingrédient manuellement (nom → prix → unité → catégorie)
- Impression : ticket recette avec/sans prix (fiche technique), fiche allergènes de toutes les recettes
- Bilingue FR/ES

## EN COURS — prochaine étape demandée par l'utilisateur (pas encore codée)
1. Assistant d'ajout d'ingrédient à revoir (retirer liste déroulante par défaut à l'étape 1, fusionner prix+unité en une étape, renommer "Modifier ou créer un ingrédient", chercher aussi dans les ingrédients existants pour permettre de modifier un prix existant plutôt que dupliquer, bouton "Modifier" depuis le garde-manger, bouton retour)
2. Refonte esthétique complète (uniquement visuelle) — le design actuel est jugé trop générique, carte blanche sur la nouvelle identité, mais garder les couleurs rouge/orange/vert de marge intactes
3. Nouveau logo, plus reconnaissable

## Notes
- L'utilisateur n'est pas développeur, donne des retours simples et concrets
- Ne jamais écraser une donnée sans validation explicite de l'utilisateur
