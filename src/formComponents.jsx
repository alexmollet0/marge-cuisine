// Champs/composants de saisie réutilisables (nombres, quantités, recherche d'ingrédient) —
// extrait de App.jsx le 2026-08-28.
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Plus, Search } from "lucide-react";
import { CATALOG, CATEGORY_ESTIMATE_PRICE, textIncludes, normUnit, unitDisplayLabel } from "./catalog.js";
import { activeSupplier } from "./pricing.js";
import { BRAND_SOLID, BRAND_GRADIENT } from "./brand.js";

export function NumField({ value, onChange, onCommit, className, allowDecimal = true, ...rest }) {
  const [local, setLocal] = useState(value === 0 || value === undefined || value === null ? "" : String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(value === 0 || value === undefined || value === null ? "" : String(value));
  }, [value]);

  const handleChange = (e) => {
    let v = e.target.value.replace(",", ".");
    v = allowDecimal ? v.replace(/[^0-9.]/g, "") : v.replace(/[^0-9]/g, "");
    if (allowDecimal) {
      const firstDot = v.indexOf(".");
      if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    if (/^0[0-9]/.test(v)) v = v.replace(/^0+/, "");
    setLocal(v);
    const num = v === "" || v === "." ? 0 : parseFloat(v);
    onChange(isNaN(num) ? 0 : num);
  };

  return (
    <input
      type="text" inputMode="decimal" value={local} onChange={handleChange}
      onFocus={(e) => { focusedRef.current = true; e.target.select(); }}
      onBlur={() => {
        focusedRef.current = false;
        setLocal(value === 0 || !value ? "" : String(value));
        if (onCommit) onCommit(typeof value === "number" ? value : 0);
      }}
      className={className} {...rest}
    />
  );
}

