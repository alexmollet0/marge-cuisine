import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Logo, BRAND_SOLID, ALLERGEN_LABELS, categoryLabel, TR } from "./App.jsx";

// Polices dédiées (2026-08-19, v6) — la v2 réutilisait Oswald/Manrope (les polices de l'app)
// partout, ce qui donnait un rendu "outil SaaS" plutôt que "carte de restaurant" (retour direct
// de l'utilisateur : "c'est vraiment trop trop basique"). Chargées uniquement sur cette page
// publique (pas dans le reste de l'app), même technique que les pages légales statiques
// (`public/mentions-legales.html`) : un `@import` Google Fonts, jamais bloquant si indisponible
// (repli sur les polices système déjà prévues par Tailwind).
const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Fredoka:wght@500;600;700&display=swap');";

// Petits pictogrammes emoji plutôt qu'une icône lucide dédiée par allergène : lucide n'a pas
// d'icône fiable pour la moitié de ces allergènes (sulfites, céleri, fruits à coque...), alors
// qu'un emoji est garanti disponible sans dépendance supplémentaire et reste lisible sur mobile,
// là où cette page sera presque toujours consultée (scan d'un QR code à table).
const ALLERGEN_ICONS = {
  gluten: "🌾", lait: "🥛", oeufs: "🥚", sulfites: "🍷", poisson: "🐟",
  crustaces: "🦐", mollusques: "🐚", moutarde: "🧂", soja: "🌱", celeri: "🥬", fruits_a_coque: "🥜",
};

// 4 designs volontairement très différents dans leur STRUCTURE et leur typographie, pas
// seulement leur couleur (retour utilisateur, 2026-08-18 puis 2026-08-19). `classic`/`modern`
// restent dans l'identité sombre Chefup ; `elegant`/`bistro` en sortent délibérément pour évoquer
// un vrai type d'établissement (gastronomique / bistrot de quartier). Chaque design a maintenant
// un fond de PAGE (`pageBg`) distinct du fond de CARTE (`panel`) — la carte flotte sur la page
// comme un vrai menu posé sur une table, plutôt que du texte à même un fond plat.
const THEMES = {
  classic: {
    pageBg: "#100E0C", panel: "#211D18", text: "#FFFFFF", muted: "rgba(255,255,255,0.55)",
    border: "rgba(255,255,255,0.12)", headingFont: "'Oswald', sans-serif",
  },
  modern: {
    pageBg: "#100E0C", panel: "#211D18", text: "#FFFFFF", muted: "rgba(255,255,255,0.55)",
    border: "rgba(255,255,255,0.12)", headingFont: "'Oswald', sans-serif",
  },
  elegant: {
    pageBg: "#E7DDC4", panel: "#FFFCF6", text: "#2A2016", muted: "rgba(42,32,22,0.62)",
    border: "rgba(42,32,22,0.18)", headingFont: "'Playfair Display', serif",
  },
  bistro: {
    pageBg: "#341210", panel: "#6B2B22", text: "#FBF0E1", muted: "rgba(251,240,225,0.78)",
    border: "rgba(251,240,225,0.22)", headingFont: "'Fredoka', sans-serif",
  },
};

function guessMenuLang() {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "fr";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("en")) return "en";
  return "fr";
}

