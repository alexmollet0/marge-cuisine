// Tableau de bord admin refait de A à Z (2026-11-19), à la demande d'Alex : « un tableau de bord comme les grandes entreprises, savoir tout ce qui fonctionne et
// ce qui ne fonctionne pas, le parcours de l'utilisateur, suivre tous les comptes et pouvoir envoyer un mail directement ».
// Sept écrans : Aujourd'hui · Parcours · Comptes · Fonctionnalités · Acquisition · Rétention · Santé, plus la fiche d'un compte et l'envoi d'un email.
// Les calculs sont faits côté serveur (api/_dashboard.js, testés par scripts/test-dashboard.mjs) : ce fichier ne fait qu'afficher `data.v2`.
// L'ancien écran (AdminDashboard dans src/adminAndOnboarding.jsx) est gardé tel quel, non branché (hide-don't-delete).
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  RefreshCw, Search, Mail, Gift, RotateCcw, Trash2, ExternalLink, AlertTriangle, Smartphone, Monitor,
  TrendingUp, TrendingDown, Minus, Send, Loader2, X, Check, CircleDot,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { TIER_COLORS, BRAND_SOLID, BRAND_GRADIENT } from "./brand.js";

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Accès à l'API (remplaçables dans un test : <AdminDashboard loader={…} poster={…} />)
// ---------------------------------------------------------------------------------------------------------------------------------------------
async function tokenHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` };
}
async function defaultLoader(days) {
  const res = await fetch(`/api/admin-dashboard?days=${days}`, { headers: await tokenHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur du tableau de bord");
  return data;
}
async function defaultPoster(payload) {
  const res = await fetch("/api/admin-dashboard", { method: "POST", headers: await tokenHeaders(), body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Échec");
  return data;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Petits outils d'affichage
// ---------------------------------------------------------------------------------------------------------------------------------------------
const nf = new Intl.NumberFormat("fr-FR");
const fmtInt = (n) => (n == null ? "—" : nf.format(Math.round(n)));
const fmtEur = (n) => (n == null ? "—" : nf.format(Math.round(n)) + " €");
const fmtPct = (n) => (n == null ? "—" : String(n).replace(".", ",") + " %");
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (iso) => (iso ? new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—");
function relTime(iso, now = Date.now()) {
  if (!iso) return "jamais";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 90) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 90) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 36) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

const CARD_STYLE = { background: "#201B15", borderColor: "rgba(255,255,255,0.08)" };
const TONES = {
  green: { bg: "rgba(16,185,129,0.15)", fg: "#34D399" },
  amber: { bg: "rgba(245,158,11,0.15)", fg: "#FBBF24" },
  red: { bg: "rgba(239,68,68,0.15)", fg: "#F87171" },
  blue: { bg: "rgba(56,189,248,0.15)", fg: "#38BDF8" },
  gray: { bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.65)" },
  copper: { bg: "rgba(201,121,59,0.18)", fg: "#E0A050" },
};
function Badge({ tone = "gray", children, title }) {
  const t = TONES[tone] || TONES.gray;
  return <span title={title} className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: t.bg, color: t.fg }}>{children}</span>;
}
function Card({ title, hint, right, children, className = "" }) {
  return (
    <section className={`rounded-2xl border p-4 ${className}`} style={CARD_STYLE}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h3 className="font-display uppercase tracking-wide text-sm text-white">{title}</h3>}
            {hint && <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{hint}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
function Delta({ pct, abs, inverse }) {
  // Pourcentage quand la période d'avant est assez grande ; sinon l'écart brut (« +11 »), jamais un « +1100 % » trompeur
  const val = pct != null ? pct : abs;
  if (val == null) return <span className="text-[11px] text-white/30">—</span>;
  const up = val > 0, flat = val === 0;
  const good = flat ? null : inverse ? !up : up;
  const color = good === null ? "#9CA3AF" : good ? TIER_COLORS.high : TIER_COLORS.low;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color }} title="par rapport à la période d'avant"><Icon size={12} />{up ? "+" : ""}{String(val).replace(".", ",")}{pct != null ? " %" : ""}</span>;
}
function Kpi({ label, value, sub, delta, abs, inverse, accent, onClick }) {
  const inner = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span className="font-display text-3xl leading-none" style={{ color: accent || "#fff" }}>{value}</span>
        {(delta !== undefined || abs !== undefined) && <Delta pct={delta} abs={abs} inverse={inverse} />}
      </div>
      {sub && <div className="mt-1 text-[11px] text-white/45 leading-snug">{sub}</div>}
    </>
  );
  const cls = "rounded-2xl border p-3.5 text-left";
  return onClick ? <button type="button" onClick={onClick} className={`${cls} hover:border-white/20`} style={CARD_STYLE}>{inner}</button> : <div className={cls} style={CARD_STYLE}>{inner}</div>;
}
const Empty = ({ children }) => <p className="text-xs text-white/40 py-3">{children}</p>;

// Visites et inscriptions (« essais ») JOUR PAR JOUR : demandé par Alex (2026-11-19, « je veux les visites par jour et les essais par jour »). Le jour le plus récent
// est en haut ; sous chaque jour, qui s'est inscrit (clic = fiche du compte). Les jours sont comptés en heure universelle (UTC), comme la base des visites.
function MiniStat({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: "#16130F", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="text-[10px] uppercase tracking-wide text-white/40 leading-tight">{label}</div>
      <div className="font-display text-2xl leading-none mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-white/45 mt-1">{sub}</div>}
    </div>
  );
}
function DayByDay({ d, openAccount, rows = 14 }) {
  const [showAll, setShowAll] = useState(false);
  const series = d.series || [];
  const list = useMemo(() => series.slice().reverse().slice(0, showAll ? series.length : rows), [series, showAll, rows]);
  const whoByDay = useMemo(() => {
    const m = {};
    for (const a of d.accounts) {
      if (a.internal) continue;
      const k = a.createdAt.slice(0, 10);
      (m[k] = m[k] || []).push(a);
    }
    return m;
  }, [d]);
  if (!series.length) return null;
  const maxV = Math.max(1, ...list.map((s) => s.visits));
  const maxS = Math.max(1, ...list.map((s) => s.signups));
  const today = series[series.length - 1];
  const yesterday = series.length > 1 ? series[series.length - 2] : null;
  const tot = list.reduce((t, s) => ({ visits: t.visits + s.visits, clicks: t.clicks + s.startClicks, signups: t.signups + s.signups }), { visits: 0, clicks: 0, signups: 0 });
  const dayLabel = (date, i) => {
    const l = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
    return i === 0 ? `Aujourd'hui · ${l}` : i === 1 ? `Hier · ${l}` : l;
  };
  return (
    <Card title="Visites et essais, jour par jour" hint="Un « essai » = une inscription : le compte démarre ses 7 jours gratuits. Le jour le plus récent est en haut ; sous chaque jour, qui s'est inscrit.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <MiniStat label="Visites aujourd'hui" value={fmtInt(today.visits)} sub={yesterday ? `hier : ${fmtInt(yesterday.visits)}` : null} color="#38BDF8" />
        <MiniStat label="Essais aujourd'hui" value={fmtInt(today.signups)} sub={yesterday ? `hier : ${fmtInt(yesterday.signups)}` : null} color="#10B981" />
        <MiniStat label={`Visites sur ${list.length} jours`} value={fmtInt(tot.visits)} sub={`${fmtInt(tot.clicks)} clics sur « Essayer »`} color="#38BDF8" />
        <MiniStat label={`Essais sur ${list.length} jours`} value={fmtInt(tot.signups)} sub={tot.visits ? `${fmtPct(Math.round((1000 * tot.signups) / tot.visits) / 10)} des visites` : null} color="#10B981" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-white/40">
              <th className="text-left font-normal pb-2">Jour</th>
              <th className="text-right font-normal pb-2 w-24">Visites</th>
              <th className="text-right font-normal pb-2 w-16">Clics</th>
              <th className="text-right font-normal pb-2 w-24">Essais</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => {
              const who = whoByDay[s.date] || [];
              return (
                <tr key={s.date} className="border-t border-white/5 align-top">
                  <td className="py-2 pr-2">
                    <div className={i === 0 ? "text-white font-semibold" : "text-white/80"}>{dayLabel(s.date, i)}</div>
                    {who.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {who.slice(0, 3).map((a) => (
                          <button key={a.id} type="button" onClick={() => openAccount(a.email)} className="rounded-full px-2 py-0.5 text-[10px] text-white/70 hover:text-white" style={{ background: "rgba(16,185,129,0.14)" }}>{a.email}</button>
                        ))}
                        {who.length > 3 && <span className="text-[10px] text-white/40 self-center">+{who.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <span className="font-semibold text-white">{fmtInt(s.visits)}</span>
                    <div className="h-1 rounded-full mt-1 ml-auto" style={{ width: `${(s.visits / maxV) * 100}%`, minWidth: s.visits ? 3 : 0, background: "#38BDF8" }} />
                  </td>
                  <td className="py-2 text-right text-white/60">{fmtInt(s.startClicks)}</td>
                  <td className="py-2 text-right">
                    <span className="font-semibold" style={{ color: s.signups ? "#34D399" : "rgba(255,255,255,0.35)" }}>{fmtInt(s.signups)}</span>
                    <div className="h-1 rounded-full mt-1 ml-auto" style={{ width: `${(s.signups / maxS) * 100}%`, minWidth: s.signups ? 3 : 0, background: "#10B981" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {series.length > rows && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs text-white/60 hover:text-white underline underline-offset-2">{showAll ? "Réduire" : `Voir les ${series.length} jours`}</button>
      )}
      <p className="text-[11px] text-white/35 mt-3 leading-snug">Les jours changent à 1 h du matin en France (2 h l'été). Tes propres visites comptent tant que tu n'as pas ouvert une fois getchefup.com/?notrack=1 sur chaque appareil.</p>
    </Card>
  );
}

// Courbes simples (SVG, aucune dépendance) : `lines` = [{ key, label, color }]
function SeriesChart({ series, lines, height = 120 }) {
  if (!series || !series.length) return <Empty>Pas encore de données.</Empty>;
  const w = 600, h = height, pad = 6;
  const max = Math.max(1, ...series.flatMap((s) => lines.map((l) => s[l.key] || 0)));
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, series.length - 1);
  const y = (v) => h - pad - (v / max) * (h - 2 * pad);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }} role="img">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={pad} x2={w - pad} y1={h - pad - f * (h - 2 * pad)} y2={h - pad - f * (h - 2 * pad)} stroke="rgba(255,255,255,0.06)" />)}
        {lines.map((l) => (
          <polyline key={l.key} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            points={series.map((s, i) => `${x(i)},${y(s[l.key] || 0)}`).join(" ")} />
        ))}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-white/35 mt-1">
        <span>{fmtDay(series[0].date)}</span>
        <span className="flex items-center gap-3">{lines.map((l) => <span key={l.key} className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: l.color }} />{l.label}</span>)}</span>
        <span>{fmtDay(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------------------------------------------------------------------------
const STATUS_TONE = { subscribed: "green", past_due: "amber", trial: "blue", canceled: "gray", expired: "gray" };
const HEALTH = {
  nouveau: { label: "Nouveau", tone: "blue" },
  actif: { label: "Actif", tone: "green" },
  a_relancer: { label: "À relancer", tone: "amber" },
  risque: { label: "À risque", tone: "red" },
  perdu: { label: "Perdu", tone: "gray" },
};
const SCAN_CODES_FR = {
  offline: "Connexion perdue", ai_timeout: "Délai dépassé", ai_busy: "Service saturé", ai_unavailable: "IA indisponible", ai_unreadable: "Réponse illisible",
  file_unreadable: "Fichier illisible", file_password_protected: "PDF protégé", file_too_large: "Fichier trop gros", rate_limited: "Trop d'essais", auth_expired: "Connexion expirée",
  auth_required: "Connexion nécessaire", unknown: "Cause inconnue",
};
const STAGES_ORDER = ["Inscrit, jamais ouvert", "A ouvert l'app", "A essayé de scanner", "Premier scan réussi", "Recette créée", "Carte publiée", "A cliqué « S'abonner »"];
const MILESTONES = [
  ["session", "Ouvert l'app"], ["tutorial", "Tuto"], ["scanTry", "Essai de scan"], ["scanOk", "Scan réussi"], ["recipe", "Recette"], ["menu", "Carte"], ["subscribeClick", "Clic « S'abonner »"], ["paid", "Abonné"],
];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Emails prêts à l'emploi (texte simple, modifiable avant l'envoi ; envoyés un par un, jamais en groupe)
// ---------------------------------------------------------------------------------------------------------------------------------------------
export const EMAIL_TEMPLATES = {
  relance: {
    label: "Relance : besoin d'aide ?",
    subject: "Je peux t'aider avec Chefup ?",
    body: "Salut,\n\nJe vois que tu as créé ton compte Chefup, mais que tu n'as pas encore scanné de facture. Est-ce que quelque chose t'a bloqué ?\n\nSi tu veux, envoie-moi la photo d'une de tes factures par retour de mail : je regarde avec toi ce que Chefup en tire. Ça prend deux minutes.\n\nAlex",
  },
  scan: {
    label: "Un scan a échoué",
    subject: "Ton scan n'a pas marché : je regarde ça",
    body: "Salut,\n\nJ'ai vu qu'un de tes scans de facture n'avait pas abouti, désolé pour ça. Je regarde ce qui s'est passé de mon côté.\n\nSi tu peux, renvoie-moi la facture par retour de mail (photo ou PDF) : je te dis tout de suite ce que Chefup en tire.\n\nAlex",
  },
  fin_essai: {
    label: "Fin d'essai (il utilise l'app)",
    subject: "Ton essai Chefup se termine bientôt",
    body: "Salut,\n\nTon essai gratuit se termine dans quelques jours, et je vois que tu as déjà scanné des factures : super.\n\nSi Chefup t'est utile, tu peux t'abonner depuis l'app (49 €/mois, annulable quand tu veux). Et s'il manque quelque chose ou si quelque chose te gêne, dis-le-moi en répondant à ce mail : je corrige vite.\n\nAlex",
  },
  annule: {
    label: "Parti : qu'est-ce qui a bloqué ?",
    subject: "Qu'est-ce qui n'a pas marché avec Chefup ?",
    body: "Salut,\n\nJe vois que tu n'as pas continué avec Chefup. Aucun souci, mais ton avis m'aiderait beaucoup : qu'est-ce qui n'a pas marché, ou qu'est-ce qui t'a manqué ? Une ligne suffit.\n\nJe te lis, et si c'est un bug je le corrige.\n\nAlex",
  },
  paiement: {
    label: "Paiement en retard",
    subject: "Un souci avec ton paiement Chefup",
    body: "Salut,\n\nLe dernier paiement de ton abonnement Chefup n'est pas passé. Ça arrive souvent quand la carte a expiré ou a été renouvelée.\n\nTu peux mettre à jour ta carte depuis l'app (Mon compte). Si tu as un doute ou si tu veux qu'on regarde ensemble, réponds-moi.\n\nAlex",
  },
  abonne_inactif: {
    label: "Abonné inactif : il te manque quelque chose ?",
    subject: "Il te manque quelque chose sur Chefup ?",
    body: "Salut,\n\nJe vois que tu n'es pas revenu sur Chefup depuis quelques jours. Est-ce qu'il te manque quelque chose, ou est-ce que quelque chose ne marche pas comme tu l'attendais ?\n\nUne ligne de ta part m'aide à améliorer l'app, et je te réponds vite.\n\nAlex",
  },
  libre: { label: "Message libre", subject: "", body: "" },
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écran 1 : Aujourd'hui
// ---------------------------------------------------------------------------------------------------------------------------------------------
function TodayTab({ d, openAccount, openCompose, setTab }) {
  const k = d.kpis, t = d.totals;
  const urgent = d.actions.filter((a) => a.severity === "high").length;
  return (
    <div className="space-y-4">
      <DayByDay d={d} openAccount={openAccount} rows={14} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Visites de la page d'accueil" value={fmtInt(k.visits.value)} delta={k.visits.deltaPct} abs={k.visits.delta} sub={`${d.periodDays} derniers jours`} />
        <Kpi label="Inscriptions" value={fmtInt(k.signups.value)} delta={k.signups.deltaPct} abs={k.signups.delta} sub={`${fmtInt(k.startClicks.value)} clics sur « Essayer »`} />
        <Kpi label="Comptes actifs" value={fmtInt(k.activeAccounts.value)} delta={k.activeAccounts.deltaPct} abs={k.activeAccounts.delta} sub="ont ouvert l'app au moins une fois" />
        <Kpi label="Scans réussis" value={fmtInt(k.scansOk.value)} delta={k.scansOk.deltaPct} abs={k.scansOk.delta} sub={d.health.scans.successPct != null ? `${fmtPct(d.health.scans.successPct)} de réussite` : "aucun scan"} accent={BRAND_SOLID} />
        <Kpi label="Abonnés payants" value={fmtInt(t.subscribed)} sub={`${fmtEur(d.revenue.mrr)} / mois${d.revenue.source === "estimation" ? " (estimé)" : ""}${d.revenue.canceling ? ` · ${d.revenue.canceling} qui part` : ""}`} accent={TIER_COLORS.high} />
        <Kpi label="Essais en cours" value={fmtInt(t.trials)} sub={t.trialsEndingSoon ? `${t.trialsEndingSoon} se termine dans 2 jours ou moins` : "aucun ne se termine bientôt"} onClick={() => setTab("accounts")} />
        <Kpi label="Scans échoués" value={fmtInt(k.scansFailed.value)} delta={k.scansFailed.deltaPct} abs={k.scansFailed.delta} inverse sub="voir l'écran Santé" onClick={() => setTab("health")} />
        <Kpi label="Erreurs techniques" value={fmtInt(k.errors.value)} delta={k.errors.deltaPct} abs={k.errors.delta} inverse sub={d.health.trackingSince ? "suivi actif" : "suivi qui démarre"} onClick={() => setTab("health")} />
      </div>

      <Card title="À faire maintenant" hint="Les comptes à qui écrire, du plus urgent au moins urgent." right={urgent ? <Badge tone="red">{urgent} urgent{urgent > 1 ? "s" : ""}</Badge> : null}>
        {!d.actions.length && <Empty>Rien d'urgent : aucun compte ne demande ton attention.</Empty>}
        <ul className="divide-y divide-white/5">
          {d.actions.slice(0, 12).map((a, i) => (
            <li key={i} className="py-2.5 flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: a.severity === "high" ? TIER_COLORS.low : TIER_COLORS.mid }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white font-semibold leading-snug">{a.title}</div>
                {a.email && <button type="button" onClick={() => openAccount(a.email)} className="text-xs text-white/60 hover:text-white underline-offset-2 hover:underline break-all">{a.email}</button>}
                <div className="text-xs text-white/50 mt-0.5 leading-snug">{a.detail}</div>
              </div>
              {a.email && a.template && (
                <button type="button" onClick={() => openCompose(a.email, a.template)} className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: BRAND_GRADIENT }}>
                  <Mail size={12} /> Écrire
                </button>
              )}
              {!a.email && <button type="button" onClick={() => setTab("health")} className="shrink-0 text-[11px] text-white/60 underline">Voir</button>}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Ce que disent les chiffres" hint="Lecture automatique du parcours (écran Parcours).">
          {!d.insights.length && <Empty>Pas assez de comptes sur la période pour tirer une conclusion.</Empty>}
          <ul className="space-y-2">
            {d.insights.map((i, n) => (
              <li key={n} className="flex items-start gap-2 text-sm text-white/80 leading-snug">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: i.level === "bad" ? TIER_COLORS.low : i.level === "warn" ? TIER_COLORS.mid : "#38BDF8" }} />
                {i.text}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Activité jour par jour" hint="Inscriptions, comptes actifs, scans réussis.">
          <SeriesChart series={d.series} lines={[{ key: "signups", label: "inscriptions", color: "#38BDF8" }, { key: "active", label: "comptes actifs", color: "#10B981" }, { key: "scansOk", label: "scans", color: BRAND_SOLID }]} />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écran 2 : Parcours
// ---------------------------------------------------------------------------------------------------------------------------------------------
function JourneyTab({ d, openAccount }) {
  const cohortSize = d.steps.find((s) => s.key === "signups")?.count || 0;
  // Deux échelles : les visiteurs se comparent aux visiteurs, les comptes créés à la taille du groupe (sinon 12 comptes disparaissent à côté de 392 visites)
  const topVisits = Math.max(1, d.steps[0].count);
  const topCohort = Math.max(1, cohortSize);
  const stuck = useMemo(() => {
    const groups = {};
    for (const a of d.accounts) {
      if (a.internal || a.ageDays > d.periodDays) continue;
      (groups[a.stage] = groups[a.stage] || []).push(a);
    }
    return groups;
  }, [d]);
  return (
    <div className="space-y-4">
      <Card title="De la visite à l'abonnement" hint={`Les deux premières lignes comptent les visiteurs ; les suivantes comptent les ${cohortSize} comptes créés sur les ${d.periodDays} derniers jours.`}>
        <ul className="space-y-2.5">
          {d.steps.map((s, i) => (
            <li key={s.key}>
              {s.key === "signups" && <div className="text-[10px] uppercase tracking-wider text-white/35 mt-3 mb-2">Parmi les comptes créés</div>}
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-white/80">{s.label}</span>
                <span className="shrink-0 text-white font-semibold">{fmtInt(s.count)}{s.pctOfPrev != null && <span className="ml-2 text-[11px] font-normal text-white/45">{fmtPct(s.pctOfPrev)} de l'étape d'avant</span>}</span>
              </div>
              <div className="h-2 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(s.count ? 2 : 0, (s.count / (s.cohort ? topCohort : topVisits)) * 100)}%`, background: i < 2 ? "#38BDF8" : BRAND_GRADIENT }} />
              </div>
            </li>
          ))}
        </ul>
        {d.medianHoursToFirstScan != null && (
          <p className="text-xs text-white/50 mt-4">Temps médian entre l'inscription et le premier scan réussi : <b className="text-white/80">{d.medianHoursToFirstScan < 1 ? `${Math.round(d.medianHoursToFirstScan * 60)} minutes` : d.medianHoursToFirstScan < 48 ? `${Math.round(d.medianHoursToFirstScan)} heures` : `${Math.round(d.medianHoursToFirstScan / 24)} jours`}</b>.</p>
        )}
      </Card>

      <Card title="Où en est chaque compte ?" hint="Chaque compte créé sur la période, rangé à l'étape où il s'est arrêté. Clique sur un compte pour voir son parcours.">
        {STAGES_ORDER.map((stage) => (stuck[stage] || []).length > 0 && (
          <div key={stage} className="py-2.5 border-t border-white/5 first:border-0">
            <div className="flex items-center gap-2 mb-1.5"><span className="text-sm text-white font-semibold">{stage}</span><Badge tone="gray">{stuck[stage].length}</Badge></div>
            <div className="flex flex-wrap gap-1.5">
              {stuck[stage].map((a) => (
                <button key={a.id} type="button" onClick={() => openAccount(a.email)} className="rounded-full px-2.5 py-1 text-[11px] text-white/80 hover:text-white" style={{ background: "rgba(255,255,255,0.06)" }}>{a.email}</button>
              ))}
            </div>
          </div>
        ))}
        {!Object.keys(stuck).length && <Empty>Aucun compte créé sur la période.</Empty>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écran 3 : Comptes
// ---------------------------------------------------------------------------------------------------------------------------------------------
const FILTERS = [
  { key: "all", label: "Tous", test: (a) => !a.internal },
  { key: "trial", label: "En essai", test: (a) => a.status === "trial" },
  { key: "paying", label: "Abonnés", test: (a) => a.status === "subscribed" || a.status === "past_due" },
  { key: "todo", label: "À relancer", test: (a) => a.health === "a_relancer" || a.health === "risque" },
  { key: "lost", label: "Perdus", test: (a) => a.status === "canceled" || a.status === "expired" },
  { key: "internal", label: "Internes", test: (a) => a.internal },
];
const SORTS = {
  activity: { label: "Dernière activité", fn: (a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || "") },
  signup: { label: "Inscription (récente d'abord)", fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  sessions: { label: "Plus actifs d'abord", fn: (a, b) => b.sessions7d - a.sessions7d || b.eventsTotal - a.eventsTotal },
};
function AccountsTab({ d, openAccount }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("activity");
  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    return d.accounts.filter((a) => f.test(a) && (!q || a.email.toLowerCase().includes(q.toLowerCase()))).sort(SORTS[sort].fn);
  }, [d, q, filter, sort]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un email" className="w-full rounded-full pl-8 pr-3 py-2 text-sm text-white outline-none border" style={{ background: "#16130F", borderColor: "rgba(255,255,255,0.12)" }} />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full px-3 py-2 text-xs text-white border outline-none" style={{ background: "#16130F", borderColor: "rgba(255,255,255,0.12)" }}>
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = d.accounts.filter(f.test).length;
          return (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className="rounded-full px-3 py-1.5 text-xs font-semibold border" style={filter === f.key ? { background: BRAND_GRADIENT, color: "#fff", borderColor: "transparent" } : { background: "transparent", color: "rgba(255,255,255,0.65)", borderColor: "rgba(255,255,255,0.15)" }}>
              {f.label} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <Card className="!p-0 overflow-hidden">
        {!list.length && <div className="p-4"><Empty>Aucun compte ne correspond.</Empty></div>}
        <ul className="divide-y divide-white/5">
          {list.map((a) => {
            const h = HEALTH[a.health] || HEALTH.actif;
            return (
              <li key={a.id}>
                <button type="button" onClick={() => openAccount(a.email)} className="w-full text-left px-4 py-3 hover:bg-white/[0.03] flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-semibold break-all">{a.email}</span>
                      {a.internal && <Badge tone="gray">interne</Badge>}
                      {!a.emailConfirmed && !a.internal && <Badge tone="amber" title="Email jamais confirmé">email non confirmé</Badge>}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">{a.stage} · inscrit {relTime(a.createdAt)} · {a.source}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">Vu {relTime(a.lastActivityAt)} · {a.sessions7d} session{a.sessions7d > 1 ? "s" : ""} sur 7 j · {a.counts.recipes} recette{a.counts.recipes > 1 ? "s" : ""} · {a.counts.scansOk} scan{a.counts.scansOk > 1 ? "s" : ""} réussi{a.counts.scansOk > 1 ? "s" : ""}{a.counts.scansFailed ? ` · ${a.counts.scansFailed} échoué${a.counts.scansFailed > 1 ? "s" : ""}` : ""}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[a.status]}>{a.statusLabel}</Badge>
                    <Badge tone={h.tone}>{h.label}</Badge>
                    {a.device && <span className="text-white/35">{a.device.screen === "mobile" || a.device.os === "ios" || a.device.os === "android" ? <Smartphone size={13} /> : <Monitor size={13} />}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écran 4 : Fonctionnalités
// ---------------------------------------------------------------------------------------------------------------------------------------------
function FeaturesTab({ d }) {
  const active = d.activeAccountsInPeriod;
  const devices = useMemo(() => {
    const res = { ios: 0, android: 0, desktop: 0, installed: 0, known: 0 };
    for (const a of d.accounts) {
      if (a.internal || !a.device) continue;
      res.known++;
      if (a.device.os === "ios") res.ios++; else if (a.device.os === "android") res.android++; else res.desktop++;
      if (a.device.installed) res.installed++;
    }
    return res;
  }, [d]);
  const langs = useMemo(() => {
    const m = {};
    for (const a of d.accounts) if (!a.internal && a.language) m[a.language] = (m[a.language] || 0) + 1;
    return Object.entries(m).sort((x, y) => y[1] - x[1]);
  }, [d]);
  return (
    <div className="space-y-4">
      <Card title="Ce qui est utilisé, ce qui ne l'est pas" hint={`Parmi les ${active} compte${active > 1 ? "s" : ""} qui ont ouvert l'app sur ${d.periodDays} jours. Une barre courte = une fonctionnalité que presque personne n'utilise.`}>
        <ul className="space-y-3">
          {d.features.map((f) => {
            const noData = !f.dataSince;
            const tone = noData ? "gray" : f.pctOfActive >= 50 ? "green" : f.pctOfActive >= 20 ? "amber" : "red";
            return (
              <li key={f.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-white/85">{f.label}</span>
                  <span className="shrink-0 text-xs text-white/60">{noData ? "aucune donnée pour l'instant" : `${f.accounts} compte${f.accounts > 1 ? "s" : ""} · ${fmtPct(f.pctOfActive)} · ${f.events} fois`}</span>
                </div>
                <div className="h-2 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, f.pctOfActive || 0)}%`, background: TONES[tone].fg }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-white/40 mt-4 leading-snug">Les fonctionnalités marquées « aucune donnée » viennent d'être suivies : elles se remplissent au fil des prochains jours.</p>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Appareils" hint="Connus depuis la dernière ouverture de l'app.">
          {!devices.known ? <Empty>Pas encore d'appareil connu : ça se remplit à chaque ouverture de l'app.</Empty> : (
            <ul className="space-y-1.5 text-sm text-white/80">
              <li className="flex justify-between"><span>iPhone / iPad</span><b>{devices.ios}</b></li>
              <li className="flex justify-between"><span>Android</span><b>{devices.android}</b></li>
              <li className="flex justify-between"><span>Ordinateur</span><b>{devices.desktop}</b></li>
              <li className="flex justify-between border-t border-white/5 pt-1.5"><span>App installée sur l'écran d'accueil</span><b>{devices.installed} / {devices.known}</b></li>
            </ul>
          )}
        </Card>
        <Card title="Langues des comptes">
          {!langs.length ? <Empty>Aucune langue enregistrée.</Empty> : <ul className="space-y-1.5 text-sm text-white/80">{langs.map(([l, n]) => <li key={l} className="flex justify-between"><span>{l === "fr" ? "Français" : l === "es" ? "Espagnol" : l === "en" ? "Anglais" : l}</span><b>{n}</b></li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écran 5 : Acquisition
// ---------------------------------------------------------------------------------------------------------------------------------------------
function AcquisitionTab({ d, openAccount }) {
  return (
    <div className="space-y-4">
      <Card title="Visites, clics et inscriptions" hint="Page d'accueil : visiteurs, clics sur « Essayer 7 jours », comptes créés.">
        <SeriesChart series={d.series} height={140} lines={[{ key: "visits", label: "visites", color: "#38BDF8" }, { key: "startClicks", label: "clics « Essayer »", color: "#F59E0B" }, { key: "signups", label: "inscriptions", color: "#10B981" }]} />
      </Card>
      <DayByDay d={d} openAccount={openAccount} rows={30} />
      <Card title="D'où viennent les gens" hint="Chaque ligne : une provenance (le paramètre du lien, ex. tiktok). Les visites sans provenance comptent dans « direct », y compris les tiennes si tu n'as pas désactivé le suivi.">
        {!d.sources.length ? <Empty>Pas encore de visite.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-white/40 text-right">
                  <th className="text-left font-normal pb-2">Provenance</th><th className="font-normal pb-2">Visites</th><th className="font-normal pb-2">Clics</th><th className="font-normal pb-2">Inscrits</th><th className="font-normal pb-2">Ont scanné</th><th className="font-normal pb-2">Abonnés</th><th className="font-normal pb-2">Visite → inscrit</th>
                </tr>
              </thead>
              <tbody>
                {d.sources.map((s) => (
                  <tr key={s.source} className="border-t border-white/5 text-right text-white/80">
                    <td className="text-left py-2 font-semibold text-white">{s.source}</td>
                    <td>{fmtInt(s.views)}</td><td>{fmtInt(s.startClicks)}</td><td>{fmtInt(s.signups)}</td><td>{fmtInt(s.activated)}</td><td>{fmtInt(s.paid)}</td>
                    <td>{s.views ? fmtPct(Math.round((1000 * s.signups) / s.views) / 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écran 6 : Rétention
// ---------------------------------------------------------------------------------------------------------------------------------------------
function RetentionTab({ d }) {
  const cell = (c) => {
    if (!c || !c.of) return <td className="py-2 text-center text-white/25">—</td>;
    const a = Math.min(0.85, (c.pct || 0) / 100 * 0.85);
    return <td className="py-2 text-center" style={{ background: `rgba(16,185,129,${a})` }} title={`${c.n} sur ${c.of}`}><span className="text-white font-semibold">{fmtPct(c.pct)}</span><span className="block text-[10px] text-white/55">{c.n}/{c.of}</span></td>;
  };
  return (
    <div className="space-y-4">
      <Card title="Reviennent-ils ?" hint="Les comptes créés une même semaine : quelle part est revenue sur l'app au moins un jour différent, 1 jour, 3 jours ou 7 jours après l'inscription. Une case vide veut dire que la semaine est trop récente pour juger.">
        {!d.retention.length ? <Empty>Pas assez de comptes pour calculer la rétention.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-white/40"><th className="text-left font-normal pb-1">Semaine du</th><th className="font-normal pb-1">Inscrits</th><th className="font-normal pb-1">Jour +1</th><th className="font-normal pb-1">Jour +3</th><th className="font-normal pb-1">Jour +7</th></tr>
              </thead>
              <tbody>
                {d.retention.map((r) => (
                  <tr key={r.week} className="text-white/80">
                    <td className="py-2 text-left">{fmtDay(r.week)}</td>
                    <td className="py-2 text-center font-semibold text-white">{r.size}</td>
                    {cell(r.d1)}{cell(r.d3)}{cell(r.d7)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Comptes actifs chaque jour" hint="Combien de comptes différents ont ouvert l'app ce jour-là.">
        <SeriesChart series={d.series} lines={[{ key: "active", label: "comptes actifs", color: "#10B981" }]} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écran 7 : Santé
// ---------------------------------------------------------------------------------------------------------------------------------------------
function HealthTab({ d, openAccount, openCompose, viewImage }) {
  const sc = d.health.scans;
  const maxCode = Math.max(1, ...sc.failuresByCode.map((c) => c.count));
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Le scanner de factures" hint={`Sur ${d.periodDays} jours, hors comptes internes.`}>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl" style={{ color: sc.successPct == null ? "#fff" : sc.successPct >= 90 ? TIER_COLORS.high : sc.successPct >= 70 ? TIER_COLORS.mid : TIER_COLORS.low }}>{fmtPct(sc.successPct)}</span>
            <span className="text-sm text-white/60">{sc.ok} réussi{sc.ok > 1 ? "s" : ""} · {sc.failed} échoué{sc.failed > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-3 space-y-2">
            {!sc.failuresByCode.length && <Empty>Aucun échec de scan sur la période.</Empty>}
            {sc.failuresByCode.map((c) => (
              <div key={c.code}>
                <div className="flex justify-between text-xs text-white/75"><span>{SCAN_CODES_FR[c.code] || c.code}</span><b>{c.count}</b></div>
                <div className="h-1.5 rounded-full mt-1" style={{ background: "rgba(255,255,255,0.06)" }}><div className="h-full rounded-full" style={{ width: `${(c.count / maxCode) * 100}%`, background: TIER_COLORS.low }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Derniers scans échoués" hint="Avec la photo d'origine quand elle a été gardée (30 jours).">
          {!sc.recentFailures.length && <Empty>Aucun.</Empty>}
          <ul className="divide-y divide-white/5">
            {sc.recentFailures.map((f, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" onClick={() => openAccount(f.email)} className="text-xs text-white/80 hover:text-white break-all text-left">{f.email}</button>
                  <div className="text-[11px] text-white/45">{SCAN_CODES_FR[f.code] || f.code} · {relTime(f.at)}</div>
                </div>
                <div className="shrink-0 flex gap-1.5">
                  {f.imagePath && <button type="button" onClick={() => viewImage(f.imagePath)} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-white/75" style={{ borderColor: "rgba(255,255,255,0.15)" }}><ExternalLink size={11} /> Facture</button>}
                  <button type="button" onClick={() => openCompose(f.email, "scan")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: BRAND_GRADIENT }}><Mail size={11} /> Écrire</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Erreurs techniques" hint="Ce que l'app a signalé toute seule (erreur JavaScript, écran en panne). Une erreur qui se répète chez plusieurs comptes est la plus urgente.">
        {!d.health.errors.length && <Empty>{d.health.trackingSince ? "Aucune erreur enregistrée : tout va bien de ce côté." : "Aucune erreur enregistrée pour l'instant. Le suivi vient d'être mis en place : il se remplit avec l'usage."}</Empty>}
        <ul className="divide-y divide-white/5">
          {d.health.errors.map((e, i) => (
            <li key={i} className="py-2.5">
              <div className="flex items-center gap-2 flex-wrap"><Badge tone={e.kind === "plantage" ? "red" : "amber"}>{e.kind}</Badge><span className="text-xs text-white/60">{e.count} fois · {e.accounts} compte{e.accounts > 1 ? "s" : ""} · {relTime(e.lastAt)}</span></div>
              <div className="text-sm text-white/85 mt-1 break-words">{e.message}</div>
              <div className="text-[11px] text-white/40 mt-0.5">{[e.file, ...e.devices, ...e.versions].filter(Boolean).join(" · ")}</div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Emails jamais confirmés" hint="Ces adresses n'ont jamais cliqué le lien de confirmation : l'email est peut-être faux ou parti en spam.">
        {!d.health.unconfirmedEmails.length && <Empty>Tous les emails sont confirmés.</Empty>}
        <ul className="divide-y divide-white/5">
          {d.health.unconfirmedEmails.map((u) => (
            <li key={u.email} className="py-2 flex items-center justify-between gap-3 text-sm"><span className="text-white/80 break-all">{u.email}</span><span className="text-[11px] text-white/40 shrink-0">inscrit {relTime(u.createdAt)}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fiche d'un compte
// ---------------------------------------------------------------------------------------------------------------------------------------------
function AccountDrawer({ account, detail, onClose, onCompose, onGrant, onReset, onDelete, viewImage, busy }) {
  const [armed, setArmed] = useState(null);
  const arm = (what, fn) => {
    if (armed !== what) { setArmed(what); setTimeout(() => setArmed((c) => (c === what ? null : c)), 4000); return; }
    setArmed(null);
    fn();
  };
  const a = account;
  const h = HEALTH[a.health] || HEALTH.actif;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60" onClick={onClose}>
      <div className="w-full max-w-xl h-full overflow-y-auto border-l p-4 space-y-4" style={{ background: "#16130F", borderColor: "rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-white break-all leading-tight">{a.email}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge tone={STATUS_TONE[a.status]}>{a.statusLabel}</Badge><Badge tone={h.tone}>{h.label}</Badge>
              {a.internal && <Badge tone="gray">interne</Badge>}
              <Badge tone="gray">{a.source}</Badge>
              {a.provider === "google" && <Badge tone="gray">Google</Badge>}
              {!a.emailConfirmed && <Badge tone="amber">email non confirmé</Badge>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => onCompose(a.email, a.status === "canceled" || a.status === "expired" ? "annule" : a.milestones.scanOk.reached ? "fin_essai" : "relance")} className="inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white col-span-2" style={{ background: BRAND_GRADIENT }}><Mail size={15} /> Écrire un email</button>
          {!a.internal && (
            <>
              <button type="button" disabled={busy} onClick={() => arm("grant", () => onGrant(a.email, 30))} className="inline-flex items-center justify-center gap-1.5 rounded-full border py-2 text-xs font-semibold text-white/85" style={{ borderColor: armed === "grant" ? BRAND_SOLID : "rgba(255,255,255,0.18)" }}><Gift size={13} /> {armed === "grant" ? "Confirmer : offrir 30 jours" : "Offrir 30 jours"}</button>
              <button type="button" disabled={busy} onClick={() => arm("reset", () => onReset(a.email))} className="inline-flex items-center justify-center gap-1.5 rounded-full border py-2 text-xs font-semibold text-white/85" style={{ borderColor: armed === "reset" ? BRAND_SOLID : "rgba(255,255,255,0.18)" }}><RotateCcw size={13} /> {armed === "reset" ? "Confirmer : 7 jours depuis maintenant" : "Réinitialiser l'essai"}</button>
            </>
          )}
        </div>

        <Card title="Son parcours" hint={`Inscrit ${fmtDateTime(a.createdAt)} · étape actuelle : ${a.stage}`}>
          <ol className="grid grid-cols-2 gap-x-3 gap-y-2">
            {MILESTONES.map(([key, label]) => {
              const m = a.milestones[key];
              return (
                <li key={key} className="flex items-start gap-2 text-xs">
                  {m.reached ? <Check size={14} className="mt-0.5 shrink-0" style={{ color: TIER_COLORS.high }} /> : <CircleDot size={14} className="mt-0.5 shrink-0 text-white/20" />}
                  <span className={m.reached ? "text-white" : "text-white/35"}>{label}{m.at && <span className="block text-[10px] text-white/40">{fmtDateTime(m.at)}</span>}</span>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[["Scans réussis", a.counts.scansOk], ["Scans échoués", a.counts.scansFailed], ["Sessions (7 j)", a.sessions7d], ["Recettes à lui", a.counts.recipes], ["Ingrédients à lui", a.counts.ingredients], ["Jours actifs (7 j)", a.daysActive7d]].map(([l, v]) => (
            <div key={l} className="rounded-xl border p-2" style={CARD_STYLE}><div className="font-display text-xl text-white">{v}</div><div className="text-[10px] uppercase tracking-wide text-white/40">{l}</div></div>
          ))}
        </div>
        <div className="text-[11px] text-white/45 leading-relaxed">
          Vu {relTime(a.lastActivityAt)}{a.device ? ` · ${a.device.os || "appareil inconnu"}${a.device.installed ? " (app installée)" : ""}` : ""}{a.language ? ` · langue ${a.language}` : ""}{a.counts.menuPublished ? " · carte digitale publiée" : ""}{a.counts.errors7d ? ` · ${a.counts.errors7d} erreur(s) technique(s) cette semaine` : ""}
        </div>

        <Card title="Ce qu'il a fait" hint="Les ouvertures de l'app rapprochées sont regroupées en une session. La plus récente est en haut.">
          {detail.status === "loading" && <div className="flex items-center gap-2 text-xs text-white/50 py-3"><Loader2 size={14} className="animate-spin" /> Chargement…</div>}
          {detail.status === "error" && <Empty>Impossible de charger l'historique : {detail.error}</Empty>}
          {detail.status === "ready" && !detail.data.sessions.length && <Empty>Aucune activité enregistrée.</Empty>}
          {detail.status === "ready" && detail.data.sessions.map((s, i) => (
            <div key={i} className="py-3 border-t border-white/5 first:border-0 first:pt-0">
              <div className="flex items-center justify-between gap-2 text-xs"><b className="text-white">{fmtDateTime(s.start)}</b><span className="text-white/40">{s.durationMin} min · {s.events} action{s.events > 1 ? "s" : ""}{s.device ? ` · ${s.device}` : ""}</span></div>
              <ul className="mt-1.5 space-y-1">
                {s.lines.map((l, j) => (
                  <li key={j} className="text-xs flex items-start gap-2" style={{ color: l.type === "scan_failed" || l.type === "client_crash" || l.type === "client_error" ? "#F87171" : l.type === "admin_email_sent" || l.type === "admin_trial_granted" ? "#38BDF8" : "rgba(255,255,255,0.75)" }}>
                    <span className="w-1 h-1 rounded-full bg-current mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      {l.label}{l.count > 1 ? ` ×${l.count}` : ""}
                      {l.type === "tab_opened" && l.meta.tab ? ` (${l.meta.tab})` : ""}
                      {l.type === "recipe_created" && l.meta.name ? ` : ${l.meta.name}` : ""}
                      {l.type === "print_used" && l.meta.kind ? ` (${l.meta.kind})` : ""}
                      {(l.type === "scan_invoice" || l.type === "scan_recipe") && <span className="text-white/45"> · {l.meta.foodItems ?? l.meta.totalItems ?? 0} ligne(s){l.meta.lowConfidenceItems ? `, ${l.meta.lowConfidenceItems} à vérifier` : ""}{l.meta.zeroItems ? " · RIEN extrait" : ""}</span>}
                      {l.type === "scan_failed" && <span> : {SCAN_CODES_FR[l.meta.code] || l.meta.code || "cause inconnue"}</span>}
                      {(l.type === "client_error" || l.type === "client_crash") && <span className="block text-[11px] opacity-80 break-words">{l.meta.message}</span>}
                      {(l.type === "admin_email_sent") && <span> : « {l.meta.subject} »</span>}
                      {l.type === "admin_trial_granted" && <span> : {l.meta.days} jours</span>}
                      {l.meta.imagePath && <button type="button" onClick={() => viewImage(l.meta.imagePath)} className="ml-2 inline-flex items-center gap-1 text-[11px] underline text-white/70"><ExternalLink size={10} /> voir la facture</button>}
                      {Array.isArray(l.meta.items) && l.meta.items.length > 0 && (
                        <details className="mt-1"><summary className="cursor-pointer text-[11px] text-white/45">Voir les lignes lues ({l.meta.itemsTotal})</summary>
                          <ul className="mt-1 text-[11px] text-white/55">{l.meta.items.map((it, n) => <li key={n}>{it.name} · {it.price != null ? `${it.price} €/${it.unit || "?"}` : "prix ?"}</li>)}</ul>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>

        {!a.internal && (
          <div className="pt-2 border-t border-white/10">
            <button type="button" disabled={busy} onClick={() => arm("delete", () => onDelete(a.email))} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold" style={{ borderColor: armed === "delete" ? TIER_COLORS.low : "rgba(255,255,255,0.15)", color: armed === "delete" ? TIER_COLORS.low : "rgba(255,255,255,0.45)" }}><Trash2 size={12} /> {armed === "delete" ? "Confirmer : supprimer ce compte et ses données" : "Supprimer ce compte"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Rédaction d'un email
// ---------------------------------------------------------------------------------------------------------------------------------------------
function ComposeModal({ email, template, onClose, onSend }) {
  const [tpl, setTpl] = useState(template || "libre");
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[template || "libre"].subject);
  const [body, setBody] = useState(EMAIL_TEMPLATES[template || "libre"].body);
  const [armed, setArmed] = useState(false);
  const [state, setState] = useState({ status: "idle", error: null });
  const choose = (k) => { setTpl(k); setSubject(EMAIL_TEMPLATES[k].subject); setBody(EMAIL_TEMPLATES[k].body); setArmed(false); };
  const ok = subject.trim().length >= 3 && body.trim().length >= 10;
  const send = async () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 5000); return; }
    setState({ status: "sending", error: null });
    try { await onSend({ email, subject, body, template: tpl }); setState({ status: "sent", error: null }); }
    catch (e) { setState({ status: "idle", error: e.message || "Échec de l'envoi" }); setArmed(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border p-4 space-y-3 max-h-[90vh] overflow-y-auto" style={{ background: "#201B15", borderColor: "rgba(255,255,255,0.12)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-display uppercase tracking-wide text-sm text-white">Écrire un email</h3><p className="text-xs text-white/50 break-all">à {email}</p></div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white p-1"><X size={18} /></button>
        </div>
        {state.status === "sent" ? (
          <div className="py-8 text-center"><Check size={28} className="mx-auto mb-2" style={{ color: TIER_COLORS.high }} /><p className="text-sm text-white">Email envoyé.</p><p className="text-xs text-white/50 mt-1">Il peut te répondre directement. L'envoi est noté dans sa fiche.</p><button type="button" onClick={onClose} className="mt-4 rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ background: BRAND_GRADIENT }}>Fermer</button></div>
        ) : (
          <>
            <select value={tpl} onChange={(e) => choose(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none" style={{ background: "#16130F", borderColor: "rgba(255,255,255,0.12)" }}>
              {Object.entries(EMAIL_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
            <input value={subject} onChange={(e) => { setSubject(e.target.value); setArmed(false); }} placeholder="Objet" className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none" style={{ background: "#16130F", borderColor: "rgba(255,255,255,0.12)" }} />
            <textarea value={body} onChange={(e) => { setBody(e.target.value); setArmed(false); }} rows={11} placeholder="Ton message" className="w-full rounded-lg px-3 py-2 text-sm text-white border outline-none leading-relaxed" style={{ background: "#16130F", borderColor: "rgba(255,255,255,0.12)" }} />
            <p className="text-[11px] text-white/40 leading-snug">Texte simple, envoyé depuis hello@getchefup.com ; ses réponses arrivent sur ta boîte de contact. Relis-le : tu peux tout modifier.</p>
            {state.error && <p className="text-xs" style={{ color: TIER_COLORS.low }}>{state.error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-full border px-4 py-2 text-sm text-white/70" style={{ borderColor: "rgba(255,255,255,0.15)" }}>Annuler</button>
              <button type="button" disabled={!ok || state.status === "sending"} onClick={send} className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: armed ? "#B45309" : BRAND_GRADIENT }}>
                {state.status === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {armed ? "Confirmer l'envoi" : "Envoyer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le tableau de bord
// ---------------------------------------------------------------------------------------------------------------------------------------------
const TABS = [
  ["today", "Aujourd'hui"], ["journey", "Parcours"], ["accounts", "Comptes"], ["features", "Fonctionnalités"], ["acquisition", "Acquisition"], ["retention", "Rétention"], ["health", "Santé"],
];

export function AdminDashboard({ loader, poster } = {}) {
  const doLoad = loader || defaultLoader;
  const doPost = poster || defaultPoster;
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState("today");
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [openEmail, setOpenEmail] = useState(null);
  const [detail, setDetail] = useState({ status: "idle", data: null, error: null });
  const [compose, setCompose] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());

  const say = useCallback((text, bad) => { setToast({ text, bad }); setTimeout(() => setToast(null), 4000); }, []);

  const load = useCallback(async (background) => {
    if (!background) setState((s) => ({ status: "loading", data: s.data, error: null }));
    try {
      const data = await doLoad(days);
      setState({ status: "ready", data, error: null });
      setNow(Date.now());
    } catch (e) {
      if (!background) setState({ status: "error", data: null, error: e.message || "Erreur" });
    }
  }, [days, doLoad]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 60000); // rafraîchissement automatique pendant que le tableau de bord reste ouvert
    return () => clearInterval(id);
  }, [load]);

  const v2 = state.data && state.data.v2;
  const account = useMemo(() => (v2 && openEmail ? v2.accounts.find((a) => a.email === openEmail) : null), [v2, openEmail]);

  const loadDetail = useCallback(async (email) => {
    setDetail({ status: "loading", data: null, error: null });
    try { const r = await doPost({ action: "account_detail", email }); setDetail({ status: "ready", data: r.detail, error: null }); }
    catch (e) { setDetail({ status: "error", data: null, error: e.message || "Erreur" }); }
  }, [doPost]);
  const openAccount = useCallback((email) => { setOpenEmail(email); loadDetail(email); }, [loadDetail]);

  const run = async (fn, okText) => {
    setBusy(true);
    try { await fn(); say(okText); await load(true); if (openEmail) loadDetail(openEmail); }
    catch (e) { say(e.message || "Échec", true); }
    finally { setBusy(false); }
  };
  const viewImage = async (path) => {
    try { const r = await doPost({ action: "get_scan_image_url", path }); window.open(r.url, "_blank", "noopener"); }
    catch (e) { say(e.message || "Photo introuvable (gardée 30 jours)", true); }
  };
  const sendEmail = async (p) => { await doPost({ action: "send_email", ...p }); await load(true); if (openEmail) loadDetail(openEmail); };

  const tabBar = (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {TABS.map(([k, label]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border" style={tab === k ? { background: BRAND_GRADIENT, color: "#fff", borderColor: "transparent" } : { background: "transparent", color: "rgba(255,255,255,0.65)", borderColor: "rgba(255,255,255,0.15)" }}>{label}</button>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {[7, 30, 90].map((n) => (
            <button key={n} type="button" onClick={() => setDays(n)} className="rounded-full px-3 py-1.5 text-xs font-semibold border" style={days === n ? { background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.25)" } : { background: "transparent", color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.12)" }}>{n} jours</button>
          ))}
        </div>
        <button type="button" onClick={() => load(false)} className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white">
          <RefreshCw size={12} className={state.status === "loading" ? "animate-spin" : ""} /> {v2 ? `Mis à jour ${relTime(v2.generatedAt, now)}` : "Actualiser"}
        </button>
      </div>
      {tabBar}

      {state.status === "loading" && !v2 && <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50"><Loader2 size={16} className="animate-spin" /> Chargement des chiffres…</div>}
      {state.status === "error" && (
        <Card><div className="flex items-start gap-3"><AlertTriangle size={18} style={{ color: TIER_COLORS.low }} className="shrink-0 mt-0.5" /><div><p className="text-sm text-white">Impossible de charger le tableau de bord.</p><p className="text-xs text-white/50 mt-1 break-words">{state.error}</p><button type="button" onClick={() => load(false)} className="mt-3 rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ background: BRAND_GRADIENT }}>Réessayer</button></div></div></Card>
      )}
      {state.data && !v2 && (
        <Card><div className="flex items-start gap-3"><AlertTriangle size={18} style={{ color: TIER_COLORS.mid }} className="shrink-0 mt-0.5" /><div><p className="text-sm text-white">Le nouveau tableau de bord n'a pas pu calculer ses chiffres.</p><p className="text-xs text-white/50 mt-1 break-words">{state.data.v2Error || "Réponse incomplète du serveur."}</p></div></div></Card>
      )}

      {v2 && (
        <>
          {v2.eventsTruncated && <p className="text-[11px]" style={{ color: TIER_COLORS.mid }}>Beaucoup d'activité : seuls les 20 000 derniers événements sont pris en compte.</p>}
          {tab === "today" && <TodayTab d={v2} openAccount={openAccount} openCompose={(email, template) => setCompose({ email, template })} setTab={setTab} />}
          {tab === "journey" && <JourneyTab d={v2} openAccount={openAccount} />}
          {tab === "accounts" && <AccountsTab d={v2} openAccount={openAccount} />}
          {tab === "features" && <FeaturesTab d={v2} />}
          {tab === "acquisition" && <AcquisitionTab d={v2} openAccount={openAccount} />}
          {tab === "retention" && <RetentionTab d={v2} />}
          {tab === "health" && <HealthTab d={v2} openAccount={openAccount} openCompose={(email, template) => setCompose({ email, template })} viewImage={viewImage} />}
        </>
      )}

      {account && (
        <AccountDrawer
          account={account}
          detail={detail}
          busy={busy}
          onClose={() => setOpenEmail(null)}
          onCompose={(email, template) => setCompose({ email, template })}
          onGrant={(email, n) => run(() => doPost({ action: "grant_days", email, days: n }), `${n} jours offerts à ${email}.`)}
          onReset={(email) => run(() => doPost({ action: "reset_trial", email }), `Essai réinitialisé pour ${email}.`)}
          onDelete={(email) => run(async () => { await doPost({ action: "delete_account", email }); setOpenEmail(null); }, `Compte ${email} supprimé.`)}
          viewImage={viewImage}
        />
      )}
      {compose && <ComposeModal email={compose.email} template={compose.template} onClose={() => setCompose(null)} onSend={sendEmail} />}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] rounded-full px-4 py-2 text-sm text-white shadow-lg" style={{ background: toast.bad ? "#B91C1C" : "#065F46" }}>{toast.text}</div>}
    </div>
  );
}

export default AdminDashboard;
