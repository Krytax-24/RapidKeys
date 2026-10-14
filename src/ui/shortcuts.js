/**
 * RapidKeys Keyboard Shortcuts, Focus Mode & Command Palette Controller
 *
 * Implements:
 * - Global keyboard shortcuts:
 *   - Tab + Enter: Quick test restart callback
 *   - Esc: Toggles Command Palette / Theme Switcher modal dialog
 * - Distraction-free focus mode:
 *   - Adds .is-typing class to document.body on first valid keypress
 *   - Removes class on blur, test completion, or restart
 * - Command palette modal:
 *   - Searchable themes and test modes
 *   - Keyboard navigation (Arrow Up/Down, Enter to select, Esc to close)
 */

import { getConfig, updateConfig } from '../config.js';
import { applyTheme, getAvailableThemes, THEME_PALETTES } from './theme-engine.js';

/**
 * Safely resolves document across browser, window, or headless environments.
 * @returns {Document|null}
 */
function getDocument() {
  if (typeof document !== 'undefined') return document;
  if (typeof globalThis !== 'undefined' && globalThis.document) return globalThis.document;
  if (typeof window !== 'undefined' && window.document) return window.document;
  return null;
}

/**
 * Safely resolves window across environments.
 * @returns {Window|null}
 */
function getWindow() {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined' && globalThis.window) return globalThis.window;
  return null;
}

/**
 * Enables distraction-free focus mode by adding .is-typing class to document.body.
 */
export function enableFocusMode() {
  const doc = getDocument();
  if (doc?.body) {
    doc.body.classList.add('is-typing');
  }
}

/**
 * Disables distraction-free focus mode by removing .is-typing class from document.body.
 */
export function disableFocusMode() {
  const doc = getDocument();
  if (doc?.body) {
    doc.body.classList.remove('is-typing');
  }
}

/**
 * Checks whether distraction-free focus mode is currently active.
 * @returns {boolean}
 */
export function isFocusMode() {
  const doc = getDocument();
  return Boolean(doc?.body?.classList.contains('is-typing'));
}

/**
 * List of available command palette items.
 * @returns {Array<Object>}
 */
export function getCommandList() {
  const themes = getAvailableThemes();
  const list = [];

  // 1. Preset Themes
  themes.forEach(themeKey => {
    const palette = THEME_PALETTES[themeKey];
    const name = palette?.name || themeKey;
    list.push({
      id: `theme-${themeKey}`,
      category: 'Themes',
      label: `Theme: ${name}`,
      searchText: `theme ${themeKey} ${name}`.toLowerCase(),
      type: 'theme',
      value: themeKey
    });
  });

  // 2. Time Modes
  [15, 30, 60, 120].forEach(seconds => {
    list.push({
      id: `mode-time-${seconds}`,
      category: 'Modes',
      label: `Time Mode: ${seconds} seconds`,
      searchText: `mode time ${seconds}s ${seconds}`.toLowerCase(),
      type: 'mode',
      mode: 'time',
      timeLimit: seconds
    });
  });

  // 3. Word Modes
  [10, 25, 50, 100].forEach(count => {
    list.push({
      id: `mode-words-${count}`,
      category: 'Modes',
      label: `Words Mode: ${count} words`,
      searchText: `mode words ${count}`.toLowerCase(),
      type: 'mode',
      mode: 'words',
      wordCount: count
    });
  });

  // 4. Modifiers / Toggles
  list.push({
    id: 'toggle-punctuation',
    category: 'Toggles',
    label: 'Toggle Punctuation',
    searchText: 'toggle punctuation commas periods quotes'.toLowerCase(),
    type: 'toggle',
    toggleKey: 'punctuation'
  });

  list.push({
    id: 'toggle-numbers',
    category: 'Toggles',
    label: 'Toggle Numbers',
    searchText: 'toggle numbers digits numeric 123'.toLowerCase(),
    type: 'toggle',
    toggleKey: 'numbers'
  });

  // 5. Actions
  list.push({
    id: 'action-restart',
    category: 'Actions',
    label: 'Restart Test',
    searchText: 'restart test tab enter reset fresh'.toLowerCase(),
    type: 'action',
    action: 'restart'
  });

  return list;
}

