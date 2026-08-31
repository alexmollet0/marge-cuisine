import React, { useState, useEffect, useCallback, useRef, useId } from "react";
import { storage } from "./storage.js";
import { supabase } from "./supabaseClient.js";
// [2026-08-28] Traductions extraites vers un fichier dédié pour réduire la taille de ce fichier
// (~9000 lignes) — pure donnée, voir translations.js. `TR` reste réexporté plus bas pour que
// Auth.jsx/Billing.jsx/Landing.jsx/PublicMenu.jsx n'aient rien à changer à leur import.
import { TR, CRITICAL_MARGIN } from "./translations.js";
export { TR };
// [2026-08-28] Catalogue produits/allergènes extrait vers un fichier dédié (même raison que
// translations.js). `ALLERGEN_LABELS` reste réexporté pour PublicMenu.jsx.
import {
  CATEGORIES, CAT_MAP, CATEGORY_ESTIMATE_PRICE, CATEGORY_DEFAULT_UNIT, CATALOG, CATALOG_MAP,
  normUnit, unitDisplayLabel, ALLERGEN_LABELS, ALLERGEN_MAP, ALLERGEN_NAME_KEYWORDS,
  normalizeDiacritics, textIncludes, normalizeAllergenText, ingredientSourceName,
  detectAllergenCodesSet, detectAllergens, detectAllergenCodes, matchAllergenCodesFromText,
  FECULENT_NAME_KEYWORDS, matchesFeculentKeywords, isProteinIngredient, isFeculentIngredient,
  recipeSuggestion,
} from "./catalog.js";
export { ALLERGEN_LABELS };
import { SEED_INGREDIENTS, SEED_RECIPE_NOTES, SEED_RECIPE_ALLERGENS, isPristineSeedRecipe, buildSeedRecipes } from "./seedData.js";
import { DEFAULT_SETTINGS, useDebouncedSave, activeSupplier, effectiveUnitPrice, priceVariation, logActivity } from "./pricing.js";
import {
  TIER_COLORS, PRICING, BRAND_SOLID, BRAND_SOLID_PAPER, BRAND_GRADIENT, BRAND_SHADOW,
  TOP_BADGE_COLORS, MENU_CATEGORIES, MENU_CATEGORY_LABELS, defaultMenuCategories, categoryLabel,
  MENU_ACCENT_COLORS, MENU_DESIGNS, DESIGN_LABEL_KEYS, priceChangeVisual, lightRawLabel,
} from "./brand.js";
export { TIER_COLORS, PRICING, BRAND_SOLID, BRAND_GRADIENT, BRAND_SHADOW, categoryLabel };
import { NumField, QtyField, QuickAddLine, IngredientPicker } from "./formComponents.jsx";
import { uid, today } from "./utils.js";
import { Logo } from "./Logo.jsx";
export { Logo };
import {
  ScanNameChoice, PricingCalculator, MenuRecipeRow, SimpleItemRow, SimpleItemsSection,
  DigitalMenuModal, ScanItemCard,
} from "./scannerComponents.jsx";
import { marginMessage, InstallDiagram, AdminDashboard, FirstRunWizard, FirstRunScanDemo, SCAN_ERR_CODES } from "./adminAndOnboarding.jsx";
import { MenuWizard } from "./MenuWizard.jsx";
import {
  Plus,
  LogOut,
  Trash2,
  AlertTriangle,
  Check,
  Copy,
  Printer,
  Receipt,
  History,
  Settings as SettingsIcon,
  Search,
  ChevronDown,
  ChevronUp,
  Camera,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Package,
  Pencil,
  Upload,
  Clock,
  ArrowLeft,
  ShieldCheck,
  Award,
  Percent,
  Tags,
  LayoutGrid,
  List,
  ClipboardList,
  Mail,
  User,
  Paperclip,
  RotateCcw,
  RotateCw,
  QrCode,
  Globe,
  LogIn,
  ChefHat,
  Smartphone,
  Share,
  MoreVertical,
  ArrowRight,
  RefreshCw,
  MailWarning,
  Info,
  Sparkles,
} from "lucide-react";




// [WOW ONBOARDING, 2026-08-31] Deux ingrédients "trouvés" par la fausse facture de démo juste
// après la création du premier plat (voir FirstRunScanDemo) — mêmes id que le vrai catalogue
// (cohérence des noms traduits + unité + catégorie avec le garde-manger), prix et quantités fixes
// choisis pour donner un coût plausible quel que soit le prix de vente saisi. Aucun appel réseau/IA
// : l'objectif est un résultat instantané et garanti, pas une vraie extraction.
const FIRST_RUN_DEMO_DATA = [
  { catalogId: "boeuf", unit: "kg", category: "viandes", price: 11.9, qty: 0.15 },
  { catalogId: "oignons", unit: "kg", category: "legumes", price: 1.8, qty: 0.05 },
];

export function marginTier(m, minMargin) {
  if (m === null || m === undefined) return null;
  const rounded = Math.round(m);
  if (rounded < CRITICAL_MARGIN) return "low";
  const target = Math.max(minMargin ?? 75, CRITICAL_MARGIN);
  if (rounded < target) return "mid";
  return "high";
}

