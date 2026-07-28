/**
 * Gemeinsamer Auth-Header für alle Aufrufe ans Python-Backend
 * (divine-warmth/exquisite-rejoicing) — Audit-Fund #1, 27.07.
 *
 * BACKEND_API_KEY leer/nicht gesetzt -> leeres Objekt, kein Header.
 * Fail-safe: solange der Key nirgends in Railway gesetzt ist, ändert
 * sich am Verhalten nichts (Backend selbst ist dann auch noch offen).
 */
export function pythonBackendAuthHeader(): Record<string, string> {
  const key = process.env.BACKEND_API_KEY;
  return key ? { "X-Backend-Key": key } : {};
}
