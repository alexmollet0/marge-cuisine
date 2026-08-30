// Éditeur guidé de carte digitale (2026-08-28).
//
// Motif d'origine : l'écran de réglages affichait TOUT d'un coup (publication, sections, logo,
// couleur, design, recettes, articles, QR) — jugé par l'utilisateur "beaucoup trop abstrait et
// dur à comprendre du premier coup". Objectif : une carte réellement créée en 5 minutes.
//
// [REFONTE le jour même, après retour utilisateur] La première version était un assistant
// LINÉAIRE à sens unique : impossible de créer une section, et surtout le nom du restaurant
// n'était enregistré qu'à la toute dernière étape — donc quitter l'onglet en cours de route
// perdait tout et redemandait le nom au retour ("il me dit quel nom a ton restaurant alors que
// je l'ai déjà marqué"). Corrigé sur trois points, sans rien perdre de ce qui marchait :
//   1. TOUT est enregistré au fil de l'eau (plus aucune saisie perdue en quittant l'onglet) ;
//   2. les 4 étapes sont navigables librement (pastilles cliquables) — c'est un éditeur, pas un
//      tunnel : on revient modifier un plat ou un prix quand on veut ;
//   3. on peut créer ses propres sections, et modifier/reclasser chaque plat déjà ajouté.
// La saisie en rafale (nom + prix + Entrée, focus qui revient) est conservée telle quelle :
// c'est elle qui rend la création rapide, et l'utilisateur l'a explicitement jugée "très bien".
import React, { useState, useRef, useEffect } from "react";
import { QrCode, Check, X, Plus, Loader2, Copy, ArrowRight, ArrowLeft, Store, UtensilsCrossed, Palette, Sparkles, Trash2 } from "lucide-react";
import { BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, MENU_DESIGNS, DESIGN_LABEL_KEYS, categoryLabel, defaultMenuCategories } from "./brand.js";
import { translateMenuText } from "./scannerComponents.jsx";
import { uid } from "./utils.js";

const STEP_ICONS = [Store, UtensilsCrossed, Palette, Sparkles];
const STEP_COUNT = 4;

// Ligne d'un plat déjà ajouté : tout est modifiable sur place (nom, prix, section) — c'était le
// manque principal de la première version, où un plat ne pouvait qu'être ajouté ou supprimé.
function DishRow({ item, categories, lang, t, onUpdate, onRemove }) {
  // Le prix est tenu en texte local pendant la frappe (sinon taper "3," puis "5" repasserait par
  // une valeur intermédiaire et effacerait la virgule), et n'est converti qu'à la sortie du champ.
  const [priceText, setPriceText] = useState(item.sellPrice ? String(item.sellPrice) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setPriceText(item.sellPrice ? String(item.sellPrice) : "");
  }, [item.sellPrice]);

  const commitPrice = () => {
    focused.current = false;
    const v = parseFloat(String(priceText).replace(",", ".")) || 0;
    if (v === item.sellPrice) return;
    // Historique écrit uniquement ici (fin de saisie), jamais à chaque touche — même règle que
    // partout ailleurs dans le projet depuis le bug de la fausse hausse de +70 % (2026-08-27).
    const history = item.priceHistory || [];
    const last = history[history.length - 1];
    const nextHistory = last && last.price === v
      ? history
      : [...history, { date: new Date().toISOString().slice(0, 10), price: v }].slice(-15);
    onUpdate({ sellPrice: v, priceHistory: nextHistory });
  };

  return (
    <div className="rounded-xl p-2 space-y-1.5" style={{ background: "rgba(0,0,0,0.25)" }}>
      <div className="flex items-center gap-1.5">
        <input
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none"
        />
        <input
          value={priceText}
          inputMode="decimal"
          onFocus={() => { focused.current = true; }}
          onChange={(e) => setPriceText(e.target.value)}
          onBlur={commitPrice}
          className="w-16 bg-black/25 rounded-lg px-2 py-1 text-white text-sm text-right outline-none"
        />
        <span className="text-white/40 text-xs shrink-0">€</span>
        <button onClick={onRemove} className="shrink-0 text-white/25 hover:text-[#EF4444] p-1">
          <Trash2 size={13} />
        </button>
      </div>
      <select
        value={item.menuCategory || ""}
        onChange={(e) => onUpdate({ menuCategory: e.target.value || null })}
        className="w-full bg-black/25 text-white/50 text-[10px] rounded-lg px-2 py-1 outline-none"
        style={{ colorScheme: "dark" }}
      >
        <option value="">{t("digitalMenuCategoryNone")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{categoryLabel(c, lang)}</option>
        ))}
      </select>
    </div>
  );
}