export default function App() {
  const [ingredients, setIngredients] = useState(SEED_INGREDIENTS);
  const [recipes, setRecipes] = useState(buildSeedRecipes("fr"));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // Mémoire des rapprochements fournisseur → ingrédient déjà validés lors d'un scan précédent
  // (clé = texte brut de la ligne facture normalisé, valeur = id de l'ingrédient du garde-manger).
  const [supplierMappings, setSupplierMappings] = useState([]);
  // Réglages de la carte digitale publique (2026-08) : `published` contrôle tout seul si la page
  // publique répond quoi que ce soit (voir api/public-menu.js) — même si des recettes ont
  // `menuIncluded: true`, rien n'est visible tant que ce drapeau n'est pas activé explicitement.
  const [menuSettings, setMenuSettings] = useState({ published: false, design: "classic", restaurantName: "", logo: null, accentColor: MENU_ACCENT_COLORS[0] });
  // Articles simples de la carte digitale (2026-08-19) : boissons/produits revendus tels quels
  // (Coca, Perrier...) — volontairement PAS des recettes (jamais dans `recipes`), pour ne pas
  // polluer l'onglet Recettes/le classement TOP/les fiches imprimées avec des centaines de lignes
  // sans rapport avec le calcul de marge. Coût d'achat optionnel (`cost`, souvent absent — l'idée
  // est un ajout ultra-rapide, pas un vrai suivi de marge comme pour les recettes).
  const [simpleItems, setSimpleItems] = useState([]);
  // Id du compte, utilisé uniquement pour construire l'URL publique /menu/<id> (voir
  // DigitalMenuModal) — jamais stocké, récupéré une fois depuis la session déjà active
  // (AuthGate garantit qu'il y en a toujours une à ce stade).
  const [menuUserId, setMenuUserId] = useState(null);
  // Tableau de bord admin (2026-08-19) : visible uniquement depuis le compte personnel de
  // l'utilisateur, jamais pour un autre compte Chefup — vérifié aussi côté serveur
  // (api/admin-dashboard.js) puisque l'email pourrait en théorie être falsifié côté client.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setMenuUserId(data.session?.user?.id || null);
      setIsAdmin(data.session?.user?.email === "alexmollet0@gmail.com");
    });
  }, []);
  const [activeId, setActiveId] = useState("r1");
  // [BUG confirmé et corrigé, 2026-08-30] "Voir la carte" (ou tout autre retour déclenchant un
  // vrai rechargement complet, ex: bouton retour du navigateur après une navigation hors SPA)
  // ramenait TOUJOURS sur l'onglet Recettes, quel que soit l'onglet actif au moment du
  // rechargement — cet état n'a jamais vécu que dans un simple useState, jamais persisté nulle
  // part. Signalé par l'utilisateur : "je suis sur ma carte, je fais retour, je me retrouve à
  // l'accueil, je dois tout refaire". Même mécanisme que `recipeListLayout` juste en dessous
  // (préférence d'affichage locale, pas une donnée métier partagée entre appareils).
  const [activeTab, setActiveTab] = useState(() => {
    try { return localStorage.getItem("chefup:activeTab") || "recipes"; } catch { return "recipes"; }
  }); // 'recipes' | 'scanner' | 'pantry' | 'menu'
  useEffect(() => {
    try { localStorage.setItem("chefup:activeTab", activeTab); } catch {}
  }, [activeTab]);
  // Message de succès temporaire (2026-08-30) après avoir poussé un nouveau prix sur la carte
  // digitale (voir bouton juste sous le prix de vente, fiche recette) — id de la recette plutôt
  // qu'un simple booléen, pour ne jamais afficher le message sur la mauvaise recette si on
  // navigue vite entre deux fiches juste après avoir cliqué.
  const [menuPricePushedId, setMenuPricePushedId] = useState(null);
  const [hidePricesPrint, setHidePricesPrint] = useState(false);
  const [allergenSheetOpen, setAllergenSheetOpen] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [recipeSubView, setRecipeSubView] = useState("list"); // 'list' | 'detail'
  const [recipeListLayout, setRecipeListLayout] = useState(() => {
    try { return localStorage.getItem("chefup:recipeListLayout") || "list"; } catch { return "list"; }
  }); // 'list' | 'grid' — préférence d'affichage locale, pas une donnée métier (pas de sync compte)
  const [lang, setLang] = useState("fr");
  const [showSettings, setShowSettings] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalErr, setPortalErr] = useState("");
  const [showMarginLegend, setShowMarginLegend] = useState(false);
  const [ready, setReady] = useState(false);
  // Premier lancement guidé (2026-08-27). `null` = pas encore lu depuis le stockage : tant qu'on
  // ne sait pas, on n'affiche RIEN — afficher l'assistant à un utilisateur qui l'a déjà fait
  // serait bien pire que de ne pas l'afficher du tout à un nouveau.
  const [firstRunDone, setFirstRunDone] = useState(null);
  // Étape 2 du premier lancement (2026-08-31) : juste après avoir créé son premier plat, montre
  // l'effet d'un scan de facture (démo simulée) au lieu de le laisser seul sur une fiche vide —
  // voir FirstRunScanDemo. `wowMoment` déclenche un bref halo sur le panneau marge de la fiche
  // recette quand la démo vient de remplir ses ingrédients, pour que l'effet soit visible même
  // sans avoir suivi l'animation de la démo elle-même.
  const [firstRunScanStepOpen, setFirstRunScanStepOpen] = useState(false);
  const [wowMoment, setWowMoment] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);

  const [pantryQuery, setPantryQuery] = useState("");
  const [pantryCategory, setPantryCategory] = useState("none");
  const [expandedIngId, setExpandedIngId] = useState(null);
  // Sélection multiple dans la vue "Récents" uniquement — pour qu'un client qui a ajouté/scanné
  // une cinquantaine d'ingrédients par erreur (bug utilisateur réel évoqué par l'utilisateur)
  // puisse les retirer lui-même en un clic, sans dépendre d'une intervention manuelle sur sa
  // base de données. Réinitialisée en changeant de catégorie pour ne jamais garder une sélection
  // périmée (ex: sur des ingrédients qui ne sont plus dans "Récents" après suppression d'un autre).
  const [selectedRecentIds, setSelectedRecentIds] = useState(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  useEffect(() => { setSelectedRecentIds(new Set()); }, [pantryCategory]);
  const [autoOpenIdx, setAutoOpenIdx] = useState(null);
  const [lossModalOpen, setLossModalOpen] = useState(false);
  // Ajout à la carte digitale depuis la fiche recette (2026-08-30) — voir le bouton dans l'en-tête
  // de la fiche. `menuCategories` = les sections de la carte, mêmes valeurs par défaut que
  // DigitalMenuModal/MenuWizard si le compte n'en a jamais créé.
  const menuCategories = menuSettings.customCategories?.length ? menuSettings.customCategories : defaultMenuCategories();
  const [addToMenuModalOpen, setAddToMenuModalOpen] = useState(false);
  const [addToMenuSection, setAddToMenuSection] = useState(null);
  const addRecipeToMenu = () => {
    if (!active) return;
    // Snapshot du prix au moment de l'ajout (voir `menuPrice`, plus bas dans la fiche) — c'est la
    // règle explicite de l'utilisateur : le prix suit automatiquement UNIQUEMENT à l'ajout, jamais
    // ensuite (il faut repasser par le bouton dédié pour pousser un changement de prix).
    updateRecipe({ menuIncluded: true, menuCategory: addToMenuSection, menuPrice: active.sellPrice });
    setAddToMenuModalOpen(false);
  };
  const [showQtyHint, setShowQtyHint] = useState(false);
  // Index de la ligne de recette dont le prix (du fournisseur actif) est en cours d'édition
  // directement depuis la fiche recette — demandé par l'utilisateur pour corriger rapidement un
  // prix estimé faux (ex: import scan) sans devoir aller jusqu'au garde-manger.
  const [editingLinePriceIdx, setEditingLinePriceIdx] = useState(null);
  // Nombre de portions cible pour "adapter les quantités" — distinct du champ portions de la
  // recette, qui lui ne recalcule rien (voir scaleRecipeToPortions).
  const [scaleTarget, setScaleTarget] = useState(0);

  // Formulaire de contact/réclamation : état totalement indépendant du reste.
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactErr, setContactErr] = useState(null);
  const [contactAttachment, setContactAttachment] = useState(null); // { base64, mediaType, fileName } | null
  const [contactAttaching, setContactAttaching] = useState(false);
  const fileInputContactRef = useRef(null);
  // Menu "Mon compte" (abonnement / nous contacter) : demandé par l'utilisateur pour ne plus les
  // enterrer dans la fenêtre Paramètres, plus accessible depuis l'en-tête comme dans la plupart
  // des apps (Paramètres reste réservé aux réglages de calcul : TVA, marge, rappels, réinitialiser).
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Installation sur l'écran d'accueil (2026-08-23) : bouton "Installer l'app" DANS le menu "Mon
  // compte", demandé par l'utilisateur après avoir cherché en vain un raccourci visible dans
  // l'app elle-même. `installPromptReady` reflète si Chrome/Edge a capturé l'invite native
  // (`window.__chefupInstallPrompt`, voir src/main.jsx) — si oui, un clic déclenche directement la
  // vraie boîte de dialogue d'installation du navigateur. Sinon (iOS Safari, qui n'expose AUCUN
  // moyen programmatique de déclencher "Sur l'écran d'accueil" — restriction Apple, pas une limite
  // de cette app — ou navigateur qui ne supporte pas l'installation), un clic affiche des
  // instructions à la place (`installInstructionsOpen`).
  const [installPromptReady, setInstallPromptReady] = useState(!!window.__chefupInstallPrompt);
  const [installInstructionsOpen, setInstallInstructionsOpen] = useState(false);
  // Bandeau discret sur l'écran d'accueil des recettes (2026-08-23) : le bouton dans "Mon compte"
  // était jugé trop caché par l'utilisateur. Ignorable sans y toucher (juste une croix, jamais
  // bloquant), mémorisé en localStorage pour ne plus jamais réapparaître une fois fermé.
  const [installBannerDismissed, setInstallBannerDismissed] = useState(() => {
    try { return localStorage.getItem("chefup:installBannerDismissed") === "1"; } catch { return false; }
  });
  const dismissInstallBanner = () => {
    setInstallBannerDismissed(true);
    try { localStorage.setItem("chefup:installBannerDismissed", "1"); } catch {}
  };
  // [AJOUT 2026-08-28] Bandeau "carte digitale" sur l'écran d'accueil, même mécanisme que le
  // bandeau d'installation ci-dessus (ignorable une bonne fois pour toutes, jamais bloquant) —
  // demandé par l'utilisateur pour que la carte digitale devienne une vraie "porte d'entrée",
  // pas juste un petit bouton enfoui dans l'en-tête de l'onglet Recettes (toujours là aussi,
  // inchangé). Condition volontairement large (`!menuSettings.published`, pas liée au nombre de
  // recettes/articles) : viser aussi bien un tout nouveau compte qu'un compte déjà actif qui n'a
  // simplement jamais publié sa carte.
  const [menuBannerDismissed, setMenuBannerDismissed] = useState(() => {
    try { return localStorage.getItem("chefup:menuBannerDismissed") === "1"; } catch { return false; }
  });
  const dismissMenuBanner = () => {
    setMenuBannerDismissed(true);
    try { localStorage.setItem("chefup:menuBannerDismissed", "1"); } catch {}
  };
  // Onglet carte digitale : l'éditeur guidé (MenuWizard) est la vue par défaut, l'écran de
  // réglages complet (logo, couleur d'accent, recettes sur la carte, traductions) devient un
  // "mode avancé" à la demande. État d'écran uniquement, jamais persisté — on repart toujours
  // sur la vue simple, qui couvre le geste courant (ajouter/modifier des plats).
  const [showMenuAdvanced, setShowMenuAdvanced] = useState(false);
  const isStandaloneApp =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator?.standalone === true);
  const isIOSDevice = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Sur iOS, TOUS les navigateurs (Chrome, Firefox, Edge...) tournent sur le même moteur que
  // Safari (imposé par Apple) et ont donc la même restriction — mais pas la même interface, donc
  // pas le même endroit où chercher "Ajouter à l'écran d'accueil". Cas réel remonté par
  // l'utilisateur : sur iPhone + app Chrome, les instructions "façon Safari" (bouton Partager en
  // bas) ne collent pas à l'interface réellement affichée. Chrome iOS s'identifie par "CriOS" dans
  // le user-agent (le "Chrome/" habituel n'y figure pas sur iOS).
  const isIOSChromeDevice = isIOSDevice && /CriOS/i.test(navigator.userAgent);
  useEffect(() => {
    const handler = () => setInstallPromptReady(!!window.__chefupInstallPrompt);
    window.addEventListener("chefup:install-available", handler);
    return () => window.removeEventListener("chefup:install-available", handler);
  }, []);
  const handleInstallClick = async () => {
    setAccountMenuOpen(false);
    const promptEvent = window.__chefupInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      try { await promptEvent.userChoice; } catch (e) {}
      window.__chefupInstallPrompt = null;
      setInstallPromptReady(false);
    } else {
      setInstallInstructionsOpen(true);
    }
  };

  const [addWizardOpen, setAddWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1 nom/recherche, 2 prix+unité, 3 catégorie (création only), "success"
  const [wizardQuery, setWizardQuery] = useState("");
  const [wizardData, setWizardData] = useState({ name: "", catalogId: null, unit: "kg", category: "autres", price: 0 });
  const [wizardEditId, setWizardEditId] = useState(null); // id de l'ingrédient existant en cours de modification, sinon null (création)
  // Index de la ligne de recette qui a ouvert l'assistant (création rapide depuis une recette),
  // pour lui assigner automatiquement l'ingrédient une fois créé/choisi — null si l'assistant a
  // été ouvert depuis le garde-manger, auquel cas rien de plus à faire après création.
  const [wizardReturnToLineIdx, setWizardReturnToLineIdx] = useState(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState(null);
  const [scanResult, setScanResult] = useState(null); // { supplier, date, items: [...] }
  // Aperçu de l'image EXACTE (déjà compressée) envoyée à l'IA — outil de diagnostic (2026-08) suite
  // à un cas réel où le scanner échouait systématiquement sur un téléphone précis alors qu'il
  // fonctionnait sur ordinateur avec la même facture papier, sans pouvoir accéder au téléphone pour
  // inspecter directement ce qui était envoyé. Permet à l'utilisateur de voir lui-même si l'image
  // est nette/bien orientée avant de suspecter le modèle d'IA.
  const [scanImagePreview, setScanImagePreview] = useState(null);
  const [scanImageZoomed, setScanImageZoomed] = useState(false);
  // Photo en attente de confirmation avant l'envoi à l'IA (2026-08) : une photo transmise par une
  // appli de messagerie a souvent perdu son étiquette de rotation EXIF (beaucoup d'applis la
  // suppriment ou l'altèrent en compressant à l'envoi) — dans ce cas `compressImageFile` n'a plus
  // rien à corriger automatiquement, la photo peut repartir tournée. Cas réel confirmé en test :
  // une vraie facture, envoyée par un tiers, restait tournée malgré le correctif d'orientation
  // automatique, et l'IA inventait des produits n'ayant aucun rapport avec le document plutôt que
  // d'admettre ne pas pouvoir le lire. Un bouton pivoter manuel avant analyse règle ce cas
  // universellement, sans dépendre de la fiabilité de la métadonnée EXIF.
  const [scanPendingImage, setScanPendingImage] = useState(null); // { base64, mediaType }
  // Étape en cours pendant l'analyse ("prepare" | "ocr" | "ai") — affichée à l'écran pour que
  // l'attente ne ressemble jamais à un blocage. Un scan peut prendre 30 à 60 secondes sur un
  // document dense : sans indication de progression, l'utilisateur croit que c'est planté et ferme.
  const [scanStep, setScanStep] = useState(null);
  // Dernière image réellement envoyée + par quel bouton le fichier est arrivé, pour proposer un
  // "Réessayer" en un seul tap après un échec au lieu de tout faire recommencer.
  const [lastScanImage, setLastScanImage] = useState(null); // { base64, mediaType }
  const [lastScanSource, setLastScanSource] = useState("file"); // "file" | "camera"
  const [reviewStackOpen, setReviewStackOpen] = useState(false);
  const [stackTotal, setStackTotal] = useState(0);
  const [expandedReviewIdx, setExpandedReviewIdx] = useState(null);
  const fileInputRef = useRef(null);
  const fileInputLibraryRef = useRef(null);

  // Scanner de fiche recette : état totalement séparé du scanner de factures ci-dessus (autre
  // fichier serveur, autre écran de vérification) pour ne jamais risquer de régresser le scanner
  // de factures existant en le touchant.
  const [scanRecipeOpen, setScanRecipeOpen] = useState(false);
  const [scanningRecipe, setScanningRecipe] = useState(false);
  const [scanRecipeErr, setScanRecipeErr] = useState(null);
  const [scanRecipeResult, setScanRecipeResult] = useState(null); // { name, portions, sellPrice, allergens, notes, lines: [...] }
  const fileInputRecipeLibraryRef = useRef(null);

  // Signale à main.jsx qu'un scan (facture ou fiche recette) est en cours — le mécanisme de
  // détection de bundle périmé (checkForNewVersion) recharge sinon la page sans avertissement dès
  // que l'onglet reprend le focus, ce qui arrive typiquement juste après avoir pris une photo avec
  // l'appareil photo natif du téléphone (quitter Chefup → photo → revenir = focus). Un rechargement
  // à ce moment précis efface la photo en attente et oblige à tout recommencer. Ce flag ne
  // supprime pas le rechargement, il le repousse simplement jusqu'à ce que le scan soit fermé.
  useEffect(() => {
    window.__chefupScanBusy = scanOpen || scanRecipeOpen;
    return () => { window.__chefupScanBusy = false; };
  }, [scanOpen, scanRecipeOpen]);

  const t = useCallback((key) => TR[lang][key] ?? TR.fr[key] ?? key, [lang]);
  const ingredientDisplayName = useCallback(
    (ing) => (ing?.catalogId && CATALOG_MAP[ing.catalogId] ? CATALOG_MAP[ing.catalogId][lang] : ing?.name || ""),
    [lang]
  );

  useEffect(() => {
    (async () => {
      try {
        let ing = null, rec = null, set = null, lg = null, sm = null, ms = null, si = null;
        try { const r = await storage.get("ingredients"); ing = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("recipes"); rec = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("settings"); set = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("lang"); lg = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("supplierMappings"); sm = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("menuSettings"); ms = r ? JSON.parse(r.value) : null; } catch (e) {}
        try { const r = await storage.get("simpleItems"); si = r ? JSON.parse(r.value) : null; } catch (e) {}
        // Drapeau du premier lancement guidé : stocké par COMPTE (kv_store) et non par appareil,
        // pour qu'un chef qui ouvre l'app sur son téléphone puis sur son ordinateur ne le revoie
        // pas une deuxième fois. Un échec de lecture laisse `false` : au pire l'assistant
        // s'affiche, il est passable en un clic.
        try { const r = await storage.get("firstRunDone"); setFirstRunDone(r ? JSON.parse(r.value) === true : false); }
        catch (e) { setFirstRunDone(false); }
        if (ing && ing.length) setIngredients(ing);
        // Nouvel utilisateur (rien encore enregistré) mais langue déjà connue (choisie avant que
        // le premier chargement se termine) : reconstruit la recette de démo dans cette langue
        // plutôt que de garder la version française par défaut du useState initial.
        if (rec && rec.length) { setRecipes(rec); setActiveId(rec[0].id); }
        else if (lg && lg !== "fr") { setRecipes(buildSeedRecipes(lg)); }
        if (set) setSettings({ ...DEFAULT_SETTINGS, ...set });
        if (lg) setLang(lg);
        if (sm && sm.length) setSupplierMappings(sm);
        if (ms) setMenuSettings({ published: false, design: "classic", restaurantName: "", logo: null, accentColor: MENU_ACCENT_COLORS[0], ...ms });
        if (si && si.length) setSimpleItems(si);
      } catch (e) {
        setLoadErr(true);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useDebouncedSave("ingredients", ingredients, ready);
  useDebouncedSave("recipes", recipes, ready);
  useDebouncedSave("settings", settings, ready);
  useDebouncedSave("lang", lang, ready);
  useDebouncedSave("supplierMappings", supplierMappings, ready);
  useDebouncedSave("menuSettings", menuSettings, ready);
  useDebouncedSave("simpleItems", simpleItems, ready);

  useEffect(() => {
    if (!ready) return;
    setRecipes((rs) => rs.map((r) => {
      if (r.allergensAuto === false) return r;
      const computed = detectAllergens(r.lines, ingredients, lang);
      const codes = detectAllergenCodes(r.lines, ingredients);
      const sameCodes = r.allergenCodes && r.allergenCodes.length === codes.length && r.allergenCodes.every((c, i) => c === codes[i]);
      if (computed === r.allergens && sameCodes) return r;
      return { ...r, allergens: computed, allergenCodes: codes };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ready]);

  useEffect(() => {
    if (!ready) return;
    setSavedPulse(true);
    const t2 = setTimeout(() => setSavedPulse(false), 900);
    return () => clearTimeout(t2);
  }, [ingredients, recipes, settings, ready]);

  const active = recipes.find((r) => r.id === activeId) || recipes[0];
  const ingredientById = useCallback((id) => ingredients.find((i) => i.id === id), [ingredients]);

  // [AJOUT 2026-08-28] Renommer était techniquement possible dès l'ouverture (le nom est un champ
  // texte), mais rien ne le signalait — un gros titre "NOUVELLE RECETTE" en majuscules se lit comme
  // un titre déjà là, pas comme la toute première chose à faire. Demandé par l'utilisateur ("c'est
  // la première chose qu'on doit faire quand on crée une recette"). `recipeNameInputRef` + ce
  // drapeau focalisent le champ ET sélectionnent tout son texte dès l'ouverture d'une recette
  // FRAÎCHEMENT créée via `addRecipe` (jamais sur la démo, jamais en rouvrant une recette
  // existante) — la première frappe remplace directement le placeholder, sans avoir à cliquer ni
  // à comprendre que c'est éditable.
  const recipeNameInputRef = useRef(null);
  const [focusNameOnOpen, setFocusNameOnOpen] = useState(false);
  useEffect(() => {
    if (!focusNameOnOpen || !recipeNameInputRef.current) return;
    recipeNameInputRef.current.focus();
    recipeNameInputRef.current.select();
    setFocusNameOnOpen(false);
  }, [focusNameOnOpen, active?.id]);

  const lineCost = (line) => {
    const ing = ingredientById(line.ingredientId);
    return ing ? effectiveUnitPrice(ing) * line.qty : 0;
  };

  // Vrai si au moins une ligne de cette recette a une quantité saisie dans une unité qui a changé
  // depuis (voir updateLineQty/changeLineIngredient) — sert à afficher un repère dans la liste des
  // recettes, pour ne pas avoir à ouvrir chaque fiche pour le découvrir.
  const recipeHasUnitMismatch = (r) =>
    r.lines.some((l) => {
      const ing = ingredientById(l.ingredientId);
      return ing && l.unitAtEntry !== undefined && l.unitAtEntry !== ing.unit;
    });

  // Compte encore totalement vierge : la seule recette est la démo non modifiée ET aucun prix réel
  // n'a jamais été saisi ou scanné. Condition volontairement stricte — mieux vaut rater l'assistant
  // pour quelqu'un qui a déjà touché à un truc que l'imposer à un utilisateur installé.
  const looksBrandNew =
    recipes.length <= 1 &&
    (recipes.length === 0 || isPristineSeedRecipe(recipes[0])) &&
    ingredients.every((i) => (activeSupplier(i)?.priceSource || "estimate") === "estimate");
  const showFirstRun = ready && firstRunDone === false && looksBrandNew;

  const closeFirstRun = () => {
    setFirstRunDone(true);
    storage.set("firstRunDone", JSON.stringify(true)).catch(() => {});
  };

  // Crée la recette vide (nom + prix de vente) et ouvre sa fiche : c'est là que le chef ajoutera
  // ses ingrédients, avec la vraie interface — voir le commentaire de FirstRunWizard pour pourquoi
  // on ne construit plus d'éditeur d'ingrédients séparé. La recette n'a volontairement AUCUNE
  // ligne : grâce au correctif de , elle n'affiche donc pas de marge tant qu'aucun
  // ingrédient n'est saisi, au lieu d'un 100% absurde.
  const finishFirstRun = ({ dishName, sellPrice }) => {
    const newRecipe = {
      id: uid(),
      name: dishName || t('newRecipeName'),
      // 1 portion : le chef a saisi le prix de vente d'UNE assiette.
      portions: 1,
      sellPrice: sellPrice || 0,
      targetMargin: settings.minMargin ?? 75,
      notes: '',
      allergens: '',
      allergensAuto: true,
      createdAt: today(),
      lines: [],
    };
    setRecipes((rs) => [...rs, newRecipe]);
    setActiveId(newRecipe.id);
    setActiveTab('recipes');
    setRecipeSubView('detail');
    closeFirstRun();
    // Enchaîne sur la démo de scan (voir FirstRunScanDemo) plutôt que de laisser le chef seul
    // face à une fiche vide — objectif explicite : un effet "wahou" dans les 2 premières minutes.
    setFirstRunScanStepOpen(true);
    logActivity('recipe_created', { name: newRecipe.name, source: 'first_run' });
  };

  // Résout les 2 ingrédients de démo dans la langue active — recalculé à chaque rendu (négligeable,
  // 2 entrées) plutôt que mémoïsé, pour rester trivialement correct si la langue change en cours de
  // route pendant que la démo est affichée.
  const firstRunDemoItems = FIRST_RUN_DEMO_DATA.map((d) => ({
    ...d,
    name: CATALOG.find((c) => c.id === d.catalogId)?.[lang] || d.catalogId,
    priceLabel: `${d.price.toFixed(2)}€/${d.unit}`,
  }));

  const closeFirstRunScanStep = () => setFirstRunScanStepOpen(false);

  // Ajoute les 2 ingrédients de démo au garde-manger ET comme lignes du plat qu'on vient de créer —
  // c'est ce qui rend la marge visible immédiatement en arrivant sur la fiche recette (voir
  // `margin !== null`, panneau "en un coup d'œil"). Aucun appel réseau : contrairement à un vrai
  // scan, cette action ne doit jamais pouvoir échouer.
  const finishFirstRunDemo = () => {
    const recipeId = activeId;
    const newIngredients = firstRunDemoItems.map((item) => {
      const sId = uid();
      return {
        id: uid(),
        name: item.name,
        unit: item.unit,
        catalogId: item.catalogId,
        category: item.category,
        selectedSupplierId: sId,
        suppliers: [{ id: sId, name: t('supplier'), price: item.price, priceSource: 'manual' }],
        history: [],
        lastUpdated: today(),
      };
    });
    setIngredients((ings) => [...ings, ...newIngredients]);
    const newLines = newIngredients.map((ing, i) => ({ ingredientId: ing.id, qty: firstRunDemoItems[i].qty, unitAtEntry: ing.unit }));
    setRecipes((rs) => rs.map((r) => (r.id === recipeId ? { ...r, lines: [...r.lines, ...newLines] } : r)));
    closeFirstRunScanStep();
    setWowMoment(true);
    setTimeout(() => setWowMoment(false), 4000);
    // meta.demo:true pour ne jamais fausser les vraies statistiques de scan du tableau de bord.
    logActivity('scan_invoice', { demo: true, foodItems: newIngredients.length, source: 'first_run' });
  };

  // "Scanner ma vraie facture maintenant" depuis la démo : on ne déclenche jamais le sélecteur de
  // fichier par programme (peu fiable selon les navigateurs) — on amène simplement le chef sur
  // l'onglet Scanner, déjà prêt avec ses boutons "prendre une photo"/"choisir un fichier".
  const skipDemoToRealScan = () => {
    closeFirstRunScanStep();
    setActiveTab('scanner');
  };

  // [PONT CARTE DIGITALE → MARGE, 2026-08-27] Transforme un article simple de la carte (nom + prix,
  // saisi en rafale, sans recette derrière) en vraie recette dont on pourra connaître la marge.
  // C'est la pièce qui manquait pour que la carte digitale serve de porte d'entrée : le chef
  // compose d'abord sa carte en quelques minutes (gratifiant, visible, aucun effort), puis
  // découvre plat par plat ce que chacun lui rapporte — au lieu de devoir créer des recettes
  // complètes avant d'avoir la moindre carte à montrer.
  const convertSimpleItemToRecipe = (item) => {
    if (!item) return;
    const lines = [];
    // Un coût déjà saisi sur l'article n'a nulle part où aller dans une recette : sans ce
    // traitement, la conversion afficherait 100% de marge et perdrait l'information. On le
    // matérialise donc en ingrédient "à la pièce" — ce qui est d'ailleurs la modélisation juste
    // pour un produit revendu tel quel (une bouteille achetée = une pièce consommée).
    if (item.cost > 0) {
      const sId = uid();
      const ingId = uid();
      setIngredients((ings) => [
        ...ings,
        {
          id: ingId,
          name: item.name || t("newRecipeName"),
          unit: "pièce",
          catalogId: null,
          category: "autres",
          selectedSupplierId: sId,
          suppliers: [{ id: sId, name: t("supplier"), price: item.cost, priceSource: "manual" }],
          history: [],
          lastUpdated: today(),
        },
      ]);
      lines.push({ ingredientId: ingId, qty: 1, unitAtEntry: "pièce" });
    }

    const newRecipe = {
      id: uid(),
      name: item.name || t("newRecipeName"),
      // 1 portion : le prix saisi sur la carte est celui d'UNE assiette vendue.
      portions: 1,
      sellPrice: item.sellPrice || 0,
      targetMargin: settings.minMargin ?? 75,
      notes: "",
      allergens: "",
      allergensAuto: true,
      createdAt: today(),
      lines,
      // Reprend la place de l'article sur la carte publique, avec sa section et sa traduction déjà
      // calculée — sinon le plat disparaîtrait de la carte au moment de la conversion, alors que
      // le chef n'a rien demandé de tel.
      menuIncluded: true,
      menuCategory: item.menuCategory || null,
      menuNameI18n: item.menuNameI18n || null,
    };
    setRecipes((rs) => [...rs, newRecipe]);
    // Indispensable : sans cette suppression, le plat apparaîtrait EN DOUBLE sur la carte publique
    // (une fois comme article simple, une fois comme recette).
    setSimpleItems((items) => items.filter((i) => i.id !== item.id));

    setActiveId(newRecipe.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
    logActivity("recipe_created", { name: newRecipe.name, source: "menu_item" });
  };

  const recipeCost = (r) => r.lines.reduce((s, l) => s + lineCost(l), 0);
  const recipeCostPerPortion = (r) => (r.portions > 0 ? recipeCost(r) / r.portions : 0);
  const vatRate = settings.vat ?? 10;
  const priceHT = (ttc) => ttc / (1 + vatRate / 100);
  const recipeMargin = (r) => {
    // [CORRECTION 2026-08-27] Une recette sans le moindre ingrédient n'a pas une marge de 100%,
    // elle a une marge INCONNUE. Le cas ne se produisait presque jamais avant (une recette créée à
    // la main démarre à 0€ de prix de vente, donc sans marge calculable), mais le pont
    // "article de carte → recette" arrive maintenant avec un prix de vente DÉJÀ renseigné et
    // aucune ligne : sans ce garde-fou, le chef verrait un magnifique 100% vert, et la recette
    // décrocherait même un badge TOP1 au classement.
    if (!r.lines || r.lines.length === 0) return null;
    const cpp = recipeCostPerPortion(r);
    const ht = priceHT(r.sellPrice || 0);
    return ht > 0 ? ((ht - cpp) / ht) * 100 : null;
  };

  // Classement TOP1/2/3 : uniquement les recettes déjà au-dessus de leur objectif de marge
  // (objectif propre à la recette si réglé, sinon le réglage global — même seuil que la
  // couleur verte), classées par marge % décroissante.
  const topRecipeIds = recipes
    .map((r) => ({ id: r.id, m: recipeMargin(r), target: r.targetMargin ?? settings.minMargin }))
    .filter((x) => x.m !== null && marginTier(x.m, x.target) === "high")
    .sort((a, b) => b.m - a.m)
    .slice(0, 3)
    .map((x) => x.id);

  const totalCost = active ? recipeCost(active) : 0;
  const costPerPortion = active ? recipeCostPerPortion(active) : 0;
  const sellHT = active ? priceHT(active.sellPrice || 0) : 0;
  const margin = active ? recipeMargin(active) : null;
  const targetMargin = active?.targetMargin ?? 75;
  const suggestedHT = active && targetMargin < 100 ? costPerPortion / (1 - targetMargin / 100) : null;
  const suggestedTTC = suggestedHT !== null ? suggestedHT * (1 + vatRate / 100) : null;
  // Règle : on ne propose un prix conseillé que si la marge actuelle n'atteint pas encore l'objectif.
  // Si l'objectif est déjà atteint ou dépassé, on ne suggère jamais un prix plus bas.
  // On compare la valeur ARRONDIE (celle affichée à l'écran) pour éviter qu'un 74.8% affiché "75%" reste bloqué.
  const marginRounded = margin !== null ? Math.round(margin) : null;
  const isBelowTarget = marginRounded !== null && marginRounded < targetMargin;
  const isAtOrAboveTarget = marginRounded !== null && marginRounded >= targetMargin;
  const nextMarginStep = marginRounded !== null ? Math.min(99, Math.ceil((marginRounded + 5) / 5) * 5) : null;

  const updateRecipe = (patch) => setRecipes((rs) => rs.map((r) => (r.id === active.id ? { ...r, ...patch } : r)));
  // [2026-08-27] Adapter une recette à un autre nombre de portions EN RECALCULANT les quantités.
  // Volontairement séparé du champ "portions" lui-même, qui reste inchangé — les deux usages
  // existent et sont contradictoires si on les mélange :
  //  · changer le champ portions SANS toucher aux quantités : le chef a saisi une préparation
  //    entière (3 kg de viande) et veut juste savoir combien ça fait par portion ;
  //  · adapter les quantités : le chef a saisi UNE assiette et veut imprimer sa fiche pour 10
  //    couverts, avec les grammages qui suivent.
  // Un champ qui ferait les deux serait forcément faux pour la moitié des utilisateurs, d'où une
  // action explicite et nommée plutôt qu'un comportement implicite.
  // Pré-rempli avec le nombre de portions actuel à chaque changement de recette : le chef part
  // toujours de la valeur en cours plutôt que d'un champ vide à deviner.
  useEffect(() => { if (active) setScaleTarget(active.portions || 1); }, [active?.id, active?.portions]);

  const scaleRecipeToPortions = (target) => {
    if (!active || !(target > 0)) return;
    const from = active.portions > 0 ? active.portions : 1;
    if (target === from) return;
    const ratio = target / from;
    const newLines = active.lines.map((l) => ({ ...l, qty: Math.round((l.qty || 0) * ratio * 100000) / 100000 }));
    const patch = { lines: newLines, portions: target };
    if (active.allergensAuto !== false) {
      patch.allergens = detectAllergens(newLines, ingredients, lang);
      patch.allergenCodes = detectAllergenCodes(newLines, ingredients);
    }
    updateRecipe(patch);
  };

  const applyLinesChange = (newLines) => {
    const patch = { lines: newLines };
    if (active.allergensAuto !== false) {
      patch.allergens = detectAllergens(newLines, ingredients, lang);
      patch.allergenCodes = detectAllergenCodes(newLines, ingredients);
    }
    updateRecipe(patch);
  };
  // `unitAtEntry` mémorise l'unité de l'ingrédient au moment où la quantité a été saisie/modifiée
  // — si l'unité de l'ingrédient change ensuite (ex: un scan de facture retrouve "Ail" en kg alors
  // qu'il était en "pièce"), la quantité déjà tapée n'a plus le même sens (2 gousses ≠ 2 kg) sans
  // que rien ne le signale. Comparer `unitAtEntry` à l'unité actuelle permet d'avertir sur la ligne
  // concernée. `undefined` (lignes déjà existantes avant ce correctif) ne déclenche jamais
  // l'avertissement, pour ne pas signaler a posteriori tout le garde-manger existant.
  const updateLineQty = (idx, qty) =>
    updateRecipe({
      lines: active.lines.map((l, i) => (i === idx ? { ...l, qty, unitAtEntry: ingredientById(l.ingredientId)?.unit } : l)),
    });
  const removeLine = (idx) => applyLinesChange(active.lines.filter((_, i) => i !== idx));
  const addLine = () => {
    const newIdx = active.lines.length;
    applyLinesChange([...active.lines, { ingredientId: null, qty: 1 }]);
    setAutoOpenIdx(newIdx);
  };
  const changeLineIngredient = (idx, ingredientId) =>
    applyLinesChange(active.lines.map((l, i) => (i === idx ? { ...l, ingredientId, unitAtEntry: ingredientById(ingredientId)?.unit } : l)));

  // [SAISIE EN RAFALE, 2026-08-27] Ajoute une ligne d'un coup : nom + quantité en grammes, sans
  // passer par "créer une ligne vide puis choisir puis saisir". Modelé sur la saisie des articles
  // de la carte digitale, que l'utilisateur trouvait justement rapide.
  // Si l'ingrédient n'existe pas encore dans le garde-manger, il est créé à la volée avec un prix
  // ESTIMÉ par catégorie (deviné via le catalogue) plutôt que d'interrompre la saisie pour
  // demander un prix : le badge "estimé" déjà existant signale ces prix, et le chef les corrige
  // quand il veut — le même compromis que celui déjà retenu pour le scanner de fiche recette.
  // Prix connu pour un nom tapé : celui du garde-manger si l'ingrédient existe, sinon l'estimation
  // de sa catégorie. Sert à pré-remplir le champ prix de la saisie rapide, pour que l'utilisateur
  // voie tout de suite sur quoi la marge va être calculée — et corrige si c'est manifestement faux.
  const guessPriceForName = (name) => {
    const known = ingredients.find((i) => textIncludes(ingredientDisplayName(i), name.trim()) && ingredientDisplayName(i).length <= name.trim().length + 3);
    if (known) return activeSupplier(known)?.price || 0;
    const guess = guessCatalogEntry(name);
    return CATEGORY_ESTIMATE_PRICE[guess?.category || "autres"] || 5;
  };

  // Unité proposée pour un nom tapé, dans l'ordre : ce que le garde-manger sait déjà de cet
  // ingrédient, puis ce que le catalogue en dit (il connaît l'unité de chacune de ses 195
  // entrées), puis kg par défaut.
  // ⚠️ Le repli est "kg" (donc des grammes) et surtout PAS `CATEGORY_DEFAULT_UNIT` : celui-ci
  // renvoie "pièce" pour la catégorie "autres", où atterrit tout nom inconnu du catalogue — c'est
  // ce qui a transformé "croûtons" en un article à 5€ LA PIÈCE alors que l'utilisateur voulait en
  // mettre 100 grammes. Un ingrédient de cuisine inconnu se pèse, il ne se compte pas.
  const guessUnitForName = (name) => {
    const known = ingredients.find((i) => textIncludes(ingredientDisplayName(i), name.trim()) && ingredientDisplayName(i).length <= name.trim().length + 3);
    if (known?.unit) return normUnit(known.unit);
    const guess = guessCatalogEntry(name);
    return guess?.unit || "kg";
  };

  const quickAddLine = ({ existingId, name, grams, unit: chosenUnit, price }) => {
    if (!active) return;
    let ingredientId = existingId;
    let unit = chosenUnit || "kg";

    if (!ingredientId) {
      const guess = guessCatalogEntry(name);
      const category = guess ? guess.category : "autres";
      const sId = uid();
      ingredientId = uid();
      setIngredients((ings) => [
        ...ings,
        {
          id: ingredientId,
          name: name.trim(),
          unit,
          catalogId: guess?.confident ? guess.catalogId : null,
          category,
          selectedSupplierId: sId,
          suppliers: [{ id: sId, name: t("supplier"), price: CATEGORY_ESTIMATE_PRICE[category] || 5, priceSource: "estimate" }],
          history: [],
          lastUpdated: today(),
        },
      ]);
    } else {
      // [BUG corrigé 2026-08-27] L'unité choisie par l'utilisateur était IGNORÉE pour un
      // ingrédient déjà connu : on reprenait systématiquement celle stockée. Résultat, un "Lait
      // entier" enregistré en kg par erreur restait en grammes même après avoir explicitement
      // cliqué "mL" — 100 mL devenaient 100 g, sans le moindre signe.
      // Choisir une autre unité que celle enregistrée est donc désormais interprété comme une
      // CORRECTION de l'ingrédient lui-même : c'est la seule lecture qui ait du sens.
      // ⚠️ Effet voulu et déjà géré ailleurs : les recettes qui utilisaient déjà cet ingrédient
      // afficheront l'avertissement d'unité changée (voir `unitAtEntry`), puisque leurs quantités
      // avaient été saisies dans l'ancienne unité.
      const existing = ingredientById(existingId);
      const current = normUnit(existing?.unit || "kg");
      if (chosenUnit && chosenUnit !== current) {
        unit = chosenUnit;
        setIngredients((ings) => ings.map((i) => (i.id === existingId ? { ...i, unit: chosenUnit } : i)));
      } else {
        unit = current;
      }
    }

    // Prix corrigé directement dans la ligne de saisie (2026-08-27) : évite d'avoir à ressortir
    // pour rectifier une estimation manifestement fausse, et rend la marge juste immédiatement.
    if (price > 0) {
      setIngredients((ings) =>
        ings.map((i) => {
          if (i.id !== ingredientId) return i;
          const sup = i.suppliers.find((s) => s.id === i.selectedSupplierId) || i.suppliers[0];
          if (!sup || sup.price === price) return i;
          return {
            ...i,
            suppliers: i.suppliers.map((s) => (s.id === sup.id ? { ...s, price, priceSource: "manual" } : s)),
            history: [...(i.history || []), { date: today(), price, supplierName: sup.name, supplierId: sup.id }].slice(-15),
            lastUpdated: today(),
          };
        })
      );
    }

    // Le nombre saisi est exprimé dans l'unité AFFICHÉE (g, mL ou pièce) : on le reconvertit vers
    // l'unité de stockage, qui reste le kg/L. Une pièce se prend telle quelle.
    const qty = unit === "kg" || unit === "L" ? (grams || 0) / 1000 : grams || 0;
    applyLinesChange([...active.lines, { ingredientId, qty, unitAtEntry: unit }]);
  };

  const addRecipe = () => {
    const nr = {
      id: uid(), name: t("newRecipeName"), portions: 4, sellPrice: 0, targetMargin: 75,
      notes: "", allergens: "", allergensAuto: true, createdAt: today(), lines: [],
    };
    setRecipes((rs) => [...rs, nr]);
    setActiveId(nr.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
    setFocusNameOnOpen(true);
    logActivity("recipe_created", { name: nr.name });
  };

  const duplicateRecipe = (r) => {
    const copy = { ...r, id: uid(), name: r.name + " (copie)", createdAt: today(), lines: r.lines.map((l) => ({ ...l })) };
    setRecipes((rs) => [...rs, copy]);
    setActiveId(copy.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
  };

  const deleteRecipe = (id) => {
    setRecipes((rs) => rs.filter((r) => r.id !== id));
    if (activeId === id) {
      const rest = recipes.filter((r) => r.id !== id);
      if (rest.length) setActiveId(rest[0].id);
    }
  };

  const confirmDeleteRecipe = (id, name) => {
    if (window.confirm(t("deleteRecipeConfirm")(name))) deleteRecipe(id);
  };

  const updateIngredientField = (id, field, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const updateIngredientName = (id, value) =>
    setIngredients((ings) => ings.map((i) => (i.id === id ? { ...i, name: value, catalogId: null } : i)));

  // Corrige le prix du fournisseur actif directement depuis une ligne de recette — même
  // ingrédient partagé que le garde-manger, donc le changement s'y répercute automatiquement.
  // Utile en particulier pour corriger vite un prix estimé faux (ex: ingrédient créé par erreur
  // via le scanner de fiche recette) sans devoir naviguer jusqu'au garde-manger.
  // [BUG confirmé et corrigé, 2026-08-27] Cette fonction écrivait une entrée d'HISTORIQUE à chaque
  // appel — or elle est branchée sur le `onChange` d'un champ texte, donc appelée à CHAQUE TOUCHE
  // FRAPPÉE. Taper "1.70" par-dessus "2.50" enregistrait donc successivement 1 puis 1.7, et
  // `priceVariation` (qui compare les deux dernières entrées) affichait fièrement **+70% de
  // hausse** sur un prix que l'utilisateur venait pourtant de BAISSER. Cas réel signalé sur
  // "Salade, laitue". Au passage, ça saturait l'historique (plafonné à 15 entrées) de valeurs
  // intermédiaires sans aucun sens, effaçant les vrais prix passés.
  // Le prix affiché continue de se mettre à jour à chaque touche (la marge se recalcule en direct,
  // c'est voulu) ; seul l'HISTORIQUE attend la fin de la saisie — voir commitActiveSupplierPrice.
  const updateActiveSupplierPrice = (ingredientId, newPrice) => {
    setIngredients((ings) =>
      ings.map((ing) => {
        if (ing.id !== ingredientId) return ing;
        const sup = activeSupplier(ing);
        if (!sup) return ing;
        return {
          ...ing,
          suppliers: ing.suppliers.map((s) => (s.id === sup.id ? { ...s, price: newPrice, priceSource: "manual" } : s)),
          lastUpdated: today(),
        };
      })
    );
  };

  // Enregistre le prix dans l'historique, une seule fois, quand la saisie est terminée (perte de
  // focus). La comparaison se fait avec la DERNIÈRE ENTRÉE D'HISTORIQUE du même fournisseur, et
  // non avec le prix courant : celui-ci a déjà été modifié en direct par la frappe, il ne peut
  // donc plus servir de point de comparaison.
  const commitActiveSupplierPrice = (ingredientId, newPrice) => {
    setIngredients((ings) =>
      ings.map((ing) => {
        if (ing.id !== ingredientId) return ing;
        const sup = activeSupplier(ing);
        if (!sup || !(newPrice > 0)) return ing;
        const hist = ing.history || [];
        const mine = hist.filter((e) => (e.supplierId ? e.supplierId === sup.id : e.supplierName === sup.name));
        const last = mine[mine.length - 1];
        if (last && last.price === newPrice) return ing; // rien de neuf à enregistrer
        return {
          ...ing,
          history: [...hist, { date: today(), price: newPrice, supplierName: sup.name, supplierId: sup.id }].slice(-15),
        };
      })
    );
  };

  const openAddWizard = (returnToLineIdx = null, prefillName = "") => {
    setWizardData({ name: prefillName, catalogId: null, unit: "kg", category: "autres", price: 0 });
    setWizardQuery(prefillName);
    setWizardEditId(null);
    setWizardReturnToLineIdx(returnToLineIdx);
    setWizardStep(1);
    setAddWizardOpen(true);
  };
  const closeAddWizard = () => {
    setAddWizardOpen(false);
    setWizardReturnToLineIdx(null);
    setWizardStep(1);
    setWizardEditId(null);
  };
  // Catégorie déjà connue (celle du catalogue) : on saute directement au prix, pas besoin de la
  // redemander.
  const pickWizardCatalog = (c) => {
    setWizardData({ name: c[lang], catalogId: c.id, unit: normUnit(c.unit), category: c.cat, price: 0 });
    setWizardEditId(null);
    setWizardStep(3);
  };
  // Nom inédit, catégorie inconnue : on la demande avant le prix (étape 2) plutôt que de deviner.
  const pickWizardCustom = (name) => {
    setWizardData((d) => ({ ...d, name: name || t("newIngredient"), catalogId: null }));
    setWizardEditId(null);
    setWizardStep(2);
  };
  // Catégorie déjà connue (celle de l'ingrédient existant) : direct au prix.
  const pickWizardExisting = (ing) => {
    const sup = activeSupplier(ing);
    setWizardData({
      name: ingredientDisplayName(ing),
      catalogId: ing.catalogId,
      unit: ing.unit,
      category: ing.category || "autres",
      price: sup?.price || 0,
    });
    setWizardEditId(ing.id);
    setWizardStep(3);
  };
  const finalizeWizard = () => {
    const sId = uid();
    const ni = {
      id: uid(),
      name: wizardData.name || t("newIngredient"),
      unit: wizardData.unit,
      catalogId: wizardData.catalogId,
      category: wizardData.category,
      selectedSupplierId: sId,
      suppliers: [{ id: sId, name: t("supplier"), price: wizardData.price || 0, priceSource: !wizardData.isEstimate && wizardData.price > 0 ? "manual" : "estimate" }],
      history: [],
      lastUpdated: today(),
    };
    setIngredients((ings) => [...ings, ni]);
    if (wizardReturnToLineIdx !== null) changeLineIngredient(wizardReturnToLineIdx, ni.id);
    setWizardStep("success");
    setTimeout(() => closeAddWizard(), 1300);
  };
  const finalizeEditWizard = () => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== wizardEditId) return i;
      const currentSup = i.suppliers.find((s) => s.id === i.selectedSupplierId) || i.suppliers[0];
      let suppliers, selectedSupplierId, history = i.history || [];
      if (currentSup) {
        if (wizardData.price !== currentSup.price) {
          history = [...history, { date: today(), price: wizardData.price, supplierName: currentSup.name, supplierId: currentSup.id }].slice(-15);
        }
        suppliers = i.suppliers.map((s) => (s.id === currentSup.id ? { ...s, price: wizardData.price, priceSource: wizardData.isEstimate ? "estimate" : "manual" } : s));
        selectedSupplierId = i.selectedSupplierId;
      } else {
        const sId = uid();
        suppliers = [{ id: sId, name: t("supplier"), price: wizardData.price, priceSource: wizardData.isEstimate ? "estimate" : "manual" }];
        selectedSupplierId = sId;
      }
      return { ...i, unit: wizardData.unit, suppliers, selectedSupplierId, history, lastUpdated: today() };
    }));
    if (wizardReturnToLineIdx !== null) changeLineIngredient(wizardReturnToLineIdx, wizardEditId);
    setWizardStep("success");
    setTimeout(() => closeAddWizard(), 1300);
  };

  const deleteIngredient = (id) => setIngredients((ings) => ings.filter((i) => i.id !== id));

  const toggleRecentSelection = (id) =>
    setSelectedRecentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteSelectedRecentIngredients = () => {
    setIngredients((ings) => ings.filter((i) => !selectedRecentIds.has(i.id)));
    setSelectedRecentIds(new Set());
    setBulkDeleteConfirmOpen(false);
  };
  const addSupplier = (ingId) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      const ns = { id: uid(), name: t("newSupplier"), price: activeSupplier(i)?.price || 1 };
      return { ...i, suppliers: [...i.suppliers, ns] };
    }));
  };
  // Même correctif que updateActiveSupplierPrice (2026-08-27) : ce champ prix est lui aussi
  // branché sur un `onChange` déclenché à chaque touche, il ne doit donc PLUS écrire l'historique
  // au fil de la frappe — sinon "1.70" laisse derrière lui une entrée 1 puis une entrée 1.7 et
  // fabrique une fausse hausse de +70%. L'enregistrement se fait à la fin de la saisie, via
  // commitSupplierPrice.
  const updateSupplier = (ingId, supId, field, value) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      const suppliers = i.suppliers.map((s) => {
        if (s.id !== supId) return s;
        if (field === "price") return { ...s, price: value, priceSource: "manual" };
        return { ...s, [field]: value };
      });
      return { ...i, suppliers, lastUpdated: field === "price" ? today() : i.lastUpdated };
    }));
  };

  const commitSupplierPrice = (ingId, supId, newPrice) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId || !(newPrice > 0)) return i;
      const sup = i.suppliers.find((s) => s.id === supId);
      if (!sup) return i;
      const hist = i.history || [];
      const mine = hist.filter((e) => (e.supplierId ? e.supplierId === supId : e.supplierName === sup.name));
      const last = mine[mine.length - 1];
      if (last && last.price === newPrice) return i;
      return { ...i, history: [...hist, { date: today(), price: newPrice, supplierName: sup.name, supplierId: supId }].slice(-15) };
    }));
  };
  const removeSupplier = (ingId, supId) => {
    setIngredients((ings) => ings.map((i) => {
      if (i.id !== ingId) return i;
      const suppliers = i.suppliers.filter((s) => s.id !== supId);
      const selectedSupplierId = i.selectedSupplierId === supId ? suppliers[0]?.id : i.selectedSupplierId;
      return { ...i, suppliers, selectedSupplierId };
    }));
  };
  const selectSupplier = (ingId, supId) => updateIngredientField(ingId, "selectedSupplierId", supId);

  // Réinitialisation en 2 temps : confirmation dans une fenêtre du même style que le reste de
  // l'app (remplace window.confirm, une boîte de dialogue système jugée peu engageante par
  // l'utilisateur, 2026-08), puis exécution qui restaure directement les données de démo (au lieu
  // de tout vider) — avant ce correctif, tout disparaissait (y compris la recette exemple) et il
  // fallait rafraîchir la page à la main pour la revoir, ce qui donnait l'impression d'un bug.
  const clearAll = () => setResetConfirmOpen(true);
  const performReset = async () => {
    const freshRecipes = buildSeedRecipes(lang);
    setIngredients(SEED_INGREDIENTS);
    setRecipes(freshRecipes);
    setActiveId(freshRecipes[0].id);
    setSupplierMappings([]);
    setResetConfirmOpen(false);
    setShowSettings(false);
    try { await storage.delete("ingredients"); await storage.delete("recipes"); await storage.delete("supplierMappings"); } catch (e) {}
  };

  // Ouvre le portail client Stripe (gérer carte/annuler) — appel serveur, jamais de clé Stripe
  // exposée côté navigateur. Le token Supabase de la session prouve au serveur quel utilisateur
  // (donc quel client Stripe) est concerné.
  // Bouton unique "intelligent" : ouvre le portail Stripe (annuler, changer de carte) si un
  // abonnement existe déjà ; sinon (encore en essai, aucun client Stripe créé) ouvre directement
  // le paiement pour s'abonner tout de suite sans attendre la fin des 7 jours. Le serveur renvoie
  // un code "no_subscription" (pas juste un message) pour distinguer ce cas d'une vraie erreur.
  const manageSubscription = async () => {
    setPortalErr("");
    setPortalBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = { Authorization: `Bearer ${session.access_token}` };

      const portalRes = await fetch("/api/create-portal-session", { method: "POST", headers: authHeader });
      const portalData = await portalRes.json();
      if (portalRes.ok && portalData.url) {
        window.location.href = portalData.url;
        return;
      }
      if (portalData.code !== "no_subscription") throw new Error(portalData.error || "portal error");

      const checkoutRes = await fetch("/api/create-checkout-session", { method: "POST", headers: authHeader });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.url) throw new Error(checkoutData.error || "checkout error");
      window.location.href = checkoutData.url;
    } catch (e) {
      setPortalErr(t("billingPortalError"));
      setPortalBusy(false);
    }
  };

  // Pièce jointe optionnelle (ex: capture d'écran d'un bug) — réutilise la même compression que
  // les scanners (redimensionne, JPEG) pour ne jamais envoyer un fichier énorme par email.
  const handleContactAttachment = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setContactAttaching(true);
    try {
      const { base64, mediaType } = await compressImageFile(file);
      setContactAttachment({ base64, mediaType, fileName: file.name || "capture.jpg" });
    } catch (err) {
      setContactErr(t("contactError"));
    } finally {
      setContactAttaching(false);
    }
  };

  // Formulaire de contact/réclamation : l'adresse de réception vit uniquement côté serveur
  // (CONTACT_EMAIL), jamais transmise ni visible côté client — seul le message est envoyé.
  const sendContactMessage = async () => {
    if (!contactMessage.trim()) return;
    setContactErr(null);
    setContactSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: contactMessage.trim(), attachment: contactAttachment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "contact error");
      setContactSent(true);
      setContactMessage("");
      setContactAttachment(null);
    } catch (e) {
      setContactErr(t("contactError"));
    } finally {
      setContactSending(false);
    }
  };

  // Change la langue d'interface et, si LA recette de démo (r1) n'a jamais été touchée, met à jour
  // seulement ses notes/allergènes/nom dans la nouvelle langue (sinon ses instructions/allergène
  // resteraient dans l'ancienne langue, seul le reste de l'interface changerait — repéré en test
  // réel, 2026-08). Corrige au passage sa toute première version qui remplaçait TOUT le tableau
  // `recipes` par `buildSeedRecipes(newLang)` (un seul élément) — sans danger tant qu'il n'y avait
  // qu'une recette, mais aurait fait disparaître silencieusement les autres recettes de l'utilisateur
  // dès qu'il en aurait créé une deuxième (repéré avant déploiement, jamais arrivé en production).
  // Ne modifie jamais une recette réellement éditée par l'utilisateur, ni aucune autre recette.
  const changeLang = (newLang) => {
    setLang(newLang);
    setRecipes((rs) => {
      const idx = rs.findIndex((r) => r.id === "r1");
      if (idx === -1 || !isPristineSeedRecipe(rs[idx])) return rs;
      const seeded = buildSeedRecipes(newLang)[0];
      const next = [...rs];
      next[idx] = { ...rs[idx], name: seeded.name, notes: seeded.notes, allergens: seeded.allergens };
      return next;
    });
  };

  const handlePrint = () => window.print();
  const handlePrintRecipeSheet = () => {
    setHidePricesPrint(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setHidePricesPrint(false), 500);
    }, 50);
  };

  // --- Scan de facture ---

  const normalizeStr = (s) => normalizeDiacritics(s).replace(/[^a-z0-9]+/g, " ").trim();

  // Détecte un poids/volume mentionné dans un texte (ex: "Mozzarella 125g", "Huile 75CL")
  // — sert de filet de sécurité si l'IA a oublié de convertir elle-même l'unité.
  const extractWeightGrams = (name) => {
    if (!name) return null;
    const kgMatch = name.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1].replace(",", ".")) * 1000);
    const gMatch = name.match(/(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\b/i);
    if (gMatch) return Math.round(parseFloat(gMatch[1].replace(",", ".")));
    return null;
  };
  const extractVolumeMl = (name) => {
    if (!name) return null;
    const lMatch = name.match(/(\d+(?:[.,]\d+)?)\s*l\b/i);
    if (lMatch) return Math.round(parseFloat(lMatch[1].replace(",", ".")) * 1000);
    const clMatch = name.match(/(\d+(?:[.,]\d+)?)\s*cl\b/i);
    if (clMatch) return Math.round(parseFloat(clMatch[1].replace(",", ".")) * 10);
    const mlMatch = name.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
    if (mlMatch) return Math.round(parseFloat(mlMatch[1].replace(",", ".")));
    return null;
  };

  // Si l'IA a laissé un produit en "pièce" alors qu'un poids/volume est visible dans le texte
  // brut du ticket, on corrige silencieusement — l'utilisateur ne voit jamais cette étape.
  const normalizeUnitAndPrice = (it) => {
    let unit = it.unit || "kg";
    let price = it.unitPriceHT || 0;
    if (unit === "pièce") {
      const source = it.rawLabel || it.name || "";
      const g = extractWeightGrams(source);
      if (g && g > 0) {
        return { unit: "kg", unitPriceHT: price / (g / 1000) };
      }
      const ml = extractVolumeMl(source);
      if (ml && ml > 0) {
        return { unit: "L", unitPriceHT: price / (ml / 1000) };
      }
    }
    return { unit, unitPriceHT: price };
  };

  // Compare mot par mot (plutôt qu'un match exact ou une simple sous-chaîne) et gère
  // le pluriel français basique ("oignons" ~ "oignon jaune"), avec un score de confiance.
  const tokenize = (s) =>
    normalizeStr(s)
      .split(" ")
      .filter(Boolean)
      .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

  // Mots trop génériques pour prouver une correspondance à eux seuls (ex: "fraîche" apparaît
  // aussi bien dans "Herbes fraîches" que "Crème fraîche" — deux produits sans rapport).
  const GENERIC_TOKENS = new Set([
    "frais", "fraiche", "entier", "entiere", "doux", "jaune", "rouge", "blanc", "blanche",
    "vert", "verte", "sec", "seche", "fermier", "fermiere", "plein", "air", "cuisine",
    "gros", "grosse", "petit", "petite", "nature", "classique", "campagne", "fin", "fine",
    "noir", "noire",
    // mots de liaison, ne comptent jamais comme "mot significatif partagé"
    "de", "du", "la", "le", "les", "des", "un", "une", "et", "au", "aux", "avec", "sans", "pour",
  ]);
  const meaningfulTokens = (tokens) => {
    const filtered = tokens.filter((tk) => !GENERIC_TOKENS.has(tk));
    return filtered.length ? filtered : tokens;
  };

  // À l'inverse des GENERIC_TOKENS (mots sans importance), ceux-ci désignent une vraie
  // transformation qui change le produit réellement acheté (prix et usage différents) :
  // "cru" retiré volontairement de GENERIC_TOKENS ci-dessus, on ne mélange plus jamais
  // "Pomme de terre" et "Pomme de terre frite", ou "Emmental" et "Emmental râpé".
  const DISTINCTIVE_MODIFIERS = new Set([
    "rape", "rapee", "frit", "frite", "hache", "hachee", "tranche", "tranchee",
    "cru", "crue", "cuit", "cuite", "marine", "marinee", "fume", "fumee",
    "pane", "panee", "moulu", "moulue", "concasse", "concassee", "bloc",
    "desosse", "desossee", "confit", "confite",
  ]);

  // Distance de Levenshtein (nombre minimal d'ajout/suppression/substitution pour passer
  // d'un mot à l'autre) — sert à repérer une faute de frappe/OCR entre deux mots proches.
  const levenshtein = (a, b) => {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  };

  // Deux mots "se ressemblent" sans être identiques : soit une abréviation fournisseur
  // manifeste (préfixe commun assez long, ex: "mozza" / "mozzarella"), soit un écart d'1-2
  // lettres typique d'une faute de frappe ou d'une erreur de lecture OCR.
  const tokensSimilar = (a, b) => {
    const minLen = Math.min(a.length, b.length);
    if (minLen < 4) return false; // trop court pour être fiable (ex: "ail" / "aile")
    if (a.startsWith(b) || b.startsWith(a)) return true;
    // Au-delà d'une abréviation (préfixe commun), on n'accepte une faute de frappe/OCR que si
    // les deux mots commencent pareil : "haricot" et "abricot" ont une distance de Levenshtein
    // de seulement 2 (assez pour matcher un mot de 7 lettres) mais ce sont deux légumes/fruits
    // totalement différents dès la première lettre — un vrai cas trouvé en test réel. Une faute
    // OCR change rarement la toute première lettre d'un mot, donc l'exiger identique élimine ce
    // faux positif sans bloquer les vraies fautes de frappe (qui portent presque toujours sur une
    // lettre du milieu ou de la fin).
    if (a[0] !== b[0]) return false;
    const maxDist = a.length >= 7 || b.length >= 7 ? 2 : 1;
    return levenshtein(a, b) <= maxDist;
  };

  const guessIngredientId = (name) => {
    const tokensRaw = tokenize(name);
    const tokens = meaningfulTokens(tokensRaw);
    if (!tokens.length) return null;
    const scannedMods = new Set(tokensRaw.filter((tk) => DISTINCTIVE_MODIFIERS.has(tk)));
    let best = null;
    let bestScore = 0;
    let bestFuzzy = false;
    for (const ing of ingredients) {
      const iTokensRaw = tokenize(ingredientDisplayName(ing));
      const iTokens = meaningfulTokens(iTokensRaw);
      if (!iTokens.length) continue;

      // Un mot de transformation présent d'un seul côté (râpé vs en bloc, cru vs cuit, frite
      // vs nature...) signale un produit réellement différent à acheter : on exclut carrément
      // ce candidat plutôt que de risquer de fusionner deux achats différents.
      const candidateMods = new Set(iTokensRaw.filter((tk) => DISTINCTIVE_MODIFIERS.has(tk)));
      if (scannedMods.size || candidateMods.size) {
        const sameMods = scannedMods.size === candidateMods.size && [...scannedMods].every((m) => candidateMods.has(m));
        if (!sameMods) continue;
      }

      // Chaque mot de l'ingrédient existant ne peut servir qu'une seule fois, même s'il
      // ressemble à plusieurs mots scannés, pour ne pas gonfler artificiellement le score.
      const usedI = new Set();
      let shared = 0;
      let fuzzy = false;
      for (const tk of tokens) {
        let matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tk === itk);
        if (matchIdx === -1) {
          matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tokensSimilar(tk, itk));
          if (matchIdx !== -1) fuzzy = true;
        }
        if (matchIdx !== -1) {
          usedI.add(matchIdx);
          shared++;
        }
      }
      if (shared === 0) continue; // exige au moins un mot significatif commun, pas juste un adjectif
      // Score = mots partagés ÷ TOTAL de mots distincts des deux côtés (et non le plus petit),
      // pour qu'un nom très court (ex: "Romarin") ne gagne pas à tort une confiance à 100%
      // simplement parce qu'il ne contient qu'un seul mot qui matche un produit composé.
      const unionSize = tokens.length + iTokens.length - shared;
      const score = shared / unionSize;
      if (score > bestScore) {
        bestScore = score;
        best = ing;
        bestFuzzy = fuzzy;
      }
    }
    if (!best || bestScore < 0.5) return null;
    // Un match qui ne repose que sur une approximation (abréviation, faute de frappe) n'est
    // jamais "confiant" : il part toujours en vérification, jamais importé automatiquement.
    return { id: best.id, confident: bestScore >= 0.99 && !bestFuzzy };
  };

  // Même logique de rapprochement que guessIngredientId ci-dessus, mais contre le CATALOGUE de
  // référence (toujours comparé au nom source français) plutôt que contre le garde-manger de
  // l'utilisateur — pour qu'un ingrédient créé automatiquement depuis un scan hérite d'une vraie
  // catégorie et, si le rapprochement est fiable, d'un lien allergène (ALLERGEN_MAP), au lieu de
  // toujours tomber en "Autres" sans aucun lien allergène précis (trou réel repéré en test, 2026-08
  // : un garde-manger 100% scanné se retrouvait entièrement en "Autres"). Uniquement utilisée à
  // l'import scan — l'assistant de création manuelle demande désormais la catégorie explicitement
  // (voir wizardStep 2) plutôt que de deviner.
  // Contrairement à guessIngredientId (qui doit rester strict — deux produits différents ne
  // doivent jamais fusionner leurs prix), ici on ne cherche qu'une catégorie approximative, sans
  // risque réel en cas d'erreur. Bug réel trouvé en test (2026-08, garde-manger vidé) : un vrai
  // nom de facture porte presque toujours des mots en plus du terme générique du catalogue (%,
  // grade, marque, mode de préparation — ex: "Chocolat noir couverture 64%", "Œuf frais catégorie
  // A", "Saumon atlantique filet sans peau") ; l'ancien score (mots partagés / union des DEUX
  // côtés) était noyé par ces mots en plus et ne dépassait quasiment jamais le seuil, laissant la
  // quasi-totalité des imports réels tomber en "Autres" même quand le produit de base était
  // pourtant bien dans le catalogue. Le filtre DISTINCTIVE_MODIFIERS (qui empêche par exemple
  // "Emmental râpé" de matcher "Emmental" pour l'identité/le prix) est également écarté ici : une
  // transformation du produit ne change pas sa catégorie, seulement son prix.
  const guessCatalogEntry = (name) => {
    const tokens = meaningfulTokens(tokenize(name));
    if (!tokens.length) return null;
    let best = null;
    let bestCatScore = 0;
    let bestIdScore = 0;
    let bestFuzzy = false;
    for (const c of CATALOG) {
      const iTokens = meaningfulTokens(tokenize(c.fr));
      if (!iTokens.length) continue;
      const usedI = new Set();
      let shared = 0;
      let fuzzy = false;
      for (const tk of tokens) {
        let matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tk === itk);
        if (matchIdx === -1) {
          matchIdx = iTokens.findIndex((itk, idx) => !usedI.has(idx) && tokensSimilar(tk, itk));
          if (matchIdx !== -1) fuzzy = true;
        }
        if (matchIdx !== -1) {
          usedI.add(matchIdx);
          shared++;
        }
      }
      if (shared === 0) continue;
      // Score "catégorie" : quelle part des mots du catalogue est couverte, sans être pénalisé
      // par les mots supplémentaires côté facture (ils décrivent le produit, pas sa famille).
      const catScore = shared / iTokens.length;
      // Score "identité" (formule stricte d'origine) : sert uniquement à décider si on peut aussi
      // poser catalogId (donc ALLERGEN_MAP) en confiance — une phrase avec un mot en trop dessus
      // fait déjà chuter ce score loin sous 0.99, donc reste protégé même sans DISTINCTIVE_MODIFIERS.
      const idScore = shared / (tokens.length + iTokens.length - shared);
      if (catScore > bestCatScore) {
        bestCatScore = catScore;
        bestIdScore = idScore;
        best = c;
        bestFuzzy = fuzzy;
      }
    }
    if (!best || bestCatScore < 0.5) return null;
    // `unit` renvoyé aussi (2026-08-27) : le catalogue SAIT que le lait se compte en litres et la
    // viande en kilos. Ne pas s'en servir obligeait à retomber sur CATEGORY_DEFAULT_UNIT, une
    // approximation par catégorie qui donnait "Lait entier" en grammes (catégorie crémerie → kg).
    return { catalogId: best.id, category: best.cat, unit: normUnit(best.unit), confident: bestIdScore >= 0.99 && !bestFuzzy };
  };

  // Ingrédients tombés en "Autres" faute de rapprochement catalogue au moment de l'import scan
  // (ex: guessCatalogEntry n'avait rien trouvé à l'époque, ou l'ingrédient a été renommé depuis).
  // Recalculé à chaque rendu à partir de guessCatalogEntry — pas de nouvel état, juste une
  // relecture du garde-manger actuel.
  const uncategorizedIngredients = ingredients.filter(
    (i) => (i.category || "autres") === "autres" && guessCatalogEntry(ingredientSourceName(i))
  );

  // Reclasse en un clic tout ce qui peut l'être : ne touche jamais un ingrédient déjà catégorisé
  // (même à tort — l'utilisateur doit corriger ça lui-même à la main pour ne pas écraser un choix
  // volontaire), et ne pose catalogId (donc le lien allergène ALLERGEN_MAP) que si le rapprochement
  // est confiant, comme à l'import scan normal.
  const reclassifyUncategorized = () => {
    setIngredients((ings) =>
      ings.map((i) => {
        if ((i.category || "autres") !== "autres") return i;
        const guess = guessCatalogEntry(ingredientSourceName(i));
        if (!guess) return i;
        return { ...i, category: guess.category, catalogId: guess.confident ? guess.catalogId : i.catalogId };
      })
    );
  };

  // Mémoire des rapprochements déjà validés par l'utilisateur lors d'un scan précédent :
  // si ce texte brut de facture a déjà été relié à un ingrédient, on lui fait confiance
  // directement, sans repasser par le score de similarité ni la vérification manuelle.
  // [BUG confirmé et corrigé, 2026-08-26] La mémoire des rapprochements était morte depuis que le
  // prompt exige que `rawLabel` recolle TOUTES les colonnes de la ligne (2026-07-31) : la clé
  // contenait donc la quantité et les prix de CETTE facture-là, qui changent forcément d'un mois
  // sur l'autre. Mesuré au banc de test sur 3 produits identiques à deux factures d'écart : 0/3
  // clés retrouvées. Conséquence concrète : chaque nouvelle facture reposait au chef exactement les
  // mêmes questions de rapprochement qu'il avait déjà validées le mois d'avant — c'est la source
  // principale des "alertes de vérification pas nécessaires" qu'il a signalées.
  //
  // On mémorise désormais TROIS clés pour un même import, essayées de la plus précise à la plus
  // large : le texte brut exact (comme avant, retrouve une ligne strictement identique), le texte
  // brut débarrassé des nombres isolés (survit à un changement de quantité/prix : "entrecote vbf
  // 4 12 kg 16 00 65 92" devient "entrecote vbf kg"), et le nom nettoyé par l'IA (retrouve le
  // produit même si le fournisseur change sa mise en page). Les chiffres collés à une unité
  // ("1kg", "75cl", "100g") ne sont jamais retirés : ils font partie de l'identité du produit.
  const rawMappingKey = (rawLabel) => normalizeStr(lightRawLabel(rawLabel));

  const stableMappingKey = (rawLabel) => {
    const words = rawMappingKey(rawLabel)
      .split(" ")
      .filter((w) => w && !/^\d+$/.test(w));
    const key = words.join(" ");
    // Garde-fou anti-collision : une clé trop courte (un ou deux mots génériques) pourrait
    // rapprocher à tort deux produits différents, et ce rapprochement serait marqué "confiant"
    // donc importé sans vérification. On préfère ne rien mémoriser dans ce cas.
    return words.length >= 2 && key.length >= 8 ? key : null;
  };

  const nameMappingKey = (name) => {
    const key = normalizeStr(name);
    return key && key.length >= 4 ? `name:${key}` : null;
  };

  const findMappedIngredientId = (rawLabel, name) => {
    const keys = [rawMappingKey(rawLabel), stableMappingKey(rawLabel), nameMappingKey(name)].filter(Boolean);
    for (const key of keys) {
      const found = supplierMappings.find((m) => m.key === key);
      // L'ingrédient appris a pu être supprimé depuis : dans ce cas on ignore cette association
      // et on continue avec les clés suivantes.
      if (found && ingredients.some((i) => i.id === found.ingredientId)) return found.ingredientId;
    }
    return null;
  };

  const rememberSupplierMapping = (rawLabel, name, ingredientId) => {
    if (!ingredientId) return;
    const keys = [rawMappingKey(rawLabel), stableMappingKey(rawLabel), nameMappingKey(name)].filter(Boolean);
    if (!keys.length) return;
    setSupplierMappings((maps) => [
      ...maps.filter((m) => !keys.includes(m.key)),
      ...keys.map((key) => ({ key, rawLabel, ingredientId, updatedAt: today() })),
    ]);
  };

  // Redimensionne ET compresse une photo avant envoi à l'IA. Passe par createImageBitmap avec
  // imageOrientation: "from-image" plutôt que new Image()+canvas classique : un `<img>` respecte
  // automatiquement le drapeau de rotation EXIF d'une photo de téléphone, mais canvas.drawImage()
  // NE LE FAIT PAS — il dessine la grille de pixels brute du capteur, ignorant le drapeau qui dit
  // "affiche ceci tourné". Une fois réexportée via toDataURL, l'image perd tout EXIF : la mauvaise
  // orientation est alors gravée en dur, sans aucun moyen de la corriger plus tard en aval. Bug réel
  // trouvé en test (2026-08) : une vraie facture prise en photo sur iPhone repartait pivotée à 90°
  // vers l'IA — repéré grâce à l'aperçu de diagnostic ajouté ce jour-là, qui montrait l'image
  // exactement telle qu'envoyée (donc déjà tournée, puisque réencodée à partir du canvas). Un
  // tableau dense et tourné est nettement plus dur à lire correctement pour un modèle de vision
  // qu'un tableau droit, même si un humain peut toujours pencher la tête pour compenser.
  const compressImageFile = async (file) => {
    // 2576px (2026-08-25, remonté de 1568px) : plafond du palier "High-resolution" de Sonnet 5
    // (voir api/scan-invoice.js, choix de modèle) — confirmé sur la doc officielle Anthropic. Ce
    // chiffre doit rester synchronisé avec le modèle utilisé côté serveur : redescendre à 1568px
    // si jamais le scanner de factures revient un jour sur un modèle "Standard" (Haiku), sinon on
    // envoie inutilement plus de données pour un modèle qui les redécoupera de toute façon.
    const maxDim = 2576;
    const drawToCanvas = (source, width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(source, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1] || "";
      // Certains navigateurs mobiles renvoient "data:," (chaîne vide) quand la conversion échoue,
      // au lieu de lever une erreur. Sans ce garde-fou on envoyait une image vide au serveur, qui
      // répondait "document non reçu" — un message trompeur pour un problème d'image en réalité.
      if (base64.length < 100) throw new Error("image_encode_failed");
      return { base64, mediaType: "image/jpeg" };
    };
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      let { width, height } = bitmap;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const result = drawToCanvas(bitmap, width, height);
      bitmap.close();
      return result;
    } catch (e) {
      // Repli sur l'ancien chemin si createImageBitmap échoue/n'existe pas sur ce navigateur —
      // perd la correction d'orientation dans ce cas précis, mais ne bloque jamais un scan.
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error("Image illisible"));
          img.onload = () => {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const scale = maxDim / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            // try/catch obligatoire : une exception levée ici (dans un gestionnaire d'événement)
            // ne rejetterait PAS la promesse — elle la laisserait en attente pour toujours, et le
            // scan resterait bloqué sur "Analyse en cours…" sans jamais afficher d'erreur.
            try {
              resolve(drawToCanvas(img, width, height));
            } catch (err) {
              reject(err);
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Pivote manuellement une image déjà compressée (base64), pour le cas où l'EXIF ne suffit pas à
  // remettre une photo droite (métadonnée perdue/altérée en transitant par une appli de
  // messagerie avant d'arriver dans Chefup — voir `scanPendingImage`).
  const rotateImageBase64 = (base64, mediaType, degrees) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        // try/catch : une exception dans ce gestionnaire d'événement ne rejetterait pas la
        // promesse, elle la laisserait en attente indéfiniment (bouton pivoter sans effet visible).
        try {
          const swap = ((degrees % 180) + 180) % 180 !== 0;
          const canvas = document.createElement("canvas");
          canvas.width = swap ? img.height : img.width;
          canvas.height = swap ? img.width : img.height;
          const ctx = canvas.getContext("2d");
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((degrees * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const rotated = dataUrl.split(",")[1] || "";
          if (rotated.length < 100) throw new Error("image_encode_failed");
          resolve({ base64: rotated, mediaType: "image/jpeg" });
        } catch (err) {
          reject(err);
        }
      };
      img.src = `data:${mediaType};base64,${base64}`;
    });

  // Convertit un ArrayBuffer en base64 par blocs (2026-08-25) : `btoa(String.fromCharCode(...bytes))`
  // avec l'opérateur spread peut dépasser la limite d'arguments d'une fonction sur un gros fichier
  // (des dizaines de milliers d'octets d'un coup) — motif classique et sûr pour éviter ça.
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  };

  // Plafond de taille avant envoi : Vercel refuse tout net une requête au-delà de 4,5 Mo (limite
  // fixe de la plateforme, non modifiable — vérifié sur la doc officielle le 2026-08-25), et le
  // base64 gonfle la taille réelle d'environ 33%. 3 Mo de PDF brut → environ 4 Mo encodé, en
  // laissant de la marge pour le reste du JSON envoyé — largement suffisant pour une facture de
  // plusieurs pages (les factures réelles testées jusqu'ici pesaient quelques centaines de Ko).
  const MAX_PDF_BYTES = 3 * 1024 * 1024;

  // Lit un PDF (2026-08-25, réécrit en profondeur) : envoie désormais le fichier BRUT à Claude, qui
  // sait lire un PDF nativement (texte ET pages scannées, jusqu'à 600 pages) — plus aucun parsing
  // ni rendu de PDF dans le navigateur. Remplace l'ancienne approche (pdfjs-dist, lecture de texte
  // ou rendu de la première page en image) qui reposait sur un vrai bug non résolu de cette
  // bibliothèque sur certaines anciennes versions d'iOS/Safari — deux tentatives de correctif côté
  // client ont échoué le même soir (voir l'historique de ce fichier) avant qu'on réalise qu'il
  // valait mieux éliminer le problème à la racine plutôt que continuer à le contourner. Bénéfice
  // supplémentaire, pas juste un contournement : un PDF scanné multi-pages n'était auparavant lu
  // que sur sa première page (limite de l'ancien pipeline) ; Claude peut désormais lire le document
  // dans son ensemble. Elle ne dépend donc plus du tout d'`isIOSDevice` — un PDF se comporte
  // maintenant EXACTEMENT pareil sur n'importe quel appareil.
  const readPdfFile = async (file) => {
    if (file.size > MAX_PDF_BYTES) {
      const err = new Error("pdf_too_big");
      err.code = "file_too_big";
      throw err;
    }
    const arrayBuffer = await file.arrayBuffer();
    return { pdfBase64: arrayBufferToBase64(arrayBuffer) };
  };

  // OCR indépendant (moteur classique, pas une IA) fait en plus de la lecture par l'IA de vision :
  // les deux se trompent rarement sur le même chiffre de la même façon, donc lui donner cette
  // transcription en indice supplémentaire l'aide à se corriger elle-même (ex: virgule ratée,
  // ligne voisine confondue). Best-effort et jamais bloquant : si l'OCR échoue ou n'est pas
  // disponible, le scan continue normalement sans lui. Import dynamique pour la même raison que
  // pdfjs-dist ci-dessus (grosse librairie, chargée seulement au moment de scanner une photo).
  // ⚠️ Deux garde-fous ajoutés le 2026-08-24 après audit, tous deux liés à des scans qui restaient
  // bloqués sur "Analyse en cours…" sans jamais aboutir :
  // 1. UNE SEULE langue chargée (celle de l'interface) au lieu de "fra+spa+eng". tesseract.js
  //    télécharge son moteur WebAssembly ET un fichier de données par langue depuis un CDN externe
  //    au premier scan : trois langues, c'est trois fois plus de mégaoctets à télécharger avant
  //    même que l'analyse commence — sur la connexion mobile d'une cuisine, c'est très long. L'OCR
  //    n'est qu'un INDICE donné à l'IA en plus de l'image, pas la lecture principale : lire une
  //    facture française avec le seul modèle français ne dégrade rien.
  // 2. Délai maximum : si le CDN est lent, bloqué (réseau d'entreprise, bloqueur de pub) ou
  //    injoignable, l'attente pouvait durer indéfiniment sans qu'aucune erreur ne soit levée. On
  //    abandonne désormais l'OCR au bout de OCR_TIMEOUT_MS et le scan continue sans lui.
  const OCR_TIMEOUT_MS = 20000;
  const OCR_LANG = { fr: "fra", es: "spa", en: "eng" };
  const runOcr = async (base64) => {
    let worker = null;
    try {
      // .catch() attaché tout de suite : si l'OCR échoue APRÈS que le délai a déjà expiré, la
      // promesse rejetée n'a plus personne pour l'attendre et provoquerait une erreur non gérée.
      const ocrPromise = (async () => {
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker(OCR_LANG[lang] || "fra");
        const { data } = await worker.recognize(`data:image/jpeg;base64,${base64}`);
        return (data.text || "").trim();
      })().catch(() => "");
      const text = await Promise.race([
        ocrPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), OCR_TIMEOUT_MS)),
      ]);
      return text || "";
    } catch (e) {
      return "";
    } finally {
      // Toujours libérer le worker, y compris quand le délai a expiré pendant qu'il travaillait
      // encore — sinon il continue à tourner en arrière-plan et à consommer la batterie.
      try { await worker?.terminate(); } catch (e) {}
    }
  };

  // Filet de sécurité déterministe : quand un poids/volume est identifiable noir sur blanc dans
  // le texte brut de la ligne, on le recalcule nous-mêmes plutôt que de faire confiance à
  // l'arithmétique de l'IA. Des tests réels sur 15 factures reproduites ont montré que l'IA se
  // trompe régulièrement sur deux cas précis : le calcul d'un multipack "NxVOLUME" (ex:
  // "Carton 6x75cl" → l'IA a renvoyé 6 ou 0.75 au lieu de 4.5 dans plusieurs tests) et la
  // conversion grammes→kg (ex: "Bloc 500g" → l'IA a renvoyé 500 avec l'unité "kg" au lieu de 0.5,
  // soit une erreur de prix x1000). Une campagne de tests "extrêmes" (2026-07-31, factures
  // dégradées/multi-colonnes) a montré un troisième cas du même type : le multipack en grammes
  // "Nxg" (ex: "12x125g" → doit donner 1,5kg, pas 125g ni 12). Test réel du 2026-08 : le même
  // calcul peut aussi apparaître dans l'ordre INVERSE, quantité puis compte (ex: "BURRATA 100G X8"
  // = 8x100g, PAS 100g seul) — l'IA avait renvoyé 100g, donnant un prix ×8 trop élevé (118€/kg au
  // lieu de ~14,75€/kg), sans lever la moindre alerte. Ce filet ne s'applique qu'aux contenus en kg
  // ou L, jamais "pièce" — un motif reconnu écrase toujours la valeur de l'IA (plus fiable qu'elle
  // sur ces cas précis d'après les tests), sinon on garde sa valeur telle quelle.
  // IMPORTANT : ce filet dépend entièrement de `rawLabel` contenant bien le texte de conditionnement
  // (voir prompt `api/scan-invoice.js`, champ rawLabel) — si l'IA ne recopie que la colonne
  // désignation sans la colonne format/conditionnement, ce filet ne peut rien détecter.
  // [BUG confirmé et corrigé, 2026-08-26] Un motif "1L X12" ne veut PAS toujours dire "un colis
  // qui contient 12 fois 1L" : très souvent c'est "12 briques de 1L achetées", donc 12 est le
  // NOMBRE DE PIÈCES ACHETÉES (packageCount), pas un multiplicateur de conditionnement. Le filet
  // écrasait alors la bonne valeur de l'IA (1L) par 12L, divisant le prix final par 12 EN SILENCE
  // (trouvé au banc de test : "CREME LIQUIDE BRIQUE 1L X12" à 2,10€/pièce importée à 0,175€/L).
  // Discriminant fiable : quand le multiplicateur lu dans le texte est EXACTEMENT le packageCount
  // renvoyé par l'IA, c'est un nombre de pièces achetées, pas un multipack — on rend alors la main
  // à l'IA (qui, elle, a vu la mise en page complète et applique la règle du prompt sur ce cas
  // précis). Quand les deux nombres diffèrent (ex: "BURRATA 100G X8" avec 3 colis achetés), c'est
  // bien un multipack et le filet garde la priorité comme avant.
  const isPurchaseCountNotMultipack = (count, opts) =>
    !!opts &&
    opts.packageCount > 0 &&
    opts.aiContent > 0 &&
    Math.abs(count - opts.packageCount) < 0.001;

  const extractDeterministicContent = (text, contentUnit, opts) => {
    if (!text || (contentUnit !== "kg" && contentUnit !== "L")) return null;
    if (contentUnit === "L") {
      const multipack = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\b/i);
      if (multipack) {
        const count = parseInt(multipack[1], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        const size = parseFloat(multipack[2].replace(",", "."));
        const u = multipack[3].toLowerCase();
        const perUnitL = u === "cl" ? size / 100 : u === "ml" ? size / 1000 : size;
        return Math.round(count * perUnitL * 1000) / 1000;
      }
      // Même calcul, ordre inversé "VOLUME x COMPTE" (ex: "75CL X6" au lieu de "6x75cl").
      const multipackRev = text.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\s*[x×]\s*(\d+)\b/i);
      if (multipackRev) {
        const size = parseFloat(multipackRev[1].replace(",", "."));
        const u = multipackRev[2].toLowerCase();
        const count = parseInt(multipackRev[3], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        const perUnitL = u === "cl" ? size / 100 : u === "ml" ? size / 1000 : size;
        return Math.round(count * perUnitL * 1000) / 1000;
      }
      const lMatch = text.match(/(\d+(?:[.,]\d+)?)\s*l\b/i);
      if (lMatch) return parseFloat(lMatch[1].replace(",", "."));
      const clMatch = text.match(/(\d+(?:[.,]\d+)?)\s*cl\b/i);
      if (clMatch) return Math.round(parseFloat(clMatch[1].replace(",", ".")) * 10) / 1000;
      const mlMatch = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
      if (mlMatch) return parseFloat(mlMatch[1].replace(",", ".")) / 1000;
    }
    if (contentUnit === "kg") {
      const multipackG = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\b/i);
      if (multipackG) {
        const count = parseInt(multipackG[1], 10);
        const sizeG = parseFloat(multipackG[2].replace(",", "."));
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(count * sizeG) / 1000;
      }
      // Même calcul, ordre inversé "GRAMMAGE x COMPTE" (ex: "100G X8" = 8x100g, cas réel Burrata
      // du 2026-08 où l'IA n'avait lu que "100g" en ignorant le "X8").
      const multipackGRev = text.match(/(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\s*[x×]\s*(\d+)\b/i);
      if (multipackGRev) {
        const sizeG = parseFloat(multipackGRev[1].replace(",", "."));
        const count = parseInt(multipackGRev[2], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(count * sizeG) / 1000;
      }
      // Même calcul, multipack directement en kg (ex: "4x2.5kg" = 10kg, cas réel "PDT FRITE
      // 4X2.5KG" du 2026-08 où seul "2.5kg" avait été lu, ignorant le "4x" — prix importé x4 trop
      // élevé sans alerte). Angle mort qui existait déjà avant les 2 filets grammes/volume
      // ci-dessus, jamais couvert pour le kg directement. Les deux sens, comme pour les grammes.
      const multipackKg = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*kg\b/i);
      if (multipackKg) {
        const count = parseInt(multipackKg[1], 10);
        const sizeKg = parseFloat(multipackKg[2].replace(",", "."));
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(count * sizeKg * 1000) / 1000;
      }
      const multipackKgRev = text.match(/(\d+(?:[.,]\d+)?)\s*kg\s*[x×]\s*(\d+)\b/i);
      if (multipackKgRev) {
        const sizeKg = parseFloat(multipackKgRev[1].replace(",", "."));
        const count = parseInt(multipackKgRev[2], 10);
        if (isPurchaseCountNotMultipack(count, opts)) return null;
        return Math.round(sizeKg * count * 1000) / 1000;
      }
      const kgMatch = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
      if (kgMatch) return parseFloat(kgMatch[1].replace(",", "."));
      const gMatch = text.match(/(\d+(?:[.,]\d+)?)\s*g(?:r|rs|rammes?)?\b/i);
      if (gMatch) return Math.round(parseFloat(gMatch[1].replace(",", "."))) / 1000;
    }
    return null;
  };

  // Calcule le prix final au kg/L/pièce à partir de : combien de colis achetés,
  // ce que contient UN colis, et le prix tel qu'imprimé (déjà au kg/L, ou par colis entier).
  // Rien de tout ça n'est deviné par l'IA seule : c'est un calcul déterministe, vérifiable.
  const computeItemPricing = (it) => {
    // Repli sur l'ancien format si jamais l'IA ne renvoie pas les nouveaux champs.
    if (it.packageContent === undefined || it.printedPriceUnit === undefined) {
      const legacy = normalizeUnitAndPrice(it);
      return { finalUnit: legacy.unit, finalUnitPrice: legacy.unitPriceHT, priceInconsistent: false, expectedTotal: null, pricingUnknown: false };
    }

    const packageContentUnit = it.packageContentUnit || "pièce";
    const packageCount = it.packageCount && it.packageCount > 0 ? it.packageCount : 1;
    const deterministicContent = extractDeterministicContent(it.rawLabel || it.name || "", packageContentUnit, {
      packageCount: it.packageCount,
      aiContent: it.packageContent,
    });

    // Piège "N PCE sans poids" pour un produit weighable (ex: "Noix de Saint-Jacques — 3 PCE —
    // 27,00€" sans aucun poids indiqué) : des tests réels ont montré que l'IA recopie parfois
    // packageCount dans packageContent avec packageContentUnit "pièce", comme si "3 pièces
    // achetées" voulait dire "chaque pièce contient 3" — un contenu inventé, pas lu. Détecté
    // quand les deux nombres sont identiques ET qu'aucune unité de poids/volume (kg/g/L/cl)
    // n'apparaît nulle part dans le texte brut : dans ce cas précis on retombe sur "inconnu",
    // exactement comme un colis sans poids indiqué.
    const hasRealWeightText = /\d+(?:[.,]\d+)?\s*(kg|gr?|grammes?|l|cl|ml)\b/i.test(it.rawLabel || it.name || "");
    const suspiciousPieceCount =
      it.weighable === true &&
      packageContentUnit === "pièce" &&
      it.packageContent != null &&
      it.packageCount != null &&
      Math.abs(it.packageContent - it.packageCount) < 0.001 &&
      !hasRealWeightText;
    const rawPackageContent = suspiciousPieceCount ? null : it.packageContent;

    const packageContent = deterministicContent || (rawPackageContent && rawPackageContent > 0 ? rawPackageContent : 1);
    const printedPrice = it.printedUnitPriceHT || 0;
    const printedUnit = it.printedPriceUnit || "colis";

    let finalUnit;
    let finalUnitPrice;
    // Déclaré ici (avant la branche kg/L) car `priceInconsistent` lui-même n'est déclaré que plus
    // bas dans cette fonction, pour le contrôle de la branche "colis" — les deux se combinent à la
    // fin. Sans cette variable intermédiaire, une affectation dans la branche kg/L se ferait sur
    // une variable pas encore déclarée (erreur) et serait de toute façon écrasée par la
    // déclaration plus bas.
    let kgLPriceMismatch = false;
    if (printedUnit === "kg" || printedUnit === "L") {
      // Le prix imprimé est déjà un prix au kilo/litre selon l'IA. Recoupement systématique quand
      // on a une contenance fiable trouvée nous-mêmes dans le texte (ex: "75 CL" dans le titre) :
      // cas réel (2026-08) où un vin à 3,11€/bouteille de 75cl est ressorti tel quel comme
      // "3,11€/L" au lieu de 4,15€/L — l'IA confond parfois "une contenance est mentionnée dans le
      // titre" avec "le prix affiché est déjà normalisé au litre/kilo". Sans ce recoupement, rien
      // ne détectait l'erreur : le garde-fou priceInconsistent plus bas est justement désactivé
      // pour cette branche (packageContent n'entre normalement pour rien dans un prix déjà au
      // kg/L). On recoupe donc ici avec la quantité déduite du total imprimé.
      if (deterministicContent && printedPrice > 0 && it.totalPriceHT > 0) {
        // [REFONTE 2026-08-26] L'ancien contrôle comparait le total imprimé à deux hypothèses
        // construites à partir de packageCount — un champ que l'IA remplit de façon peu fiable
        // sur les lignes vendues au poids (elle y met souvent le POIDS de la colonne quantité, pas
        // un nombre de colis). Deux conséquences mesurées au banc de test : (1) fausse alerte
        // systématique sur les lignes "N pièces + poids total" (ex: "FILET POULET 3 PCE 2,5 KG à
        // 9,80/kg", "POULET ENTIER 6 PCE 9,84 KG") pourtant parfaitement calculées — cas très
        // fréquent en boucherie/marée ; (2) pire, une "correction" appliquée à tort quand le poids
        // se retrouvait aussi dans packageCount, divisant le prix par le poids EN SILENCE
        // ("ENTRECOTE 4,12 KG à 16,00€/kg" importée à 3,88€/kg).
        //
        // Nouveau raisonnement, bien plus robuste : quand un prix est réellement au kg/L, la
        // QUANTITÉ TOTALE de la ligne se déduit directement de deux chiffres indépendants et
        // fiables (total ÷ prix unitaire), sans jamais passer par packageCount. On la compare
        // ensuite aux lectures possibles du texte.
        const impliedQty = it.totalPriceHT / printedPrice;
        const close = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= 0.05;
        const contentEqualsCount = Math.abs(deterministicContent - packageCount) < 0.001;
        if (close(impliedQty, deterministicContent) || (!contentEqualsCount && close(impliedQty, packageCount * deterministicContent))) {
          // La quantité déduite correspond au poids/volume lu sur la ligne (seul, ou multiplié par
          // le nombre de colis) : le prix imprimé est bien un prix au kg/L, rien à corriger.
          // `contentEqualsCount` neutralise l'hypothèse "N colis de C" quand les deux nombres sont
          // en réalité le même chiffre lu deux fois (double comptage), sinon elle valide n'importe
          // quoi — c'est ce qui masquait le cas "l'IA divise deux fois" ci-dessous.
          finalUnit = printedUnit;
          finalUnitPrice = printedPrice;
        } else if (close(impliedQty, packageCount) && !contentEqualsCount) {
          // La quantité déduite correspond au NOMBRE de pièces achetées, pas à un poids : le prix
          // imprimé est en fait un prix par pièce/bouteille mal classé par l'IA (cas réel du vin
          // Château Virant, 3,11€/bouteille de 75cl ressorti tel quel en 3,11€/L). On le ramène
          // nous-mêmes au litre/kilo via la contenance lue dans le texte.
          finalUnit = printedUnit;
          finalUnitPrice = Math.round((printedPrice / deterministicContent) * 10000) / 10000;
        } else {
          // [BUG confirmé, 2026-08-25] Aucune lecture plausible ne colle : la quantité déduite du
          // total ne correspond ni au poids lu, ni au nombre de pièces. C'est exactement la
          // signature du cas où l'IA a recalculé elle-même le prix unitaire en divisant une
          // deuxième fois de trop ("BŒUF 5 KG à 16,00€/kg = 80,00€" renvoyé à 3,20€/kg) — un prix
          // divisé par 5 qui passait auparavant sans la moindre alerte. On garde le prix imprimé
          // mais on force une vérification humaine plutôt que d'importer un chiffre invérifiable.
          finalUnit = printedUnit;
          finalUnitPrice = printedPrice;
          kgLPriceMismatch = true;
        }
      } else {
        finalUnit = printedUnit;
        finalUnitPrice = printedPrice;
      }
    } else {
      // Le prix imprimé est celui d'un colis entier : on le ramène au kg/L/pièce via son contenu.
      // Arrondi à 4 décimales : une division comme 11.80/3 donne un flottant JS avec une quinzaine
      // de décimales (ex: 0.33749999999999997), qui a l'air cassé une fois affiché à l'utilisateur
      // — bug réel trouvé en test (2026-08). Le calcul lui-même n'a jamais été faux, seul l'arrondi
      // manquait.
      finalUnit = packageContentUnit === "kg" || packageContentUnit === "L" ? packageContentUnit : "pièce";
      finalUnitPrice = Math.round((printedPrice / packageContent) * 10000) / 10000;
    }

    // Prix par pièce/colis pour un produit dont le contenu (poids/volume réel) est inconnu —
    // impossible de calculer un vrai prix au kilo fiable, mieux vaut le dire clairement plutôt que
    // d'inventer un chiffre. Ne dépend plus de "weighable" (des tests réels ont montré ce champ
    // IA peu fiable, ex: sachet de Saint-Jacques ou plaquette de beurre parfois classés à tort
    // "weighable: false" alors que leur contenance varie bel et bien) : un contenu manquant est
    // toujours suspect, quel que soit le type de produit. `deterministicContent` prime toujours :
    // si notre filet de sécurité a lui-même trouvé le poids/volume dans le texte, ce n'est plus
    // une inconnue même si l'IA, elle, ne l'a pas vu.
    const pricingUnknown = printedUnit !== "kg" && printedUnit !== "L" && !deterministicContent && !rawPackageContent;

    // Ce contrôle ne vérifie quelque chose d'utile que lorsque packageContent sert réellement à
    // calculer finalUnitPrice (branche "colis" ci-dessus). Quand le prix est déjà donné
    // directement au kg/L, packageContent n'entre pour rien dans le prix importé — un écart à ce
    // stade ne signale qu'un champ non-utilisé mal lu (virgule ratée dans une quantité, confusion
    // avec une ligne voisine dense), pas une vraie incohérence de prix. Deux faux positifs réels
    // (2026-08, "4,12 KG" lu "412 KG", et une contamination par une ligne voisine) ont montré que
    // ça fait vérifier l'utilisateur pour rien alors que le prix importé était déjà correct.
    const pricingDependsOnPackageContent = printedUnit !== "kg" && printedUnit !== "L";
    const printedTotal = it.totalPriceHT || 0;
    // Certaines factures ont DEUX colonnes de comptage distinctes (ex: "Colis" ET "Quantité"
    // séparées — cas réel du vin 2026-08 : 2 colis de 6 bouteilles de 75cl = 12 bouteilles, prix
    // imprimé au format bouteille). L'IA peut alors renvoyer packageCount = nombre de colis (2)
    // au lieu du vrai multiplicateur de prix (12), ce qui fait échouer ce contrôle même quand le
    // prix final importé est déjà correct (packageContent s'annule de toute façon dans le calcul
    // ci-dessous dès que le prix imprimé est "par pièce"). printedUnitPriceHT et totalPriceHT
    // sont deux nombres indépendants lus sur la même cellule, généralement plus fiables qu'un
    // choix entre deux colonnes de comptage ambiguës : quand leur ratio ne colle pas du tout à
    // packageCount, on lui fait confiance à la place plutôt que de déclencher une fausse alerte.
    const impliedCount = printedPrice > 0 && printedTotal > 0 ? printedTotal / printedPrice : 0;
    const countForCheck =
      impliedCount >= 0.5 && Math.abs(impliedCount - packageCount) / Math.max(impliedCount, packageCount) > 0.05
        ? impliedCount
        : packageCount;
    const expectedTotal = countForCheck * packageContent * finalUnitPrice;
    // Combine les deux garde-fous : celui de la branche "colis" (packageContent réellement utilisé
    // pour calculer le prix) et celui de la branche "déjà au kg/L" ci-dessus (kgLPriceMismatch).
    let priceInconsistent = kgLPriceMismatch;
    if (pricingDependsOnPackageContent && !pricingUnknown && printedTotal > 0 && expectedTotal > 0) {
      const diff = Math.abs(expectedTotal - printedTotal) / Math.max(printedTotal, 0.01);
      if (diff > 0.15) priceInconsistent = true;
    }

    return { finalUnit, finalUnitPrice, priceInconsistent, expectedTotal, pricingUnknown };
  };

  // Photo (pas PDF) : compresse, affiche l'aperçu, et ATTEND une confirmation explicite avant
  // d'envoyer à l'IA — laisse une chance de pivoter la photo si elle ressort de travers (voir
  // `scanPendingImage`). Le chemin PDF (texte natif ou page rendue en image) reste automatique
  // comme avant : un PDF n'a pas ce problème de rotation de photo.
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;
    setScanOpen(true);
    setScanErr(null);
    setScanResult(null);
    setScanImagePreview(null);
    setScanPendingImage(null);
    // Oublier la photo du scan précédent : sinon "Réessayer avec la même photo" renverrait l'image
    // d'avant si le nouveau document (un PDF par exemple) échoue dès l'ouverture du fichier.
    setLastScanImage(null);
    setReviewStackOpen(false);
    setExpandedReviewIdx(null);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    setLastScanSource(isPdf ? "file" : e.target === fileInputRef.current ? "camera" : "file");
    if (!isPdf) {
      setScanning(true);
      setScanStep("prepare");
      try {
        const { base64, mediaType } = await compressImageFile(file);
        setScanImagePreview(`data:${mediaType};base64,${base64}`);
        setScanPendingImage({ base64, mediaType });
      } catch (err) {
        // Fichier que le navigateur n'arrive pas à ouvrir comme une image : format exotique
        // (HEIC brut sorti de l'app Fichiers d'un iPhone), fichier tronqué, image corrompue.
        // Le vrai message de l'erreur est capturé dans `meta` (jamais affiché au client, juste
        // visible dans le tableau de bord admin) — avant le 2026-08-25 il était perdu, laissant
        // "PDF illisible" ou "image illisible" sans aucun moyen de savoir pourquoi concrètement.
        setScanErr({ code: "file_unreadable" });
        logScanFailure("file_unreadable", { fileType: file.type || "?", errorMessage: String(err?.message || err).slice(0, 200) });
      } finally {
        setScanning(false);
        setScanStep(null);
      }
      return;
    }
    setScanning(true);
    setScanStep("prepare");
    try {
      const { pdfBase64 } = await readPdfFile(file);
      await runScanPipeline({ pdfBase64, lang });
    } catch (err) {
      // `file_too_big` posé explicitement par readPdfFile (fichier au-delà de 3 Mo) ; tout le
      // reste reste générique — plus de distinction iOS/mot de passe nécessaire depuis que le PDF
      // n'est plus jamais parsé dans le navigateur (2026-08-25), donc plus jamais sujet aux bugs
      // spécifiques d'une bibliothèque de lecture PDF client (PasswordException, bug WebKit...).
      // Le vrai message technique reste gardé pour diagnostic, au cas où un souci différent (fichier
      // vraiment corrompu, lecture réseau...) apparaisse un jour.
      const code = err?.code === "file_too_big" ? "file_too_big" : "file_unreadable";
      setScanErr({ code });
      logScanFailure(code, {
        fileType: "pdf",
        errorMessage: String(err?.message || err).slice(0, 200),
        errorName: err?.name || null,
      });
      setScanning(false);
      setScanStep(null);
    }
  };

  // Pivote la photo en attente de 90° (sens indiqué) — met à jour à la fois l'aperçu et l'image
  // qui sera réellement envoyée au clic sur "Analyser".
  const rotateScanPendingImage = async (degrees) => {
    if (!scanPendingImage) return;
    // Un échec de rotation ne doit jamais rester silencieux (l'utilisateur appuierait dans le vide)
    // ni faire perdre la photo déjà en attente : on garde la photo telle quelle et on explique.
    try {
      const rotated = await rotateImageBase64(scanPendingImage.base64, scanPendingImage.mediaType, degrees);
      setScanPendingImage(rotated);
      setScanImagePreview(`data:${rotated.mediaType};base64,${rotated.base64}`);
    } catch (err) {
      setScanErr({ code: "file_unreadable" });
    }
  };

  // Lance réellement l'analyse de la photo en attente (OCR + appel IA), une fois que
  // l'utilisateur a confirmé (éventuellement après l'avoir pivotée).
  // ⚠️ `imageOverride` ne doit JAMAIS recevoir un événement de clic : brancher cette fonction
  // directement sur un `onClick={confirmScanImage}` lui passerait l'événement React comme premier
  // argument, donc une "image" sans base64 — la requête partait alors sans document et le serveur
  // répondait "Document non reçu". Bug réel introduit puis corrigé le 2026-08-24 (déjà arrivé une
  // fois dans ce fichier avec openAddWizard). D'où l'appel obligatoire en `() => confirmScanImage()`
  // ET la vérification ci-dessous, qui ignore tout objet ne contenant pas une vraie image.
  const confirmScanImage = async (imageOverride = null) => {
    const valid = (src) => src && typeof src.base64 === "string" && src.base64.length > 100;
    const source = valid(imageOverride) ? imageOverride : scanPendingImage;
    if (!valid(source)) return;
    const { base64, mediaType } = source;
    setScanning(true);
    setScanErr(null);
    setScanPendingImage(null);
    // Mémorisée pour pouvoir RENVOYER exactement la même photo en un tap après un échec, sans
    // redemander au restaurateur de retrouver son fichier / reprendre sa photo (frein majeur :
    // après un échec, un utilisateur qui doit tout recommencer abandonne).
    setLastScanImage({ base64, mediaType });
    try {
      setScanStep("ocr");
      const ocrText = await runOcr(base64);
      await runScanPipeline({ image: base64, mediaType, ocrText, lang });
    } catch (err) {
      setScanErr({ code: "unknown" });
      logScanFailure("unknown", { errorMessage: String(err?.message || err).slice(0, 200) });
      setScanning(false);
      setScanStep(null);
    }
  };

  // Renvoie la dernière image analysée telle quelle (après un échec réseau/serveur) — un seul tap,
  // aucun fichier à re-sélectionner.
  const retryLastScan = () => {
    if (lastScanImage) return confirmScanImage(lastScanImage);
    // Pas d'image en mémoire (échec côté PDF ou fichier illisible) : on rouvre le bon sélecteur,
    // celui par lequel le restaurateur était passé, jamais l'appareil photo par défaut.
    if (lastScanSource === "camera") fileInputRef.current?.click();
    else fileInputLibraryRef.current?.click();
  };

  // Journal des ÉCHECS de scan (2026-08-24). Jusqu'ici seuls les scans réussis étaient enregistrés :
  // quand un client disait "ça ne marche pas", le tableau de bord admin restait vide et il était
  // impossible de savoir s'il avait seulement essayé, ni pourquoi ça avait échoué. Fire-and-forget,
  // jamais bloquant, aucune donnée de facture — juste un code d'erreur.
  const logScanFailure = (code, meta = {}) => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch("/api/scan-events", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
          // `device` ajouté le 2026-08-25 : un vrai trou jusqu'ici — un échec PDF pouvait être
          // attribué à un bug iOS (voir file_pdf_ios_issue) sans jamais savoir avec certitude si
          // l'appareil concerné était réellement un iPhone. Jamais de contenu de facture, juste le
          // user-agent du navigateur (donnée déjà publique côté client, pas une info sensible).
          body: JSON.stringify({ type: "scan_failed", meta: { scanner: "invoice", code, online: navigator.onLine, device: isIOSDevice ? (isIOSChromeDevice ? "iOS Chrome" : "iOS") : "autre", ...meta } }),
        });
      } catch (e) {}
    })();
  };

  // Envoie le payload à l'IA et traite le résultat — partagé par le chemin PDF (automatique) et
  // le chemin photo (après confirmation/rotation éventuelle via confirmScanImage).
  // `attempt` : 0 au premier envoi, 1 lors de la seule et unique nouvelle tentative automatique
  // après un refus pour session expirée (voir plus bas). Jamais plus de deux envois.
  const runScanPipeline = async (payload, attempt = 0) => {
    // Délai maximum côté navigateur. Sans ça, une connexion qui se coupe en pleine requête (cas
    // très courant en cuisine : wifi capricieux, passage en 4G) laissait la roue tourner
    // indéfiniment, sans erreur, sans issue — l'utilisateur ne pouvait que fermer et recommencer.
    // 90s (remonté de 75s le 2026-08-25, en même temps que le délai serveur ci-dessus) : doit
    // toujours rester au-dessus du budget serveur (60s) + une marge réseau, sinon le navigateur
    // couperait AVANT que le serveur ait fini, transformant une réponse qui allait arriver en un
    // abandon inutile.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    try {
      setScanStep("ai");
      // Preuve de compte jointe à la requête (2026-08-24) : l'endpoint refuse désormais les appels
      // sans compte connecté, pour que personne d'autre ne puisse consommer les crédits d'IA.
      // getSession() rafraîchit déjà le jeton tout seul s'il vient d'expirer ; on ne bloque JAMAIS
      // le scan si on n'arrive pas à le récupérer — c'est le serveur qui tranche, pas nous.
      let accessToken = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || null;
      } catch (e) {}
      const headers = { "content-type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch("/api/scan-invoice", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      // ⚠️ Ne JAMAIS faire res.json() directement : quand la plateforme coupe la fonction (délai
      // dépassé) ou refuse la requête, elle répond une page HTML, pas du JSON — res.json() levait
      // alors une erreur technique ("Unexpected token '<'…") affichée telle quelle au restaurateur.
      const bodyText = await res.text();
      let data = {};
      try { data = bodyText ? JSON.parse(bodyText) : {}; } catch (e) { data = {}; }
      if (!res.ok) {
        // Le serveur renvoie un code non technique (voir api/scan-invoice.js). S'il n'y en a pas,
        // c'est que la réponse ne vient pas de notre code (page d'erreur de la plateforme) : on
        // déduit la cause du statut HTTP.
        const code =
          data.code ||
          (res.status === 504 || res.status === 408 ? "ai_timeout" :
           res.status === 413 ? "file_too_big" :
           res.status === 401 ? "auth_expired" :
           res.status === 429 || res.status === 503 ? "ai_busy" : "ai_unavailable");
        // Session expirée : on la renouvelle et on renvoie la MÊME facture automatiquement, une
        // seule fois, sans rien demander au restaurateur — il ne doit même pas s'apercevoir qu'il
        // s'est passé quelque chose. Un message ne s'affichera que si ce second essai échoue aussi,
        // ce qui voudrait alors dire qu'il est réellement déconnecté.
        if ((code === "auth_expired" || code === "auth_required") && attempt === 0) {
          try { await supabase.auth.refreshSession(); } catch (e) {}
          clearTimeout(timeoutId);
          return await runScanPipeline(payload, 1);
        }
        const err = new Error(code);
        err.scanCode = code;
        err.httpStatus = res.status;
        // Code HTTP réel renvoyé par Anthropic (voir api/scan-invoice.js) — distingue "notre
        // requête est mal formée" (400) de "leur service est indisponible" (5xx), invisible sinon
        // derrière le code générique ai_unavailable/502.
        err.upstreamStatus = data.upstreamStatus || null;
        throw err;
      }
      // Date du dernier scan réussi, utilisée uniquement par le rappel d'inactivité par email
      // (api/send-reminders.js) — fire-and-forget, un échec ici ne doit jamais bloquer le scan.
      storage.set("lastScanAt", JSON.stringify(new Date().toISOString())).catch(() => {});
      // Filet de sécurité : une remise/récapitulatif/ligne de règlement doit être exclue par
      // l'IA elle-même (voir prompt), mais des tests réels ont montré qu'elle laisse parfois
      // passer ce type de ligne avec tous les champs à null au lieu de l'omettre — un vrai
      // produit a toujours un nom, donc on ignore silencieusement toute ligne sans nom exploitable
      // plutôt que de laisser apparaître une carte vide et confuse dans la vérification.
      // Filet supplémentaire trouvé lors du benchmark de factures longues/dégradées : sous
      // stress visuel maximal, le bloc de totaux en bas de page ("Total HT calculé sur les
      // lignes ci-dessus", "Net à payer...") a été vu découpé en plusieurs fausses lignes
      // produit. Ces lignes ont un nom, donc le filtre ci-dessus ne les attrape pas — on les
      // reconnaît par mots-clés (accents/casse ignorés) au lieu de se fier uniquement au prompt.
      const FOOTER_KEYWORDS = [
        "total ht", "total ttc", "net a payer", "sous total", "recapitulatif", "calcule sur les lignes", "a regler", "montant du",
        // équivalents espagnols du même type de bloc de totaux
        "base imponible", "importe total", "total factura", "a pagar", "iva incluido",
      ];
      const looksLikeFooter = (it) => {
        const text = normalizeStr(`${it.name || ""} ${it.rawLabel || ""}`);
        return FOOTER_KEYWORDS.some((kw) => text.includes(kw));
      };
      const items = (Array.isArray(data.items) ? data.items : [])
        .filter((it) => it && typeof it === "object")
        // String() défensif : un nom renvoyé comme nombre ferait planter .trim() (écran blanc).
        .map((it) => (typeof it.name === "string" || it.name == null ? it : { ...it, name: String(it.name) }))
        .filter((it) => it.name && it.name.trim())
        .filter((it) => !looksLikeFooter(it))
        .map((it) => {
        const { finalUnit, finalUnitPrice, priceInconsistent, expectedTotal, pricingUnknown } = computeItemPricing(it);
        // Signal de confiance déclaré par l'IA elle-même ligne par ligne (voir prompt, règle
        // SIGNAL DE CONFIANCE) : une ligne lue sur un document flou/dense où un chiffre pourrait
        // appartenir à la mauvaise ligne ne doit jamais être traitée comme automatiquement sûre.
        const lowConfidence = !!it.lowConfidence;
        const merged = { ...it, unit: finalUnit, unitPriceHT: pricingUnknown ? 0 : finalUnitPrice, lowConfidence };

        // Priorité à un rapprochement déjà validé manuellement lors d'un scan précédent pour
        // ce même texte brut fournisseur : on lui fait confiance sans repasser par le score.
        const learnedId = findMappedIngredientId(merged.rawLabel, merged.name);
        const match = learnedId ? { id: learnedId, confident: true } : guessIngredientId(merged.name);
        const matchedId = match ? match.id : null;
        const matchedIng = matchedId ? ingredientById(matchedId) : null;
        const activeSup = matchedIng ? activeSupplier(matchedIng) : null;
        const currentPrice = activeSup?.price ?? null;
        const currentPriceIsReal = activeSup?.priceSource && activeSup.priceSource !== "estimate";

        // Un changement d'unité sur un ingrédient déjà utilisé dans une recette est dangereux :
        // la quantité déjà saisie dans cette recette (comprise dans l'ANCIENNE unité) serait
        // silencieusement réinterprétée dans la nouvelle unité au moment de l'import (ex: "2"
        // gousses d'ail en "pièce" deviendrait "2 kg" si l'unité bascule en kg) — cas réel
        // remonté par l'utilisateur (ingrédient créé en "pièce" via le scanner de fiche recette,
        // puis retrouvé en kg sur une vraie facture). Ne bloque pas l'import, mais retire la
        // ligne de "sûr" pour forcer une vérification humaine plutôt qu'une bascule silencieuse.
        const unitChangeAffectsRecipes =
          !!matchedIng &&
          matchedIng.unit &&
          finalUnit &&
          matchedIng.unit !== finalUnit &&
          recipes.some((r) => r.lines.some((l) => l.ingredientId === matchedIng.id));

        // [BUG confirmé et corrigé, 2026-08-25] Comparer currentPrice (dans l'ANCIENNE unité de
        // l'ingrédient) à merged.unitPriceHT (dans la NOUVELLE unité tout juste calculée) n'a de
        // sens que si les deux unités sont les mêmes — sinon c'est une comparaison entre pommes et
        // oranges (ex: 9€/kg comparé à un prix recalculé "par pièce" pour un colis de 5kg à 45€ :
        // aucune vraie hausse, juste deux unités différentes). `unitChangeAffectsRecipes`
        // détectait déjà ce cas juste au-dessus mais son résultat n'était utilisé que pour
        // avertir sur les recettes, jamais pour empêcher ce calcul de prix erroné — trouvé en
        // relisant le code après qu'un test réel ait signalé "en hausse" pour un prix qui avait
        // en fait baissé. Tant que l'unité diffère, on ne peut honnêtement rien affirmer sur le
        // sens de la variation : ni hausse, ni baisse, ni grosse variation.
        const sameUnitAsExisting = !matchedIng?.unit || !finalUnit || matchedIng.unit === finalUnit;

        // Grosse variation à confirmer explicitement — uniquement si on la compare à un
        // VRAI prix déjà observé (jamais contre une simple estimation de départ non vérifiée) ET
        // dans la même unité (voir ci-dessus).
        const bigChange =
          currentPrice !== null && currentPriceIsReal && merged.unitPriceHT > 0 && sameUnitAsExisting
            ? Math.abs(merged.unitPriceHT - currentPrice) / currentPrice > 0.4
            : false;

        // Aucun prix exploitable au final (rien d'imprimé, ou impossible à ramener à un vrai
        // prix au kg/L/pièce) : on ne doit jamais laisser passer ça en "Sûr" à 0€.
        const priceUnusable = pricingUnknown || !(merged.unitPriceHT > 0);

        return {
          ...merged,
          // Un rapprochement douteux (score flou, faute de frappe/OCR) ne doit jamais
          // pré-sélectionner l'ingrédient existant tout seul — cas réel trouvé en test
          // ("Haricot" rapproché à tort d'"Abricot") : par défaut on coche "créer séparément"
          // dès qu'il y a un doute, la suggestion reste visible et cliquable (guessedMatchId)
          // mais l'utilisateur doit l'accepter explicitement plutôt que la subir par défaut.
          assignTo: matchedId && match.confident ? matchedId : "new",
          // Référence stable vers l'ingrédient existant repéré (par l'IA ou la mémoire des
          // rapprochements), conservée même si l'utilisateur choisit "new" ensuite — permet de
          // toujours proposer "garder / renommer / créer séparément" sans perdre la suggestion.
          guessedMatchId: matchedId || null,
          matchConfident: match ? match.confident : false,
          // Par défaut on garde toujours le nom existant : renommer doit être un choix
          // explicite de l'utilisateur, jamais une conséquence silencieuse d'un scan.
          renameOnImport: false,
          imported: false,
          // Passé à true quand la ligne a été validée dans la pile "à vérifier" : elle rejoint
          // alors la liste "sûr" SANS être écrite dans le garde-manger — l'écriture réelle
          // n'arrive qu'au clic sur la coche de la liste. Ça permet de revenir en arrière et
          // corriger un choix (garder/renommer/créer séparément, prix...) après coup, sans avoir
          // à "annuler" un import déjà appliqué à un ingrédient.
          reviewed: false,
          currentPrice,
          currentPriceIsReal,
          priceInconsistent,
          expectedTotal,
          pricingUnknown,
          priceUnusable,
          bigChange,
          unitChangeAffectsRecipes,
          // Exposé explicitement (2026-08-25) pour que l'affichage (ScanItemCard) sache aussi
          // masquer le badge de variation en % quand la comparaison n'a pas de sens — sinon un
          // pourcentage pouvait s'afficher (et sembler fiable) sur deux unités différentes.
          priceComparisonValid: sameUnitAsExisting,
          previousUnit: matchedIng?.unit || null,
          // Seuil aligné sur celui déjà utilisé par priceVariation() (fiche recette) : sous 1%,
          // c'est du bruit d'arrondi, pas une vraie variation. Avant ce correctif le seuil était
          // à 2%, ce qui masquait des hausses/baisses réelles mais modestes (ex: 9.40€ -> 9.60€,
          // ~2.1%, à la limite) — signalé par l'utilisateur comme "je ne vois jamais de variation".
          // sameUnitAsExisting (voir plus haut) : jamais de sens de variation affirmé entre deux
          // unités différentes, ce serait juste faux.
          priceUp: currentPrice !== null && sameUnitAsExisting && merged.unitPriceHT > currentPrice * 1.01,
          priceDown: currentPrice !== null && sameUnitAsExisting && merged.unitPriceHT < currentPrice * 0.99,
        };
      });

      // Seuls les articles non-alimentaires (produits d'entretien, consignes, frais de port...)
      // sont écartés du garde-manger — jamais silencieusement, on les affiche dans un résumé
      // avec la possibilité de les récupérer. Un ingrédient alimentaire dont le prix est
      // introuvable/incalculable reste dans "À vérifier" : il ne doit surtout pas disparaître
      // silencieusement de la recette, l'utilisateur doit pouvoir saisir le prix lui-même
      // (priceUnusable l'empêche seulement d'être auto-importé tant que le prix n'est pas fixé).
      const isExcludable = (it) => it.isFood === false;
      const foodItems = items.filter((it) => !isExcludable(it));
      const excludedItems = items
        .filter(isExcludable)
        .map((it) => ({ ...it, excludeReason: it.isDeposit ? "deposit" : "nonFood" }));

      // Alerte globale si une grosse majorité des prix scannés semble en forte hausse
      // par rapport aux vrais prix déjà connus — signe probable d'un souci de lecture du document.
      const comparable = foodItems.filter((i) => i.currentPrice !== null && i.currentPriceIsReal);
      const manyUp = comparable.length >= 3 && comparable.filter((i) => i.priceUp).length / comparable.length > 0.6;

      // Bandeau discret (jamais bloquant) si une bonne part des lignes ont un signal de
      // confiance bas — signe probable d'une photo floue/inclinée plutôt qu'un souci par ligne.
      const manyLowConfidence = foodItems.length >= 2 && foodItems.filter((i) => i.lowConfidence).length / foodItems.length > 0.3;

      setScanResult({ supplier: data.supplier || null, date: data.date || null, items: foodItems, excludedItems, manyUp, manyLowConfidence });
      // Statistiques agrégées du scanner (2026-08, fire-and-forget) : jamais de contenu de
      // facture, juste des compteurs — voir api/scan-events.js (POST). Sert uniquement à surveiller
      // la fiabilité réelle du scan sur l'ensemble des comptes (interrogeable via le même fichier
      // en GET, protégé par ADMIN_SECRET), invisible dans l'app pour tout utilisateur.
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch("/api/scan-events", {
            method: "POST",
            headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              scanner: "invoice",
              supplierKnown: !!data.supplier,
              totalItems: foodItems.length + excludedItems.length,
              foodItems: foodItems.length,
              excludedItems: excludedItems.length,
              zeroItems: foodItems.length + excludedItems.length === 0,
              lowConfidenceItems: foodItems.filter((i) => i.lowConfidence).length,
              manyLowConfidence,
              priceInconsistentItems: foodItems.filter((i) => i.priceInconsistent).length,
              pricingUnknownItems: foodItems.filter((i) => i.pricingUnknown).length,
            }),
          });
        } catch (e) {}
      })();
      // Vérification "un par un" par défaut dès qu'il y a quelque chose à vérifier — demandé
      // explicitement par l'utilisateur (2026-08) : la liste groupée restait trop facile à
      // survoler sans vraiment regarder chaque ligne. Le mode liste reste accessible via "Fermer".
      const needsReview = foodItems.filter((it) => !isReadyToImport(it));
      if (needsReview.length > 0) {
        setReviewStackOpen(true);
        setStackTotal(needsReview.length);
        setExpandedReviewIdx(null);
      }
    } catch (err) {
      // Classement en catégories compréhensibles par un restaurateur, jamais un message technique.
      // "AbortError" = notre propre délai de 75s dépassé ; un fetch qui échoue sans réponse du tout
      // (TypeError) = connexion perdue, appareil hors ligne, ou tunnel réseau coupé.
      const code =
        err.scanCode ||
        (err.name === "AbortError" ? "ai_timeout" : !navigator.onLine || err.name === "TypeError" ? "offline" : "unknown");
      setScanErr({ code, status: err.httpStatus || null });
      logScanFailure(code, {
        httpStatus: err.httpStatus || null,
        upstreamStatus: err.upstreamStatus || null,
        mode: payload.pdfBase64 ? "pdf" : payload.text ? "pdf_text" : "image",
      });
    } finally {
      clearTimeout(timeoutId);
      setScanning(false);
      setScanStep(null);
    }
  };

  const updateScanItem = (idx, patch) => {
    setScanResult((r) => ({ ...r, items: r.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };

  const importScanItem = (idx, override = {}) => {
    const raw = scanResult.items[idx];
    if (!raw || raw.imported) return;
    const item = { ...raw, ...override };
    const supplierName = scanResult.supplier || t("scanInvoice");
    const finalUnit = item.unit || "kg";
    const finalPrice = item.unitPriceHT || 0;

    let resultingIngredientId;
    if (item.assignTo === "new") {
      const sId = uid();
      const newId = uid();
      resultingIngredientId = newId;
      const catalogGuess = guessCatalogEntry(item.name);
      const ni = {
        id: newId,
        name: item.name,
        unit: finalUnit,
        catalogId: catalogGuess?.confident ? catalogGuess.catalogId : null,
        category: catalogGuess ? catalogGuess.category : "autres",
        selectedSupplierId: sId,
        suppliers: [{ id: sId, name: supplierName, price: finalPrice, priceSource: "scan" }],
        history: [{ date: today(), price: finalPrice, supplierName, supplierId: sId }],
        lastUpdated: today(),
      };
      setIngredients((ings) => [...ings, ni]);
    } else {
      const ingId = item.assignTo;
      resultingIngredientId = ingId;
      setIngredients((ings) =>
        ings.map((ing) => {
          if (ing.id !== ingId) return ing;
          let suppliers = ing.suppliers;
          const existing = suppliers.find((s) => normalizeStr(s.name) === normalizeStr(supplierName));
          // Le fournisseur qu'on vient de confirmer par ce scan devient le fournisseur actif :
          // c'est tout l'intérêt de scanner une facture (refléter le prix réel du moment), sinon
          // le prix affiché restait bloqué sur l'ancien fournisseur (souvent une simple estimation
          // de départ) même après un import "réussi" — bug réel trouvé en test par l'utilisateur.
          let newSelectedSupplierId;
          if (existing) {
            suppliers = suppliers.map((s) => (s.id === existing.id ? { ...s, price: finalPrice, priceSource: "scan" } : s));
            newSelectedSupplierId = existing.id;
          } else {
            const newSupplierId = uid();
            suppliers = [...suppliers, { id: newSupplierId, name: supplierName, price: finalPrice, priceSource: "scan" }];
            newSelectedSupplierId = newSupplierId;
          }
          const priorPrice = existing ? existing.price : undefined;
          const history =
            finalPrice !== priorPrice
              ? [...(ing.history || []), { date: today(), price: finalPrice, supplierName, supplierId: newSelectedSupplierId }].slice(-15)
              : ing.history;
          const renamed = item.renameOnImport && item.name ? { name: item.name, catalogId: null } : {};
          return { ...ing, unit: finalUnit, suppliers, history, lastUpdated: today(), ...renamed, selectedSupplierId: newSelectedSupplierId };
        })
      );
    }
    // L'utilisateur vient de valider (ou corriger) ce rapprochement : on le retient pour que
    // ce même texte brut fournisseur soit reconnu automatiquement lors d'un prochain scan.
    rememberSupplierMapping(item.rawLabel, item.name, resultingIngredientId);
    updateScanItem(idx, { ...override, imported: true });
  };

  // "Importer tout" ne traite QUE les lignes sans aucun signal d'alerte — tout le reste
  // (prix incohérent, conditionnement ambigu, grosse variation, correspondance incertaine)
  // doit être validé ligne par ligne, en connaissance de cause.
  // "new" ne suffit PAS à lui seul : si une suggestion existait (guessedMatchId), l'utilisateur
  // est peut-être seulement en train de choisir "créer séparément" dans le picker sans avoir
  // encore validé — la ligne doit rester dans "à vérifier" jusqu'au clic explicite sur Valider.
  const isSafeScanItem = (item) =>
    !item.priceInconsistent && !item.bigChange && !item.priceUnusable && !item.lowConfidence && !item.unitChangeAffectsRecipes &&
    (item.matchConfident || (item.assignTo === "new" && !item.guessedMatchId));

  // Une ligne rejoint la section "sûr" (éditable, coche pour importer) si elle est intrinsèquement
  // sûre, OU si l'utilisateur vient de la valider dans la pile "à vérifier" (`reviewed`) — dans ce
  // second cas rien n'est encore écrit dans le garde-manger, donc revenir en arrière et corriger
  // reste toujours possible tant que la coche n'a pas été cliquée.
  const isReadyToImport = (item) => isSafeScanItem(item) || item.reviewed;

  const skipScanItem = (idx) => updateScanItem(idx, { skipped: true });
  const unskipScanItem = (idx) => updateScanItem(idx, { skipped: false });

  const restoreExcludedItem = (idx) => {
    setScanResult((r) => {
      if (!r) return r;
      const item = r.excludedItems[idx];
      if (!item) return r;
      return {
        ...r,
        items: [...r.items, item],
        excludedItems: r.excludedItems.filter((_, i) => i !== idx),
      };
    });
  };

  // Après l'import en masse : si tout est réglé (rien à vérifier), on ferme directement la
  // fenêtre au lieu de laisser l'utilisateur devant une liste "importé" qu'il doit fermer
  // lui-même en remontant chercher la croix (frustration réelle remontée en test, 2026-08).
  // S'il reste des lignes à vérifier, on l'emmène directement dans la pile "un par un" plutôt
  // que de le laisser au milieu d'une liste où tout ce qui pouvait être importé l'a déjà été.
  const importAllScanItems = () => {
    const stillNeedsReview = scanResult.items.some((item) => !item.imported && !item.skipped && !isReadyToImport(item));
    scanResult.items.forEach((item, idx) => {
      if (isReadyToImport(item)) importScanItem(idx);
    });
    if (stillNeedsReview) setReviewStackOpen(true);
    else closeScan();
  };

  // Échappatoire depuis la pile de vérification : ignore tout ce qui reste (jamais les lignes
  // déjà importées) et ferme la fenêtre en un clic, pour qui ne veut pas vérifier ligne par ligne.
  const skipAllPendingAndClose = () => {
    scanResult.items.forEach((item, idx) => {
      if (!item.imported && !item.skipped) skipScanItem(idx);
    });
    closeScan();
  };

  const closeScan = () => {
    setScanOpen(false);
    setScanResult(null);
    setScanErr(null);
    setScanImagePreview(null);
    setScanImageZoomed(false);
    setScanPendingImage(null);
    setScanStep(null);
    setLastScanImage(null);
    setReviewStackOpen(false);
    setExpandedReviewIdx(null);
  };

  // Tout code d'erreur inattendu retombe sur "unknown" : garantit qu'un message compréhensible
  // s'affiche toujours, jamais une clé de traduction brute à l'écran.
  const scanErrCode = scanErr && SCAN_ERR_CODES.includes(scanErr.code) ? scanErr.code : "unknown";

  // Ouvre le formulaire de contact avec un message déjà pré-rempli décrivant l'échec, pour que le
  // restaurateur n'ait qu'à cliquer "Envoyer" — et que nous, on reçoive un vrai diagnostic (code
  // d'erreur, statut) plutôt qu'un "ça ne marche pas" impossible à reproduire. Le code entre
  // crochets ne révèle rien du fonctionnement interne, c'est juste un repère de corrélation.
  const reportScanProblem = (codeOverride = null) => {
    const code = codeOverride || scanErr?.code || "unknown";
    setContactMessage(`${t("scanReportPrefill")}\n\n[${code}${scanErr?.status ? `/${scanErr.status}` : ""}]`);
    setContactSent(false);
    setContactErr(null);
    setContactModalOpen(true);
  };

  // ---------------- Scanner de fiche recette (photo/PDF -> pré-remplissage d'une recette) ----------------
  // Fonctionnalité totalement séparée du scanner de factures ci-dessus : autre endpoint serveur
  // (api/scan-recipe.js), autre état, aucune fonction du scanner de factures touchée.
  const handleScanRecipeFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanRecipeOpen(true);
    setScanningRecipe(true);
    setScanRecipeErr(null);
    setScanRecipeResult(null);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    try {
      let payload;
      if (isPdf) {
        const pdfResult = await readPdfFile(file);
        if (pdfResult.text) {
          payload = { text: pdfResult.text, lang };
        } else {
          const ocrText = await runOcr(pdfResult.base64);
          payload = { image: pdfResult.base64, mediaType: pdfResult.mediaType, ocrText, lang };
        }
      } else {
        const { base64, mediaType } = await compressImageFile(file);
        const ocrText = await runOcr(base64);
        payload = { image: base64, mediaType, ocrText, lang };
      }
      // Même preuve de compte que le scanner de factures (voir runScanPipeline) : cet endpoint
      // consomme aussi des crédits d'IA et refuse désormais les appels sans compte connecté.
      const recipeHeaders = { "content-type": "application/json" };
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) recipeHeaders.Authorization = `Bearer ${session.access_token}`;
      } catch (err) {}
      const res = await fetch("/api/scan-recipe", {
        method: "POST",
        headers: recipeHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const debugDetail = data.detail || data.raw;
        const msg = debugDetail ? `${data.error} (${debugDetail})` : data.error || "Échec de l'analyse";
        throw new Error(msg);
      }
      // Filet de sécurité : sur une fiche complexe (plusieurs sous-recettes, ex: "pâte" / "garniture"
      // / "sauce"), l'IA regroupe parfois les lignes par section au lieu d'un tableau plat malgré
      // la consigne du prompt — on aplatit systématiquement plutôt que de planter sur une forme
      // inattendue (`data.lines` objet de sections, ou toute valeur non-tableau).
      let rawLines = [];
      if (Array.isArray(data.lines)) rawLines = data.lines;
      else if (data.lines && typeof data.lines === "object") {
        rawLines = Object.values(data.lines).flatMap((v) => (Array.isArray(v) ? v : []));
      }
      // Coercion tolérante : sur une fiche complexe l'IA renvoie parfois un tableau (ex: étapes
      // numérotées, plusieurs allergènes) là où le prompt demande une seule chaîne — on préserve
      // l'information (jointure) plutôt que de la perdre silencieusement ou de planter dessus.
      const asText = (v, sep = "\n") => {
        if (typeof v === "string") return v;
        if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(sep);
        return "";
      };

      // Filet de sécurité déterministe : le prompt demande à l'IA de toujours convertir
      // g→kg/mL→L/cl→L elle-même, mais elle ne le fait pas toujours (ex: "Cognac 20cl" renvoyé
      // avec unit:"g" ou "cl" tel quel) — l'app ne comprend QUE kg/L/pièce, donc une unité brute
      // non convertie doit être rattrapée ici plutôt que de rester une valeur invalide et bloquée.
      const normalizeScanUnit = (qty, rawUnit) => {
        const u = (rawUnit || "").toString().trim().toLowerCase();
        if (typeof qty === "number") {
          if (["g", "gramme", "grammes"].includes(u)) return { qty: qty / 1000, unit: "kg" };
          if (["ml", "millilitre", "millilitres"].includes(u)) return { qty: qty / 1000, unit: "L" };
          if (["cl", "centilitre", "centilitres"].includes(u)) return { qty: qty / 100, unit: "L" };
        }
        if (u === "kg") return { qty, unit: "kg" };
        if (["l", "litre", "litres"].includes(u)) return { qty, unit: "L" };
        if (["pièce", "piece", "pieces", "pièces", "u", "pc"].includes(u)) return { qty, unit: "pièce" };
        return { qty: null, unit: null }; // unité non reconnue : traitée comme imprécise ci-dessous
      };

      // Rapproche chaque ligne détectée avec le garde-manger existant (même fonction que le
      // scanner de factures) — une correspondance non confiante reste modifiable via
      // ScanNameChoice dans l'écran de vérification, jamais assignée silencieusement.
      const lines = rawLines
        .filter((l) => l && typeof l === "object" && asText(l.name).trim())
        .map((l) => {
          const name = asText(l.name);
          const match = guessIngredientId(name);
          const rawQty = typeof l.qty === "number" ? l.qty : null;
          const normalized = normalizeScanUnit(rawQty, asText(l.unit));
          let qty = normalized.unit ? normalized.qty : null;
          let unit = normalized.unit;
          const impreciseQuantity = !!l.impreciseQuantity || qty === null || unit === null;
          // Sur une quantité imprécise, l'unité proposée par l'IA n'est pas fiable (ex: "pièce"
          // hasardeux pour de la viande sans poids écrit, ou unité non reconnue) — préférer
          // l'unité habituelle de la catégorie devinée, affichée dès la vérification pour rester
          // cohérente avec ce qui sera réellement créé (voir createRecipeFromScan).
          if (impreciseQuantity) {
            qty = null;
            const catalogGuess = guessCatalogEntry(name);
            unit = CATEGORY_DEFAULT_UNIT[catalogGuess ? catalogGuess.category : "autres"] || "kg";
          }
          return {
            rawText: asText(l.rawText) || name,
            name,
            qty,
            unit,
            impreciseQuantity,
            // Un rapprochement douteux ne doit jamais pré-sélectionner l'ingrédient existant tout
            // seul (même règle que le scanner de factures, voir handleScanFile) : par défaut
            // "créer séparément" tant que le match n'est pas confiant, la suggestion reste
            // disponible via guessedMatchId pour que l'utilisateur l'accepte explicitement.
            assignTo: match && match.confident ? match.id : "new",
            guessedMatchId: match ? match.id : null,
            matchConfident: match ? match.confident : false,
            renameOnImport: false,
          };
        });
      setScanRecipeResult({
        name: asText(data.name),
        portions: typeof data.portions === "number" && data.portions > 0 ? data.portions : 4,
        sellPrice: typeof data.sellPrice === "number" ? data.sellPrice : 0,
        allergens: asText(data.allergens, ", "),
        notes: asText(data.notes),
        lines,
      });
    } catch (err) {
      setScanRecipeErr(err.message || "Erreur inattendue");
    } finally {
      setScanningRecipe(false);
    }
  };

  const updateScanRecipeLine = (idx, patch) => {
    setScanRecipeResult((r) => ({ ...r, lines: r.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  };
  const updateScanRecipeField = (patch) => setScanRecipeResult((r) => ({ ...r, ...patch }));
  const removeScanRecipeLine = (idx) => setScanRecipeResult((r) => ({ ...r, lines: r.lines.filter((_, i) => i !== idx) }));

  const closeScanRecipe = () => {
    setScanRecipeOpen(false);
    setScanRecipeResult(null);
    setScanRecipeErr(null);
  };

  // Construit la recette (et les ingrédients manquants) à partir du résultat vérifié, puis ouvre
  // la fiche recette créée. Même logique de création d'ingrédient que le scanner de factures
  // (guessCatalogEntry pour catégorie/catalogId), mais avec un prix ESTIMÉ par catégorie plutôt
  // qu'un vrai prix fournisseur (aucune facture ici) — priceSource "estimate", modifiable ensuite
  // dans le garde-manger comme n'importe quel ingrédient créé via l'assistant.
  const createRecipeFromScan = () => {
    if (!scanRecipeResult) return;
    const newIngredients = [];
    const renameOps = []; // { id, name } — ingrédients existants à renommer (choix "renommer" dans ScanNameChoice)
    const resolvedLines = scanRecipeResult.lines.map((line) => {
      let ingredientId;
      let unitAtEntry;
      if (line.assignTo === "new") {
        const catalogGuess = guessCatalogEntry(line.name);
        const category = catalogGuess ? catalogGuess.category : "autres";
        const sId = uid();
        ingredientId = uid();
        // Sur une quantité imprécise, l'unité proposée par l'IA n'est pas fiable (voir
        // api/scan-recipe.js) — on préfère l'unité habituelle de la catégorie plutôt que de
        // suivre un "pièce" hasardeux pour un ingrédient normalement vendu au poids.
        const unit = line.impreciseQuantity ? CATEGORY_DEFAULT_UNIT[category] || "kg" : line.unit || "kg";
        unitAtEntry = unit;
        newIngredients.push({
          id: ingredientId,
          name: line.name,
          unit,
          catalogId: catalogGuess?.confident ? catalogGuess.catalogId : null,
          category,
          selectedSupplierId: sId,
          suppliers: [{ id: sId, name: t("supplier"), price: CATEGORY_ESTIMATE_PRICE[category] || 5, priceSource: "estimate" }],
          history: [],
          lastUpdated: today(),
        });
      } else {
        ingredientId = line.assignTo;
        if (line.renameOnImport && line.name) renameOps.push({ id: ingredientId, name: line.name });
        unitAtEntry = ingredients.find((i) => i.id === ingredientId)?.unit;
      }
      return { ingredientId, qty: line.impreciseQuantity ? 0 : line.qty || 0, unitAtEntry };
    });

    if (newIngredients.length || renameOps.length) {
      setIngredients((ings) => {
        const renamed = ings.map((ing) => {
          const r = renameOps.find((x) => x.id === ing.id);
          return r ? { ...ing, name: r.name, catalogId: null } : ing;
        });
        return [...renamed, ...newIngredients];
      });
    }

    const newRecipe = {
      id: uid(),
      name: scanRecipeResult.name || t("newRecipeName"),
      portions: scanRecipeResult.portions || 4,
      sellPrice: scanRecipeResult.sellPrice || 0,
      targetMargin: 75,
      notes: scanRecipeResult.notes || "",
      allergens: scanRecipeResult.allergens || "",
      allergensAuto: !scanRecipeResult.allergens,
      createdAt: today(),
      lines: resolvedLines.filter((l) => l.ingredientId),
    };
    setRecipes((rs) => [...rs, newRecipe]);
    setActiveId(newRecipe.id);
    setActiveTab("recipes");
    setRecipeSubView("detail");
    closeScanRecipe();
    logActivity("recipe_created", { name: newRecipe.name });
  };

  // L'objectif propre à la recette (`targetMargin`, éditable dans la fiche) prévaut sur le
  // réglage global s'il a été personnalisé — sinon retombe sur le même seuil que partout ailleurs.
  const tier = marginTier(margin, active?.targetMargin ?? settings.minMargin);
  const marginLow = tier === "low";
  // Suggestion contextuelle : uniquement quand la marge est sous l'objectif (mid/low),
  // jamais sur une recette déjà au-dessus (pas de conseil "à corriger" quand tout va bien).
  const marginSuggestion =
    active && tier && tier !== "high" ? recipeSuggestion(active, ingredients, lineCost, ingredientDisplayName, lang) : null;

  const wizardExistingSuggestions = wizardQuery.trim()
    ? ingredients
        .filter((i) => textIncludes(ingredientDisplayName(i), wizardQuery))
        .slice(0, 5)
    : [];
  const wizardExistingCatalogIds = new Set(ingredients.map((i) => i.catalogId).filter(Boolean));
  const wizardCatalogSuggestions = wizardQuery.trim()
    ? CATALOG.filter(
        (c) => !wizardExistingCatalogIds.has(c.id) && textIncludes(c[lang], wizardQuery)
      ).slice(0, 5)
    : [];

  const pantryFiltered = ingredients.filter((i) => {
    const q = pantryQuery.trim();
    // Dès qu'on tape quelque chose, la recherche porte sur TOUT le garde-manger, quel que soit
    // l'onglet catégorie actif — sinon un ingrédient mal classé (ex: dans "Autres" au lieu de
    // "Viandes") devient introuvable par nom tant qu'on n'a pas deviné dans quelle catégorie il
    // a atterri. Bug réel signalé : chercher "boeuf" pendant qu'on est sur l'onglet "Autres" ne
    // sortait rien si le produit était en fait classé ailleurs.
    if (q !== "") return textIncludes(ingredientDisplayName(i), q);
    if (pantryCategory === "none") return false; // rien par défaut : il faut choisir une catégorie ou chercher
    if (pantryCategory === "recent") return true; // filtré par date plus bas
    return pantryCategory === "all" || (i.category || "autres") === pantryCategory;
  });

  // Tableau du garde-manger : regroupé par catégorie, puis ordre alphabétique dans chaque groupe.
  const pantryGrouped = CATEGORIES.map((c) => ({
    label: c[lang],
    items: pantryFiltered
      .filter((i) => (i.category || "autres") === c.id)
      .sort((a, b) => ingredientDisplayName(a).localeCompare(ingredientDisplayName(b), lang)),
  })).filter((g) => g.items.length > 0);

  // Vue "récents" : regroupe par ancienneté de dernière mise à jour plutôt que par catégorie,
  // pour retrouver facilement un ingrédient qu'on vient de scanner/modifier.
  const daysSince = (dateStr) => {
    if (!dateStr) return Infinity;
    return Math.round((new Date(today()) - new Date(dateStr)) / 86400000);
  };
  const recentGrouped =
    pantryCategory === "recent"
      ? (() => {
          const withDate = pantryFiltered
            .filter((i) => i.lastUpdated)
            .sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || ""));
          const buckets = { today: [], week: [], month: [] };
          withDate.forEach((i) => {
            const d = daysSince(i.lastUpdated);
            if (d <= 0) buckets.today.push(i);
            else if (d <= 7) buckets.week.push(i);
            else if (d <= 31) buckets.month.push(i);
          });
          return [
            { label: t("recentToday"), items: buckets.today },
            { label: t("recentWeek"), items: buckets.week },
            { label: t("recentMonth"), items: buckets.month },
          ].filter((g) => g.items.length > 0);
        })()
      : null;

  // Le seuil vert ne peut jamais descendre sous 70% (règle fixe du rouge) — on l'utilise
  // pour le texte d'aide afin qu'il reste cohérent avec les couleurs réellement affichées.
  const effectiveGreenTarget = Math.max(settings.minMargin || 0, CRITICAL_MARGIN);
  const hasOrangeZone = effectiveGreenTarget > CRITICAL_MARGIN;

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: "#16130F", maxWidth: "100vw" }}>
      <style>{`
        /* Import de police + .font-display/.font-body/.font-mono : déplacés dans src/index.css
           (2026-08-29) pour être chargés même avant la connexion — voir le commentaire là-bas. */
        * { box-sizing: border-box; }
        /* [REFONTE 2026-08-27] La fiche recette ne ressemble plus à un ticket de caisse.
           L'utilisateur ne voulait plus de cette métaphore : bords dentelés, papier crème étroit,
           police à chasse fixe. Elle devient une vraie fiche de travail — pleine largeur, coins
           arrondis, typographie lisible.
           ⚠️ Contrainte majeure : ce MÊME bloc DOM est la mise en page d'impression (voir
           @media print plus bas, qui ne rend visible que .ticket). On garde donc une surface
           CLAIRE, sinon les innombrables classes text-black/... des lignes d'ingrédients
           deviendraient illisibles et il faudrait toutes les réécrire — pour un résultat
           identique à l'impression. Le nom de classe .ticket est conservé pour la même raison :
           le renommer obligerait à toucher la règle d'impression et la fiche allergènes. */
        .ticket {
          background: #FBF8F3; color: #211D18; position: relative;
          border-radius: 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.28);
          max-width: 100%;
        }
        .stamp { border: 3px solid currentColor; transform: rotate(-6deg); font-family: 'Big Shoulders Display', sans-serif; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; }
        @media print {
          body * { visibility: hidden; }
          .ticket, .ticket *, .allergen-sheet, .allergen-sheet * { visibility: visible; }
          /* À l'impression on retrouve une vraie feuille : ni ombre, ni coins arrondis, ni fond
             teinté (économie d'encre), et une largeur de page classique plutôt que la pleine
             largeur d'écran. */
          .ticket {
            position: absolute; top: 0; left: 0; right: 0; margin: 0 auto;
            box-shadow: none; border-radius: 0; background: #fff; max-width: 190mm;
          }
          .allergen-sheet { position: absolute; top: 0; left: 0; right: 0; margin: 0 auto; }
          .hide-prices .price-field { display: none !important; }
        }
        @media (max-width: 1024px) { .grid-main { grid-template-columns: 1fr !important; } }
        /* Empêche le zoom automatique de Safari mobile sur les champs de saisie
           (qui décalait la vue et cachait les suggestions dès la 1ère lettre tapée). */
        @media (max-width: 767px) {
          input, select, textarea { font-size: 16px !important; }
        }
        @keyframes scanPulse {
          0%, 100% { transform: translateY(-18px); opacity: 0; }
          15% { opacity: 1; }
          50% { transform: translateY(18px); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-18px); opacity: 0; }
        }
        @keyframes scanFlash {
          0%, 70%, 100% { transform: scale(1); }
          78% { transform: scale(1.15); }
          86% { transform: scale(1); }
        }
        @keyframes wizardStepIn {
          from { opacity: 0; transform: translateX(14px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes successPop {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>

      <header className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2 print:hidden" style={{ background: "#201B15", borderBottom: "1px solid rgba(201,154,85,0.25)" }}>
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <h1 className="font-display text-white text-base sm:text-lg tracking-wide uppercase">{t("appTitle")}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 font-body text-xs text-white/50 flex-wrap">
          {!ready ? t("loading") : loadErr ? (
            <span className="text-amber-400">{t("dataUnavailable")}</span>
          ) : (
            <span className={`flex items-center gap-1 transition-opacity ${savedPulse ? "opacity-100" : "opacity-0"}`}>
              <Check size={14} color="#10B981" /> {t("saved")}
            </span>
          )}
          <button onClick={() => setAccountMenuOpen(true)} className="text-white/60 hover:text-[#C9793B]" title={t("myAccount")}>
            <User size={16} />
          </button>
          <button onClick={() => setShowSettings(true)} className="text-white/60 hover:text-[#C9793B]" title={t("settings")}>
            <SettingsIcon size={16} />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-white/60 hover:text-[#C9793B]" title={t("logout")}>
            <LogOut size={16} />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => changeLang("fr")} className={`text-lg leading-none ${lang === "fr" ? "" : "opacity-40 grayscale"}`} title="Français">🇫🇷</button>
            <button onClick={() => changeLang("es")} className={`text-lg leading-none ${lang === "es" ? "" : "opacity-40 grayscale"}`} title="Español">🇪🇸</button>
            <button onClick={() => changeLang("en")} className={`text-lg leading-none ${lang === "en" ? "" : "opacity-40 grayscale"}`} title="English">🇬🇧</button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setShowSettings(false)}>
          <div className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10" style={{ background: "#201B15" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-4">{t("settings")}</h3>
            <label className="text-xs text-white/60 block mb-1">{t("defaultVat")}</label>
            <select
              value={settings.vat}
              onChange={(e) => setSettings({ ...settings, vat: parseFloat(e.target.value) })}
              className="w-full bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none mb-4"
              style={{ colorScheme: "dark" }}
            >
              <option value={5.5}>5.5%</option>
              <option value={10}>10% ({t("vatOption10Hint")})</option>
              <option value={20}>20%</option>
              <option value={21}>21% ({t("vatOption21Hint")})</option>
            </select>

            <label className="text-xs text-white/60 block mb-1">{t("minMarginLabel")}</label>
            <div className="flex items-center gap-2 mb-1">
              <NumField
                allowDecimal={false}
                value={settings.minMargin}
                onChange={(v) => setSettings({ ...settings, minMargin: Math.max(v, 0) })}
                className="w-16 bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none text-right"
              />
              <span className="text-white/60 text-sm">%</span>
            </div>
            <p className="text-[10px] text-white/30 mb-4">
              {hasOrangeZone
                ? t("marginLegendWithOrange")(effectiveGreenTarget, CRITICAL_MARGIN)
                : t("marginLegendNoOrange")(CRITICAL_MARGIN)}
            </p>

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailRemindersEnabled !== false}
                onChange={(e) => setSettings({ ...settings, emailRemindersEnabled: e.target.checked })}
                className="mt-0.5 shrink-0"
              />
              <span>
                <span className="text-xs text-white/70 block">{t("emailRemindersLabel")}</span>
                <span className="text-[10px] text-white/30 block mt-0.5">{t("emailRemindersHint")}</span>
              </span>
            </label>

            <button onClick={() => setShowSettings(false)} className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]">
              {t("close")}
            </button>
            <button onClick={clearAll} className="w-full text-center mt-3 text-[11px] text-white/30 hover:text-[#B23A2E] underline">
              {t("resetData")}
            </button>
          </div>
        </div>
      )}

      {accountMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setAccountMenuOpen(false)}>
          <div className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10" style={{ background: "#201B15" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-4">{t("myAccount")}</h3>

            {portalErr && (
              <div className="mb-3 text-[11px] rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">{portalErr}</div>
            )}
            <button
              onClick={manageSubscription}
              disabled={portalBusy}
              className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 disabled:opacity-60 mb-2"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              {portalBusy && <Loader2 size={12} className="animate-spin" />}
              {t("billingManageSubscription")}
            </button>
            <button
              onClick={() => { setAccountMenuOpen(false); setContactModalOpen(true); setContactSent(false); setContactErr(null); }}
              className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B] flex items-center justify-center gap-2 mb-2"
            >
              <Mail size={12} /> {t("contactButton")}
            </button>
            {isAdmin && (
              <button
                onClick={() => { setAccountMenuOpen(false); setAdminDashboardOpen(true); }}
                className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B] flex items-center justify-center gap-2 mb-2"
              >
                <TrendingUp size={12} /> Admin
              </button>
            )}
            {!isStandaloneApp && (
              <button
                onClick={handleInstallClick}
                className={
                  installPromptReady
                    ? "w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 mb-2"
                    : "w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B] flex items-center justify-center gap-2 mb-2"
                }
                style={installPromptReady ? { background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW } : undefined}
              >
                <Smartphone size={12} /> {t("installAppButton")}
              </button>
            )}
            <button onClick={() => setAccountMenuOpen(false)} className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]">
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {installInstructionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setInstallInstructionsOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <Smartphone size={16} className="text-[#C9793B]" />
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("installModalTitle")}</h3>
            </div>
            <InstallDiagram
              sourceIcon={isIOSDevice && !isIOSChromeDevice ? Share : MoreVertical}
              sourceLabel={isIOSDevice && !isIOSChromeDevice ? t("installDiagramShareLabel") : t("installDiagramMenuLabel")}
              targetLabel={isIOSDevice ? t("installDiagramHomeLabel") : t("installDiagramInstallLabel")}
            />
            <p className="text-white/70 text-sm mb-5">
              {isIOSChromeDevice
                ? t("installInstructionsIOSChrome")
                : isIOSDevice
                ? t("installInstructionsIOS")
                : t("installInstructionsAndroid")}
            </p>
            {!isIOSDevice && <p className="text-white/40 text-xs mb-5">{t("installInstructionsGeneric")}</p>}
            <button
              onClick={() => setInstallInstructionsOpen(false)}
              className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {adminDashboardOpen && isAdmin && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col print:hidden">
          <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/10" style={{ background: "#201B15" }}>
            <span className="text-white font-display uppercase text-sm tracking-wide">Tableau de bord</span>
            <button onClick={() => setAdminDashboardOpen(false)} className="text-white/60 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={{ background: "#16130F" }}>
            <AdminDashboard />
          </div>
        </div>
      )}


      {contactModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setContactModalOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-3">{t("contactModalTitle")}</h3>
            {contactSent ? (
              <>
                <p className="text-white/70 text-sm mb-5">{t("contactSuccessMessage")}</p>
                <button
                  onClick={() => setContactModalOpen(false)}
                  className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
                >
                  {t("close")}
                </button>
              </>
            ) : (
              <>
                <p className="text-white/50 text-xs mb-3">{t("contactHint")}</p>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder={t("contactPlaceholder")}
                  rows={5}
                  className="w-full bg-black/20 text-white text-sm rounded p-2.5 outline-none mb-2"
                />

                <input ref={fileInputContactRef} type="file" accept="image/*" className="hidden" onChange={handleContactAttachment} />
                {contactAttachment ? (
                  <div className="flex items-center gap-2 mb-3 text-[11px] text-white/60 bg-black/20 rounded px-2.5 py-1.5">
                    <Paperclip size={12} className="shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{contactAttachment.fileName}</span>
                    <button onClick={() => setContactAttachment(null)} className="text-white/40 hover:text-[#EF4444] shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputContactRef.current?.click()}
                    disabled={contactAttaching}
                    className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white mb-3 disabled:opacity-50"
                  >
                    {contactAttaching ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                    {t("contactAttachButton")}
                  </button>
                )}

                {contactErr && (
                  <div className="mb-3 text-[11px] rounded-lg px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">{contactErr}</div>
                )}
                <button
                  onClick={sendContactMessage}
                  disabled={contactSending || !contactMessage.trim()}
                  className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 mb-2"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  {contactSending && <Loader2 size={12} className="animate-spin" />}
                  {t("contactSendButton")}
                </button>
                <button
                  onClick={() => setContactModalOpen(false)}
                  className="w-full text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
                >
                  {t("close")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setResetConfirmOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3" style={{ color: TIER_COLORS.low }}>
              <AlertTriangle size={18} className="shrink-0" />
              <h3 className="font-display uppercase tracking-wide text-sm">{t("resetData")}</h3>
            </div>
            <p className="text-white/70 text-sm mb-5">{t("resetDataConfirm")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded border border-white/20 text-white/70 hover:border-white/40"
              >
                {t("cancelLabel")}
              </button>
              <button
                onClick={performReset}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded text-white"
                style={{ background: TIER_COLORS.low }}
              >
                {t("resetConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setBulkDeleteConfirmOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3" style={{ color: TIER_COLORS.low }}>
              <AlertTriangle size={18} className="shrink-0" />
              <h3 className="font-display uppercase tracking-wide text-sm">{t("deleteSelectedButton")(selectedRecentIds.size)}</h3>
            </div>
            <p className="text-white/70 text-sm mb-5">{t("deleteSelectedConfirm")(selectedRecentIds.size)}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded border border-white/20 text-white/70 hover:border-white/40"
              >
                {t("cancelLabel")}
              </button>
              <button
                onClick={deleteSelectedRecentIngredients}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded text-white"
                style={{ background: TIER_COLORS.low }}
              >
                {t("resetConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {lossModalOpen && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setLossModalOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-1">{t("declareLossesTitle")}</h3>
            <p className="text-white/50 text-xs mb-4 leading-relaxed">{t("declareLossesHint")}</p>
            <div className="space-y-1.5 overflow-y-auto pr-0.5">
              {Array.from(new Map(active.lines.map((l) => [l.ingredientId, l])).keys())
                .map((ingId) => ingredientById(ingId))
                .filter(Boolean)
                .map((ing) => (
                  <div key={ing.id} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "#16130F" }}>
                    <span className="flex-1 min-w-0 text-white truncate">{ingredientDisplayName(ing)}</span>
                    <NumField
                      value={ing.lossPercent || 0}
                      onChange={(v) => updateIngredientField(ing.id, "lossPercent", Math.min(Math.max(v, 0), 95))}
                      allowDecimal={false}
                      className="w-12 bg-black/30 text-white text-right outline-none rounded px-1.5 py-1"
                    />
                    <span className="text-white/40 shrink-0">%</span>
                  </div>
                ))}
            </div>
            <button
              onClick={() => setLossModalOpen(false)}
              className="w-full mt-4 text-xs font-display uppercase tracking-wide py-2 rounded border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B] shrink-0"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {addToMenuModalOpen && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 print:hidden" onClick={() => setAddToMenuModalOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-sm font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-white uppercase tracking-wide text-sm mb-1">{t("addToMenuTitle")}</h3>
            <p className="text-white/50 text-xs mb-4 leading-relaxed">{t("addToMenuHint")(active.name)}</p>
            <span className="text-[10px] uppercase tracking-wide text-white/40 block mb-1.5">{t("menuSectionPickLabel")}</span>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {menuCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAddToMenuSection(c.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={
                    addToMenuSection === c.id
                      ? { background: BRAND_GRADIENT, color: "#fff" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {categoryLabel(c, lang)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddToMenuModalOpen(false)}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded border border-white/20 text-white/70 hover:border-white/40"
              >
                {t("cancelLabel")}
              </button>
              <button
                onClick={addRecipeToMenu}
                className="flex-1 text-xs font-display uppercase tracking-wide py-2.5 rounded-full"
                style={{ background: BRAND_GRADIENT, color: "#fff" }}
              >
                {t("addToMenuConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {scanRecipeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={closeScanRecipe}>
          <div
            className="rounded-2xl p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("scanRecipeResultTitle")}</h3>
              <button onClick={closeScanRecipe} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {scanningRecipe && (
              <div className="flex flex-col items-center justify-center py-10 text-white/60 text-sm gap-3">
                <Loader2 size={26} className="animate-spin" style={{ color: BRAND_SOLID }} />
                {t("scanningRecipe")}
              </div>
            )}

            {scanRecipeErr && !scanningRecipe && (
              <div className="text-center py-6">
                <div className="text-[#B23A2E] text-sm mb-3">{t("scanError")} : {scanRecipeErr}</div>
                <button
                  onClick={() => fileInputRecipeLibraryRef.current?.click()}
                  className="text-xs uppercase tracking-wide px-3 py-1.5 rounded border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
                >
                  {t("scanRetry")}
                </button>
              </div>
            )}

            {scanRecipeResult && !scanningRecipe && (
              <div>
                <p className="text-[11px] text-white/40 mb-3">{t("scanRecipeHint")}</p>

                <label className="text-xs text-white/60 block mb-1">{t("newRecipeName")}</label>
                <input
                  value={scanRecipeResult.name}
                  onChange={(e) => updateScanRecipeField({ name: e.target.value })}
                  className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none mb-3"
                />

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-white/60 block mb-1">{t("portions")}</label>
                    <NumField
                      allowDecimal={false}
                      value={scanRecipeResult.portions}
                      onChange={(v) => updateScanRecipeField({ portions: Math.max(v, 1) })}
                      className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 block mb-1">{t("sellPriceHT")}</label>
                    <NumField
                      value={scanRecipeResult.sellPrice}
                      onChange={(v) => updateScanRecipeField({ sellPrice: Math.max(v, 0) })}
                      className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none"
                    />
                  </div>
                </div>

                <label className="text-xs text-white/60 block mb-1">{t("scanRecipeIngredientsLabel")}</label>
                {scanRecipeResult.lines.length === 0 && (
                  <p className="text-white/30 text-xs mb-3">{t("scanRecipeNoLines")}</p>
                )}
                <div className="space-y-2 mb-4">
                  {scanRecipeResult.lines.map((line, idx) => {
                    const guessedIng = line.guessedMatchId ? ingredients.find((i) => i.id === line.guessedMatchId) : null;
                    return (
                      <div key={idx} className="rounded-lg p-3 border border-white/10 bg-black/10">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <input
                              value={line.name}
                              onChange={(e) => updateScanRecipeLine(idx, { name: e.target.value })}
                              className="w-full bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#C9793B] pb-0.5"
                            />
                            <div className="text-[11px] text-white/45 mt-1 truncate">{line.rawText}</div>
                          </div>
                          <button
                            onClick={() => removeScanRecipeLine(idx)}
                            title={t("scanRecipeRemoveLine")}
                            className="shrink-0 text-white/25 hover:text-[#EF4444] p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {line.impreciseQuantity && (
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={13} className="shrink-0" style={{ color: TIER_COLORS.mid }} />
                            <span className="text-[11px]" style={{ color: TIER_COLORS.mid }}>
                              {t("scanRecipeImpreciseWarning")(line.rawText)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-2">
                          <QtyField
                            qty={line.qty || 0}
                            unit={line.unit}
                            onChange={(v) => updateScanRecipeLine(idx, { qty: v, impreciseQuantity: false })}
                            className="w-24 bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none"
                            t={t}
                          />
                          {/* Unité toujours modifiable à la main : filet de sécurité si l'unité
                              devinée (IA ou repli par catégorie) ne convient pas — signalé comme
                              bloquant par l'utilisateur en test réel (ex: cognac deviné en "g"). */}
                          <select
                            value={line.unit}
                            onChange={(e) => updateScanRecipeLine(idx, { unit: e.target.value })}
                            title={t("unitFieldLabel")}
                            className="bg-black/20 text-white text-sm rounded px-2 py-1.5 outline-none"
                            style={{ colorScheme: "dark" }}
                          >
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="pièce">{t("unitPieceLabel")}</option>
                          </select>
                        </div>

                        <ScanNameChoice
                          item={line}
                          guessedIng={guessedIng}
                          ingredientDisplayName={ingredientDisplayName}
                          onUpdate={(patch) => updateScanRecipeLine(idx, patch)}
                          t={t}
                        />
                      </div>
                    );
                  })}
                </div>

                <label className="text-xs text-white/60 block mb-1">{t("notes")}</label>
                <textarea
                  value={scanRecipeResult.notes}
                  onChange={(e) => updateScanRecipeField({ notes: e.target.value })}
                  rows={4}
                  className="w-full bg-black/20 text-white text-sm rounded p-2.5 outline-none mb-3"
                />

                <label className="text-xs text-white/60 block mb-1">{t("allergens")}</label>
                <input
                  value={scanRecipeResult.allergens}
                  onChange={(e) => updateScanRecipeField({ allergens: e.target.value })}
                  placeholder={t("allergensPlaceholder")}
                  className="w-full bg-black/20 text-white text-sm rounded px-2.5 py-2 outline-none mb-4"
                />

                <button
                  onClick={createRecipeFromScan}
                  className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  <Check size={15} /> {t("scanRecipeCreateButton")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {scanOpen && (
        // ⚠️ Le clic à côté ne ferme PAS pendant l'analyse : un scan prend 30 à 60 secondes, et un
        // tap distrait sur le fond noir effaçait tout le résultat au moment où il arrivait — le
        // restaurateur voyait alors simplement "il ne s'est rien passé", sans aucune erreur.
        // La croix reste disponible pour annuler volontairement.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={() => { if (!scanning) closeScan(); }}>
          <div
            className="rounded-2xl p-5 w-full max-w-xl max-h-[85vh] overflow-y-auto font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("scanResultTitle")}</h3>
              <button onClick={closeScan} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {scanPendingImage && !scanning && (
              <div className="mb-3 rounded-lg border border-white/10 overflow-hidden">
                <img src={scanImagePreview} alt="" className="w-full max-h-72 object-contain bg-black/30" />
                <div className="flex items-center gap-2 p-2.5">
                  <button
                    onClick={() => rotateScanPendingImage(-90)}
                    className="p-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => rotateScanPendingImage(90)}
                    className="p-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  >
                    <RotateCw size={16} />
                  </button>
                  <span className="text-[11px] text-white/40 flex-1">{t("scanRotateHint")}</span>
                  <button
                    onClick={() => confirmScanImage()}
                    className="text-xs font-display uppercase tracking-wide px-4 py-2 rounded-full shrink-0"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    {t("scanAnalyzeButton")}
                  </button>
                </div>
                {/* Conseil "diviser en 2" (2026-08-25) : reflète directement ce qui a débloqué un
                    cas réel dense/flou testé par l'utilisateur (coupé en 2 photos haut/bas +
                    recadré = ça a marché, alors que la photo entière échouait). Toujours visible
                    ici, avant même de lancer l'analyse — un vrai client ne lira jamais ce conseil
                    s'il n'apparaît que dans un écran d'erreur après un premier échec. */}
                <div className="px-2.5 pb-2.5 -mt-1 flex items-start gap-1.5 text-[10px] text-white/35">
                  <Info size={11} className="shrink-0 mt-0.5" />
                  <span>{t("scanSplitTip")}</span>
                </div>
              </div>
            )}

            {scanImagePreview && !scanPendingImage && (
              <details open className="mb-3 rounded-lg border border-white/10 overflow-hidden">
                <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white/80 select-none">
                  {t("scanImagePreviewLabel")}
                </summary>
                <img
                  src={scanImagePreview}
                  alt=""
                  onClick={() => setScanImageZoomed(true)}
                  className="w-full max-h-64 object-contain bg-black/30 cursor-zoom-in"
                />
              </details>
            )}

            {scanImageZoomed && scanImagePreview && (
              <div
                className="fixed inset-0 z-[60] bg-black overflow-auto"
                onClick={() => setScanImageZoomed(false)}
              >
                <img src={scanImagePreview} alt="" className="w-full h-auto" />
                <button
                  onClick={() => setScanImageZoomed(false)}
                  className="fixed top-4 right-4 text-white bg-black/60 rounded-full p-2"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {scanning && (
              <div className="flex flex-col items-center justify-center py-10 text-white/60 text-sm gap-3">
                <Loader2 size={26} className="animate-spin" style={{ color: BRAND_SOLID }} />
                <div className="text-center">
                  <div>{t("scanning")}</div>
                  {scanStep && <div className="text-white/35 text-[11px] mt-1">{t(`scanStep_${scanStep}`)}</div>}
                  <div className="text-white/25 text-[11px] mt-2">{t("scanningPatience")}</div>
                </div>
              </div>
            )}

            {/* Écran d'erreur repensé (2026-08-24) : plus jamais un message technique brut. Trois
                choses systématiquement présentes — ce qui s'est passé, quoi faire concrètement, et
                un moyen de nous joindre en un tap sans quitter l'app. Objectif explicite : qu'un
                restaurateur bloqué à son premier scan ne reparte pas en silence. */}
            {scanErr && !scanning && (
              <div className="py-2">
                <div className="rounded-xl p-4 mb-3" style={{ background: `${TIER_COLORS.low}14`, border: `1px solid ${TIER_COLORS.low}40` }}>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: TIER_COLORS.low }} />
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-sm mb-1">{t(`scanErrTitle_${scanErrCode}`)}</div>
                      <div className="text-white/60 text-xs leading-relaxed">{t(`scanErrBody_${scanErrCode}`)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="text-white/50 text-[11px] uppercase tracking-wide font-display mb-1.5">{t("scanErrWhatToDo")}</div>
                  <ul className="text-white/70 text-xs leading-relaxed space-y-1">
                    {t(`scanErrTips_${scanErrCode}`).map((tip, i) => (
                      <li key={i} className="flex gap-2">
                        <span style={{ color: BRAND_SOLID }}>•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={retryLastScan}
                    className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    <RefreshCw size={14} /> {lastScanImage ? t("scanRetrySamePhoto") : t("scanRetry")}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputLibraryRef.current?.click()}
                      className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
                    >
                      {t("scanRetryOtherFile")}
                    </button>
                    <button
                      onClick={() => reportScanProblem()}
                      className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
                    >
                      {t("scanReportProblem")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {scanResult && !scanning && (
              <div>
                <div className="text-xs text-white/50 mb-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>{t("scanSupplier")}: <span className="text-white/80">{scanResult.supplier || "—"}</span></span>
                  <span>{t("scanDate")}: <span className="text-white/80">{scanResult.date || "—"}</span></span>
                </div>
                <p className="text-[11px] text-white/40 mb-3">{t("scanHint")}</p>

                {scanResult.manyUp && (
                  <div className="flex items-start gap-2 rounded-lg p-2.5 mb-3 text-xs" style={{ background: `${TIER_COLORS.low}18`, color: TIER_COLORS.low }}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {t("scanManyUpWarning")}
                  </div>
                )}

                {/* Bandeau discret, jamais bloquant : juste un avertissement, l'utilisateur reste
                    libre d'importer — la vraie protection reste le triangle orange par ligne. */}
                {scanResult.manyLowConfidence && (
                  <div className="flex items-start gap-2 rounded-lg p-2.5 mb-3 text-xs" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    {t("scanLowConfidenceBanner")}
                  </div>
                )}

                {scanResult.excludedItems && scanResult.excludedItems.length > 0 && (
                  <div className="rounded-lg p-2.5 mb-3 text-[11px]" style={{ background: "#201B15", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div className="text-white/50">{t("scanNonFoodExcluded")(scanResult.excludedItems.length)}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {scanResult.excludedItems.map((nf, i) => (
                        <button
                          key={i}
                          onClick={() => restoreExcludedItem(i)}
                          className="text-[10px] px-2 py-1 rounded-full text-white/50 hover:text-white flex items-center gap-1"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                          title={nf.excludeReason === "deposit" ? t("scanRestoreDeposit") : t("scanRestoreNonFood")}
                        >
                          {nf.name} <Plus size={10} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.items.length === 0 ? (
                  // Cas très fréquent d'abandon : le document a bien été analysé mais rien n'en est
                  // ressorti. Avant, une seule phrase grise, aucun bouton — l'utilisateur devait
                  // deviner qu'il pouvait réessayer. Désormais : explication + conseils concrets +
                  // les mêmes boutons que l'écran d'erreur (renvoyer la photo, autre fichier, nous
                  // écrire), pour qu'il ne reste jamais dans une impasse.
                  <div className="py-2">
                    <div className="text-white/60 text-sm leading-relaxed mb-3">{t("scanNoItems")}</div>
                    <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-white/50 text-[11px] uppercase tracking-wide font-display mb-1.5">{t("scanErrWhatToDo")}</div>
                      <ul className="text-white/70 text-xs leading-relaxed space-y-1">
                        {t("scanNoItemsTips").map((tip, i) => (
                          <li key={i} className="flex gap-2">
                            <span style={{ color: BRAND_SOLID }}>•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={retryLastScan}
                        className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                      >
                        <RefreshCw size={14} /> {lastScanImage ? t("scanRetrySamePhoto") : t("scanRetry")}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputLibraryRef.current?.click()}
                          className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
                        >
                          {t("scanRetryOtherFile")}
                        </button>
                        <button
                          onClick={() => reportScanProblem("no_items")}
                          className="flex-1 text-[11px] uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70 hover:border-[#C9793B] hover:text-[#C9793B]"
                        >
                          {t("scanReportProblem")}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const withIdx = scanResult.items.map((item, idx) => ({ item, idx }));
                    const pending = withIdx.filter(({ item }) => !item.imported && !item.skipped);
                    const done = withIdx.filter(({ item }) => item.imported);
                    const skipped = withIdx.filter(({ item }) => item.skipped && !item.imported);
                    const review = pending.filter(({ item }) => !isReadyToImport(item));
                    const safe = pending.filter(({ item }) => isReadyToImport(item));
                    const renderCard = ({ item, idx }) => (
                      <ScanItemCard
                        key={idx}
                        item={item}
                        onUpdate={(patch) => updateScanItem(idx, patch)}
                        onImport={() => importScanItem(idx)}
                        onSkip={() => skipScanItem(idx)}
                        ingredients={ingredients}
                        ingredientDisplayName={ingredientDisplayName}
                        lang={lang}
                        t={t}
                        skipMuted
                      />
                    );

                    // ---- Mode pile : un produit à vérifier à la fois ----
                    if (reviewStackOpen) {
                      if (review.length === 0) {
                        return (
                          <div className="text-center py-10">
                            <div className="text-white text-base font-semibold mb-1">{t("scanAllReviewed")}</div>
                            <div className="text-white/50 text-xs mb-4">{t("scanAllReviewedDetail")}</div>
                            <button
                              onClick={() => setReviewStackOpen(false)}
                              className="text-xs uppercase tracking-wide px-4 py-2 rounded-full font-semibold"
                              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                            >
                              {t("scanContinue")}
                            </button>
                          </div>
                        );
                      }
                      const current = review[0];
                      const upcoming = review.slice(1, 4);
                      const isExpanded = expandedReviewIdx === current.idx;
                      const matchedIng = current.item.assignTo !== "new" ? ingredientById(current.item.assignTo) : null;
                      const guessedIng = current.item.guessedMatchId ? ingredientById(current.item.guessedMatchId) : null;
                      const needsRename = current.item.assignTo !== "new" && current.item.name && matchedIng && ingredientDisplayName(matchedIng) !== current.item.name;
                      return (
                        <div>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span className="text-sm text-white font-bold font-mono shrink-0">
                                {t("scanStackProgress")(stackTotal - review.length + 1, stackTotal)}
                              </span>
                              <div className="flex items-center gap-3 shrink-0">
                                <button onClick={skipAllPendingAndClose} className="text-[11px] text-white/40 hover:text-[#B23A2E] underline whitespace-nowrap">
                                  {t("scanSkipAllAndClose")}
                                </button>
                                <button onClick={() => setReviewStackOpen(false)} className="text-[11px] text-white/40 underline">
                                  {t("close")}
                                </button>
                              </div>
                            </div>
                            {/* Barre de progression bien visible — avant ce correctif, seul un
                                petit "1/16" discret indiquait où on en était, repéré comme pas
                                assez visible par l'utilisateur (2026-08). */}
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${((stackTotal - review.length) / stackTotal) * 100}%`, background: BRAND_GRADIENT }}
                              />
                            </div>
                          </div>

                          {/* Effet de pile de cartes plus marqué (demande explicite de l'utilisateur,
                              2026-08 : "j'imagine les cartes suivantes en arrière-plan de manière
                              jolie") — jusqu'à 3 cartes visibles derrière au lieu de 2, décalage et
                              ombre plus prononcés pour bien donner l'impression d'une pile. */}
                          <div className="relative" style={{ minHeight: isExpanded ? "auto" : "230px" }}>
                            {!isExpanded &&
                              upcoming.map(({ item: uItem }, i) => (
                                <div
                                  key={i}
                                  className="absolute inset-x-0 rounded-2xl border border-white/10 px-4 py-3 pointer-events-none"
                                  style={{
                                    background: "#201B15",
                                    top: `${(i + 1) * 14}px`,
                                    transform: `scale(${1 - (i + 1) * 0.045})`,
                                    opacity: 0.6 - i * 0.18,
                                    zIndex: 10 - i,
                                    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
                                  }}
                                >
                                  <div className="text-white/60 text-sm truncate">{uItem.name}</div>
                                </div>
                              ))}

                            <div className="relative" style={{ zIndex: 20 }}>
                              {isExpanded ? (
                                <div>
                                  <button
                                    onClick={() => setExpandedReviewIdx(null)}
                                    className="w-full mb-2 text-xs uppercase tracking-wide py-2.5 rounded-full border border-white/25 text-white/80 font-semibold"
                                  >
                                    {t("scanBackToCard")}
                                  </button>
                                  <ScanItemCard
                                    item={current.item}
                                    onUpdate={(patch) => updateScanItem(current.idx, patch)}
                                    onImport={() => importScanItem(current.idx)}
                                    ingredients={ingredients}
                                    ingredientDisplayName={ingredientDisplayName}
                                    lang={lang}
                                    t={t}
                                    startExpanded
                                  />
                                </div>
                              ) : (
                                <div
                                  className="rounded-xl border p-4"
                                  style={{ background: "#16130F", borderColor: `${TIER_COLORS.mid}80` }}
                                >
                                  {/* Avant ce correctif, tout ce qui n'était pas "nouveau" affichait le
                                      même badge orange "à vérifier" — un rapprochement pourtant confiant
                                      (score quasi parfait) et un rapprochement douteux (cas réel :
                                      "haricot" confondu avec "abricot") se ressemblaient à l'écran,
                                      alors que ce sont deux niveaux de confiance très différents.
                                      Distinction demandée explicitement par l'utilisateur, 2026-08. */}
                                  <span
                                    className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold"
                                    style={{
                                      color: current.item.assignTo === "new" ? "#3B82F6" : current.item.matchConfident ? TIER_COLORS.high : TIER_COLORS.mid,
                                      background: current.item.assignTo === "new" ? "#3B82F622" : current.item.matchConfident ? `${TIER_COLORS.high}22` : `${TIER_COLORS.mid}22`,
                                    }}
                                  >
                                    {current.item.assignTo === "new" ? (
                                      <Plus size={10} />
                                    ) : current.item.matchConfident ? (
                                      <Check size={10} />
                                    ) : (
                                      <AlertTriangle size={10} />
                                    )}
                                    {current.item.assignTo === "new"
                                      ? t("scanNewIngredient")
                                      : current.item.matchConfident
                                      ? t("scanLinkedSure")
                                      : t("scanLinkedGuess")}
                                  </span>

                                  {/* Texte facture visible dès le premier coup d'œil (pas besoin d'ouvrir
                                      "Modifier"), débarrassé seulement du code fournisseur. Modifiable pour
                                      corriger une erreur de lecture — ça n'affecte jamais le nom d'ingrédient
                                      ni le matching, uniquement la mémoire des rapprochements pour ce texte. */}
                                  <div className="flex items-center gap-1 mt-1.5 min-w-0">
                                    <span className="text-[9px] uppercase tracking-wide text-white/25 shrink-0">{t("scanRawLabelPrefix")}</span>
                                    <input
                                      value={lightRawLabel(current.item.rawLabel)}
                                      onChange={(e) => updateScanItem(current.idx, { rawLabel: e.target.value })}
                                      className="flex-1 min-w-0 bg-transparent text-white/45 text-[11px] outline-none focus:text-white/80"
                                    />
                                  </div>

                                  {/* Nom toujours modifiable ici, bien visible — avant ce correctif,
                                      dès qu'un rapprochement existait, seul le choix "garder/renommer/
                                      créer séparément" était affiché, sans moyen évident de corriger le
                                      texte lui-même si l'IA s'est trompée (cas réel utilisateur :
                                      "Orange à jus" proposé au lieu de "Orange dessert" — pas trouvé
                                      "instinctivement" comment corriger). Éditer ce champ met aussi à
                                      jour en direct les options "renommer"/"créer séparément" juste en
                                      dessous, qui affichent toujours ce même nom. */}
                                  <div className="flex items-center gap-1.5 mt-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                                    <Pencil size={13} className="text-white/30 shrink-0" />
                                    <input
                                      value={current.item.name || ""}
                                      onChange={(e) => updateScanItem(current.idx, { name: e.target.value })}
                                      className="flex-1 min-w-0 bg-transparent text-white text-base font-semibold outline-none"
                                    />
                                  </div>

                                  {guessedIng && (
                                    <div className="mt-2">
                                      <ScanNameChoice
                                        item={current.item}
                                        guessedIng={guessedIng}
                                        ingredientDisplayName={ingredientDisplayName}
                                        onUpdate={(patch) => updateScanItem(current.idx, patch)}
                                        t={t}
                                      />
                                    </div>
                                  )}

                                  {/* Variation de prix par rapport au dernier prix connu — absente de
                                      cette carte avant ce correctif (visible seulement dans la liste
                                      groupée), demandée explicitement par l'utilisateur (2026-08).
                                      Affichée sur CHAQUE ligne ayant un prix de référence, même à 0%
                                      (pas seulement les vraies variations) : sinon l'absence de badge
                                      donne l'impression fausse qu'une ligne n'a pas été comparée du
                                      tout — même correctif que la carte compacte, même demande. */}
                                  {/* priceComparisonValid (2026-08-25) : voir ScanItemCard, même
                                      garde-fou contre une comparaison entre deux unités différentes. */}
                                  {current.item.currentPrice !== null && current.item.currentPriceIsReal && current.item.priceComparisonValid !== false && (
                                    <div
                                      className="flex items-center gap-1 text-[11px] font-bold mt-1.5"
                                      style={{ color: priceChangeVisual(current.item).color }}
                                    >
                                      {priceChangeVisual(current.item).up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                      {Math.round((Math.abs((current.item.unitPriceHT || 0) - current.item.currentPrice) / current.item.currentPrice) * 100)}%
                                      <span className="text-white/35 font-normal">
                                        ({current.item.currentPrice.toFixed(2)}€ → {(current.item.unitPriceHT || 0).toFixed(2)}€)
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 mt-2 rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                                    <NumField
                                      value={current.item.unitPriceHT || 0}
                                      onChange={(v) => updateScanItem(current.idx, { unitPriceHT: v })}
                                      className="flex-1 min-w-0 bg-transparent text-white text-base font-semibold text-right outline-none border-b border-white/15 focus:border-[#C9793B]"
                                    />
                                    <span className="text-white/50 text-sm shrink-0">€/{unitDisplayLabel(current.item.unit, t)}</span>
                                    <button
                                      onClick={() => setExpandedReviewIdx(current.idx)}
                                      className="shrink-0 flex items-center gap-1 px-3 h-10 rounded-lg text-xs text-white/70 font-semibold active:scale-95 transition-transform"
                                      style={{ background: "rgba(255,255,255,0.08)" }}
                                      title={t("scanModify")}
                                    >
                                      <Pencil size={14} /> {t("scanModify")}
                                    </button>
                                  </div>

                                  {current.item.pricingUnknown && (
                                    <div className="mt-3">
                                      <PricingCalculator item={current.item} onUpdate={(patch) => updateScanItem(current.idx, patch)} t={t} />
                                    </div>
                                  )}

                                  {current.item.priceInconsistent && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                                      <AlertTriangle size={11} className="shrink-0" /> {t("scanPriceInconsistent")}
                                    </div>
                                  )}

                                  {current.item.lowConfidence && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                                      <AlertTriangle size={11} className="shrink-0" /> {t("scanLowConfidence")}
                                    </div>
                                  )}

                                  {current.item.unitChangeAffectsRecipes && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                                      <AlertTriangle size={11} className="shrink-0" /> {t("scanUnitChangeWarning")(current.item.previousUnit, current.item.unit)}
                                    </div>
                                  )}

                                  {/* Ton neutre volontaire (pas d'orange d'alerte) : un gros écart de
                                      prix n'est pas une erreur détectée, juste un écart qui mérite un
                                      coup d'œil — voir la même note dans ScanItemCard. */}
                                  {current.item.bigChange && !current.item.priceInconsistent && !current.item.lowConfidence && (
                                    <div className="flex items-center gap-1.5 text-[11px] rounded px-2 py-1.5 mt-3 text-white/55" style={{ background: "rgba(255,255,255,0.06)" }}>
                                      <Info size={11} className="shrink-0" /> {t("scanBigChangeNote")}
                                    </div>
                                  )}

                                  <div className="mt-3 text-[11px] text-white/45 italic border-t border-white/5 pt-2">
                                    {current.item.assignTo === "new"
                                      ? t("scanSummaryNew")(current.item.name || "?", (current.item.unitPriceHT || 0).toFixed(2), current.item.unit)
                                      : t("scanSummaryUpdate")(
                                          needsRename && current.item.renameOnImport ? current.item.name : ingredientDisplayName(matchedIng),
                                          (current.item.unitPriceHT || 0).toFixed(2),
                                          current.item.unit
                                        )}
                                  </div>

                                  {/* Boutons agrandis (cible tactile testée sur téléphone), demande
                                      explicite de l'utilisateur, 2026-08. */}
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => skipScanItem(current.idx)}
                                      className="flex-1 text-xs uppercase tracking-wide py-3.5 rounded-full font-bold border-2 active:scale-95 transition-transform"
                                      style={{ borderColor: "rgba(239,68,68,0.5)", color: "#EF4444" }}
                                    >
                                      {t("scanSkip")}
                                    </button>
                                    <button
                                      onClick={() => updateScanItem(current.idx, { reviewed: true })}
                                      className="flex-1 text-xs uppercase tracking-wide py-3.5 rounded-full font-bold active:scale-95 transition-transform"
                                      style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                                    >
                                      {t("scanValidate")}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ---- Mode normal : bouton d'entrée dans la pile + liste des lignes sûres ----
                    return (
                      <div className="space-y-4">
                        {review.length > 0 && (
                          <button
                            onClick={() => {
                              setReviewStackOpen(true);
                              setStackTotal(review.length);
                              setExpandedReviewIdx(null);
                            }}
                            className="w-full rounded-xl p-4 text-left flex items-center justify-between gap-2"
                            style={{ background: `${TIER_COLORS.mid}18`, border: `1px solid ${TIER_COLORS.mid}50` }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <AlertTriangle size={16} color={TIER_COLORS.mid} className="shrink-0" />
                              <span className="text-sm font-semibold truncate" style={{ color: TIER_COLORS.mid }}>
                                {t("scanItemsToReview")(review.length)}
                              </span>
                            </div>
                            <span className="text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full font-semibold shrink-0" style={{ background: TIER_COLORS.mid, color: "#000" }}>
                              {t("scanVerifyOneByOne")}
                            </span>
                          </button>
                        )}
                        {safe.length > 0 && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest mb-1 flex items-center gap-1.5 font-semibold" style={{ color: "#10B981" }}>
                              <Check size={12} /> {t("scanSafeSection")} ({safe.length})
                            </div>
                            <div className="text-[11px] text-white/40 mb-2">{t("scanSafeHint")}</div>
                            <div className="space-y-2">{safe.map(renderCard)}</div>
                          </div>
                        )}
                        {skipped.length > 0 && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest mb-2 text-white/30 font-semibold">
                              {t("scanSkippedSection")} ({skipped.length})
                            </div>
                            <div className="space-y-1">
                              {skipped.map(({ item, idx }) => (
                                <div key={idx} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 opacity-50" style={{ background: "#16130F" }}>
                                  <span className="text-white/60 text-xs truncate">{item.name}</span>
                                  <button onClick={() => unskipScanItem(idx)} className="text-[10px] text-white/40 hover:text-[#C9793B] underline shrink-0">
                                    {t("scanUndoSkip")}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {done.length > 0 && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest mb-2 flex items-center gap-1.5 font-semibold text-white/40">
                              <Check size={12} /> {t("scanDoneSection")} ({done.length})
                            </div>
                            <div className="space-y-2">{done.map(renderCard)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}

                {scanResult.items.length > 0 && !reviewStackOpen && (
                  <button
                    onClick={importAllScanItems}
                    className="mt-4 w-full text-xs font-display uppercase tracking-wide py-2 rounded"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    {t("scanImportAll")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {allergenSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={() => setAllergenSheetOpen(false)}>
          <div
            className="rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto font-body border border-white/10"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-white uppercase tracking-wide text-sm">{t("allergenSheetTitle")}</h3>
              <button onClick={() => setAllergenSheetOpen(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="allergen-sheet rounded-sm p-5" style={{ background: "#F3EBDA", color: "#2B2620" }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Logo size={16} />
                <span className="font-display uppercase tracking-widest text-[10px]" style={{ color: BRAND_SOLID_PAPER }}>{t("appTitle")}</span>
              </div>
              <h1 className="font-display text-lg uppercase tracking-wide mb-0.5">{t("allergenSheetTitle")}</h1>
              <p className="text-xs opacity-50 mb-4">{today()}</p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(43,38,32,0.15)" }}>
                <div
                  className="grid grid-cols-[1fr_1.3fr] text-[9px] uppercase tracking-wide font-bold px-3 py-2"
                  style={{ background: "rgba(43,38,32,0.08)" }}
                >
                  <span>{t("recipeCol")}</span>
                  <span>{t("allergens")}</span>
                </div>
                {recipes.map((r, i) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_1.3fr] gap-2 px-3 py-2 text-sm"
                    style={{ background: i % 2 ? "rgba(43,38,32,0.035)" : "transparent", borderTop: "1px solid rgba(43,38,32,0.1)" }}
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="opacity-70 text-xs">{r.allergens || t("allergenSheetNone")}</span>
                  </div>
                ))}
                {recipes.length === 0 && <div className="text-sm text-center py-6 opacity-40">{t("noRecipeYet")}</div>}
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full mt-5 text-xs font-display uppercase tracking-wide py-2.5 rounded-full font-semibold flex items-center justify-center gap-1.5"
              style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
            >
              <Printer size={13} /> {t("print")}
            </button>
          </div>
        </div>
      )}

      {addWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 print:hidden" onClick={closeAddWizard}>
          <div
            className="rounded-2xl p-5 w-full max-w-sm font-body border border-white/10 overflow-hidden"
            style={{ background: "#201B15" }}
            onClick={(e) => e.stopPropagation()}
          >
            {wizardStep !== "success" && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(wizardEditId ? 2 : 3)].map((_, idx) => {
                    const s = idx + 1;
                    return (
                      <span
                        key={s}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: s <= wizardStep ? BRAND_SOLID : "rgba(255,255,255,0.15)" }}
                      />
                    );
                  })}
                </div>
                <button onClick={closeAddWizard} className="text-white/50 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            )}

            {wizardStep === 1 && (
              <div key="step1" style={{ animation: "wizardStepIn 0.25s ease" }}>
                <h3 className="font-display text-white uppercase tracking-wide text-sm mb-3">{t("wizardStep1Title")}</h3>
                <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 border border-white/10 mb-2" style={{ background: "#16130F" }}>
                  <Search size={13} className="text-white/40 shrink-0" />
                  <input
                    autoFocus
                    value={wizardQuery}
                    onChange={(e) => setWizardQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="w-full bg-transparent text-white text-sm outline-none min-w-0"
                    onKeyDown={(e) => { if (e.key === "Enter" && wizardQuery.trim()) pickWizardCustom(wizardQuery.trim()); }}
                  />
                </div>
                {!wizardQuery.trim() && (
                  <p className="text-white/30 text-xs px-1 py-3">{t("wizardSearchHint")}</p>
                )}
                {wizardQuery.trim() && (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10" style={{ background: "#16130F" }}>
                    {wizardExistingSuggestions.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#C9793B]/80">{t("wizardExistingSection")}</div>
                        {wizardExistingSuggestions.map((ing) => {
                          const sup = activeSupplier(ing);
                          return (
                            <button
                              key={ing.id}
                              onClick={() => pickWizardExisting(ing)}
                              className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center justify-between border-b border-white/5 last:border-0"
                            >
                              <span className="truncate">{ingredientDisplayName(ing)}</span>
                              <span className="text-[10px] text-white/40 shrink-0 ml-2">{(sup?.price || 0).toFixed(2)}€ / {unitDisplayLabel(ing.unit, t)}</span>
                            </button>
                          );
                        })}
                      </>
                    )}
                    {wizardCatalogSuggestions.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-white/30 border-t border-white/5">{t("wizardCatalogSection")}</div>
                        {wizardCatalogSuggestions.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => pickWizardCatalog(c)}
                            className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center justify-between border-b border-white/5 last:border-0"
                          >
                            <span>{c[lang]}</span>
                            <span className="text-[10px] text-white/30">{normUnit(c.unit)}</span>
                          </button>
                        ))}
                      </>
                    )}
                    <button
                      onClick={() => pickWizardCustom(wizardQuery.trim())}
                      className="w-full text-left px-3 py-2.5 text-xs text-[#C9793B] hover:bg-white/10 border-t border-white/10"
                    >
                      {t("createCustom")(wizardQuery.trim())}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Catégorie AVANT le prix (et seulement quand elle n'est pas déjà connue via le
                catalogue ou un ingrédient existant) : deviner la catégorie à partir du nom seul
                a été jugé trop fragile ("filet" = viande, poisson ou volaille selon le cas) —
                mieux vaut la demander explicitement une fois, plutôt que de deviner mal. */}
            {wizardStep === 2 && !wizardEditId && (
              <div key="step2" style={{ animation: "wizardStepIn 0.25s ease" }}>
                <h3 className="font-display text-white uppercase tracking-wide text-sm mb-3">{t("wizardCategoryStepTitle")}</h3>
                <div className="grid grid-cols-2 gap-2 mb-4 max-h-56 overflow-y-auto">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setWizardData((d) => ({ ...d, category: c.id }))}
                      className="rounded-xl py-3 px-2 text-xs font-semibold border-2 transition"
                      style={{
                        borderColor: wizardData.category === c.id ? BRAND_SOLID : "rgba(255,255,255,0.12)",
                        background: wizardData.category === c.id ? `${BRAND_SOLID}22` : "#16130F",
                        color: wizardData.category === c.id ? BRAND_SOLID : "rgba(255,255,255,0.6)",
                      }}
                    >
                      {c[lang]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWizardStep(1)} className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70">
                    {t("wizardBack")}
                  </button>
                  <button onClick={() => setWizardStep(3)} className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full font-semibold" style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}>
                    {t("wizardNext")}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div key="step3" style={{ animation: "wizardStepIn 0.25s ease" }}>
                <h3 className="font-display text-white uppercase tracking-wide text-sm mb-1">{t("wizardPriceStepTitle")}</h3>
                <p className="text-white/40 text-xs mb-4 truncate">{wizardData.name}</p>
                <div className="flex items-center gap-2 rounded-xl px-3 py-3 border border-white/10 mb-1.5" style={{ background: "#16130F" }}>
                  <NumField
                    value={wizardData.price}
                    onChange={(v) => setWizardData((d) => ({ ...d, price: v, isEstimate: false }))}
                    className="flex-1 min-w-0 bg-transparent text-white text-xl font-bold text-center outline-none"
                  />
                  <span className="text-white/40 text-sm shrink-0">€ / {unitDisplayLabel(wizardData.unit, t)}</span>
                </div>
                {/* Pour tester une recette sans être bloqué par un prix qu'on n'a pas sous les
                    yeux — remplit un prix placeholder clairement marqué "estimé" (même badge
                    que priceSource "estimate" ailleurs dans l'app), à corriger plus tard. */}
                <button
                  type="button"
                  onClick={() => setWizardData((d) => ({ ...d, price: CATEGORY_ESTIMATE_PRICE[d.category] || 5, isEstimate: true }))}
                  className="w-full text-left text-[11px] mb-4 flex items-center gap-1.5"
                  style={{ color: TIER_COLORS.mid }}
                >
                  <AlertTriangle size={11} className="shrink-0" /> {t("wizardEstimatePrice")}
                </button>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {["kg", "L", "pièce"].map((u) => (
                    <button
                      key={u}
                      onClick={() => setWizardData((d) => ({ ...d, unit: u }))}
                      className="rounded-xl py-3 text-sm font-bold border-2 transition"
                      style={{
                        borderColor: wizardData.unit === u ? BRAND_SOLID : "rgba(255,255,255,0.12)",
                        background: wizardData.unit === u ? `${BRAND_SOLID}22` : "#16130F",
                        color: wizardData.unit === u ? BRAND_SOLID : "rgba(255,255,255,0.6)",
                      }}
                    >
                      {unitDisplayLabel(u, t)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWizardStep(!wizardEditId && !wizardData.catalogId ? 2 : 1)}
                    className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full border border-white/20 text-white/70"
                  >
                    {t("wizardBack")}
                  </button>
                  <button
                    onClick={() => (wizardEditId ? finalizeEditWizard() : finalizeWizard())}
                    className="flex-1 text-xs uppercase tracking-wide py-2.5 rounded-full font-semibold"
                    style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                  >
                    {wizardEditId ? t("wizardSave") : t("wizardCreate")}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === "success" && (
              <div key="success" className="flex flex-col items-center py-6" style={{ animation: "wizardStepIn 0.3s ease" }}>
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                  style={{ background: BRAND_GRADIENT, animation: "successPop 0.4s ease" }}
                >
                  <Check size={30} color="#fff" />
                </div>
                <div className="text-white text-sm font-semibold truncate max-w-full">{wizardData.name}</div>
                <div className="text-white/40 text-xs mt-1">{wizardEditId ? t("wizardUpdated") : t("wizardSuccess")}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-5 w-full pb-28">
        {/* ---------------- ONGLET RECETTES ---------------- */}
        {activeTab === "recipes" && recipeSubView === "list" && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Logo size={18} />
              <span className="font-display text-white/50 text-[11px] uppercase tracking-widest">{t("appTitle")}</span>
            </div>
            <h1 className="font-display text-white text-2xl mb-1">{t("greeting")}</h1>
            {/* [2026-08-29] Repère chiffré sous le titre, demandé par l'utilisateur pour renforcer
                la hiérarchie visuelle de l'écran d'accueil (jugé trop plat) — un coup d'œil sur
                l'état général avant même de scroller vers la liste. N'affiche rien tant qu'aucune
                marge n'est calculable (pas de division par zéro sur un garde-manger vide). */}
            {recipes.length > 0 && (() => {
              const margins = recipes.map((r) => recipeMargin(r)).filter((m) => m !== null);
              const avgMargin = margins.length ? Math.round(margins.reduce((s, m) => s + m, 0) / margins.length) : null;
              const avgTier = avgMargin !== null ? marginTier(avgMargin, settings.minMargin) : null;
              return (
                <div className="flex items-center gap-1.5 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: avgTier ? TIER_COLORS[avgTier] : "rgba(255,255,255,0.3)" }} />
                  <span className="text-white/45 text-xs">
                    {recipes.length} {recipes.length > 1 ? t("recipes").toLowerCase() : t("recipes").toLowerCase().replace(/s$/, "")}
                    {avgMargin !== null && (
                      <> · {t("avgMarginLabel")} <span className="font-semibold" style={{ color: TIER_COLORS[avgTier] }}>{avgMargin}%</span></>
                    )}
                  </span>
                </div>
              );
            })()}

            {/* Bandeau "Installer l'app" (2026-08-23) : visible dès l'écran d'accueil, pas juste
                enfoui dans "Mon compte" — demandé explicitement par l'utilisateur, qui trouvait
                l'ancien emplacement pas assez visible. Discret et ignorable (juste une croix). */}
            {!isStandaloneApp && !installBannerDismissed && (
              <div className="flex items-center gap-2.5 mb-4 rounded-xl pl-3 pr-2 py-2.5 border border-white/10" style={{ background: "#201B15" }}>
                <div className="relative shrink-0">
                  <Smartphone size={16} className="text-[#C9793B]" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping" style={{ background: "#E0A050" }} />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "#E0A050" }} />
                </div>
                <span className="text-white/70 text-xs flex-1 leading-snug">{t("installBannerText")}</span>
                <button
                  onClick={handleInstallClick}
                  className="text-[11px] font-display uppercase tracking-wide px-3 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff" }}
                >
                  {t("installAppButton")}
                </button>
                <button onClick={dismissInstallBanner} className="text-white/30 hover:text-white/60 shrink-0 p-1" title={t("close")}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Message d'accueil orienté action, distinct du rappel plus tardif dans l'onglet
                garde-manger (celui-ci parle de "prix estimé", un terme que le tout premier
                utilisateur ne connaît pas encore) — demandé explicitement par l'utilisateur : la
                toute première chose vue doit dire quoi faire, pas juste constater un état. */}
            {ingredients.length > 0 && ingredients.every((i) => activeSupplier(i)?.priceSource === "estimate") && (
              <div className="rounded-2xl p-4 mb-5 border border-white/10" style={{ background: "#201B15" }}>
                <p className="text-white/70 text-sm leading-relaxed mb-3">{t("welcomeBannerText")}</p>
                <button
                  onClick={() => setActiveTab("scanner")}
                  className="w-full text-xs font-display uppercase tracking-wide py-2.5 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  <Camera size={14} /> {t("welcomeBannerButton")}
                </button>
              </div>
            )}

            {/* Bandeau "carte digitale" (2026-08-28) : voir menuBannerDismissed plus haut pour le
                raisonnement complet. Design cohérent avec le bandeau d'installation (icône + point
                cyan animé + croix), mais couleur cyan plutôt que violet pour rester visuellement
                distinct du bandeau au-dessus quand les deux sont visibles en même temps. */}
            {!menuSettings.published && !menuBannerDismissed && (
              <div className="flex items-center gap-2.5 mb-5 rounded-xl pl-3 pr-2 py-2.5 border border-white/10" style={{ background: "#201B15" }}>
                <div className="relative shrink-0">
                  <QrCode size={16} className="text-[#E0A050]" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping" style={{ background: "#E0A050" }} />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "#E0A050" }} />
                </div>
                <span className="text-white/70 text-xs flex-1 leading-snug">{t("menuBannerText")}</span>
                <button
                  onClick={() => setActiveTab("menu")}
                  className="text-[11px] font-display uppercase tracking-wide px-3 py-1.5 rounded-full shrink-0 active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff" }}
                >
                  {t("menuBannerButton")}
                </button>
                <button onClick={dismissMenuBanner} className="text-white/30 hover:text-white/60 shrink-0 p-1" title={t("close")}>
                  <X size={14} />
                </button>
              </div>
            )}

            <input
              ref={fileInputRecipeLibraryRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleScanRecipeFile}
            />
            <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
              <h2 className="font-display text-white/90 uppercase text-sm tracking-widest">{t("recipes")}</h2>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="flex items-center rounded-full border border-white/15 overflow-hidden shrink-0">
                  <button
                    onClick={() => { setRecipeListLayout("list"); try { localStorage.setItem("chefup:recipeListLayout", "list"); } catch {} }}
                    title={t("recipeListViewTooltip")}
                    className="p-1.5 transition-colors"
                    style={recipeListLayout === "list" ? { background: BRAND_GRADIENT, color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}
                  >
                    <List size={13} />
                  </button>
                  <button
                    onClick={() => { setRecipeListLayout("grid"); try { localStorage.setItem("chefup:recipeListLayout", "grid"); } catch {} }}
                    title={t("recipeGridViewTooltip")}
                    className="p-1.5 transition-colors"
                    style={recipeListLayout === "grid" ? { background: BRAND_GRADIENT, color: "#fff" } : { color: "rgba(255,255,255,0.5)" }}
                  >
                    <LayoutGrid size={13} />
                  </button>
                </div>
                <button
                  onClick={() => setAllergenSheetOpen(true)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/60 hover:text-white px-3 py-1.5 rounded-full border border-white/15 hover:border-white/30 transition-colors"
                >
                  <ShieldCheck size={12} />
                  {t("allergenSheetLink")}
                </button>
                <button
                  onClick={() => setActiveTab("menu")}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/60 hover:text-white px-3 py-1.5 rounded-full border border-white/15 hover:border-white/30 transition-colors"
                >
                  <QrCode size={12} />
                  {t("digitalMenuButton")}
                </button>
                <button
                  onClick={addRecipe}
                  className="flex items-center gap-1 text-xs font-display uppercase tracking-wide px-3 py-1.5 rounded-full active:scale-95 transition-transform"
                  style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                >
                  <Plus size={14} /> {t("newRecipe")}
                </button>
              </div>
            </div>

            {recipes.length === 0 ? (
              <div className="text-white/40 text-sm text-center py-16 font-body">{t("noRecipeYet")}</div>
            ) : recipeListLayout === "grid" ? (
              <div className="grid grid-cols-3 gap-2">
                {recipes.map((r) => {
                  const m = recipeMargin(r);
                  const rt = marginTier(m, r.targetMargin ?? settings.minMargin);
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setActiveId(r.id); setRecipeSubView("detail"); setLossModalOpen(false); }}
                      className="relative aspect-square rounded-2xl p-2 flex flex-col items-center justify-center gap-1.5 text-center font-body transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg border border-white/10 active:scale-95"
                      style={{ background: "#201B15" }}
                    >
                      {topRecipeIds.includes(r.id) && (
                        <span
                          className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                          style={{ color: TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)], background: `${TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)]}22` }}
                        >
                          <Award size={10} />
                        </span>
                      )}
                      {recipeHasUnitMismatch(r) && (
                        <span
                          className="absolute top-1.5 left-1.5 flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                          style={{ color: TIER_COLORS.mid, background: `${TIER_COLORS.mid}22` }}
                          title={t("recipeUnitMismatchHint")}
                        >
                          <AlertTriangle size={10} />
                        </span>
                      )}
                      <div className="text-white font-medium text-[11px] leading-tight line-clamp-2 px-0.5">{r.name}</div>
                      {m !== null ? (
                        <span
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: TIER_COLORS[rt], background: `${TIER_COLORS[rt]}22` }}
                        >
                          {Math.round(m)}%
                        </span>
                      ) : (
                        <span className="text-white/20 text-[11px]">—</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {recipes.map((r) => {
                  const cpp = recipeCostPerPortion(r);
                  const m = recipeMargin(r);
                  const rt = marginTier(m, r.targetMargin ?? settings.minMargin);
                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl px-4 py-3.5 flex items-center gap-2 font-body transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg border border-white/10"
                      style={{ background: "#201B15", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.22)" }}
                    >
                      <button
                        onClick={() => { setActiveId(r.id); setRecipeSubView("detail"); setLossModalOpen(false); }}
                        className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left active:scale-95 transition-transform"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="text-white font-medium text-sm truncate">{r.name}</div>
                            {topRecipeIds.includes(r.id) && (
                              <span
                                className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                style={{
                                  color: TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)],
                                  background: `${TOP_BADGE_COLORS[topRecipeIds.indexOf(r.id)]}22`,
                                }}
                              >
                                <Award size={9} /> TOP{topRecipeIds.indexOf(r.id) + 1}
                              </span>
                            )}
                            {recipeHasUnitMismatch(r) && (
                              <AlertTriangle size={12} className="shrink-0" style={{ color: TIER_COLORS.mid }} title={t("recipeUnitMismatchHint")} />
                            )}
                          </div>
                          {/* [2026-08-29] Étiquette de section (si renseignée pour la carte digitale)
                              affichée aussi ici — sert de repère de catégorie dans la liste, sans
                              rien inventer : n'apparaît que si r.menuCategory est déjà réglé. */}
                          {r.menuCategory && MENU_CATEGORY_LABELS[r.menuCategory] && (
                            <div className="text-white/35 text-[10px] mt-0.5">
                              {MENU_CATEGORY_LABELS[r.menuCategory][lang] || MENU_CATEGORY_LABELS[r.menuCategory].fr}
                            </div>
                          )}
                          <div className="text-white/40 text-[11px] font-mono mt-1">
                            {cpp.toFixed(2)}€ &rarr; {(r.sellPrice || 0).toFixed(2)}€
                          </div>
                        </div>
                        {m !== null ? (
                          <span
                            className="shrink-0 flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full"
                            style={{ color: TIER_COLORS[rt], background: `${TIER_COLORS[rt]}22` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: TIER_COLORS[rt] }} />
                            {Math.round(m)}%
                          </span>
                        ) : (
                          <span className="shrink-0 text-white/20 text-xs">—</span>
                        )}
                      </button>
                      <button
                        onClick={() => confirmDeleteRecipe(r.id, r.name)}
                        className="shrink-0 p-2 text-white/25 hover:text-[#EF4444]"
                        title={t("deleteLabel")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "recipes" && recipeSubView === "detail" && !active && (
          <div className="text-white/40 text-sm text-center py-16 font-body">{t("noRecipeYet")}</div>
        )}

        {activeTab === "recipes" && recipeSubView === "detail" && active && (
          <div>
            <div className="flex items-center justify-between mb-4 print:hidden">
              <button
                onClick={() => setRecipeSubView("list")}
                className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-display uppercase tracking-wide"
              >
                <ArrowLeft size={14} /> {t("recipes")}
              </button>
              <div className="flex items-center gap-2.5">
                <button onClick={() => setLossModalOpen(true)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#C9793B] font-display uppercase tracking-wide">
                  <Percent size={13} /> {t("declareLossesButton")}
                </button>
                <button onClick={() => duplicateRecipe(active)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-[#C9793B] font-display uppercase tracking-wide">
                  <Copy size={13} /> {t("duplicate")}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setPrintMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white font-display uppercase tracking-wide"
                  >
                    <Printer size={13} /> {t("printMenuLabel")} <ChevronDown size={12} className={`transition-transform ${printMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {printMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-56 rounded-xl overflow-hidden shadow-xl border border-white/10 z-30"
                      style={{ background: "#201B15" }}
                    >
                      <button
                        onClick={() => { setPrintMenuOpen(false); handlePrint(); }}
                        className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-white/10 flex items-center gap-2"
                      >
                        <Printer size={13} className="shrink-0 text-white/40" /> {t("printTicket")}
                      </button>
                      <button
                        onClick={() => { setPrintMenuOpen(false); handlePrintRecipeSheet(); }}
                        className="w-full text-left px-3 py-2.5 text-xs text-white/80 hover:bg-white/10 flex items-center gap-2 border-t border-white/5"
                      >
                        <Printer size={13} className="shrink-0 text-[#3B82F6]" /> {t("printRecipeSheet")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* [2026-08-29] Panneau chiffres en un coup d'œil, demandé par l'utilisateur pour
                renforcer la hiérarchie visuelle de la fiche (jugée "pas assez travaillée") — les 3
                nombres qui comptent le plus (coût, prix, marge) avant même de dérouler les
                ingrédients, plutôt que noyés plus bas dans le bloc marge existant (conservé
                inchangé plus bas, avec sa légende/suggestion — ce panneau est un résumé, pas un
                remplacement). print:hidden : la fiche imprimée a déjà son propre bloc marge. */}
            {margin !== null && (
              <div className="print:hidden mb-4">
                {/* [WOW ONBOARDING, 2026-08-31] Halo temporaire (4s, voir finishFirstRunDemo) quand
                    la marge vient d'apparaître grâce à la démo de scan — sans lui, rien ne
                    distinguerait "j'ai rempli ça moi-même" de "un scan vient de le faire". */}
                {wowMoment && (
                  <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold animate-pulse" style={{ color: BRAND_SOLID }}>
                    <Sparkles size={12} /> {t("wowMomentHint")}
                  </div>
                )}
                <div
                  className="rounded-2xl p-4 flex items-center gap-4 border"
                  style={{
                    background: "#201B15",
                    borderColor: wowMoment ? BRAND_SOLID : "rgba(255,255,255,0.1)",
                    boxShadow: wowMoment
                      ? `0 0 0 3px ${BRAND_SOLID}40, inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.25)`
                      : "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.25)",
                    transition: "box-shadow 0.6s ease, border-color 0.6s ease",
                  }}
                >
                <div className="relative w-[72px] h-[72px] shrink-0">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                    <circle
                      cx="36" cy="36" r="30" fill="none" stroke={TIER_COLORS[tier]} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray="188.5"
                      strokeDashoffset={188.5 * (1 - Math.max(0, Math.min(100, margin)) / 100)}
                      transform="rotate(-90 36 36)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display font-black text-lg leading-none" style={{ color: TIER_COLORS[tier] }}>{Math.round(margin)}%</span>
                    <span className="text-[7px] uppercase tracking-wide text-white/30 mt-0.5">{t("marginLabel")}</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/45">{t("costPerPortion")}</span>
                    <span className="text-white font-semibold font-mono">{costPerPortion.toFixed(2)}€</span>
                  </div>
                  <div className="h-px bg-white/[0.07]" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/45">{t("sellPriceTTC")}</span>
                    <span className="text-white font-semibold font-mono">{(active.sellPrice || 0).toFixed(2)}€</span>
                  </div>
                  <div className="h-px bg-white/[0.07]" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/45">{t("portions")}</span>
                    <span className="text-white font-semibold font-mono">{active.portions}</span>
                  </div>
                </div>
                </div>
              </div>
            )}

            {/* Pleine largeur et police du corps de l'app à la place de `max-w-md` + `font-mono` :
                la chasse fixe et la colonne étroite étaient là pour imiter un ticket de caisse,
                elles ne faisaient que rendre la fiche moins lisible et plus longue à parcourir. */}
            <div className={`ticket px-4 sm:px-8 py-7 sm:py-9 w-full font-body text-[15px] ${hidePricesPrint ? "hide-prices" : ""}`}>
              <input
                ref={recipeNameInputRef}
                value={active.name}
                onChange={(e) => updateRecipe({ name: e.target.value })}
                className="w-full bg-transparent font-display text-2xl sm:text-3xl uppercase tracking-wide mb-2 outline-none text-center border-b border-black/10 pb-3"
              />
              <div className="flex justify-center mb-2">
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                  style={{ background: `${TIER_COLORS.mid}18`, border: `1.5px solid ${TIER_COLORS.mid}70` }}
                >
                  <span className="text-[11px] uppercase tracking-wide font-bold" style={{ color: TIER_COLORS.mid }}>{t("portions")}</span>
                  <NumField
                    allowDecimal={false}
                    value={active.portions}
                    onChange={(v) => updateRecipe({ portions: v || 1 })}
                    className="w-10 bg-transparent text-center outline-none text-lg font-bold"
                    style={{ color: TIER_COLORS.mid }}
                  />
                </div>
              </div>

              {/* Deux actions distinctes et nommées, jamais un comportement implicite : le champ
                  ci-dessus change le nombre de portions SANS toucher aux quantités (préparation
                  entière déjà saisie), celui-ci recalcule les grammages (fiche à imprimer pour un
                  autre nombre de couverts). Mélanger les deux serait forcément faux pour la moitié
                  des utilisateurs. */}
              {active.lines.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 mb-3 print:hidden">
                  <span className="text-[11px] text-black/45">{t("scalePortionsLabel")}</span>
                  <NumField
                    allowDecimal={false}
                    value={scaleTarget}
                    onChange={setScaleTarget}
                    className="w-11 bg-white rounded px-1.5 py-1 text-center text-sm text-black outline-none border border-black/15 focus:border-[#C9793B]"
                  />
                  <button
                    type="button"
                    onClick={() => scaleRecipeToPortions(scaleTarget)}
                    disabled={!(scaleTarget > 0) || scaleTarget === active.portions}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full disabled:opacity-35"
                    style={{ background: `${BRAND_SOLID}22`, color: BRAND_SOLID }}
                  >
                    {t("scalePortionsButton")}
                  </button>
                </div>
              )}

              <div className="text-center text-[10px] text-black/40 mb-4">{t("createdOn")} {active.createdAt || today()}</div>
              {active.isExample && (
                <div className="flex justify-center -mt-3 mb-4 print:hidden">
                  <span className="text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold" style={{ background: "#3B82F622", color: "#3B82F6" }}>
                    {t("exampleRecipeBadge")}
                  </span>
                </div>
              )}

              {/* Nouveaux repères de section (2026-08, demande explicite de simplifier la lecture
                  d'une fiche par ailleurs longue) : de simples libellés, rien de replié/caché — la
                  recette exemple doit rester lisible d'un coup d'œil dès l'arrivée, sans clic
                  supplémentaire pour comprendre sa structure. */}
              <div className="text-[10px] uppercase tracking-wide text-black/40 mt-2">{t("ingredientsSectionLabel")}</div>
              <div className="border-t border-b border-black/10 py-4 space-y-2.5">
                {/* Ajout rapide en TÊTE de liste : c'est le geste le plus fréquent quand on
                    construit une recette, il doit être le premier sous la main. */}
                <QuickAddLine
                  ingredients={ingredients}
                  ingredientDisplayName={ingredientDisplayName}
                  lang={lang}
                  t={t}
                  onAdd={quickAddLine}
                  guessUnit={guessUnitForName}
                  guessPrice={guessPriceForName}
                />
                {active.lines.map((line, idx) => {
                  const ing = ingredientById(line.ingredientId);
                  const variation = ing ? priceVariation(ing) : null;
                  const loss = ing?.lossPercent || 0;
                  // L'unité de cet ingrédient a changé depuis que cette quantité a été saisie
                  // (ex: un scan de facture a fait basculer "Ail" de pièce à kg) — la quantité
                  // affichée n'a peut-être plus le même sens, à revérifier. `unitAtEntry`
                  // undefined (lignes déjà existantes avant ce correctif) ne déclenche jamais
                  // l'avertissement.
                  const unitMismatch = ing && line.unitAtEntry !== undefined && line.unitAtEntry !== ing.unit;
                  return (
                    <div key={idx}>
                      <div className="flex items-center gap-2 text-sm">
                        <IngredientPicker
                          ingredients={ingredients}
                          value={line.ingredientId}
                          displayName={ingredientDisplayName}
                          onChange={(id) => changeLineIngredient(idx, id)}
                          className="flex-1 min-w-0 text-black/80"
                          autoOpen={autoOpenIdx === idx}
                          placeholder={t("recipeLineIngredientPlaceholder")}
                          onCreateNew={(query) => openAddWizard(idx, query)}
                          createNewLabel={t("recipeCreateIngredientFromLine")}
                          searchPlaceholder={t("pickerSearchPlaceholder")}
                          typeToSearchText={t("pickerTypeToSearch")}
                          noResultsText={t("pickerNoResults")}
                        />
                        <QtyField qty={line.qty} unit={ing?.unit} onChange={(v) => updateLineQty(idx, v)} className="w-14 shrink-0 bg-transparent text-right outline-none border-b border-black/20 py-1" t={t} />
                        {activeSupplier(ing)?.priceSource === "estimate" && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 price-field" style={{ background: TIER_COLORS.mid }} title={t("estimatedPriceHint")} />
                        )}
                        {editingLinePriceIdx === idx && ing ? (
                          <NumField
                            value={activeSupplier(ing)?.price || 0}
                            onChange={(v) => updateActiveSupplierPrice(ing.id, v)}
                            // [BUG confirmé et corrigé, 2026-08-27] Ce champ affiche/édite le prix
                            // AU KILO (activeSupplier(ing).price), alors que le même emplacement
                            // affiche normalement le COÛT DE LA LIGNE (lineCost, prix × quantité)
                            // — deux nombres différents dans le même slot visuel. Rien ne fermait
                            // le mode édition après la saisie (seul un second clic sur le crayon le
                            // faisait) : après avoir tapé "9" pour "9€/kg", le champ restait
                            // affiché à "9,00€" à côté de "150 g", donnant l'impression fausse que
                            // 150g coûtaient 9€ — alors que le prix était bien enregistré à 9€/kg
                            // et le coût réel de la ligne (1,35€) correctement calculé en interne,
                            // simplement jamais réaffiché. On referme le mode édition dès que la
                            // saisie est terminée (perte de focus, même moment que onCommit) pour
                            // que l'écran redonne immédiatement le vrai coût de la ligne.
                            onCommit={(v) => {
                              commitActiveSupplierPrice(ing.id, v);
                              setEditingLinePriceIdx(null);
                            }}
                            className="w-16 shrink-0 bg-black/5 text-right outline-none rounded px-1 price-field"
                          />
                        ) : (
                          <span className="w-14 shrink-0 text-right price-field">{lineCost(line).toFixed(2)}€</span>
                        )}
                        {ing && (
                          <button
                            onClick={() => setEditingLinePriceIdx((v) => (v === idx ? null : idx))}
                            className="text-black/25 hover:text-black print:hidden shrink-0 price-field"
                            title={t("editLinePriceTooltip")}
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        <button onClick={() => removeLine(idx)} className="text-black/25 hover:text-red-600 print:hidden shrink-0" title={t("deleteLineTooltip")}><Trash2 size={12} /></button>
                      </div>
                      {ing && (variation || loss > 0) && (
                        <div className="flex items-center gap-2 text-[10px] text-black/50 pl-0.5 -mt-0.5 mb-1.5">
                          {variation && (
                            <span
                              className="flex items-center gap-0.5 font-semibold price-field"
                              style={{ color: variation.dir === "up" ? "#DC2626" : "#16A34A" }}
                              title={t("priceVariationHint")}
                            >
                              {variation.dir === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {variation.pct}%
                            </span>
                          )}
                          {loss > 0 && <span>{t("lossLineBadge")(loss)}</span>}
                        </div>
                      )}
                      {unitMismatch && (
                        <div
                          className="flex items-center gap-1.5 text-[10px] font-semibold rounded px-2 py-1 mb-1.5 price-field"
                          style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}
                        >
                          <AlertTriangle size={11} className="shrink-0" />
                          {t("lineUnitMismatchWarning")(line.unitAtEntry, ing.unit)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Une recette toute neuve (0 ligne) tombait sur un simple petit lien "+ ligne"
                    perdu au milieu d'une page par ailleurs vide (0,00€ partout) — repéré comme
                    confus par l'utilisateur. Remplacé par un bouton bien visible tant qu'aucun
                    ingrédient n'a encore été ajouté ; redevient le petit lien discret habituel dès
                    la première ligne, pour ne pas prendre de place inutile une fois la recette lancée. */}
                {active.lines.length === 0 && (
                  <button
                    onClick={addLine}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2.5 rounded-xl border border-dashed border-black/25 text-black/50 hover:text-black hover:border-black/50 active:scale-95 transition mb-1 print:hidden"
                  >
                    <Plus size={14} /> {t("firstIngredientPrompt")}
                  </button>
                )}
                <div className="flex items-center justify-between pt-1 print:hidden">
                  <button onClick={addLine} className="text-xs text-black/40 hover:text-black flex items-center gap-1">
                    <Plus size={12} /> {t("line")}
                  </button>
                  {/* Discret et opt-in à la demande (2026-08) : pas de texte permanent sur chaque
                      ligne, juste un repère accessible d'un clic pour qui pense en cuillères/pincées
                      plutôt qu'en grammes — la valeur stockée reste toujours un vrai grammage saisi
                      à la main, aucune conversion automatique risquée. */}
                  <button onClick={() => setShowQtyHint((v) => !v)} className="text-[10px] text-black/30 hover:text-black underline decoration-dotted">
                    {t("qtyHintToggle")}
                  </button>
                </div>
                {showQtyHint && (
                  <div className="text-[10px] text-black/40 pt-1">{t("qtyHintText")}</div>
                )}
              </div>

              <div className="pt-3 space-y-1 text-sm price-field">
                <div className="text-[10px] uppercase tracking-wide text-black/40 mb-1">{t("pricingSectionLabel")}</div>
                <div className="flex justify-between"><span>{t("total")}</span><span className="font-semibold">{totalCost.toFixed(2)}€</span></div>
                <div className="flex justify-between"><span>{t("costPerPortion")}</span><span className="font-semibold">{costPerPortion.toFixed(2)}€</span></div>
                <div className="flex justify-between items-center pt-1">
                  <span>{t("sellPriceTTC")}</span>
                  <div className="flex items-center gap-1">
                    <NumField value={active.sellPrice} onChange={(v) => updateRecipe({ sellPrice: v })} className="w-16 bg-transparent text-right outline-none border-b border-black/20 font-semibold" />
                    <span>€</span>
                  </div>
                </div>
                <div className="flex justify-between text-black/50 text-xs">
                  <span>{t("sellPriceHT")} ({t("vat")} {vatRate}%)</span>
                  <span>{sellHT.toFixed(2)}€</span>
                </div>
                {/* [DÉPLACÉ 2026-08-30] Vivait avant dans l'en-tête de la fiche, au milieu de
                    "Pertes à la découpe"/"Dupliquer"/"Imprimer" — jugé "moche" sur mobile
                    (rangée surchargée). Repositionné ici, juste sous le prix de vente, avec le
                    même style que le bouton "Mettre à jour sur la carte" juste en dessous —
                    demandé explicitement par l'utilisateur. Toujours visible (pas conditionné à
                    une marge calculable), contrairement au panneau "en un coup d'œil" plus haut. */}
                <div className="flex justify-between items-center pt-1.5">
                  {active.menuIncluded ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#10B981" }}>
                      <QrCode size={11} className="shrink-0" /> {t("onMenuLabel")}
                    </span>
                  ) : (
                    <button
                      onClick={() => { setAddToMenuSection(menuCategories[0]?.id || null); setAddToMenuModalOpen(true); }}
                      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
                      style={{ background: BRAND_GRADIENT, color: "#fff" }}
                    >
                      <QrCode size={11} /> {t("addToMenuButton")}
                    </button>
                  )}
                </div>
                {/* [REFONTE 2026-08-30] Le simple avertissement passif ("attention, ce prix est
                    aussi celui affiché en direct") est remplacé par un vrai bouton d'action —
                    demandé explicitement par l'utilisateur : tester plusieurs prix pour voir
                    l'effet sur la marge ne doit JAMAIS pousser quoi que ce soit sur la carte
                    publique tant qu'on ne l'a pas décidé. `menuPrice` (nouveau champ recette) est
                    désormais le prix RÉELLEMENT affiché sur la carte digitale (voir
                    api/public-menu.js) — décorrélé de `sellPrice`, mis à jour uniquement ici, sur
                    ce bouton, jamais automatiquement. `sellPrice` reste le prix de vente "normal"
                    utilisé partout ailleurs (marge, fiche, impression). Snapshotté à `sellPrice`
                    au moment où la recette rejoint la carte pour la première fois (voir
                    `addRecipeToMenu` et `MenuRecipeRow`), donc rien à faire tant qu'on ne
                    retouche pas le prix après coup. */}
                {active.menuIncluded && active.sellPrice !== active.menuPrice && (
                  <div className="flex items-center justify-between gap-2 pt-1.5">
                    <span className="flex items-center gap-1.5 text-[10px]" style={{ color: TIER_COLORS.mid }}>
                      <QrCode size={11} className="shrink-0" />
                      {t("menuPriceOutdatedHint")}
                    </span>
                    <button
                      onClick={() => {
                        updateRecipe({ menuPrice: active.sellPrice });
                        setMenuPricePushedId(active.id);
                        setTimeout(() => setMenuPricePushedId(null), 3000);
                      }}
                      className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full"
                      style={{ background: BRAND_GRADIENT, color: "#fff" }}
                    >
                      {t("menuPricePushButton")}
                    </button>
                  </div>
                )}
                {menuPricePushedId === active.id && (
                  <div className="flex items-center gap-1.5 text-[10px] pt-1" style={{ color: "#10B981" }}>
                    <Check size={11} className="shrink-0" />
                    {t("menuPricePushSuccess")}
                  </div>
                )}
                {active.lines.some((l) => activeSupplier(ingredientById(l.ingredientId))?.priceSource === "estimate") && (
                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-black/40 pt-1 text-right">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TIER_COLORS.mid }} />
                    {t("estimatedPriceLegend")}
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-black/30 mt-3 pt-3 text-xs space-y-2 print:hidden">
                <div className="flex justify-between items-center text-black/60">
                  <span>{t("targetMargin")}</span>
                  <div className="flex items-center gap-1">
                    <NumField allowDecimal={false} value={targetMargin} onChange={(v) => updateRecipe({ targetMargin: v })} className="w-12 bg-transparent text-right outline-none border-b border-black/20" />
                    <span>%</span>
                  </div>
                </div>
                {isBelowTarget && suggestedTTC !== null && (
                  <div className="flex justify-between items-center">
                    <span>{t("suggestedPrice")}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{suggestedTTC.toFixed(2)}€</span>
                      <button
                        onClick={() => updateRecipe({ sellPrice: Math.round(suggestedTTC * 2) / 2 })}
                        className="text-[10px] uppercase tracking-wide px-3 py-1 rounded-full font-semibold"
                        style={{ background: BRAND_GRADIENT, color: "#fff", boxShadow: BRAND_SHADOW }}
                      >
                        {t("use")}
                      </button>
                    </div>
                  </div>
                )}
                {isAtOrAboveTarget && nextMarginStep !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-black/50">{t("recipeTargetReached")}</span>
                    <button
                      onClick={() => updateRecipe({ targetMargin: nextMarginStep })}
                      className="text-[10px] uppercase tracking-wide px-3 py-1 rounded-full font-semibold text-white"
                      style={{ background: TIER_COLORS.high }}
                    >
                      {t("simulateHigherMargin")(nextMarginStep)}
                    </button>
                  </div>
                )}
              </div>

              {margin !== null && (
                <div className="flex flex-col items-center mt-6 mb-1 gap-2 price-field">
                  <div className="inline-flex items-stretch rounded-2xl border-2 overflow-hidden" style={{ borderColor: TIER_COLORS[tier] }}>
                    <div
                      className="px-4 py-2 flex items-center justify-center font-display uppercase tracking-wide text-sm font-bold"
                      style={{ color: TIER_COLORS[tier] }}
                    >
                      {t("marginLabel")} {Math.round(margin)}%
                    </div>
                    {costPerPortion > 0 && (
                      <>
                        <div className="w-px" style={{ background: `${TIER_COLORS[tier]}50` }} />
                        <div className="px-4 py-1.5 flex flex-col items-center justify-center" style={{ color: TIER_COLORS[tier] }}>
                          <span className="font-mono font-bold text-sm leading-none">×{(sellHT / costPerPortion).toFixed(1)}</span>
                          <span className="text-[7px] uppercase tracking-wide opacity-60 mt-0.5">{t("coefLabel")}</span>
                        </div>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMarginLegend((v) => !v)}
                      className="w-5 h-5 shrink-0 self-center mr-1.5 rounded-full flex items-center justify-center text-[10px] font-bold border"
                      style={{ borderColor: `${TIER_COLORS[tier]}80`, color: TIER_COLORS[tier] }}
                      title={t("marginLegendToggle")}
                    >
                      ?
                    </button>
                  </div>
                  {/* Rouge/orange/vert code un seuil de marge que l'utilisateur choisit lui-même
                      dans les Paramètres — la légende n'était visible que là-bas, jamais à
                      l'endroit où la couleur apparaît réellement. Bouton "?" discret plutôt
                      qu'un texte permanent, pour ne pas surcharger la fiche recette. */}
                  {showMarginLegend && (
                    <p className="text-[10px] text-black/40 text-center max-w-[280px]">
                      {hasOrangeZone
                        ? t("marginLegendWithOrange")(effectiveGreenTarget, CRITICAL_MARGIN)
                        : t("marginLegendNoOrange")(CRITICAL_MARGIN)}
                    </p>
                  )}
                  <div
                    className="flex items-center gap-1.5 text-[11px] font-body text-center px-3 py-1.5 rounded-full font-medium max-w-[280px]"
                    style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}18` }}
                  >
                    {tier === "high" ? <Check size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
                    {marginMessage(Math.round(margin), effectiveGreenTarget, tier, lang)}
                  </div>
                  {marginSuggestion && (
                    <div
                      className="flex items-start gap-2 text-[11px] font-body text-left px-3 py-2 rounded-xl max-w-[320px]"
                      style={{ color: TIER_COLORS[tier], background: `${TIER_COLORS[tier]}0f`, border: `1px dashed ${TIER_COLORS[tier]}50` }}
                    >
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span><strong>{t("suggestionTitle")}</strong> {marginSuggestion}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-dashed border-black/30 mt-4 pt-3 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/40 mb-1">{t("notes")}</div>
                  <textarea value={active.notes || ""} onChange={(e) => updateRecipe({ notes: e.target.value })} placeholder={t("notesPlaceholder")} rows={3} className="w-full bg-black/5 rounded p-2 text-xs outline-none resize-none focus:bg-black/10 print:hidden" />
                  {active.notes && (
                    <div className="hidden print:block text-xs p-2 whitespace-pre-wrap">{active.notes}</div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] uppercase tracking-wide text-black/40 flex items-center gap-1.5">
                      {t("allergens")}
                      {active.allergensAuto !== false && active.allergens && (
                        <span className="normal-case tracking-normal text-[9px] px-1 py-0.5 rounded bg-black/10 text-black/40">{t("allergensAutoBadge")}</span>
                      )}
                    </div>
                  </div>
                  <input
                    value={active.allergens || ""}
                    onChange={(e) => updateRecipe({ allergens: e.target.value, allergensAuto: false, allergenCodes: matchAllergenCodesFromText(e.target.value) })}
                    placeholder={t("allergensPlaceholder")}
                    className="w-full bg-black/5 rounded p-2 text-xs outline-none focus:bg-black/10 print:hidden"
                  />
                  {active.allergens && (
                    <div className="hidden print:block text-xs p-2 whitespace-pre-wrap">{active.allergens}</div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => deleteRecipe(active.id)}
              className="mt-4 w-full text-center text-[11px] text-white/25 hover:text-[#B23A2E] print:hidden"
            >
              <Trash2 size={11} className="inline mr-1 -mt-0.5" /> {t("deleteRecipeButton")}
            </button>
          </div>
        )}

        {/* ---------------- ONGLET SCANNER ---------------- */}
        {activeTab === "scanner" && (
          <div className="max-w-md mx-auto pt-6">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanFile} />
            {/* PDF de nouveau proposé sur tous les appareils, y compris iOS (2026-08-25) : le
                blocage temporaire posé plus tôt dans la soirée (voir git log) n'est plus
                nécessaire depuis que le PDF est envoyé brut à Claude au lieu d'être parsé dans le
                navigateur — le bug WebKit qui justifiait ce blocage ne peut simplement plus se
                produire, plus besoin de distinguer les appareils. */}
            <input ref={fileInputLibraryRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScanFile} />
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center font-body border border-white/10"
              style={{ background: "#201B15", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 26px rgba(0,0,0,0.28)" }}
            >
              <svg viewBox="0 0 120 120" width="104" height="104" className="mb-1">
                <rect x="30" y="14" width="60" height="86" rx="4" fill="#F3EBDA" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                {[26, 34, 42, 50, 58, 66, 74].map((y, i) => (
                  <rect key={i} x="38" y={y} width={i % 3 === 0 ? 30 : 44} height="3" rx="1.5" fill="#2B262022" />
                ))}
                <rect x="38" y="84" width="44" height="4" rx="2" fill="#C9793B55" />
                <g style={{ transformOrigin: "60px 57px", animation: "scanPulse 2.2s ease-in-out infinite" }}>
                  <rect x="26" y="53" width="68" height="3" rx="1.5" fill="#C9793B" opacity="0.9" />
                </g>
                <g style={{ animation: "scanFlash 2.2s ease-in-out infinite" }}>
                  <circle cx="94" cy="100" r="17" fill="#C9793B" />
                  <rect x="86" y="93" width="16" height="12" rx="2.5" fill="#16130F" />
                  <circle cx="94" cy="99" r="3.4" fill="#C9793B" />
                </g>
              </svg>
              <h2 className="font-display text-white uppercase tracking-wide text-sm mt-1">{t("scanInvoice")}</h2>
              <p className="text-white/40 text-xs leading-relaxed">{t("scanTabHint")}</p>
              {/* Import de fichier mis en avant (PDF natif ou photo depuis la galerie) plutôt que
                  la prise de photo directe — demande explicite de l'utilisateur, 2026-08, suite à
                  la campagne de test qui a confirmé le PDF natif comme la modalité la plus fiable
                  (aucun risque d'alignement visuel/décalage de ligne). La prise de photo reste
                  pleinement fonctionnelle (l'utilisateur confirme de bons résultats même sur un
                  ticket de caisse pris rapidement) — seule la mise en avant visuelle change,
                  jamais une fonctionnalité retirée. */}
              <span
                className="mt-3 text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#3B82F622", color: "#3B82F6" }}
              >
                {t("scanRecommendedBadge")}
              </span>
              <button
                onClick={() => fileInputLibraryRef.current?.click()}
                className="mt-1.5 w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: "#3B82F6", color: "#fff", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(59,130,246,0.4)" }}
              >
                <Upload size={15} /> {t("scanUploadFile")}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs font-display uppercase tracking-wide py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform border border-white/20 text-white/60"
              >
                <Camera size={15} /> {t("scanTakePhoto")}
              </button>
            </div>

            <div
              className="rounded-2xl p-4 mt-3 text-xs leading-relaxed border border-white/10"
              style={{ background: "#201B15", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.22)" }}
            >
              <p className="text-white/70 font-semibold mb-1">{t("scanTipTitle")}</p>
              <p className="text-white/45">{t("scanTipBody")}</p>
            </div>
          </div>
        )}

        {/* ---------------- ONGLET GARDE-MANGER ---------------- */}
        {activeTab === "pantry" && (
          <div>
            <h2 className="font-display text-white/90 uppercase text-sm tracking-widest mb-3">{t("pantry")}</h2>

            {ingredients.length > 0 && ingredients.every((i) => activeSupplier(i)?.priceSource === "estimate") && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-3 text-xs" style={{ background: `${TIER_COLORS.mid}18`, color: TIER_COLORS.mid }}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{t("pantryOnboardingHint")}</span>
              </div>
            )}

            {/* Un appareil qui a visité l'app avant le vidage du garde-manger de démarrage
                (~200 ingrédients -> 7) garde pour toujours son ancien garde-manger : le principe
                "ne jamais écraser une donnée existante" s'applique aussi à cette ancienne démo,
                exactement comme à de vraies données. Repéré en test réel (2026-08, téléphone de
                l'utilisateur toujours sur l'ancienne liste). Condition volontairement stricte
                (>20 ingrédients ET tous encore au prix "estimé") pour ne jamais se déclencher sur
                un vrai garde-manger déjà utilisé, même partiellement. */}
            {ingredients.length > 20 && ingredients.every((i) => activeSupplier(i)?.priceSource === "estimate") && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 text-xs" style={{ background: "#C9793B18", color: "#E0B98A" }}>
                <AlertTriangle size={14} className="shrink-0" />
                <span className="flex-1">{t("legacyPantryHint")}</span>
                <button
                  onClick={() => setIngredients(SEED_INGREDIENTS)}
                  className="shrink-0 text-[11px] font-display uppercase tracking-wide px-2.5 py-1.5 rounded-full"
                  style={{ background: BRAND_GRADIENT, color: "#fff" }}
                >
                  {t("legacyPantryButton")}
                </button>
              </div>
            )}

            {uncategorizedIngredients.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 text-xs" style={{ background: "#C9793B18", color: "#E0B98A" }}>
                <Tags size={14} className="shrink-0" />
                <span className="flex-1">{t("pantryReclassifyHint")(uncategorizedIngredients.length)}</span>
                <button
                  onClick={reclassifyUncategorized}
                  className="shrink-0 text-[11px] font-display uppercase tracking-wide px-2.5 py-1.5 rounded-full"
                  style={{ background: BRAND_GRADIENT, color: "#fff" }}
                >
                  {t("pantryReclassifyButton")}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 mb-2 border border-white/10" style={{ background: "#201B15" }}>
              <Search size={13} className="text-white/40 shrink-0" />
              <input
                value={pantryQuery}
                onChange={(e) => setPantryQuery(e.target.value)}
                placeholder={t("pantryFilterPlaceholder")}
                className="w-full bg-transparent text-white text-sm outline-none min-w-0"
              />
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              <button
                onClick={() => setPantryCategory((c) => (c === "recent" ? "none" : "recent"))}
                className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border flex items-center gap-1 ${pantryCategory === "recent" ? "bg-[#3B82F6] text-white border-[#3B82F6]" : "text-[#3B82F6] border-[#3B82F650] hover:border-[#3B82F6]"}`}
              >
                <Clock size={10} /> {t("recentIngredients")}
              </button>
              <button
                onClick={() => setPantryCategory((c) => (c === "all" ? "none" : "all"))}
                className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === "all" ? "bg-[#C9793B] text-white border-[#C9793B]" : "text-white/50 border-white/15 hover:border-white/40"}`}
              >
                {t("allCategories")}
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPantryCategory((cur) => (cur === c.id ? "none" : c.id))}
                  className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border ${pantryCategory === c.id ? "bg-[#C9793B] text-white border-[#C9793B]" : "text-white/50 border-white/15 hover:border-white/40"}`}
                >
                  {c[lang]}
                </button>
              ))}
            </div>

            {pantryCategory === "recent" && recentGrouped && recentGrouped.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={() => {
                    const allIds = recentGrouped.flatMap((g) => g.items.map((i) => i.id));
                    const allSelected = allIds.length > 0 && allIds.every((id) => selectedRecentIds.has(id));
                    setSelectedRecentIds(allSelected ? new Set() : new Set(allIds));
                  }}
                  className="text-[11px] text-white/50 hover:text-white underline decoration-dotted"
                >
                  {recentGrouped.flatMap((g) => g.items).every((i) => selectedRecentIds.has(i.id)) ? t("deselectAll") : t("selectAllRecent")}
                </button>
                {selectedRecentIds.size > 0 && (
                  <button
                    onClick={() => setBulkDeleteConfirmOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#EF4444] hover:text-[#B23A2E]"
                  >
                    <Trash2 size={12} /> {t("deleteSelectedButton")(selectedRecentIds.size)}
                  </button>
                )}
              </div>
            )}

            <div
              className="rounded-2xl overflow-hidden font-body border border-white/10"
              style={{ background: "#201B15", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.22)" }}
            >
              {(() => {
                const displayGroups = pantryCategory === "recent" ? recentGrouped || [] : pantryGrouped;
                if (displayGroups.length === 0) {
                  return (
                    <div className="px-3 py-8 text-center text-white/30 text-sm">
                      {pantryCategory === "recent"
                        ? t("noRecentIngredients")
                        : pantryCategory === "none" && !pantryQuery.trim()
                        ? t("pantryEmptyPrompt")
                        : t("noFilterMatch")}
                    </div>
                  );
                }
                return displayGroups.map(({ label, items }) => (
                  <div key={label}>
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/45"
                      style={{ background: "#16130F" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#C9793B" }} />
                      {label}
                    </div>
                    {items.map((ing) => {
                    const sup = activeSupplier(ing);
                    const isOpen = expandedIngId === ing.id;
                    return (
                      <div key={ing.id} className="border-t border-white/5">
                        <div className="w-full flex items-center gap-2 px-3 py-2.5">
                          {pantryCategory === "recent" && (
                            <input
                              type="checkbox"
                              checked={selectedRecentIds.has(ing.id)}
                              onChange={() => toggleRecentSelection(ing.id)}
                              className="shrink-0"
                            />
                          )}
                          <button
                            onClick={() => setExpandedIngId(isOpen ? null : ing.id)}
                            className="flex-1 min-w-0 flex items-center gap-2 text-left"
                          >
                            <span className="flex-1 min-w-0 text-white text-sm truncate">{ingredientDisplayName(ing)}</span>
                            {sup?.priceSource === "estimate" && (
                              <span
                                className="shrink-0 text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ color: TIER_COLORS.mid, background: `${TIER_COLORS.mid}22` }}
                                title={t("estimatedPriceHint")}
                              >
                                {t("estimatedPriceBadge")}
                              </span>
                            )}
                            <span className="text-white/40 text-[11px] shrink-0">{unitDisplayLabel(ing.unit, t)}</span>
                            <span className="text-white text-sm font-mono font-semibold shrink-0 w-16 text-right">{(sup?.price || 0).toFixed(2)}€</span>
                          </button>
                          <button
                            onClick={() => setExpandedIngId(isOpen ? null : ing.id)}
                            className="shrink-0 flex items-center gap-0.5 text-white/30 hover:text-white p-1"
                            title={t("viewDetailsTooltip")}
                          >
                            <span className="text-[9px] uppercase tracking-wide">{t("viewDetailsLabel")}</span>
                            <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        </div>

                        {isOpen && (
                          <div className="px-3 pb-3" style={{ background: "#16130F" }}>
                            <input
                              value={ingredientDisplayName(ing)}
                              onChange={(e) => updateIngredientName(ing.id, e.target.value)}
                              className="w-full bg-transparent text-white text-sm font-medium outline-none border-b border-white/10 focus:border-[#C9793B] pb-1 pt-2 mb-2"
                            />
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">{t("unitFieldLabel")}</span>
                              <select
                                value={ing.unit}
                                onChange={(e) => updateIngredientField(ing.id, "unit", e.target.value)}
                                className="bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1"
                                style={{ colorScheme: "dark" }}
                              >
                                <option value="kg">kg</option>
                                <option value="L">L</option>
                                <option value="pièce">{t("unitPieceLabel")}</option>
                              </select>
                            </div>

                            {/* Reclassement manuel — seul moyen de corriger un ingrédient jamais rapproché
                                automatiquement du catalogue (nom trop spécifique à la facture, ex: "Mozzarella
                                di bufala"). Ne touche jamais catalogId (donc pas le lien allergène) : changer
                                juste la catégorie ne doit pas faire croire à un rapprochement produit fiable. */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">{t("categoryLabel")}</span>
                              <select
                                value={ing.category || "autres"}
                                onChange={(e) => updateIngredientField(ing.id, "category", e.target.value)}
                                className="bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1"
                                style={{ colorScheme: "dark" }}
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c.id} value={c.id}>{c[lang]}</option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] uppercase tracking-wide text-white/40">{t("lossPercentLabel")}</span>
                              <NumField
                                value={ing.lossPercent || 0}
                                onChange={(v) => updateIngredientField(ing.id, "lossPercent", Math.min(Math.max(v, 0), 95))}
                                allowDecimal={false}
                                className="w-12 bg-black/20 text-white/70 text-xs outline-none rounded px-1.5 py-1 text-right"
                              />
                              <span className="text-white/40 text-xs">%</span>
                            </div>

                            <div className="space-y-1 mb-2">
                              {ing.suppliers.map((s) => (
                                <div key={s.id} className="flex items-center gap-1.5 text-xs text-white/60">
                                  <input type="radio" checked={ing.selectedSupplierId === s.id} onChange={() => selectSupplier(ing.id, s.id)} className="shrink-0" />
                                  <input
                                    value={s.name}
                                    onChange={(e) => updateSupplier(ing.id, s.id, "name", e.target.value)}
                                    className="flex-1 bg-transparent outline-none border-b border-white/10 focus:border-[#C9793B] min-w-0"
                                  />
                                  <NumField value={s.price} onChange={(v) => updateSupplier(ing.id, s.id, "price", v)} onCommit={(v) => commitSupplierPrice(ing.id, s.id, v)} className="w-14 shrink-0 bg-transparent font-mono outline-none border-b border-white/10 focus:border-[#C9793B] text-right" />
                                  <span className="shrink-0">€</span>
                                  {ing.suppliers.length > 1 && (
                                    <button onClick={() => removeSupplier(ing.id, s.id)} className="text-white/25 hover:text-red-400 shrink-0"><Trash2 size={11} /></button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addSupplier(ing.id)} className="text-[10px] uppercase tracking-wide text-white/40 hover:text-[#C9793B] flex items-center gap-1">
                                <Plus size={10} /> {t("supplier")}
                              </button>
                            </div>

                            {ing.history && ing.history.length > 0 && (
                              <div className="pt-2 border-t border-white/10 text-[10px] text-white/40 font-mono flex items-start gap-1 mb-2">
                                <History size={11} className="mt-0.5 shrink-0" />
                                <span className="break-words">{ing.history.slice(-3).map((h) => `${h.date}: ${h.price.toFixed(2)}€`).join("  ·  ")}</span>
                              </div>
                            )}

                            <button onClick={() => deleteIngredient(ing.id)} className="text-[10px] uppercase tracking-wide text-white/30 hover:text-[#B23A2E] flex items-center gap-1">
                              <Trash2 size={11} /> {t("deleteIngredientButton")}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
              })()}
            </div>

            <button onClick={() => openAddWizard()} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-display uppercase tracking-wide py-2.5 rounded-xl border border-dashed border-white/25 text-white/60 hover:text-[#C9793B] hover:border-[#C9793B] active:scale-95 transition">
              <Plus size={14} /> {t("addIngredient")}
            </button>
          </div>
        )}

        {/* [2026-08-28] "Carte digitale" est un vrai onglet maintenant, plus une fenêtre flottante
            (`digitalMenuOpen`/modal retirés) — demandé par l'utilisateur, qui trouvait la fenêtre
            incohérente avec les 3 autres onglets qui occupent tout l'écran. `onClose` redirige
            vers l'onglet Recettes plutôt que de fermer une fenêtre.
            [RETIRÉ 2026-08-30] L'assistant guidé (`MenuWizard`, 4 étapes) qui s'affichait par
            défaut au premier contact a été jugé "chiant"/"trop compliqué" par l'utilisateur — il
            veut directement l'écran simple, jamais un tunnel d'étapes. `DigitalMenuModal` (revu
            le même jour en 5 boutons plats : Voir ma carte / Publier ma carte / Télécharger QR
            code / Personnaliser ma carte / Ajouter des plats) est désormais la SEULE vue de cet
            onglet. `MenuWizard.jsx` et `showMenuAdvanced` restent dans le code, juste plus
            jamais atteints depuis l'UI — même principe que le scanner de fiche recette caché le
            2026-08-18 (garder le code, retirer seulement le point d'entrée). */}
        {activeTab === "menu" && (
          <DigitalMenuModal
            open={true}
            onClose={() => setActiveTab("recipes")}
            menuSettings={menuSettings}
            setMenuSettings={setMenuSettings}
            recipes={recipes}
            setRecipes={setRecipes}
            simpleItems={simpleItems}
            setSimpleItems={setSimpleItems}
            onConvertToRecipe={convertSimpleItemToRecipe}
            userId={menuUserId}
            lang={lang}
            t={t}
          />
        )}
      </main>

      {/* Premier lancement guidé — voir FirstRunWizard. Rendu par-dessus tout le reste, mais
          uniquement sur un compte encore totalement vierge (voir looksBrandNew) et jamais une
          seconde fois (drapeau firstRunDone, stocké par compte). */}
      {showFirstRun && (
        <FirstRunWizard t={t} onFinish={finishFirstRun} onSkip={closeFirstRun} />
      )}
      {firstRunScanStepOpen && (
        <FirstRunScanDemo
          t={t}
          dishName={active?.name || ""}
          items={firstRunDemoItems}
          onAddDemo={finishFirstRunDemo}
          onScanReal={skipDemoToRealScan}
          onSkip={closeFirstRunScanStep}
        />
      )}

      {/* ---------------- NAVIGATION PAR ONGLETS (bas d'écran) ---------------- */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex items-stretch backdrop-blur-lg print:hidden"
        style={{ background: "rgba(38,34,28,0.8)", borderTop: "1px solid rgba(201,154,85,0.2)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {[
          { id: "recipes", label: t("recipes"), icon: Receipt },
          { id: "scanner", label: t("scanTab"), icon: Camera },
          { id: "pantry", label: t("pantry"), icon: Package },
          // [AJOUT 2026-08-28, devenu un vrai onglet le même jour après retour utilisateur] "Carte
          // digitale" élevée en onglet de navigation principal — avant, uniquement un petit bouton
          // gris noyé parmi 3 autres dans l'en-tête de l'onglet Recettes (liste/grille, fiche
          // allergènes, +Nouvelle recette), donc quasiment invisible pour qui ne savait pas déjà où
          // chercher. Un premier essai la gardait comme fenêtre modale par-dessus l'app, jugé
          // incohérent avec les 3 autres onglets qui occupent tout l'écran — c'est maintenant un
          // vrai onglet au même niveau que Recettes/Scanner/Garde-manger (voir plus bas dans
          // `<main>`). Le petit bouton dans l'en-tête Recettes reste en place aussi.
          { id: "menu", label: t("digitalMenuButton"), icon: QrCode },
        ].map((tabDef) => {
          const TabIcon = tabDef.icon;
          const isActive = activeTab === tabDef.id;
          return (
            <button
              key={tabDef.id}
              onClick={() => {
                setActiveTab(tabDef.id);
                if (tabDef.id === "recipes") setRecipeSubView("list");
              }}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 active:scale-90 transition-transform"
            >
              <TabIcon size={20} color={isActive ? BRAND_SOLID : "rgba(255,255,255,0.4)"} />
              <span className={`text-[10px] font-display uppercase tracking-wide ${isActive ? "text-[#C9793B]" : "text-white/40"}`}>{tabDef.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
