// Teste le garde-fou des « connexions » (src/authGuard.js). À relancer après toute modification : node scripts/test-auth-guard.mjs
import { createSignInGuard } from "../src/authGuard.js";

let ko = 0;
const verifier = (nom, obtenu, attendu) => {
  const ok = obtenu === attendu;
  if (!ok) ko++;
  console.log(`${ok ? "OK    " : "ÉCHEC "} ${nom}${ok ? "" : ` → obtenu ${obtenu}, attendu ${attendu}`}`);
};

const MIN = 60 * 1000;
const alice = { user: { id: "alice" } };
const bob = { user: { id: "bob" } };

{
  let t = 0, occupe = false;
  const g = createSignInGuard({ now: () => t, isBusy: () => occupe });
  verifier("1er SIGNED_IN au chargement : vraie connexion", g.isRealSignIn("SIGNED_IN", alice), true);
  verifier("INITIAL_SESSION : jamais une connexion", g.isRealSignIn("INITIAL_SESSION", alice), false);
  verifier("TOKEN_REFRESHED : jamais une connexion", g.isRealSignIn("TOKEN_REFRESHED", alice), false);
  // 3 retours rapides (30 s) : le cas prouvé par le test du 2026-11-19
  for (let i = 1; i <= 3; i++) {
    t += 10 * MIN; g.markHidden(); t += 30 * 1000;
    verifier(`retour rapide n° ${i} (30 s) : ignoré`, g.isRealSignIn("SIGNED_IN", alice), false);
  }
  t += 10 * MIN; g.markHidden(); t += 4 * MIN;
  verifier("retour après 4 min : ignoré", g.isRealSignIn("SIGNED_IN", alice), false);
  t += 10 * MIN; g.markHidden(); t += 6 * MIN;
  verifier("retour après 6 min : compte (données fraîches)", g.isRealSignIn("SIGNED_IN", alice), true);
  verifier("durée de l'absence mémorisée pour le journal (6 min)", g.lastAwayMinutes(), 6);
  t += 10 * MIN; g.markHidden(); t += 6 * MIN; occupe = true;
  verifier("retour après 6 min PENDANT un scan : ignoré (la photo passe avant)", g.isRealSignIn("SIGNED_IN", alice), false);
  occupe = false;
  verifier("SIGNED_IN répété sans passage en arrière-plan : ignoré", g.isRealSignIn("SIGNED_IN", alice), false);
  verifier("SIGNED_OUT : jamais une connexion", g.isRealSignIn("SIGNED_OUT", null), false);
  verifier("reconnexion du même compte après déconnexion : compte", g.isRealSignIn("SIGNED_IN", alice), true);
  verifier("autre compte dans un autre onglet : compte", g.isRealSignIn("SIGNED_IN", bob), true);
  verifier("retour rapide du 2e compte : ignoré", g.isRealSignIn("SIGNED_IN", bob), false);
}
{
  const g = createSignInGuard();
  verifier("SIGNED_IN sans identifiant : comportement d'avant (compte)", g.isRealSignIn("SIGNED_IN", {}), true);
}
console.log(ko ? `\n${ko} cas en échec` : "\nTous les cas passent");
process.exit(ko ? 1 : 0);
