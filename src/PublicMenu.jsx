import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Logo, BRAND_SOLID, ALLERGEN_LABELS, MENU_CATEGORIES, MENU_CATEGORY_LABELS, TR } from "./App.jsx";

// Petits pictogrammes emoji plutôt qu'une icône lucide dédiée par allergène : lucide n'a pas
// d'icône fiable pour la moitié de ces allergènes (sulfites, céleri, fruits à coque...), alors
// qu'un emoji est garanti disponible sans dépendance supplémentaire et reste lisible sur mobile,
// là où cette page sera presque toujours consultée (scan d'un QR code à table).
const ALLERGEN_ICONS = {
  gluten: "🌾", lait: "🥛", oeufs: "🥚", sulfites: "🍷", poisson: "🐟",
  crustaces: "🦐", mollusques: "🐚", moutarde: "🧂", soja: "🌱", celeri: "🥬", fruits_a_coque: "🥜",
};

function guessMenuLang() {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "fr";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("en")) return "en";
  return "fr";
}

// Regroupe les plats par section de menu (entrée/plat/dessert/boisson) dans un ordre fixe, plutôt
// que de tout mélanger dans une seule liste — demandé explicitement par l'utilisateur après un
// premier retour ("sinon toutes ses recettes seront mélangées n'importe comment"). Les plats sans
// section assignée (`menuCategory` vide) sont regroupés à la fin, sans en-tête.
function groupByCategory(recipes) {
  const groups = MENU_CATEGORIES.map((cat) => ({ cat, items: recipes.filter((r) => r.menuCategory === cat) })).filter((g) => g.items.length > 0);
  const rest = recipes.filter((r) => !MENU_CATEGORIES.includes(r.menuCategory));
  if (rest.length > 0) groups.push({ cat: null, items: rest });
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

  const LangSwitcher = (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      <button type="button" onClick={() => setLang("fr")} className={`text-lg leading-none ${lang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
      <button type="button" onClick={() => setLang("es")} className={`text-lg leading-none ${lang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
      <button type="button" onClick={() => setLang("en")} className={`text-lg leading-none ${lang === "en" ? "" : "opacity-40 grayscale"}`} title="English">🇬🇧</button>
    </div>
  );

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

  const { restaurantName, design, logo, accentColor, recipes } = state.data;
  const accent = accentColor || BRAND_SOLID;
  const sections = groupByCategory(recipes);

  return (
    <div className="min-h-screen font-body" style={{ background: "#1B1815" }}>
      <div className="max-w-lg mx-auto px-4 py-10 sm:py-14">
        <div className="flex flex-col items-center mb-2">
          {logo ? <img src={logo} alt="" className="w-14 h-14 object-contain rounded-lg" /> : <Logo size={32} />}
          <h1 className="font-display text-white text-xl tracking-wide uppercase mt-2 text-center">
            {restaurantName || "Chefup"}
          </h1>
        </div>
        {LangSwitcher}

        {recipes.length === 0 ? (
          <p className="text-center text-white/40 text-sm mt-10">{t("publicMenuNoDishes")}</p>
        ) : (
          sections.map(({ cat, items }) => (
            <div key={cat || "_rest"} className="mt-8 first:mt-6">
              {cat && (
                <h2 className="text-center font-display uppercase text-xs tracking-widest mb-3" style={{ color: accent }}>
                  {MENU_CATEGORY_LABELS[cat][lang] || MENU_CATEGORY_LABELS[cat].fr}
                </h2>
              )}
              {design === "modern" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((r) => (
                    <div key={r.id} className="rounded-2xl p-4 border border-white/10" style={{ background: "#26221C" }}>
                      <MenuDish r={r} lang={lang} accent={accent} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {items.map((r) => (
                    <div key={r.id} className="py-4">
                      <MenuDish r={r} lang={lang} accent={accent} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <div className="text-center mt-12 text-[10px] text-white/25">
          {t("publicMenuPoweredBy")}
        </div>
      </div>
    </div>
  );
}

function MenuDish({ r, lang, accent }) {
  const description = r.menuDescription?.[lang] || "";
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-white font-display uppercase text-sm tracking-wide">{r.name}</h3>
        <span className="text-sm font-semibold shrink-0" style={{ color: accent }}>
          {r.sellPrice.toFixed(2)} €
        </span>
      </div>
      {description && <p className="text-white/50 text-xs mt-1.5 leading-relaxed">{description}</p>}
      {r.allergenCodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {r.allergenCodes.map((code) => (
            ALLERGEN_LABELS[code] ? (
              <span
                key={code}
                title={ALLERGEN_LABELS[code][lang] || ALLERGEN_LABELS[code].fr}
                className="flex items-center gap-1 text-[10px] text-white/40 bg-white/5 rounded-full px-2 py-0.5"
              >
                <span>{ALLERGEN_ICONS[code] || "⚠️"}</span>
                {ALLERGEN_LABELS[code][lang] || ALLERGEN_LABELS[code].fr}
              </span>
            ) : null
          ))}
        </div>
      )}
    </>
  );
}
