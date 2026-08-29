// Tableau de bord admin (2026-08-19) — visites/clics/scans/essais/abonnements/comptes, pour
// l'utilisateur uniquement (voir AdminDashboard, src/App.jsx). Authentifié ET restreint à un seul
// email : contrairement aux autres endpoints protégés par ADMIN_SECRET (accès manuel, pas de
// session), celui-ci est appelé depuis l'app connectée, donc vérifié via le token de session ET
// une comparaison d'email côté serveur — jamais uniquement côté client, qui pourrait être falsifié.
//
// ⚠️ Ce projet est au plafond du plan Hobby Vercel (12 fonctions serverless par déploiement,
// _lib.js exclu) avec ce fichier. Avant d'ajouter un nouvel endpoint : fusionner avec un fichier
// existant proche, voir la note dans CLAUDE.md ("Fichiers clés").
import { requireUser, getSupabaseAdmin, sendEmail, wrapEmailHtml, isInternalEmail, landingEventsSummary } from "./_lib.js";

// Suppression de compte (2026-08-29), demandée par l'utilisateur pour nettoyer les comptes de test
// (chefuptest01/02/03..., comptes créés par Claude pour tester le flux OTP/Google) sans jamais
// pouvoir toucher un compte interne par erreur — isInternalEmail() est vérifié ici en plus du
// client, c'est la vraie protection puisque le client peut toujours être falsifié. Supprime
// d'abord les données liées (kv_store/scan_events/activity_events/subscriptions, aucune n'a de
// suppression en cascade automatique), puis le compte Auth lui-même en dernier.

const ADMIN_EMAIL = "alexmollet0@gmail.com";
const TRIAL_DAYS = 7;

