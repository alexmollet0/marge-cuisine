// Garde-fou des événements « connecté » de Supabase (2026-11-19).
//
// Problème prouvé : `supabase-js` (2.112.4, version verrouillée en production) ré-émet `SIGNED_IN` à CHAQUE retour de l'app au premier
// plan (changement d'onglet, téléphone déverrouillé, retour d'une autre appli) tant que la session est valide. Test réel dans un navigateur :
// 1 `SIGNED_IN` + `INITIAL_SESSION` au chargement, puis 1 `SIGNED_IN` par retour, sans aucune vraie connexion. Avant ce garde-fou, `AuthGate`
// (src/Auth.jsx) comptait chaque retour comme une connexion (ligne « Connexion » dans le tableau de bord) ET remontait toute l'app
// (`loginKey`) : l'état local était perdu (scan en cours, photo en attente, texte tapé). Confirmé par Alex sur son téléphone : ce qu'il avait
// écrit dans la recherche du Garde-manger disparaissait en revenant d'un autre onglet. src/main.jsx protégeait déjà la photo en attente d'un
// scan contre le rechargement de page (`window.__chefupScanBusy`), mais jamais contre ce remontage.
//
// Règle :
// - le PREMIER `SIGNED_IN` d'un utilisateur dans cette page compte (chargement avec session restaurée, mot de passe, code à 6 chiffres, Google) ;
// - ensuite, un `SIGNED_IN` pour le MÊME utilisateur est un simple retour au premier plan : ignoré s'il a duré moins de `staleAfterMs` (5 min) ;
// - après une absence plus longue, il compte à nouveau (l'app repart de données fraîches : l'autre appareil a pu modifier les recettes entre-temps,
//   et rien dans l'app ne détecte ce cas à l'enregistrement), SAUF si un scan est ouvert (`isBusy`) : la photo et la pile de vérification passent
//   avant la fraîcheur des données ;
// - un `SIGNED_OUT` remet tout à zéro, et un autre utilisateur (autre compte dans un autre onglet) compte comme une vraie connexion.
//
// Usage (src/Auth.jsx) : `guard.markHidden()` quand la page passe en arrière-plan, `guard.isRealSignIn(event, session)` dans onAuthStateChange.
export function createSignInGuard({ staleAfterMs = 5 * 60 * 1000, isBusy = () => false, now = () => Date.now() } = {}) {
  let lastUserId = null;
  let hiddenAt = null;
  return {
    // La page vient de passer en arrière-plan (on garde la 1re heure si plusieurs passages d'affilée sans événement de connexion).
    markHidden() {
      if (hiddenAt === null) hiddenAt = now();
    },
    // Renvoie true seulement si l'événement annonce une vraie (re)connexion, à traiter (compteur, remontage, mail d'accueil…).
    isRealSignIn(event, session) {
      if (event === "SIGNED_OUT") {
        lastUserId = null;
        hiddenAt = null;
        return false;
      }
      if (event !== "SIGNED_IN") return false;
      const awayMs = hiddenAt === null ? 0 : now() - hiddenAt;
      hiddenAt = null;
      const uid = session?.user?.id || null;
      if (!uid) return true; // pas d'identifiant : on ne peut pas comparer, on garde le comportement d'avant
      if (uid !== lastUserId) {
        lastUserId = uid; // 1re connexion de cet utilisateur dans cette page, ou changement de compte
        return true;
      }
      return awayMs >= staleAfterMs && !isBusy(); // même utilisateur : seulement après une longue absence, jamais pendant un scan
    },
  };
}
