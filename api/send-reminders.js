// Rappels par email (inactivité + marge sous objectif + accueil), déclenchés une fois par jour
// par le cron Vercel (voir vercel.json) sur cette même route, en GET — protégé par CRON_SECRET
// (Vercel l'envoie automatiquement en en-tête Authorization pour l'appel cron ; pour un test
// manuel, passer ?secret=... dans l'URL). Ajouter ?dryRun=1 pour voir ce qui SERAIT envoyé sans
// rien envoyer ni écrire dans Supabase — à utiliser en premier avant tout vrai envoi.
//
// POST (2026-08-24, nouveau) : déclenché par le client (`src/Auth.jsx`) juste après la toute
// première connexion d'un compte, authentifié par le token de session (`requireUser`, pas
// CRON_SECRET — différent modèle d'auth, voir plus bas). Programme (ne envoie pas tout de suite)
// un email d'accueil humain via Resend (`scheduled_at`), à une heure choisie selon le fuseau
// horaire du navigateur de l'utilisateur — voir `computeWelcomeSendAt`.
import { getSupabaseAdmin, sendEmail, requireUser, wrapEmailHtml } from "./_lib.js";

// Comptes à ne jamais inscrire à l'email d'accueil automatique (2026-08-24) — actuellement un
// seul cas : cliente déjà accompagnée personnellement suite à un problème de scan signalé via le
// formulaire de contact (voir CLAUDE.md, section support client), un email automatique "as-tu
// besoin d'aide ?" serait redondant/déroutant juste après. Comparaison insensible à la casse.
const WELCOME_EMAIL_EXCLUDED = ["casavostra.ajaccio@gmail.com"];

const INACTIVITY_DAYS = 21; // 3 semaines sans scan
const INACTIVITY_RENOTIFY_DAYS = 14; // ne relance pas avant ce délai après un 1er rappel
const MARGIN_DIGEST_STALE_DAYS = 28; // relance même sans changement après ce délai (~1 mois)
// Nombre de vérifications quotidiennes CONSÉCUTIVES sous l'objectif avant d'alerter (2026-08-24).
// Avant ce correctif, un seul passage du cron (une fois par semaine, le lundi) suffisait à
// déclencher l'email — un utilisateur qui baisse volontairement son prix quelques minutes (ex:
// pour une démo TikTok) pouvait recevoir une alerte si ce court instant tombait pile sur l'heure
// du cron. Exiger 2 lectures consécutives (à ~24h d'intervalle, le cron tourne 1x/jour) filtre
// ce cas quasiment à coup sûr, tout en repérant un vrai problème plus vite qu'avant (avant : la
// vérification elle-même n'avait lieu qu'un jour par semaine, jusqu'à 7 jours de délai).
const MARGIN_CONFIRM_STREAK = 2;
const TRIAL_DAYS = 7; // doit rester synchronisé avec TRIAL_DAYS dans src/Billing.jsx

function daysBetween(from, to) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

// Convertit une heure "murale" (année/mois/jour/heure/minute) dans un fuseau IANA donné en
// l'instant UTC correspondant — sans dépendance externe (Intl suffit). Approche par convergence :
// on part d'une estimation, on mesure l'écart avec l'heure que ça donnerait réellement dans ce
// fuseau, et on corrige (2 passes suffisent, gère les transitions heure d'été/hiver).
function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const gotUtcMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, parts.hour === "24" ? 0 : +parts.hour, +parts.minute);
    const wantUtcMs = Date.UTC(year, month - 1, day, hour, minute);
    guess += wantUtcMs - gotUtcMs;
  }
  return new Date(guess);
}

