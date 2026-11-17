# Plan — Diagnostic « Ta carte en 3 minutes » (2026-11-17, validé en principe par Alex, rien codé)

Objectif : amener plus de visiteurs jusqu'au site et en convertir plus en essai puis en abonnement. Constat de départ : les nouveaux comptes regardent le tuto, font une recette express, visitent un peu, puis ne reviennent jamais (2 abonnements payants seulement depuis le lancement) ; le lien en bio TikTok n'est pas cliquable ; l'app ne montre sa valeur qu'après un scan de facture.

Principe : **montrer la valeur d'abord (sans compte), demander l'engagement ensuite.** Les maquettes interactives v1/v2 de la conversation du 2026-11-17 servent de référence visuelle (4 étapes).

## 0. Décisions déjà prises avec Alex
- Pas d'abonnement direct à froid depuis TikTok (trafic trop faible, marque inconnue, 2 abonnés seulement) : on garde l'essai 7 jours sans carte.
- **Jamais de comparaison « X fois le prix de l'abonnement »** (jugé « vendeur de tapis ») : on affiche des euros par mois avec les hypothèses en petit, sans mentionner le prix de Chefup.
- Honnêteté : l'app ne baisse pas les prix d'achat, elle révèle les hausses ; les chiffres sont des estimations, jamais un gain promis.

## 1. Où et comment (aucune nouvelle fonction Vercel : le plafond de 12 est atteint)
- Nouveau composant `src/Diagnostic.jsx` (calcul 100 % côté navigateur, aucun appel serveur, aucune donnée envoyée avant la création de compte).
- Monté dans `src/Landing.jsx` : bouton principal du haut « Teste ta marge en 1 minute » (ancre vers le diagnostic) ; le CTA « Commencer gratuitement » reste visible plus bas. Décision à prendre : le diagnostic remplace-t-il la démo animée `LandingWowDemo` ou vient-il juste dessous (par défaut : dessous, pour ne pas toucher à ce qui est mesuré).
- Adresse courte pour TikTok : `getchefup.com/test` → rewrite `vercel.json` (comme `/menu/:id`) + détection du chemin dans `src/main.jsx`/`Landing.jsx` qui fait défiler jusqu'au diagnostic. Aucune fonction ajoutée.
- Traductions FR/ES/EN via `src/translations.js` (clés `diag*`). Première livraison FR d'abord, ES/EN ensuite (à signaler clairement si livré partiel).