/**
 * State for the active command palette dialog.
 */
let commandPaletteState = {
  isOpen: false,
  modalEl: null,
  inputEl: null,
  listEl: null,
  query: '',
  filteredItems: [],
  selectedIndex: 0,
  onRestart: null,
  onConfigChange: null
};

/**
 * Resolves or mounts the command palette modal DOM.
 * @param {boolean} createIfMissing
 * @returns {HTMLElement|null}
 */
export function getCommandPaletteModal(createIfMissing = true) {
  const doc = getDocument();
  if (!doc) return null;

  let modal = doc.getElementById('commandPalette') || (doc.body ? doc.body.querySelector('#commandPalette') : null) || doc.querySelector('.command-palette');
  if (!modal && createIfMissing && doc.body) {
    modal = doc.createElement('div');
    modal.id = 'commandPalette';
    modal.className = 'modal hidden command-palette';
    doc.body.appendChild(modal);
  }

  if (modal && modal.children.length === 0 && createIfMissing) {
    // Backdrop
    const backdrop = doc.createElement('div');
    backdrop.className = 'command-palette-backdrop';
    backdrop.addEventListener('click', () => {
      closeCommandPalette();
    });
    modal.appendChild(backdrop);

    // Dialog container
    const dialog = doc.createElement('div');
    dialog.className = 'command-palette-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Command Palette');

    // Header with search input
    const header = doc.createElement('div');
    header.className = 'command-palette-header';

    const searchInput = doc.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'commandPaletteInput';
    searchInput.className = 'command-palette-input';
    searchInput.setAttribute('placeholder', 'Type a theme, mode, or action...');
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('spellcheck', 'false');

    header.appendChild(searchInput);
    dialog.appendChild(header);

    // Results container
    const results = doc.createElement('div');
    results.id = 'commandPaletteResults';
    results.className = 'command-palette-list';
    results.setAttribute('role', 'listbox');
    dialog.appendChild(results);

    modal.appendChild(dialog);
  }

  return modal;
}

/**
 * Resolves the primary typing input element.
 * @returns {HTMLInputElement|null}
 */
function getTypingInput() {
  const doc = getDocument();
  if (!doc) return null;
  return doc.getElementById('wordsInput') || (doc.body ? doc.body.querySelector('#wordsInput') : null) || doc.querySelector('.hidden-input') || doc.querySelector('input');
}

/**
 * Executes a selected command palette item.
 * @param {Object} item
 */
function executeCommandItem(item) {
  if (!item) return;

  if (item.type === 'theme') {
    applyTheme(item.value, true);
  } else if (item.type === 'mode') {
    if (item.mode === 'time') {
      updateConfig({ mode: 'time', timeLimit: item.timeLimit });
    } else if (item.mode === 'words') {
      updateConfig({ mode: 'words', wordCount: item.wordCount });
    }
  } else if (item.type === 'toggle') {
    const cur = getConfig();
    updateConfig({ [item.toggleKey]: !cur[item.toggleKey] });
  } else if (item.type === 'action' && item.action === 'restart') {
    if (typeof commandPaletteState.onRestart === 'function') {
      commandPaletteState.onRestart();
    }
  }

  if (typeof commandPaletteState.onConfigChange === 'function') {
    commandPaletteState.onConfigChange(getConfig());
  }

  closeCommandPalette();
}

/**
 * Renders filtered command items into the results list.
 */
