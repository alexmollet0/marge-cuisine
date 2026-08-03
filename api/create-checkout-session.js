import { getStripe, getSupabaseAdmin, requireUser } from "./_lib.js";

// Crée une session Stripe Checkout pour l'abonnement Chefup (39€/mois, sans période d'essai
// côté Stripe : l'essai de 7 jours sans carte est géré côté app à partir de la date
// d'inscription Supabase — voir src/Billing.jsx). Le client Stripe est toujours créé/retrouvé
// via un lien stocké côté serveur (table subscriptions), jamais recréé à la volée à chaque
// appel, pour que le webhook puisse toujours retrouver le bon utilisateur ensuite.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: "Stripe n'est pas encore configuré côté serveur." });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });

  const stripe = getStripe();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

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

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
