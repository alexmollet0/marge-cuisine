// Teste les calculs du tableau de bord admin (api/_dashboard.js) sur des données fabriquées. À relancer après toute modification :
//   node scripts/test-dashboard.mjs
import { buildDashboard, buildAccountDetail, accountStatus, groupSessions, contentCounts, DAY } from "../api/_dashboard.js";

let ko = 0;
const verifier = (nom, ok, detail = "") => { if (!ok) ko++; console.log(`${ok ? "OK    " : "ÉCHEC "} ${nom}${ok ? "" : " → " + detail}`); };

const NOW = Date.UTC(2026, 10, 19, 20, 0, 0); // 19 novembre 2026, 20 h UTC
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const H = 3600 * 1000, MIN = 60 * 1000;
const user = (id, email, daysAgo, extra = {}) => ({ id, email, created_at: iso(daysAgo * DAY), email_confirmed_at: iso(daysAgo * DAY), app_metadata: { provider: "email" }, user_metadata: { signup_source: extra.source || "direct" }, ...extra.raw });
const ev = (user_id, type, msAgo, meta = {}) => ({ user_id, type, created_at: iso(msAgo), meta });

const users = [
  user("u1", "alexmollet0@gmail.com", 90),
  user("u2", "abonne@example.com", 20, { source: "tiktok" }),
  user("u3", "parti@example.com", 10, { source: "tiktok" }),
  user("u4", "bloque@example.com", 2, { source: "tiktok" }),
  user("u5", "fantome@example.com", 1, { source: "direct" }),
  user("u6", "fin-actif@example.com", 6, { source: "tiktok" }),
  user("u7", "fin-inactif@example.com", 6, { source: "direct" }),
  user("u8", "vieux@example.com", 30, { source: "direct" }),
  user("u9", "expire@example.com", 12, { source: "tiktok" }),
  user("u10", "rien@example.com", 3, { source: "direct" }),
];
const subs = [{ user_id: "u2", status: "active" }, { user_id: "u3", status: "canceled" }];
const events = [
  // compte interne : ne compte dans aucun chiffre
  ev("u1", "scan_invoice", 2 * H), ev("u1", "login", 1 * H),
  // u2 : abonné actif, scans, revient souvent ; une rafale de 6 « login » en 10 minutes = UNE session
  ev("u2", "login", 19 * DAY), ev("u2", "scan_invoice", 18 * DAY), ev("u2", "recipe_created", 18 * DAY - 5 * MIN, { source: "express" }),
  ev("u2", "login", 3 * DAY), ev("u2", "price_updated", 3 * DAY - 2 * MIN), ev("u2", "print_used", 3 * DAY - 4 * MIN, { kind: "fiche" }),
  ev("u2", "login", 22 * H), ev("u2", "login", 22 * H - 2 * MIN), ev("u2", "login", 22 * H - 4 * MIN), ev("u2", "login", 22 * H - 6 * MIN), ev("u2", "login", 22 * H - 8 * MIN), ev("u2", "login", 22 * H - 10 * MIN),
  // u3 : parti (annulé), un scan échoué puis plus rien
  ev("u3", "login", 9 * DAY), ev("u3", "scan_button_clicked", 9 * DAY - MIN), ev("u3", "scan_failed", 9 * DAY - 2 * MIN, { code: "ai_unreadable" }), ev("u3", "login", 8 * DAY),
  // u4 : a essayé de scanner, échec récent, rien de réussi
  ev("u4", "login", 2 * DAY - H, { os: "android", installee: true, ecran: "mobile" }), ev("u4", "scan_button_clicked", 2 * DAY - H - MIN), ev("u4", "scan_file_selected", 2 * DAY - H - 2 * MIN), ev("u4", "scan_failed", 30 * H, { code: "file_unreadable" }),
  // u6 : essai qui finit, a réussi un scan, a une recette
  ev("u6", "login", 6 * DAY), ev("u6", "scan_invoice", 6 * DAY - 10 * MIN), ev("u6", "recipe_created", 5 * DAY), ev("u6", "login", 1 * H),
  // u7 : essai qui finit, a juste ouvert l'app
  ev("u7", "login", 6 * DAY), ev("u7", "tab_opened", 6 * DAY - MIN),
  // u9 : essai expiré, a essayé une fois
  ev("u9", "login", 12 * DAY), ev("u9", "scan_button_clicked", 12 * DAY - MIN),
  // u10 : ouvert l'app il y a 3 jours, aucune action
  ev("u10", "login", 3 * DAY),
  // erreurs techniques
  ev("u4", "client_error", 5 * H, { message: "Cannot read properties of undefined (reading 'name')", version: "index-abc.js", os: "android", installee: true }),
  ev("u6", "client_error", 4 * H, { message: "Cannot read properties of undefined (reading 'name')", version: "index-abc.js", os: "ios" }),
  ev("u2", "client_error", 3 * H, { message: "Cannot read properties of undefined (reading 'name')", version: "index-abc.js", os: "ios" }),
];
const landing = [];
for (let i = 0; i < 12; i++) { const d = new Date(NOW - i * DAY).toISOString().slice(0, 10); landing.push({ event_type: "view", source: i % 2 ? "tiktok" : "direct", day: d, cnt: 4 }); landing.push({ event_type: "start_click", source: "tiktok", day: d, cnt: 1 }); }
const kv = { u2: { recipes: [{ id: "r1" }, { id: "r2" }], ingredients: [{ id: "i1" }, { id: "x1", suppliers: [{ priceSource: "scan" }] }], menuSettings: { published: true } }, u6: { recipes: [{ id: "r1" }, { id: "rx" }] } };
const isInternal = (e) => e === "alexmollet0@gmail.com";
const D = buildDashboard({ now: NOW, days: 30, users, subs, events, landing, kv, stripe: { mrr: 78, active: 1, trialing: 0, canceling: 1, pastDue: 0 }, isInternal, trialDays: 7 });
const acc = (email) => D.accounts.find((a) => a.email === email);

