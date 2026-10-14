/**
 * RapidKeys Configuration & LocalStorage State Manager
 *
 * Provides persistent configuration management across browser sessions with
 * strict schema validation and graceful fallback against JSON corruption
 * or storage access restrictions.
 */

export const STORAGE_KEY = 'rapidkeys_config';

export const VALID_MODES = Object.freeze(['time', 'words']);
export const VALID_TIME_LIMITS = Object.freeze([15, 30, 60, 120]);
export const VALID_WORD_COUNTS = Object.freeze([10, 25, 50, 100]);
export const VALID_THEMES = Object.freeze([
  'rapidkeys',
  'dracula',
  'nord',
  'monokai',
  'matrix',
  'carbon'
]);

export const DEFAULT_CONFIG = Object.freeze({
  mode: 'time',
  timeLimit: 30,
  wordCount: 25,
  punctuation: false,
  numbers: false,
  theme: 'rapidkeys'
});

/**
 * Safely accesses the active localStorage interface across window, globalThis, or headless environments.
 * @returns {Storage|null}
 */
function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Storage access restricted (e.g. security sandbox, iframe permissions)
  }
  return null;
}

/**
 * Validates and sanitizes a configuration candidate object against the RapidKeys specification.
 * Replaces any missing, corrupt, or invalid properties with default values.
 *
 * @param {unknown} candidate
 * @returns {typeof DEFAULT_CONFIG}
 */
export function validateConfig(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ...DEFAULT_CONFIG };
  }

  const validated = { ...DEFAULT_CONFIG };

  if (VALID_MODES.includes(candidate.mode)) {
    validated.mode = candidate.mode;
  }

  if (VALID_TIME_LIMITS.includes(candidate.timeLimit)) {
    validated.timeLimit = candidate.timeLimit;
  }

  if (VALID_WORD_COUNTS.includes(candidate.wordCount)) {
    validated.wordCount = candidate.wordCount;
  }

  if (typeof candidate.punctuation === 'boolean') {
    validated.punctuation = candidate.punctuation;
  }

  if (typeof candidate.numbers === 'boolean') {
    validated.numbers = candidate.numbers;
  }

  if (typeof candidate.theme === 'string' && VALID_THEMES.includes(candidate.theme.toLowerCase())) {
    validated.theme = candidate.theme.toLowerCase();
  }

  return validated;
}

/**
 * In-memory active configuration cache.
 * @type {Object|null}
 */
let cachedConfig = null;

/**
 * Loads and validates configuration from localStorage.
 * Returns null if storage is empty, inaccessible, or corrupted.
 *
 * @returns {Object|null}
 */
function loadFromStorage() {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateConfig(parsed);
  } catch {
    // Corrupted JSON or storage read error -> fallback to defaults
    return null;
  }
}

/**
 * Persists configuration object to localStorage.
 *
 * @param {Object} config
 */
function saveToStorage(config) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Quota exceeded or storage write restricted -> ignore silently
  }
}

/**
 * Retrieves the current configuration object.
 *
 * Automatically restores from localStorage on first access.
 * Returns a cloned object to prevent external mutation of internal state.
 *
 * @returns {typeof DEFAULT_CONFIG}
 */
export function getConfig() {
  if (cachedConfig === null) {
    const stored = loadFromStorage();
    cachedConfig = stored !== null ? stored : { ...DEFAULT_CONFIG };
  }
  return { ...cachedConfig };
}

/**
 * Updates active configuration with partial updates, validates all fields,
 * persists the result to localStorage, and returns a cloned copy.
 *
 * Invalid fields within the partial update are ignored, preserving previous valid values.
 *
 * @param {Partial<typeof DEFAULT_CONFIG>} partial
 * @returns {typeof DEFAULT_CONFIG}
 */
export function updateConfig(partial) {
  const current = getConfig();

  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
    return current;
  }

  const next = { ...current };

  if (partial.mode !== undefined && VALID_MODES.includes(partial.mode)) {
    next.mode = partial.mode;
  }

  if (partial.timeLimit !== undefined && VALID_TIME_LIMITS.includes(partial.timeLimit)) {
    next.timeLimit = partial.timeLimit;
  }

  if (partial.wordCount !== undefined && VALID_WORD_COUNTS.includes(partial.wordCount)) {
    next.wordCount = partial.wordCount;
  }

  if (typeof partial.punctuation === 'boolean') {
    next.punctuation = partial.punctuation;
  }

  if (typeof partial.numbers === 'boolean') {
    next.numbers = partial.numbers;
  }

  if (typeof partial.theme === 'string' && VALID_THEMES.includes(partial.theme.toLowerCase())) {
    next.theme = partial.theme.toLowerCase();
  }

  cachedConfig = next;
  saveToStorage(cachedConfig);
  return { ...cachedConfig };
}

/**
 * Resets configuration back to default settings, updates localStorage, and returns defaults.
 *
 * @returns {typeof DEFAULT_CONFIG}
 */
export function resetConfig() {
  cachedConfig = { ...DEFAULT_CONFIG };
  saveToStorage(cachedConfig);
  return { ...cachedConfig };
}

/**
 * Test helper to clear in-memory cache and re-evaluate storage environment.
 */
export function _clearCache() {
  cachedConfig = null;
}

