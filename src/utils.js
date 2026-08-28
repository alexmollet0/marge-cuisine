// Petits utilitaires partagés — extrait de App.jsx le 2026-08-28.
export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().slice(0, 10);
