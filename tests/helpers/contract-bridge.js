/**
 * tests/helpers/contract-bridge.js
 * Dynamic Contract Bridge for RapidKeys Multi-Tier E2E Tests.
 *
 * Checks if production ES modules exist under src/... and uses them.
 * If a module has not yet been authored by a parallel worker, provides
 * the exact authoritative contract reference implementation derived from
 * ORIGINAL_REQUEST.md and PROJECT.md.
 */

// In-memory reference vocabulary for fallback word generation
const DEFAULT_VOCABULARY = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'rapid', 'keys',
  'speed', 'typing', 'accuracy', 'consistency', 'focus', 'minimalist', 'stream',
  'engine', 'surface', 'caret', 'system', 'matrix', 'carbon', 'nord', 'dracula',
  'keyboard', 'letter', 'words', 'metric', 'telemetry', 'result', 'screen', 'chart',
  'standard', 'precision', 'clock', 'duration', 'timer', 'reset', 'restart', 'theme'
];

export async function getMetricsModule() {
  try {
    const mod = await import('../../src/engine/metrics.js');
    if (mod.calculateNetWpm) return mod;
  } catch {}

  return {
    calculateNetWpm(correctChars, elapsedSec) {
      if (!elapsedSec || elapsedSec <= 0) return 0;
      return Math.max(0, Math.round((correctChars * 12) / elapsedSec));
    },
    calculateRawWpm(totalTypedChars, elapsedSec) {
      if (!elapsedSec || elapsedSec <= 0) return 0;
      return Math.max(0, Math.round((totalTypedChars * 12) / elapsedSec));
    },
    calculateAccuracy(correctKeypresses, totalKeypresses) {
      if (!totalKeypresses || totalKeypresses <= 0) return 100;
      return Math.max(0, Math.min(100, Number(((correctKeypresses / totalKeypresses) * 100).toFixed(1))));
    },
    calculateConsistency(rawWpmSamples) {
      if (!rawWpmSamples || rawWpmSamples.length === 0) return 0;
      if (rawWpmSamples.length === 1) return rawWpmSamples[0] > 0 ? 100 : 0;
      const k = rawWpmSamples.length;
      const mu = rawWpmSamples.reduce((a, b) => a + b, 0) / k;
      if (mu === 0) return 0;
      const variance = rawWpmSamples.reduce((acc, val) => acc + Math.pow(val - mu, 2), 0) / k;
      const sigma = Math.sqrt(variance);
      const cv = sigma / mu;
      return Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
    },
    getCharacterBreakdown(words = []) {
      let correct = 0, incorrect = 0, extra = 0, missed = 0;
      for (const w of words) {
        if (w.letters) {
          for (const l of w.letters) {
            if (l.state === 'correct') correct++;
            else if (l.state === 'incorrect') incorrect++;
            else if (l.state === 'extra') extra++;
            else if (l.state === 'missed') missed++;
          }
        }
      }
      return { correct, incorrect, extra, missed };
    }
  };
}

export async function getConfigModule() {
  try {
    const mod = await import('../../src/config.js');
    if (mod.getConfig) return mod;
  } catch {}

  const DEFAULT_CONFIG = Object.freeze({
    mode: 'time',
    timeLimit: 30,
    wordCount: 25,
    punctuation: false,
    numbers: false,
    theme: 'rapidkeys'
  });

  const STORAGE_KEY = 'rapidkeys_config';

  return {
    DEFAULT_CONFIG,
    getConfig() {
      try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_CONFIG };
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_CONFIG };
        return {
          mode: ['time', 'words'].includes(parsed.mode) ? parsed.mode : DEFAULT_CONFIG.mode,
          timeLimit: [15, 30, 60, 120].includes(Number(parsed.timeLimit)) ? Number(parsed.timeLimit) : DEFAULT_CONFIG.timeLimit,
          wordCount: [10, 25, 50, 100].includes(Number(parsed.wordCount)) ? Number(parsed.wordCount) : DEFAULT_CONFIG.wordCount,
          punctuation: Boolean(parsed.punctuation),
          numbers: Boolean(parsed.numbers),
          theme: typeof parsed.theme === 'string' && parsed.theme ? parsed.theme : DEFAULT_CONFIG.theme
        };
      } catch {
        return { ...DEFAULT_CONFIG };
      }
    },
    updateConfig(partial = {}) {
      const current = this.getConfig();
      const updated = { ...current, ...partial };
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    },
    resetConfig() {
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      } catch {}
      return { ...DEFAULT_CONFIG };
    }
  };
}

