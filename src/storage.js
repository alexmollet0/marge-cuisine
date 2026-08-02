// Stockage par compte (Supabase), remplace l'ancien stockage localStorage.
// Même interface get/set/delete/list qu'avant : le reste de l'app (App.jsx)
// n'a besoin d'aucun changement. La table "kv_store" a une policy RLS qui
// restreint chaque ligne à son propriétaire (user_id = auth.uid()), et la
// colonne user_id se remplit toute seule via un DEFAULT auth.uid() côté
// base — le client n'a jamais besoin de connaître/transmettre l'id du user.
import { supabase } from "./supabaseClient.js";

export const storage = {
  async get(key) {
    const { data, error } = await supabase.from("kv_store").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("not found");
    return { key, value: data.value, shared: false };
  },
  async set(key, value) {
    const { error } = await supabase
      .from("kv_store")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
    if (error) throw error;
    return { key, value, shared: false };
  },
  async delete(key) {
    const { error } = await supabase.from("kv_store").delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "") {
    const { data, error } = await supabase.from("kv_store").select("key").like("key", `${prefix}%`);
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key), shared: false };
  },
};
