// Tableau de bord admin + assistant "premier plat" + petits composants d'affichage (message
// de marge, schéma d'installation, graphique en barres) — extrait de App.jsx le 2026-08-28.
import React, { useState, useEffect } from "react";
import {
  ArrowRight, ChefHat, ChevronDown, ClipboardList, Loader2, LogIn, MailWarning, Receipt,
  Smartphone, AlertTriangle, Check, TrendingUp, TrendingDown, Printer, QrCode,
  Sparkles, LayoutGrid, CreditCard, Image as ImageIcon, X, Clock,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { TR } from "./translations.js";
import { TIER_COLORS, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW } from "./brand.js";
import { NumField } from "./formComponents.jsx";

export function marginMessage(roundedMargin, effectiveTarget, tier, lang, ownTarget) {
  if (roundedMargin === null) return null;
  const tr = (key) => (TR[lang] && TR[lang][key]) || TR.fr[key];
  const gapAbove = roundedMargin - effectiveTarget; // positif si au-dessus de l'objectif
  const gapBelow = effectiveTarget - roundedMargin; // positif si en dessous
  if (tier === "high") {
    return gapAbove >= 10 ? tr("marginExcellentMsg") : tr("marginGoodMsg");
  }
  if (tier === "mid") {
    return gapBelow <= 3 ? tr("marginCloseMsg") : tr("marginWatchMsg");
  }
  // tier "low" — le plancher de sécurité CRITICAL_MARGIN (70%) reste rouge même si la recette a
  // sa PROPRE cible réglée plus bas (ex: 69%) et l'a atteinte : distinction ajoutée le 2026-09-04
  // (signalé par l'utilisateur comme trompeur — "j'ai atteint ma cible, pourquoi c'est rouge ?")
  // pour ne plus dire juste "insuffisante" dans ce cas précis, sans changer le comportement
  // (le plancher reste actif, volontairement, seule la formulation change).
  if (typeof ownTarget === "number" && roundedMargin >= ownTarget) {
    return tr("marginBelowFloorMsg");
  }
  return roundedMargin < 50 ? tr("marginLowMsg") : tr("marginLowFixMsg");
}

// Petite barre journalière en SVG plutôt qu'une vraie librairie de graphiques (2026-08-19) —
// "sobre et fonctionnel" demandé explicitement par l'utilisateur, et évite une dépendance de plus
// pour un simple graphique à barres. `series` = [{date, value}], la barre la plus haute définit
// l'échelle ; une valeur à 0 reste visible (trait fin) pour ne jamais donner l'impression d'un jour
// manquant dans les données.
// Petit schéma "étape 1 → étape 2" pour la fenêtre d'instructions d'installation (2026-08-23) —
// demandé par l'utilisateur, du texte seul étant jugé pas assez clair. Une icône représentant le
// bouton réel du navigateur (partage iOS / menu ⋮ Android), un point qui pulse pour attirer l'œil
// dessus, une flèche, et l'icône d'arrivée (écran d'accueil). Volontairement schématique plutôt
// qu'une vraie capture d'écran (qui se périmerait au moindre changement d'interface du navigateur).
export function InstallDiagram({ sourceIcon: SourceIcon, sourceLabel, targetLabel }) {
  return (
    <div className="flex items-center justify-center gap-3 my-4 py-4 rounded-xl" style={{ background: "#16130F" }}>
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl border border-white/20 flex items-center justify-center">
            <SourceIcon size={18} className="text-white/70" />
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ background: BRAND_SOLID }} />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: BRAND_SOLID }} />
        </div>
        <span className="text-white/40 text-[10px]">{sourceLabel}</span>
      </div>
      <ArrowRight size={18} className="text-white/25 shrink-0" />
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: BRAND_GRADIENT }}>
          <Smartphone size={18} className="text-white" />
        </div>
        <span className="text-white/40 text-[10px]">{targetLabel}</span>
      </div>
    </div>
  );
}

