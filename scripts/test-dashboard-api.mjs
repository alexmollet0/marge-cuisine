// Teste le chargement des données du tableau de bord (api/admin-dashboard.js) avec une FAUSSE base Supabase : pagination, lecture du contenu enregistré,
// calcul complet, nettoyage des détails d'un compte, texte de l'email. À relancer après toute modification : node scripts/test-dashboard-api.mjs
// (aucun accès réseau : Stripe n'est pas configuré ici, donc les revenus retombent sur l'estimation, comme en cas de panne réelle)
import { fetchAll, loadV2, slimMeta, personalEmailHtml } from "../api/admin-dashboard.js";

let ko = 0;
const verifier = (nom, ok, detail = "") => { if (!ok) ko++; console.log(`${ok ? "OK    " : "ÉCHEC "} ${nom}${ok ? "" : " → " + detail}`); };

const DAY = 24 * 3600 * 1000;
const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();

// --- fausse base : un constructeur de requête minimal (select / gte / in / order / range), les pages de 1000 lignes comme Supabase ---
function fausseBase(tables, rpcRows) {
  const calls = { range: [] };
  const from = (table) => {
    let rows = [...(tables[table] || [])];
    const q = {
      select: () => q,
      gte: (col, v) => { rows = rows.filter((r) => String(r[col]) >= String(v)); return q; },
      in: (col, list) => { rows = rows.filter((r) => list.includes(r[col])); return q; },
      order: (col, { ascending }) => { rows.sort((a, b) => (ascending ? 1 : -1) * String(a[col]).localeCompare(String(b[col]))); return q; },
      range: async (a, b) => { calls.range.push([table, a, b]); return { data: rows.slice(a, b + 1), error: null }; },
    };
    return q;
  };
  return { from, rpc: async () => ({ data: rpcRows, error: null }), calls };
}

// 2 350 événements pour forcer 3 pages
const events = [];
for (let i = 0; i < 2350; i++) events.push({ user_id: i % 2 ? "u2" : "u3", type: "login", created_at: iso(i * 60 * 1000 + 1000), meta: i === 0 ? { os: "ios", installee: true, items: [1, 2, 3] } : {} });
events.push({ user_id: "u2", type: "scan_invoice", created_at: iso(3 * 3600 * 1000), meta: { items: [{ name: "x" }] } });
const tables = {
  activity_events: events,
  kv_store: [
    { user_id: "u2", key: "recipes", value: JSON.stringify([{ id: "r1", name: "SECRET" }, { id: "rx", name: "SECRET 2" }]) },
    { user_id: "u2", key: "ingredients", value: JSON.stringify([{ id: "i1", name: "SECRET" }, { id: "z9", name: "SECRET 3", suppliers: [{ name: "FOURNISSEUR", price: 9, priceSource: "scan" }] }]) },
    { user_id: "u2", key: "menuSettings", value: JSON.stringify({ published: true, restaurantName: "SECRET" }) },
    { user_id: "u2", key: "lang", value: JSON.stringify("fr") },
    { user_id: "u3", key: "trialStartOverride", value: new Date(now + 20 * DAY).toISOString() },
  ],
};
const db = fausseBase(tables, [{ event_type: "view", source: "tiktok", day: new Date(now).toISOString().slice(0, 10), cnt: 10 }]);
const authUsers = [
  { id: "u2", email: "a@example.com", created_at: iso(15 * DAY), email_confirmed_at: iso(15 * DAY), app_metadata: { provider: "email" }, user_metadata: { signup_source: "tiktok" } },
  { id: "u3", email: "b@example.com", created_at: iso(10 * DAY), app_metadata: { provider: "google" }, user_metadata: {} },
];

const rows = await fetchAll(() => db.from("activity_events").select("*"));
verifier("pagination : les 2 351 lignes sont récupérées en 3 pages", rows.length === 2351 && db.calls.range.filter((c) => c[0] === "activity_events").length === 3, `${rows.length} lignes, ${db.calls.range.length} pages`);

const v2 = await loadV2({ supabaseAdmin: db, days: 30, authUsers, subs: [{ user_id: "u2", status: "active" }] });
verifier("le tableau de bord se calcule de bout en bout", v2 && v2.v === 2 && v2.accounts.length === 2);
const a2 = v2.accounts.find((a) => a.id === "u2");
verifier("contenu enregistré réduit à des comptes (1 recette à lui, 1 ingrédient à lui, prix réel, carte publiée)", a2.counts.recipes === 1 && a2.counts.ingredients === 1 && a2.counts.realPriceIngredients === 1 && a2.counts.menuPublished === true, JSON.stringify(a2.counts));
verifier("langue du compte reprise", a2.language === "fr");
verifier("le résultat détaillé d'un scan est écarté avant le calcul", JSON.stringify(v2).indexOf("SECRET") === -1);
verifier("aucun nom de fournisseur ni de recette dans la réponse", JSON.stringify(v2).indexOf("FOURNISSEUR") === -1);
const a3 = v2.accounts.find((a) => a.id === "u3");
verifier("« offrir 20 jours » dans le futur : essai à nouveau actif", a3.status === "trial" && a3.trialDaysLeft >= 26, `${a3.status} J-${a3.trialDaysLeft}`);
verifier("la limite de lignes n'est pas atteinte", v2.eventsTruncated === false && v2.eventRows === 2351);
verifier("revenus : estimation quand Stripe n'est pas joignable", v2.revenue.source === "estimation");
verifier("visites reprises de la base agrégée", v2.kpis.visits.value === 10);
verifier("les 2 351 ouvertures de l'app se regroupent en sessions (pas 2 351)", a2.sessions7d < 200 && a2.eventsTotal > 1000, `${a2.sessions7d} sessions`);

// Détails d'un compte : seulement des repères
verifier("slimMeta scan : 15 lignes au plus, total conservé", (() => { const m = slimMeta("scan_invoice", { items: Array.from({ length: 40 }, (_, i) => ({ name: "n" + i })), imagePath: "p.jpg", secret: "x" }); return m.items.length === 15 && m.itemsTotal === 40 && m.imagePath === "p.jpg" && !("secret" in m); })());
verifier("slimMeta erreur : pile coupée à 400 caractères", slimMeta("client_error", { message: "m", pile: "y".repeat(2000) }).pile.length === 400);
verifier("slimMeta inconnu : rien", JSON.stringify(slimMeta("autre", { a: 1 })) === "{}");

// Email
const html = personalEmailHtml("Salut,\n\nTon scan <b>a échoué</b>.\nJe regarde ça.\n\nAlex");
verifier("email : 3 paragraphes, texte échappé, retour à la ligne conservé", (html.match(/<p /g) || []).length === 4 && html.includes("&lt;b&gt;") && html.includes("<br>Je regarde"), html);
verifier("email : invitation à répondre", html.includes("tu peux répondre directement"));

console.log(ko ? `\n${ko} cas en échec` : "\nTous les cas passent");
process.exit(ko ? 1 : 0);
