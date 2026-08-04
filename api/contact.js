// Formulaire de contact/réclamation in-app — envoie un email via Resend à l'adresse de
// l'utilisateur (jamais exposée au client, lue uniquement depuis CONTACT_EMAIL côté serveur ;
// changeable à tout moment sans toucher au code). Nécessite un utilisateur authentifié : l'email
// du compte vient du token Supabase vérifié, jamais d'un champ envoyé par le client (impossible à
// falsifier pour se faire passer pour un autre utilisateur).
import { requireUser, sendEmail } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });

  const { message, attachment } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message vide." });
  }
  const trimmed = message.trim().slice(0, 5000);

  const contactEmail = process.env.CONTACT_EMAIL;
  if (!contactEmail) {
    return res.status(500).json({ error: "Adresse de réception non configurée côté serveur (CONTACT_EMAIL)." });
  }

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#2B2620;">
    <p><strong>Compte :</strong> ${user.email}</p>
    <p><strong>Message :</strong></p>
    <p style="white-space:pre-wrap;background:#F3EBDA;padding:12px;border-radius:8px;">${trimmed.replace(/</g, "&lt;")}</p>
  </div>`;

  // Pièce jointe optionnelle (ex: capture d'écran d'un bug) — déjà compressée côté client, on la
  // transmet telle quelle à Resend, sans jamais l'écrire nulle part côté serveur.
  let attachments;
  if (attachment && attachment.base64 && typeof attachment.base64 === "string") {
    const ext = (attachment.mediaType || "image/jpeg").split("/")[1] || "jpg";
    attachments = [{ filename: attachment.fileName || `capture.${ext}`, content: attachment.base64 }];
  }

  try {
    await sendEmail(contactEmail, `Chefup — message de ${user.email}`, html, attachments);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Erreur serveur inattendue." });
  }
}
