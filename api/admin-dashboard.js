// Tableau de bord admin (2026-08-19) — visites/clics/scans/essais/abonnements/comptes, pour
// l'utilisateur uniquement (voir AdminDashboard, src/App.jsx). Authentifié ET restreint à un seul
// email : contrairement aux autres endpoints protégés par ADMIN_SECRET (accès manuel, pas de
// session), celui-ci est appelé depuis l'app connectée, donc vérifié via le token de session ET
// une comparaison d'email côté serveur — jamais uniquement côté client, qui pourrait être falsifié.
//
// ⚠️ Ce projet est au plafond du plan Hobby Vercel (12 fonctions serverless par déploiement,
// _lib.js exclu) avec ce fichier. Avant d'ajouter un nouvel endpoint : fusionner avec un fichier
// existant proche, voir la note dans CLAUDE.md ("Fichiers clés").
import { requireUser, getSupabaseAdmin, sendEmail, wrapEmailHtml } from "./_lib.js";

const ADMIN_EMAIL = "alexmollet0@gmail.com";
const TRIAL_DAYS = 7;

// Mail de déblocage (2026-08-25) : envoi groupé, déclenché manuellement par l'utilisateur depuis le
// tableau de bord, pour les comptes déjà inscrits mais qui n'ont jamais confirmé leur email — donc
// jamais informés que la confirmation n'est plus obligatoire pour se connecter (voir CLAUDE.md,
// "Visibilité de la confirmation d'email"). Décision explicite de l'utilisateur : PAS automatique
// (pas besoin pour les futurs comptes, le blocage n'existe plus), juste un rattrapage ponctuel pour
// les comptes actuellement coincés.
const UNLOCK_EMAIL_COPY = {
  fr: {
    subject: "Tu peux maintenant te connecter à Chefup",
    body: `<p>Salut,</p>
      <p>Tu t'étais inscrit sur Chefup, mais un bug de notre côté bloquait la connexion tant que l'email de confirmation n'était pas cliqué — un email qui atterrissait parfois directement dans les spams, sans que tu le voies.</p>
      <p>C'est corrigé : tu peux te connecter dès maintenant avec ton email et ton mot de passe, sans rien confirmer.</p>
      <p>Désolé pour la gêne — si ça ne marche toujours pas, réponds directement à cet email, je regarde ça avec toi.</p>
      <p>Alexandre</p>`,
    cta: "Se connecter",
  },
  es: {
    subject: "Ya puedes conectarte a Chefup",
    body: `<p>Hola,</p>
      <p>Te registraste en Chefup, pero un fallo de nuestra parte bloqueaba el acceso hasta confirmar el email — un correo que a veces caía directamente en spam sin que lo vieras.</p>
      <p>Ya está solucionado: puedes conectarte ahora mismo con tu email y contraseña, sin confirmar nada.</p>
      <p>Perdona las molestias — si sigue sin funcionar, responde directamente a este correo, lo miramos juntos.</p>
      <p>Alexandre</p>`,
    cta: "Iniciar sesión",
  },
  en: {
    subject: "You can now log in to Chefup",
    body: `<p>Hi,</p>
      <p>You signed up for Chefup, but a bug on our end was blocking sign-in until the confirmation email was clicked — an email that sometimes landed straight in spam without you seeing it.</p>
      <p>It's fixed now: you can log in right away with your email and password, no confirmation needed.</p>
      <p>Sorry for the hassle — if it still doesn't work, just reply to this email and I'll look into it with you.</p>
      <p>Alexandre</p>`,
    cta: "Log in",
  },
};

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });
  if (user.email !== ADMIN_EMAIL) return res.status(403).json({ error: "Accès réservé." });

  const supabaseAdmin = getSupabaseAdmin();

  // Réinitialisation d'essai (2026-08-25), demandée par l'utilisateur après le cas de
  // casavostra.ajaccio@gmail.com (essai gâché par une série de vrais bugs de scan, pas de sa
  // faute) — évite d'avoir à repasser par le SQL Editor de Supabase à chaque fois que ça se
  // reproduit. `created_at` (auth.users) n'est PAS modifiable via l'API Admin de Supabase, seul un
  // accès SQL direct le permet — on ne touche donc jamais ce champ. À la place : un `kv_store`
  // dédié (`trialStartOverride`, même table que `settings`/`recipes`/etc.) écrit directement pour
  // le compte ciblé via le client service_role (qui contourne RLS, donc peut écrire dans la ligne
  // de N'IMPORTE QUEL compte, pas seulement le sien) — `src/Billing.jsx` compare ensuite cette date
  // à `created_at` et retient la plus récente des deux comme point de départ de l'essai.
  if (req.method === "POST") {
    const { action, email } = req.body || {};

    if (action === "reset_trial") {
      if (!email) return res.status(400).json({ error: "Requête invalide." });
      try {
        const { data: usersRes, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (usersErr) throw usersErr;
        const target = (usersRes?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!target) return res.status(404).json({ error: "Compte introuvable." });
        const { error: upsertErr } = await supabaseAdmin
          .from("kv_store")
          .upsert(
            { user_id: target.id, key: "trialStartOverride", value: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: "user_id,key" }
          );
        if (upsertErr) throw upsertErr;
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
      }
    }

    // Envoi groupé du mail de déblocage (2026-08-25) — voir UNLOCK_EMAIL_COPY plus haut. Cible tous
    // les comptes jamais confirmés, saute ceux qui l'ont déjà reçu (notifState.unlockEmailSentAt,
    // même table/clé que les autres emails automatiques dans api/send-reminders.js).
    if (action === "send_unlock_emails") {
      try {
        const { data: usersRes, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (usersErr) throw usersErr;
        const targets = (usersRes?.users || []).filter((u) => u.email && !(u.email_confirmed_at || u.confirmed_at));
        const now = new Date();
        const results = [];
        for (const u of targets) {
          const { data: rows } = await supabaseAdmin
            .from("kv_store").select("key,value").eq("user_id", u.id).in("key", ["notifState", "lang"]);
          const kv = {};
          for (const row of rows || []) {
            try { kv[row.key] = JSON.parse(row.value); } catch { kv[row.key] = null; }
          }
          const notifState = kv.notifState || {};
          if (notifState.unlockEmailSentAt) {
            results.push({ email: u.email, skipped: "already_sent" });
            continue;
          }
          const lang = UNLOCK_EMAIL_COPY[kv.lang] ? kv.lang : "fr";
          const copy = UNLOCK_EMAIL_COPY[lang];
          try {
            await sendEmail(u.email, copy.subject, wrapEmailHtml(copy.body, copy.cta, ""), null, null, process.env.CONTACT_EMAIL || undefined);
          } catch (e) {
            results.push({ email: u.email, error: e.message || "échec d'envoi" });
            continue;
          }
          const nextState = { ...notifState, unlockEmailSentAt: now.toISOString() };
          await supabaseAdmin.from("kv_store").upsert(
            { user_id: u.id, key: "notifState", value: JSON.stringify(nextState), updated_at: now.toISOString() },
            { onConflict: "user_id,key" }
          );
          results.push({ email: u.email, sent: true });
        }
        return res.status(200).json({ ok: true, sentCount: results.filter((r) => r.sent).length, total: targets.length, results });
      } catch (e) {
        return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
      }
    }

    return res.status(400).json({ error: "Requête invalide." });
  }

  const days = Math.max(7, Math.min(90, parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [landingRes, scanRes, subRes, usersRes, activityRes] = await Promise.all([
      supabaseAdmin.from("landing_events").select("event_type, created_at").gte("created_at", since),
      supabaseAdmin.from("scan_events").select("created_at").gte("created_at", since),
      supabaseAdmin.from("subscriptions").select("user_id, status"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      // Flux d'activité par compte (2026-08-23) : connexions, recettes créées, scans + leur résultat
      // — voir api/scan-events.js. Pas filtré par `days` (c'est un flux récent à surveiller, pas une
      // série historique) ; la table peut ne pas encore exister sur un déploiement pas encore migré,
      // d'où le fallback silencieux à un tableau vide plutôt qu'une erreur qui casserait tout le reste
      // du dashboard.
      supabaseAdmin.from("activity_events").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (landingRes.error) throw landingRes.error;
    if (scanRes.error) throw scanRes.error;
    if (subRes.error) throw subRes.error;
    if (usersRes.error) throw usersRes.error;

    const landingRows = landingRes.data || [];
    const scanRows = scanRes.data || [];
    const subByUser = new Map((subRes.data || []).map((s) => [s.user_id, s]));
    const authUsers = usersRes.data?.users || [];
    const emailById = new Map(authUsers.map((u) => [u.id, u.email]));
    const activityFeed = (activityRes.error ? [] : activityRes.data || []).map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.created_at,
      email: emailById.get(e.user_id) || "?",
      meta: e.meta || {},
    }));

    // Série journalière (visites + scans) sur la période demandée, jours sans donnée inclus à 0
    // pour ne jamais donner l'impression trompeuse d'un trou dans les données.
    const dayKey = (iso) => iso.slice(0, 10);
    const dailyMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString());
      dailyMap[k] = { date: k, views: 0, startClicks: 0, scans: 0 };
    }
    landingRows.forEach((r) => {
      const k = dayKey(r.created_at);
      if (!dailyMap[k]) return;
      if (r.event_type === "view") dailyMap[k].views++;
      if (r.event_type === "start_click") dailyMap[k].startClicks++;
    });
    scanRows.forEach((r) => {
      const k = dayKey(r.created_at);
      if (dailyMap[k]) dailyMap[k].scans++;
    });
    const dailySeries = Object.values(dailyMap);

    const usersOut = authUsers
      .map((u) => {
        const sub = subByUser.get(u.id);
        const trialEnd = new Date(u.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000;
        const trialDaysLeft = Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000));
        const subActive = sub && ["active", "trialing", "past_due"].includes(sub.status);
        let status;
        if (subActive) status = sub.status === "past_due" ? "Paiement en retard" : "Abonné actif";
        else if (trialDaysLeft > 0) status = `Essai (J-${trialDaysLeft})`;
        else if (sub && sub.status === "canceled") status = "Annulé";
        else status = "Essai expiré";
        // Confirmation d'email (2026-08-25) : `email_confirmed_at` reste null tant que le compte
        // n'a pas cliqué le lien de confirmation reçu par mail — c'est exactement ce qui a coincé
        // 3 inscriptions le 2026-08-25 (mail parti en spam, jamais confirmé, jamais pu se
        // connecter). Utile à voir même une fois la confirmation obligatoire désactivée côté
        // Supabase : ça reste le seul moyen de savoir si l'adresse d'un compte est vraiment
        // joignable (utile pour les alertes email, les reçus, ou le recontacter).
        return { email: u.email, createdAt: u.created_at, status, emailConfirmed: !!(u.email_confirmed_at || u.confirmed_at) };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const kpis = {
      totalUsers: usersOut.length,
      activeTrials: usersOut.filter((u) => u.status.startsWith("Essai (")).length,
      activeSubs: usersOut.filter((u) => u.status === "Abonné actif" || u.status === "Paiement en retard").length,
      canceled: usersOut.filter((u) => u.status === "Annulé").length,
      expiredNoSub: usersOut.filter((u) => u.status === "Essai expiré").length,
      unconfirmedEmails: usersOut.filter((u) => !u.emailConfirmed).length,
      views: landingRows.filter((r) => r.event_type === "view").length,
      startClicks: landingRows.filter((r) => r.event_type === "start_click").length,
      scans: scanRows.length,
    };

    return res.status(200).json({ periodDays: days, kpis, dailySeries, users: usersOut, activityFeed });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
