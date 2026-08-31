// Fichier utilitaire partagé par les fonctions serveur Stripe. Le préfixe "_" empêche Vercel de
// le déployer lui-même comme une route (convention Vercel pour du code partagé dans /api).
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Client Supabase "admin" (clé service_role, jamais exposée au navigateur) : contourne les
// policies RLS, nécessaire ici car le webhook Stripe et les fonctions de facturation écrivent
// dans la table subscriptions sans être "connectés" comme un utilisateur normal.
export function getSupabaseAdmin() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Bucket Supabase Storage pour les photos/PDF de facture scannés (2026-08-31), demandé par
// l'utilisateur pour pouvoir vérifier depuis le tableau de bord admin qu'un scan a bien fonctionné
// (comparer la facture d'origine au résultat extrait). Jamais créé à la main dans le dashboard
// Supabase — voir uploadScanImage, qui le crée à la volée au premier upload. Privé (jamais public) :
// seul le tableau de bord admin y accède, via une URL signée à courte durée de vie (voir
// api/admin-dashboard.js, action "get_scan_image_url"). Nettoyage automatique après 30 jours (choix
// explicite de l'utilisateur) — voir api/send-reminders.js, cron quotidien.
export const SCAN_UPLOADS_BUCKET = "scan-uploads";
export const SCAN_UPLOADS_RETENTION_DAYS = 30;

// Upload best-effort d'une image/PDF de scan vers Storage — ne doit JAMAIS faire échouer le journal
// d'activité qui l'accompagne (voir api/scan-events.js) : toute erreur renvoie simplement `null`
// plutôt que de lever. Chemin `<userId>/<horodatage>-<aléatoire>.<ext>`, jamais mêlé entre comptes.
export async function uploadScanImage(supabaseAdmin, userId, base64, mediaType) {
  if (!base64 || typeof base64 !== "string" || !userId) return null;
  // Filet de sécurité : une facture compressée dépasse rarement quelques centaines de Ko, un PDF
  // natif peut être plus lourd — accepté jusqu'à ~6 Mo décodés plutôt que de risquer de saturer la
  // fonction serverless pour un usage qui reste secondaire (diagnostic, pas le scan lui-même).
  if (base64.length > 8_000_000) return null;
  try {
    const ext = mediaType === "application/pdf" ? "pdf" : mediaType === "image/png" ? "png" : "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const buffer = Buffer.from(base64, "base64");
    const doUpload = () =>
      supabaseAdmin.storage.from(SCAN_UPLOADS_BUCKET).upload(path, buffer, { contentType: mediaType || "image/jpeg" });
    let { error } = await doUpload();
    if (error && /bucket.*not.*found/i.test(error.message || "")) {
      // Premier upload du projet : le bucket n'existe pas encore côté Supabase, on le crée puis on
      // réessaie une seule fois.
      await supabaseAdmin.storage.createBucket(SCAN_UPLOADS_BUCKET, { public: false });
      ({ error } = await doUpload());
    }
    if (error) return null;
    return path;
  } catch (e) {
    return null;
  }
}