// Comptes internes (2026-08-26, demandé par l'utilisateur) : nos propres comptes faussaient les
// chiffres de l'onglet Aperçu — un scan de test comptait exactement comme un scan client, et les
// comptes de test gonflaient le total d'inscrits/essais. Ils sont donc exclus de TOUS les KPI et du
// graphique journalier, mais restent visibles dans l'onglet Comptes (avec un badge "interne") :
// l'objectif est d'avoir des statistiques honnêtes, pas de se cacher des comptes.
// La liste elle-même vit dans api/_lib.js (INTERNAL_EMAILS) : elle sert aussi à ne pas consommer
// de place dans l'offre de lancement. C'est là-bas, et uniquement là-bas, qu'on en ajoute un.

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

    if (action === "delete_account") {
      if (!email) return res.status(400).json({ error: "Requête invalide." });
      if (isInternalEmail(email)) return res.status(403).json({ error: "Ce compte est protégé, il ne peut pas être supprimé depuis ici." });
      try {
        const { data: usersRes, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (usersErr) throw usersErr;
        const target = (usersRes?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!target) return res.status(404).json({ error: "Compte introuvable." });
        // Double vérification côté serveur (jamais uniquement l'email envoyé par le client) : même
        // si un email interne passait le premier garde-fou d'une façon ou d'une autre, on revérifie
        // ici sur le VRAI email résolu depuis Supabase avant de supprimer quoi que ce soit.
        if (isInternalEmail(target.email)) return res.status(403).json({ error: "Ce compte est protégé, il ne peut pas être supprimé depuis ici." });
        for (const table of ["kv_store", "scan_events", "activity_events", "subscriptions"]) {
          const { error: delErr } = await supabaseAdmin.from(table).delete().eq("user_id", target.id);
          if (delErr) throw new Error(`${table}: ${delErr.message}`);
        }
        const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(target.id);
        if (authDelErr) throw authDelErr;
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
      }
    }

    return res.status(400).json({ error: "Requête invalide." });
  }

  const days = Math.max(7, Math.min(90, parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    // [BUG confirmé et corrigé, 2026-08-27] Supabase plafonne TOUTE requête à 1000 lignes, quelle
    // que soit la valeur de `.limit(...)` — le tri par date descendante posé la veille ne réglait
    // que l'ordre des survivants, pas le plafond lui-même. Depuis la campagne TikTok, `landing_events`
    // dépasse 1000 lignes par jour, donc le début de journée se faisait évincer au fil des nouvelles
    // visites — exactement le "le compteur ne bouge plus depuis ce matin" remonté par l'utilisateur
    // (confirmé par calcul : `views+startClicks+loginClicks+engaged+calcUsed` tombait pile à 1000).
    // Corrigé en sortant l'agrégation vers Postgres (`landingEventsSummary`, api/_lib.js) : la
    // requête ne renvoie plus que quelques dizaines de lignes déjà sommées par jour/type/provenance,
    // jamais soumise au plafond quel que soit le volume réel.
    const landingGroupedPromise = landingEventsSummary(supabaseAdmin, since).catch(async () => {
      const { data } = await supabaseAdmin
        .from("landing_events").select("event_type, source, created_at").gte("created_at", since)
        .order("created_at", { ascending: false }).limit(10000);
      return (data || []).map((r) => ({ event_type: r.event_type, source: r.source || "direct", day: (r.created_at || "").slice(0, 10), cnt: 1 }));
    });

    const [landingGrouped, scanRes, subRes, usersRes, activityRes] = await Promise.all([
      landingGroupedPromise,
      // `user_id` sélectionné en plus (2026-08-26) uniquement pour pouvoir écarter les scans de nos
      // propres comptes des statistiques — voir INTERNAL_EMAILS.
      supabaseAdmin.from("scan_events").select("user_id, created_at").gte("created_at", since),
      supabaseAdmin.from("subscriptions").select("user_id, status"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      // Flux d'activité par compte (2026-08-23) : connexions, recettes créées, scans + leur résultat
      // — voir api/scan-events.js. Pas filtré par `days` (c'est un flux récent à surveiller, pas une
      // série historique) ; la table peut ne pas encore exister sur un déploiement pas encore migré,
      // d'où le fallback silencieux à un tableau vide plutôt qu'une erreur qui casserait tout le reste
      // du dashboard.
      supabaseAdmin.from("activity_events").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (scanRes.error) throw scanRes.error;
    if (subRes.error) throw subRes.error;
    if (usersRes.error) throw usersRes.error;

    const subByUser = new Map((subRes.data || []).map((s) => [s.user_id, s]));
    const authUsers = usersRes.data?.users || [];
    const emailById = new Map(authUsers.map((u) => [u.id, u.email]));
    const internalUserIds = new Set(authUsers.filter((u) => isInternalEmail(u.email)).map((u) => u.id));
    // Scans réellement clients : nos propres scans de test ne doivent plus compter (le graphique et
    // le KPI "scans" affichaient jusqu'ici surtout notre propre activité de mise au point).
    const scanRows = (scanRes.data || []).filter((r) => !internalUserIds.has(r.user_id));
    const activityFeed = (activityRes.error ? [] : activityRes.data || []).map((e) => {
      const email = emailById.get(e.user_id) || "?";
      return {
        id: e.id,
        type: e.type,
        createdAt: e.created_at,
        email,
        // Le flux vit dans l'onglet Comptes, pas dans l'Aperçu : on garde nos propres actions
        // visibles (utile pour vérifier qu'un correctif marche), simplement identifiées comme
        // internes pour ne jamais les confondre avec de l'activité client.
        internal: isInternalEmail(email),
        meta: e.meta || {},
      };
    });

    // Série journalière (visites + scans) sur la période demandée, jours sans donnée inclus à 0
    // pour ne jamais donner l'impression trompeuse d'un trou dans les données.
    const dayKey = (iso) => iso.slice(0, 10);
    const dailyMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString());
      dailyMap[k] = { date: k, views: 0, startClicks: 0, scans: 0 };
    }
    landingGrouped.forEach((r) => {
      const k = r.day;
      if (!dailyMap[k]) return;
      const n = Number(r.cnt);
      if (r.event_type === "view") dailyMap[k].views += n;
      if (r.event_type === "start_click") dailyMap[k].startClicks += n;
    });
    scanRows.forEach((r) => {
      const k = dayKey(r.created_at);
      if (dailyMap[k]) dailyMap[k].scans++;
    });
    const dailySeries = Object.values(dailyMap);

    // Funnel par provenance (2026-08-26) : c'est le seul moyen de savoir si une campagne payante
    // rapporte vraiment, ou si les inscriptions viennent en fait du trafic naturel. Les visites
    // sans `?src=` (et toutes celles enregistrées avant l'ajout de la colonne) tombent dans
    // "direct" — c'est aussi là qu'atterrissent les visites du fondateur lui-même s'il n'a pas
    // ouvert le site avec `?notrack=1` au moins une fois sur cet appareil.
    const sourceMap = {};
    const touchSource = (key) => {
      if (!sourceMap[key]) sourceMap[key] = { source: key, views: 0, engaged: 0, calcUsed: 0, startClicks: 0, loginClicks: 0, accounts: 0 };
      return sourceMap[key];
    };
    for (const r of landingGrouped) {
      const s = touchSource(r.source || "direct");
      const n = Number(r.cnt);
      if (r.event_type === "view") s.views += n;
      if (r.event_type === "engaged") s.engaged += n;
      if (r.event_type === "calc_used") s.calcUsed += n;
      if (r.event_type === "start_click") s.startClicks += n;
      if (r.event_type === "login_click") s.loginClicks += n;
    }
    // Comptes créés, rattachés à la campagne qui les a amenés (2026-08-26). La provenance est
    // recopiée dans les métadonnées du compte au moment de l'inscription (voir src/Auth.jsx) :
    // c'est le seul lien possible entre une visite anonyme et une inscription. Les comptes créés
    // AVANT ce mécanisme n'ont pas de source et tombent donc dans "direct" — ne pas s'étonner d'y
    // voir tout l'historique au début.
    const sinceMs = new Date(since).getTime();
    for (const u of authUsers) {
      if (isInternalEmail(u.email)) continue;
      if (new Date(u.created_at).getTime() < sinceMs) continue;
      touchSource(u.user_metadata?.signup_source || "direct").accounts++;
    }
    const bySource = Object.values(sourceMap).sort((a, b) => b.views - a.views);

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
        return {
          email: u.email,
          createdAt: u.created_at,
          status,
          emailConfirmed: !!(u.email_confirmed_at || u.confirmed_at),
          // Exclu des KPI ci-dessous, mais toujours listé dans l'onglet Comptes (badge "interne").
          internal: isInternalEmail(u.email),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Tous les KPI de l'onglet Aperçu se calculent sur les seuls comptes réellement clients.
    const clientUsers = usersOut.filter((u) => !u.internal);
    const kpis = {
      totalUsers: clientUsers.length,
      activeTrials: clientUsers.filter((u) => u.status.startsWith("Essai (")).length,
      activeSubs: clientUsers.filter((u) => u.status === "Abonné actif" || u.status === "Paiement en retard").length,
      canceled: clientUsers.filter((u) => u.status === "Annulé").length,
      expiredNoSub: clientUsers.filter((u) => u.status === "Essai expiré").length,
      unconfirmedEmails: clientUsers.filter((u) => !u.emailConfirmed).length,
      views: landingGrouped.filter((r) => r.event_type === "view").reduce((s, r) => s + Number(r.cnt), 0),
      startClicks: landingGrouped.filter((r) => r.event_type === "start_click").reduce((s, r) => s + Number(r.cnt), 0),
      scans: scanRows.length,
    };

    return res.status(200).json({ periodDays: days, kpis, dailySeries, bySource, users: usersOut, activityFeed });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