verifier("10 comptes listés, 9 clients (le compte interne est écarté des chiffres)", D.accounts.length === 10 && D.totals.clients === 9, `${D.accounts.length} / ${D.totals.clients}`);
verifier("le compte interne porte le badge", acc("alexmollet0@gmail.com").internal === true);
verifier("statut abonné", acc("abonne@example.com").status === "subscribed");
verifier("statut annulé", acc("parti@example.com").status === "canceled");
verifier("essai en cours J-5 pour u4 (inscrit il y a 2 jours)", acc("bloque@example.com").status === "trial" && acc("bloque@example.com").trialDaysLeft === 5, String(acc("bloque@example.com").trialDaysLeft));
verifier("essai qui finit : J-1", acc("fin-actif@example.com").trialDaysLeft === 1, String(acc("fin-actif@example.com").trialDaysLeft));
verifier("essai expiré", acc("vieux@example.com").status === "expired" && acc("expire@example.com").status === "expired");
verifier("une rafale de 6 connexions = 1 session (u2, 7 derniers jours : le jour -3, la rafale, l'erreur = 3 sessions)", acc("abonne@example.com").sessions7d === 3, String(acc("abonne@example.com").sessions7d));
verifier("jamais ouvert : étape « Inscrit, jamais ouvert »", acc("fantome@example.com").stage === "Inscrit, jamais ouvert");
verifier("étape de u2 : abonné", acc("abonne@example.com").stage === "Abonné");
verifier("étape de u4 : a essayé de scanner", acc("bloque@example.com").stage === "A essayé de scanner", acc("bloque@example.com").stage);
verifier("compte avec une recette à lui compté par le contenu enregistré (hors démo r1)", acc("abonne@example.com").counts.recipes === 1 && acc("abonne@example.com").counts.ingredients === 1 && acc("abonne@example.com").counts.menuPublished === true);
verifier("prix réel détecté", acc("abonne@example.com").counts.realPriceIngredients === 1);
verifier("santé : u2 actif", acc("abonne@example.com").health === "actif", acc("abonne@example.com").health);
verifier("santé : u5 (inscrit hier, jamais ouvert) à relancer", acc("fantome@example.com").health === "a_relancer" || acc("fantome@example.com").health === "nouveau", acc("fantome@example.com").health);
verifier("santé : annulé = perdu", acc("parti@example.com").health === "perdu");
verifier("appareil connu quand le journal le dit", acc("bloque@example.com").device && acc("bloque@example.com").device.os === "android" && acc("bloque@example.com").device.installed === true);

// Parcours
const step = (k) => D.steps.find((s) => s.key === k);
verifier("visites sur 30 jours = 12 jours x 4", step("visits").count === 48, String(step("visits").count));
verifier("comptes créés dans la période (9 clients)", step("signups").count === 9, String(step("signups").count));
verifier("ont ouvert l'app : 7 (u2,u3,u4,u6,u7,u9,u10 ; pas u5 ni u8)", step("session").count === 7, String(step("session").count));
verifier("ont essayé de scanner : 4 (u2,u3,u4,u6) + u9", step("scanTry").count === 5, String(step("scanTry").count));
verifier("premier scan réussi : 2 (u2, u6)", step("scanOk").count === 2, String(step("scanOk").count));
verifier("abonnés payants : 1", step("paid").count === 1, String(step("paid").count));
verifier("pourcentage de l'étape précédente calculé", step("session").pctOfPrev === Math.round((1000 * 7) / 9) / 10, String(step("session").pctOfPrev));
verifier("délai médian jusqu'au premier scan : moyenne de 48 h (u2) et 10 min (u6)", D.medianHoursToFirstScan !== null && Math.abs(D.medianHoursToFirstScan - 24.083) < 0.01, String(D.medianHoursToFirstScan));
verifier("au moins un constat sur le parcours", D.insights.length >= 2, JSON.stringify(D.insights.map((i) => i.text)));