// Affiche/édite les quantités de recette en g/mL (jamais en décimales de kg/L, ex : 50 g
// plutôt que 0.05), avec deux flèches empilées pour ajuster sans calcul mental — le clavier
// reste utilisable en plus. Le stockage interne (line.qty, prix au kg/L) ne change pas, seule
// la conversion d'affichage x1000 est appliquée. L'unité affichée (g/mL vs kg/L) ne se
// recalcule jamais pendant la frappe (focus), pour ne pas changer l'interprétation du texte
// en cours de saisie ; elle bascule automatiquement au-delà de 1000 (ex : 1000g -> 1 kg).
export function QtyField({ qty, unit, onChange, className, t }) {
  const isSmallUnit = unit === "kg" || unit === "L";
  const focusedRef = useRef(false);

  // [2026-08-27, 2e passe] Retour à un affichage automatique en kg/L au-delà de 1000 g/mL,
  // demandé par l'utilisateur pour la LECTURE de la fiche recette ("plus facile à lire") — mais
  // SANS bouton de bascule manuelle : celui-là avait été supprimé le même jour, à raison, pour une
  // tout autre partie de l'app (la SAISIE rapide, `QuickAddLine`, qui elle reste TOUJOURS en
  // grammes/mL — un ingrédient qu'on ajoute se pense en grammes, pas en fraction de kilo). Les
  // deux besoins ne se contredisent pas : l'un est une saisie (toujours petite unité), l'autre un
  // affichage une fois la ligne déjà dans la recette (bascule automatique selon la grandeur).
  // L'unité affichée reste GELÉE pendant la frappe dans CE champ (via `smallAtFocus`, capturé une
  // seule fois au focus) : sans ça, taper "1000" ferait basculer l'affichage de g vers kg au
  // milieu de la frappe, changeant l'interprétation du texte en cours de saisie — piège déjà
  // rencontré et évité par le passé sur ce même champ, avant sa simplification temporaire du matin.
  const autoSmall = isSmallUnit && (qty || 0) < 1;
  const smallAtFocus = useRef(autoSmall);
  const displaySmall = focusedRef.current ? smallAtFocus.current : autoSmall;

  const factor = isSmallUnit && displaySmall ? 1000 : 1;
  const displayUnit = isSmallUnit ? (displaySmall ? (unit === "kg" ? "g" : "mL") : unit) : unit;
  const step = isSmallUnit ? (displaySmall ? 25 : 0.1) : unit === "pièce" ? 1 : 0.1;
  const rawValue = Math.round((qty || 0) * factor * 1000) / 1000;

  const [local, setLocal] = useState(rawValue === 0 ? "" : String(rawValue));
  useEffect(() => {
    if (focusedRef.current) return;
    setLocal(rawValue === 0 ? "" : String(rawValue));
  }, [rawValue]);

  const commit = (displayVal) => onChange(Math.max(0, displayVal) / factor);

  const handleChange = (e) => {
    let v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    if (/^0[0-9]/.test(v)) v = v.replace(/^0+/, "");
    setLocal(v);
    const num = v === "" || v === "." ? 0 : parseFloat(v);
    commit(isNaN(num) ? 0 : num);
  };

  const bump = (dir) => commit(Math.round((rawValue + dir * step) * 1000) / 1000);

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={handleChange}
        onFocus={(e) => { smallAtFocus.current = autoSmall; focusedRef.current = true; e.target.select(); }}
        onBlur={() => { focusedRef.current = false; setLocal(rawValue === 0 ? "" : String(rawValue)); }}
        className={className}
      />
      <div className="flex flex-col print:hidden">
        <button type="button" onClick={() => bump(1)} className="text-black/30 hover:text-black/70 leading-none" style={{ padding: "0 1px" }}>
          <ChevronUp size={10} />
        </button>
        <button type="button" onClick={() => bump(-1)} className="text-black/30 hover:text-black/70 leading-none" style={{ padding: "0 1px" }}>
          <ChevronDown size={10} />
        </button>
      </div>
      <span className="text-black/40 text-[11px] shrink-0">{unitDisplayLabel(displayUnit, t)}</span>
    </div>
  );
}
// [SAISIE EN RAFALE, 2026-08-27] Ligne d'ajout rapide en tête de la liste d'ingrédients.
// Conçue pour enchaîner sans lever les doigts du clavier : on tape le nom, Entrée passe à la
// quantité (en grammes), Entrée valide et le focus revient sur le nom pour l'ingrédient suivant.
// Même principe que la saisie des articles de la carte digitale, que l'utilisateur trouvait
// rapide — par opposition à l'ancien parcours "créer une ligne vide → ouvrir un sélecteur →
// choisir → revenir saisir la quantité", jugé "vraiment chiant" en test réel.
// Les suggestions montrent d'abord le garde-manger (prix déjà connus, donc marge juste) puis le
// catalogue de référence ; un nom totalement inédit reste acceptable et crée l'ingrédient.
export function QuickAddLine({ ingredients, ingredientDisplayName, lang, t, onAdd, guessUnit, guessPrice }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [picked, setPicked] = useState(null); // id si choisi dans le garde-manger, sinon null
  // [BUG confirmé et corrigé, 2026-08-27] `picked` ne suffit pas à savoir si une suggestion a été
  // choisie : un ingrédient qui vient du CATALOGUE (pas encore dans le garde-manger) a un id null
  // — exactement la même valeur que "rien n'a encore été choisi". Résultat signalé en test réel
  // ("lait entier" cliqué mais la liste de suggestions ne se refermait jamais, cachant les
  // pastilles g/mL/pièce juste en dessous) : `!picked` restait vrai après un clic sur une
  // suggestion du catalogue, donc la liste continuait de se réafficher. Un booléen séparé, qui ne
  // se soucie que de "une suggestion a-t-elle été cliquée", règle ça sans toucher au sens de
  // `picked` (toujours utilisé ailleurs comme l'id à transmettre à l'ajout).
  const [suggestionPicked, setSuggestionPicked] = useState(false);
  const [unit, setUnit] = useState("kg");
  // Vrai dès que l'utilisateur a choisi l'unité lui-même : on cesse alors de la deviner à sa
  // place, sinon on écraserait son choix à la frappe suivante.
  const unitTouched = useRef(false);
  const priceTouched = useRef(false);
  const nameRef = useRef(null);
  const amountRef = useRef(null);

  const q = name.trim();

  // L'unité ET le prix se devinent à partir du nom tapé, à chaque frappe, tant que l'utilisateur
  // n'y a pas touché lui-même. Le catalogue connaît l'unité de ses 195 entrées et le garde-manger
  // connaît les vrais prix déjà saisis : sans s'en servir, tout était saisi en grammes et un nom
  // inconnu tombait même en "pièce" (cas réel : "croûtons" ajouté à 5€ la pièce).
  useEffect(() => {
    if (suggestionPicked || q.length < 3) return;
    if (!unitTouched.current && guessUnit) {
      const g = guessUnit(q);
      setUnit((u) => (u === g ? u : g));
    }
    if (!priceTouched.current && guessPrice) {
      const gp = guessPrice(q);
      setPrice((cur) => (String(gp) === cur ? cur : gp ? String(gp) : ""));
    }
  }, [q, suggestionPicked, guessUnit, guessPrice]);

  const suggestions =
    q.length >= 2 && !suggestionPicked
      ? [
          ...ingredients
            .filter((i) => textIncludes(ingredientDisplayName(i), q))
            .slice(0, 4)
            .map((i) => ({ key: "ing-" + i.id, label: ingredientDisplayName(i), id: i.id, unit: normUnit(i.unit), price: activeSupplier(i)?.price || 0, known: true })),
          ...CATALOG.filter((c) => textIncludes(c[lang] || c.fr, q) && !ingredients.some((i) => i.catalogId === c.id))
            .slice(0, 3)
            .map((c) => ({ key: "cat-" + c.id, label: c[lang] || c.fr, id: null, unit: normUnit(c.unit), price: CATEGORY_ESTIMATE_PRICE[c.cat] || 5, known: false })),
        ]
      : [];

  // Le nombre saisi est exprimé dans l'unité AFFICHÉE ; l'unité de STOCKAGE reste kg/L.
  const placeholderAmount = unit === "L" ? "100" : unit === "pièce" ? "1" : "150";
  const priceUnitLabel = unit === "kg" ? "/kg" : unit === "L" ? "/L" : "/" + unitDisplayLabel("pièce", t);

  const pickUnit = (u) => {
    unitTouched.current = true;
    setUnit(u);
    amountRef.current?.focus();
  };

  const submit = () => {
    const n = parseFloat(String(amount).replace(",", "."));
    if (!q || !Number.isFinite(n) || n <= 0) return;
    const pr = parseFloat(String(price).replace(",", "."));
    onAdd({ existingId: picked, name: q, grams: n, unit, price: Number.isFinite(pr) && pr > 0 ? pr : 0 });
    setName("");
    setAmount("");
    setPrice("");
    setPicked(null);
    setSuggestionPicked(false);
    unitTouched.current = false;
    priceTouched.current = false;
    nameRef.current?.focus();
  };

  return (
    <div className="print:hidden mb-3">
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0 relative">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => { setName(e.target.value); setPicked(null); setSuggestionPicked(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); amountRef.current?.focus(); } }}
            placeholder={t("quickAddNamePlaceholder")}
            className="w-full bg-white rounded-lg px-2.5 py-2.5 text-sm text-black outline-none border border-black/15 focus:border-[#8B5CF6]"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg border border-black/10 bg-white">
              {suggestions.map((sg) => (
                <button
                  key={sg.key}
                  type="button"
                  onClick={() => {
                    setName(sg.label);
                    setPicked(sg.id);
                    setSuggestionPicked(true);
                    // Unité ET prix viennent de la source choisie : le garde-manger si
                    // l'ingrédient existe déjà (ses valeurs font foi), le catalogue sinon.
                    unitTouched.current = false;
                    priceTouched.current = false;
                    setUnit(sg.unit || "kg");
                    setPrice(sg.price ? String(sg.price) : "");
                    amountRef.current?.focus();
                  }}
                  className="w-full text-left px-2.5 py-2 text-xs text-black/80 hover:bg-black/5 flex items-center gap-2 border-b border-black/5 last:border-0"
                >
                  <span className="flex-1 min-w-0 truncate">{sg.label}</span>
                  {/* Un ingrédient déjà dans le garde-manger a un vrai prix : le signaler évite
                      d'en recréer un doublon sans s'en rendre compte. */}
                  {sg.known && <span className="text-[9px] uppercase tracking-wide text-[#10B981] shrink-0">{t("quickAddKnown")}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={amountRef}
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholderAmount}
          className="w-14 shrink-0 bg-white rounded-lg px-2 py-2.5 text-sm text-black text-right outline-none border border-black/15 focus:border-[#8B5CF6]"
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white"
          style={{ background: BRAND_GRADIENT }}
          title={t("quickAddButton")}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Unité et prix sur une deuxième ligne : tous deux pré-remplis automatiquement, donc
          rarement à toucher — mais VISIBLES, pour qu'on sache dans quoi on saisit et sur quel prix
          la marge va se calculer. C'est ce qui manquait à l'ancienne bascule kg/g minuscule, et ce
          qui a laissé passer un ingrédient ajouté à 5€ la pièce sans que personne ne le voie. */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {[
          { u: "kg", label: "g" },
          { u: "L", label: "mL" },
          { u: "pièce", label: unitDisplayLabel("pièce", t) },
        ].map((opt) => (
          <button
            key={opt.u}
            type="button"
            onClick={() => pickUnit(opt.u)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border"
            style={
              unit === opt.u
                ? { background: BRAND_SOLID, borderColor: BRAND_SOLID, color: "#fff" }
                : { background: "transparent", borderColor: "rgba(0,0,0,0.15)", color: "rgba(0,0,0,0.45)" }
            }
          >
            {opt.label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-black/35">{t("quickAddPriceLabel")}</span>
          <input
            value={price}
            inputMode="decimal"
            onChange={(e) => { priceTouched.current = true; setPrice(e.target.value.replace(/[^0-9.,]/g, "")); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            placeholder="0"
            className="w-14 bg-white rounded px-1.5 py-1 text-[12px] text-black text-right outline-none border border-black/15 focus:border-[#8B5CF6]"
          />
          <span className="text-[10px] text-black/35">€{priceUnitLabel}</span>
        </div>
      </div>
    </div>
  );
}
// Sélecteur d'ingrédient avec recherche (remplace un <select> qui deviendrait interminable).
// Tape au moins 2 lettres pour filtrer, clique une suggestion pour choisir. Sert désormais
// surtout à CORRIGER une ligne existante — l'ajout passe par QuickAddLine ci-dessus.
export function IngredientPicker({
  ingredients, value, displayName, onChange, className, autoOpen, placeholder, onCreateNew, createNewLabel,
  searchPlaceholder = "Tape 2 lettres…", typeToSearchText = "Tape pour chercher…", noResultsText = "Aucun résultat",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const current = ingredients.find((i) => i.id === value);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    } else if (wrapRef.current) {
      // Recentre la carte à l'écran pour que les suggestions ne se retrouvent pas
      // masquées sous le clavier mobile.
      setTimeout(() => wrapRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
    }
  }, [open]);

  // Rien affiché tant que l'utilisateur n'a pas commencé à taper (sinon les 8 premiers ingrédients
  // du garde-manger apparaissaient dès l'ouverture, avant même toute recherche — bruit inutile
  // repéré en test réel, 2026-08).
  const filtered =
    query.trim().length >= 2
      ? ingredients.filter((i) => textIncludes(displayName(i), query)).slice(0, 8)
      : [];

  return (
    <div className={`relative ${className || ""}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left truncate outline-none"
      >
        {current ? displayName(current) : <span className="opacity-40">{placeholder || "…"}</span>}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-56 max-w-[80vw] rounded-xl overflow-hidden shadow-xl border border-white/10" style={{ background: "#26221C" }}>
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/10">
            <Search size={12} className="text-white/40 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-white text-xs outline-none min-w-0"
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((i) => (
              <button
                key={i.id}
                onMouseDown={(e) => { e.preventDefault(); onChange(i.id); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-white/10 ${i.id === value ? "text-[#8B5CF6]" : "text-white/80"}`}
              >
                {displayName(i)}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-white/30">
                {query.trim().length === 0 ? typeToSearchText : noResultsText}
              </div>
            )}
          </div>
          {onCreateNew && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onCreateNew(query.trim()); setOpen(false); }}
              className="w-full text-left px-2.5 py-2 text-xs text-[#8B5CF6] hover:bg-white/10 border-t border-white/10 flex items-center gap-1.5"
            >
              <Plus size={12} className="shrink-0" /> {createNewLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