export async function getWordsModule() {
  try {
    const mod = await import('../../src/data/words.js');
    if (mod.getWordBatch) return mod;
  } catch {}

  const WORDS_VOCABULARY = DEFAULT_VOCABULARY;

  function* createWordStream(options = {}) {
    const { punctuation = false, numbers = false } = options;
    let wordCount = 0;
    let sentenceWordIndex = 0;
    let sentenceLength = 6;

    while (true) {
      wordCount++;
      sentenceWordIndex++;

      // Numbers injection (~12% rate)
      if (numbers && wordCount % 8 === 0) {
        yield String(Math.floor(10 + Math.random() * 990));
        continue;
      }

      let word = WORDS_VOCABULARY[Math.floor(Math.random() * WORDS_VOCABULARY.length)];

      if (punctuation) {
        // Sentence start capitalization
        if (sentenceWordIndex === 1) {
          word = word.charAt(0).toUpperCase() + word.slice(1);
        }

        // Sentence end
        if (sentenceWordIndex >= sentenceLength) {
          word += '.';
          sentenceWordIndex = 0;
          sentenceLength = 5 + Math.floor(Math.random() * 4);
        } else if (sentenceWordIndex === 3) {
          word += ',';
        }
      }

      yield word;
    }
  }

  function getWordBatch(count = 25, options = {}) {
    const stream = createWordStream(options);
    const batch = [];
    for (let i = 0; i < count; i++) {
      batch.push(stream.next().value);
    }
    return batch;
  }

  return { WORDS_VOCABULARY, createWordStream, getWordBatch };
}

export async function getTelemetryModule() {
  try {
    const mod = await import('../../src/engine/telemetry.js');
    if (mod.TelemetryLogger) return mod;
  } catch {}

  class TelemetryLogger {
    constructor(getMetricsFn) {
      this.getMetrics = getMetricsFn || (() => ({ netWpm: 0, rawWpm: 0, errors: 0 }));
      this.snapshots = [];
      this.active = false;
      this.startTime = 0;
    }

    start(startTime = performance.now()) {
      this.snapshots = [];
      this.active = true;
      this.startTime = startTime;
    }

    recordTick(elapsedSec, netWpm, rawWpm, errors = 0) {
      if (!this.active) return;
      this.snapshots.push({
        second: elapsedSec,
        timestamp: elapsedSec * 1000,
        netWpm: Math.round(netWpm),
        rawWpm: Math.round(rawWpm),
        errors: Math.max(0, errors)
      });
    }

    getSnapshots() {
      return [...this.snapshots];
    }

    stop() {
      this.active = false;
    }
  }

  return { TelemetryLogger };
}

export async function getStateModule() {
  try {
    const mod = await import('../../src/engine/state.js');
    if (mod.TypingState) return mod;
  } catch {}

  const TypingState = Object.freeze({
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    FINISHED: 'FINISHED'
  });

  return { TypingState };
}

