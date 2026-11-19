// Page de développement du tableau de bord admin : le VRAI composant (src/adminDashboard.jsx) et les VRAIS calculs (api/_dashboard.js) alimentés par des
// données fabriquées. Aucune API, aucun compte, aucun email envoyé. Voir index.html pour l'usage.
import React from "react";
import ReactDOM from "react-dom/client";
import "/src/index.css";
import { AdminDashboard } from "/src/adminDashboard.jsx";
import { buildDashboard, buildAccountDetail } from "/api/_dashboard.js";

const DAY = 86400000, H = 3600000, MIN = 60000;
const NOW = Date.now();
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const mk = (id, email, daysAgo, o = {}) => ({ id, email, created_at: iso(daysAgo * DAY), email_confirmed_at: o.unconfirmed ? null : iso(daysAgo * DAY), app_metadata: { provider: o.google ? "google" : "email" }, user_metadata: { signup_source: o.source || "direct" } });

const users = [
  mk("u1", "alexmollet0@gmail.com", 90),
  mk("u2", "marie@bistrot-du-port.fr", 25, { source: "tiktok" }),
  mk("u3", "contact@chez-paolo.fr", 18, { source: "tiktok", google: true }),
  mk("u4", "timothy.l@orange.fr", 12, { source: "tiktok" }),
  mk("u5", "lucie@creperie-lucie.fr", 4, { source: "tiktok" }),
  mk("u6", "karim@snack-karim.fr", 6, { source: "direct" }),
  mk("u7", "pizzeria.roma@gmail.com", 2, { source: "tiktok" }),
  mk("u8", "nina.sushi@gmail.com", 1, { source: "tiktok", unconfirmed: true }),
  mk("u9", "bernard@hotmail.fr", 15, { source: "direct" }),
  mk("u10", "olivier.bar@gmail.com", 25, { source: "direct" }),
  mk("u11", "sofia@cantina.es", 3, { source: "tiktok" }),
  mk("u12", "leo@leo-traiteur.fr", 20, { source: "direct" }),
  mk("u13", "emma@bistro-emma.fr", 5, { source: "tiktok" }),
  mk("u14", "hugo@gmail.com", 40, { source: "direct" }),
  mk("u15", "julie@brasserie-julie.fr", 0.2, { source: "tiktok" }),
  mk("u16", "adam@kebab-adam.fr", 2.4, { source: "tiktok" }),
];
const subs = [{ user_id: "u2", status: "active" }, { user_id: "u3", status: "active" }, { user_id: "u4", status: "canceled" }, { user_id: "u12", status: "past_due" }];
const events = [];
const ev = (u, type, msAgo, meta = {}) => events.push({ user_id: u, type, created_at: iso(msAgo), meta });
const dev = { os: "ios", installee: true, ecran: "mobile", navigateur: "safari", langue: "fr" };
const activity = { u1: [0, 1, 2, 5], u2: [0, 1, 2, 3, 5, 6, 8, 9, 12, 14, 17, 20, 24], u3: [0, 2, 3, 6, 8, 10, 15, 17], u4: [11, 10], u5: [0, 1, 2, 3], u6: [0, 1, 4, 5], u7: [1, 2], u9: [14], u11: [2], u12: [1, 4, 9, 14, 18], u13: [0, 1, 3, 4], u15: [0], u16: [2] };
for (const [u, ds] of Object.entries(activity)) for (const d of ds) {
  const base = d * DAY + rnd() * 10 * H;
  const burst = u === "u2" || u === "u13" ? 5 : 1;
  for (let b = 0; b < burst; b++) ev(u, "login", base - b * 2 * MIN, b === 0 ? dev : {});
  ev(u, "tab_opened", base - 3 * MIN, { tab: "recipes" });
  if (["u2", "u3", "u12", "u13", "u5"].includes(u) && rnd() > 0.35) ev(u, "recipe_opened", base - 5 * MIN);
  if (["u2", "u3"].includes(u) && rnd() > 0.5) ev(u, "price_updated", base - 7 * MIN, { source: "manual" });
  if (["u2", "u13"].includes(u) && rnd() > 0.7) ev(u, "print_used", base - 9 * MIN, { kind: "fiche" });
}
const scanOk = (u, msAgo, n) => ev(u, "scan_invoice", msAgo, { foodItems: n, totalItems: n + 2, lowConfidenceItems: 1, items: Array.from({ length: n }, (_, i) => ({ name: "Produit " + (i + 1), unit: "kg", price: 3 + i })), imagePath: "x/y.jpg" });
scanOk("u2", 20 * DAY, 11); scanOk("u2", 9 * DAY, 14); scanOk("u2", 2 * DAY, 9); scanOk("u3", 16 * DAY, 7); scanOk("u3", 6 * DAY, 12); scanOk("u5", 3 * DAY, 8); scanOk("u13", 4 * DAY, 10); scanOk("u12", 18 * DAY, 6);
ev("u2", "recipe_created", 20 * DAY - 5 * MIN, { name: "Burger maison", source: "express" }); ev("u3", "recipe_created", 16 * DAY - 5 * MIN, { name: "Pizza reine" }); ev("u5", "recipe_created", 3 * DAY - 6 * MIN, { name: "Galette complète" }); ev("u13", "recipe_created", 4 * DAY - 6 * MIN, { name: "Risotto", source: "daily_stock" });
ev("u2", "digital_menu_published", 8 * DAY); ev("u3", "tutorial_closed", 17 * DAY, { finishedAll: true }); ev("u2", "tutorial_closed", 24 * DAY); ev("u13", "allergen_sheet_opened", 3 * DAY); ev("u2", "allergen_sheet_opened", 5 * DAY);
ev("u4", "scan_button_clicked", 11 * DAY - MIN); ev("u4", "scan_file_selected", 11 * DAY - 2 * MIN); ev("u4", "scan_failed", 11 * DAY - 3 * MIN, { code: "ai_unreadable" }); ev("u4", "scan_failed", 10 * DAY, { code: "ai_unreadable", imagePath: "t/t.jpg" }); ev("u4", "subscribe_clicked", 9 * DAY);
ev("u6", "scan_button_clicked", 4 * DAY); ev("u6", "scan_failed", 4 * DAY - MIN, { code: "file_unreadable", imagePath: "k/k.jpg" }); ev("u6", "scan_failed", 20 * H, { code: "ai_timeout" });
ev("u7", "scan_button_clicked", 2 * DAY - H); ev("u7", "scan_file_selected", 2 * DAY - H - MIN); ev("u9", "scan_button_clicked", 14 * DAY - MIN); ev("u2", "subscribe_clicked", 19 * DAY); ev("u3", "subscribe_clicked", 12 * DAY);
ev("u7", "client_error", 30 * H, { message: "Cannot read properties of undefined (reading 'name')", version: "index-Bx3k.js", os: "android", navigateur: "chrome", installee: true, fichier: "index-Bx3k.js" });
ev("u5", "client_error", 20 * H, { message: "Cannot read properties of undefined (reading 'name')", version: "index-Bx3k.js", os: "ios", navigateur: "safari" });
ev("u13", "client_crash", 6 * H, { message: "Minified React error #310", version: "index-Bx3k.js", os: "ios", installee: true });
ev("u2", "admin_email_sent", 15 * DAY, { subject: "Une question sur ton premier scan" }); ev("u2", "pwa_installed", 24 * DAY); ev("u3", "pwa_installed", 17 * DAY);
// visites : 60 jours, avec des jours creux et un pic (une vidéo qui marche)
const landing = [];
for (let i = 0; i < 60; i++) {
  const d = new Date(NOW - i * DAY).toISOString().slice(0, 10);
  const pic = i === 3 ? 40 : 0;
  const v = 3 + Math.floor(rnd() * 12) + pic;
  landing.push({ event_type: "view", source: i % 3 ? "tiktok" : "direct", day: d, cnt: v });
  landing.push({ event_type: "start_click", source: "tiktok", day: d, cnt: Math.floor(v / 4) });
  landing.push({ event_type: "view", source: "direct", day: d, cnt: 2 });
}
const kv = { u2: { recipes: [{ id: "r1" }, { id: "a" }, { id: "b" }], ingredients: [{ id: "x", suppliers: [{ priceSource: "scan" }] }, { id: "y", suppliers: [{ priceSource: "scan" }] }], menuSettings: { published: true }, lang: "fr" }, u3: { recipes: [{ id: "a" }], ingredients: [{ id: "x", suppliers: [{ priceSource: "scan" }] }], lang: "fr" }, u5: { recipes: [{ id: "a" }], lang: "fr" }, u11: { lang: "es" }, u13: { recipes: [{ id: "a" }, { id: "b" }], lang: "fr" } };
const isInternal = (e) => e === "alexmollet0@gmail.com";
const build = (days) => buildDashboard({ now: Date.now(), days, users, subs, events, landing, kv, stripe: { mrr: 78, active: 2, trialing: 0, canceling: 1, pastDue: 1 }, isInternal, trialDays: 7 });

const loader = async (days) => ({ periodDays: days, v2: build(days), v2Error: null });
const poster = async (p) => {
  if (p.action === "account_detail") {
    const u = users.find((x) => x.email === p.email);
    return { detail: buildAccountDetail(events.filter((e) => e.user_id === u.id), Date.now()) };
  }
  if (p.action === "get_scan_image_url") return { url: "about:blank" };
  window.__posts = (window.__posts || []).concat([p]); // visible dans la console : rien n'est envoyé nulle part
  return { ok: true };
};
ReactDOM.createRoot(document.getElementById("root")).render(<div className="p-4"><AdminDashboard loader={loader} poster={poster} /></div>);
