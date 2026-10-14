/**
 * RapidKeys Theme Engine
 *
 * Manages UI color themes via CSS custom properties and document[data-theme] attribute.
 * Features 6 high-contrast, minimalist themes inspired by developer environments.
 */

import { getConfig, updateConfig } from '../config.js';

export const THEMES = Object.freeze([
  'rapidkeys',
  'dracula',
  'nord',
  'monokai',
  'matrix',
  'carbon'
]);

export const DEFAULT_THEME = 'rapidkeys';

export const THEME_PALETTES = Object.freeze({
  rapidkeys: Object.freeze({
    name: 'RapidKeys',
    '--bg-color': '#0c0d11',
    '--main-color': '#079ecc',
    '--caret-color': '#079ecc',
    '--sub-color': '#4b5563',
    '--sub-alt-color': '#161822',
    '--text-color': '#e5e7eb',
    '--error-color': '#cb3439',
    '--error-extra-color': '#881e22'
  }),
  dracula: Object.freeze({
    name: 'Dracula',
    '--bg-color': '#282a36',
    '--main-color': '#bd93f9',
    '--caret-color': '#bd93f9',
    '--sub-color': '#6272a4',
    '--sub-alt-color': '#21222c',
    '--text-color': '#f8f8f2',
    '--error-color': '#ff5555',
    '--error-extra-color': '#ffb86c'
  }),
  nord: Object.freeze({
    name: 'Nord',
    '--bg-color': '#2e3440',
    '--main-color': '#88c0d0',
    '--caret-color': '#88c0d0',
    '--sub-color': '#4c566a',
    '--sub-alt-color': '#242933',
    '--text-color': '#eceff4',
    '--error-color': '#bf616a',
    '--error-extra-color': '#d08770'
  }),
  monokai: Object.freeze({
    name: 'Monokai',
    '--bg-color': '#272822',
    '--main-color': '#a6e22e',
    '--caret-color': '#a6e22e',
    '--sub-color': '#75715e',
    '--sub-alt-color': '#1e1f1c',
    '--text-color': '#f8f8f2',
    '--error-color': '#f92672',
    '--error-extra-color': '#fd971f'
  }),
  matrix: Object.freeze({
    name: 'Matrix',
    '--bg-color': '#0d1117',
    '--main-color': '#00ff66',
    '--caret-color': '#00ff66',
    '--sub-color': '#003b14',
    '--sub-alt-color': '#051d0d',
    '--text-color': '#00ff66',
    '--error-color': '#ff3333',
    '--error-extra-color': '#990000'
  }),
  carbon: Object.freeze({
    name: 'Carbon',
    '--bg-color': '#181818',
    '--main-color': '#f4f4f4',
    '--caret-color': '#f4f4f4',
    '--sub-color': '#666666',
    '--sub-alt-color': '#222222',
    '--text-color': '#f4f4f4',
    '--error-color': '#ff4444',
    '--error-extra-color': '#aa2222'
  })
});

/**
 * Currently active theme identifier.
 * @type {string}
 */
let activeTheme = DEFAULT_THEME;

/**
 * Event listeners for theme changes.
 * @type {Set<Function>}
 */
const themeListeners = new Set();

/**
 * Safely resolves document.documentElement across browser, window, or headless environments.
 * @returns {HTMLElement|null}
 */
function getDocumentElement() {
  if (typeof document !== 'undefined' && document.documentElement) {
    return document.documentElement;
  }
  if (typeof globalThis !== 'undefined' && globalThis.document?.documentElement) {
    return globalThis.document.documentElement;
  }
  if (typeof window !== 'undefined' && window.document?.documentElement) {
    return window.document.documentElement;
  }
  return null;
}

/**
 * Applies a theme by setting the data-theme attribute on document.documentElement
 * and updating CSS custom variables for the theme's color palette.
 *
 * @param {string} themeName Name of the preset theme to apply
 * @param {boolean} [persist=false] Whether to persist the theme choice to config
 * @returns {string} The applied theme name
 */
export function applyTheme(themeName, persist = false) {
  const normalized = (typeof themeName === 'string') ? themeName.trim().toLowerCase() : '';
  const selectedTheme = THEMES.includes(normalized) ? normalized : DEFAULT_THEME;

  activeTheme = selectedTheme;

  const docEl = getDocumentElement();
  if (docEl) {
    // Set attribute data-theme for CSS selector rules [data-theme="..."]
    if (typeof docEl.setAttribute === 'function') {
      docEl.setAttribute('data-theme', selectedTheme);
    }
    // Also set direct property and dataset for convenience and compatibility
    docEl['data-theme'] = selectedTheme;
    if (docEl.dataset) {
      docEl.dataset.theme = selectedTheme;
    }

    // Set CSS custom property values directly on style
    const palette = THEME_PALETTES[selectedTheme];
    if (palette && docEl.style) {
      Object.entries(palette).forEach(([prop, val]) => {
        if (prop.startsWith('--')) {
          if (typeof docEl.style.setProperty === 'function') {
            docEl.style.setProperty(prop, val);
          } else {
            docEl.style[prop] = val;
          }
        }
      });
    }
  }

  if (persist) {
    try {
      updateConfig({ theme: selectedTheme });
    } catch {
      // Ignore storage persistence failure
    }
  }

  // Notify listeners
  themeListeners.forEach(listener => {
    try {
      listener(selectedTheme);
    } catch {
      // Ignore listener error
    }
  });

  return selectedTheme;
}

/**
 * Returns a list of all available preset themes.
 * @returns {string[]}
 */
export function getAvailableThemes() {
  return [...THEMES];
}

/**
 * Returns the currently active theme name.
 * @returns {string}
 */
export function getCurrentTheme() {
  const docEl = getDocumentElement();
  if (docEl && typeof docEl.getAttribute === 'function') {
    const attr = docEl.getAttribute('data-theme');
    if (attr && THEMES.includes(attr.toLowerCase())) {
      return attr.toLowerCase();
    }
  }
  return activeTheme;
}

/**
 * Subscribes a listener function to be called whenever the theme changes.
 * @param {Function} listener Callback receiving the new theme name
 * @returns {Function} Unsubscribe function
 */
export function onThemeChange(listener) {
  if (typeof listener === 'function') {
    themeListeners.add(listener);
  }
  return () => {
    themeListeners.delete(listener);
  };
}

/**
 * Initializes the theme from stored configuration or default.
 * @returns {string}
 */
export function initTheme() {
  let themeToApply = DEFAULT_THEME;
  try {
    const config = getConfig();
    if (config?.theme && THEMES.includes(config.theme.toLowerCase())) {
      themeToApply = config.theme.toLowerCase();
    }
  } catch {
    // Config not yet initialized or inaccessible
  }
  return applyTheme(themeToApply);
}

/**
 * Returns module interface object for contract compatibility.
 */
export function getThemeEngineModule() {
  return {
    applyTheme,
    getAvailableThemes,
    getCurrentTheme,
    onThemeChange,
    initTheme,
    THEMES,
    DEFAULT_THEME,
    THEME_PALETTES
  };
}

