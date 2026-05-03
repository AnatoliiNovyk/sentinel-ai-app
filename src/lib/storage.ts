/**
 * Versioned localStorage helpers.
 *
 * Data is persisted as `{ _v: version, data: T }`.
 * If the stored version does not match the expected version the entry is
 * removed and the provided `fallback` value is returned instead, preventing
 * stale / incompatible data from silently corrupting runtime state.
 */

interface StorageEnvelope<T> {
  _v: string;
  data: T;
}

/**
 * Read a versioned value from localStorage.
 * Returns `fallback` when the key is absent, the JSON is invalid, or the
 * stored schema version does not match `version`.
 */
export function loadVersioned<T>(key: string, version: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const envelope = JSON.parse(raw) as StorageEnvelope<T>;
    if (envelope._v !== version) {
      localStorage.removeItem(key);
      return fallback;
    }
    return envelope.data;
  } catch {
    return fallback;
  }
}

/**
 * Write a versioned value to localStorage.
 * Silently ignores storage errors (e.g. private-browsing quota exceeded).
 */
export function saveVersioned<T>(key: string, version: string, data: T): void {
  try {
    const envelope: StorageEnvelope<T> = { _v: version, data };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch { /* ignore */ }
}
