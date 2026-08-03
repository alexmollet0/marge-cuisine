import { getStripe, getSupabaseAdmin } from "./_lib.js";

// bodyParser désactivé : la vérification de signature Stripe a besoin du corps brut de la
// requête (non ré-encodé par un parseur JSON), sinon la signature ne correspond jamais.
export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Met à jour la table subscriptions à partir d'un objet Subscription Stripe, toujours retrouvé
// par stripe_customer_id (jamais par un user_id, que Stripe ne connaît pas) — le lien
// customer -> user_id a été posé une fois pour toutes à la création du customer, dans
// create-checkout-session.js.
async function syncSubscription(supabaseAdmin, subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  await supabaseAdmin
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Méthode non autorisée");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("Webhook non configuré côté serveur.");

  const stripe = getStripe();
  let event;
  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, req.headers["stripe-signature"], secret);
  } catch (err) {
    return res.status(400).send(`Signature webhook invalide: ${err.message}`);
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscription(supabaseAdmin, subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(supabaseAdmin, event.data.object);
        break;
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
