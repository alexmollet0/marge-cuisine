// Calculs du tableau de bord admin refait de A à Z (2026-11-19, demande d'Alex : « un tableau de bord comme les grandes entreprises, savoir ce qui
// fonctionne et ce qui ne fonctionne pas, le parcours de l'utilisateur, tous les comptes, envoyer un mail directement »).
//
// FONCTIONS PURES : aucun accès réseau ni base ici, tout arrive en paramètre. api/admin-dashboard.js charge les données (Supabase, Stripe) puis appelle
// buildDashboard ; scripts/test-dashboard.mjs vérifie les calculs sur des données fabriquées. Préfixe `_` : pas une route Vercel (le plafond de 12 fonctions
// serverless est atteint, voir CLAUDE.md).
//
// Principes (à garder en tête quand on y revient) :
// - un « compte » client exclut les comptes internes (INTERNAL_EMAILS) de TOUS les chiffres, mais reste listé avec un badge ;
// - une « session » = des événements séparés de moins de 30 minutes ; les anciennes lignes « Connexion » en rafale (bug des retours au premier plan, corrigé
//   le 2026-11-19) sont donc regroupées en une seule session au lieu de gonfler les chiffres ;
// - jamais de contenu de recette ou de facture : seulement des comptes, des dates et des repères.

export const DAY = 24 * 60 * 60 * 1000;
export const SESSION_GAP = 30 * 60 * 1000;

const SCAN_TRY = new Set(["scan_button_clicked", "scan_file_selected", "scan_analyze_clicked", "scan_invoice", "scan_recipe", "scan_failed"]);
const SCAN_OK = new Set(["scan_invoice", "scan_recipe"]);
const SEED_RECIPE_ID = "r1";
const SEED_INGREDIENT_IDS = new Set(["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"]);

export const ACTIVITY_LABELS = {
  login: "Ouverture de l'app",
  tab_opened: "Onglet ouvert",
  recipe_created: "Recette créée",
  recipe_opened: "Recette consultée",
  price_updated: "Prix modifié",
  print_used: "Impression",
  allergen_sheet_opened: "Fiche allergènes ouverte",
  scan_invoice: "Facture scannée",
  scan_recipe: "Fiche recette scannée",
  scan_failed: "Scan échoué",
  scan_button_clicked: "Bouton scanner cliqué",
  scan_file_selected: "Photo choisie",
  scan_analyze_clicked: "Analyse lancée",
  tutorial_closed: "Tutoriel fermé",
  digital_menu_published: "Carte digitale publiée",
  subscribe_clicked: "Clic « S'abonner »",
  pwa_installed: "App installée sur l'écran d'accueil",
  client_error: "Erreur technique",
  client_crash: "Écran en panne (plantage)",
  admin_email_sent: "Email envoyé par Chefup",
};

const ts = (iso) => new Date(iso).getTime();
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const median = (a) => {
  const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);

// Regroupe des événements triés par date en sessions (écart de 30 minutes). Renvoie [{ start, end, n, events }].
export function groupSessions(sortedEvents) {
  const sessions = [];
  for (const e of sortedEvents) {
    const t = ts(e.created_at);
    const last = sessions[sessions.length - 1];
    if (last && t - last.end < SESSION_GAP) {
      last.end = t;
      last.n++;
      last.events.push(e);
    } else {
      sessions.push({ start: t, end: t, n: 1, events: [e] });
    }
  }
  return sessions;
}

// Statut commercial d'un compte, calculé comme dans l'app (src/Billing.jsx : le départ de l'essai est la plus récente de la date d'inscription et de
// `trialStartOverride`, posé par « Réinitialiser l'essai » ou « Offrir N jours »).
export function accountStatus({ createdAt, override, sub, now, trialDays }) {
  let start = ts(createdAt);
  if (override && ts(override) > start) start = ts(override);
  const trialDaysLeft = Math.ceil((start + trialDays * DAY - now) / DAY);
  const subActive = !!sub && ["active", "trialing", "past_due"].includes(sub.status);
  let key, label;
  if (subActive) {
    key = sub.status === "past_due" ? "past_due" : "subscribed";
    label = sub.status === "past_due" ? "Paiement en retard" : "Abonné actif";
  } else if (trialDaysLeft > 0) {
    key = "trial";
    label = `Essai (J-${trialDaysLeft})`;
  } else if (sub && sub.status === "canceled") {
    key = "canceled";
    label = "Annulé";
  } else {
    key = "expired";
    label = "Essai expiré";
  }
  return { key, label, trialDaysLeft, trialStart: new Date(start).toISOString() };
}

