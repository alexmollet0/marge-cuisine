// Composants du scanner de factures et de la carte digitale (choix de nom, calculateur de
// prix, éditeurs de menu, carte de vérification scan) — extrait de App.jsx le 2026-08-28.
import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, Check, ChefHat, ChevronDown, ChevronUp, Info, Loader2, Package, Palette,
  Pencil, Percent, Plus, QrCode, Search, Tags, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import { unitDisplayLabel } from "./catalog.js";
import {
  BRAND_SOLID, BRAND_GRADIENT, TIER_COLORS, MENU_ACCENT_COLORS, MENU_DESIGNS,
  DESIGN_LABEL_KEYS, categoryLabel, defaultMenuCategories, priceChangeVisual, lightRawLabel,
} from "./brand.js";
import { NumField, IngredientPicker } from "./formComponents.jsx";
import { Logo } from "./Logo.jsx";
import { uid } from "./utils.js";

export function ScanNameChoice({ item, guessedIng, ingredientDisplayName, onUpdate, t }) {
  if (!guessedIng) return null;
  const matchedName = ingredientDisplayName(guessedIng);
  const proposedName = item.name;
  const showRename = !!proposedName && proposedName !== matchedName;
  const selected = item.assignTo === "new" ? "new" : item.renameOnImport ? "rename" : "keep";

  const Option = ({ id, label, hint, hintColor, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left"
      style={{
        background: selected === id ? `${BRAND_SOLID}22` : "rgba(255,255,255,0.05)",
        border: `1px solid ${selected === id ? BRAND_SOLID : "rgba(255,255,255,0.12)"}`,
      }}
    >
      <span
        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center mt-0.5"
        style={{ border: `2px solid ${selected === id ? BRAND_SOLID : "rgba(255,255,255,0.3)"}` }}
      >
        {selected === id && <span className="w-2 h-2 rounded-full" style={{ background: BRAND_SOLID }} />}
      </span>
      <span className="min-w-0">
        <span className={`block text-xs font-medium ${selected === id ? "text-white" : "text-white/60"}`}>{label}</span>
        {hint && (
          <span className="block text-[10px] mt-0.5" style={{ color: hintColor || "rgba(255,255,255,0.3)" }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="text-[9px] uppercase tracking-wide text-white/35">{t("scanChooseNameLabel")}</div>
      <Option
        id="keep"
        label={matchedName}
        hint={t("scanExistingLabel")}
        onClick={() => onUpdate({ assignTo: item.guessedMatchId, renameOnImport: false })}
      />
      {showRename && (
        <Option
          id="rename"
          label={proposedName}
          hint={t("scanRenameWarning")(matchedName)}
          hintColor={TIER_COLORS.mid}
          onClick={() => onUpdate({ assignTo: item.guessedMatchId, renameOnImport: true })}
        />
      )}
      <Option
        id="new"
        label={t("scanCreateSeparateLabel")(proposedName || "?")}
        hint={t("scanCreateSeparateHint")}
        onClick={() => onUpdate({ assignTo: "new", renameOnImport: false })}
      />
    </div>
  );
}

// Convertit une contenance (poids ou volume d'une pièce) vers l'unité de base utilisée pour
// le prix au kg/L — kg et g se ramènent au kg, L et cl se ramènent au L.
const CALC_CONTENT_UNITS = {
  kg: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  L: { base: "L", factor: 1 },
  cl: { base: "L", factor: 0.01 },
  // Pour les produits vendus directement à la pièce (pas de poids/volume à convertir, ex: les
  // 3 PCE d'un plateau sans poids indiqué) : "1 pièce" vaut simplement 1, le prix final reste
  // exprimé en €/pièce sans passer par un faux calcul kg/L.
  pièce: { base: "pièce", factor: 1 },
};

// Calculateur guidé pour les lignes "prix par pièce/sachet/colis" sans poids ni volume indiqué
// (ex: "3 PCE x 28.90€" sans préciser si le sachet fait 800g ou 1kg) — évite d'imposer un calcul
// mental à l'utilisateur : il indique juste la contenance d'une pièce, le prix au kg/L en découle
// automatiquement et remplace le prix à 0€ imposé par défaut tant que rien n'est calculable.
export function PricingCalculator({ item, onUpdate, t }) {
  const content = item.calcContent ?? 1;
  const contentUnit = item.calcContentUnit || "kg";
  const sourcePrice = item.printedUnitPriceHT || 0;
  const { base, factor } = CALC_CONTENT_UNITS[contentUnit];
  const baseContent = content * factor;
  // Arrondi à 4 décimales : sans lui, une division comme 11.80/3 affiche un flottant JS à
  // rallonge (ex: 0.33749999999999997) — bug réel trouvé en test (2026-08), calcul juste,
  // arrondi manquant.
  const computedPrice = baseContent > 0 ? Math.round((sourcePrice / baseContent) * 10000) / 10000 : 0;

  const recompute = (patch) => {
    const next = { calcContent: content, calcContentUnit: contentUnit, printedUnitPriceHT: sourcePrice, ...patch };
    const { base: nextBase, factor: nextFactor } = CALC_CONTENT_UNITS[next.calcContentUnit];
    const nextBaseContent = next.calcContent * nextFactor;
    const nextPrice = nextBaseContent > 0 ? Math.round((next.printedUnitPriceHT / nextBaseContent) * 10000) / 10000 : 0;
    onUpdate({ ...next, unit: nextBase, unitPriceHT: nextPrice });
  };

  // Le prix affiché par le calculateur (même la valeur par défaut, avant toute modification de
  // l'utilisateur) doit toujours être celui utilisé pour l'import — sinon "Valider" garde le
  // 0.00€ initial tant que l'utilisateur n'a pas lui-même touché un champ du calculateur.
  useEffect(() => {
    if (item.unitPriceHT !== computedPrice || item.unit !== base) {
      onUpdate({ calcContent: content, calcContentUnit: contentUnit, unit: base, unitPriceHT: computedPrice });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedPrice, base]);

  return (
    <div className="rounded-lg p-2.5 text-[11px] space-y-2" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={12} className="shrink-0" /> {t("scanPricingUnknown")}
      </div>
      <div className="text-white/60">{t("scanPricingUnknownHint")}</div>

      <div className="flex items-center gap-1.5">
        <span className="text-white/50 shrink-0">{t("scanCalcSourcePrice")}</span>
        <NumField
          value={sourcePrice}
          onChange={(v) => recompute({ printedUnitPriceHT: v })}
          className="w-16 bg-black/20 rounded px-1.5 py-1 text-right outline-none font-mono text-white"
        />
        <span className="text-white/50">€</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-white/50 shrink-0">{t("scanCalcContentLabel")}</span>
        <NumField
          value={content}
          onChange={(v) => recompute({ calcContent: v })}
          className="w-16 bg-black/20 rounded px-1.5 py-1 text-right outline-none font-mono text-white"
        />
        <select
          value={contentUnit}
          onChange={(e) => recompute({ calcContentUnit: e.target.value })}
          className="bg-black/20 rounded px-1.5 py-1 outline-none text-white"
          style={{ colorScheme: "dark" }}
        >
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="L">L</option>
          <option value="cl">cl</option>
          <option value="pièce">pc</option>
        </select>
      </div>

      <div className="text-white font-semibold text-sm">{t("scanCalcResult")(computedPrice.toFixed(2), base)}</div>
    </div>
  );
}

// Redimensionne un logo uploadé en petit PNG (garde la transparence, contrairement à
// compressImageFile qui exporte en JPEG pour les photos de facture) — stocké directement en
// base64 dans menuSettings.logo (kv_store), pas de bucket de fichiers dédié dans ce projet, plus
// simple à mettre en place pour une v1 et une image de logo reste petite une fois compressée.
async function compressLogoFile(file) {
  const maxDim = 240;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

// Appelle api/translate-menu-description.js (authentifié) — partagé par MenuRecipeRow (description
// d'un plat) et DigitalMenuModal (nom d'une section personnalisée). Sans `targetLang`, traduit vers
// les 2 langues restantes d'un coup. Renvoie null en cas d'échec (réseau, IA indisponible...) —
// jamais d'exception qui remonterait jusqu'à casser l'UI pour une simple traduction manquée.
export async function translateMenuText(text, sourceLang, targetLang) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/translate-menu-description", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// Une ligne "recette" du panneau carte digitale : catégorie de menu (parmi les sections définies
// par le restaurateur) + une SEULE description à écrire (dans la langue de l'app du
// restaurateur). Traduction 100% automatique (2026-08-18, v4) : dès que le restaurateur arrête de
// taper une seconde, les 2 autres langues se remplissent toutes seules en arrière-plan — deux
// versions précédentes (un bouton générique, puis un clic par drapeau) ont toutes les deux été
// jugées pas claires par l'utilisateur ("je n'arrive pas à traduire", "ça n'apporte rien en plus,
// juste ça traduit et c'est ce qu'on veut de base"). Même principe de debounce que
// `useDebouncedSave` (sauvegarde des données), mais local au composant : l'effet se relance à
// chaque frappe et l'ancien minuteur est annulé par le cleanup, donc un seul appel part réellement
// une fois la frappe arrêtée.
// [REFONTE 2026-08-30] Une recette n'arrive plus ici que si elle est DÉJÀ sur la carte
// (menuIncluded, ajoutée soit depuis sa fiche — voir App.jsx — soit via le sélecteur de recette
// existante, RecipePickerButton plus bas) : plus de case à cocher, cette ligne ne fait plus que
// gérer sa section/description et proposer de la retirer (croix), exactement comme une ligne
// d'article simple — même style, pour que les deux se lisent comme UNE seule liste de plats,
// plus deux systèmes séparés (retour direct de l'utilisateur : "trop compliqué").
export function MenuRecipeRow({ r, lang, t, categories, onUpdate, onRemove }) {
  const [translating, setTranslating] = useState(false);
  const [translateErr, setTranslateErr] = useState(false);
  const [showDescription, setShowDescription] = useState(!!r.menuDescription?.[lang]);
  const description = r.menuDescription?.[lang] || "";

  useEffect(() => {
    if (!description.trim()) return;
    const timer = setTimeout(async () => {
      setTranslating(true);
      setTranslateErr(false);
      const data = await translateMenuText(description, lang);
      if (data) onUpdate({ menuDescription: { ...(r.menuDescription || {}), ...data } });
      else setTranslateErr(true);
      setTranslating(false);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, lang]);

  // Traduction automatique du NOM du plat (2026-08-19) — jusqu'ici seule la description était
  // traduite, mais un client étranger a d'abord besoin de comprendre le nom du plat lui-même
  // ("Faux filet sauce poivre") pour se décider, pas seulement sa description. `r.name` reste la
  // seule vérité utilisée partout ailleurs dans l'app (onglet Recettes, impression...) — seule une
  // copie traduite (`menuNameI18n`) est calculée pour l'affichage public. `_src` mémorise le texte
  // à partir duquel la traduction a été faite, pour ne jamais retraduire inutilement à chaque
  // réouverture de cette fenêtre tant que le nom de la recette n'a pas changé depuis.
  useEffect(() => {
    if (!r.name?.trim() || r.menuNameI18n?._src === r.name) return;
    translateMenuText(r.name, lang).then((data) => {
      if (data) onUpdate({ menuNameI18n: { ...data, _src: r.name } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.name, lang, r.menuNameI18n?._src]);

  return (
    <div className="rounded-lg p-2" style={{ background: "#16130F" }}>
      <div className="flex items-center gap-1.5">
        <ChefHat size={12} className="shrink-0 text-white/25" title={t("digitalMenuFromRecipeHint")} />
        <span className="flex-1 min-w-0 text-white text-[11px] truncate">{r.name}</span>
        <select
          value={r.menuCategory || ""}
          onChange={(e) => onUpdate({ menuCategory: e.target.value || null })}
          className="bg-black/20 text-white/60 text-[10px] rounded px-1 py-1 outline-none shrink-0"
          style={{ colorScheme: "dark" }}
        >
          <option value="">{t("digitalMenuCategoryNone")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{categoryLabel(c, lang)}</option>
          ))}
        </select>
        <span className="text-white text-[11px] font-mono shrink-0 w-14 text-right">{(r.menuPrice ?? r.sellPrice ?? 0).toFixed(2)}€</span>
        <button onClick={onRemove} className="shrink-0 text-white/30 hover:text-[#EF4444]" title={t("digitalMenuRemoveFromMenu")}>
          <X size={12} />
        </button>
      </div>
      {showDescription ? (
        <div className="mt-1.5">
          <textarea
            value={description}
            onChange={(e) => onUpdate({ menuDescription: { ...(r.menuDescription || {}), [lang]: e.target.value } })}
            placeholder={t("digitalMenuDescriptionPlaceholder")}
            rows={2}
            className="w-full bg-black/20 text-white/80 text-[11px] rounded px-2 py-1.5 outline-none resize-none"
          />
          {translating && (
            <span className="flex items-center gap-1 text-[10px] text-white/40 mt-0.5">
              <Loader2 size={10} className="animate-spin" /> {t("digitalMenuTranslating")}
            </span>
          )}
          {translateErr && <p className="text-[10px] text-[#EF4444] mt-0.5">{t("digitalMenuTranslateError")}</p>}
        </div>
      ) : (
        <button onClick={() => setShowDescription(true)} className="text-[10px] text-white/25 hover:text-white/50 mt-1 ml-4">
          + {t("digitalMenuDescriptionPlaceholder")}
        </button>
      )}
    </div>
  );
}

// Ligne d'un article simple déjà créé : nom/section/prix éditables en place, coût d'achat replié
// par défaut (n'apparaît que si on clique "+ ajouter un coût") — la plupart des restaurateurs n'en
// ont pas besoin ici, l'intérêt de ces articles est la rapidité, pas le suivi de marge. Prix et
// coût utilisent `NumField` (déjà utilisé partout ailleurs pour les nombres décimaux) plutôt qu'un
// input brut — un input qui reconvertit `parseFloat` à chaque frappe empêche de taper "0,20" (dès
// que le "0" est suivi du point, `parseFloat("0.")` vaut 0 et l'affichage revient à "0", effaçant
// le point) : bug réel signalé par l'utilisateur. `NumField` garde un texte local pendant la frappe
// et ne resynchronise qu'au blur, donc n'a pas ce problème.
// [AJOUT 2026-08-28] Un article simple (boisson, etc.) n'avait jusqu'ici aucun suivi de prix,
// contrairement à un ingrédient (`ing.history`) ou une recette (variation affichée sur la fiche) —
// remonté par l'utilisateur comme un vrai manque : rien n'indiquait qu'un prix venait de changer.
// Même logique que `priceVariation` (pricing.js), appliquée à `item.priceHistory` au lieu de
// `ing.history`/`activeSupplier` — gardée séparée (pas réutilisée telle quelle) car les articles
// simples n'ont pas de fournisseur actif, juste un historique de prix plat.
function simpleItemPriceVariation(item) {
  const h = item.priceHistory || [];
  if (h.length < 2) return null;
  const previous = h[h.length - 2].price;
  const current = h[h.length - 1].price;
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return null; // variation négligeable, pas de bruit visuel
  return { pct: Math.round(Math.abs(pct)), dir: pct > 0 ? "up" : "down" };
}

export function SimpleItemRow({ item, categories, lang, t, onUpdate, onRemove, onConvert }) {
  const [showCost, setShowCost] = useState(item.cost != null);
  // [AJOUT 2026-08-30] Description + traduction auto, jusqu'ici réservées aux recettes
  // (`MenuRecipeRow`) — un article simple (boisson, dessert du jour...) ne pouvait donc jamais
  // avoir la moindre description sur la carte publique, signalé par l'utilisateur comme un vrai
  // manque. Repliée par défaut (comme le coût d'achat juste en dessous) pour ne pas alourdir la
  // ligne compacte de saisie rapide — la plupart des articles simples n'en ont pas besoin.
  const [showDescription, setShowDescription] = useState(!!item.menuDescription?.[lang]);
  const [translating, setTranslating] = useState(false);
  const description = item.menuDescription?.[lang] || "";
  useEffect(() => {
    if (!description.trim()) return;
    const timer = setTimeout(async () => {
      setTranslating(true);
      const data = await translateMenuText(description, lang);
      if (data) onUpdate({ menuDescription: { ...(item.menuDescription || {}), ...data } });
      setTranslating(false);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, lang]);
  // `onCommit` (pas `onChange`, qui se déclenche à chaque touche) — même règle que partout ailleurs
  // dans ce projet depuis le bug "+70%" du 2026-08-27 (voir CLAUDE.md) : un historique de prix ne
  // doit s'écrire qu'une fois la saisie VRAIMENT terminée, jamais à chaque caractère tapé.
  const commitSellPrice = (newPrice) => {
    const history = item.priceHistory || [];
    const last = history[history.length - 1];
    if (last && last.price === newPrice) return;
    onUpdate({ priceHistory: [...history, { date: new Date().toISOString().slice(0, 10), price: newPrice }].slice(-15) });
  };
  const variation = simpleItemPriceVariation(item);

  // Traduction automatique du nom (2026-08-19), même principe débouncé que la description d'une
  // recette (`MenuRecipeRow`) — le nom est ici tapé en direct (contrairement à celui d'une
  // recette, fixé ailleurs), donc un vrai debounce est nécessaire pour ne pas relancer un appel à
  // chaque lettre. `_src` évite de retraduire tant que le nom n'a pas changé depuis.
  useEffect(() => {
    if (!item.name?.trim() || item.menuNameI18n?._src === item.name) return;
    const timer = setTimeout(async () => {
      const data = await translateMenuText(item.name, lang);
      if (data) onUpdate({ menuNameI18n: { ...data, _src: item.name } });
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.name, lang, item.menuNameI18n?._src]);

  return (
    <div className="rounded-lg p-2" style={{ background: "#16130F" }}>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-white text-[11px] outline-none"
        />
        <select
          value={item.menuCategory || ""}
          onChange={(e) => onUpdate({ menuCategory: e.target.value || null })}
          className="bg-black/20 text-white/60 text-[10px] rounded px-1 py-1 outline-none shrink-0"
          style={{ colorScheme: "dark" }}
        >
          <option value="">{t("digitalMenuCategoryNone")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{categoryLabel(c, lang)}</option>
          ))}
        </select>
        <NumField
          value={item.sellPrice}
          onChange={(v) => onUpdate({ sellPrice: v })}
          onCommit={commitSellPrice}
          className="w-14 bg-black/20 text-white text-[11px] rounded px-1.5 py-1 outline-none text-right shrink-0"
        />
        <button onClick={onRemove} className="shrink-0 text-white/30 hover:text-[#EF4444]">
          <X size={12} />
        </button>
      </div>
      {/* Variation depuis le dernier prix enregistré (2026-08-28) — même code couleur que partout
          ailleurs dans l'app (vert = baisse, orange/rouge = hausse). Discret, sous la ligne, jamais
          affiché tant qu'il n'y a pas au moins 2 prix connus. */}
      {variation && (
        <div className="flex items-center gap-1 mt-1 pl-0.5 text-[10px]" style={{ color: variation.dir === "up" ? TIER_COLORS.mid : "#10B981" }}>
          {variation.dir === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span>{variation.pct}%</span>
        </div>
      )}
      {showCost ? (
        <div className="flex items-center gap-1.5 mt-1.5 pl-0.5">
          <span className="text-[10px] text-white/30 shrink-0">{t("digitalMenuSimpleItemCostLabel")}</span>
          <NumField
            value={item.cost || 0}
            onChange={(v) => onUpdate({ cost: v })}
            className="w-14 bg-black/20 text-white/70 text-[10px] rounded px-1.5 py-1 outline-none text-right"
          />
        </div>
      ) : (
        <button onClick={() => setShowCost(true)} className="text-[10px] text-white/25 hover:text-white/50 mt-1">
          {t("digitalMenuSimpleItemAddCost")}
        </button>
      )}
      {showDescription ? (
        <div className="mt-1.5">
          <textarea
            value={description}
            onChange={(e) => onUpdate({ menuDescription: { ...(item.menuDescription || {}), [lang]: e.target.value } })}
            placeholder={t("digitalMenuDescriptionPlaceholder")}
            rows={2}
            className="w-full bg-black/20 text-white/80 text-[11px] rounded px-2 py-1.5 outline-none resize-none"
          />
          {translating && (
            <span className="flex items-center gap-1 text-[10px] text-white/40 mt-0.5">
              <Loader2 size={10} className="animate-spin" /> {t("digitalMenuTranslating")}
            </span>
          )}
        </div>
      ) : (
        <button onClick={() => setShowDescription(true)} className="text-[10px] text-white/25 hover:text-white/50 mt-1 ml-2">
          + {t("digitalMenuDescriptionPlaceholder")}
        </button>
      )}
      {/* [PONT, 2026-08-27] Le passage d'un simple nom sur la carte à un plat dont on connaît la
          marge. Sans lui, un chef qui compose sa carte en saisie rapide reste bloqué dans un coin
          du produit qui ne parle jamais de marge — alors que c'est précisément là qu'il a sous les
          yeux la liste de tous les plats dont il aimerait connaître la rentabilité. */}
      {onConvert && (
        <button
          onClick={onConvert}
          className="flex items-center gap-1 text-[10px] mt-1.5 font-semibold"
          style={{ color: BRAND_SOLID }}
        >
          <Percent size={10} /> {t("digitalMenuConvertToRecipe")}
        </button>
      )}
    </div>
  );
}

// [REFONTE 2026-08-30] Devenue LA section "plats" unique de la carte digitale — jusqu'ici deux
// systèmes côte à côte (une longue liste de recettes à cocher, puis plus bas les "articles
// simples") que l'utilisateur a jugés trop compliqués à gérer ensemble, d'autant que les
// articles simples ont depuis gagné une description/traduction comme les recettes ("ce ne sont
// plus des articles SIMPLES"). Une seule liste mélange maintenant les deux (recettes déjà
// ajoutées + articles créés ici), avec DEUX façons d'ajouter un plat : la saisie rapide
// (toujours là) et le nouveau sélecteur de recette existante juste en dessous.
export function SimpleItemsSection({ items, setItems, recipes, updateRecipe, categories, lang, t, onConvert }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  // [BUG confirmé et corrigé, 2026-08-30] Sans pastille de section active, `addItem` posait
  // toujours `menuCategory: null` — l'utilisateur devait penser à choisir la section manuellement
  // sur CHAQUE ligne juste après l'ajout, sinon l'article restait invisible dans son rythme de
  // section une fois publié (les articles sans section vont toujours en fin de carte, voir
  // `groupByCategory`, PublicMenu.jsx — indépendant de l'ordre des sections). Cas réel signalé :
  // "j'ai ajouté 4 boissons, seulement 2 ont suivi la section, les 2 autres sont restées à la
  // fin" — les 2 oubliées avaient tout simplement `menuCategory: null`. Même pastille de section
  // que l'assistant guidé (MenuWizard.jsx, `activeCat`), pour un comportement identique partout,
  // réutilisée aussi par le sélecteur de recette existante juste en dessous.
  const [activeCat, setActiveCat] = useState(categories[0]?.id || null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const nameRef = useRef(null);

  const addItem = () => {
    const n = name.trim();
    const p = parseFloat((price || "").replace(",", "."));
    if (!n || !Number.isFinite(p) || p <= 0) return;
    setItems([...items, { id: uid(), name: n, sellPrice: p, cost: null, menuCategory: activeCat }]);
    setName("");
    setPrice("");
    nameRef.current?.focus();
  };

  const updateItem = (id, patch) => setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => setItems(items.filter((it) => it.id !== id));

  const includedRecipes = recipes.filter((r) => r.menuIncluded);
  // Une seule liste, plats mélangés (recettes + articles), triée par nom — plus de "deux blocs
  // l'un sous l'autre" comme avant.
  const dishRows = [
    ...includedRecipes.map((r) => ({ type: "recipe", key: `r_${r.id}`, name: r.name, data: r })),
    ...items.map((it) => ({ type: "simple", key: `s_${it.id}`, name: it.name, data: it })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const pickableRecipes = recipes
    .filter((r) => !r.menuIncluded)
    .filter((r) => r.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()));

  const addExistingRecipe = (r) => {
    // Même règle que l'ajout depuis la fiche recette (voir App.jsx) : le prix suit tel quel
    // UNIQUEMENT à l'ajout, jamais ensuite.
    updateRecipe(r.id, { menuIncluded: true, menuCategory: activeCat, menuPrice: r.sellPrice });
    setPickerQuery("");
    setPickerOpen(false);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40 mb-2">
        <Package size={11} />
        {t("digitalMenuDishesLabel")}
      </div>

      {dishRows.length > 0 && (
        <div className="space-y-1.5 mb-3 max-h-72 overflow-y-auto pr-0.5">
          {dishRows.map((row) =>
            row.type === "recipe" ? (
              <MenuRecipeRow
                key={row.key}
                r={row.data}
                lang={lang}
                t={t}
                categories={categories}
                onUpdate={(patch) => updateRecipe(row.data.id, patch)}
                onRemove={() => updateRecipe(row.data.id, { menuIncluded: false })}
              />
            ) : (
              <SimpleItemRow
                key={row.key}
                item={row.data}
                categories={categories}
                lang={lang}
                t={t}
                onUpdate={(patch) => updateItem(row.data.id, patch)}
                onRemove={() => removeItem(row.data.id)}
                onConvert={onConvert ? () => onConvert(row.data) : null}
              />
            )
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors"
              style={
                activeCat === c.id
                  ? { background: BRAND_GRADIENT, color: "#fff" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }
              }
            >
              {categoryLabel(c, lang)}
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-white/30 mb-1.5">{t("digitalMenuSimpleItemsHint")}</p>
      <div className="flex items-center gap-1.5">
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder={t("digitalMenuSimpleItemNamePlaceholder")}
          className="flex-1 min-w-0 bg-black/20 text-white text-[11px] rounded px-2 py-1.5 outline-none"
        />
        <input
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="€"
          className="w-16 bg-black/20 text-white text-[11px] rounded px-2 py-1.5 outline-none text-right"
        />
        <button
          onClick={addItem}
          className="shrink-0 text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded border border-white/20 text-white/70 hover:border-white/40"
        >
          {t("digitalMenuCategoryAdd")}
        </button>
      </div>

      {/* [AJOUT 2026-08-30] "Sélection de recette déjà existante" — demandé explicitement pour ne
          plus avoir à faire défiler une longue liste de recettes à cocher (ancien comportement) :
          un simple champ de recherche parmi les recettes pas encore sur la carte, un clic ajoute. */}
      <div className="mt-2">
        {pickerOpen ? (
          <div className="rounded-lg p-2 border border-white/10" style={{ background: "#16130F" }}>
            <input
              autoFocus
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder={t("digitalMenuRecipeFilterPlaceholder")}
              className="w-full bg-black/20 text-white text-[11px] rounded px-2 py-1.5 outline-none mb-1.5"
            />
            {pickableRecipes.length === 0 ? (
              <p className="text-white/25 text-[10px] px-1 py-1.5">{t("digitalMenuNoPickableRecipes")}</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {pickableRecipes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addExistingRecipe(r)}
                    className="w-full flex items-center gap-1.5 text-left text-[11px] text-white/80 hover:bg-white/10 rounded px-2 py-1.5"
                  >
                    <ChefHat size={11} className="shrink-0 text-white/25" />
                    <span className="flex-1 min-w-0 truncate">{r.name}</span>
                    <Plus size={11} className="shrink-0 text-white/30" />
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setPickerOpen(false); setPickerQuery(""); }} className="text-[10px] text-white/30 hover:text-white/60 mt-1.5">
              {t("cancelLabel")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/50 hover:text-white"
          >
            <Search size={11} /> {t("digitalMenuPickRecipeButton")}
          </button>
        )}
      </div>
    </div>
  );
}

// Carte digitale publique (2026-08) : génère à la volée un QR code vers /menu/<userId> (voir
// src/PublicMenu.jsx + api/public-menu.js) et laisse le restaurateur choisir, recette par
// recette, ce qui doit apparaître dessus. Rien n'est jamais publié par défaut : `menuIncluded`
// et `menuSettings.published` démarrent tous les deux à false/undefined — un restaurateur qui
// n'ouvre jamais cette fenêtre ne change rien à ce qui existait avant.
export function DigitalMenuModal({ open, onClose, menuSettings, setMenuSettings, recipes, setRecipes, simpleItems, setSimpleItems, userId, lang, t, onConvertToRecipe }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  // [REFONTE 2026-08-30] Nom/logo/design/couleur repliés derrière un bouton "Personnalisation" —
  // jugés par l'utilisateur trop mélangés avec la gestion des plats ("basta, je ne veux pas que
  // ce soit compliqué"). Fermé par défaut : ce n'est pas ce qu'on vient régler le plus souvent.
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  // Jeton de session pour l'aperçu d'une carte NON publiée (2026-08-30, voir api/public-menu.js) —
  // récupéré une seule fois à l'ouverture, jamais affiché, seulement collé dans le lien "Voir la
  // carte" quand la carte n'est pas encore publiée.
  const [previewToken, setPreviewToken] = useState(null);
  const logoInputRef = useRef(null);

  const publicUrl = userId ? `${window.location.origin}/menu/${userId}` : null;

  useEffect(() => {
    if (!open || menuSettings.published) { setPreviewToken(null); return; }
    supabase.auth.getSession().then(({ data }) => setPreviewToken(data?.session?.access_token || null));
  }, [open, menuSettings.published]);

  useEffect(() => {
    if (!open || !menuSettings.published || !publicUrl) { setQrDataUrl(null); return; }
    let cancelled = false;
    setQrBusy(true);
    // Import dynamique (comme pdfjs-dist/tesseract.js ailleurs dans ce fichier) : cette librairie
    // ne doit peser sur le chargement de l'app que pour les restaurateurs qui ouvrent cette fenêtre.
    import("qrcode")
      .then((mod) => (mod.default || mod).toDataURL(publicUrl, { width: 240, margin: 1, color: { dark: "#16130F", light: "#ffffff" } }))
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); })
      .finally(() => { if (!cancelled) setQrBusy(false); });
    return () => { cancelled = true; };
  }, [open, menuSettings.published, publicUrl]);

  // Sections définies par le restaurateur (2026-08-18, v2) — pré-remplies avec les 4 catégories
  // par défaut (mêmes ids qu'avant ce changement, donc compatible avec des recettes déjà
  // catégorisées) tant qu'il n'a jamais rien personnalisé lui-même.
  const categories = menuSettings.customCategories?.length ? menuSettings.customCategories : defaultMenuCategories();

  // Rattrapage automatique des sections créées avant la traduction automatique des noms de
  // section (v4, 2026-08-18) — ou dans l'ancien format "chaîne simple" (v3) : celles-ci restent
  // affichées dans une seule langue quel que soit le client, bug réel signalé le 2026-08-19. Se
  // relance à chaque rendu tant que la fenêtre est ouverte mais ne fait un appel réseau QUE s'il
  // reste vraiment une section incomplète (repli sur `defaultMenuCategories()` inoffensif : déjà
  // toujours complet dans les 3 langues, jamais concerné par cet effet).
  useEffect(() => {
    if (!open) return;
    const strCat = categories.find((c) => typeof c.name === "string");
    if (strCat) {
      setMenuSettings((prev) => ({
        ...prev,
        customCategories: (prev.customCategories?.length ? prev.customCategories : defaultMenuCategories()).map((c) =>
          c.id === strCat.id ? { ...c, name: { [lang]: c.name } } : c
        ),
      }));
      return;
    }
    const incomplete = categories.find((c) => !c.name.fr || !c.name.es || !c.name.en);
    if (!incomplete) return;
    const sourceLang = ["fr", "es", "en"].find((l) => incomplete.name[l]);
    if (!sourceLang) return;
    translateMenuText(incomplete.name[sourceLang], sourceLang).then((data) => {
      if (!data) return;
      setMenuSettings((prev) => ({
        ...prev,
        customCategories: (prev.customCategories?.length ? prev.customCategories : defaultMenuCategories()).map((c) =>
          c.id === incomplete.id ? { ...c, name: { ...c.name, ...data } } : c
        ),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories, lang]);

  if (!open) return null;

  const updateRecipe = (id, patch) => setRecipes((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoErr(false);
    try {
      const dataUrl = await compressLogoFile(file);
      setMenuSettings({ ...menuSettings, logo: dataUrl });
    } catch (err) {
      setLogoErr(true);
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const newCat = { id: uid(), name: { [lang]: name } };
    setMenuSettings({ ...menuSettings, customCategories: [...categories, newCat] });
    setNewCategoryName("");
    // Traduction automatique du nom de section vers les 2 autres langues — mêmes principes que la
    // description d'un plat (voir MenuRecipeRow), demandé explicitement le 2026-08-18 pour qu'une
    // section personnalisée (ex: "Pizzas") s'affiche correctement quelle que soit la langue
    // choisie par le client sur la carte publique.
    const translated = await translateMenuText(name, lang);
    if (translated) {
      setMenuSettings((prev) => ({
        ...prev,
        customCategories: (prev.customCategories || []).map((c) =>
          c.id === newCat.id ? { ...c, name: { ...c.name, ...translated } } : c
        ),
      }));
    }
  };
  const removeCategory = (id) => {
    setMenuSettings({ ...menuSettings, customCategories: categories.filter((c) => c.id !== id) });
    // Les recettes qui utilisaient cette section repassent "sans section" plutôt que de garder un
    // id orphelin — cohérent avec le comportement déjà existant d'une recette jamais catégorisée.
    setRecipes((rs) => rs.map((r) => (r.menuCategory === id ? { ...r, menuCategory: null } : r)));
  };
  // Ordre d'affichage des sections sur la carte publique (2026-08-19) — jusqu'ici uniquement
  // l'ordre de création, ce qui n'a aucune raison de correspondre à un ordre logique de menu
  // (bug réel signalé : "les entrées sont après les plats"). Simples flèches haut/bas plutôt qu'un
  // vrai glisser-déposer : une carte compte rarement plus de 5-6 sections, pas besoin de plus.
  const moveCategory = (index, direction) => {
    const next = [...categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setMenuSettings({ ...menuSettings, customCategories: next });
  };

  return (
    // [2026-08-28] Devenu un vrai onglet plutôt qu'une fenêtre flottante (voir App.jsx) : plus de
    // `fixed inset-0`/fond noir/limite de hauteur — le contenu suit le défilement normal de la
    // page, comme les 3 autres onglets. Le reste du contenu ci-dessous est inchangé.
    <div className="rounded-2xl p-5 flex flex-col font-body border border-white/10 print:hidden" style={{ background: "#201B15" }}>
      <div className="flex items-center gap-2 mb-1">
        <QrCode size={16} style={{ color: BRAND_SOLID }} className="shrink-0" />
        <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("digitalMenuTitle")}</h3>
      </div>
      <p className="text-white/50 text-xs mb-4 leading-relaxed">{t("digitalMenuHint")}</p>

      <div className="space-y-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!menuSettings.published}
              onChange={(e) => setMenuSettings({ ...menuSettings, published: e.target.checked })}
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="text-xs text-white/80 block font-semibold">{t("digitalMenuPublishLabel")}</span>
              <span className="text-[10px] text-white/40 block mt-0.5">{t("digitalMenuPublishHint")}</span>
            </span>
          </label>

          {/* [AJOUT 2026-08-30] Nom/logo/design/couleur repliés derrière ce bouton — demandé
              explicitement par l'utilisateur pour que l'écran principal ne montre que ce qu'on
              règle le plus souvent (les plats), pas les réglages d'apparence à côté. */}
          <button
            onClick={() => setPersonalizationOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-lg border border-white/15 text-white/70 hover:border-white/30 w-full justify-center"
          >
            <Palette size={13} /> {t("digitalMenuPersonalizeButton")}
            <ChevronDown size={12} className={`transition-transform ${personalizationOpen ? "rotate-180" : ""}`} />
          </button>

          {/* [BUG confirmé et corrigé, 2026-08-30] Ce bloc (nom, logo, design) n'était rendu QUE
              si la carte était déjà publiée — impossible de rien configurer avant de publier, ce
              qui est exactement l'inverse de l'ordre logique (on règle, on vérifie, PUIS on
              publie). Rendu désormais dès qu'on ouvre "Personnalisation", peu importe l'état de
              publication. */}
          {personalizationOpen && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/40 block mb-1">{t("digitalMenuRestaurantNameLabel")}</label>
                <input
                  type="text"
                  value={menuSettings.restaurantName}
                  onChange={(e) => setMenuSettings({ ...menuSettings, restaurantName: e.target.value })}
                  placeholder={t("digitalMenuRestaurantNamePlaceholder")}
                  className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/40 block mb-1.5">{t("digitalMenuLogoLabel")}</label>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                {/* [AGRANDI, 2026-08-30] Un petit bouton texte à côté d'une pastille de 40px pour
                    régler le logo — jugé trop discret par l'utilisateur ("c'est quand même
                    important") vu que c'est ce que voient TOUS les clients qui scannent le QR
                    code. Pastille et bouton nettement plus grands, bouton rempli (dégradé de
                    marque) au lieu d'un simple contour. */}
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white/10" style={{ background: "#16130F" }}>
                    {menuSettings.logo ? <img src={menuSettings.logo} alt="" className="w-full h-full object-contain" /> : <Logo size={28} />}
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs font-semibold uppercase tracking-wide px-3 py-2.5 rounded-lg active:scale-95 transition-transform"
                      style={{ background: BRAND_GRADIENT, color: "#fff" }}
                    >
                      {t("digitalMenuLogoUpload")}
                    </button>
                    {menuSettings.logo && (
                      <button
                        onClick={() => setMenuSettings({ ...menuSettings, logo: null })}
                        className="text-[11px] uppercase tracking-wide text-white/40 hover:text-[#EF4444] text-center"
                      >
                        {t("digitalMenuLogoRemove")}
                      </button>
                    )}
                  </div>
                </div>
                {logoErr && <p className="text-[10px] text-[#EF4444] mt-1">{t("digitalMenuLogoError")}</p>}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/40 block mb-1">{t("digitalMenuDesignLabel")}</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {MENU_DESIGNS.map(({ id: d, bg }) => (
                    <button
                      key={d}
                      onClick={() => setMenuSettings({ ...menuSettings, design: d })}
                      className="flex items-center gap-2 text-xs py-2 px-2.5 rounded-lg border transition-colors"
                      style={
                        menuSettings.design === d
                          ? { borderColor: BRAND_SOLID, background: `${BRAND_SOLID}18`, color: "#fff" }
                          : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }
                      }
                    >
                      <span className="w-4 h-4 rounded-full shrink-0 border border-white/20" style={{ background: bg }} />
                      {t(DESIGN_LABEL_KEYS[d])}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {MENU_ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setMenuSettings({ ...menuSettings, accentColor: c })}
                      className="w-6 h-6 rounded-full shrink-0"
                      style={{
                        background: c,
                        outline: (menuSettings.accentColor || MENU_ACCENT_COLORS[0]) === c ? "2px solid #fff" : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

              <div className="rounded-lg p-3 flex flex-col items-center gap-2" style={{ background: "#16130F" }}>
                {qrBusy ? (
                  <div className="w-[140px] h-[140px] flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-white/40" />
                  </div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR code" width={140} height={140} className="rounded" />
                ) : !menuSettings.published ? (
                  <div className="w-[140px] h-[140px] flex items-center justify-center text-center px-2">
                    <span className="text-white/30 text-[10px] leading-relaxed">{t("digitalMenuQrAfterPublish")}</span>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5 w-full">
                  <input readOnly value={publicUrl || ""} className="flex-1 min-w-0 bg-black/30 text-white/70 text-[11px] rounded px-2 py-1.5 outline-none truncate" />
                  <button onClick={copyLink} className="shrink-0 text-[10px] uppercase tracking-wide px-2 py-1.5 rounded border border-white/20 text-white/70 hover:border-white/40">
                    {copied ? t("digitalMenuLinkCopied") : t("digitalMenuCopyLink")}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {publicUrl && (
                    // Navigation normale dans le MÊME onglet (2026-08-19, 2e essai) — une iframe
                    // avait été tentée d'abord mais se comportait mal en pratique (signalé par
                    // l'utilisateur : renvoyait à l'écran Recettes de l'app, reproductible aussi
                    // bien sur ordinateur que sur téléphone). `?preview=1` fait apparaître un lien
                    // "Retour à Chefup" explicite sur la carte publique (`src/PublicMenu.jsx`) —
                    // fonctionne partout, y compris sans bouton retour visible (app ajoutée à
                    // l'écran d'accueil), puisque c'est un vrai lien cliquable, pas une dépendance
                    // au bouton retour du navigateur.
                    <a
                      href={`${publicUrl}?preview=1${!menuSettings.published && previewToken ? `&previewToken=${encodeURIComponent(previewToken)}` : ""}`}
                      className="text-[10px] uppercase tracking-wide text-white/50 hover:text-white underline"
                    >
                      {t("digitalMenuPreview")}
                    </a>
                  )}
                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download="carte-chefup-qr.png"
                      className="text-[10px] uppercase tracking-wide text-white/50 hover:text-white underline"
                    >
                      {t("digitalMenuDownloadQr")}
                    </a>
                  )}
                </div>
              </div>

          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40 mb-2">
              <Tags size={11} />
              {t("digitalMenuCategoriesLabel")}
            </div>
            <div className="space-y-1 mb-2">
              {categories.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1.5 text-[11px] text-white/70 bg-black/20 rounded-lg pl-1 pr-2.5 py-1">
                  <div className="flex flex-col shrink-0">
                    <button
                      onClick={() => moveCategory(i, -1)}
                      disabled={i === 0}
                      className="text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 leading-none"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      onClick={() => moveCategory(i, 1)}
                      disabled={i === categories.length - 1}
                      className="text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 leading-none"
                    >
                      <ChevronDown size={11} />
                    </button>
                  </div>
                  <span className="flex-1 min-w-0 truncate">{categoryLabel(c, lang)}</span>
                  <button onClick={() => removeCategory(c.id)} className="text-white/30 hover:text-[#EF4444] shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                placeholder={t("digitalMenuCategoryAddPlaceholder")}
                className="flex-1 min-w-0 bg-black/20 text-white text-[11px] rounded px-2 py-1.5 outline-none"
              />
              <button
                onClick={addCategory}
                disabled={!newCategoryName.trim()}
                className="shrink-0 text-[10px] uppercase tracking-wide px-2.5 py-1.5 rounded border border-white/20 text-white/70 hover:border-white/40 disabled:opacity-40"
              >
                {t("digitalMenuCategoryAdd")}
              </button>
            </div>
          </div>

          {/* [REFONTE 2026-08-30] Une seule section "plats" — plus deux listes séparées (recettes
              cochées d'un côté, articles simples de l'autre) jugées trop compliquées à gérer
              ensemble par l'utilisateur. `SimpleItemsSection` gère maintenant la liste unifiée +
              les deux façons d'ajouter un plat (saisie rapide, ou recette déjà existante). */}
          <SimpleItemsSection
            items={simpleItems}
            setItems={setSimpleItems}
            recipes={recipes}
            updateRecipe={updateRecipe}
            categories={categories}
            lang={lang}
            t={t}
            onConvert={onConvertToRecipe}
          />
        </div>
      </div>
  );
}

// Carte d'un article scanné : correspondance affichée en grand (plutôt qu'un petit menu discret),
// bascule de renommage en vrai bouton, et une phrase en clair juste avant d'importer.
export function ScanItemCard({ item, onUpdate, onImport, onSkip, ingredients, ingredientDisplayName, lang, t, skipMuted, startExpanded }) {
  const [expanded, setExpanded] = useState(!!startExpanded);
  const [editingPrice, setEditingPrice] = useState(false);
  const matchedIng = item.assignTo !== "new" ? ingredients.find((i) => i.id === item.assignTo) : null;
  const guessedIng = item.guessedMatchId ? ingredients.find((i) => i.id === item.guessedMatchId) : null;
  const needsRename = item.assignTo !== "new" && item.name && matchedIng && ingredientDisplayName(matchedIng) !== item.name;
  const matchColor = item.assignTo === "new" ? "#3B82F6" : item.matchConfident ? "#10B981" : TIER_COLORS.mid;

  const targetName = item.assignTo === "new" ? item.name : needsRename && item.renameOnImport ? item.name : matchedIng ? ingredientDisplayName(matchedIng) : "";
  const summary =
    item.assignTo === "new"
      ? t("scanSummaryNew")(targetName || "?", (item.unitPriceHT || 0).toFixed(2), item.unit)
      : t("scanSummaryUpdate")(targetName || "?", (item.unitPriceHT || 0).toFixed(2), item.unit);
  // Doute sur le PRIX (incohérent/illisible/IA peu sûre) : ne se résout jamais tout seul, reste
  // affiché jusqu'à l'import quel que soit le chemin emprunté (pile ou liste directe).
  const hasPriceDoubt = item.pricingUnknown || item.priceInconsistent || item.lowConfidence || item.unitChangeAffectsRecipes;
  // Doute sur le NOM (rapprochement pas confiant) : une fois que l'utilisateur a explicitement
  // tranché et validé dans la pile (item.reviewed), ce doute est résolu — le réafficher au moment
  // du clic final n'a plus de sens, ça ferait revivre une décision déjà prise (repéré en test réel,
  // 2026-08 : "Café grain arabica" gardait son bouton orange après validation explicite du nom).
  const hasUnresolvedNameDoubt = !item.matchConfident && item.assignTo !== "new" && !item.reviewed;
  // Un vrai souci d'identité/prix justifie un bouton d'alerte — une simple grosse variation de
  // prix (bigChange) non : le chef veut pouvoir valider normalement et juste voir la flèche/
  // pourcentage d'info affichée plus bas, pas se faire arrêter par un symbole danger pour un prix
  // qui monte.
  const hasIdentityIssue = hasPriceDoubt || hasUnresolvedNameDoubt;
  // Calculé dès qu'il y a un prix connu à comparer, même si la variation est nulle — avant ce
  // correctif, seules les lignes avec une VRAIE variation (>1%) affichaient quoi que ce soit,
  // ce qui donnait l'impression fausse que les autres lignes n'avaient pas été comparées du
  // tout. Signal demandé explicite de l'utilisateur (2026-08) : un badge doit être présent sur
  // CHAQUE ligne ayant un prix de référence, même pour dire "0%".
  // priceComparisonValid (2026-08-25) : jamais de pourcentage affiché quand l'unité a changé par
  // rapport à l'ingrédient existant (kg vs pièce, etc.) — la comparaison n'aurait aucun sens et
  // afficherait un pourcentage/sens trompeur (bug confirmé : "en hausse" affiché pour un prix en
  // réalité en baisse, juste comparé dans deux unités différentes).
  const priceChangePct =
    item.currentPrice !== null && item.currentPrice && item.priceComparisonValid !== false
      ? Math.round((Math.abs((item.unitPriceHT || 0) - item.currentPrice) / item.currentPrice) * 100)
      : null;

  return (
    <div
      className={`rounded-xl border ${item.imported ? "opacity-40" : ""}`}
      style={{ background: "#16130F", borderColor: hasIdentityIssue ? `${TIER_COLORS.mid}80` : "rgba(255,255,255,0.1)" }}
    >
      {/* Ligne compacte : toujours visible, sans clic — le nom qui sera vraiment utilisé saute aux yeux */}
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <input
            value={item.name || ""}
            disabled={item.imported}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="flex-1 min-w-0 bg-transparent text-white text-sm font-medium outline-none"
          />
          <NumField
            value={item.quantity || 0}
            onChange={(v) => onUpdate({ quantity: v })}
            className="w-10 shrink-0 bg-transparent text-white/50 text-[11px] text-right outline-none"
          />
          <span className="text-white/40 text-[11px] shrink-0">{unitDisplayLabel(item.unit, t)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-1 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: matchColor }} />
          <span className="text-xs font-semibold truncate" style={{ color: matchColor }}>
            {targetName || "—"}
          </span>
          {needsRename && (
            <span className="text-[10px] text-white/35 truncate">({t("scanProposedLabel")} : {item.name})</span>
          )}
          {hasPriceDoubt && !item.imported && <AlertTriangle size={12} className="shrink-0 ml-auto" style={{ color: TIER_COLORS.mid }} />}
        </div>

        {/* Texte tel que lu sur la facture (débarrassé seulement du code fournisseur) : visible
            sans avoir à ouvrir "Modifier", pour vérifier d'un coup d'œil ce qui était vraiment
            imprimé. Modifiable ici pour corriger une erreur de lecture — n'affecte jamais le nom
            d'ingrédient ni le matching, uniquement la mémoire des rapprochements de ce texte. */}
        <div className="flex items-center gap-1 mt-1 min-w-0">
          <span className="text-[9px] uppercase tracking-wide text-white/25 shrink-0">{t("scanRawLabelPrefix")}</span>
          <input
            value={lightRawLabel(item.rawLabel)}
            disabled={item.imported}
            onChange={(e) => onUpdate({ rawLabel: e.target.value })}
            className="flex-1 min-w-0 bg-transparent text-white/45 text-[10px] outline-none focus:text-white/80"
          />
        </div>

        <div className="flex items-center gap-1.5 mt-1.5">
          {editingPrice ? (
            <NumField
              value={item.unitPriceHT || 0}
              onChange={(v) => onUpdate({ unitPriceHT: v })}
              className="w-16 bg-black/20 rounded px-1.5 py-1 text-right text-white text-sm font-mono outline-none"
            />
          ) : (
            <span className="text-white text-sm font-semibold">{(item.unitPriceHT || 0).toFixed(2)}€</span>
          )}
          <span className="text-white/40 text-[11px]">/{unitDisplayLabel(item.unit, t)}</span>
          {/* Variation de prix visible tout de suite, sans avoir à ouvrir "Modifier" — demande
              réelle de l'utilisateur (2026-08) : compact ici (icône + %), le détail avant/après
              reste disponible au survol et dans le panneau développé. Seule une vraie hausse
              change la couleur (orange, ou rouge si bigChange) — tout le reste (baisse ou prix
              stable) reste vert avec la flèche vers le bas, y compris à 0% : demande explicite de
              l'utilisateur, "pas augmenté" doit toujours rassurer visuellement de la même façon. */}
          {item.currentPrice !== null && item.currentPriceIsReal && priceChangePct !== null && (
            <span
              className="flex items-center gap-0.5 text-[10px] font-bold shrink-0"
              style={{ color: priceChangeVisual(item).color }}
              title={`${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`}
            >
              {priceChangeVisual(item).up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {priceChangePct}%
            </span>
          )}
          {!item.imported && (
            <button onClick={() => setEditingPrice((v) => !v)} className="text-white/30 hover:text-white shrink-0">
              <Pencil size={12} />
            </button>
          )}

          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-0.5 text-[10px] text-white/35 hover:text-white ml-1"
          >
            {t("scanModify")} <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>

          <div className="flex-1" />

          {item.imported ? (
            <span className="text-[10px] text-[#10B981] font-semibold">{t("scanImported")}</span>
          ) : (
            <>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-colors"
                  style={skipMuted ? { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.35)" } : { borderColor: "rgba(239,68,68,0.4)", color: "#EF4444" }}
                  onMouseEnter={skipMuted ? (e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#EF4444"; } : undefined}
                  onMouseLeave={skipMuted ? (e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; } : undefined}
                  title={t("scanSkip")}
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={onImport}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: hasIdentityIssue ? TIER_COLORS.mid : "#10B981" }}
                title={hasIdentityIssue ? t("scanConfirmUncertain") : t("scanImport")}
              >
                {hasIdentityIssue ? <AlertTriangle size={14} color="#fff" /> : <Check size={14} color="#fff" />}
              </button>
            </>
          )}
        </div>

        {/* Message visible en permanence (pas seulement au survol de la souris, invisible sur
            mobile) : un doute sur le prix doit rester impossible à manquer jusqu'à l'import,
            contrairement au doute sur le nom qui, lui, se résout une fois validé (voir
            hasUnresolvedNameDoubt plus haut). */}
        {hasPriceDoubt && !item.imported && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold" style={{ color: TIER_COLORS.mid }}>
            <AlertTriangle size={11} className="shrink-0" /> {t("scanPriceDoubtLabel")}
          </div>
        )}
        {/* Un écart de prix de plus de 40% (dans un sens comme dans l'autre) garde la ligne hors de
            "Importer ces lignes" — sans cette note, une grosse BAISSE affichée en vert donnait
            l'impression d'une ligne parfaitement normale mise de côté sans raison visible. Le ton
            reste neutre : ce n'est pas une erreur détectée, juste un écart assez gros pour mériter
            un coup d'œil (un prix sous-estimé gonfle la marge à tort, exactement comme un prix
            surestimé la sous-estime). */}
        {item.bigChange && !hasPriceDoubt && !item.imported && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-white/50">
            <Info size={11} className="shrink-0" /> {t("scanBigChangeNote")}
          </div>
        )}
      </div>

      {expanded && !item.imported && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-white/5 space-y-2">
          {(item.packageCount || item.packageContent) && !item.pricingUnknown && (
            <div className="text-[10px] text-white/35 font-mono">
              {item.packageCount || 1} × {item.packageContent || 1}
              {item.packageContentUnit === "pièce" ? "" : item.packageContentUnit} @ {(item.printedUnitPriceHT || 0).toFixed(2)}€/
              {item.printedPriceUnit === "colis" ? t("scanColisUnit") : item.printedPriceUnit}
            </div>
          )}

          {item.pricingUnknown && <PricingCalculator item={item} onUpdate={onUpdate} t={t} />}

          {item.priceInconsistent && (
            <div className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
              <AlertTriangle size={11} className="shrink-0" />
              <span>
                {t("scanPriceInconsistent")}
                {item.expectedTotal !== null ? ` (${t("scanExpectedTotal")} ≈ ${item.expectedTotal.toFixed(2)}€, ${t("scanPrintedTotal")} ${(item.totalPriceHT || 0).toFixed(2)}€)` : ""}
              </span>
            </div>
          )}

          {item.lowConfidence && (
            <div className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
              <AlertTriangle size={11} className="shrink-0" />
              <span>{t("scanLowConfidence")}</span>
            </div>
          )}

          {item.unitChangeAffectsRecipes && (
            <div className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
              <AlertTriangle size={11} className="shrink-0" />
              <span>{t("scanUnitChangeWarning")(item.previousUnit, item.unit)}</span>
            </div>
          )}

          {guessedIng && (
            <ScanNameChoice item={item} guessedIng={guessedIng} ingredientDisplayName={ingredientDisplayName} onUpdate={onUpdate} t={t} />
          )}

          <div className={guessedIng ? "border-t border-white/5 pt-2" : ""}>
            <div className="text-[9px] uppercase tracking-wide text-white/35 mb-1">{t("scanRelinkLabel")}</div>
            <div className="flex items-center gap-1.5">
              <select
                value={item.unit || "kg"}
                onChange={(e) => onUpdate({ unit: e.target.value })}
                className="bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1.5 shrink-0"
                style={{ colorScheme: "dark" }}
              >
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="pièce">{t("unitPieceLabel")}</option>
              </select>
              <IngredientPicker
                ingredients={ingredients}
                value={item.assignTo !== "new" ? item.assignTo : null}
                displayName={ingredientDisplayName}
                onChange={(id) => onUpdate({ assignTo: id, guessedMatchId: id, matchConfident: true, renameOnImport: false })}
                placeholder={t("scanSearchIngredientPlaceholder")}
                className="flex-1 min-w-0 bg-black/30 text-white text-xs rounded-lg px-2.5 py-2"
                searchPlaceholder={t("pickerSearchPlaceholder")}
                typeToSearchText={t("pickerTypeToSearch")}
                noResultsText={t("pickerNoResults")}
              />
              <button
                type="button"
                onClick={() => onUpdate({ assignTo: "new", renameOnImport: false })}
                className="shrink-0 text-[9px] uppercase tracking-wide px-2 py-2 rounded-lg font-semibold whitespace-nowrap"
                style={{ background: "#3B82F622", color: "#3B82F6" }}
              >
                {t("scanNewIngredient")}
              </button>
            </div>
          </div>

          {item.currentPrice !== null && item.currentPriceIsReal && priceChangePct !== null && (
            <div
              className="flex items-center gap-1 text-[10px]"
              style={{ color: priceChangeVisual(item).color }}
            >
              {priceChangeVisual(item).up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {item.priceUp
                ? `${t("scanPriceIncrease")} (+${priceChangePct}%) : ${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`
                : item.priceDown
                ? `${t("scanPriceDecrease")} (-${priceChangePct}%) : ${item.currentPrice.toFixed(2)}€ → ${(item.unitPriceHT || 0).toFixed(2)}€`
                : t("scanPriceSame")}
            </div>
          )}

          <div className="text-[11px] text-white/45 italic border-t border-white/5 pt-1.5">{summary}</div>
        </div>
      )}
    </div>
  );
}
