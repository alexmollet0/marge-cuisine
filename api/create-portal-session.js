import { getStripe, getSupabaseAdmin, requireUser } from "./_lib.js";

// Crée un lien vers le portail client Stripe (annuler, changer de carte, voir les factures) —
// évite d'avoir à coder cette UI nous-mêmes.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe n'est pas encore configuré côté serveur." });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });

  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // stripe_customer_id seul ne suffit pas : create-checkout-session.js crée déjà un client
    // Stripe AVANT même que le paiement soit tenté, donc un client peut exister sans qu'aucun
    // abonnement n'ait jamais été réellement créé (ex : session Checkout ouverte puis abandonnée).
    // stripe_subscription_id n'est écrit que par le webhook, une fois un abonnement confirmé —
    // c'est le vrai signal qu'il y a quelque chose à gérer dans le portail.
    if (!sub?.stripe_customer_id || !sub?.stripe_subscription_id) {
      // Code distinct (pas juste le message) pour que le frontend puisse basculer proprement vers
      // la création d'un abonnement (create-checkout-session.js) sans avoir à deviner à partir
      // d'un texte d'erreur, qui pourrait changer ou dépendre de la langue.
      return res.status(400).json({ error: "Aucun abonnement Stripe trouvé pour ce compte.", code: "no_subscription" });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: origin,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