// Compte le contenu réel (hors démo) d'un compte à partir de ses données enregistrées, sans jamais en renvoyer le texte.
export function contentCounts(kvUser) {
  const recipes = Array.isArray(kvUser?.recipes) ? kvUser.recipes.filter((r) => r && r.id !== SEED_RECIPE_ID) : [];
  const ingredients = Array.isArray(kvUser?.ingredients) ? kvUser.ingredients.filter((i) => i && !SEED_INGREDIENT_IDS.has(i.id)) : [];
  const realPrices = ingredients.filter((i) => (i.suppliers || []).some((s) => s && s.priceSource && s.priceSource !== "estimate")).length;
  return { recipes: recipes.length, ingredients: ingredients.length, realPriceIngredients: realPrices, menuPublished: !!kvUser?.menuSettings?.published };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Tableau de bord complet
// ---------------------------------------------------------------------------------------------------------------------------------------------
export function buildDashboard(input) {
  const { now, days, users, subs = [], events = [], landing = [], kv = {}, stripe = null, isInternal = () => false, trialDays = 7 } = input;
  const periodStart = now - days * DAY;
  const prevStart = now - 2 * days * DAY;
  const subByUser = new Map(subs.map((s) => [s.user_id, s]));
  const internalIds = new Set(users.filter((u) => isInternal(u.email)).map((u) => u.id));
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  // Événements triés par date, rangés par compte (comptes inconnus et internes écartés des statistiques)
  const sorted = events
    .filter((e) => e && e.user_id && e.created_at)
    .slice()
    .sort((a, b) => ts(a.created_at) - ts(b.created_at));
  const byUser = new Map();
  for (const e of sorted) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, []);
    byUser.get(e.user_id).push(e);
  }

  // ---- Vue détaillée de chaque compte ----
  const accounts = users.map((u) => {
    const evs = byUser.get(u.id) || [];
    const k = kv[u.id] || {};
    const counts = contentCounts(k);
    const st = accountStatus({ createdAt: u.created_at, override: k.trialStartOverride, sub: subByUser.get(u.id), now, trialDays });
    const first = (pred) => evs.find(pred);
    const mile = (e, extra) => ({ reached: !!e || !!extra, at: e ? e.created_at : null });
    const mSession = mile(evs[0]);
    const mTuto = mile(first((e) => e.type === "tutorial_closed"));
    const mTry = mile(first((e) => SCAN_TRY.has(e.type)));
    const mOk = mile(first((e) => SCAN_OK.has(e.type)));
    const mRecipe = mile(first((e) => e.type === "recipe_created"), counts.recipes > 0);
    const mMenu = mile(first((e) => e.type === "digital_menu_published"), counts.menuPublished);
    const mClick = mile(first((e) => e.type === "subscribe_clicked"));
    const mPaid = { reached: st.key === "subscribed" || st.key === "past_due", at: null };
    const last = evs.length ? evs[evs.length - 1] : null;
    const sessions = groupSessions(evs);
    const since7 = now - 7 * DAY;
    const s7 = sessions.filter((s) => s.end >= since7);
    const daysActive7 = new Set(evs.filter((e) => ts(e.created_at) >= since7).map((e) => dayKey(ts(e.created_at)))).size;
    const failures = evs.filter((e) => e.type === "scan_failed");
    const lastFailure = failures.length ? failures[failures.length - 1] : null;
    const lastOkAfterFailure = lastFailure ? evs.some((e) => SCAN_OK.has(e.type) && ts(e.created_at) > ts(lastFailure.created_at)) : false;
    const errors7 = evs.filter((e) => (e.type === "client_error" || e.type === "client_crash") && ts(e.created_at) >= since7).length;
    const login = [...evs].reverse().find((e) => e.type === "login" && e.meta && (e.meta.os || e.meta.ecran));
    const ageDays = Math.floor((now - ts(u.created_at)) / DAY);
    const lastActivityAt = last ? last.created_at : null;
    const idleDays = lastActivityAt ? Math.floor((now - ts(lastActivityAt)) / DAY) : null;

    // Santé du compte : une étiquette simple pour savoir où regarder en premier
    let health;
    if (st.key === "canceled" || st.key === "expired") health = "perdu";
    else if (ageDays < 1) health = "nouveau";
    else if (!mSession.reached || (ageDays >= 1 && !mTry.reached && !mRecipe.reached)) health = "a_relancer";
    else if (lastFailure && !lastOkAfterFailure && now - ts(lastFailure.created_at) < 3 * DAY) health = "a_relancer";
    else if (idleDays !== null && idleDays >= 7) health = "risque";
    else if (idleDays !== null && idleDays <= 3) health = "actif";
    else health = "risque";

    const stage = mPaid.reached ? "Abonné" : mClick.reached ? "A cliqué « S'abonner »" : mMenu.reached ? "Carte publiée" : mRecipe.reached ? "Recette créée" : mOk.reached ? "Premier scan réussi" : mTry.reached ? "A essayé de scanner" : mSession.reached ? "A ouvert l'app" : "Inscrit, jamais ouvert";

    return {
      id: u.id,
      email: u.email,
      internal: internalIds.has(u.id),
      createdAt: u.created_at,
      ageDays,
      source: u.user_metadata?.signup_source || "direct",
      provider: u.app_metadata?.provider || "email",
      language: k.lang || null,
      emailConfirmed: !!(u.email_confirmed_at || u.confirmed_at),
      status: st.key,
      statusLabel: st.label,
      trialDaysLeft: st.trialDaysLeft,
      lastActivityAt,
      idleDays,
      sessions7d: s7.length,
      daysActive7d: daysActive7,
      eventsTotal: evs.length,
      milestones: { session: mSession, tutorial: mTuto, scanTry: mTry, scanOk: mOk, recipe: mRecipe, menu: mMenu, subscribeClick: mClick, paid: mPaid },
      stage,
      counts: { ...counts, scansOk: evs.filter((e) => SCAN_OK.has(e.type)).length, scansFailed: failures.length, errors7d: errors7 },
      lastFailure: lastFailure ? { at: lastFailure.created_at, code: lastFailure.meta?.code || "unknown", recovered: lastOkAfterFailure } : null,
      device: login ? { os: login.meta.os || null, installed: !!login.meta.installee, screen: login.meta.ecran || null } : null,
      health,
    };
  });
  const clients = accounts.filter((a) => !a.internal);
  const activeIdsIn = (from, to) => new Set(sorted.filter((e) => !internalIds.has(e.user_id) && ts(e.created_at) >= from && ts(e.created_at) < to).map((e) => e.user_id));
  const activeNow = activeIdsIn(periodStart, now + 1);
  const activePrev = activeIdsIn(prevStart, periodStart);

  // ---- Visites de la page d'accueil (agrégées côté base : jamais de comptage naïf, Supabase plafonne à 1000 lignes) ----
  const landingSum = (type, from, to) =>
    landing.filter((r) => r.event_type === type && ts(r.day) >= from - DAY + 1 && ts(r.day) < to).reduce((s, r) => s + Number(r.cnt || 0), 0);
  const cnt = (list, from, to) => list.filter((a) => ts(a.createdAt) >= from && ts(a.createdAt) < to).length;
  const evCount = (types, from, to) => sorted.filter((e) => types.has ? types.has(e.type) : types.includes(e.type)).filter((e) => !internalIds.has(e.user_id) && ts(e.created_at) >= from && ts(e.created_at) < to).length;

  // Le pourcentage de variation n'a de sens qu'à partir de 5 de la période d'avant (« +1100 % » pour passer de 1 à 12 ne dit rien) : sinon on donne l'écart brut.
  const metric = (cur, prev) => ({ value: cur, prev, delta: cur - prev, deltaPct: prev >= 5 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null });
  const kpis = {
    visits: metric(landingSum("view", periodStart, now + DAY), landingSum("view", prevStart, periodStart)),
    startClicks: metric(landingSum("start_click", periodStart, now + DAY), landingSum("start_click", prevStart, periodStart)),
    signups: metric(cnt(clients, periodStart, now + 1), cnt(clients, prevStart, periodStart)),
    activeAccounts: metric(activeNow.size, activePrev.size),
    scansOk: metric(evCount(SCAN_OK, periodStart, now + 1), evCount(SCAN_OK, prevStart, periodStart)),
    scansFailed: metric(evCount(["scan_failed"], periodStart, now + 1), evCount(["scan_failed"], prevStart, periodStart)),
    errors: metric(evCount(["client_error", "client_crash"], periodStart, now + 1), evCount(["client_error", "client_crash"], prevStart, periodStart)),
  };
  const statusCount = (key) => clients.filter((a) => a.status === key).length;
  const totals = {
    clients: clients.length,
    trials: statusCount("trial"),
    trialsEndingSoon: clients.filter((a) => a.status === "trial" && a.trialDaysLeft <= 2).length,
    subscribed: statusCount("subscribed") + statusCount("past_due"),
    pastDue: statusCount("past_due"),
    canceled: statusCount("canceled"),
    expired: statusCount("expired"),
    unconfirmed: clients.filter((a) => !a.emailConfirmed).length,
  };

  // ---- Parcours : de la visite à l'abonnement ----
  const cohort = clients.filter((a) => ts(a.createdAt) >= periodStart);
  const reach = (key) => cohort.filter((a) => a.milestones[key].reached).length;
  const steps = [
    { key: "visits", label: "Visites de la page d'accueil", count: kpis.visits.value, cohort: false },
    { key: "startClicks", label: "Clic sur « Essayer 7 jours »", count: kpis.startClicks.value, cohort: false },
    { key: "signups", label: "Comptes créés", count: cohort.length, cohort: true },
    { key: "session", label: "Ont ouvert l'app", count: reach("session"), cohort: true },
    { key: "scanTry", label: "Ont essayé de scanner une facture", count: reach("scanTry"), cohort: true },
    { key: "scanOk", label: "Premier scan réussi", count: reach("scanOk"), cohort: true },
    { key: "recipe", label: "Ont une recette à eux", count: reach("recipe"), cohort: true },
    { key: "subscribeClick", label: "Ont cliqué sur « S'abonner »", count: reach("subscribeClick"), cohort: true },
    { key: "paid", label: "Abonnés payants", count: reach("paid"), cohort: true },
  ].map((s, i, arr) => ({
    ...s,
    pctOfPrev: i === 0 ? null : pct(s.count, arr[i - 1].count),
    pctOfSignups: s.cohort && cohort.length ? pct(s.count, cohort.length) : null,
  }));
  // Temps entre l'inscription et le premier scan réussi, pour ceux qui y sont arrivés
  const hoursToFirstScan = cohort
    .filter((a) => a.milestones.scanOk.at)
    .map((a) => (ts(a.milestones.scanOk.at) - ts(a.createdAt)) / 3600000);
  const medianHours = median(hoursToFirstScan);

  // Où ça décroche le plus (à partir de 3 comptes, sinon c'est du bruit)
  const insights = [];
  const cohortSteps = steps.filter((s) => s.cohort);
  let worst = null;
  for (let i = 1; i < cohortSteps.length; i++) {
    const prev = cohortSteps[i - 1];
    if (prev.count >= 3) {
      const lost = prev.count - cohortSteps[i].count;
      if (!worst || lost > worst.lost) worst = { from: prev, to: cohortSteps[i], lost };
    }
  }
  if (cohort.length >= 3 && worst && worst.lost >= 2) {
    insights.push({ level: "warn", text: `Le plus gros décrochage : entre « ${worst.from.label} » (${worst.from.count}) et « ${worst.to.label} » (${worst.to.count}) : ${worst.lost} comptes s'arrêtent là.` });
  }
  const neverOpened = cohort.length - reach("session");
  if (neverOpened >= 1) insights.push({ level: "warn", text: `${neverOpened} compte${neverOpened > 1 ? "s" : ""} créé${neverOpened > 1 ? "s" : ""} sur ${cohort.length} n'a jamais ouvert l'app après l'inscription.` });
  const triedNoOk = cohort.filter((a) => a.milestones.scanTry.reached && !a.milestones.scanOk.reached).length;
  if (triedNoOk >= 1) insights.push({ level: "bad", text: `${triedNoOk} compte${triedNoOk > 1 ? "s ont" : " a"} essayé de scanner sans jamais réussir : c'est là que l'app perd des gens (voir l'écran Santé pour les causes).` });
  if (medianHours !== null) insights.push({ level: "info", text: `Temps médian entre l'inscription et le premier scan réussi : ${medianHours < 1 ? Math.round(medianHours * 60) + " minutes" : medianHours < 48 ? Math.round(medianHours) + " heures" : Math.round(medianHours / 24) + " jours"}.` });
  if (kpis.visits.value >= 20 && cohort.length === 0) insights.push({ level: "bad", text: `${kpis.visits.value} visites et aucune inscription sur la période : le blocage est sur la page d'accueil ou l'inscription.` });

  // ---- Courbes jour par jour ----
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d0 = dayKey(now - i * DAY);
    series.push({ date: d0, visits: 0, startClicks: 0, signups: 0, active: 0, scansOk: 0, scansFailed: 0, errors: 0 });
  }
  const sIdx = new Map(series.map((s) => [s.date, s]));
  for (const r of landing) {
    const s = sIdx.get(r.day);
    if (!s) continue;
    if (r.event_type === "view") s.visits += Number(r.cnt || 0);
    if (r.event_type === "start_click") s.startClicks += Number(r.cnt || 0);
  }
  for (const a of clients) { const s = sIdx.get(dayKey(ts(a.createdAt))); if (s) s.signups++; }
  const activePerDay = new Map();
  for (const e of sorted) {
    if (internalIds.has(e.user_id)) continue;
    const dk = dayKey(ts(e.created_at));
    const s = sIdx.get(dk);
    if (!s) continue;
    if (!activePerDay.has(dk)) activePerDay.set(dk, new Set());
    activePerDay.get(dk).add(e.user_id);
    if (SCAN_OK.has(e.type)) s.scansOk++;
    if (e.type === "scan_failed") s.scansFailed++;
    if (e.type === "client_error" || e.type === "client_crash") s.errors++;
  }
  for (const [dk, set] of activePerDay) sIdx.get(dk).active = set.size;

  // ---- Provenance du trafic (landing → inscriptions → abonnés) ----
  const srcMap = new Map();
  const src = (k) => { if (!srcMap.has(k)) srcMap.set(k, { source: k, views: 0, startClicks: 0, signups: 0, activated: 0, paid: 0 }); return srcMap.get(k); };
  for (const r of landing) {
    if (ts(r.day) < periodStart - DAY + 1) continue;
    const s = src(r.source || "direct");
    if (r.event_type === "view") s.views += Number(r.cnt || 0);
    if (r.event_type === "start_click") s.startClicks += Number(r.cnt || 0);
  }
  for (const a of cohort) {
    const s = src(a.source || "direct");
    s.signups++;
    if (a.milestones.scanOk.reached) s.activated++;
    if (a.milestones.paid.reached) s.paid++;
  }
  const sources = [...srcMap.values()].sort((a, b) => b.views - a.views || b.signups - a.signups);

  // ---- Fonctionnalités : ce qui est utilisé, ce qui ne l'est pas ----
  const FEATURES = [
    { key: "scan", label: "Scanner de factures", types: ["scan_invoice", "scan_recipe"] },
    { key: "recipe_created", label: "Création de recettes", types: ["recipe_created"] },
    { key: "recipe_opened", label: "Consultation d'une recette", types: ["recipe_opened"] },
    { key: "price_updated", label: "Mise à jour d'un prix (garde-manger)", types: ["price_updated"] },
    { key: "ai_recipe", label: "Recette express / Plat du jour (IA)", types: ["recipe_created"], pred: (e) => ["express", "daily_stock", "daily_quick"].includes(e.meta?.source) },
    { key: "print", label: "Impression de fiches", types: ["print_used"] },
    { key: "allergens", label: "Fiche allergènes", types: ["allergen_sheet_opened"] },
    { key: "menu", label: "Carte digitale publiée", types: ["digital_menu_published"] },
    { key: "tutorial", label: "Tutoriel terminé", types: ["tutorial_closed"] },
    { key: "pwa", label: "App installée sur l'écran d'accueil", types: ["pwa_installed"] },
  ];
  const inPeriod = sorted.filter((e) => !internalIds.has(e.user_id) && ts(e.created_at) >= periodStart);
  const features = FEATURES.map((f) => {
    const evs = inPeriod.filter((e) => f.types.includes(e.type) && (!f.pred || f.pred(e)));
    const allEvs = sorted.filter((e) => !internalIds.has(e.user_id) && f.types.includes(e.type) && (!f.pred || f.pred(e)));
    const accountsN = new Set(evs.map((e) => e.user_id)).size;
    return {
      key: f.key,
      label: f.label,
      accounts: accountsN,
      pctOfActive: pct(accountsN, activeNow.size),
      events: evs.length,
      dataSince: allEvs.length ? allEvs[0].created_at : null,
    };
  });

  // ---- Rétention : les inscrits d'une semaine reviennent-ils ? ----
  const weekStart = (ms) => { const d = new Date(ms); const dow = (d.getUTCDay() + 6) % 7; return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)); };
  const cohorts = new Map();
  for (const a of clients) {
    if (ts(a.createdAt) < now - 8 * 7 * DAY) continue;
    const wk = weekStart(ts(a.createdAt));
    if (!cohorts.has(wk)) cohorts.set(wk, []);
    cohorts.get(wk).push(a);
  }
  const retention = [...cohorts.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1)).map(([week, list]) => {
    const back = (minDays) => {
      const eligible = list.filter((a) => now - ts(a.createdAt) >= minDays * DAY);
      if (!eligible.length) return { n: 0, of: 0, pct: null };
      const n = eligible.filter((a) => (byUser.get(a.id) || []).some((e) => ts(e.created_at) - ts(a.createdAt) >= minDays * DAY - 12 * 3600000 && dayKey(ts(e.created_at)) !== dayKey(ts(a.createdAt)))).length;
      return { n, of: eligible.length, pct: pct(n, eligible.length) };
    };
    return { week, size: list.length, d1: back(1), d3: back(3), d7: back(7) };
  });

  // ---- Santé : scanner, erreurs, emails ----
  const scanOkN = evCount(SCAN_OK, periodStart, now + 1);
  const scanKoEvents = inPeriod.filter((e) => e.type === "scan_failed");
  const byCode = new Map();
  for (const e of scanKoEvents) { const c = e.meta?.code || "unknown"; byCode.set(c, (byCode.get(c) || 0) + 1); }
  const errorEvents = inPeriod.filter((e) => e.type === "client_error" || e.type === "client_crash");
  const errGroups = new Map();
  for (const e of errorEvents) {
    const key = `${e.type}|${String(e.meta?.message || "").slice(0, 120)}`;
    if (!errGroups.has(key)) errGroups.set(key, { kind: e.type === "client_crash" ? "plantage" : "erreur", message: String(e.meta?.message || "(sans message)").slice(0, 200), count: 0, accounts: new Set(), lastAt: e.created_at, versions: new Set(), devices: new Set(), file: e.meta?.fichier || null });
    const g = errGroups.get(key);
    g.count++;
    g.accounts.add(e.user_id);
    if (e.created_at > g.lastAt) g.lastAt = e.created_at;
    if (e.meta?.version) g.versions.add(e.meta.version);
    if (e.meta?.os) g.devices.add(e.meta.os + (e.meta.installee ? " (installée)" : ""));
  }
  const health = {
    scans: {
      ok: scanOkN,
      failed: scanKoEvents.length,
      successPct: pct(scanOkN, scanOkN + scanKoEvents.length),
      failuresByCode: [...byCode.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
      recentFailures: scanKoEvents.slice(-8).reverse().map((e) => ({ email: emailById.get(e.user_id) || "?", at: e.created_at, code: e.meta?.code || "unknown", imagePath: e.meta?.imagePath || null })),
    },
    errors: [...errGroups.values()]
      .map((g) => ({ kind: g.kind, message: g.message, count: g.count, accounts: g.accounts.size, lastAt: g.lastAt, versions: [...g.versions].slice(0, 3), devices: [...g.devices].slice(0, 3), file: g.file }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    unconfirmedEmails: clients.filter((a) => !a.emailConfirmed).map((a) => ({ email: a.email, createdAt: a.createdAt })),
    trackingSince: errorEvents.length || sorted.some((e) => e.type === "pwa_installed" || (e.type === "login" && e.meta?.os)) ? (sorted.find((e) => e.type === "login" && e.meta?.os) || errorEvents[0] || {}).created_at || null : null,
  };

  // ---- À faire maintenant : qui contacter, et pourquoi ----
  const actions = [];
  const add = (a) => actions.push({ severity: "medium", ...a });
  for (const a of clients) {
    if (a.status === "canceled" && a.idleDays !== null && a.idleDays <= 30) add({ severity: "high", kind: "churn", email: a.email, title: "Abonnement annulé", detail: `Statut : annulé. Dernière activité il y a ${a.idleDays} jour${a.idleDays > 1 ? "s" : ""}. Demande-lui ce qui n'a pas marché.`, template: "annule" });
    else if (a.status === "past_due") add({ severity: "high", kind: "payment", email: a.email, title: "Paiement en retard", detail: "Stripe relance la carte tout seul ; un petit mot peut éviter la perte.", template: "paiement" });
    else if (a.lastFailure && !a.lastFailure.recovered && now - ts(a.lastFailure.at) < 5 * DAY) add({ severity: "high", kind: "scan_failed", email: a.email, title: "Un scan a échoué, sans réussite depuis", detail: `Cause : ${a.lastFailure.code}. Écris-lui avant qu'il abandonne ; la facture est consultable depuis sa fiche.`, template: "scan" });
    else if (a.status === "trial" && a.trialDaysLeft <= 2 && a.milestones.scanOk.reached) add({ severity: "medium", kind: "trial_end_active", email: a.email, title: `Essai qui se termine (J-${Math.max(a.trialDaysLeft, 0)}), il utilise l'app`, detail: "Il a déjà réussi un scan : bon moment pour lui rappeler l'abonnement.", template: "fin_essai" });
    else if (a.status === "trial" && a.trialDaysLeft <= 2) add({ severity: "medium", kind: "trial_end_idle", email: a.email, title: `Essai qui se termine (J-${Math.max(a.trialDaysLeft, 0)}), sans vrai usage`, detail: "Il n'a jamais réussi de scan. Propose-lui ton aide ou offre-lui quelques jours.", template: "relance" });
    else if (a.status === "expired" && a.ageDays <= 21) add({ severity: "medium", kind: "expired", email: a.email, title: "Essai terminé sans abonnement", detail: `Inscrit il y a ${a.ageDays} jours. Dernière chance de comprendre ce qui a bloqué.`, template: "annule" });
    else if (a.status === "trial" && a.ageDays >= 1 && !a.milestones.scanTry.reached && !a.milestones.recipe.reached) add({ severity: "medium", kind: "no_action", email: a.email, title: "Inscrit mais n'a encore rien essayé", detail: `Inscrit il y a ${a.ageDays} jour${a.ageDays > 1 ? "s" : ""}, aucun scan ni recette. Un message d'aide peut le débloquer.`, template: "relance" });
    else if (a.status === "subscribed" && a.idleDays !== null && a.idleDays >= 7) add({ severity: "medium", kind: "idle_subscriber", email: a.email, title: "Abonné qui n'est pas revenu depuis une semaine", detail: `Dernière activité il y a ${a.idleDays} jours. Demande-lui s'il lui manque quelque chose.`, template: "abonne_inactif" });
  }
  const sevOrder = { high: 0, medium: 1, low: 2 };
  actions.sort((x, y) => sevOrder[x.severity] - sevOrder[y.severity]);
  if (health.errors.length && health.errors[0].count >= 3) actions.unshift({ severity: "high", kind: "tech", email: null, title: "Une erreur technique se répète", detail: `« ${health.errors[0].message.slice(0, 120)} » : ${health.errors[0].count} fois chez ${health.errors[0].accounts} compte(s). Voir l'écran Santé.`, template: null });

  // ---- Revenus ----
  const revenue = stripe
    ? { source: "stripe", mrr: stripe.mrr, activeSubs: stripe.active, trialingSubs: stripe.trialing, canceling: stripe.canceling, pastDue: stripe.pastDue }
    : { source: "estimation", mrr: totals.subscribed * 49, activeSubs: totals.subscribed, trialingSubs: 0, canceling: 0, pastDue: totals.pastDue };

  return { v: 2, generatedAt: new Date(now).toISOString(), periodDays: days, kpis, totals, steps, medianHoursToFirstScan: medianHours, insights, series, sources, features, retention, health, actions, revenue, accounts, activeAccountsInPeriod: activeNow.size };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fiche d'un compte : historique lisible, regroupé en sessions (plus de « connexion » en rafale)
// ---------------------------------------------------------------------------------------------------------------------------------------------
export function buildAccountDetail(events, now) {
  const sorted = events.filter((e) => e && e.created_at).slice().sort((a, b) => ts(a.created_at) - ts(b.created_at));
  const sessions = groupSessions(sorted).map((s) => {
    // Dans une session, on regroupe les répétitions (même type d'affilée) pour garder une lecture courte
    const lines = [];
    for (const e of s.events) {
      const prev = lines[lines.length - 1];
      const label = ACTIVITY_LABELS[e.type] || e.type;
      if (prev && prev.type === e.type && e.type !== "scan_invoice" && e.type !== "scan_recipe" && e.type !== "scan_failed" && e.type !== "client_error" && e.type !== "client_crash" && e.type !== "admin_email_sent") {
        prev.count++;
        prev.lastAt = e.created_at;
      } else {
        lines.push({ type: e.type, label, count: 1, at: e.created_at, lastAt: e.created_at, meta: e.meta || {} });
      }
    }
    const first = s.events[0];
    const device = first && first.meta && (first.meta.os || first.meta.ecran) ? `${first.meta.os || "?"}${first.meta.installee ? " (app installée)" : ""}` : null;
    return { start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), durationMin: Math.max(1, Math.round((s.end - s.start) / 60000)), events: s.n, device, lines };
  });
  return { generatedAt: new Date(now).toISOString(), total: sorted.length, sessions: sessions.reverse() };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lecture seule pour l'assistant (2026-11-21, demande d'Alex : « il faudrait que tu aies accès à mes stats du tableau de bord pour suivre les stats en temps réel »)
//
// `statsOnly` ne garde du tableau de bord que des TOTAUX : visites, clics, inscriptions, parcours, sources, fonctionnalités, santé du scanner, revenus. Jamais un
// email, jamais la liste des comptes, jamais la liste des actions à mener (qui contient des emails), jamais le détail d'un scan. C'est ce qui rend acceptable de
// donner un jeton de lecture à l'assistant : si ce jeton fuitait, on ne verrait que des chiffres.
// `buildHourly` donne le même genre de chiffres heure par heure (UTC) sur les dernières 24 à 72 heures : c'est ce qui permet de voir l'effet d'une publication
// TikTok dans les heures qui suivent, au lieu d'attendre le total du jour.
// ---------------------------------------------------------------------------------------------------------------------------------------------
const EMAIL_RE = /[^\s@<>"']+@[^\s@<>"']+\.[A-Za-z]{2,}/g;

export function statsOnly(v2) {
  if (!v2 || typeof v2 !== "object") return null;
  const scans = v2.health && v2.health.scans ? v2.health.scans : null;
  return {
    v: "stats-1",
    generatedAt: v2.generatedAt,
    periodDays: v2.periodDays,
    kpis: v2.kpis,
    totals: v2.totals,
    steps: v2.steps,
    medianHoursToFirstScan: v2.medianHoursToFirstScan,
    insights: (v2.insights || []).map((i) => ({ level: i.level, text: String(i.text || "").replace(EMAIL_RE, "[email]") })),
    series: v2.series,
    sources: v2.sources,
    features: v2.features,
    retention: v2.retention,
    revenue: v2.revenue,
    activeAccountsInPeriod: v2.activeAccountsInPeriod,
    health: {
      scans: scans ? { ok: scans.ok, failed: scans.failed, successPct: scans.successPct, failuresByCode: scans.failuresByCode } : null,
      errors: ((v2.health && v2.health.errors) || []).map((e) => ({ kind: e.kind, message: String(e.message || "").replace(EMAIL_RE, "[email]").slice(0, 200), count: e.count, accounts: e.accounts, lastAt: e.lastAt })),
    },
  };
}

// Visites et inscriptions heure par heure (UTC), de la plus ancienne à l'heure en cours. `landingRows` : [{ event_type, source, created_at }] ; `signupDates` : les
// dates de création des comptes CLIENTS (internes déjà écartés par l'appelant).
export function buildHourly({ now, hours = 48, landingRows = [], signupDates = [] }) {
  const H = 60 * 60 * 1000;
  const n = Math.max(1, Math.min(168, Math.round(hours) || 48));
  const end = Math.floor(now / H) * H;
  const start = end - (n - 1) * H;
  const slots = [];
  for (let t = start; t <= end; t += H) slots.push({ hour: new Date(t).toISOString().slice(0, 13) + ":00Z", views: 0, engaged: 0, startClicks: 0, loginClicks: 0, calcUsed: 0, signups: 0 });
  const slotOf = (iso) => {
    const t = ts(iso);
    if (!(t >= start && t < end + H)) return null;
    return slots[Math.floor((t - start) / H)];
  };
  const KEY = { view: "views", engaged: "engaged", start_click: "startClicks", login_click: "loginClicks", calc_used: "calcUsed" };
  const viewsBySource = {};
  for (const r of landingRows) {
    const s = slotOf(r.created_at);
    const k = KEY[r.event_type];
    if (!s || !k) continue;
    s[k]++;
    if (r.event_type === "view") { const src = r.source || "direct"; viewsBySource[src] = (viewsBySource[src] || 0) + 1; }
  }
  for (const d of signupDates) { const s = slotOf(d); if (s) s.signups++; }
  return { hours: n, slots, viewsBySource };
}