// Regroupe les plats par section définie par le restaurateur (`customCategories`, voir
// DigitalMenuModal) dans l'ordre choisi par le restaurateur (flèches haut/bas côté app, v6),
// plutôt que de tout mélanger dans une seule liste. Les plats sans section reconnue sont
// regroupés à la fin, sans en-tête. Le nom de section est résolu dans la langue choisie par le
// CLIENT sur cette page (`lang`), pas celle du restaurateur — traduit automatiquement à la
// création (voir DigitalMenuModal, v4).
function groupByCategory(recipes, customCategories, lang) {
  const groups = customCategories
    .map((c) => ({ id: c.id, name: categoryLabel(c, lang), items: recipes.filter((r) => r.menuCategory === c.id) }))
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
  // Vrai lien de retour plutôt qu'une iframe (2026-08-19, 2e essai — la 1ère tentative en iframe
  // se comportait mal en pratique, signalé par l'utilisateur) : un simple `<a href="/">` fonctionne
  // partout, y compris sans bouton retour de navigateur visible (app ajoutée à l'écran d'accueil
  // sur téléphone). N'apparaît que si la carte a été ouverte depuis "Voir la carte" dans l'app
  // (`?preview=1`) — jamais pour un vrai client qui scanne le QR code, qui n'a rien à faire de ce
  // lien puisqu'il n'a pas de compte Chefup.
  const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";
  const BackLink = isPreview ? (
    <a href="/" className="fixed top-3 left-3 z-20 flex items-center gap-1 text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 bg-black/70 text-white backdrop-blur-sm">
      ← Chefup
    </a>
  ) : null;

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
        {BackLink}
        <Loader2 className="animate-spin" style={{ color: BRAND_SOLID }} size={28} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center font-body" style={{ background: "#1B1815" }}>
        {BackLink}
        <Logo size={30} />
        <p className="text-white/60 text-sm mt-4">{t("publicMenuNotAvailable")}</p>
      </div>
    );
  }

  const { restaurantName, design, logo, accentColor, customCategories, recipes } = state.data;
  const theme = THEMES[design] || THEMES.classic;
  const accent = accentColor || BRAND_SOLID;
  const sections = groupByCategory(recipes, customCategories || [], lang);
  const Dish = design === "elegant" ? ElegantDish : design === "bistro" ? BistroDish : ClassicDish;
  // Barre de sections cliquables, pour sauter directement à "Boissons" sans faire défiler toute
  // la carte — demandé explicitement par l'utilisateur ("il faut mettre les choses dans l'ordre
  // c'est chiant"). N'a de sens qu'à partir de 2 sections nommées ; la section "reste" (plats
  // sans section, `name: null`) n'a pas de pastille puisqu'elle n'a pas de titre à afficher.
  const navSections = sections.filter((s) => s.name);
  const jumpTo = (id) => {
    document.getElementById(`menu-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const LangSwitcher = (
    <div className="flex items-center justify-center gap-1.5 mb-5">
      <button type="button" onClick={() => setLang("fr")} className={`text-lg leading-none ${lang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
      <button type="button" onClick={() => setLang("es")} className={`text-lg leading-none ${lang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
      <button type="button" onClick={() => setLang("en")} className={`text-lg leading-none ${lang === "en" ? "" : "opacity-40 grayscale"}`} title="English">🇬🇧</button>
    </div>
  );

  return (
    <div className="min-h-screen font-body" style={{ background: theme.pageBg }}>
      <style>{FONT_IMPORT}</style>
      {BackLink}
      <div className="max-w-lg mx-auto px-3 py-6 sm:py-10">
        {/* Carte posée sur la page, plutôt que du texte à même un fond plat (v6) */}
        <div
          className="rounded-3xl border"
          style={{ background: theme.panel, borderColor: theme.border, boxShadow: "0 24px 60px -16px rgba(0,0,0,0.5)" }}
        >
          <div className="px-5 py-9 sm:px-9 sm:py-11">
            <div className="flex flex-col items-center mb-2">
              {logo ? (
                <img src={logo} alt="" className="w-14 h-14 object-contain rounded-lg" />
              ) : (
                <Logo size={30} />
              )}
              <h1
                className="text-2xl sm:text-3xl tracking-wide mt-3 text-center"
                style={{
                  color: theme.text,
                  fontFamily: theme.headingFont,
                  fontStyle: design === "elegant" ? "italic" : "normal",
                  fontWeight: design === "elegant" ? 600 : 700,
                  textTransform: design === "elegant" ? "none" : "uppercase",
                }}
              >
                {restaurantName || "Chefup"}
              </h1>
              <div className="h-px w-16 mt-4" style={{ background: accent }} />
            </div>
            {LangSwitcher}

            {navSections.length >= 2 && (
              <div
                className="sticky top-0 z-10 py-2 mb-3 flex items-center gap-2 overflow-x-auto"
                style={{ background: theme.panel }}
              >
                {navSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => jumpTo(s.id)}
                    className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wide rounded-full px-3 py-1.5 border"
                    style={{ borderColor: accent, color: theme.text, fontFamily: theme.headingFont }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {recipes.length === 0 ? (
              <p className="text-center text-sm mt-10" style={{ color: theme.muted }}>{t("publicMenuNoDishes")}</p>
            ) : (
              sections.map((section) => (
                <div key={section.id} id={`menu-section-${section.id}`} className="mt-8 first:mt-4 scroll-mt-16">
                  <SectionHeader design={design} name={section.name} accent={accent} theme={theme} />
                  {design === "modern" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {section.items.map((r) => (
                        <div key={r.id} className="rounded-2xl p-4 border" style={{ background: theme.pageBg, borderColor: theme.border }}>
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
      </div>
    </div>
  );
}

function SectionHeader({ design, name, accent, theme }) {
  if (!name) return null;
  const fontStyle = { fontFamily: theme.headingFont };
  if (design === "elegant") {
    return (
      <div className="flex items-center gap-3 justify-center mb-5">
        <span className="h-px flex-1 max-w-[36px]" style={{ background: accent }} />
        <h2 className="text-sm italic tracking-wide shrink-0" style={{ color: theme.text, ...fontStyle, fontWeight: 600 }}>{name}</h2>
        <span className="h-px flex-1 max-w-[36px]" style={{ background: accent }} />
      </div>
    );
  }
  if (design === "bistro") {
    return (
      <div className="flex justify-center mb-4">
        <span
          className="rounded-full px-5 py-1.5 text-sm text-white"
          style={{ background: accent, ...fontStyle, fontWeight: 600 }}
        >
          {name}
        </span>
      </div>
    );
  }
  return (
    <h2 className="text-center uppercase text-xs tracking-[0.2em] mb-3" style={{ color: accent, ...fontStyle, fontWeight: 600 }}>{name}</h2>
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

// Design "Classique"/"Moderne" : liste ou grille sobre, identité Chefup, typographie Oswald.
function ClassicDish({ r, lang, accent, theme }) {
  const description = r.menuDescription?.[lang] || "";
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="uppercase text-sm tracking-wide" style={{ color: theme.text, fontFamily: theme.headingFont, fontWeight: 600 }}>{r.name}</h3>
        <span className="text-sm font-semibold shrink-0" style={{ color: accent }}>{r.sellPrice.toFixed(2)} €</span>
      </div>
      {description && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: theme.muted }}>{description}</p>}
      <AllergenChips codes={r.allergenCodes} lang={lang} textColor={theme.muted} />
    </>
  );
}

// Design "Élégant" : ticket gastronomique — nom en Playfair Display, nom et prix reliés par une
// ligne pointillée, description en italique discrète, fond crème/papier plutôt que sombre.
function ElegantDish({ r, lang, accent, theme }) {
  const description = r.menuDescription?.[lang] || "";
  return (
    <div>
      <div className="flex items-end gap-2">
        <h3 className="text-base tracking-wide shrink-0" style={{ color: theme.text, fontFamily: theme.headingFont, fontWeight: 600 }}>{r.name}</h3>
        <span className="flex-1 border-b mb-1.5" style={{ borderStyle: "dotted", borderColor: theme.border }} />
        <span className="text-sm font-semibold shrink-0" style={{ color: accent }}>{r.sellPrice.toFixed(2)} €</span>
      </div>
      {description && <p className="text-xs mt-1 italic" style={{ color: theme.muted }}>{description}</p>}
      <AllergenChips codes={r.allergenCodes} lang={lang} textColor={theme.muted} />
    </div>
  );
}

// Design "Bistrot" : cartes chaleureuses, typographie Fredoka arrondie, liseré de couleur, prix
// en pastille — plus casual et convivial qu'une table gastronomique.
function BistroDish({ r, lang, accent, theme }) {
  const description = r.menuDescription?.[lang] || "";
  return (
    <div className="rounded-xl p-3.5 border-l-4" style={{ background: theme.pageBg, borderColor: accent }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm tracking-wide" style={{ color: theme.text, fontFamily: theme.headingFont, fontWeight: 600 }}>{r.name}</h3>
        <span className="text-xs font-bold rounded-full px-2.5 py-1 shrink-0 text-white" style={{ background: accent }}>
          {r.sellPrice.toFixed(2)} €
        </span>
      </div>
      {description && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: theme.muted }}>{description}</p>}
      <AllergenChips codes={r.allergenCodes} lang={lang} textColor={theme.muted} />
    </div>
  );
}