function renderCommandList() {
  const doc = getDocument();
  const listEl = commandPaletteState.listEl;
  if (!doc || !listEl) return;

  listEl.innerHTML = '';
  const items = commandPaletteState.filteredItems;

  if (items.length === 0) {
    const emptyEl = doc.createElement('div');
    emptyEl.className = 'command-item-empty';
    emptyEl.textContent = 'No matching commands found';
    listEl.appendChild(emptyEl);
    return;
  }

  items.forEach((item, index) => {
    const itemEl = doc.createElement('div');
    itemEl.className = 'command-item' + (index === commandPaletteState.selectedIndex ? ' selected' : '');
    itemEl.setAttribute('role', 'option');
    itemEl.setAttribute('aria-selected', String(index === commandPaletteState.selectedIndex));
    itemEl.setAttribute('data-id', item.id);

    const labelSpan = doc.createElement('span');
    labelSpan.className = 'command-label';
    labelSpan.textContent = item.label;

    const catSpan = doc.createElement('span');
    catSpan.className = 'command-category';
    catSpan.textContent = item.category;

    itemEl.appendChild(labelSpan);
    itemEl.appendChild(catSpan);

    itemEl.addEventListener('click', () => {
      commandPaletteState.selectedIndex = index;
      executeCommandItem(item);
    });

    listEl.appendChild(itemEl);
  });
}

/**
 * Filters command list based on the search input query.
 * @param {string} query
 */
function filterCommands(query) {
  const allCommands = getCommandList();
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    commandPaletteState.filteredItems = allCommands;
  } else {
    commandPaletteState.filteredItems = allCommands.filter(cmd => {
      return cmd.searchText.includes(cleanQuery) || cmd.label.toLowerCase().includes(cleanQuery);
    });
  }

  commandPaletteState.selectedIndex = 0;
  renderCommandList();
}

/**
 * Opens the Command Palette modal and focuses the search input.
 */
export function openCommandPalette() {
  const modal = getCommandPaletteModal(true);
  if (!modal) return;

  commandPaletteState.isOpen = true;
  commandPaletteState.modalEl = modal;
  modal.classList.remove('hidden');

  const searchInput = modal.querySelector('#commandPaletteInput, input');
  const listEl = modal.querySelector('#commandPaletteResults, .command-palette-list');

  commandPaletteState.inputEl = searchInput;
  commandPaletteState.listEl = listEl;

  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = (e) => {
      filterCommands(e.target ? e.target.value : searchInput.value);
    };

    searchInput.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (commandPaletteState.filteredItems.length > 0) {
          commandPaletteState.selectedIndex = (commandPaletteState.selectedIndex + 1) % commandPaletteState.filteredItems.length;
          renderCommandList();
        }
      } else if (e.key === 'ArrowUp') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (commandPaletteState.filteredItems.length > 0) {
          commandPaletteState.selectedIndex = (commandPaletteState.selectedIndex - 1 + commandPaletteState.filteredItems.length) % commandPaletteState.filteredItems.length;
          renderCommandList();
        }
      } else if (e.key === 'Enter') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        const activeItem = commandPaletteState.filteredItems[commandPaletteState.selectedIndex];
        if (activeItem) {
          executeCommandItem(activeItem);
        }
      } else if (e.key === 'Escape') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        closeCommandPalette();
      }
    };

    if (typeof searchInput.focus === 'function') {
      searchInput.focus();
    }
  }

  filterCommands('');
}

/**
 * Closes the Command Palette modal and refocuses the typing input.
 */
export function closeCommandPalette() {
  const modal = getCommandPaletteModal(false);
  commandPaletteState.isOpen = false;

  if (modal) {
    modal.classList.add('hidden');
  }

  const typingInput = getTypingInput();
  if (typingInput && typeof typingInput.focus === 'function') {
    typingInput.focus();
  }
}

/**
 * Toggles the Command Palette modal between open and closed.
 */
