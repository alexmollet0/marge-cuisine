// Rappels par email (inactivité + marge sous objectif), déclenchés une fois par jour par le
// cron Vercel (voir vercel.json) sur cette même route. Protégé par CRON_SECRET (Vercel l'envoie
// automatiquement en en-tête Authorization pour l'appel cron ; pour un test manuel, passer
// ?secret=... dans l'URL). Ajouter ?dryRun=1 pour voir ce qui SERAIT envoyé sans rien envoyer
// ni écrire dans Supabase — à utiliser en premier avant tout vrai envoi.
import { getSupabaseAdmin, sendEmail } from "./_lib.js";

const INACTIVITY_DAYS = 21; // 3 semaines sans scan
const INACTIVITY_RENOTIFY_DAYS = 14; // ne relance pas avant ce délai après un 1er rappel
const MARGIN_DIGEST_WEEKDAY = 1; // lundi (0=dimanche, UTC)
const MARGIN_DIGEST_STALE_DAYS = 28; // relance même sans changement après ce délai (~1 mois)
const TRIAL_DAYS = 7; // doit rester synchronisé avec TRIAL_DAYS dans src/Billing.jsx

function daysBetween(from, to) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
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
    cta: "Open Chefup",
    settingsHint: "You can turn off these reminders anytime in Chefup → Settings.",
  },
};

function wrapEmailHtml(bodyHtml, ctaLabel, settingsHint) {
  return `<div style="font-family:Arial,sans-serif;background:#F3EBDA;padding:24px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;">
      <div style="font-family:Arial,sans-serif;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:#6D28D9;margin-bottom:16px;">Chefup</div>
      <div style="color:#2B2620;font-size:14px;line-height:1.6;">${bodyHtml}</div>
      <a href="https://getchefup.com" style="display:inline-block;margin-top:20px;padding:10px 20px;border-radius:999px;background:linear-gradient(90deg,#8B5CF6,#22D3EE);color:#fff;text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${ctaLabel}</a>
      <p style="color:#2B2620;opacity:0.4;font-size:11px;margin-top:24px;">${settingsHint}</p>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  const secretFromHeader = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const secretFromQuery = req.query?.secret;
  const providedSecret = secretFromQuery || secretFromHeader;
  if (!process.env.CRON_SECRET || providedSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  const dryRun = req.query?.dryRun === "1" || req.query?.dryRun === "true";
  // Permet de tester la logique du digest marge un autre jour que le lundi (protégé par le
  // même secret que le reste de la route — jamais utilisé par le vrai cron automatique).
  const forceMarginCheck = req.query?.forceMarginCheck === "1";
  // Idem pour tester l'email de fin d'essai sans attendre 7 vrais jours.
  const forceTrialCheck = req.query?.forceTrialCheck === "1";

  const admin = getSupabaseAdmin();
  const now = new Date();
  const checkMarginToday = forceMarginCheck || now.getUTCDay() === MARGIN_DIGEST_WEEKDAY;
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

      // --- Marge sous objectif (digest hebdomadaire, un seul jour fixe) ---
      let marginDebug = null;
      if (checkMarginToday) {
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
        if (dryRun) {
          marginDebug = { recipesCount: recipes.length, ingredientsCount: ingredients.length, minMargin, allMargins };
        }

        const belowIds = belowTarget.map((r) => r.id).sort();
        const lastKnownIds = (notifState.marginLastKnownRecipeIds || []).slice().sort();
        const changed = JSON.stringify(belowIds) !== JSON.stringify(lastKnownIds);
        const daysSinceDigest = notifState.marginDigestLastSentAt
          ? daysBetween(new Date(notifState.marginDigestLastSentAt), now)
          : Infinity;

        nextState.marginLastKnownRecipeIds = belowIds;
        if (belowTarget.length > 0 && (changed || daysSinceDigest >= MARGIN_DIGEST_STALE_DAYS)) {
          actions.push(`margin_digest: ${belowTarget.map((r) => `${r.name} (${Math.round(r.margin)}%)`).join(", ")}`);
          if (!dryRun) {
            const list = belowTarget.map((r) => `<li>${r.name} — ${Math.round(r.margin)}%</li>`).join("");
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
        report.push({ email, actions, daysSinceScan: Math.round(daysSinceScan * 10) / 10, checkMarginToday, marginDebug, trialDebug });
      }
    }

    return res.status(200).json({ dryRun, checkedUsers: usersData.users.length, notified: report });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