export function DailyBarChart({ series, color, height = 90 }) {
  const max = Math.max(1, ...series.map((d) => d.value));
  const barWidth = 100 / series.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {series.map((d, i) => {
        const h = Math.max(1, (d.value / max) * (height - 4));
        return (
          <rect
            key={d.date}
            x={i * barWidth + barWidth * 0.15}
            y={height - h}
            width={barWidth * 0.7}
            height={h}
            fill={color}
            opacity={d.value === 0 ? 0.25 : 0.9}
          >
            <title>{`${d.date} : ${d.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// Tableau de bord admin (2026-08-19), demandé par l'utilisateur pour suivre visites/clics/essais/
// abonnements/emails sans passer par des requêtes manuelles à chaque fois. Ouvert en plein écran
// depuis un bouton "Admin" dans la fenêtre "Mon compte" (voir `accountMenuOpen`), visible
// UNIQUEMENT depuis son propre compte (`isAdmin`) — jamais pour un autre utilisateur Chefup,
// revérifié aussi côté serveur (`api/admin-dashboard.js`, l'email pourrait en théorie être
// falsifié côté client).
//
// Refonte (2026-08-23) : la toute première version (KPI + flux global + tableau "Comptes" à
// fusionner soi-même en cliquant) a été jugée "pas pratique du tout" par l'utilisateur après ses
// 2 premiers essais gratuits réels. Nouvelle logique : 2 onglets — "Comptes" (par défaut, l'usage
// principal : suivre CE que fait une personne précise) présente une liste de cartes-comptes triée
// par activité la plus récente, avec un point vert "en ligne" quand < 5 min, un badge de statut
// coloré, et un clic déplie directement la chronologie de CE compte (icônes + temps relatif type
// "il y a 3 min" plutôt que des dates absolues à décoder) — plus besoin de cliquer puis remonter
// chercher un tableau séparé. "Aperçu" garde les KPI marketing (visites/clics/graphique), moins
// urgents pour du suivi en direct, écartés du premier écran pour ne pas noyer l'essentiel.
// Étapes de parcours (2026-08-31), voir CLAUDE.md — étendent le flux d'activité existant plutôt
// que de tout tracker clic par clic (jugé trop lourd/bruyant) : tuto, onglets visités, carte
// digitale publiée, clic vers l'abonnement.
const TUTORIAL_STEP_LABELS_FR = {
  welcome: "Bienvenue", scan: "Scanner", recipe: "Recette", allergens: "Fiche allergènes",
  technicalSheet: "Fiche technique", digitalMenu: "Carte digitale", pantry: "Garde-manger",
};
const TAB_LABELS_FR = { scanner: "Scanner", pantry: "Garde-manger", menu: "Carte digitale" };
const ACTIVITY_LABELS = {
  login: "Connexion",
  recipe_created: "Recette créée",
  scan_invoice: "Scan facture",
  scan_recipe: "Scan fiche recette",
  scan_failed: "Scan ÉCHOUÉ",
  tutorial_closed: "Tuto",
  tab_opened: "Onglet ouvert",
  digital_menu_published: "Carte digitale publiée",
  subscribe_clicked: "Clic « S'abonner »",
};
const ACTIVITY_ICON = {
  login: { Icon: LogIn, color: "#9CA3AF" },
  recipe_created: { Icon: ChefHat, color: BRAND_SOLID },
  scan_invoice: { Icon: Receipt, color: "#38BDF8" },
  scan_recipe: { Icon: ClipboardList, color: "#F59E0B" },
  scan_failed: { Icon: AlertTriangle, color: TIER_COLORS.low },
  tutorial_closed: { Icon: Sparkles, color: BRAND_SOLID },
  tab_opened: { Icon: LayoutGrid, color: "#9CA3AF" },
  digital_menu_published: { Icon: QrCode, color: "#10B981" },
  subscribe_clicked: { Icon: CreditCard, color: BRAND_SOLID },
};
// Codes d'échec de scan connus. Toute valeur hors de cette liste retombe sur "unknown" côté
// affichage, pour ne jamais montrer une clé de traduction brute au restaurateur.
export const SCAN_ERR_CODES = ["offline", "ai_timeout", "ai_busy", "ai_unavailable", "ai_unreadable", "file_unreadable", "file_password_protected", "file_pdf_ios_issue", "file_too_big", "bad_request", "auth_expired", "auth_required"];
// Les mêmes codes traduits en clair pour le tableau de bord admin (usage interne, français).
const MODE_LABELS = { pdf: "PDF (natif)", pdf_text: "PDF texte", image: "photo" };
const SCAN_FAIL_REASONS = {
  offline: "connexion perdue côté client",
  ai_timeout: "délai dépassé (document trop long / réseau lent)",
  ai_busy: "service d'IA saturé",
  ai_unavailable: "service d'IA indisponible (à vérifier côté Vercel)",
  ai_unreadable: "réponse de l'IA illisible",
  file_unreadable: "fichier illisible par le navigateur",
  file_password_protected: "PDF protégé par un mot de passe",
  file_pdf_ios_issue: "bug connu iOS/WebKit avec les PDF (probable, pas certain)",
  file_too_big: "document trop volumineux",
  bad_request: "requête sans document",
  auth_expired: "session expirée (même après renouvellement automatique)",
  auth_required: "appel sans compte connecté",
  unknown: "cause inconnue",
};
function activityDetail(e) {
  const m = e.meta || {};
  if (e.type === "recipe_created") return m.name ? `« ${m.name} »` : "";
  if (e.type === "scan_failed") {
    const bits = [SCAN_FAIL_REASONS[m.code] || m.code || "cause inconnue"];
    if (m.httpStatus) bits.push(`HTTP ${m.httpStatus}`);
    // upstreamStatus (2026-08-25) : le vrai code renvoyé par Anthropic, distinct du code HTTP
    // normalisé ci-dessus — un 400 ici veut dire "notre requête est mal formée" (bug de code),
    // un 5xx veut dire "leur service est indisponible" (rien à faire de notre côté).
    if (m.upstreamStatus) bits.push(`Anthropic ${m.upstreamStatus}`);
    if (m.online === false) bits.push("appareil hors ligne");
    if (m.device) bits.push(m.device);
    // MODE_LABELS couvre "pdf" (nouveau, envoi natif) en plus des anciens "pdf_text"/"image" —
    // avant ce correctif, tout mode inconnu (dont "pdf") retombait à tort sur "photo" (bug trouvé
    // en test réel, 2026-08-25 : un échec PDF affichait "photo" dans le tableau de bord).
    if (m.mode) bits.push(MODE_LABELS[m.mode] || m.mode);
    if (m.fileType) bits.push(m.fileType);
    // Message technique brut (2026-08-25) : jusqu'ici perdu pour file_unreadable/unknown, laissant
    // "PDF illisible" sans aucun indice exploitable. Jamais du contenu de facture — juste le texte
    // d'une exception JS (ex: nom de la classe d'erreur pdfjs, message réseau...).
    if (m.errorMessage) bits.push(`"${m.errorMessage}"`);
    return bits.join(" · ");
  }
  if (e.type === "scan_invoice" || e.type === "scan_recipe") {
    if (m.zeroItems) return "Aucune ligne détectée";
    const bits = [`${m.foodItems ?? 0} ligne(s) alimentaire(s)`];
    if (m.excludedItems) bits.push(`${m.excludedItems} écartée(s)`);
    if (m.lowConfidenceItems) bits.push(`${m.lowConfidenceItems} confiance basse`);
    if (m.priceInconsistentItems) bits.push(`${m.priceInconsistentItems} prix incohérent`);
    if (m.pricingUnknownItems) bits.push(`${m.pricingUnknownItems} prix inconnu`);
    if (!m.supplierKnown) bits.push("fournisseur non lu");
    return bits.join(" · ");
  }
  if (e.type === "tutorial_closed") {
    const stepLabel = TUTORIAL_STEP_LABELS_FR[m.lastStep] || m.lastStep || "?";
    return m.finishedAll ? `Terminé (jusqu'à « ${stepLabel} »)` : `Passé à l'étape « ${stepLabel} »`;
  }
  if (e.type === "tab_opened") return TAB_LABELS_FR[m.tab] || m.tab || "";
  return "";
}

// Preuve du scan (2026-08-31), demandé par l'utilisateur : liste des lignes extraites + un bouton
// pour voir la photo/PDF d'origine, réservés au tableau de bord admin — pour vérifier qu'un scan a
// bien fonctionné sans redemander le document à son client. L'URL de la photo n'est jamais stockée
// en clair : récupérée à la demande, signée et valable 5 minutes seulement (voir
// api/admin-dashboard.js, action "get_scan_image_url"). Rendu pour tout événement qui porte
// `meta.items`/`meta.imagePath` (scan_invoice/scan_recipe/scan_failed) — s'efface tout seul sinon.
function ScanEvidence({ meta }) {
  const [imageState, setImageState] = useState("idle"); // idle | loading | error
  const [imageUrl, setImageUrl] = useState(null);
  const items = Array.isArray(meta?.items) ? meta.items.filter((it) => it && it.name) : [];

  const loadImage = async (ev) => {
    ev.stopPropagation();
    if (imageState === "loading") return;
    setImageState("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "get_scan_image_url", path: meta.imagePath }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "échec");
      setImageUrl(data.url);
      setImageState("idle");
    } catch (e) {
      setImageState("error");
    }
  };

  if (!items.length && !meta?.imagePath) return null;

  return (
    <div className="mt-1.5">
      {items.length > 0 && (
        <div className="rounded-lg px-2 py-1.5 mb-1.5 space-y-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          {items.slice(0, 12).map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-[10px] text-white/50">
              <span className="truncate">{it.name}</span>
              <span className="font-mono shrink-0">{typeof it.price === "number" ? `${it.price.toFixed(2)}€${it.unit ? `/${it.unit}` : ""}` : "?"}</span>
            </div>
          ))}
          {items.length > 12 && <div className="text-[10px] text-white/30">+ {items.length - 12} autre(s)</div>}
        </div>
      )}
      {meta?.imagePath && (
        <>
          <button
            type="button"
            onClick={loadImage}
            disabled={imageState === "loading"}
            className="text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
          >
            <ImageIcon size={10} /> {imageState === "loading" ? "Chargement…" : "Voir la facture"}
          </button>
          {imageState === "error" && (
            <span className="text-[10px] ml-2" style={{ color: TIER_COLORS.low }}>
              Introuvable (peut-être supprimée après 30 jours)
            </span>
          )}
          {imageUrl && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
              onClick={() => setImageUrl(null)}
            >
              <button
                type="button"
                onClick={(ev) => { ev.stopPropagation(); setImageUrl(null); }}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                <X size={22} />
              </button>
              {meta.imagePath.endsWith(".pdf") ? (
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white underline text-sm"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  Ouvrir le PDF dans un nouvel onglet
                </a>
              ) : (
                <img
                  src={imageUrl}
                  alt="Facture scannée"
                  className="max-w-full max-h-full rounded-lg"
                  onClick={(ev) => ev.stopPropagation()}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Temps relatif FR ("à l'instant", "il y a 3 min"...) — bien plus lisible d'un coup d'œil qu'une
// date absolue pour répondre à la vraie question de l'utilisateur : "est-il en train d'utiliser
// l'app là maintenant ?".
function relativeTimeFr(iso) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  if (diffD < 7) return `il y a ${diffD} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function accountStatusColor(status) {
  if (status === "Abonné actif") return TIER_COLORS.high;
  if (status === "Paiement en retard") return TIER_COLORS.mid;
  if (status.startsWith("Essai (")) return BRAND_SOLID;
  return TIER_COLORS.low; // Annulé / Essai expiré
}

export function AdminDashboard() {
  const [state, setState] = useState({ status: "loading", data: null });
  const [days, setDays] = useState(30);
  const [dashTab, setDashTab] = useState("comptes"); // "comptes" | "apercu"
  // Compte dont la chronologie est dépliée (2026-08-23) — un seul à la fois, comme un accordéon.
  const [expandedEmail, setExpandedEmail] = useState(null);
  // Réinitialisation d'essai (2026-08-25) : "armed" = premier clic (bouton passe en rouge pour
  // confirmer, se désarme tout seul après quelques secondes) plutôt qu'une vraie boîte de dialogue
  // — évite un clic accidentel sans construire un modal pour une action interne admin-only.
  const [resetTrialArmed, setResetTrialArmed] = useState(null); // email en attente de confirmation
  const [resetTrialBusy, setResetTrialBusy] = useState(null); // email en cours de traitement
  const [resetTrialDone, setResetTrialDone] = useState({}); // { email: true } une fois confirmé cette session
  // Suppression de compte (2026-08-29) : nettoyage des comptes de test (chefuptest01/02/03...,
  // comptes créés par Claude pour tester OTP/Google). Même pattern "armé puis confirmé" que
  // resetTrial, mais irréversible — le compte disparaît de la liste locale dès le succès plutôt
  // que d'attendre le prochain rafraîchissement auto (25s).
  const [deleteArmed, setDeleteArmed] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  // Mail de déblocage groupé (2026-08-25) : même pattern "armé puis confirmé" que resetTrial,
  // mais pour un seul envoi global (tous les comptes jamais confirmés d'un coup), pas par compte.
  const [unlockEmailArmed, setUnlockEmailArmed] = useState(false);
  const [unlockEmailBusy, setUnlockEmailBusy] = useState(false);
  const [unlockEmailResult, setUnlockEmailResult] = useState(null); // { sentCount, total }
  const sendUnlockEmails = async () => {
    if (!unlockEmailArmed) {
      setUnlockEmailArmed(true);
      setTimeout(() => setUnlockEmailArmed(false), 4000);
      return;
    }
    setUnlockEmailArmed(false);
    setUnlockEmailBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "send_unlock_emails" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "échec");
      setUnlockEmailResult({ sentCount: data.sentCount, total: data.total });
    } catch (e) {
      alert("Erreur : " + (e.message || "échec de l'envoi."));
    } finally {
      setUnlockEmailBusy(false);
    }
  };
  const resetTrial = async (email) => {
    if (resetTrialArmed !== email) {
      setResetTrialArmed(email);
      setTimeout(() => setResetTrialArmed((cur) => (cur === email ? null : cur)), 4000);
      return;
    }
    setResetTrialArmed(null);
    setResetTrialBusy(email);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "reset_trial", email }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "échec");
      setResetTrialDone((d) => ({ ...d, [email]: true }));
    } catch (e) {
      alert("Erreur : " + (e.message || "échec de la réinitialisation."));
    } finally {
      setResetTrialBusy(null);
    }
  };
  const deleteAccount = async (email) => {
    if (deleteArmed !== email) {
      setDeleteArmed(email);
      setDeleteError(null);
      setTimeout(() => setDeleteArmed((cur) => (cur === email ? null : cur)), 4000);
      return;
    }
    setDeleteArmed(null);
    setDeleteBusy(email);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "delete_account", email }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "échec");
      // Retrait immédiat de la liste locale plutôt que d'attendre le prochain rafraîchissement
      // auto (25s) — le compte n'existe plus, pas de raison de continuer à l'afficher.
      setState((s) => ({ ...s, data: { ...s.data, users: s.data.users.filter((u) => u.email !== email) } }));
      setExpandedEmail((cur) => (cur === email ? null : cur));
    } catch (e) {
      setDeleteError({ email, message: e.message || "échec de la suppression." });
    } finally {
      setDeleteBusy(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async (background) => {
      if (!background) setState((s) => ({ status: "loading", data: s.data }));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin-dashboard?days=${days}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "dashboard error");
        if (!cancelled) setState({ status: "ready", data });
      } catch (e) {
        // En arrière-plan (rafraîchissement auto), on garde l'affichage précédent plutôt que
        // de basculer sur un écran d'erreur pour un simple raté réseau ponctuel.
        if (!cancelled && !background) setState({ status: "error", data: null });
      }
    };
    load(false);
    // Rafraîchissement automatique pendant que le tableau de bord reste ouvert (2026-08-23) —
    // demandé pour pouvoir suivre en direct l'activité d'un compte (connexions, scans, recettes)
    // sans avoir à rouvrir la fenêtre. 25s : assez réactif pour "suivre en direct", assez espacé
    // pour ne pas spammer l'API.
    const interval = setInterval(() => load(true), 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [days]);

  if (state.status === "loading" && !state.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-white/40" size={24} />
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="text-white/50 text-sm text-center py-10">Impossible de charger le tableau de bord.</p>;
  }

  const { kpis, dailySeries, users, activityFeed = [], bySource = [] } = state.data;

  // Dernière activité connue par compte (pour trier + savoir qui est "en ligne" maintenant) —
  // repli sur la date d'inscription pour un compte sans aucun événement encore enregistré.
  const lastActivityByEmail = new Map();
  activityFeed.forEach((e) => {
    const prev = lastActivityByEmail.get(e.email);
    if (!prev || new Date(e.createdAt) > new Date(prev)) lastActivityByEmail.set(e.email, e.createdAt);
  });
  const accountsSorted = [...users].sort((a, b) => {
    const at = new Date(lastActivityByEmail.get(a.email) || a.createdAt).getTime();
    const bt = new Date(lastActivityByEmail.get(b.email) || b.createdAt).getTime();
    return bt - at;
  });

  const kpiCards = [
    { label: "Visites", value: kpis.views },
    { label: "Clics « essai »", value: kpis.startClicks },
    { label: "Scans", value: kpis.scans },
    { label: "Comptes total", value: kpis.totalUsers },
    { label: "Essais en cours", value: kpis.activeTrials },
    { label: "Abonnés actifs", value: kpis.activeSubs },
    { label: "Annulés", value: kpis.canceled },
    { label: "Essais expirés", value: kpis.expiredNoSub },
    { label: "Emails non confirmés", value: kpis.unconfirmedEmails },
  ];

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setDashTab(id)}
      className="px-4 py-2 rounded-full text-xs font-medium transition"
      style={
        dashTab === id
          ? { background: BRAND_SOLID, color: "white" }
          : { background: "transparent", color: "rgba(255,255,255,0.5)" }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-display text-white/90 uppercase text-sm tracking-widest">Tableau de bord</h2>
        <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "#16130F" }}>
          <TabButton id="comptes" label="Comptes" />
          <TabButton id="apercu" label="Aperçu" />
        </div>
      </div>

      {dashTab === "comptes" ? (
        <div>
          <div className="text-white/30 text-[11px] mb-3">Tape un compte pour voir tout ce qu'il fait, dans l'ordre.</div>
          <div className="space-y-2">
            {accountsSorted.map((u) => {
              const lastAt = lastActivityByEmail.get(u.email) || u.createdAt;
              const isLive = Date.now() - new Date(lastAt).getTime() < 5 * 60 * 1000;
              const isOpen = expandedEmail === u.email;
              const timeline = activityFeed.filter((e) => e.email === u.email);
              const stats = {
                recipes: timeline.filter((e) => e.type === "recipe_created").length,
                scans: timeline.filter((e) => e.type === "scan_invoice" || e.type === "scan_recipe").length,
              };
              const initial = (u.email[0] || "?").toUpperCase();
              return (
                <div key={u.email} className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "#201B15" }}>
                  <button
                    onClick={() => setExpandedEmail(isOpen ? null : u.email)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-display text-sm"
                        style={{ background: accountStatusColor(u.status) }}
                      >
                        {initial}
                      </div>
                      {isLive && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                          style={{ background: "#10B981", borderColor: "#201B15" }}
                          title="En ligne (actif il y a moins de 5 min)"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-white/90 text-sm truncate">{u.email}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${accountStatusColor(u.status)}25`, color: accountStatusColor(u.status) }}
                        >
                          {u.status}
                        </span>
                        {/* Compte interne (2026-08-26) : nos propres comptes restent listés ici
                            (utile pour vérifier qu'un correctif marche), mais ne comptent plus dans
                            aucun chiffre de l'onglet Aperçu — voir INTERNAL_EMAILS côté serveur. */}
                        {u.internal && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white/50"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                            title="Compte interne : exclu des chiffres de l'onglet Aperçu"
                          >
                            interne
                          </span>
                        )}
                        {/* Email jamais confirmé (2026-08-25) : signal le plus important après un
                            incident de mails partis en spam — ce compte est peut-être bloqué à la
                            porte d'entrée sans jamais avoir pu utiliser l'app une seule fois. */}
                        {!u.emailConfirmed && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                            style={{ background: `${TIER_COLORS.low}25`, color: TIER_COLORS.low }}
                            title="N'a jamais cliqué le lien de confirmation reçu par email — vérifie qu'il n'est pas resté bloqué dans ses spams"
                          >
                            <MailWarning size={10} /> Email non confirmé
                          </span>
                        )}
                        <span className="text-white/40 text-[11px]">
                          {isLive ? "en ligne" : `vu ${relativeTimeFr(lastAt)}`}
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-white/40 text-[11px] shrink-0">
                      <span className="flex items-center gap-1"><ChefHat size={12} /> {stats.recipes}</span>
                      <span className="flex items-center gap-1"><Receipt size={12} /> {stats.scans}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className="text-white/30 shrink-0 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/10 px-3 pb-3 pt-2">
                      {/* Réinitialisation d'essai (2026-08-25) : pour un compte dont l'essai a été
                          gâché par un vrai bug de l'app (ex: casavostra.ajaccio@gmail.com, cas réel
                          qui a motivé ce bouton) — remet le compteur à 7 jours pleins à partir de
                          maintenant, sans jamais toucher created_at (non modifiable via l'API
                          Supabase). Premier clic = armé (rouge, "Confirmer ?"), deuxième clic dans
                          les 4s = exécute réellement. */}
                      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
                        <span className="text-white/40 text-[11px]">Essai gâché par un bug de l'app ?</span>
                        {resetTrialDone[u.email] ? (
                          <span className="text-[11px] font-medium" style={{ color: TIER_COLORS.high }}>✓ Essai réinitialisé (7 jours)</span>
                        ) : (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); resetTrial(u.email); }}
                            disabled={resetTrialBusy === u.email}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full disabled:opacity-50"
                            style={
                              resetTrialArmed === u.email
                                ? { background: `${TIER_COLORS.low}25`, color: TIER_COLORS.low }
                                : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                            }
                          >
                            {resetTrialBusy === u.email
                              ? "…"
                              : resetTrialArmed === u.email
                              ? "Confirmer ? (remet à J-7)"
                              : "Réinitialiser l'essai"}
                          </button>
                        )}
                      </div>
                      {/* Suppression de compte (2026-08-29) : jamais affiché pour un compte interne
                          (garde-fou double, ici ET côté serveur) — pour nettoyer les comptes de
                          test sans risque de toucher un vrai compte par erreur. Irréversible :
                          armé au premier clic (4s pour changer d'avis), exécuté au second. */}
                      {!u.internal && (
                        <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
                          <span className="text-white/40 text-[11px]">Compte de test à nettoyer ?</span>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); deleteAccount(u.email); }}
                            disabled={deleteBusy === u.email}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-full disabled:opacity-50"
                            style={
                              deleteArmed === u.email
                                ? { background: `${TIER_COLORS.low}45`, color: TIER_COLORS.low }
                                : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                            }
                          >
                            {deleteBusy === u.email
                              ? "…"
                              : deleteArmed === u.email
                              ? "Confirmer ? (supprime tout)"
                              : "Supprimer ce compte"}
                          </button>
                        </div>
                      )}
                      {deleteError && deleteError.email === u.email && (
                        <div className="text-[11px] mb-3 -mt-2" style={{ color: TIER_COLORS.low }}>
                          Erreur : {deleteError.message}
                        </div>
                      )}
                      {timeline.length === 0 ? (
                        <div className="text-white/30 text-xs py-3 text-center">
                          Aucune action enregistrée pour ce compte pour l'instant.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {timeline.map((e) => {
                            const cfg = ACTIVITY_ICON[e.type] || { Icon: Clock, color: "#9CA3AF" };
                            const Icon = cfg.Icon;
                            return (
                              <div key={e.id} className="flex items-start gap-2.5">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                  style={{ background: `${cfg.color}25` }}
                                >
                                  <Icon size={13} style={{ color: cfg.color }} />
                                </div>
                                <div className="min-w-0 flex-1 pb-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white/80 text-xs font-medium">{ACTIVITY_LABELS[e.type] || e.type}</span>
                                    <span className="text-white/30 text-[10px]">{relativeTimeFr(e.createdAt)}</span>
                                  </div>
                                  {activityDetail(e) && <div className="text-white/40 text-[11px] mt-0.5">{activityDetail(e)}</div>}
                                  <ScanEvidence meta={e.meta} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-black/20 text-white/70 text-xs rounded px-2 py-1.5 outline-none"
              style={{ colorScheme: "dark" }}
            >
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
            </select>
          </div>

          {/* Rappel honnête sur ce que ces chiffres excluent réellement (2026-08-26). Les scans,
              comptes, essais et abonnés sont rattachés à un compte : nos comptes internes en sont
              donc retirés proprement. Les visites et clics de la page d'accueil, eux, sont
              anonymes par conception (aucune donnée personnelle enregistrée) — impossible de savoir
              après coup qu'une visite venait de nous. Le seul moyen reste `?notrack=1`, désormais
              mémorisé durablement sur l'appareil dès la première utilisation (voir Landing.jsx). */}
          <div className="text-white/35 text-[11px] mb-3 leading-relaxed">
            Scans, comptes, essais et abonnés : nos comptes internes sont exclus.
            <br />
            Visites et clics : anonymes, donc non rattachables — ouvre le site avec{" "}
            <span className="text-white/55">?notrack=1</span> une fois par appareil pour ne plus jamais y figurer.
          </div>

          {/* Mail de déblocage groupé (2026-08-25) : pour les comptes déjà inscrits mais jamais
              confirmés, qui ne savent probablement pas qu'ils peuvent maintenant se connecter sans
              confirmer leur email — voir CLAUDE.md, "Visibilité de la confirmation d'email". Envoi
              volontairement manuel/ponctuel (pas automatique), à la demande de l'utilisateur. */}
          {(kpis.unconfirmedEmails > 0 || unlockEmailResult) && (
            <div
              className="rounded-xl p-3 mb-4 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: "#201B15", border: `1px solid ${TIER_COLORS.low}40` }}
            >
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <MailWarning size={14} style={{ color: TIER_COLORS.low }} />
                {unlockEmailResult
                  ? `Mail envoyé à ${unlockEmailResult.sentCount} compte${unlockEmailResult.sentCount > 1 ? "s" : ""} (sur ${unlockEmailResult.total} non confirmés — les autres l'avaient déjà reçu).`
                  : `${kpis.unconfirmedEmails} compte${kpis.unconfirmedEmails > 1 ? "s" : ""} n'ont jamais confirmé leur email — ils ne savent probablement pas qu'ils peuvent se connecter sans confirmer.`}
              </div>
              {!unlockEmailResult && (
                <button
                  onClick={sendUnlockEmails}
                  disabled={unlockEmailBusy}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-full disabled:opacity-50 shrink-0"
                  style={
                    unlockEmailArmed
                      ? { background: `${TIER_COLORS.low}25`, color: TIER_COLORS.low }
                      : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {unlockEmailBusy ? "Envoi en cours…" : unlockEmailArmed ? "Confirmer l'envoi ?" : "Envoyer le mail de déblocage"}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            {kpiCards.map((c) => (
              <div key={c.label} className="rounded-xl p-3 border border-white/10" style={{ background: "#201B15" }}>
                <div className="text-white text-xl font-display">{c.value}</div>
                <div className="text-white/40 text-[10px] uppercase tracking-wide mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Provenance des visites (2026-08-26) : LA vue à regarder dès qu'on paie de la publicité.
              Sans elle, impossible de distinguer les visiteurs venus d'une campagne du trafic
              naturel — donc impossible de savoir si l'argent dépensé rapporte quoi que ce soit.
              "direct" regroupe tout ce qui arrive sans `?src=` : trafic naturel, liens partagés,
              MAIS AUSSI ses propres visites s'il n'a pas ouvert le site avec `?notrack=1` au moins
              une fois sur cet appareil — d'où le rappel affiché juste en dessous. */}
          {bySource.length > 0 && (
            <div className="rounded-xl p-4 border border-white/10 mb-5" style={{ background: "#201B15" }}>
              <div className="text-white/50 text-[10px] uppercase tracking-wide mb-3">Provenance — bilan complet</div>
              {/* Tableau plutôt qu'une liste : avec 5 chiffres par ligne, l'alignement en colonnes
                  est le seul moyen de comparer deux sources d'un coup d'œil. `overflow-x-auto` pour
                  que ça reste lisible sur un téléphone sans jamais faire déborder la page. */}
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead>
                    <tr className="text-white/35 text-[10px] uppercase tracking-wide">
                      <th className="text-left font-normal pb-2">Source</th>
                      <th className="text-right font-normal pb-2 pl-3">Visites</th>
                      <th className="text-right font-normal pb-2 pl-3">3s+</th>
                      <th className="text-right font-normal pb-2 pl-3">Calcul</th>
                      <th className="text-right font-normal pb-2 pl-3">Clics</th>
                      <th className="text-right font-normal pb-2 pl-3">Comptes</th>
                      <th className="text-right font-normal pb-2 pl-3">→ Compte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySource.map((s) => {
                      // Le taux qui compte vraiment : sur 100 visiteurs amenés par cette source,
                      // combien sont allés jusqu'à créer un compte. C'est lui qui dit si une
                      // campagne payante est rentable, pas le nombre de visites brut.
                      const tauxCompte = s.views > 0 ? Math.round((s.accounts / s.views) * 100) : 0;
                      const estCampagne = s.source !== "direct";
                      return (
                        <tr key={s.source} className="border-t border-white/5">
                          <td className="py-2">
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={
                                estCampagne
                                  ? { background: `${BRAND_SOLID}25`, color: BRAND_SOLID }
                                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }
                              }
                            >
                              {s.source}
                            </span>
                          </td>
                          <td className="text-right text-white pl-3">{s.views}</td>
                          {/* Un écart énorme entre "Visites" et "3s+" signifie que la page a été
                              chargée sans être regardée — trafic sans valeur, quelle que soit la
                              qualité de la page. */}
                          <td className="text-right text-white/70 pl-3">{s.engaged ?? 0}</td>
                          {/* Visiteurs ayant manipulé le calculateur : le vrai signal d'intérêt,
                              il précède le clic d'inscription dans le parcours. */}
                          <td className="text-right pl-3 font-semibold" style={{ color: (s.calcUsed ?? 0) > 0 ? BRAND_SOLID : "rgba(255,255,255,0.3)" }}>{s.calcUsed ?? 0}</td>
                          <td className="text-right text-white/70 pl-3">{s.startClicks}</td>
                          <td className="text-right text-white pl-3 font-semibold">{s.accounts}</td>
                          <td
                            className="text-right pl-3 font-bold"
                            style={{ color: tauxCompte > 0 ? TIER_COLORS.high : "rgba(255,255,255,0.3)" }}
                          >
                            {tauxCompte}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-white/30 text-[10px] mt-3 leading-relaxed">
                « 3s+ » = visiteurs restés au moins 3 secondes sur la page. Un écart énorme avec « Visites » signifie que la
                page a été chargée sans être regardée : trafic sans valeur, quelle que soit la qualité de la page.
                « Clics » = clics sur « Commencer ». « → Compte » = part des visiteurs de cette source qui sont allés
                jusqu'à créer un compte : c'est le chiffre qui dit si une campagne rapporte.
                <br />
                « direct » = sans paramètre de campagne : trafic naturel, liens partagés, et tes propres visites tant
                que tu n'as pas ouvert le site une fois avec <span className="text-white/50">?notrack=1</span> sur cet
                appareil. Les comptes créés avant la mise en place du suivi y sont aussi rattachés.
              </p>
            </div>
          )}

          <div className="rounded-xl p-4 border border-white/10 mb-5" style={{ background: "#201B15" }}>
            <div className="text-white/50 text-[10px] uppercase tracking-wide mb-2">Visites par jour</div>
            <DailyBarChart series={dailySeries.map((d) => ({ date: d.date, value: d.views }))} color={BRAND_SOLID} />
          </div>

          {/* Détail jour par jour (2026-08-19) — le graphique seul ne suffisait pas pour savoir
              précisément "ma vidéo TikTok du 19 août m'a rapporté combien de visites", demandé
              explicitement par l'utilisateur. Un chiffre exact par ligne, pas une barre à interpréter. */}
          <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "#201B15" }}>
            <div className="text-white/50 text-[10px] uppercase tracking-wide p-4 pb-2">Détail par jour</div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-left border-b border-white/10">
                    <th className="px-4 py-2 font-normal">Date</th>
                    <th className="px-4 py-2 font-normal">Visites</th>
                    <th className="px-4 py-2 font-normal">Clics "essai"</th>
                    <th className="px-4 py-2 font-normal">Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dailySeries].reverse().map((d) => (
                    <tr key={d.date} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2 text-white/80 whitespace-nowrap">
                        {new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-2 text-white/70 whitespace-nowrap">{d.views}</td>
                      <td className="px-4 py-2 text-white/70 whitespace-nowrap">{d.startClicks}</td>
                      <td className="px-4 py-2 text-white/70 whitespace-nowrap">{d.scans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// [PLUS UTILISÉ depuis le 2026-08-31, voir AppTutorial plus bas] Gardé (non branché, hide-don't-
// delete) : l'ancien premier lancement forçait la création d'une recette avant toute chose, jugé
// "chiant" après un nouveau test réel — le tuto qui l'a remplacé n'impose plus rien.
//
// [REFONTE 2026-08-27, après le premier test réel de l'utilisateur] Premier lancement guidé,
// version à UN SEUL écran : on demande le plat et son prix de vente, on crée la recette, et on
// dépose le chef directement dans sa VRAIE fiche recette pour qu'il y ajoute ses ingrédients.
//
// La version précédente proposait un mini-éditeur d'ingrédients maison en 3 étapes. Elle a été
// jugée inutilisable au premier test, pour trois raisons qui tenaient toutes à la même erreur —
// avoir redéveloppé en petit ce que la fiche recette fait déjà en grand :
//   1. la recherche était limitée au CATALOG (195 entrées) : l'ingrédient du chef n'y était pas,
//      et rien ne permettait d'en créer un ;
//   2. rien n'indiquait qu'on pouvait en ajouter plusieurs (le champ de recherche se vidait après
//      chaque ajout, ce qui donnait l'impression d'être limité à un seul) ;
//   3. les prix venaient d'estimations par catégorie, non modifiables : avec un seul ingrédient
//      bon marché, la marge affichée frôlait les 100% et ne voulait plus rien dire.
//
// La fiche recette, elle, sait déjà tout faire : chercher un ingrédient, en CRÉER un qui n'existe
// nulle part (avec catégorie et prix, estimé ou saisi), en ajouter autant qu'on veut, et corriger
// un prix en place. Dupliquer ça en moins bien était une faute — on y renvoie donc directement.
// Bonus : le chef apprend la vraie interface tout de suite au lieu d'un formulaire jetable.
export function FirstRunWizard({ t, onFinish, onSkip }) {
  const [dishName, setDishName] = useState("");
  const [sellPrice, setSellPrice] = useState(0);
  const canCreate = dishName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 py-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 max-h-full overflow-y-auto" style={{ background: "#201B15" }}>
        <div className="p-5">
          <h2 className="font-display uppercase text-white text-sm tracking-wide mb-1">{t("firstRunTitle")}</h2>
          <p className="text-white/50 text-xs mb-4">{t("firstRunHint")}</p>

          <label className="block text-white/50 text-[11px] mb-1">{t("firstRunDishLabel")}</label>
          <input
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            placeholder={t("firstRunDishPlaceholder")}
            className="w-full rounded-lg px-3 py-2.5 text-base text-white outline-none mb-3"
            style={{ background: "rgba(0,0,0,0.25)" }}
          />

          <label className="block text-white/50 text-[11px] mb-1">{t("firstRunPriceLabel")}</label>
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(0,0,0,0.25)" }}>
            <NumField
              value={sellPrice}
              onChange={setSellPrice}
              className="w-full min-w-0 bg-transparent text-white text-base font-semibold outline-none text-right"
            />
            <span className="text-white/40 text-sm shrink-0">€</span>
          </div>
          <p className="text-white/30 text-[10px] mt-1.5">{t("firstRunPriceHint")}</p>

          <button
            type="button"
            disabled={!canCreate}
            onClick={() => onFinish({ dishName: dishName.trim(), sellPrice })}
            className="w-full mt-5 py-3 rounded-full font-display uppercase text-[11px] tracking-wide font-semibold disabled:opacity-40"
            style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
          >
            {t("firstRunCreate")}
          </button>

          <button type="button" onClick={onSkip} className="w-full mt-3 text-[11px] text-white/35 hover:text-white/70">
            {t("firstRunSkip")}
          </button>
        </div>
      </div>
    </div>
  );
}

// [TUTO, 2026-08-31] Tutoriel informatif à 7 pages (Bienvenue / Scanner / Recettes / Fiche
// allergènes / Fiche technique / Carte digitale / Garde-manger — étendu le même jour de 4 à 7,
// l'utilisateur ayant jugé les fiches auto-générées et la carte digitale "un vrai wahou" à montrer),
// affiché automatiquement au premier lancement (voir showTutorial dans App.jsx) et rouvrable à tout
// moment depuis "Mon compte". Remplace l'ancien enchaînement FirstRunWizard → FirstRunScanDemo
// (2026-08-27/31) : jugé après test réel "chiant" — imposer la création d'une recette (même
// minimale) dès l'arrivée n'était pas ce que l'utilisateur voulait. Ce tuto ne crée ni ne modifie
// AUCUNE donnée : purement informatif, illustrations animées auto-jouées (aucune vraie vidéo — pas
// d'asset à héberger, rien à fournir), skippable à tout moment.
const TUTORIAL_PAGES = ["welcome", "scan", "recipe", "allergens", "technicalSheet", "digitalMenu", "pantry"];

// Petite ligne de "scan" qui balaie une fausse facture en boucle — utilisée uniquement par
// TutorialScanArt, gardée en dehors pour ne définir les keyframes qu'une fois.
function TutorialStyles() {
  return (
    <style>{`
      @keyframes chefupTutScan { 0% { top: 10%; opacity: .95; } 90% { top: 85%; opacity: .95; } 100% { top: 85%; opacity: 0; } }
    `}</style>
  );
}

function TutorialWelcomeArt() {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: `${BRAND_SOLID}25` }} />
      <ChefHat size={34} style={{ color: BRAND_SOLID }} className="relative" />
    </div>
  );
}

// Fausse facture avec une ligne de scan en boucle + 5 ingrédients qui apparaissent l'un après
// l'autre — illustre le scan sans jamais appeler le vrai pipeline (api/scan-invoice.js). 5 lignes
// (remonté de 2 le 2026-08-31, demandé pour que la facture ait l'air plus réelle/dense) — interval
// resserré (750ms) pour garder un cycle total raisonnable malgré le nombre de lignes en plus.
function TutorialScanArt() {
  const [reveal, setReveal] = useState(0);
  const items = [
    { name: "Bœuf haché", price: "11,90€/kg" },
    { name: "Oignons", price: "1,80€/kg" },
    { name: "Crème fraîche", price: "3,20€/L" },
    { name: "Carottes", price: "1,50€/kg" },
    { name: "Tomates", price: "2,40€/kg" },
  ];
  useEffect(() => {
    const id = setInterval(() => setReveal((r) => (r + 1) % (items.length + 1)), 750);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="w-full flex items-center justify-center gap-4 py-1">
      <div className="relative w-16 h-24 rounded-lg overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.92)" }}>
        <div className="absolute inset-x-2 top-2 h-1 rounded-full bg-black/15" />
        <div className="absolute inset-x-2 top-4 h-1 rounded-full bg-black/10 w-2/3" />
        <div className="absolute inset-x-2 top-6 h-1 rounded-full bg-black/10 w-1/2" />
        <div className="absolute inset-x-2 top-8 h-1 rounded-full bg-black/10 w-3/5" />
        <div
          className="absolute inset-x-0 h-0.5"
          style={{ background: BRAND_SOLID, boxShadow: `0 0 6px ${BRAND_SOLID}`, animation: "chefupTutScan 1.8s ease-in-out infinite" }}
        />
      </div>
      <ArrowRight size={16} className="text-white/25 shrink-0" />
      <div className="flex flex-col gap-1 min-w-0">
        {items.map((it, i) => (
          <div
            key={it.name}
            className="flex items-center gap-1.5 text-[10px] transition-all duration-500"
            style={{ opacity: reveal > i ? 1 : 0, transform: reveal > i ? "translateX(0)" : "translateX(-6px)" }}
          >
            <Check size={10} style={{ color: "#10B981" }} className="shrink-0" />
            <span className="text-white/80">{it.name}</span>
            <span className="text-white/40 font-mono">{it.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Lignes d'ingrédients qui se remplissent une à une puis anneau de marge qui se dessine — même
// grammaire visuelle que le vrai panneau "en un coup d'œil" de la fiche recette, pour que l'écran
// réel soit immédiatement reconnaissable une fois le tuto terminé.
function TutorialRecipeArt() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 900);
    return () => clearInterval(id);
  }, []);
  const rows = ["Bœuf", "Oignons", "Crème"];
  const margin = step >= 3 ? 73 : 0;
  return (
    <div className="w-full flex items-center justify-center gap-4 py-1">
      <div className="flex flex-col gap-1.5 w-24">
        {rows.map((r, i) => (
          <div
            key={r}
            className="h-4 rounded transition-all duration-500 flex items-center px-1.5 text-[9px] text-white/70"
            style={{ background: "rgba(255,255,255,0.06)", opacity: step > i ? 1 : 0.15 }}
          >
            {step > i ? r : ""}
          </div>
        ))}
      </div>
      <div className="relative w-14 h-14 shrink-0">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
          <circle
            cx="28" cy="28" r="23" fill="none" stroke={BRAND_SOLID} strokeWidth="5" strokeLinecap="round"
            strokeDasharray="144.5"
            strokeDashoffset={144.5 * (1 - margin / 100)}
            transform="rotate(-90 28 28)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-[11px] font-display font-black">{margin}%</span>
        </div>
      </div>
    </div>
  );
}

// Petite fiche avec des étiquettes d'allergène qui apparaissent une à une — illustre la détection
// automatique (détail réel : detectAllergens dans src/catalog.js) plutôt qu'une saisie manuelle.
function TutorialAllergensArt() {
  const [reveal, setReveal] = useState(0);
  const tags = ["Gluten", "Lait", "Œufs"];
  useEffect(() => {
    const id = setInterval(() => setReveal((r) => (r + 1) % (tags.length + 1)), 800);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="w-full flex items-center justify-center gap-4 py-1">
      <div className="relative w-14 h-18 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.92)", height: 72 }}>
        <ClipboardList size={20} style={{ color: BRAND_SOLID }} />
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        {tags.map((tag, i) => (
          <span
            key={tag}
            className="text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all duration-500 text-center"
            style={{
              background: reveal > i ? `${BRAND_SOLID}25` : "rgba(255,255,255,0.05)",
              color: reveal > i ? BRAND_SOLID : "rgba(255,255,255,0.2)",
              transform: reveal > i ? "scale(1)" : "scale(0.9)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// Feuille qui "sort" d'une imprimante en boucle — illustre la fiche technique imprimable d'une
// recette (menu Imprimer → "Imprimer la fiche recette" sur la vraie fiche).
function TutorialTechnicalSheetArt() {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOut((o) => !o), 1300);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full flex flex-col items-center justify-center py-1 gap-0.5">
      <div className="w-16 h-8 rounded-t-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
        <Printer size={16} className="text-white/50" />
      </div>
      <div
        className="w-12 rounded-sm transition-all duration-700 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.92)", height: 30, transform: out ? "translateY(2px)" : "translateY(-16px)", opacity: out ? 1 : 0 }}
      >
        <div className="mx-1.5 mt-1.5 h-0.5 rounded-full bg-black/15" />
        <div className="mx-1.5 mt-1 h-0.5 rounded-full bg-black/10 w-2/3" />
        <div className="mx-1.5 mt-1 h-0.5 rounded-full bg-black/10 w-1/2" />
      </div>
    </div>
  );
}

// QR code + silhouette de téléphone — illustre la carte digitale publique générée à partir des
// recettes (voir DigitalMenuModal).
function TutorialDigitalMenuArt() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full flex items-center justify-center gap-4 py-1">
      <div
        className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-500"
        style={{ background: "rgba(255,255,255,0.92)", transform: pulse ? "scale(1.05)" : "scale(1)" }}
      >
        <QrCode size={30} style={{ color: "#16130F" }} />
      </div>
      <ArrowRight size={16} className="text-white/25 shrink-0" />
      <div className="w-11 h-[68px] rounded-lg border-2 border-white/20 flex flex-col items-center justify-center gap-1.5 px-1.5 shrink-0">
        <div className="h-1 w-7 rounded-full" style={{ background: BRAND_SOLID }} />
        <div className="h-1 w-6 rounded-full bg-white/20" />
        <div className="h-1 w-6 rounded-full bg-white/20" />
        <div className="h-1 w-5 rounded-full bg-white/20" />
      </div>
    </div>
  );
}

// Prix d'un ingrédient qui alterne en boucle, avec sa flèche de variation — illustre l'historique
// de prix par fournisseur du garde-manger.
function TutorialPantryArt() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setUp((u) => !u), 1300);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full flex items-center justify-center py-1">
      <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.06)" }}>
        <span className="text-white/70 text-xs">Bœuf haché</span>
        <span className="font-mono text-xs font-semibold transition-colors duration-500" style={{ color: up ? "#EF4444" : "#10B981" }}>
          {up ? "12,90€/kg" : "11,90€/kg"}
        </span>
        {up ? <TrendingUp size={13} style={{ color: "#EF4444" }} /> : <TrendingDown size={13} style={{ color: "#10B981" }} />}
      </div>
    </div>
  );
}

const TUTORIAL_ART = {
  welcome: TutorialWelcomeArt,
  scan: TutorialScanArt,
  recipe: TutorialRecipeArt,
  allergens: TutorialAllergensArt,
  technicalSheet: TutorialTechnicalSheetArt,
  digitalMenu: TutorialDigitalMenuArt,
  pantry: TutorialPantryArt,
};

export function AppTutorial({ t, onClose }) {
  const [pageIdx, setPageIdx] = useState(0);
  const page = TUTORIAL_PAGES[pageIdx];
  const isLast = pageIdx === TUTORIAL_PAGES.length - 1;
  const Art = TUTORIAL_ART[page];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 py-4" style={{ background: "rgba(0,0,0,0.8)" }}>
      <TutorialStyles />
      <div className="w-full max-w-md rounded-2xl border border-white/10 max-h-full overflow-y-auto" style={{ background: "#201B15" }}>
        <div className="flex justify-end px-5 pt-4">
          <button
            type="button"
            onClick={() => onClose({ lastStep: page, finishedAll: false })}
            className="text-white/35 hover:text-white/70 text-[11px]"
          >
            {t("tutorialSkip")}
          </button>
        </div>
        <div className="px-6 pb-2 flex flex-col items-center text-center">
          <Art />
          <h2 className="font-display uppercase text-white text-base tracking-wide mt-5 mb-2">{t(`tutorial_${page}_title`)}</h2>
          <p className="text-white/55 text-sm leading-relaxed">{t(`tutorial_${page}_body`)}</p>
        </div>
        <div className="p-5 pt-4">
          <div className="flex justify-center gap-1.5 mb-4">
            {TUTORIAL_PAGES.map((p, i) => (
              <span
                key={p}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: i === pageIdx ? 18 : 6, background: i === pageIdx ? BRAND_SOLID : "rgba(255,255,255,0.15)" }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {pageIdx > 0 && (
              <button
                type="button"
                onClick={() => setPageIdx((i) => i - 1)}
                className="px-4 py-3 rounded-full text-xs font-medium text-white/60 shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {t("tutorialBack")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose({ lastStep: page, finishedAll: true }) : setPageIdx((i) => i + 1))}
              className="flex-1 py-3 rounded-full font-display uppercase text-[11px] tracking-wide font-semibold"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              {isLast ? t("tutorialFinish") : t("tutorialNext")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
