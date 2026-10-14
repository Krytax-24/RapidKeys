/**
 * RapidKeys UI - In-Place Typing Surface
 * Manages discrete word/letter DOM rendering, hidden input event capturing,
 * character validation state transitions (untyped, correct, incorrect, extra, missed),
 * intra-word and inter-word backspace mechanics, space advancement, and active line scrolling.
 */

/**
 * Letter states supported by RapidKeys.
 * @readonly
 * @enum {string}
 */
export const LetterState = Object.freeze({
  UNTYPED: 'untyped',
  CORRECT: 'correct',
  INCORRECT: 'incorrect',
  EXTRA: 'extra',
  MISSED: 'missed'
});

/**
 * Maximum extra characters that can be appended to any single word.
 */
export const MAX_EXTRA_LETTERS = 15;

/**
 * TypingSurface handles the in-place rendering and user interaction of words.
 */
export class TypingSurface {
  /**
   * @param {Object} [options={}]
   * @param {HTMLElement} [options.container] - Mounting target container
   * @param {number} [options.lineHeight=48] - Line height in px for 3-line viewport scrolling
   * @param {number} [options.maxExtraLetters=15] - Cap for extra characters
   */
  constructor(options = {}) {
    this.container = options.container || null;
    this.wrapper = null;
    this.wordsContainer = null;
    this.input = null;

    this.words = [];
    this.currentWordIdx = 0;
    this.currentCharIdx = 0;
    this.wordData = [];
    this.lineHeight = typeof options.lineHeight === 'number' ? options.lineHeight : 48;
    this.maxExtraLetters = typeof options.maxExtraLetters === 'number' ? options.maxExtraLetters : MAX_EXTRA_LETTERS;

    this._events = new Map();
    this._handleKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * Subscribes a listener to a surface event.
   * Events: 'wordsLoaded', 'letterTyped', 'backspace', 'wordSubmitted', 'wordBacktrack', 'reset', 'testComplete'
   * 
   * @param {string} event 
   * @param {Function} handler 
   * @returns {() => void} Unsubscribe function
   */
  on(event, handler) {
    if (typeof handler !== 'function') return () => {};
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event).push(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribes a listener from a surface event.
   * 
   * @param {string} event 
   * @param {Function} handler 
   */
  off(event, handler) {
    if (this._events.has(event)) {
      const list = this._events.get(event);
      const idx = list.indexOf(handler);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }
  }

  /**
   * Dispatches an event to all registered listeners.
   * 
   * @param {string} event 
   * @param  {...any} args 
   */
  emit(event, ...args) {
    const handlers = this._events.get(event);
    if (handlers && handlers.length > 0) {
      for (const handler of [...handlers]) {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in TypingSurface event handler for '${event}':`, err);
        }
      }
    }
  }

  /**
   * Mounts the typing surface DOM structure into the target container.
   * 
   * @param {HTMLElement} container 
   */
  mount(container) {
    this.container = container;
    const doc = container?.ownerDocument || globalThis.document;

    // Outer viewport wrapper (overflow: hidden, 3-line height)
    this.wrapper = doc.createElement('div');
    this.wrapper.className = 'words-wrapper';
    this.wrapper.id = 'wordsWrapper';

    // Inner container holding word divs
    this.wordsContainer = doc.createElement('div');
    this.wordsContainer.className = 'words-container';
    this.wordsContainer.id = 'wordsContainer';

    // Hidden input capturing keyboard events
    this.input = doc.createElement('input');
    this.input.type = 'text';
    this.input.id = 'wordsInput';
    this.input.className = 'hidden-input';
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('autocapitalize', 'off');
    this.input.setAttribute('autocorrect', 'off');
    this.input.setAttribute('spellcheck', 'false');
    this.input.setAttribute('autofocus', '');

    this.input.addEventListener('keydown', this._handleKeyDown);

    this.wrapper.appendChild(this.wordsContainer);
    this.container.appendChild(this.wrapper);
    this.container.appendChild(this.input);
  }

  /**
   * Loads a list of words, initializes DOM elements, and resets pointers.
   * 
   * @param {string[]} words 
   */
  loadWords(words) {
    if (!Array.isArray(words)) return;

    this.words = [...words];
    this.currentWordIdx = 0;
    this.currentCharIdx = 0;
    this.wordData = [];

    const doc = this.container?.ownerDocument || globalThis.document;

    if (this.wordsContainer) {
      this.wordsContainer.innerHTML = '';
    }

    for (let wIdx = 0; wIdx < this.words.length; wIdx++) {
      const text = this.words[wIdx];
      const wordEl = doc.createElement('div');
      wordEl.className = 'word';
      wordEl.setAttribute('data-word-idx', String(wIdx));

      const letters = [];
      for (let cIdx = 0; cIdx < text.length; cIdx++) {
        const char = text[cIdx];
        const letterEl = doc.createElement('letter');
        letterEl.className = 'letter';
        letterEl.setAttribute('data-char', char);
        letterEl.textContent = char;
        wordEl.appendChild(letterEl);

        letters.push({
          char,
          state: LetterState.UNTYPED,
          el: letterEl
        });
      }

      if (this.wordsContainer) {
        this.wordsContainer.appendChild(wordEl);
      }

      this.wordData.push({
        text,
        el: wordEl,
        letters,
        hasError: false
      });
    }

    this.updateActivePointers();

    if (this.wrapper) {
      this.wrapper.scrollTop = 0;
    }

    this.emit('wordsLoaded', this.words);
  }

  /**
   * Returns current active word object or null.
   * @returns {{ text: string, el: HTMLElement, letters: Array<{ char: string, state: string, el: HTMLElement }>, hasError: boolean } | null}
   */
  getActiveWord() {
    return this.wordData[this.currentWordIdx] || null;
  }

  /**
   * Returns current active letter object or null.
   * @returns {{ char: string, state: string, el: HTMLElement } | null}
   */
  getActiveLetter() {
    const activeWord = this.getActiveWord();
    if (!activeWord) return null;
    return activeWord.letters[this.currentCharIdx] || null;
  }

  /**
   * Internal keydown event listener.
   * @param {KeyboardEvent} e 
   */
  _onKeyDown(e) {
    const isModifierOnly = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key);
    if (isModifierOnly) return;

    this.handleKey(e.key, Boolean(e.ctrlKey || e.altKey));
  }

  /**
   * Core keystroke processor. Handles printable characters, backspace, and space.
   * 
   * @param {string} key - Keystroke string
   * @param {boolean} [ctrlKey=false] - True if Ctrl or Alt modifier is active
   */
  handleKey(key, ctrlKey = false) {
    if (!key) return;

    // Ignore non-printable keys and modifier keys
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(key)) {
      return;
    }
    if (key.length > 1 && key !== 'Backspace') {
      return;
    }

    const activeWord = this.getActiveWord();
    if (!activeWord) return;

    // 1. BACKSPACE HANDLING
    if (key === 'Backspace') {
      if (ctrlKey) {
        // Ctrl+Backspace: clear entire current word, or backtrack dirty previous word
        if (this.currentCharIdx > 0) {
          // Remove all extra characters
          while (activeWord.letters.length > activeWord.text.length) {
            const extra = activeWord.letters.pop();
            if (typeof extra.el.remove === 'function') {
              extra.el.remove();
            } else if (extra.el.parentElement) {
              extra.el.parentElement.removeChild(extra.el);
            }
          }

          // Reset remaining letters to untyped
          activeWord.letters.forEach(letter => {
            letter.state = LetterState.UNTYPED;
            letter.el.className = 'letter';
          });

          activeWord.hasError = false;
          this.currentCharIdx = 0;
          this.updateActivePointers();
          this.emit('backspace', { ctrl: true });
          return;
        }

        // At start of current word (currentCharIdx == 0): backtrack previous word if it has errors
        if (this.currentWordIdx > 0) {
          const prevWord = this.wordData[this.currentWordIdx - 1];
          const hasError = prevWord.letters.some(l => 
            l.state === LetterState.INCORRECT || l.state === LetterState.EXTRA || l.state === LetterState.MISSED
          );

          if (hasError) {
            this.currentWordIdx--;

            // Remove extra characters on previous word
            while (prevWord.letters.length > prevWord.text.length) {
              const extra = prevWord.letters.pop();
              if (typeof extra.el.remove === 'function') {
                extra.el.remove();
              } else if (extra.el.parentElement) {
                extra.el.parentElement.removeChild(extra.el);
              }
            }

            // Reset all letters on previous word
            prevWord.letters.forEach(letter => {
              letter.state = LetterState.UNTYPED;
              letter.el.className = 'letter';
            });

            prevWord.hasError = false;
            this.currentCharIdx = 0;
            this.updateActivePointers();
            this.checkLineScroll();
            this.emit('wordBacktrack', this.currentWordIdx);
            this.emit('backspace', { ctrl: true });
          }
        }
        return;
      }

      // Single Backspace (Intra-word)
      if (this.currentCharIdx > 0) {
        this.currentCharIdx--;
        const letter = activeWord.letters[this.currentCharIdx];

        if (letter.state === LetterState.EXTRA) {
          activeWord.letters.splice(this.currentCharIdx, 1);
          if (typeof letter.el.remove === 'function') {
            letter.el.remove();
          } else if (letter.el.parentElement) {
            letter.el.parentElement.removeChild(letter.el);
          }
        } else {
          letter.state = LetterState.UNTYPED;
          letter.el.className = 'letter';
        }

        activeWord.hasError = activeWord.letters.some(l => 
          l.state === LetterState.INCORRECT || l.state === LetterState.EXTRA || l.state === LetterState.MISSED
        );

        this.updateActivePointers();
        this.emit('backspace', { ctrl: false });
        return;
      }

      // Single Backspace (Inter-word: at index 0)
      if (this.currentWordIdx > 0) {
        const prevWord = this.wordData[this.currentWordIdx - 1];
        const hasError = prevWord.letters.some(l => 
          l.state === LetterState.INCORRECT || l.state === LetterState.EXTRA || l.state === LetterState.MISSED
        );

        if (hasError) {
          this.currentWordIdx--;
          this.currentCharIdx = prevWord.letters.length;
          this.updateActivePointers();
          this.checkLineScroll();
          this.emit('wordBacktrack', this.currentWordIdx);
        }
      }
      return;
    }

    // 2. SPACE ADVANCEMENT
    if (key === ' ') {
      // Space pressed at index 0 is ignored completely (prevents accidental skipping)
      if (this.currentCharIdx === 0) {
        return;
      }

      // Mark any remaining untyped letters in current word as missed
      for (let i = this.currentCharIdx; i < activeWord.text.length; i++) {
        const letter = activeWord.letters[i];
        letter.state = LetterState.MISSED;
        letter.el.classList.add('missed');
        activeWord.hasError = true;
      }

      const submittedWordIdx = this.currentWordIdx;
      const wordHadError = activeWord.hasError;

      this.currentWordIdx++;
      this.currentCharIdx = 0;

      if (this.input) {
        this.input.value = '';
      }

      this.updateActivePointers();
      this.checkLineScroll();

      this.emit('wordSubmitted', submittedWordIdx, { hasError: wordHadError });

      if (this.currentWordIdx >= this.wordData.length) {
        this.emit('testComplete', { wordCount: this.wordData.length });
      }
      return;
    }

    // 3. PRINTABLE CHARACTER TYPING
    if (key.length === 1) {
      if (this.currentCharIdx < activeWord.text.length) {
        const letter = activeWord.letters[this.currentCharIdx];
        const isCorrect = key === letter.char;

        if (isCorrect) {
          letter.state = LetterState.CORRECT;
          letter.el.className = 'letter correct';
        } else {
          letter.state = LetterState.INCORRECT;
          letter.el.className = 'letter incorrect';
          activeWord.hasError = true;
        }

        const typedIdx = this.currentCharIdx;
        this.currentCharIdx++;
        this.updateActivePointers();
        this.emit('letterTyped', { key, charIdx: typedIdx, correct: isCorrect, extra: false });
      } else {
        // Extra characters beyond target word length (capped at maxExtraLetters)
        const extraCount = activeWord.letters.length - activeWord.text.length;
        if (extraCount < this.maxExtraLetters) {
          const doc = activeWord.el.ownerDocument || globalThis.document;
          const extraEl = doc.createElement('letter');
          extraEl.className = 'letter extra incorrect';
          extraEl.setAttribute('data-char', key);
          extraEl.textContent = key;

          activeWord.el.appendChild(extraEl);
          activeWord.letters.push({
            char: key,
            state: LetterState.EXTRA,
            el: extraEl
          });
          activeWord.hasError = true;

          const typedIdx = this.currentCharIdx;
          this.currentCharIdx++;
          this.updateActivePointers();
          this.emit('letterTyped', { key, charIdx: typedIdx, correct: false, extra: true });
        }
      }
    }
  }

  /**
   * Updates CSS `.active` class on word elements to reflect active word pointer.
   */
  updateActivePointers() {
    for (let i = 0; i < this.wordData.length; i++) {
      const word = this.wordData[i];
      if (i === this.currentWordIdx) {
        word.el.classList.add('active');
      } else {
        word.el.classList.remove('active');
      }
    }
  }

  /**
   * Checks active word row position and adjusts viewport scroll to lock active line to line 2.
   */
  checkLineScroll() {
    const activeWord = this.getActiveWord();
    if (!activeWord || !this.wrapper) return;

    const initialTop = this.wordData[0]?.el?.offsetTop || 0;
    const currentTop = activeWord.el?.offsetTop || 0;
    const lineIndex = Math.max(0, Math.round((currentTop - initialTop) / this.lineHeight));

    if (lineIndex >= 2) {
      const scrollOffset = (lineIndex - 1) * this.lineHeight;
      this.wrapper.scrollTop = scrollOffset;
    } else {
      this.wrapper.scrollTop = 0;
    }
  }

  /**
   * Resets typing surface back to initial word and zero character index.
   */
  reset() {
    this.currentWordIdx = 0;
    this.currentCharIdx = 0;

    if (this.words && this.words.length > 0) {
      this.loadWords(this.words);
    }

    if (this.wrapper) {
      this.wrapper.scrollTop = 0;
    }

    if (this.input) {
      this.input.value = '';
    }

    this.emit('reset', {});
  }

  /**
   * Focuses the capturing input.
   */
  focus() {
    if (this.input && typeof this.input.focus === 'function') {
      this.input.focus();
    }
  }

  /**
   * Blurs the capturing input.
   */
  blur() {
    if (this.input && typeof this.input.blur === 'function') {
      this.input.blur();
    }
  }

  /**
   * Destroys DOM listeners and unmounts surface.
   */
  destroy() {
    if (this.input) {
      this.input.removeEventListener('keydown', this._handleKeyDown);
    }
    this._events.clear();
  }
}

export default TypingSurface;
