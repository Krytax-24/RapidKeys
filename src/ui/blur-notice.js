/**
 * RapidKeys UI - Blur Notice & Refocus Overlay
 * Coordinates out-of-focus overlay banner (#focusOverlay) when typing input loses focus.
 * Clicking the banner or pressing any key restores focus to the input and hides the notice.
 */

export class BlurNotice {
  /**
   * @param {Object} [options={}]
   * @param {HTMLElement} [options.overlay] - Existing #focusOverlay element
   * @param {HTMLElement} [options.input] - Hidden capturing input element
   * @param {HTMLElement} [options.surface] - Typing surface wrapper element for blur filter
   * @param {Object} [options.caret] - CaretTracker instance
   * @param {() => boolean | boolean} [options.isTestActive] - Guard checking if typing test is currently active
   */
  constructor(options = {}) {
    this.overlay = options.overlay || null;
    this.input = options.input || null;
    this.surface = options.surface || null;
    this.caret = options.caret || null;
    this.isTestActive = options.isTestActive !== undefined ? options.isTestActive : (() => true);

    this._onBlur = this.handleBlur.bind(this);
    this._onFocus = this.handleFocus.bind(this);
    this._onClick = this.refocus.bind(this);
    this._onDocumentKey = this.handleDocumentKey.bind(this);
    this._bound = false;

    if (this.overlay || this.input) {
      this.bindEvents();
    }
  }

  /**
   * Mounts the #focusOverlay notice DOM structure into a container if not already provided.
   * 
   * @param {HTMLElement} container 
   */
  mount(container) {
    if (!this.overlay && container) {
      const doc = container.ownerDocument || globalThis.document;

      this.overlay = doc.createElement('div');
      this.overlay.id = 'focusOverlay';
      this.overlay.className = 'focus-overlay hidden';

      const notice = doc.createElement('div');
      notice.className = 'focus-notice';

      const icon = doc.createElement('span');
      icon.className = 'focus-icon';
      icon.textContent = '⌨';

      const text = doc.createElement('span');
      text.className = 'focus-text';
      text.textContent = 'Click or press any key to focus';

      notice.appendChild(icon);
      notice.appendChild(text);
      this.overlay.appendChild(notice);

      container.appendChild(this.overlay);
    }

    this.bindEvents();
  }

  /**
   * Attaches blur, focus, click, and document keydown listeners.
   */
  bindEvents() {
    if (this._bound) return;

    if (this.overlay) {
      this.overlay.addEventListener('click', this._onClick);
    }

    if (this.input) {
      this.input.addEventListener('blur', this._onBlur);
      this.input.addEventListener('focus', this._onFocus);
    }

    const doc = globalThis.document;
    if (doc) {
      doc.addEventListener('keydown', this._onDocumentKey);
    }

    this._bound = true;
  }

  /**
   * Handles hidden input blur event.
   */
  handleBlur() {
    const active = typeof this.isTestActive === 'function' ? this.isTestActive() : Boolean(this.isTestActive);
    if (!active) {
      return;
    }
    this.show();
  }

  /**
   * Handles hidden input focus event.
   */
  handleFocus() {
    this.hide();
  }

  /**
   * Keypress on document while overlay is active triggers refocus.
   * 
   * @param {KeyboardEvent} e 
   */
  handleDocumentKey(e) {
    if (this.overlay && !this.overlay.classList.contains('hidden')) {
      this.refocus();
    }
  }

  /**
   * Displays the blur notice overlay, blurs the typing surface, and hides the caret.
   */
  show() {
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
    }
    if (this.surface) {
      this.surface.classList.add('blurred');
    }
    if (this.caret && typeof this.caret.hide === 'function') {
      this.caret.hide();
    }
  }

  /**
   * Hides the blur notice overlay, unblurs the typing surface, and shows the caret.
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }
    if (this.surface) {
      this.surface.classList.remove('blurred');
    }
    if (this.caret && typeof this.caret.show === 'function') {
      this.caret.show();
    }
  }

  /**
   * Restores focus to the hidden capturing input and hides notice overlay.
   */
  refocus() {
    if (this.input && typeof this.input.focus === 'function') {
      this.input.focus();
    }
    this.hide();
  }

  /**
   * Unbinds all listeners and cleans up references.
   */
  destroy() {
    if (this.overlay) {
      this.overlay.removeEventListener('click', this._onClick);
    }
    if (this.input) {
      this.input.removeEventListener('blur', this._onBlur);
      this.input.removeEventListener('focus', this._onFocus);
    }
    const doc = globalThis.document;
    if (doc) {
      doc.removeEventListener('keydown', this._onDocumentKey);
    }
    this._bound = false;
  }
}

/**
 * Factory helper to initialize BlurNotice.
 * 
 * @param {Object} options 
 * @returns {BlurNotice}
 */
export function initBlurNotice(options = {}) {
  const notice = new BlurNotice(options);
  if (options.container) {
    notice.mount(options.container);
  }
  return notice;
}

export default BlurNotice;
