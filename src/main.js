/**
 * RapidKeys - Main Application Entry Point & Lifecycle Controller
 * 
 * Orchestrates all architectural layers:
 * - Config & Persistence (src/config.js)
 * - Vocabulary & Word Generator (src/data/words.js)
 * - Metrics & Telemetry Engine (src/engine/metrics.js, src/engine/telemetry.js, src/engine/state.js)
 * - UI Presentation & Caret Dynamics (src/ui/typing-surface.js, src/ui/caret.js, src/ui/blur-notice.js)
 * - Navigation, Themes & Shortcuts (src/ui/nav-bar.js, src/ui/theme-engine.js, src/ui/shortcuts.js)
 * - Results Screen & SVG Chart (src/ui/results-view.js, src/ui/chart.js)
 */

import { getConfig, updateConfig } from './config.js';
import { getWordBatch } from './data/words.js';
import {
  calculateNetWpm,
  calculateRawWpm,
  calculateAccuracy,
  calculateConsistency,
  getCharacterBreakdown
} from './engine/metrics.js';
import { createTelemetryLogger } from './engine/telemetry.js';
import { createStateMachine, TypingState } from './engine/state.js';
import { TypingSurface } from './ui/typing-surface.js';
import { CaretTracker } from './ui/caret.js';
import { initBlurNotice } from './ui/blur-notice.js';
import { renderNavBar } from './ui/nav-bar.js';
import { initTheme } from './ui/theme-engine.js';
import { initShortcuts, enableFocusMode, disableFocusMode } from './ui/shortcuts.js';
import { renderResults } from './ui/results-view.js';

export class RapidKeysApp {
  constructor() {
    this.config = getConfig();
    this.stateMachine = createStateMachine(TypingState.IDLE);
    this.telemetryLogger = null;
    this.typingSurface = null;
    this.caret = null;
    this.blurNotice = null;
    this.shortcutsCleanup = null;

    this.timerIntervalId = null;
    this.correctKeypresses = 0;
    this.totalKeypresses = 0;
    this.isInitialized = false;

    // DOM references
    this.navContainer = null;
    this.typingArea = null;
    this.resultsArea = null;
    this.liveCounterEl = null;
    this.focusOverlay = null;
  }

  /**
   * Initializes the application and mounts all components.
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Initialize Color Theme
    initTheme();

    // 2. Resolve DOM Elements
    const doc = globalThis.document;
    if (!doc) return;

    this.navContainer = doc.getElementById('navContainer');
    this.typingArea = doc.getElementById('typingArea');
    this.resultsArea = doc.getElementById('resultsArea');
    this.liveCounterEl = doc.getElementById('liveCounter');
    this.focusOverlay = doc.getElementById('focusOverlay');

    // 3. Mount Navigation Bar
    if (this.navContainer) {
      renderNavBar(this.navContainer, this.config, (newConfig) => {
        this.handleConfigChange(newConfig);
      });
    }

    // 4. Initialize Engine & Telemetry
    this.telemetryLogger = createTelemetryLogger({
      intervalMs: 1000,
      getMetrics: () => this.getLiveMetrics()
    });

    // 5. Mount Typing Surface
    this.typingSurface = new TypingSurface({
      lineHeight: 48,
      maxExtraLetters: 15
    });

    if (this.typingArea) {
      this.typingSurface.mount(this.typingArea);
    }

    // 6. Mount Caret Tracker into words-wrapper
    if (this.typingSurface.wrapper) {
      this.caret = new CaretTracker();
      this.caret.mount(this.typingSurface.wrapper);
    }

    // 7. Setup Blur Notice & Refocus Overlay
    this.blurNotice = initBlurNotice({
      overlay: this.focusOverlay,
      input: this.typingSurface.input,
      surface: this.typingSurface.wrapper,
      caret: this.caret,
      isTestActive: () => this.stateMachine.isRunning() || this.stateMachine.isIdle()
    });

    // 8. Bind Surface Events
    this.bindSurfaceEvents();

    // 9. Bind Global Keyboard Shortcuts
    this.shortcutsCleanup = initShortcuts({
      onRestart: () => this.restartTest(),
      onConfigChange: (newConfig) => this.handleConfigChange(newConfig),
      inputElement: this.typingSurface.input
    });

    // 10. Load Initial Words & Position Caret
    this.loadFreshWords();
    this.updateLiveCounter();

    // Focus capturing input
    this.typingSurface.focus();
  }

  /**
   * Computes live instantaneous metrics for the telemetry sampler.
   */
  getLiveMetrics() {
    const elapsedSec = Math.max(1, this.stateMachine.getElapsedSeconds());
    const breakdown = getCharacterBreakdown(this.typingSurface?.wordData || []);
    const correctChars = breakdown.correct + this.getCorrectSpacesCount();
    const totalChars = correctChars + breakdown.incorrect + breakdown.extra;

    return {
      netWpm: calculateNetWpm(correctChars, elapsedSec),
      rawWpm: calculateRawWpm(totalChars, elapsedSec),
      correctChars,
      totalTypedChars: totalChars,
      errors: breakdown.incorrect + breakdown.extra
    };
  }