export function toggleCommandPalette() {
  const modal = getCommandPaletteModal(false);
  if (modal && !modal.classList.contains('hidden')) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

/**
 * Checks whether a keyboard event represents a valid printable or correction typing keystroke.
 * Excludes modifiers, navigation keys, function keys, and shortcut keys.
 *
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
function isTypingKey(e) {
  if (!e || typeof e.key !== 'string') return false;
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (['Tab', 'Escape', 'Enter'].includes(e.key)) return false;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return false;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) return false;
  if (/^F\d{1,2}$/.test(e.key)) return false;

  return e.key.length === 1 || e.key === 'Backspace';
}

/**
 * Initializes global keyboard shortcuts, distraction-free focus mode, and command palette.
 *
 * @param {Object} options
 * @param {() => void} [options.onRestart] Callback invoked when Tab + Enter is triggered
 * @param {() => void} [options.onCommandPalette] Custom callback invoked when Esc is pressed
 * @param {() => void} [options.onBlurRefocus] Callback invoked when focus overlay is clicked
 * @param {(config: Object) => void} [options.onConfigChange] Callback invoked when config changes via palette
 * @param {HTMLInputElement} [options.inputElement] The hidden typing input element
 * @returns {() => void} Cleanup function removing all registered event listeners
 */
export function initShortcuts(options = {}) {
  const {
    onRestart,
    onCommandPalette,
    onBlurRefocus,
    onConfigChange,
    inputElement
  } = options;

  commandPaletteState.onRestart = onRestart;
  commandPaletteState.onConfigChange = onConfigChange;

  let tabPending = false;
  let tabTimer = null;
  let lastRestartTime = 0;

  const win = getWindow();
  const doc = getDocument();
  const typingInput = inputElement || getTypingInput();

  /**
   * Triggers test restart safely with debouncing to prevent race conditions.
   */
  const triggerRestart = () => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastRestartTime < 100) return;
    lastRestartTime = now;

    disableFocusMode();
    if (typeof onRestart === 'function') {
      onRestart();
    }
  };

  const handledEvents = new WeakSet();

  /**
   * Main keyboard event handler.
   * @param {KeyboardEvent} e
   */
  const handleKeyDown = (e) => {
    if (!e || !e.key) return;
    if (typeof e === 'object' && e !== null) {
      if (handledEvents.has(e)) return;
      handledEvents.add(e);
    }

    // 1. Tab keypress: sets pending state for Tab + Enter combo
    if (e.key === 'Tab') {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      tabPending = true;
      if (tabTimer) clearTimeout(tabTimer);
      tabTimer = setTimeout(() => {
        tabPending = false;
      }, 1000);
      return;
    }

    // 2. Enter keypress: checks if Tab was hit prior
    if (e.key === 'Enter') {
      if (tabPending) {
        tabPending = false;
        if (tabTimer) clearTimeout(tabTimer);
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        triggerRestart();
        return;
      }
    }

    // If another non-modifier key is pressed, invalidate pending Tab
    if (tabPending && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      tabPending = false;
      if (tabTimer) clearTimeout(tabTimer);
    }

    // 3. Escape keypress: toggles Command Palette
    if (e.key === 'Escape') {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      toggleCommandPalette();
      if (typeof onCommandPalette === 'function') {
        onCommandPalette();
      }
      return;
    }

    // 4. Distraction-free focus mode on first valid keystroke
    if (isTypingKey(e)) {
      enableFocusMode();
    }
  };

  // Blur handler to disable focus mode
  const handleBlur = () => {
    disableFocusMode();
  };

  // Attach keydown listener to window and document
  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('keydown', handleKeyDown);
  }
  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('keydown', handleKeyDown);
  }

  // Attach blur and typing keydown to typing input if available
  if (typingInput && typeof typingInput.addEventListener === 'function') {
    typingInput.addEventListener('keydown', handleKeyDown);
    typingInput.addEventListener('blur', handleBlur);
  }

  // Refocus overlay handling
  const overlay = doc?.getElementById('focusOverlay');
  if (overlay && typeof overlay.addEventListener === 'function') {
    const handleOverlayClick = () => {
      if (typingInput && typeof typingInput.focus === 'function') {
        typingInput.focus();
      }
      if (typeof onBlurRefocus === 'function') {
        onBlurRefocus();
      }
    };
    overlay.addEventListener('click', handleOverlayClick);
  }

  // Return comprehensive cleanup function
  return () => {
    if (tabTimer) clearTimeout(tabTimer);

    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('keydown', handleKeyDown);
    }
    if (doc && typeof doc.removeEventListener === 'function') {
      doc.removeEventListener('keydown', handleKeyDown);
    }
    if (typingInput && typeof typingInput.removeEventListener === 'function') {
      typingInput.removeEventListener('keydown', handleKeyDown);
      typingInput.removeEventListener('blur', handleBlur);
    }
  };
}
