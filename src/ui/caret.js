/**
 * RapidKeys UI - Smooth Animated Caret
 * Coordinates caret tracking over active characters via translate3d,
 * manages idle blinking at 1Hz, solid state when typing with 500ms debounce,
 * and visibility toggling on blur/focus.
 */

export class CaretTracker {
  /**
   * @param {Object} [options={}]
   * @param {HTMLElement} [options.container] - Mounting target container
   * @param {number} [options.idleDebounceMs=500] - Inactivity duration before blinking resumes
   */
  constructor(options = {}) {
    this.container = options.container || null;
    this.caretEl = null;
    this.idleTimeout = null;
    this.idleDebounceMs = typeof options.idleDebounceMs === 'number' ? options.idleDebounceMs : 500;
    this._hasMoved = false;

    if (this.container) {
      this.mount(this.container);
    }
  }

  /**
   * Mounts the caret DOM element into the target words-wrapper container.
   * 
   * @param {HTMLElement} container 
   */
  mount(container) {
    this.container = container;
    const doc = container?.ownerDocument || globalThis.document;

    this.caretEl = doc.createElement('div');
    this.caretEl.className = 'caret blinking';
    this.caretEl.id = 'caret';
    this.caretEl.style.transform = 'translate3d(0px, 0px, 0)';

    container.appendChild(this.caretEl);
  }

  /**
   * Updates caret position based on active letter element coordinates.
   * 
   * @param {HTMLElement} targetElement - Letter element to align with
   * @param {boolean} [isAtEnd=false] - True if positioning at trailing edge of word
   */
  updatePosition(targetElement, isAtEnd = false) {
    if (!this.caretEl || !targetElement) return;

    const x = (targetElement.offsetLeft || 0) + (isAtEnd ? (targetElement.offsetWidth || 0) : 0);
    const y = targetElement.offsetTop || 0;

    // First positioning at (0, 0) before user starts typing keeps idle blinking state.
    // Once typed or moved beyond initial (0, 0), blinking is canceled during typing.
    if (this._initialPositioned || this._hasMoved || x !== 0 || y !== 0 || isAtEnd) {
      this._hasMoved = true;
      this._initialPositioned = true;
      this.setBlinking(false);
    } else {
      this._initialPositioned = true;
    }

    this.caretEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    if (targetElement.offsetHeight) {
      this.caretEl.style.height = `${targetElement.offsetHeight}px`;
    }

    // Inactivity debounce: resume blinking 500ms after last keystroke
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.idleTimeout = setTimeout(() => {
      if (this.caretEl) {
        this.setBlinking(true);
      }
    }, this.idleDebounceMs);
    if (this.idleTimeout && typeof this.idleTimeout.unref === 'function') {
      this.idleTimeout.unref();
    }
  }

  /**
   * Sets whether the caret has the `.blinking` animation class.
   * 
   * @param {boolean} blinking 
   */
  setBlinking(blinking) {
    if (!this.caretEl) return;
    if (blinking) {
      this.caretEl.classList.add('blinking');
    } else {
      this.caretEl.classList.remove('blinking');
    }
  }

  /**
   * Hides the caret (e.g. on blur).
   */
  hide() {
    if (this.caretEl) {
      this.caretEl.style.display = 'none';
    }
  }

  /**
   * Shows the caret (e.g. on focus/refocus).
   */
  show() {
    if (this.caretEl) {
      this.caretEl.style.display = 'block';
    }
  }

  /**
   * Resets caret back to origin (0, 0) with blinking enabled.
   */
  reset() {
    this._hasMoved = false;
    this._initialPositioned = false;
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    if (this.caretEl) {
      this.caretEl.style.transform = 'translate3d(0px, 0px, 0)';
      this.setBlinking(true);
      this.show();
    }
  }

  /**
   * Destroys timer and removes caret from DOM.
   */
  destroy() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    if (this.caretEl) {
      if (typeof this.caretEl.remove === 'function') {
        this.caretEl.remove();
      } else if (this.caretEl.parentElement) {
        this.caretEl.parentElement.removeChild(this.caretEl);
      }
      this.caretEl = null;
    }
  }
}

export default CaretTracker;
