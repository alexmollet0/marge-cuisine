// Assistant guidé de création de carte digitale (2026-08-28).
//
// Motif : la version précédente affichait TOUT d'un coup sur un seul écran (publication,
// sections, logo, couleur, design, liste des recettes, articles simples, QR code) — jugée par
// l'utilisateur "beaucoup trop abstraite et dure à comprendre du premier coup". Objectif fixé :
// une carte réellement créée en 5 minutes, compréhensible en un coup d'œil.
//
// Principe : UNE seule question par écran, 4 étapes, impossible de se perdre. L'écran complet
// de réglages (DigitalMenuModal) reste accessible ensuite pour tout affiner — l'assistant ne
// remplace pas la gestion, il remplace seulement le premier contact.
import React, { useState, useRef, useEffect } from "react";
import { QrCode, Check, X, Plus, Loader2, Copy, ArrowRight, ArrowLeft, Store, UtensilsCrossed, Palette, Sparkles, Trash2 } from "lucide-react";
import { BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, MENU_DESIGNS, DESIGN_LABEL_KEYS, categoryLabel, defaultMenuCategories } from "./brand.js";
import { uid } from "./utils.js";

const STEP_ICONS = [Store, UtensilsCrossed, Palette, Sparkles];

export function MenuWizard({ menuSettings, setMenuSettings, simpleItems, setSimpleItems, userId, lang, t, onFinish }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(menuSettings.restaurantName || "");
  // Section courante : le chef en choisit une, tape tous ses plats de cette section d'affilée,
  // puis en change. C'est ce qui rend la saisie vraiment rapide — pas un menu déroulant à
  // rouvrir à chaque plat.
  const categories = menuSettings.customCategories?.length ? menuSettings.customCategories : defaultMenuCategories();
  const [activeCat, setActiveCat] = useState(categories[1]?.id || categories[0]?.id || null);
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const dishNameRef = useRef(null);

  const publicUrl = userId ? `${window.location.origin}/menu/${userId}` : null;

  // Sections pré-remplies dès l'ouverture si le compte n'en a jamais eu — sinon l'étape "plats"
  // n'aurait aucune pastille à proposer et le chef devrait d'abord comprendre ce qu'est une
  // "section", exactement le genre d'abstraction qu'on veut retirer de ce parcours.
  useEffect(() => {
    if (!menuSettings.customCategories?.length) {
      setMenuSettings((prev) => ({ ...prev, customCategories: defaultMenuCategories() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // QR code généré seulement à la dernière étape (import dynamique, comme ailleurs dans le projet :
  // cette librairie ne doit peser sur le chargement que pour qui va vraiment jusqu'au bout).
  useEffect(() => {
    if (step !== 3 || !publicUrl) return;
    let cancelled = false;
    import("qrcode")
      .then((mod) => (mod.default || mod).toDataURL(publicUrl, { width: 240, margin: 1, color: { dark: "#1B1815", light: "#ffffff" } }))
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step, publicUrl]);

  const addDish = () => {
    const n = dishName.trim();
    if (!n) return;
    const price = parseFloat(String(dishPrice).replace(",", ".")) || 0;
    setSimpleItems((items) => [...items, { id: uid(), name: n, sellPrice: price, menuCategory: activeCat, priceHistory: price > 0 ? [{ date: new Date().toISOString().slice(0, 10), price }] : [] }]);
    setDishName("");
    setDishPrice("");
    dishNameRef.current?.focus();
  };

  const removeDish = (id) => setSimpleItems((items) => items.filter((i) => i.id !== id));

  const finish = () => {
    setMenuSettings((prev) => ({ ...prev, restaurantName: name.trim(), published: true, setupDone: true }));
    onFinish();
  };

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? simpleItems.length > 0 : true;
  const StepIcon = STEP_ICONS[step];

  return (
    <div className="max-w-md mx-auto">
      {/* Progression : 4 pastilles, l'étape courante en couleur de marque. Un chef doit voir
          d'un coup d'œil où il en est et combien il reste — c'est ce qui rend un parcours
          "guidé" rassurant plutôt qu'interminable. */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === step ? 28 : 14,
              background: i <= step ? BRAND_SOLID : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>

      <div className="rounded-2xl p-6 border border-white/10" style={{ background: "#26221C" }}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}>
            <StepIcon size={24} />
          </div>
          <h2 className="font-display text-white text-lg leading-snug">{t(`menuWizardStep${step + 1}Title`)}</h2>
          <p className="text-white/50 text-xs mt-1.5 leading-relaxed max-w-xs">{t(`menuWizardStep${step + 1}Hint`)}</p>
        </div>

        {/* ÉTAPE 1 — nom du restaurant */}
        {step === 0 && (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canNext) setStep(1); }}
            placeholder={t("menuWizardNamePlaceholder")}
            className="w-full rounded-xl px-4 py-3 text-base text-white text-center outline-none border border-white/10 focus:border-[#8B5CF6]"
            style={{ background: "rgba(0,0,0,0.25)" }}
          />
        )}

        {/* ÉTAPE 2 — les plats, en rafale */}
        {step === 1 && (
          <div>
            <div className="flex flex-wrap gap-1.5 justify-center mb-4">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                  style={
                    activeCat === c.id
                      ? { background: BRAND_GRADIENT, color: "#fff" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {categoryLabel(c, lang)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mb-3">
              <input
                ref={dishNameRef}
                autoFocus
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDish(); } }}
                placeholder={t("menuWizardDishPlaceholder")}
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-base text-white outline-none border border-white/10 focus:border-[#8B5CF6]"
                style={{ background: "rgba(0,0,0,0.25)" }}
              />
              <input
                value={dishPrice}
                inputMode="decimal"
                onChange={(e) => setDishPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDish(); } }}
                placeholder="€"
                className="w-20 rounded-xl px-3 py-2.5 text-base text-white text-right outline-none border border-white/10 focus:border-[#8B5CF6]"
                style={{ background: "rgba(0,0,0,0.25)" }}
              />
              <button
                onClick={addDish}
                disabled={!dishName.trim()}
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-30 active:scale-90 transition"
                style={{ background: BRAND_GRADIENT, color: "#fff" }}
              >
                <Plus size={20} />
              </button>
            </div>
            <p className="text-white/25 text-[10px] text-center mb-4">{t("menuWizardDishTip")}</p>

            {simpleItems.length > 0 && (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {simpleItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(0,0,0,0.25)" }}>
                    <Check size={12} className="shrink-0" style={{ color: "#10B981" }} />
                    <span className="flex-1 min-w-0 truncate text-white/80">{it.name}</span>
                    <span className="text-white/40 shrink-0">{(it.sellPrice || 0).toFixed(2)}€</span>
                    <button onClick={() => removeDish(it.id)} className="shrink-0 text-white/25 hover:text-[#EF4444]">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 3 — le design */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            {MENU_DESIGNS.map((d) => {
              const selected = (menuSettings.design || "classic") === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setMenuSettings((prev) => ({ ...prev, design: d.id }))}
                  className="rounded-xl overflow-hidden border-2 transition-all active:scale-95"
                  style={{ borderColor: selected ? BRAND_SOLID : "rgba(255,255,255,0.1)" }}
                >
                  {/* Aperçu schématique : quelques barres qui évoquent un nom de plat + un prix,
                      sur le vrai fond du design. Volontairement abstrait mais dans les bonnes
                      couleurs — un vrai rendu miniature serait illisible à cette taille. */}
                  <div className="p-3 h-20 flex flex-col justify-center gap-1.5" style={{ background: d.bg }}>
                    {[0.75, 0.55, 0.65].map((w, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${w * 70}%`, background: d.id === "elegant" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)" }} />
                        <div className="h-1.5 w-4 rounded-full" style={{ background: BRAND_SOLID, opacity: 0.8 }} />
                      </div>
                    ))}
                  </div>
                  <div className="py-2 text-[11px] font-semibold flex items-center justify-center gap-1" style={{ background: "rgba(0,0,0,0.25)", color: selected ? BRAND_SOLID : "rgba(255,255,255,0.6)" }}>
                    {selected && <Check size={11} />}
                    {t(DESIGN_LABEL_KEYS[d.id])}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ÉTAPE 4 — c'est prêt : QR code + lien */}
        {step === 3 && (
          <div className="flex flex-col items-center">
            {/* `publicUrl` dépend de l'identifiant de session : sans lui, pas de QR possible.
                Sans ce garde-fou, l'écran resterait bloqué sur un spinner qui tourne à l'infini —
                le chef croirait à un plantage alors que sa carte est bien enregistrée. */}
            <div className="rounded-2xl p-3 bg-white mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code" className="w-40 h-40 block" />
              ) : publicUrl ? (
                <div className="w-40 h-40 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-black/30" />
                </div>
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-center px-3">
                  <span className="text-black/40 text-[11px] leading-relaxed">{t("menuWizardQrLater")}</span>
                </div>
              )}
            </div>

            {publicUrl && (
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 text-[11px] text-white/60 border border-white/10 hover:border-white/25"
                style={{ background: "rgba(0,0,0,0.25)" }}
              >
                <span className="flex-1 min-w-0 truncate text-left">{publicUrl}</span>
                {copied ? <Check size={13} style={{ color: "#10B981" }} /> : <Copy size={13} />}
              </button>
            )}

            <a
              href={publicUrl ? `${publicUrl}?preview=1` : "#"}
              className="w-full text-center text-[11px] text-white/45 hover:text-white/80 underline mb-1"
            >
              {t("menuWizardPreview")}
            </a>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-2 mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="shrink-0 px-3 py-3 rounded-full text-white/50 hover:text-white border border-white/15"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="flex-1 py-3 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-30 active:scale-95 transition"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              {t("menuWizardNext")} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex-1 py-3 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 active:scale-95 transition"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              <QrCode size={14} /> {t("menuWizardPublish")}
            </button>
          )}
        </div>

        {/* Sortie toujours possible : un parcours guidé qui enferme est pire que pas de parcours
            du tout. Mène directement à l'écran de réglages complet. */}
        <button onClick={onFinish} className="w-full mt-3 text-[11px] text-white/30 hover:text-white/60">
          {t("menuWizardSkip")}
        </button>
      </div>
    </div>
  );
}
