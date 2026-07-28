// Mini-remplaçant de "window.storage" (spécifique aux artifacts Claude)
// utilisant localStorage, pour que l'app fonctionne sur un vrai site web.
const PREFIX = "marge-cuisine:";

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