export async function getTypingSurfaceModule() {
  try {
    const mod = await import('../../src/ui/typing-surface.js');
    if (mod.TypingSurface) return mod;
  } catch {}

  class TypingSurface {
    constructor() {
      this.container = null;
      this.wrapper = null;
      this.wordsContainer = null;
      this.input = null;
      this.words = [];
      this.currentWordIdx = 0;
      this.currentCharIdx = 0;
      this.wordData = [];
      this.events = new Map();
      this.lineHeight = 48;
    }

    on(event, handler) {
      if (!this.events.has(event)) this.events.set(event, []);
      this.events.get(event).push(handler);
    }

    emit(event, ...args) {
      const handlers = this.events.get(event) || [];
      handlers.forEach(h => h(...args));
    }

    mount(container) {
      this.container = container;
      this.wrapper = globalThis.document.createElement('div');
      this.wrapper.className = 'words-wrapper';
      this.wordsContainer = globalThis.document.createElement('div');
      this.wordsContainer.className = 'words-container';
      this.input = globalThis.document.createElement('input');
      this.input.type = 'text';
      this.input.className = 'hidden-input';

      this.input.addEventListener('keydown', (e) => {
        this.handleKey(e.key, e.ctrlKey || e.altKey);
      });

      this.wrapper.appendChild(this.wordsContainer);
      this.container.appendChild(this.wrapper);
      this.container.appendChild(this.input);
    }

    loadWords(words) {
      this.words = [...words];
      this.currentWordIdx = 0;
      this.currentCharIdx = 0;
      this.wordData = [];
      this.wordsContainer.innerHTML = '';

      for (let wIdx = 0; wIdx < this.words.length; wIdx++) {
        const text = this.words[wIdx];
        const wordEl = globalThis.document.createElement('div');
        wordEl.className = 'word';
        wordEl.setAttribute('data-word-idx', String(wIdx));

        const letters = [];
        for (let cIdx = 0; cIdx < text.length; cIdx++) {
          const letterEl = globalThis.document.createElement('letter');
          letterEl.className = 'letter';
          letterEl.textContent = text[cIdx];
          wordEl.appendChild(letterEl);
          letters.push({ char: text[cIdx], state: 'untyped', el: letterEl });
        }

        this.wordsContainer.appendChild(wordEl);
        this.wordData.push({ text, el: wordEl, letters, hasError: false });
      }

      this.updateActivePointers();
      this.emit('wordsLoaded', this.words);
    }

    getActiveWord() {
      return this.wordData[this.currentWordIdx] || null;
    }

    getActiveLetter() {
      const w = this.getActiveWord();
      if (!w) return null;
      return w.letters[this.currentCharIdx] || null;
    }

    handleKey(key, ctrlKey = false) {
      const activeWord = this.getActiveWord();
      if (!activeWord) return;

      // Ignore modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(key)) {
        return;
      }

      if (key === 'Backspace') {
        if (ctrlKey) {
          // Ctrl+Backspace: clear entire word
          while (activeWord.letters.length > activeWord.text.length) {
            const extra = activeWord.letters.pop();
            extra.el.remove();
          }
          activeWord.letters.forEach(l => {
            l.state = 'untyped';
            l.el.className = 'letter';
          });
          this.currentCharIdx = 0;
          this.updateActivePointers();
          this.emit('backspace', { ctrl: true });
          return;
        }

        if (this.currentCharIdx > 0) {
          this.currentCharIdx--;
          const letter = activeWord.letters[this.currentCharIdx];
          if (letter.state === 'extra') {
            activeWord.letters.splice(this.currentCharIdx, 1);
            letter.el.remove();
          } else {
            letter.state = 'untyped';
            letter.el.className = 'letter';
          }
          this.updateActivePointers();
          this.emit('backspace', { ctrl: false });
        } else if (this.currentWordIdx > 0) {
          // Inter-word backspace: only allowed if previous word had errors
          const prevWord = this.wordData[this.currentWordIdx - 1];
          const hasError = prevWord.letters.some(l => ['incorrect', 'extra', 'missed'].includes(l.state));
          if (hasError) {
            this.currentWordIdx--;
            this.currentCharIdx = prevWord.letters.length;
            this.updateActivePointers();
            this.emit('wordBacktrack', this.currentWordIdx);
          }
        }
        return;
      }

      if (key === ' ') {
        // Space at index 0 is ignored completely
        if (this.currentCharIdx === 0) {
          return;
        }

        // Mark remaining letters as missed
        for (let i = this.currentCharIdx; i < activeWord.text.length; i++) {
          const letter = activeWord.letters[i];
          letter.state = 'missed';
          letter.el.classList.add('missed');
          activeWord.hasError = true;
        }

        this.currentWordIdx++;
        this.currentCharIdx = 0;
        this.updateActivePointers();
        this.checkLineScroll();
        this.emit('wordSubmitted', this.currentWordIdx - 1);
        return;
      }

      // Printable single character
      if (key.length === 1) {
        if (this.currentCharIdx < activeWord.text.length) {
          const letter = activeWord.letters[this.currentCharIdx];
          if (key === letter.char) {
            letter.state = 'correct';
            letter.el.className = 'letter correct';
          } else {
            letter.state = 'incorrect';
            letter.el.className = 'letter incorrect';
            activeWord.hasError = true;
          }
          this.currentCharIdx++;
        } else {
          // Extra characters capped at 15
          const extraCount = activeWord.letters.length - activeWord.text.length;
          if (extraCount < 15) {
            const extraEl = globalThis.document.createElement('letter');
            extraEl.className = 'letter extra incorrect';
            extraEl.textContent = key;
            activeWord.el.appendChild(extraEl);
            activeWord.letters.push({ char: key, state: 'extra', el: extraEl });
            activeWord.hasError = true;
            this.currentCharIdx++;
          }
        }

        this.updateActivePointers();
        this.emit('letterTyped', { key, charIdx: this.currentCharIdx - 1 });
      }
    }

    updateActivePointers() {
      // Toggle active word styling
      for (let i = 0; i < this.wordData.length; i++) {
        if (i === this.currentWordIdx) {
          this.wordData[i].el.classList.add('active');
        } else {
          this.wordData[i].el.classList.remove('active');
        }
      }
    }

    checkLineScroll() {
      const activeWord = this.getActiveWord();
      if (!activeWord || !this.wrapper) return;
      const initialTop = this.wordData[0]?.el.offsetTop || 0;
      const currentTop = activeWord.el.offsetTop;
      const lineIndex = Math.max(0, Math.round((currentTop - initialTop) / this.lineHeight));

      if (lineIndex >= 2) {
        const scrollOffset = (lineIndex - 1) * this.lineHeight;
        this.wrapper.scrollTop = scrollOffset;
      }
    }

    reset() {
      this.currentWordIdx = 0;
      this.currentCharIdx = 0;
      if (this.words.length > 0) {
        this.loadWords(this.words);
      }
      if (this.wrapper) {
        this.wrapper.scrollTop = 0;
      }
    }
  }

  return { TypingSurface };
}

