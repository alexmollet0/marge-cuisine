// Teste le nettoyage de `meta` (api/_meta.js). À relancer après toute modification : node scripts/test-sanitize-meta.mjs
import { sanitizeMeta, MAX_CLES, MAX_TEXTE, MAX_TOTAL } from "../api/_meta.js";

let ko = 0;
const verifier = (nom, ok, detail = "") => { if (!ok) ko++; console.log(`${ok ? "OK    " : "ÉCHEC "} ${nom}${ok ? "" : " → " + detail}`); };

verifier("objet simple conservé", JSON.stringify(sanitizeMeta({ os: "ios", installee: true, ligne: 12, note: null })) === JSON.stringify({ os: "ios", installee: true, ligne: 12, note: null }));
verifier("texte coupé à 300 caractères", sanitizeMeta({ message: "x".repeat(1000) }).message.length === MAX_TEXTE);
verifier("objet imbriqué et tableau supprimés", JSON.stringify(sanitizeMeta({ a: { b: 1 }, c: [1, 2], d: "ok" })) === JSON.stringify({ d: "ok" }));
verifier("fonction supprimée", !("f" in sanitizeMeta({ f: () => 1 })));
verifier("nombre non fini supprimé", !("n" in sanitizeMeta({ n: NaN })) && !("i" in sanitizeMeta({ i: Infinity })));
verifier("16 clés au plus", Object.keys(sanitizeMeta(Object.fromEntries(Array.from({ length: 40 }, (_, i) => ["k" + i, i])))).length === MAX_CLES);
verifier("nom de clé nettoyé", "a_b_c" in sanitizeMeta({ "a b/c": 1 }));
verifier("entrée invalide : objet vide", JSON.stringify(sanitizeMeta(null)) === "{}" && JSON.stringify(sanitizeMeta("x")) === "{}" && JSON.stringify(sanitizeMeta([1])) === "{}");
const gros = sanitizeMeta(Object.fromEntries(Array.from({ length: 16 }, (_, i) => ["t" + i, "y".repeat(300)])));
verifier("total sérialisé limité", JSON.stringify(gros).length <= MAX_TOTAL, String(JSON.stringify(gros).length));
console.log(ko ? `\n${ko} cas en échec` : "\nTous les cas passent");
process.exit(ko ? 1 : 0);
