/**
 * RapidKeys Navigation & Test Mode Controls Bar
 *
 * Renders the top control bar allowing users to configure:
 * - Test mode (Time vs Words)
 * - Time limits (15s, 30s, 60s, 120s)
 * - Word counts (10, 25, 50, 100)
 * - Modifiers: Punctuation and Numbers toggles
 *
 * Persists all configuration changes through src/config.js.
 */

import { getConfig, updateConfig, VALID_TIME_LIMITS, VALID_WORD_COUNTS } from '../config.js';

/**
 * Creates an accessible button element with appropriate classes and attributes.
 *
 * @param {Object} options
 * @param {string} options.text Button label
 * @param {string} [options.className] CSS class list
 * @param {string} [options.id] Element ID
 * @param {Record<string, string>} [options.dataset] Data attributes
 * @param {Record<string, string>} [options.attributes] Arbitrary attributes
 * @param {(e: Event) => void} [options.onClick] Click handler
 * @returns {HTMLButtonElement}
 */
function createButton({ text, className = '', id = '', dataset = {}, attributes = {}, onClick }) {
  const doc = typeof document !== 'undefined' ? document : globalThis.document;
  const btn = doc.createElement('button');
  btn.type = 'button';
  if (id) btn.id = id;
  if (className) btn.className = className;
  btn.textContent = text;

  Object.entries(dataset).forEach(([key, val]) => {
    btn.setAttribute(`data-${key}`, String(val));
    if (btn.dataset) btn.dataset[key] = String(val);
  });

  Object.entries(attributes).forEach(([key, val]) => {
    btn.setAttribute(key, String(val));
  });

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}

/**
 * Updates visual active classes and ARIA attributes across all buttons in the nav-bar.
 *
 * @param {HTMLElement} navEl The nav-bar root element
 * @param {Object} config The active configuration object
 */
export function updateNavBarActiveState(navEl, config) {
  if (!navEl || !config) return;

  // 1. Toggles (punctuation & numbers)
  const punctBtn = navEl.querySelector('[data-toggle="punctuation"]');
  if (punctBtn) {
    const isPunctActive = Boolean(config.punctuation);
    punctBtn.classList.toggle('active', isPunctActive);
    punctBtn.setAttribute('aria-pressed', String(isPunctActive));
  }

  const numBtn = navEl.querySelector('[data-toggle="numbers"]');
  if (numBtn) {
    const isNumActive = Boolean(config.numbers);
    numBtn.classList.toggle('active', isNumActive);
    numBtn.setAttribute('aria-pressed', String(isNumActive));
  }

  // 2. Mode buttons (time vs words)
  const isTimeMode = config.mode === 'time';
  const isWordsMode = config.mode === 'words';

  const timeModeBtn = navEl.querySelector('[data-mode="time"]');
  if (timeModeBtn) {
    timeModeBtn.classList.toggle('active', isTimeMode);
    timeModeBtn.setAttribute('aria-pressed', String(isTimeMode));
  }

  const wordsModeBtn = navEl.querySelector('[data-mode="words"]');
  if (wordsModeBtn) {
    wordsModeBtn.classList.toggle('active', isWordsMode);
    wordsModeBtn.setAttribute('aria-pressed', String(isWordsMode));
  }

  // 3. Sub-mode limits groups visibility
  const timeGroup = navEl.querySelector('.time-limits-group');
  const wordsGroup = navEl.querySelector('.words-limits-group');

  if (timeGroup) {
    if (isTimeMode) {
      timeGroup.classList.remove('hidden');
    } else {
      timeGroup.classList.add('hidden');
    }
  }

  if (wordsGroup) {
    if (isWordsMode) {
      wordsGroup.classList.remove('hidden');
    } else {
      wordsGroup.classList.add('hidden');
    }
  }

  // 4. Time limit buttons (15s, 30s, 60s, 120s)
  const timeButtons = navEl.querySelectorAll('.time-btn, [data-time]');
  timeButtons.forEach(btn => {
    const timeVal = Number(btn.getAttribute('data-time') || btn.getAttribute('data-value'));
    const isTarget = isTimeMode && timeVal === Number(config.timeLimit);
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-pressed', String(isTarget));
  });

  // 5. Word count buttons (10, 25, 50, 100)
  const wordButtons = navEl.querySelectorAll('.word-btn, [data-words]');
  wordButtons.forEach(btn => {
    const wordVal = Number(btn.getAttribute('data-words') || btn.getAttribute('data-value'));
    const isTarget = isWordsMode && wordVal === Number(config.wordCount);
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-pressed', String(isTarget));
  });
}

/**
 * Renders the RapidKeys navigation and mode selector bar into the specified container.
 *
 * @param {HTMLElement} container Parent DOM element to mount the navigation bar into
 * @param {Object} [currentConfig] Optional initial configuration; falls back to getConfig()
 * @param {(newConfig: Object) => void} [onConfigChange] Callback invoked whenever configuration updates
 * @returns {HTMLElement} The rendered navigation bar element
 */