// Vérifie le token de session Supabase envoyé par le client (Authorization: Bearer <token>) et
// renvoie l'utilisateur correspondant, ou null. C'est le token signé par Supabase qui prouve
// l'identité — on ne fait jamais confiance à un user_id envoyé directement dans le corps de la
// requête, qui pourrait être falsifié.
export async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Vérification "souple" de l'utilisateur (2026-08-24), pensée pour les endpoints COÛTEUX (scan IA)
// où il faut deux choses à la fois, en apparence contradictoires :
//  - empêcher un inconnu d'appeler l'endpoint en boucle et de consommer nos crédits d'IA ;
//  - ne JAMAIS bloquer un vrai restaurateur à cause d'un incident qui n'a rien à voir avec lui.
// D'où ce résultat en 4 états plutôt qu'un simple oui/non (contrairement à `requireUser`, qui
// renvoie `null` aussi bien pour "aucun token" que pour "Supabase est en panne" — indistinguable,
// donc inutilisable ici sans risquer de bloquer un client pendant une panne) :
//  - "ok"           : token valide, c'est un client connecté ;
//  - "missing"      : aucun token du tout → c'est la signature d'un appel automatisé, on refuse ;
//  - "invalid"      : token présent mais explicitement refusé (expiré) → le client peut le
//                     rafraîchir et relancer tout seul, l'app le fait automatiquement ;
//  - "unverifiable" : impossible de savoir (Supabase injoignable, erreur 5xx, délai dépassé) →
//                     ON LAISSE PASSER volontairement. Mieux vaut offrir un scan de trop que
//                     bloquer un restaurateur pour une panne dont il n'est pas responsable.
export async function checkUserSoft(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { status: "missing", user: null };
  try {
    // Délai court : la vérification ne doit jamais rallonger sensiblement un scan, et surtout
    // jamais le faire échouer si Supabase met du temps à répondre.
    const result = await Promise.race([
      getSupabaseAdmin().auth.getUser(token),
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 5000)),
    ]);
    if (result?.timedOut) return { status: "unverifiable", user: null };
    if (result?.data?.user) return { status: "ok", user: result.data.user };
    // Seul un refus EXPLICITE compte comme un token invalide. Tout le reste (panne, limite de
    // débit, erreur réseau) est traité comme "je ne sais pas", donc laissé passer.
    const status = result?.error?.status;
    if (status === 401 || status === 403) return { status: "invalid", user: null };
    return { status: "unverifiable", user: null };
  } catch (e) {
    return { status: "unverifiable", user: null };
  }
}

// Envoi d'email via l'API Resend (pas les templates d'auth Supabase, qui ne servent qu'à
// signup/reset/magic link) — partagé par api/send-reminders.js et api/contact.js.
// `attachments` (optionnel) : tableau au format Resend [{ filename, content (base64) }].
// `scheduledAt` (optionnel, 2026-08-24) : ISO 8601 UTC — programme l'envoi dans le futur au lieu
// d'envoyer immédiatement (utilisé par le mail d'accueil, voir api/send-reminders.js).
// `replyTo` (optionnel, 2026-08-24) : adresse où atterrissent les réponses, distincte de `from`
// (qui reste "hello@getchefup.com" pour la marque) — utile tant que cette adresse n'a pas de
// vraie boîte de réception configurée (voir CLAUDE.md, section EN COURS).
// Habillage HTML commun à tous les emails automatiques (bordure de marque, CTA, mention en bas de
// page) — partagé par api/send-reminders.js et api/admin-dashboard.js (2026-08-25, mail de
// déblocage) pour ne pas dupliquer ce gabarit à chaque nouvel usage.
export function wrapEmailHtml(bodyHtml, ctaLabel, settingsHint) {
  return `<div style="font-family:Arial,sans-serif;background:#F3EBDA;padding:24px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;">
      <div style="font-family:Arial,sans-serif;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:#6D28D9;margin-bottom:16px;">Chefup</div>
      <div style="color:#2B2620;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      <a href="https://getchefup.com" style="display:inline-block;margin-top:20px;padding:10px 20px;border-radius:999px;background:linear-gradient(90deg,#8B5CF6,#22D3EE);color:#fff;text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${ctaLabel}</a>
      ${settingsHint ? `<p style="color:#2B2620;opacity:0.4;font-size:11px;margin-top:24px;">${settingsHint}</p>` : ""}
    </div>
  </div>`;
}

export async function sendEmail(to, subject, html, attachments, scheduledAt, replyTo) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY manquant côté serveur.");
  const body = { from: "Chefup <hello@getchefup.com>", to, subject, html };
  if (attachments && attachments.length) body.attachments = attachments;
  if (scheduledAt) body.scheduled_at = scheduledAt;
  if (replyTo) body.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend a refusé l'envoi (${res.status}) : ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Offre de lancement "tarif fondateur" (2026-08-26)