  /**
   * Counts space characters submitted after completely error-free words.
   * @returns {number}
   */
  getCorrectSpacesCount() {
    if (!this.typingSurface?.wordData) return 0;
    let count = 0;
    const currentIdx = this.typingSurface.currentWordIdx;
    for (let i = 0; i < currentIdx; i++) {
      const word = this.typingSurface.wordData[i];
      if (word && !word.hasError) {
        count++;
      }
    }
    return count;
  }

  /**
   * Binds interaction events from the TypingSurface component.
   */
  bindSurfaceEvents() {
    if (!this.typingSurface) return;

    // A. Letter Typed
    this.typingSurface.on('letterTyped', ({ key, charIdx, correct, extra }) => {
      this.handleTypingActivity();

      this.totalKeypresses++;
      if (correct) {
        this.correctKeypresses++;
      } else {
        this.telemetryLogger.recordError(1);
      }

      this.updateCaretPosition();
      this.updateLiveCounter();
    });

    // B. Backspace pressed
    this.typingSurface.on('backspace', ({ ctrl }) => {
      this.totalKeypresses++;
      this.updateCaretPosition();
    });

    // C. Space / Word Submitted
    this.typingSurface.on('wordSubmitted', (submittedWordIdx, { hasError }) => {
      this.totalKeypresses++;
      if (!hasError) {
        this.correctKeypresses++;
      }

      this.updateCaretPosition();
      this.updateLiveCounter();

      // Check Word Target Mode Completion
      if (this.config.mode === 'words') {
        const completedWords = submittedWordIdx + 1;
        if (completedWords >= this.config.wordCount) {
          this.finishTest();
          return;
        }
      }

      // Check Infinite Lazy Word Stream for Time Mode
      if (this.config.mode === 'time') {
        const remainingWords = this.typingSurface.wordData.length - this.typingSurface.currentWordIdx;
        if (remainingWords < 20) {
          this.appendMoreWords(30);
        }
      }
    });

    // D. Word Backtrack
    this.typingSurface.on('wordBacktrack', () => {
      this.updateCaretPosition();
    });

    // E. Test Complete emitted by surface
    this.typingSurface.on('testComplete', () => {
      this.finishTest();
    });
  }

  /**
   * Handles first-keypress transitions from IDLE to RUNNING.
   */
  handleTypingActivity() {
    if (this.stateMachine.isIdle()) {
      const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();

      this.stateMachine.start(now);
      this.telemetryLogger.start(now);
      enableFocusMode();
      this.startCountdownLoop();
    }
  }