export function renderNavBar(container, currentConfig, onConfigChange = () => {}) {
  const doc = typeof document !== 'undefined' ? document : globalThis.document;
  if (!container) {
    throw new Error('renderNavBar: container element must be provided');
  }

  // Resolve current active configuration
  let activeConfig = {
    ...getConfig(),
    ...(currentConfig || {})
  };

  // If container already contains an existing nav-bar, remove it
  const existingNav = container.querySelector('#navBar, .nav-bar');
  if (existingNav) {
    existingNav.remove();
  }

  const nav = doc.createElement('nav');
  nav.id = 'navBar';
  nav.className = 'nav-bar';
  nav.setAttribute('role', 'toolbar');
  nav.setAttribute('aria-label', 'Test configuration controls');

  /**
   * Dispatches a configuration change: updates config.js, refreshes active states, and calls listener.
   * @param {Object} partial
   */
  const handleConfigChange = (partial) => {
    const updated = updateConfig(partial);
    activeConfig = updated;
    updateNavBarActiveState(nav, activeConfig);
    if (typeof onConfigChange === 'function') {
      onConfigChange(activeConfig);
    }
  };

  // -------------------------------------------------------------
  // Group 1: Modifiers (Punctuation and Numbers)
  // -------------------------------------------------------------
  const togglesGroup = doc.createElement('div');
  togglesGroup.className = 'nav-group nav-group-toggles';
  togglesGroup.setAttribute('data-group', 'toggles');

  const punctuationBtn = createButton({
    text: 'punctuation',
    className: 'nav-btn toggle-btn punctuation-toggle',
    dataset: { toggle: 'punctuation' },
    attributes: { 'aria-label': 'Toggle punctuation injection' },
    onClick: () => {
      handleConfigChange({ punctuation: !activeConfig.punctuation });
    }
  });

  const numbersBtn = createButton({
    text: 'numbers',
    className: 'nav-btn toggle-btn numbers-toggle',
    dataset: { toggle: 'numbers' },
    attributes: { 'aria-label': 'Toggle numbers injection' },
    onClick: () => {
      handleConfigChange({ numbers: !activeConfig.numbers });
    }
  });

  togglesGroup.appendChild(punctuationBtn);
  togglesGroup.appendChild(numbersBtn);

  // Divider 1
  const divider1 = doc.createElement('div');
  divider1.className = 'nav-divider';
  divider1.setAttribute('aria-hidden', 'true');

  // -------------------------------------------------------------
  // Group 2: Mode Selector (Time vs Words)
  // -------------------------------------------------------------
  const modesGroup = doc.createElement('div');
  modesGroup.className = 'nav-group nav-group-modes';
  modesGroup.setAttribute('data-group', 'modes');

  const timeModeBtn = createButton({
    text: 'time',
    className: 'nav-btn mode-btn time-mode-btn',
    dataset: { mode: 'time' },
    attributes: { 'aria-label': 'Time countdown mode' },
    onClick: () => {
      handleConfigChange({ mode: 'time' });
    }
  });

  const wordsModeBtn = createButton({
    text: 'words',
    className: 'nav-btn mode-btn words-mode-btn',
    dataset: { mode: 'words' },
    attributes: { 'aria-label': 'Word target mode' },
    onClick: () => {
      handleConfigChange({ mode: 'words' });
    }
  });

  modesGroup.appendChild(timeModeBtn);
  modesGroup.appendChild(wordsModeBtn);

  // Divider 2
  const divider2 = doc.createElement('div');
  divider2.className = 'nav-divider';
  divider2.setAttribute('aria-hidden', 'true');

  // -------------------------------------------------------------
  // Group 3A: Time Mode Sub-Limits (15s, 30s, 60s, 120s)
  // -------------------------------------------------------------
  const timeLimitsGroup = doc.createElement('div');
  timeLimitsGroup.className = 'nav-group nav-group-limits time-limits-group';
  timeLimitsGroup.setAttribute('data-group', 'time-limits');

  VALID_TIME_LIMITS.forEach(duration => {
    const timeBtn = createButton({
      text: `${duration}s`,
      className: `nav-btn time-btn btn-time-${duration}`,
      dataset: { time: String(duration), value: String(duration) },
      attributes: { 'aria-label': `${duration} seconds time limit` },
      onClick: () => {
        handleConfigChange({ mode: 'time', timeLimit: duration });
      }
    });
    timeLimitsGroup.appendChild(timeBtn);
  });

  // -------------------------------------------------------------
  // Group 3B: Word Count Sub-Limits (10, 25, 50, 100)
  // -------------------------------------------------------------
  const wordsLimitsGroup = doc.createElement('div');
  wordsLimitsGroup.className = 'nav-group nav-group-limits words-limits-group';
  wordsLimitsGroup.setAttribute('data-group', 'words-limits');

  VALID_WORD_COUNTS.forEach(count => {
    const wordBtn = createButton({
      text: String(count),
      className: `nav-btn word-btn btn-words-${count}`,
      dataset: { words: String(count), value: String(count) },
      attributes: { 'aria-label': `${count} words target limit` },
      onClick: () => {
        handleConfigChange({ mode: 'words', wordCount: count });
      }
    });
    wordsLimitsGroup.appendChild(wordBtn);
  });

  // Assemble navigation bar hierarchy
  nav.appendChild(togglesGroup);
  nav.appendChild(divider1);
  nav.appendChild(modesGroup);
  nav.appendChild(divider2);
  nav.appendChild(timeLimitsGroup);
  nav.appendChild(wordsLimitsGroup);

  // Apply initial active states
  updateNavBarActiveState(nav, activeConfig);

  // Expose an imperative helper on the element for convenience
  nav.updateActiveState = (config) => {
    activeConfig = { ...activeConfig, ...config };
    updateNavBarActiveState(nav, activeConfig);
  };

  container.appendChild(nav);
  return nav;
}
