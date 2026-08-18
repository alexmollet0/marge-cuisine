import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Logo, BRAND_SOLID, ALLERGEN_LABELS, TR } from "./App.jsx";

// Petits pictogrammes emoji plutôt qu'une icône lucide dédiée par allergène : lucide n'a pas
// d'icône fiable pour la moitié de ces allergènes (sulfites, céleri, fruits à coque...), alors
// qu'un emoji est garanti disponible sans dépendance supplémentaire et reste lisible sur mobile,
// là où cette page sera presque toujours consultée (scan d'un QR code à table).
const ALLERGEN_ICONS = {
  gluten: "🌾", lait: "🥛", oeufs: "🥚", sulfites: "🍷", poisson: "🐟",
  crustaces: "🦐", mollusques: "🐚", moutarde: "🧂", soja: "🌱", celeri: "🥬", fruits_a_coque: "🥜",
};

// 4 designs (2026-08-18, v2) volontairement très différents dans leur STRUCTURE, pas seulement
// leur couleur — un premier retour utilisateur a jugé la v1 (2 designs qui ne changeaient qu'une
// couleur de prix) "trop tech" pour une carte de restaurant. `classic`/`modern` restent sombres
// (identité Chefup) ; `elegant`/`bistro` sortent délibérément de cette palette pour évoquer un
// vrai type d'établissement (gastronomique / bistrot de quartier).
const THEMES = {
  classic: { bg: "#1B1815", panel: "#26221C", text: "#FFFFFF", muted: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.12)" },
  modern: { bg: "#1B1815", panel: "#26221C", text: "#FFFFFF", muted: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.12)" },
  elegant: { bg: "#F6F0E4", panel: "#FFFFFF", text: "#2A2016", muted: "rgba(42,32,22,0.6)", border: "rgba(42,32,22,0.2)" },
  bistro: { bg: "#54221C", panel: "#71322A", text: "#FBF0E1", muted: "rgba(251,240,225,0.75)", border: "rgba(251,240,225,0.25)" },
};

function guessMenuLang() {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "fr";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("en")) return "en";
  return "fr";
}

// Regroupe les plats par section définie par le restaurateur (`customCategories`, voir
// DigitalMenuModal) dans l'ordre où il les a créées, plutôt que de tout mélanger dans une seule
// liste — demandé explicitement par l'utilisateur ("sinon toutes ses recettes seront mélangées
// n'importe comment"). Les plats sans section reconnue sont regroupés à la fin, sans en-tête.
function groupByCategory(recipes, customCategories) {
  const groups = customCategories
    .map((c) => ({ id: c.id, name: c.name, items: recipes.filter((r) => r.menuCategory === c.id) }))
    .filter((g) => g.items.length > 0);
  const rest = recipes.filter((r) => !customCategories.some((c) => c.id === r.menuCategory));
  if (rest.length > 0) groups.push({ id: "_rest", name: null, items: rest });
  return groups;
}