// KPI
verifier("scans réussis sur la période = 2 (le compte interne est écarté)", D.kpis.scansOk.value === 2, String(D.kpis.scansOk.value));
verifier("scans échoués = 2", D.kpis.scansFailed.value === 2, String(D.kpis.scansFailed.value));
verifier("erreurs techniques = 3", D.kpis.errors.value === 3, String(D.kpis.errors.value));
verifier("courbe de 30 jours", D.series.length === 30 && D.series[29].date === "2026-11-19");

// Santé
verifier("taux de réussite des scans = 50 %", D.health.scans.successPct === 50, String(D.health.scans.successPct));
verifier("causes d'échec comptées", D.health.scans.failuresByCode.length === 2);
verifier("erreur répétée regroupée : 3 fois, 3 comptes", D.health.errors.length === 1 && D.health.errors[0].count === 3 && D.health.errors[0].accounts === 3, JSON.stringify(D.health.errors));

// À faire
const act = (kind, email) => D.actions.find((a) => a.kind === kind && (!email || a.email === email));
verifier("action : abonnement annulé", !!act("churn", "parti@example.com"));
verifier("action : scan échoué sans réussite depuis (u4)", !!act("scan_failed", "bloque@example.com"));
verifier("action : essai qui finit, il utilise l'app (u6)", !!act("trial_end_active", "fin-actif@example.com"));
verifier("action : essai qui finit, sans usage (u7)", !!act("trial_end_idle", "fin-inactif@example.com"));
verifier("action : essai terminé récent (u9)", !!act("expired", "expire@example.com"));
verifier("pas d'action pour le compte interne ni pour le vieux compte expiré", !D.actions.some((a) => a.email === "alexmollet0@gmail.com" || a.email === "vieux@example.com"));
verifier("l'erreur technique répétée est en tête", D.actions[0].kind === "tech", D.actions[0].kind);
verifier("les actions urgentes passent avant", D.actions.filter((a) => a.severity === "high").length >= 2);

// Fonctionnalités, sources, revenus, rétention
const feat = (k) => D.features.find((f) => f.key === k);
verifier("fonctionnalité scan : 2 comptes", feat("scan").accounts === 2, String(feat("scan").accounts));
verifier("fonctionnalité recette express (IA) : 1 compte", feat("ai_recipe").accounts === 1);
verifier("impression et prix modifiés vus", feat("print").accounts === 1 && feat("price_updated").accounts === 1);
verifier("sources : tiktok a des inscrits", D.sources.find((s) => s.source === "tiktok").signups >= 3);
verifier("revenus : MRR Stripe repris", D.revenue.mrr === 78 && D.revenue.source === "stripe");
verifier("rétention : au moins une cohorte", D.retention.length >= 1 && D.retention.every((r) => r.size >= 1));

// Offrir des jours : le départ de l'essai suit trialStartOverride
const futur = new Date(NOW + 23 * DAY).toISOString();
const st = accountStatus({ createdAt: iso(10 * DAY), override: futur, sub: null, now: NOW, trialDays: 7 });
verifier("« offrir 30 jours » : l'essai redevient actif avec 30 jours restants", st.key === "trial" && st.trialDaysLeft === 30, JSON.stringify(st));

// Sessions et fiche compte
const det = buildAccountDetail(events.filter((e) => e.user_id === "u2"), NOW);
verifier("fiche compte : 5 sessions (connexion, scan, jour -3, rafale, erreur)", det.sessions.length === 5, String(det.sessions.length));
const burst = det.sessions[1]; // la plus récente (l'erreur) est en premier, la rafale juste après
verifier("fiche compte : la rafale de 6 ouvertures devient 1 ligne « ×6 »", burst.lines.length === 1 && burst.lines[0].count === 6, JSON.stringify(burst.lines));
verifier("fiche compte : la plus récente d'abord", new Date(det.sessions[0].start) > new Date(det.sessions[1].start));
verifier("groupSessions : écart de 30 min", groupSessions([{ created_at: iso(3 * H) }, { created_at: iso(3 * H - 10 * MIN) }, { created_at: iso(1 * H) }]).length === 2);
verifier("contentCounts : compte vide", contentCounts(undefined).recipes === 0);

console.log(ko ? `\n${ko} cas en échec` : "\nTous les cas passent");
process.exit(ko ? 1 : 0);