// Heure d'envoi du mail d'accueil (2026-08-24) : "quelques heures après l'inscription", sauf le
// soir/la nuit (>=19h ou <7h locales) où on reporte au lendemain 9h locales plutôt que d'envoyer
// en pleine soirée — demandé explicitement par l'utilisateur. `timeZone` vient du navigateur du
// nouvel inscrit (capturé côté client, voir src/Auth.jsx) ; repli sur un simple +3h si le fuseau
// est absent/invalide (mieux qu'échouer silencieusement).
function computeWelcomeSendAt(now, timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    const hour = parts.hour === "24" ? 0 : +parts.hour;
    if (hour >= 19 || hour < 7) {
      const dayOffset = hour >= 19 ? 1 : 0; // après 19h -> demain 9h ; avant 7h -> aujourd'hui 9h
      const base = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day));
      base.setUTCDate(base.getUTCDate() + dayOffset);
      return zonedTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 9, 0, timeZone);
    }
    return new Date(now.getTime() + 3 * 60 * 60 * 1000);
  } catch (e) {
    return new Date(now.getTime() + 3 * 60 * 60 * 1000);
  }
}

// --- Calcul de marge, dupliqué volontairement de src/App.jsx (effectiveUnitPrice / recipeMargin) ---
// Cette fonction serveur n'a pas accès aux closures React de l'app : garder cette logique
// synchronisée à la main si la formule de marge change un jour dans src/App.jsx.
function effectiveUnitPrice(ing) {
  const suppliers = ing?.suppliers || [];
  const sup = suppliers.find((s) => s.id === ing.selectedSupplierId) || suppliers[0];
  if (!sup) return 0;
  const loss = Math.min(Math.max(ing?.lossPercent || 0, 0), 95);
  return sup.price / (1 - loss / 100);
}
function recipeMarginPercent(recipe, ingredientsById, vatRate) {
  const cost = (recipe.lines || []).reduce((sum, line) => {
    const ing = ingredientsById.get(line.ingredientId);
    return sum + (ing ? effectiveUnitPrice(ing) * line.qty : 0);
  }, 0);
  const cpp = recipe.portions > 0 ? cost / recipe.portions : 0;
  const ht = (recipe.sellPrice || 0) / (1 + (vatRate ?? 10) / 100);
  return ht > 0 ? ((ht - cpp) / ht) * 100 : null;
}

const EMAIL_COPY = {
  fr: {
    inactivitySubject: "Ça fait un moment... 👋",
    inactivityBody:
      `<p>Ça fait plus de 3 semaines que tu n'as pas scanné de facture sur Chefup. Un petit scan aujourd'hui garde tes marges à jour.</p>`,
    marginSubject: "Des recettes sous ton objectif de marge",
    marginIntro: "Ces recettes sont actuellement sous ton objectif de marge :",
    trialEndedSubject: "Ton essai gratuit est terminé",
    trialEndedBody:
      `<p>Ton essai gratuit de 7 jours sur Chefup est terminé. Abonne-toi pour continuer à garder un œil sur tes marges, ton garde-manger et tes fiches recettes — rien n'a été perdu, tout t'attend.</p>`,
    welcomeSubject: "Une question, un souci avec le scan ?",
    welcomeBody:
      `<p>Salut,</p>
      <p>Je m'appelle Alexandre, c'est moi qui ai créé Chefup.</p>
      <p>Je voulais juste prendre de tes nouvelles maintenant que tu as créé ton compte. Si jamais tu bloques sur quelque chose — surtout sur le scanner de factures, c'est souvent l'étape la plus délicate au début — réponds directement à cet email, je te réponds moi-même.</p>
      <p>Pas besoin d'un vrai problème pour m'écrire, une simple question suffit.</p>
      <p>À bientôt,<br>Alexandre</p>`,
    cta: "Ouvrir Chefup",
    settingsHint: "Tu peux désactiver ces rappels à tout moment dans Chefup → Paramètres.",
  },
  es: {
    inactivitySubject: "Hace tiempo que no te vemos... 👋",
    inactivityBody:
      `<p>Hace más de 3 semanas que no escaneas ninguna factura en Chefup. Un escaneo rápido hoy mantiene tus márgenes al día.</p>`,
    marginSubject: "Recetas por debajo de tu margen objetivo",
    marginIntro: "Estas recetas están actualmente por debajo de tu margen objetivo:",
    trialEndedSubject: "Tu prueba gratuita ha terminado",
    trialEndedBody:
      `<p>Tu prueba gratuita de 7 días en Chefup ha terminado. Suscríbete para seguir controlando tus márgenes, tu almacén y tus fichas de recetas — no se ha perdido nada, todo te espera.</p>`,
    welcomeSubject: "¿Alguna duda o problema con el escaneo?",
    welcomeBody:
      `<p>Hola,</p>
      <p>Me llamo Alexandre, soy quien creó Chefup.</p>
      <p>Quería saber cómo te va ahora que has creado tu cuenta. Si te atascas en algo — sobre todo con el escáner de facturas, suele ser el paso más delicado al principio — responde directamente a este correo, te contesto yo mismo.</p>
      <p>No hace falta que sea un problema grave, con una simple pregunta basta.</p>
      <p>Hasta pronto,<br>Alexandre</p>`,
    cta: "Abrir Chefup",
    settingsHint: "Puedes desactivar estos avisos en cualquier momento en Chefup → Ajustes.",
  },
  en: {
    inactivitySubject: "It's been a while... 👋",
    inactivityBody:
      `<p>It's been over 3 weeks since you last scanned an invoice on Chefup. A quick scan today keeps your margins up to date.</p>`,
    marginSubject: "Recipes below your target margin",
    marginIntro: "These recipes are currently below your target margin:",
    trialEndedSubject: "Your free trial has ended",
    trialEndedBody:
      `<p>Your 7-day free trial on Chefup has ended. Subscribe to keep an eye on your margins, pantry and recipe sheets — nothing was lost, it's all waiting for you.</p>`,
    welcomeSubject: "Any question or issue with scanning?",
    welcomeBody:
      `<p>Hi,</p>
      <p>I'm Alexandre, I built Chefup.</p>
      <p>I just wanted to check in now that you've created your account. If you get stuck on anything — especially the invoice scanner, it's usually the trickiest part at first — just reply to this email, I'll answer you personally.</p>
      <p>You don't need a real problem to write to me, a simple question is enough.</p>
      <p>Talk soon,<br>Alexandre</p>`,
    cta: "Open Chefup",
    settingsHint: "You can turn off these reminders anytime in Chefup → Settings.",
  },
};