// ---------------------------------------------------------------------------
// Les 50 premiers restaurants gardent 29€/mois à vie au lieu du tarif normal.
// Règles décidées avec l'utilisateur, à ne pas modifier sans lui :
//  - une place est RÉSERVÉE dès l'inscription, tant que l'essai gratuit court ;
//  - elle est CONFIRMÉE (et verrouillée à vie côté Stripe) si le compte s'abonne
//    avant la fin de son essai ;
//  - un essai qui expire sans abonnement LIBÈRE la place, qui repart dans le pool.
// Conséquence : le nombre de places restantes se recalcule à chaque appel plutôt que
// d'être stocké — un compteur figé se serait forcément désynchronisé de la réalité.
export const FOUNDING_SPOTS = 50;
// ⚠️ doit rester synchronisé avec TRIAL_DAYS dans src/Billing.jsx et api/send-reminders.js
export const TRIAL_DAYS = 7;

// Nos propres comptes ne consomment jamais de place et ne comptent dans aucune statistique.
// C'est LA liste de référence du projet (api/admin-dashboard.js l'importe aussi) : pour en
// ajouter un, c'est ici et nulle part ailleurs.
export const INTERNAL_EMAILS = ["alexmollet0@gmail.com", "contact.ttra@gmail.com"];
export const isInternalEmail = (email) => !!email && INTERNAL_EMAILS.includes(email.toLowerCase());

// [BUG confirmé et corrigé, 2026-08-27] `landing_events` ne peut plus être compté en récupérant les
// lignes brutes puis en comptant côté JS : Supabase plafonne TOUTE requête à 1000 lignes, quelle
// que soit la valeur passée à `.limit(...)`. Le tri par date décroissante ajouté la veille ne
// réglait que l'ORDRE des lignes survivantes (les plus récentes) — pas le plafond lui-même. Preuve
// mesurée le jour même : `views + startClicks + loginClicks + engaged + calcUsed` tombait pile sur
// 1000 un jour de forte affluence (campagne TikTok), et une insertion de test manuelle apparaissait
// bien dans `bySource` sans jamais faire bouger le total — un événement plus ancien se faisant
// silencieusement évincer à chaque nouvelle insertion. Dès qu'une journée dépasse 1000 événements
// (le cas quasi tous les jours depuis la campagne), le début de journée disparaissait du décompte.
// Corrigé en sortant l'agrégation de JS pour la confier à Postgres (`GROUP BY`, fonction RPC
// `landing_events_summary`) : la requête ne renvoie plus que quelques dizaines de lignes DÉJÀ
// SOMMÉES (une par jour × type d'événement × provenance), jamais les événements un par un — donc
// plus jamais soumise au plafond de 1000 lignes, quel que soit le volume réel.
// ⚠️ Fonction à créer une seule fois dans Supabase (SQL Editor) :
//   create or replace function landing_events_summary(since timestamptz)
//   returns table(event_type text, source text, day date, cnt bigint)
//   language sql stable as $$
//     select event_type, coalesce(source, 'direct') as source, created_at::date as day, count(*) as cnt
//     from landing_events where created_at >= since
//     group by event_type, coalesce(source, 'direct'), created_at::date
//   $$;
// Tant que cette fonction n'existe pas côté Supabase, l'appel RPC échoue et on retombe sur
// l'ancienne méthode (lignes brutes + tri + plafond 10000) — dégradée mais fonctionnelle, pour ne
// jamais casser le tableau de bord le temps que la fonction soit créée.
export async function landingEventsSummary(supabaseAdmin, sinceISO) {
  const { data, error } = await supabaseAdmin.rpc("landing_events_summary", { since: sinceISO });
  if (error) throw error;
  return data || []; // [{event_type, source, day, cnt}, ...]
}

const ACTIVE_SUB_STATUSES = ["active", "trialing", "past_due"];

