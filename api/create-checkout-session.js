import { getStripe, getSupabaseAdmin, requireUser, getFoundingState, isInternalEmail, TRIAL_DAYS } from "./_lib.js";

// Deux rôles dans un seul fichier — le plan Hobby Vercel plafonne à 12 fonctions serverless et ce
// projet y est exactement (voir CLAUDE.md) : aucun nouvel endpoint possible sans en fusionner un.
//
// GET  : renvoie l'état d'abonnement/offre de lancement du compte connecté (suis-je fondateur ?
//        combien de places restent ? combien de jours d'essai ?) — lu par src/Billing.jsx pour le
//        bandeau d'essai et l'écran de fin d'essai. Ne crée rien côté Stripe.
// POST : crée la session Stripe Checkout et choisit le tarif à appliquer.
//
// Tarification (2026-08-26) : tarif normal `STRIPE_PRICE_ID`, tarif fondateur
// `STRIPE_FOUNDING_PRICE_ID` (29€/mois) pour les 50 premiers comptes qui s'abonnent AVANT la fin de
// leur essai. Le verrouillage "à vie" ne demande aucun code : Stripe garde le prix d'origine d'un
// abonnement tant qu'on ne le change pas, donc un fondateur reste à 29€ tant qu'il ne résilie pas.
// Si `STRIPE_FOUNDING_PRICE_ID` n'est pas configuré, on retombe silencieusement sur le tarif normal
// — jamais d'échec de paiement à cause de l'offre.
//
// L'essai de 7 jours reste géré côté app (pas de période d'essai Stripe, pas de carte demandée).
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });

  const supabaseAdmin = getSupabaseAdmin();

  // État de l'offre (mis en cache 20s dans getFoundingState, voir _lib.js — c'était l'essentiel de
  // la lenteur signalée sur le bouton "S'abonner"). Lancé AVANT tout `await`, en parallèle du
  // reste du travail de cette requête (jamais attendu seul) : sur GET, en parallèle de la lecture
  // de `trialStartOverride` ; sur POST, en parallèle de la vérification "client Stripe déjà
  // existant" — aucune des deux ne dépend de l'offre de lancement. Best-effort : si ce calcul
  // échoue, l'offre est simplement considérée comme indisponible et le paiement continue.
  const foundingPromise = getFoundingState(supabaseAdmin).catch((e) => {
    console.error("[checkout] calcul de l'offre de lancement impossible", e);
    return { holders: new Set(), remaining: 0, total: 0 };
  });

  if (req.method === "GET") {
    const overridePromise = supabaseAdmin
      .from("kv_store").select("value").eq("user_id", user.id).eq("key", "trialStartOverride").maybeSingle()
      .then(({ data }) => data)
      .catch(() => null);
    const [founding, override] = await Promise.all([foundingPromise, overridePromise]);
    const isFounder = founding.holders.has(user.id) && !!process.env.STRIPE_FOUNDING_PRICE_ID;

    let trialStart = user.created_at;
    if (override?.value) {
      try {
        const parsed = JSON.parse(override.value);
        if (parsed && new Date(parsed) > new Date(trialStart)) trialStart = parsed;
      } catch (e) {}
    }
    const trialDaysLeft = Math.ceil(
      (new Date(trialStart).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)
    );
    return res.status(200).json({
      founder: isFounder,
      // Comptes internes (2026-08-26) : accès permanent à l'app, jamais de paywall. Décidé ici,
      // côté serveur, à partir de l'email vérifié du token — jamais d'un drapeau envoyé par le
      // client, qui serait trivial à falsifier pour obtenir un abonnement gratuit.
      internal: isInternalEmail(user.email),
      spotsRemaining: founding.remaining,
      spotsTotal: founding.total,
      trialDaysLeft,
    });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: "Stripe n'est pas encore configuré côté serveur." });
  }

  const stripe = getStripe();

  try {
    // Lancée EN PARALLÈLE de foundingPromise (ci-dessus, démarrée avant tout `await` de cette
    // requête) plutôt qu'après : c'est ce qui économise l'aller-retour réseau supplémentaire sur
    // le chemin du clic "S'abonner".
    const existingPromise = supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const [founding, { data: existing }] = await Promise.all([foundingPromise, existingPromise]);
    const isFounder = founding.holders.has(user.id) && !!process.env.STRIPE_FOUNDING_PRICE_ID;

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("subscriptions")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId, status: "none", updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    }

    const foundingPriceId = process.env.STRIPE_FOUNDING_PRICE_ID;
    const useFoundingPrice = isFounder && !!foundingPriceId;
    const priceId = useFoundingPrice ? foundingPriceId : process.env.STRIPE_PRICE_ID;

    // Trace du tarif proposé, écrite AVANT la redirection vers Stripe : c'est ce qui permet
    // ensuite de savoir qu'un abonné occupe une place fondateur définitivement (getFoundingState
    // ne compte une place comme confirmée que si ce drapeau existe ET que l'abonnement est actif).
    // Réécrite à chaque tentative de paiement, donc toujours alignée sur la dernière décision —
    // un paiement abandonné puis repris plus tard sera réévalué avec les places réellement libres.
    if (useFoundingPrice) {
      await supabaseAdmin.from("kv_store").upsert(
        {
          user_id: user.id,
          key: "foundingMember",
          value: JSON.stringify({ at: new Date().toISOString(), priceId }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      );
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url, founder: useFoundingPrice });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