// Programme le mail d'accueil pour UN compte (déclenché par le client à la première connexion,
// voir src/Auth.jsx) — authentifié par le token de session de ce compte, pas par CRON_SECRET.
async function handleScheduleWelcome(req, res) {
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });
  const email = user.email;
  if (!email) return res.status(400).json({ error: "Compte sans email." });
  if (WELCOME_EMAIL_EXCLUDED.includes(email.toLowerCase())) {
    return res.status(200).json({ ok: true, skipped: "excluded" });
  }

  const admin = getSupabaseAdmin();
  const { data: rows } = await admin
    .from("kv_store").select("key,value").eq("user_id", user.id).in("key", ["notifState", "lang", "settings"]);
  const kv = {};
  for (const row of rows || []) {
    try { kv[row.key] = JSON.parse(row.value); } catch { kv[row.key] = null; }
  }
  if (kv.settings?.emailRemindersEnabled === false) {
    return res.status(200).json({ ok: true, skipped: "reminders_disabled" });
  }
  const notifState = kv.notifState || {};
  // Idempotent : ne programme/renvoie jamais deux fois pour le même compte, que ce soit via cet
  // appel client ou via le rattrapage du cron (voir plus bas) — l'un ou l'autre, jamais les deux.
  if (notifState.welcomeEmailScheduledAt || notifState.welcomeEmailSentAt) {
    return res.status(200).json({ ok: true, skipped: "already_scheduled" });
  }

  const lang = EMAIL_COPY[kv.lang] ? kv.lang : "fr";
  const copy = EMAIL_COPY[lang];
  const now = new Date();
  const timeZone = typeof req.body?.timeZone === "string" ? req.body.timeZone : "Europe/Paris";
  const sendAt = computeWelcomeSendAt(now, timeZone);

  try {
    await sendEmail(
      email, copy.welcomeSubject, wrapEmailHtml(copy.welcomeBody, copy.cta, copy.settingsHint),
      null, sendAt.toISOString(), process.env.CONTACT_EMAIL || undefined
    );
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }

  const nextState = { ...notifState, welcomeEmailScheduledAt: now.toISOString() };
  await admin.from("kv_store").upsert(
    { user_id: user.id, key: "notifState", value: JSON.stringify(nextState), updated_at: now.toISOString() },
    { onConflict: "user_id,key" }
  );
  return res.status(200).json({ ok: true, sendAt: sendAt.toISOString() });
}