// Carte publique d'un restaurant, générée à partir de ses recettes déjà chiffrées dans Chefup
// (voir DigitalMenuModal, src/App.jsx) — page sans connexion, ouverte via un QR code ou un lien
// direct (getchefup.com/menu/<id>). Ne reçoit du serveur (api/public-menu.js) QUE ce qui est
// destiné au client d'un restaurant : nom du plat, description, prix de vente, allergènes —
// jamais de coût, de marge ni de donnée de compte.
export default function PublicMenu({ menuId }) {
  const [lang, setLang] = useState(guessMenuLang);
  const [state, setState] = useState({ status: "loading", data: null });
  const t = (key) => TR[lang]?.[key] ?? TR.fr[key] ?? key;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public-menu?id=${encodeURIComponent(menuId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("not_available");
        return res.json();
      })
      .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
      .catch(() => { if (!cancelled) setState({ status: "error", data: null }); });
    return () => { cancelled = true; };
  }, [menuId]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#1B1815" }}>
        <Loader2 className="animate-spin" style={{ color: BRAND_SOLID }} size={28} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center font-body" style={{ background: "#1B1815" }}>
        <Logo size={30} />
        <p className="text-white/60 text-sm mt-4">{t("publicMenuNotAvailable")}</p>
      </div>
    );
  }

  const { restaurantName, design, logo, accentColor, customCategories, recipes } = state.data;
  const theme = THEMES[design] || THEMES.classic;
  const accent = accentColor || BRAND_SOLID;
  const sections = groupByCategory(recipes, customCategories || []);
  const Dish = design === "elegant" ? ElegantDish : design === "bistro" ? BistroDish : ClassicDish;

  const LangSwitcher = (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      <button type="button" onClick={() => setLang("fr")} className={`text-lg leading-none ${lang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
      <button type="button" onClick={() => setLang("es")} className={`text-lg leading-none ${lang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
      <button type="button" onClick={() => setLang("en")} className={`text-lg leading-none ${lang === "en" ? "" : "opacity-40 grayscale"}`} title="English">🇬🇧</button>
    </div>
  );

  return (
    <div className="min-h-screen font-body" style={{ background: theme.bg }}>
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-14">
        <div className="flex flex-col items-center mb-2">
          {logo ? <img src={logo} alt="" className="w-14 h-14 object-contain rounded-lg" /> : <Logo size={32} />}
          <h1 className="font-display text-xl tracking-wide uppercase mt-2 text-center" style={{ color: theme.text }}>
            {restaurantName || "Chefup"}
          </h1>
          {design === "elegant" && <div className="h-px w-16 mt-3" style={{ background: accent }} />}
        </div>
        {LangSwitcher}

        {recipes.length === 0 ? (
          <p className="text-center text-sm mt-10" style={{ color: theme.muted }}>{t("publicMenuNoDishes")}</p>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="mt-8 first:mt-6">
              <SectionHeader design={design} name={section.name} accent={accent} theme={theme} />
              {design === "modern" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {section.items.map((r) => (
                    <div key={r.id} className="rounded-2xl p-4 border" style={{ background: theme.panel, borderColor: theme.border }}>
                      <Dish r={r} lang={lang} accent={accent} theme={theme} />
                    </div>
                  ))}
                </div>
              ) : design === "bistro" ? (
                <div className="space-y-3">
                  {section.items.map((r) => (
                    <Dish key={r.id} r={r} lang={lang} accent={accent} theme={theme} />
                  ))}
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: theme.border }}>
                  {section.items.map((r) => (
                    <div key={r.id} className="py-4">
                      <Dish r={r} lang={lang} accent={accent} theme={theme} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <div className="text-center mt-12 text-[10px]" style={{ color: theme.muted, opacity: 0.7 }}>
          {t("publicMenuPoweredBy")}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ design, name, accent, theme }) {
  if (!name) return null;
  if (design === "elegant") {
    return (
      <div className="flex items-center gap-3 justify-center mb-4">
        <span className="h-px flex-1 max-w-[40px]" style={{ background: accent }} />
        <h2 className="text-xs tracking-[0.25em] uppercase font-display shrink-0" style={{ color: theme.text }}>{name}</h2>
        <span className="h-px flex-1 max-w-[40px]" style={{ background: accent }} />
      </div>
    );
  }
  if (design === "bistro") {
    return (
      <div className="flex justify-center mb-4">
        <span className="rounded-full px-4 py-1.5 text-xs tracking-widest uppercase font-display text-white" style={{ background: accent }}>
          {name}
        </span>
      </div>
    );
  }
  return (
    <h2 className="text-center font-display uppercase text-xs tracking-widest mb-3" style={{ color: accent }}>{name}</h2>
  );
}

function AllergenChips({ codes, lang, textColor }) {
  if (!codes.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {codes.map((code) => (
        ALLERGEN_LABELS[code] ? (
          <span
            key={code}
            title={ALLERGEN_LABELS[code][lang] || ALLERGEN_LABELS[code].fr}
            className="flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5"
            style={{ color: textColor, background: "rgba(128,128,128,0.15)" }}
          >
            <span>{ALLERGEN_ICONS[code] || "⚠️"}</span>
            {ALLERGEN_LABELS[code][lang] || ALLERGEN_LABELS[code].fr}
          </span>
        ) : null
      ))}
    </div>
  );
}

// Design "Classique"/"Moderne" : liste ou grille sobre, cohérente avec l'identité visuelle Chefup.
function ClassicDish({ r, lang, accent, theme }) {
  const description = r.menuDescription?.[lang] || "";
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display uppercase text-sm tracking-wide" style={{ color: theme.text }}>{r.name}</h3>
        <span className="text-sm font-semibold shrink-0" style={{ color: accent }}>{r.sellPrice.toFixed(2)} €</span>
      </div>
      {description && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: theme.muted }}>{description}</p>}
      <AllergenChips codes={r.allergenCodes} lang={lang} textColor={theme.muted} />
    </>
  );
}

// Design "Élégant" : ticket gastronomique classique — nom et prix reliés par une ligne pointillée,
// description en italique discrète, fond clair/crème plutôt que le sombre habituel de l'app.
function ElegantDish({ r, lang, accent, theme }) {
  const description = r.menuDescription?.[lang] || "";
  return (
    <div>
      <div className="flex items-end gap-2">
        <h3 className="text-sm tracking-wide shrink-0" style={{ color: theme.text }}>{r.name}</h3>
        <span className="flex-1 border-b mb-1" style={{ borderStyle: "dotted", borderColor: theme.border }} />
        <span className="text-sm font-semibold shrink-0" style={{ color: accent }}>{r.sellPrice.toFixed(2)} €</span>
      </div>
      {description && <p className="text-xs mt-1 italic" style={{ color: theme.muted }}>{description}</p>}
      <AllergenChips codes={r.allergenCodes} lang={lang} textColor={theme.muted} />
    </div>
  );
}

// Design "Bistrot" : cartes chaleureuses avec liseré de couleur, prix en pastille — plus casual
// et convivial, pensé pour un bistrot de quartier plutôt qu'une table gastronomique.
function BistroDish({ r, lang, accent, theme }) {
  const description = r.menuDescription?.[lang] || "";
  return (
    <div className="rounded-xl p-3.5 border-l-4" style={{ background: theme.panel, borderColor: accent }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display uppercase text-sm tracking-wide" style={{ color: theme.text }}>{r.name}</h3>
        <span className="text-xs font-bold rounded-full px-2.5 py-1 shrink-0 text-white" style={{ background: accent }}>
          {r.sellPrice.toFixed(2)} €
        </span>
      </div>
      {description && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: theme.muted }}>{description}</p>}
      <AllergenChips codes={r.allergenCodes} lang={lang} textColor={theme.muted} />
    </div>
  );
}