export function MenuWizard({ menuSettings, setMenuSettings, simpleItems, setSimpleItems, userId, lang, t, onOpenAdvanced }) {
  // Un chef qui revient sur son onglet veut modifier ses plats, pas retaper le nom de son
  // restaurant : on le dépose directement sur l'étape "plats" une fois la carte mise en place.
  const [step, setStep] = useState(menuSettings.setupDone ? 1 : 0);
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [newSection, setNewSection] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const dishNameRef = useRef(null);

  const categories = menuSettings.customCategories?.length ? menuSettings.customCategories : defaultMenuCategories();
  const [activeCat, setActiveCat] = useState(categories[1]?.id || categories[0]?.id || null);
  const publicUrl = userId ? `${window.location.origin}/menu/${userId}` : null;

  // Sections pré-remplies dès l'ouverture si le compte n'en a jamais eu — sinon l'étape "plats"
  // n'aurait aucune pastille à proposer et le chef devrait d'abord comprendre ce qu'est une
  // "section", exactement l'abstraction qu'on veut retirer de ce parcours.
  useEffect(() => {
    if (!menuSettings.customCategories?.length) {
      setMenuSettings((prev) => ({ ...prev, customCategories: defaultMenuCategories() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== 3 || !publicUrl) return;
    let cancelled = false;
    // Import dynamique, comme ailleurs dans le projet : cette librairie ne doit peser sur le
    // chargement que pour qui va vraiment jusqu'au QR code.
    import("qrcode")
      .then((mod) => (mod.default || mod).toDataURL(publicUrl, { width: 240, margin: 1, color: { dark: "#16130F", light: "#ffffff" } }))
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step, publicUrl]);

  const addDish = () => {
    const n = dishName.trim();
    if (!n) return;
    const price = parseFloat(String(dishPrice).replace(",", ".")) || 0;
    setSimpleItems((items) => [
      ...items,
      { id: uid(), name: n, sellPrice: price, menuCategory: activeCat, priceHistory: price > 0 ? [{ date: new Date().toISOString().slice(0, 10), price }] : [] },
    ]);
    setDishName("");
    setDishPrice("");
    dishNameRef.current?.focus();
  };

  const updateDish = (id, patch) => setSimpleItems((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeDish = (id) => setSimpleItems((items) => items.filter((i) => i.id !== id));

  // Création d'une section personnalisée (Pizzas, Sauces…) — impossible dans la première version,
  // il fallait sortir vers l'écran de réglages complet pour ça. Nom traduit automatiquement vers
  // les 2 autres langues, comme dans l'écran de réglages, pour que la carte publique reste
  // cohérente quelle que soit la langue choisie par le client.
  const addSection = async () => {
    const name = newSection.trim();
    if (!name) return;
    const cat = { id: uid(), name: { [lang]: name } };
    setMenuSettings((prev) => ({ ...prev, customCategories: [...(prev.customCategories?.length ? prev.customCategories : defaultMenuCategories()), cat] }));
    setNewSection("");
    setActiveCat(cat.id);
    const translated = await translateMenuText(name, lang);
    if (translated) {
      setMenuSettings((prev) => ({
        ...prev,
        customCategories: (prev.customCategories || []).map((c) => (c.id === cat.id ? { ...c, name: { ...c.name, ...translated } } : c)),
      }));
    }
  };

  const removeSection = (id) => {
    setMenuSettings((prev) => ({ ...prev, customCategories: (prev.customCategories || []).filter((c) => c.id !== id) }));
    setSimpleItems((items) => items.map((i) => (i.menuCategory === id ? { ...i, menuCategory: null } : i)));
    if (activeCat === id) setActiveCat(null);
  };

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const publish = () => {
    setMenuSettings((prev) => ({ ...prev, published: true, setupDone: true }));
  };

  const hasName = (menuSettings.restaurantName || "").trim().length > 0;
  const canNext = step === 0 ? hasName : true;
  const StepIcon = STEP_ICONS[step];
  const dishesInSection = simpleItems.filter((i) => !activeCat || i.menuCategory === activeCat);

  return (
    <div className="max-w-md mx-auto">
      {/* Pastilles de progression CLIQUABLES : c'est ce qui transforme le tunnel de la première
          version en éditeur. Une étape déjà franchie (ou tout, une fois la carte en place) est
          accessible directement — on revient modifier un prix sans rejouer tout le parcours. */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {Array.from({ length: STEP_COUNT }).map((_, i) => {
          const reachable = menuSettings.setupDone || hasName || i === 0;
          return (
            <button
              key={i}
              disabled={!reachable}
              onClick={() => reachable && setStep(i)}
              className="h-1.5 rounded-full transition-all disabled:cursor-not-allowed"
              style={{
                width: i === step ? 28 : 14,
                background: i <= step ? BRAND_SOLID : "rgba(255,255,255,0.15)",
              }}
              aria-label={t(`menuWizardStep${i + 1}Title`)}
            />
          );
        })}
      </div>

      <div className="rounded-2xl p-6 border border-white/10" style={{ background: "#26221C" }}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}>
            <StepIcon size={24} />
          </div>
          <h2 className="font-display text-white text-lg leading-snug">{t(`menuWizardStep${step + 1}Title`)}</h2>
          <p className="text-white/50 text-xs mt-1.5 leading-relaxed max-w-xs">{t(`menuWizardStep${step + 1}Hint`)}</p>
        </div>

        {/* ÉTAPE 1 — nom du restaurant. Enregistré à CHAQUE frappe directement dans menuSettings
            (donc sauvegardé automatiquement comme le reste des réglages) : c'est le correctif du
            bug "il me redemande le nom alors que je l'ai déjà mis". */}
        {step === 0 && (
          <input
            autoFocus
            value={menuSettings.restaurantName || ""}
            onChange={(e) => setMenuSettings((prev) => ({ ...prev, restaurantName: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter" && canNext) setStep(1); }}
            placeholder={t("menuWizardNamePlaceholder")}
            className="w-full rounded-xl px-4 py-3 text-base text-white text-center outline-none border border-white/10 focus:border-[#C9793B]"
            style={{ background: "rgba(0,0,0,0.25)" }}
          />
        )}

        {/* ÉTAPE 2 — les plats : saisie en rafale (conservée à l'identique) + modification */}
        {step === 1 && (
          <div>
            <div className="flex flex-wrap gap-1.5 justify-center mb-3">
              {categories.map((c) => (
                <span key={c.id} className="relative group">
                  <button
                    onClick={() => setActiveCat(c.id)}
                    className="pl-3 pr-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                    style={
                      activeCat === c.id
                        ? { background: BRAND_GRADIENT, color: "#fff" }
                        : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }
                    }
                  >
                    {categoryLabel(c, lang)}
                  </button>
                  <button
                    onClick={() => removeSection(c.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center hidden group-hover:flex"
                    style={{ background: "#EF4444", color: "#fff" }}
                    title={t("delete")}
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>

            {/* Création de section — le manque signalé par l'utilisateur. Volontairement discret :
                les 4 sections par défaut suffisent à la plupart, ça ne doit pas encombrer. */}
            <div className="flex items-center gap-1.5 mb-4">
              <input
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSection(); } }}
                placeholder={t("menuWizardNewSectionPlaceholder")}
                className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none border border-white/10 focus:border-[#C9793B]"
                style={{ background: "rgba(0,0,0,0.2)" }}
              />
              <button
                onClick={addSection}
                disabled={!newSection.trim()}
                className="shrink-0 text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded-lg border border-white/20 text-white/60 hover:border-white/40 disabled:opacity-30"
              >
                {t("digitalMenuCategoryAdd")}
              </button>
            </div>

            <div className="flex items-center gap-1.5 mb-2">
              <input
                ref={dishNameRef}
                autoFocus
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDish(); } }}
                placeholder={t("menuWizardDishPlaceholder")}
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-base text-white outline-none border border-white/10 focus:border-[#C9793B]"
                style={{ background: "rgba(0,0,0,0.25)" }}
              />
              <input
                value={dishPrice}
                inputMode="decimal"
                onChange={(e) => setDishPrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDish(); } }}
                placeholder="€"
                className="w-20 rounded-xl px-3 py-2.5 text-base text-white text-right outline-none border border-white/10 focus:border-[#C9793B]"
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
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {(activeCat ? dishesInSection : simpleItems).map((it) => (
                  <DishRow
                    key={it.id}
                    item={it}
                    categories={categories}
                    lang={lang}
                    t={t}
                    onUpdate={(patch) => updateDish(it.id, patch)}
                    onRemove={() => removeDish(it.id)}
                  />
                ))}
                {activeCat && dishesInSection.length === 0 && (
                  <p className="text-white/25 text-[11px] text-center py-3">{t("menuWizardEmptySection")}</p>
                )}
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
                      sur le vrai fond du design. Volontairement abstrait — un vrai rendu miniature
                      serait illisible à cette taille. */}
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

        {/* ÉTAPE 4 — QR code, lien, publication */}
        {step === 3 && (
          <div className="flex flex-col items-center">
            <div className="rounded-2xl p-3 bg-white mb-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code" className="w-40 h-40 block" />
              ) : publicUrl ? (
                <div className="w-40 h-40 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-black/30" />
                </div>
              ) : (
                // Sans identifiant de session, pas de QR possible : sans ce garde-fou l'écran
                // resterait sur un spinner infini et le chef croirait à un plantage.
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

            {/* Interrupteur de publication toujours visible ici (avant : la carte n'était publiée
                qu'en cliquant le bouton final, sans jamais pouvoir la dépublier depuis l'assistant). */}
            <label className="w-full flex items-start gap-2.5 cursor-pointer rounded-xl px-3 py-2.5 mb-3" style={{ background: "rgba(0,0,0,0.25)" }}>
              <input
                type="checkbox"
                checked={!!menuSettings.published}
                onChange={(e) => setMenuSettings((prev) => ({ ...prev, published: e.target.checked, setupDone: true }))}
                className="mt-0.5 shrink-0"
              />
              <span>
                <span className="text-xs text-white/80 block font-semibold">{t("digitalMenuPublishLabel")}</span>
                <span className="text-[10px] text-white/40 block mt-0.5">{t("digitalMenuPublishHint")}</span>
              </span>
            </label>

            <a href={publicUrl ? `${publicUrl}?preview=1` : "#"} className="text-[11px] text-white/45 hover:text-white/80 underline">
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
          {step < STEP_COUNT - 1 ? (
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
              onClick={publish}
              disabled={!!menuSettings.published}
              className="flex-1 py-3 rounded-full font-display uppercase text-xs tracking-wide font-semibold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              {menuSettings.published ? <><Check size={14} /> {t("menuWizardPublished")}</> : <><QrCode size={14} /> {t("menuWizardPublish")}</>}
            </button>
          )}
        </div>

        {/* Accès aux réglages fins (logo, couleur d'accent, recettes sur la carte, traductions) —
            l'assistant couvre volontairement le parcours courant, pas la totalité des options. */}
        <button onClick={onOpenAdvanced} className="w-full mt-3 text-[11px] text-white/30 hover:text-white/60">
          {t("menuWizardAdvanced")}
        </button>
      </div>
    </div>
  );
}