export default async function handler(req, res) {
  if (req.method === "POST") return handleScheduleWelcome(req, res);

  const secretFromHeader = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const secretFromQuery = req.query?.secret;
  const providedSecret = secretFromQuery || secretFromHeader;
  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  const dryRun = req.query?.dryRun === "1" || req.query?.dryRun === "true";
  // Idem pour tester l'email de fin d'essai sans attendre 7 vrais jours.
  const forceTrialCheck = req.query?.forceTrialCheck === "1";

  const admin = getSupabaseAdmin();
  const now = new Date();
  const report = [];

  try {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    for (const user of usersData.users) {
      const email = user.email;
      if (!email) continue;

      const { data: rows, error: rowsError } = await admin
        .from("kv_store")
        .select("key,value")
        .eq("user_id", user.id)
        .in("key", ["settings", "lastScanAt", "notifState", "recipes", "ingredients", "lang"]);
      if (rowsError) throw rowsError;
      const kv = {};
      for (const row of rows || []) {
        try { kv[row.key] = JSON.parse(row.value); } catch { kv[row.key] = null; }
      }

      const settings = kv.settings || { vat: 10, minMargin: 75, emailRemindersEnabled: true };
      if (settings.emailRemindersEnabled === false) continue;

      const lang = EMAIL_COPY[kv.lang] ? kv.lang : "fr";
      const copy = EMAIL_COPY[lang];
      const notifState = kv.notifState || {};
      let nextState = { ...notifState };
      const actions = [];

      // --- Inactivité ---
      const scanAnchor = kv.lastScanAt ? new Date(kv.lastScanAt) : new Date(user.created_at);
      const daysSinceScan = daysBetween(scanAnchor, now);
      const daysSinceLastReminder = notifState.lastInactivityReminderAt
        ? daysBetween(new Date(notifState.lastInactivityReminderAt), now)
        : Infinity;
      if (daysSinceScan >= INACTIVITY_DAYS && daysSinceLastReminder >= INACTIVITY_RENOTIFY_DAYS) {
        actions.push("inactivity_reminder");
        if (!dryRun) {
          await sendEmail(email, copy.inactivitySubject, wrapEmailHtml(copy.inactivityBody, copy.cta, copy.settingsHint));
        }
        nextState.lastInactivityReminderAt = now.toISOString();
      }

      // --- Essai gratuit terminé sans abonnement (un seul envoi, jamais répété) ---
      const daysSinceSignup = daysBetween(new Date(user.created_at), now);
      let trialDebug = null;
      if ((forceTrialCheck || daysSinceSignup >= TRIAL_DAYS) && !notifState.trialEndedEmailSentAt) {
        const { data: sub } = await admin.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
        // Même règle que src/Billing.jsx : past_due reste toléré (Stripe relance le paiement
        // automatiquement), seuls canceled/unpaid/aucun abonnement comptent comme "pas abonné".
        const isActive = !!sub && ["active", "trialing", "past_due"].includes(sub.status);
        if (dryRun) trialDebug = { daysSinceSignup: Math.round(daysSinceSignup * 10) / 10, subscriptionStatus: sub?.status || null, isActive };
        if (!isActive) {
          actions.push("trial_ended_reminder");
          if (!dryRun) {
            await sendEmail(email, copy.trialEndedSubject, wrapEmailHtml(copy.trialEndedBody, copy.cta, copy.settingsHint));
          }
          nextState.trialEndedEmailSentAt = now.toISOString();
        }
      }

      // --- Mail d'accueil : rattrapage pour les comptes déjà existants (2026-08-24) ---
      // Le déclenchement normal se fait côté client à la première connexion (`handleScheduleWelcome`
      // ci-dessus, timing précis selon le fuseau horaire). Ce bloc ne sert qu'à rattraper les
      // comptes qui existaient déjà avant ce chantier (jamais programmé) ou dont le déclenchement
      // client aurait échoué (bloqueur de pub, onglet fermé trop vite...) — envoyé immédiatement,
      // sans logique de fuseau horaire (pas un "juste inscrit", la précision n'a plus de sens ici).
      if (!notifState.welcomeEmailScheduledAt && !notifState.welcomeEmailSentAt && !WELCOME_EMAIL_EXCLUDED.includes(email.toLowerCase())) {
        actions.push("welcome_backfill");
        if (!dryRun) {
          await sendEmail(email, copy.welcomeSubject, wrapEmailHtml(copy.welcomeBody, copy.cta, copy.settingsHint), null, null, process.env.CONTACT_EMAIL || undefined);
        }
        nextState.welcomeEmailSentAt = now.toISOString();
      }

      // --- Marge sous objectif (vérifiée chaque jour, mais seulement alertée après
      // MARGIN_CONFIRM_STREAK lectures consécutives sous l'objectif — voir le commentaire sur la
      // constante plus haut) ---
      let marginDebug = null;
      {
        const recipes = kv.recipes || [];
        const ingredients = kv.ingredients || [];
        const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
        const minMargin = settings.minMargin ?? 75;
        // L'objectif propre à la recette (`targetMargin`, éditable dans la fiche) prévaut sur le
        // réglage global s'il a été personnalisé — même règle que côté app (src/App.jsx).
        const allMargins = recipes.map((r) => ({
          id: r.id,
          name: r.name,
          margin: recipeMarginPercent(r, ingredientsById, settings.vat),
          target: r.targetMargin ?? minMargin,
        }));
        const belowTarget = allMargins.filter((r) => r.margin !== null && r.margin < r.target);

        // Série de lectures consécutives sous l'objectif, par recette — remise à zéro dès qu'une
        // recette repasse au-dessus (donc une seule série continue compte, pas un cumul global).
        const prevStreak = notifState.marginStreak || {};
        const newStreak = {};
        for (const r of belowTarget) newStreak[r.id] = (prevStreak[r.id] || 0) + 1;
        nextState.marginStreak = newStreak;

        const confirmedBelow = belowTarget.filter((r) => newStreak[r.id] >= MARGIN_CONFIRM_STREAK);
        if (dryRun) {
          marginDebug = {
            recipesCount: recipes.length, ingredientsCount: ingredients.length, minMargin, allMargins,
            streaks: newStreak, confirmedCount: confirmedBelow.length,
          };
        }

        const belowIds = confirmedBelow.map((r) => r.id).sort();
        const lastKnownIds = (notifState.marginLastKnownRecipeIds || []).slice().sort();
        const changed = JSON.stringify(belowIds) !== JSON.stringify(lastKnownIds);
        const daysSinceDigest = notifState.marginDigestLastSentAt
          ? daysBetween(new Date(notifState.marginDigestLastSentAt), now)
          : Infinity;

        nextState.marginLastKnownRecipeIds = belowIds;
        if (confirmedBelow.length > 0 && (changed || daysSinceDigest >= MARGIN_DIGEST_STALE_DAYS)) {
          actions.push(`margin_digest: ${confirmedBelow.map((r) => `${r.name} (${Math.round(r.margin)}%)`).join(", ")}`);
          if (!dryRun) {
            const list = confirmedBelow.map((r) => `<li>${r.name} — ${Math.round(r.margin)}%</li>`).join("");
            const body = `<p>${copy.marginIntro}</p><ul>${list}</ul>`;
            await sendEmail(email, copy.marginSubject, wrapEmailHtml(body, copy.cta, copy.settingsHint));
          }
          nextState.marginDigestLastSentAt = now.toISOString();
        }
      }

      if (!dryRun && JSON.stringify(nextState) !== JSON.stringify(notifState)) {
        await admin.from("kv_store").upsert(
          { user_id: user.id, key: "notifState", value: JSON.stringify(nextState), updated_at: now.toISOString() },
          { onConflict: "user_id,key" }
        );
      }

      if (actions.length || (dryRun && (marginDebug || trialDebug))) {
        report.push({ email, actions, daysSinceScan: Math.round(daysSinceScan * 10) / 10, marginDebug, trialDebug });
      }
    }

    return res.status(200).json({ dryRun, checkedUsers: usersData.users.length, notified: report });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