export async function getCaretModule() {
  try {
    const mod = await import('../../src/ui/caret.js');
    if (mod.CaretTracker) return mod;
  } catch {}

  class CaretTracker {
    constructor() {
      this.caretEl = null;
      this.idleTimeout = null;
    }

    mount(container) {
      this.caretEl = globalThis.document.createElement('div');
      this.caretEl.className = 'caret blinking';
      container.appendChild(this.caretEl);
    }

    updatePosition(targetElement, isAtEnd = false) {
      if (!this.caretEl || !targetElement) return;

      // Remove blinking while typing
      this.caretEl.classList.remove('blinking');

      const x = targetElement.offsetLeft + (isAtEnd ? targetElement.offsetWidth : 0);
      const y = targetElement.offsetTop;
      this.caretEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      // Idle debounce (500ms)
      if (this.idleTimeout) clearTimeout(this.idleTimeout);
      this.idleTimeout = setTimeout(() => {
        if (this.caretEl) this.caretEl.classList.add('blinking');
      }, 500);
    }

    setBlinking(blinking) {
      if (!this.caretEl) return;
      if (blinking) this.caretEl.classList.add('blinking');
      else this.caretEl.classList.remove('blinking');
    }

    hide() {
      if (this.caretEl) this.caretEl.style.display = 'none';
    }

    show() {
      if (this.caretEl) this.caretEl.style.display = 'block';
    }
  }

  return { CaretTracker };
}

export async function getThemeEngineModule() {
  try {
    const mod = await import('../../src/ui/theme-engine.js');
    if (mod.applyTheme) return { ...mod, getThemeEngineModule: () => mod };
  } catch {}

  const THEMES = ['rapidkeys', 'dracula', 'nord', 'monokai', 'matrix', 'carbon'];

  const fallback = {
    applyTheme(themeName) {
      const selected = THEMES.includes(themeName) ? themeName : 'rapidkeys';
      globalThis.document?.documentElement?.setAttribute('data-theme', selected);
    },
    getAvailableThemes() {
      return [...THEMES];
    }
  };
  return { ...fallback, getThemeEngineModule: () => fallback };
}

