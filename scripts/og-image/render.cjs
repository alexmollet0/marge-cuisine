// Génère l'image d'aperçu du lien (1200 x 630) à partir de og.html (2026-11-19).
// Usage : node scripts/og-image/render.cjs public/og-image.jpg
//
// Ce script n'est PAS une dépendance de l'application : il sert seulement à refaire l'image quand son texte change.
// Il utilise le navigateur (Edge) et les polices du dossier frère « chefup-tiktok » (playwright-core + @fontsource), qui ne sont pas
// installés dans ce projet — voir les chemins en dur ci-dessous et dans og.html. Si le dossier a bougé, adapter ces deux endroits.
const { createRequire } = require("module");
const req = createRequire("C:/Users/Alexx/OneDrive/Documents/chefup-tiktok/package.json");
const { chromium } = req("playwright-core");
const path = require("path");
const { pathToFileURL } = require("url");
(async () => {
  const sortie = process.argv[2];
  if (!sortie) { console.error("Usage : node scripts/og-image/render.cjs public/og-image.jpg"); process.exit(1); }
  const jpeg = /\.jpe?g$/i.test(sortie);
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(path.join(__dirname, "og.html")).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.screenshot(jpeg ? { path: sortie, type: "jpeg", quality: 90 } : { path: sortie });
  await b.close();
  console.log("image écrite :", sortie);
})();
