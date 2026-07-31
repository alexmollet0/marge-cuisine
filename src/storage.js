// Mini-remplaçant de "window.storage" (spécifique aux artifacts Claude)
// utilisant localStorage, pour que l'app fonctionne sur un vrai site web.
const PREFIX = "chefup:";
const OLD_PREFIX = "marge-cuisine:";
const MIGRATION_FLAG = "__chefup_storage_migrated__";

// Renommage "Marge en cuisine" -> "Chefup" (2026-07-31) : copie une seule fois les
// données déjà enregistrées sous l'ancien préfixe vers le nouveau, pour qu'un
// utilisateur existant ne perde pas ses recettes/ingrédients au premier chargement.
function migrateOldPrefix() {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG) === "1") return;
  for (const oldKey of Object.keys(localStorage)) {
    if (!oldKey.startsWith(OLD_PREFIX)) continue;
    const newKey = PREFIX + oldKey.slice(OLD_PREFIX.length);
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, localStorage.getItem(oldKey));
    }
  }
  localStorage.setItem(MIGRATION_FLAG, "1");
}
migrateOldPrefix();

export const storage = {
  async get(key) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) throw new Error("not found");
    return { key, value: raw, shared: false };
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value);
    return { key, value, shared: false };
  },
  async delete(key) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "") {
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX + prefix))
      .map((k) => k.slice(PREFIX.length));
    return { keys, shared: false };
  },
};
