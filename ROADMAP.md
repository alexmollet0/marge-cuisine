# Chefup — Feuille de route vers un vrai SaaS

Ce fichier est le tableau de bord stratégique du projet : où on va, où on en est, et ce qui
reste à faire pour passer d'un projet de dev à un produit vendable. Il se met à jour à chaque
tâche terminée.

Pour le détail technique très fin (fonction par fonction, bug par bug), voir `CLAUDE.md` —
`ROADMAP.md` reste volontairement à un niveau plus stratégique, pour ne pas dupliquer le suivi.

## Vision

Chefup : gestion dynamique des marges pour les métiers de bouche (chefs, restaurateurs,
boulangers, pâtissiers, traiteurs). Détection des hausses de prix fournisseurs, prise en compte
du rendement/perte à la préparation, conseils d'optimisation contextuels. Abonnement 39€/mois
sans engagement, essai 7 jours.

**Décision actée le 2026-08-01** : pas de lancement commercial avant d'avoir stabilisé le
produit ET construit un vrai backend. La priorité est la fiabilité et la validation par de vrais
utilisateurs, pas la vitesse de mise en marché.

## État des lieux honnête (2026-08-01)

**Ce qui existe et fonctionne** : calcul de marge par recette (avec rendement/perte), garde-manger
avec historique de prix et flèches de variation, scanner de factures par IA (photo + PDF texte
natif + recoupement OCR depuis ce soir), suggestions contextuelles d'optimisation, fiches
recette/allergènes imprimables, 3 langues (FR/ES/EN), identité visuelle Chefup.

**Ce qui reste fragile** : la fiabilité du scanner est en progrès rapide mais pas encore éprouvée
dans la durée — plusieurs bugs réels corrigés dans les dernières 24h (prix qui ne se mettait
jamais à jour, erreur de calcul x8 non détectée). Bonne dynamique, mais pas encore assez de recul
pour la considérer acquise.

**Le trou le plus important, à ne jamais perdre de vue** : Chefup n'a aujourd'hui **aucun
backend**. Toutes les données vivent uniquement dans le `localStorage` du navigateur de chaque
utilisateur (voir `src/storage.js`) — pas de compte, pas de synchronisation entre appareils, pas
moyen de vérifier un abonnement. Ce n'est pas une case à cocher rapide, c'est le chantier le plus
gros du projet à ce stade, plus gros que tout ce qui a été construit jusqu'ici.

## Feuille de route

### Étape 1 — Fiabiliser le scanner/IA (EN COURS)
- [x] Bouton d'import du scanner découplé d'une simple variation de prix (plus de symbole
      danger pour une hausse de prix normale)
- [x] Correction `selectedSupplierId` jamais mis à jour après un import (le prix du garde-manger
      ne bougeait jamais après un scan "réussi")
- [x] Filet de calcul multipack étendu au motif inversé "QUANTITÉ x COMPTE" (ex: "100G X8")
- [x] Alerte "écart avec le total imprimé" restreinte aux cas où elle est vraiment pertinente
- [x] Import PDF : extraction du texte natif quand la facture est numérique (élimine la lecture
      visuelle) + repli sur l'image pour un PDF scanné
- [x] OCR indépendant (Tesseract.js) en recoupement des photos, en plus de l'IA de vision
- [ ] **Vérifier le déploiement du PDF/OCR en conditions réelles** (en cours par l'utilisateur au
      moment d'écrire ces lignes)
- [ ] Continuer à collecter des cas concrets d'erreurs de scan (prix faux, pas juste des fausses
      alertes) au fil de l'usage réel
- [ ] Évaluer un modèle IA plus capable (Sonnet) sur les cas qui résistent à Haiku
- [ ] Réduire encore ce que l'IA doit calculer elle-même au profit de recalculs déterministes
      côté code (stratégie qui a le mieux marché jusqu'ici)

### Étape 2 — Bêta technique légère, SANS attendre le backend (nouvelle étape proposée)
Idée : valider la fiabilité du scanner sur de VRAIES factures et récolter du vrai feedback
utilisateur le plus tôt possible, sans attendre que le backend soit prêt — l'app fonctionne déjà
sur un seul appareil (localStorage), ce qui suffit pour un test court avec quelques restaurateurs.
- [ ] Identifier 2-3 contacts (restaurateurs, boulangers...) prêts à tester sur leur propre
      téléphone/tablette pendant quelques jours, avec leurs vraies factures
- [ ] Leur faire scanner leurs factures réelles, observer les erreurs sur du vrai terrain (pas
      des factures générées par IA)
- [ ] Recueillir leur ressenti sur la valeur perçue (est-ce que les flèches de prix / suggestions
      de marge leur parlent vraiment ?) et sur les frictions d'usage

### Étape 3 — Architecture backend
- [ ] Choix de la BDD/Auth : **Supabase recommandé** (voir justification dans la réponse de
      cadrage) plutôt que Firebase — les données de Chefup sont relationnelles (recettes → lignes
      → ingrédients → fournisseurs → historique de prix), ce qui correspond mieux à une base
      Postgres qu'à un modèle documents. Auth intégrée, isolation des données par restaurant via
      Row Level Security, migration progressive possible.
- [ ] Modèle de données (tables : comptes, restaurants/organisations, ingrédients, fournisseurs,
      recettes, lignes de recette, historique de prix)
- [ ] Authentification (création de compte, connexion, multi-utilisateur par restaurant)
- [ ] Migration du stockage local vers le backend (garder `src/storage.js` comme couche
      d'abstraction si possible, pour limiter la casse ailleurs dans le code)
- [ ] Synchronisation multi-appareils

### Étape 4 — Stripe + gestion de l'essai
- [ ] Intégration Stripe (abonnement 39€/mois, sans engagement)
- [ ] Période d'essai de 7 jours réellement appliquée (liée au compte, plus contournable en
      vidant le localStorage)
- [ ] Emails transactionnels de base (bienvenue, fin d'essai, échec de paiement)

### Étape 5 — Lancement de la bêta fermée (5-10 restaurateurs)
- [ ] Sélection des testeurs (au-delà des 2-3 contacts de l'étape 2, élargir)
- [ ] Onboarding accompagné (pas encore en self-service)
- [ ] Boucle de retours structurée avant d'ouvrir plus largement

## Piste business/légale en parallèle (ne bloque pas le développement)
- [ ] Clarifier le statut juridique (auto-entrepreneur vs société) avec un expert-comptable —
      conditionne le calcul réel de revenu net et la gestion de la TVA sur les 39€/mois
- [ ] Faire valider le cold SMS par un avocat/expert en prospection commerciale avant tout envoi
      à volume (risque RGPD/CNIL identifié comme réel, voir échange du 2026-08-01)
- [ ] Revoir les conditions d'affiliation (30% récurrent à vie → envisager un plafond dans le
      temps, ex: 12 mois)
- [ ] Préparer le contenu TikTok en parallèle (canal le moins risqué, le plus lent à porter ses
      fruits — démarrer tôt)

## Méthode de travail (mode "guide pas à pas")
À partir du 2026-08-01, à chaque tâche technique terminée :
1. Ce fichier est mis à jour (case cochée, nouvelle tâche ajoutée si elle apparaît en cours de
   route).
2. Une proposition de prochaine tâche technique est faite.
3. Une vérification/un test concret côté utilisateur est suggéré.
4. Les actions business/prépa pertinentes à mener en parallèle sont rappelées.