// Calcule qui détient réellement une place fondateur, en parcourant les comptes par date
// d'inscription croissante (le premier arrivé est le premier servi) et en s'arrêtant à 50.
// Renvoie aussi le nombre de places restantes, affiché publiquement sur la landing.
// [BUG DE LENTEUR corrigé, 2026-08-27] Signalé par l'utilisateur : la page de paiement Stripe
// mettait "très très" longtemps à s'ouvrir après un clic sur "S'abonner". Cause : `listUsers`
// (l'API Admin de Supabase, appelée ci-dessous) est l'une des routes les plus lentes de Supabase —
// et `getFoundingState` la réinterrogeait EN ENTIER à chaque affichage du bandeau d'essai
// (`Billing.jsx` la charge au montage, via le GET de `create-checkout-session.js`) ET à chaque
// clic sur "S'abonner" (le POST du même fichier), sans aucun cache. Deux appels complets à
// `listUsers` en quelques secondes pour une information qui ne change jamais aussi vite — le
// statut fondateur ne bouge qu'à une inscription ou un abonnement, jamais en continu.
// Cache mémoire de 20s, partagé par TOUS les appelants (`create-checkout-session.js`, `landing.js`,
// `send-reminders.js`) : le premier appel après expiration paie le coût de `listUsers`, tous les
// suivants dans la fenêtre le récupèrent instantanément. Dans le cas réel qui a motivé ce
// correctif, le GET au chargement de la page prime déjà le cache — le POST qui suit au clic sur
// "S'abonner" devient donc quasi immédiat.
// ⚠️ La valeur mise en cache contient un `Set` (`holders`) : tous les appelants ne font que le
// LIRE (`.has(...)`), jamais le modifier — vérifié avant d'introduire ce partage de référence.
let foundingStateCache = { at: 0, promise: null };
const FOUNDING_STATE_TTL_MS = 20 * 1000;

export function getFoundingState(supabaseAdmin) {
  const now = Date.now();
  if (foundingStateCache.promise && now - foundingStateCache.at < FOUNDING_STATE_TTL_MS) {
    return foundingStateCache.promise;
  }
  const promise = computeFoundingState(supabaseAdmin);
  foundingStateCache = { at: now, promise };
  // Une promesse rejetée ne doit jamais rester en cache tout le TTL : le prochain appel doit
  // pouvoir réessayer immédiatement plutôt que d'échouer pendant 20 secondes.
  promise.catch(() => {
    foundingStateCache = { at: 0, promise: null };
  });
  return promise;
}

async function computeFoundingState(supabaseAdmin) {
  const [usersRes, subsRes, kvRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from("subscriptions").select("user_id, status"),
    supabaseAdmin.from("kv_store").select("user_id, key, value").in("key", ["foundingMember", "trialStartOverride"]),
  ]);

  const subStatus = new Map((subsRes.data || []).map((s) => [s.user_id, s.status]));
  const foundingFlag = new Set();
  const trialOverride = new Map();
  for (const row of kvRes.data || []) {
    if (row.key === "foundingMember") {
      foundingFlag.add(row.user_id);
    } else {
      try {
        trialOverride.set(row.user_id, JSON.parse(row.value));
      } catch (e) {
        trialOverride.set(row.user_id, row.value);
      }
    }
  }

  const users = (usersRes.data?.users || [])
    .filter((u) => u.email && !isInternalEmail(u.email))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const holders = new Set();
  for (const u of users) {
    const subscribed = ACTIVE_SUB_STATUSES.includes(subStatus.get(u.id));
    // Même règle de départ d'essai que src/Billing.jsx : on retient la plus RÉCENTE des deux
    // dates, jamais la plus ancienne, pour ne jamais raccourcir un essai par accident.
    let start = u.created_at;
    const override = trialOverride.get(u.id);
    if (override && new Date(override) > new Date(start)) start = override;
    const inTrial = Date.now() < new Date(start).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;

    // Abonné au tarif fondateur : place détenue définitivement. Abonné au tarif normal :
    // ne consomme aucune place. Ni l'un ni l'autre : la place n'est retenue que pendant l'essai.
    const holds = subscribed ? foundingFlag.has(u.id) : inTrial;
    if (holds) holders.add(u.id);
    if (holders.size >= FOUNDING_SPOTS) break;
  }

  return { total: FOUNDING_SPOTS, holders, remaining: Math.max(0, FOUNDING_SPOTS - holders.size) };
}