  /**
   * Starts high-frequency frame check for time countdown modes.
   */
  startCountdownLoop() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
    }

    this.timerIntervalId = setInterval(() => {
      if (!this.stateMachine.isRunning()) {
        clearInterval(this.timerIntervalId);
        this.timerIntervalId = null;
        return;
      }

      const elapsedSec = this.stateMachine.getElapsedSeconds();

      if (this.config.mode === 'time') {
        const remaining = Math.max(0, this.config.timeLimit - elapsedSec);
        if (this.liveCounterEl) {
          this.liveCounterEl.textContent = String(Math.ceil(remaining));
        }

        if (remaining <= 0) {
          this.finishTest();
        }
      } else {
        // Words mode
        this.updateLiveCounter();
      }
    }, 100);
  }

  /**
   * Updates caret position based on active letter or word end.
   */
  updateCaretPosition() {
    if (!this.caret || !this.typingSurface) return;

    const activeWord = this.typingSurface.getActiveWord();
    if (!activeWord) return;

    const activeLetter = this.typingSurface.getActiveLetter();
    if (activeLetter && activeLetter.el) {
      this.caret.updatePosition(activeLetter.el, false);
    } else {
      // At or past target word end (awaiting Space or typing extra letters)
      const lastEl = activeWord.el?.lastElementChild;
      if (lastEl) {
        this.caret.updatePosition(lastEl, true);
      }
    }
  }

  /**
   * Updates live counter / HUD display.
   */
  updateLiveCounter() {
    if (!this.liveCounterEl) return;

    if (this.config.mode === 'time') {
      if (this.stateMachine.isIdle()) {
        this.liveCounterEl.textContent = String(this.config.timeLimit);
      }
    } else if (this.config.mode === 'words') {
      const current = this.typingSurface?.currentWordIdx || 0;
      this.liveCounterEl.textContent = `${current} / ${this.config.wordCount}`;
    }
  }

  /**
   * Generates and loads fresh words according to active configuration.
   */
  loadFreshWords() {
    const count = this.config.mode === 'words' ? this.config.wordCount : 70;
    const words = getWordBatch(count, {
      punctuation: Boolean(this.config.punctuation),
      numbers: Boolean(this.config.numbers)
    });

    this.typingSurface.loadWords(words);

    const firstLetter = this.typingSurface.getActiveLetter();
    if (firstLetter && firstLetter.el && this.caret) {
      this.caret.updatePosition(firstLetter.el, false);
      this.caret.setBlinking(true);
    }
  }

  /**
   * Appends additional words to the current word buffer (lazy generation).
   * @param {number} count
   */
  appendMoreWords(count = 30) {
    const additional = getWordBatch(count, {
      punctuation: Boolean(this.config.punctuation),
      numbers: Boolean(this.config.numbers)
    });

    const doc = this.typingSurface.container?.ownerDocument || globalThis.document;
    const startIndex = this.typingSurface.wordData.length;

    additional.forEach((text, i) => {
      const wIdx = startIndex + i;
      const wordEl = doc.createElement('div');
      wordEl.className = 'word';
      wordEl.setAttribute('data-word-idx', String(wIdx));

      const letters = [];
      for (let c = 0; c < text.length; c++) {
        const char = text[c];
        const letterEl = doc.createElement('letter');
        letterEl.className = 'letter';
        letterEl.setAttribute('data-char', char);
        letterEl.textContent = char;
        wordEl.appendChild(letterEl);
        letters.push({ char, state: 'untyped', el: letterEl });
      }

      this.typingSurface.wordsContainer.appendChild(wordEl);
      this.typingSurface.wordData.push({ text, el: wordEl, letters, hasError: false });
      this.typingSurface.words.push(text);
    });
  }

  /**
   * Concludes the active test, computes final metrics, and transitions to results screen.
   */
  finishTest() {
    if (this.stateMachine.isFinished()) return;

    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    this.stateMachine.finish();
    const snapshots = this.telemetryLogger.stop();
    disableFocusMode();

    // Determine final elapsed time
    let elapsedSec = this.stateMachine.getElapsedSeconds();
    if (elapsedSec <= 0) {
      elapsedSec = this.config.mode === 'time' ? this.config.timeLimit : 1;
    }

    // Compute character breakdown and metrics
    const breakdown = getCharacterBreakdown(this.typingSurface?.wordData || []);
    const correctSpaces = this.getCorrectSpacesCount();
    const correctChars = breakdown.correct + correctSpaces;
    const totalTypedChars = correctChars + breakdown.incorrect + breakdown.extra;

    const netWpm = calculateNetWpm(correctChars, elapsedSec);
    const rawWpm = calculateRawWpm(totalTypedChars, elapsedSec);
    const accuracy = calculateAccuracy(this.correctKeypresses, this.totalKeypresses);
    const consistency = calculateConsistency(snapshots.map(s => s.rawWpm));

    const testSummary = {
      netWpm,
      accuracy,
      rawWpm,
      consistency,
      mode: `${this.config.mode} ${this.config.mode === 'time' ? this.config.timeLimit : this.config.wordCount}`,
      timeElapsed: Number(elapsedSec.toFixed(1)),
      breakdown,
      snapshots
    };

    // Transition view
    if (this.typingArea) {
      this.typingArea.classList.add('hidden');
    }
    if (this.resultsArea) {
      this.resultsArea.classList.remove('hidden');
      renderResults(this.resultsArea, testSummary, () => this.restartTest());
    }
  }

  /**
   * Resets all state and returns to a fresh typing session.
   */
  restartTest() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }

    this.stateMachine.reset();
    this.telemetryLogger.reset();
    disableFocusMode();

    this.correctKeypresses = 0;
    this.totalKeypresses = 0;

    // Swap views back
    if (this.resultsArea) {
      this.resultsArea.innerHTML = '';
      this.resultsArea.classList.add('hidden');
    }
    if (this.typingArea) {
      this.typingArea.classList.remove('hidden');
    }

    this.loadFreshWords();
    this.updateLiveCounter();

    if (this.caret) {
      this.caret.reset();
      const firstLetter = this.typingSurface.getActiveLetter();
      if (firstLetter && firstLetter.el) {
        this.caret.updatePosition(firstLetter.el, false);
      }
    }

    if (this.typingSurface) {
      this.typingSurface.focus();
    }
  }

  /**
   * Handles user preference updates from navigation bar or command palette.
   * @param {Object} newConfig
   */
  handleConfigChange(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.restartTest();
  }

  /**
   * Destroys event listeners and DOM instances.
   */
  destroy() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
    }
    if (typeof this.shortcutsCleanup === 'function') {
      this.shortcutsCleanup();
    }
    if (this.blurNotice) {
      this.blurNotice.destroy();
    }
    if (this.typingSurface) {
      this.typingSurface.destroy();
    }
    if (this.caret) {
      this.caret.destroy();
    }
  }
}

// Auto-boot if running in a standard browser document environment
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const boot = () => {
    const app = new RapidKeysApp();
    app.init();
    window.__rapidKeysApp = app;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export default RapidKeysApp;