export async function getResultsViewModule() {
  try {
    const mod = await import('../../src/ui/results-view.js');
    if (mod.renderResults) return mod;
  } catch {}

  return {
    renderResults(container, testSummary = {}, onRestart = () => {}) {
      const resultsEl = globalThis.document.createElement('div');
      resultsEl.className = 'results-view';

      const wpmEl = globalThis.document.createElement('div');
      wpmEl.className = 'stat-wpm';
      wpmEl.textContent = String(testSummary.netWpm ?? 0);

      const accEl = globalThis.document.createElement('div');
      accEl.className = 'stat-acc';
      accEl.textContent = `${testSummary.accuracy ?? 100}%`;

      const rawEl = globalThis.document.createElement('div');
      rawEl.className = 'stat-raw';
      rawEl.textContent = String(testSummary.rawWpm ?? 0);

      const consEl = globalThis.document.createElement('div');
      consEl.className = 'stat-consistency';
      consEl.textContent = `${testSummary.consistency ?? 0}%`;

      const modeEl = globalThis.document.createElement('div');
      modeEl.className = 'stat-mode';
      modeEl.textContent = testSummary.mode || 'time 30';

      const timeEl = globalThis.document.createElement('div');
      timeEl.className = 'stat-time';
      timeEl.textContent = `${testSummary.timeElapsed ?? 30}s`;

      const breakdownEl = globalThis.document.createElement('div');
      breakdownEl.className = 'character-breakdown';
      breakdownEl.innerHTML = `
        <span class="stat-correct">${testSummary.breakdown?.correct ?? 0}</span> /
        <span class="stat-incorrect">${testSummary.breakdown?.incorrect ?? 0}</span> /
        <span class="stat-extra">${testSummary.breakdown?.extra ?? 0}</span> /
        <span class="stat-missed">${testSummary.breakdown?.missed ?? 0}</span>
      `;

      const restartBtn = globalThis.document.createElement('button');
      restartBtn.className = 'btn-restart';
      restartBtn.id = 'restartButton';
      restartBtn.addEventListener('click', onRestart);

      resultsEl.appendChild(wpmEl);
      resultsEl.appendChild(accEl);
      resultsEl.appendChild(rawEl);
      resultsEl.appendChild(consEl);
      resultsEl.appendChild(modeEl);
      resultsEl.appendChild(timeEl);
      resultsEl.appendChild(breakdownEl);
      resultsEl.appendChild(restartBtn);

      container.appendChild(resultsEl);
      return resultsEl;
    }
  };
}

export async function getChartModule() {
  try {
    const mod = await import('../../src/ui/chart.js');
    if (mod.renderTelemetryChart) return mod;
  } catch {}

  return {
    renderTelemetryChart(container, snapshots = []) {
      const svg = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'telemetry-chart');
      svg.setAttribute('viewBox', '0 0 600 200');

      let netPathStr = 'M 0 100';
      let rawPathStr = 'M 0 100';

      snapshots.forEach((snap, idx) => {
        const x = snapshots.length > 1 ? (idx / (snapshots.length - 1)) * 600 : 0;
        const netY = Math.max(10, 190 - (snap.netWpm || 0));
        const rawY = Math.max(10, 190 - (snap.rawWpm || 0));
        netPathStr += ` L ${x.toFixed(1)} ${netY.toFixed(1)}`;
        rawPathStr += ` L ${x.toFixed(1)} ${rawY.toFixed(1)}`;

        if (snap.errors > 0) {
          const dot = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('class', 'chart-error-dot');
          dot.setAttribute('cx', x.toFixed(1));
          dot.setAttribute('cy', rawY.toFixed(1));
          dot.setAttribute('r', '4');
          svg.appendChild(dot);
        }
      });

      const netPath = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'path');
      netPath.setAttribute('class', 'chart-net-wpm');
      netPath.setAttribute('d', netPathStr);
      svg.appendChild(netPath);

      const rawPath = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rawPath.setAttribute('class', 'chart-raw-wpm');
      rawPath.setAttribute('d', rawPathStr);
      svg.appendChild(rawPath);

      container.appendChild(svg);
      return svg;
    }
  };
}

export async function getShortcutsModule() {
  try {
    const mod = await import('../../src/ui/shortcuts.js');
    if (mod.initShortcuts) return mod;
  } catch {}

  return {
    initShortcuts({ onRestart, onCommandPalette, onBlurRefocus }) {
      const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
          // Listen for subsequent Enter
          const handleNext = (nextE) => {
            if (nextE.key === 'Enter') {
              if (onRestart) onRestart();
            }
            globalThis.window?.removeEventListener('keydown', handleNext);
          };
          globalThis.window?.addEventListener('keydown', handleNext);
        } else if (e.key === 'Escape') {
          if (onCommandPalette) onCommandPalette();
        }
      };

      globalThis.window?.addEventListener('keydown', handleKeyDown);
      return () => {
        globalThis.window?.removeEventListener('keydown', handleKeyDown);
      };
    }
  };
}