## 2. Les 4 écrans
1. **Devine** : 5 lignes (nom du plat, prix TTC) avec exemples en placeholder ; curseur « ta marge moyenne, tu l'estimes à » (50–95 %, 80 par défaut) ; bouton « Voir ce que dit Chefup ». Validation : au moins 3 plats avec prix > 0.
2. **Révélation** : « Tu pensais X %. Pour ce genre de plats, les coûts matière moyens donnent plutôt Y % » (jamais « tu te trompes » : c'est une référence du secteur, pas SA marge) ; classement des plats avec fourchette Y±7 points ; compteur « N plats sous 70 % » ; phrase « tes vrais prix d'achat resserrent cette fourchette ».
3. **L'enjeu** : champs facultatifs « chiffre d'affaires mensuel » (30 000 € par défaut, modifiable) et « lignes de facture par semaine » (40) ; curseur « hausse des prix d'achat » (1–15 %, 5 par défaut) ; sortie : « une hausse non vue te coûte environ N € par mois » et « environ H h de saisie à la main par mois » ; hypothèses en petit (achats ≈ 30 % du CA, 1 minute par ligne) ; si l'enjeu est faible, le dire (« l'intérêt est surtout le temps gagné ») au lieu de forcer. Aucun ratio avec le prix de l'abonnement.
4. **Surveillance** : « 0 prix surveillé sur N ingrédients » + liste de 3 étapes ; bouton unique « Crée ton compte gratuit pour garder tes résultats » (→ `onStart`, comme `handleStart`) ; lien secondaire « Pas de facture sous la main ? essaie avec une facture d'exemple » (à cadrer : voir §6).

## 3. Calcul (client, sans IA, sans abus possible)
- Table de **ratios de coût matière par type de plat** (mots-clés normalisés sans accents, pluriels tolérés, comme le catalogue allergènes) : burger, pizza, pâtes, salade, entrecôte/steak/viande, poisson, tartare, dessert, plat du jour, entrée, bar/cocktail… + défaut générique 30 %. Valeurs indicatives du secteur (autour de 20–40 %), **à faire valider par Alex avant mise en ligne** ; elles ne sont pas sourcées pour l'instant.
- TTC → HT avec TVA 10 % (restauration sur place) ; alcool/boissons à 20 % : v1 limitée aux plats (champ « type » facultatif plus tard).
- Marge = 1 − coût / prix HT ; fourchette ±7 points ; tout arrondi à l'entier ; aucun calcul d'historique de prix (règle anti « +70 % »).

## 4. Passage à la création de compte (le point délicat)
- À l'étape 4, on stocke localement `chefup:diagnostic` (plats, prix, estimation, CA, lignes) — jamais envoyé au serveur avant la connexion.
- Après la première connexion (`src/App.jsx`), si ce stockage existe et que le compte est neuf : bannière « Ton diagnostic est prêt : crée tes 5 plats » (remplace la phrase « recette d'exemple fictive »). Un clic crée les 5 recettes avec « Recette express » (IA réelle, uniquement pour un compte connecté → coût maîtrisé), une par une avec progression. **Jamais d'écrasement de données existantes** ; la recette de démo reste ou non selon décision d'Alex.
- Puis message « 0 prix surveillé : scanne ta dernière facture » (bouton de scan existant).
- Piège connu à respecter : `onClick={() => fn()}` ; ne jamais écrire dans un historique de prix sur `onChange`.

## 5. Mesure (indispensable : sans elle on ne saura pas si ça marche)
- Nouveaux événements dans `api/landing.js` (`VALID_EVENTS`) : `diag_start`, `diag_result`, `diag_enjeu`, `diag_signup_click` (anonymes, comme les autres). Vérifier que la RPC `landing_events_summary` et l'onglet Aperçu du tableau de bord affichent bien ces nouveaux types.
- Après connexion : un événement de parcours `diagnostic_imported` dans `api/scan-events.js` (étapes de parcours déjà gérées).
- Entonnoir à suivre pendant 10 jours : vues TikTok → visites → `diag_start` → `diag_result` → `diag_signup_click` → comptes → premier scan → paiement. Rappel : l'ancien calculateur de la landing avait 0 % d'usage (trafic payant froid) : ce diagnostic est un test, pas une certitude.

## 6. Phases
- **A (1 session)** : `Diagnostic.jsx` + montage dans la landing + `/test` + événements. Vérification : `npm run build`, script `check_undefined.js`, test visuel local de la landing (accessible sans compte) en mobile et desktop, ES/EN si livrés.
- **B (1 session)** : stockage local + import à la première connexion (5 recettes express) + événement `diagnostic_imported`. Test avec un compte de test jetable, supprimé ensuite via le tableau de bord.
- **C** : demande d'abonnement **au moment de la valeur** (après l'import du diagnostic ou le 1er scan réussi : carte discrète « Garde ta surveillance — offre fondateur, il reste N places », compteur réel `?spots=1`, bouton existant `subscribe()`), et e-mails J+1/J+3/J+6 personnalisés via `api/send-reminders.js` (aucune fonction de plus). Facture d'exemple : à cadrer séparément (ne doit rien écrire dans les données du compte).
- Côté TikTok, une fois la phase A en ligne : toutes les scènes finales disent « Teste ta marge en 1 minute : getchefup.com/test » (règle à mettre à jour dans `chefup-tiktok/agents/`).

## 7. Risques / questions ouvertes
- Table de ratios à valider par Alex ; formulation de la « révélation » à faire relire (référence du secteur, pas jugement).
- Le diagnostic montre des estimations génériques : un restaurateur peut répondre « chez moi ce n'est pas ça » ; c'est acceptable tant que le texte le dit et pousse vers les vrais prix.
- Conversion : aucune garantie. Décision de poursuivre ou d'abandonner après 10 jours de mesures.
- Parler aux 2 abonnés payants et à quelques comptes partis reste prioritaire en parallèle (c'est gratuit et plus fiable que mes hypothèses).
