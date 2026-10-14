/**
 * tests/helpers/user-simulator.js
 * Programmatic user keystroke and action simulator for RapidKeys E2E tests
 * Zero-dependency, native ES Module.
 */

export class UserSimulator {
  constructor(options = {}) {
    this.target = options.target || null;
    this.performance = options.performance || globalThis.performance || null;
    this.defaultKeyDelay = options.defaultKeyDelay || 50;
  }

  setTarget(target) {
    this.target = target;
  }

  createKeyboardEvent(type, key, options = {}) {
    const isModifier = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(key);
    const event = {
      type,
      key,
      code: options.code || (key.length === 1 ? `Key${key.toUpperCase()}` : key),
      keyCode: options.keyCode || (key.length === 1 ? key.charCodeAt(0) : 0),
      which: options.which || (key.length === 1 ? key.charCodeAt(0) : 0),
      ctrlKey: Boolean(options.ctrlKey),
      shiftKey: Boolean(options.shiftKey || (key >= 'A' && key <= 'Z')),
      altKey: Boolean(options.altKey),
      metaKey: Boolean(options.metaKey),
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {}
    };
    return event;
  }

  typeKey(key, options = {}) {
    const target = options.target || this.target;
    if (!target) {
      throw new Error('UserSimulator: No target element specified for typeKey');
    }

    const keydownEvent = this.createKeyboardEvent('keydown', key, options);
    target.dispatchEvent(keydownEvent);

    // If keydown is not canceled and target is an input-like element
    const isPrintable = key.length === 1 && !options.ctrlKey && !options.altKey && !options.metaKey;

    if (!keydownEvent.defaultPrevented) {
      if (key === 'Backspace') {
        if (typeof target.value === 'string' && target.value.length > 0) {
          if (options.ctrlKey) {
            target.value = '';
          } else {
            target.value = target.value.slice(0, -1);
          }
          const inputEvent = {
            type: 'input',
            inputType: options.ctrlKey ? 'deleteWordBackward' : 'deleteContentBackward',
            data: null,
            bubbles: true,
            cancelable: false
          };
          target.dispatchEvent(inputEvent);
        }
      } else if (isPrintable) {
        if (typeof target.value === 'string') {
          target.value += key;
          const inputEvent = {
            type: 'input',
            inputType: 'insertText',
            data: key,
            bubbles: true,
            cancelable: false
          };
          target.dispatchEvent(inputEvent);
        }
      }
    }

    const keyupEvent = this.createKeyboardEvent('keyup', key, options);
    target.dispatchEvent(keyupEvent);

    if (options.advanceTime !== false && this.performance && typeof this.performance.advance === 'function') {
      const delay = options.delay !== undefined ? options.delay : this.defaultKeyDelay;
      if (delay > 0) {
        this.performance.advance(delay);
      }
    }

    return keydownEvent;
  }

  typeString(text, options = {}) {
    const target = options.target || this.target;
    const keyDelay = options.delay !== undefined ? options.delay : this.defaultKeyDelay;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      this.typeKey(char, { ...options, target, delay: keyDelay });
    }
  }

  pressBackspace(options = {}) {
    return this.typeKey('Backspace', { ...options, ctrlKey: Boolean(options.ctrlKey) });
  }

  pressSpace(options = {}) {
    return this.typeKey(' ', options);
  }

  pressShortcut(combo, options = {}) {
    const target = options.target || this.target || globalThis.window || globalThis.document;
    const parts = combo.split('+').map(p => p.trim());

    if (parts.length === 2 && parts[0].toLowerCase() === 'ctrl' && parts[1].toLowerCase() === 'backspace') {
      return this.pressBackspace({ ...options, ctrlKey: true });
    }

    if (parts.length === 2 && parts[0].toLowerCase() === 'tab' && parts[1].toLowerCase() === 'enter') {
      // Tab followed by Enter
      const tabEvt = this.createKeyboardEvent('keydown', 'Tab', options);
      target.dispatchEvent(tabEvt);
      const enterEvt = this.createKeyboardEvent('keydown', 'Enter', options);
      target.dispatchEvent(enterEvt);
      return enterEvt;
    }

    if (parts[0].toLowerCase() === 'esc' || parts[0].toLowerCase() === 'escape') {
      const escEvt = this.createKeyboardEvent('keydown', 'Escape', options);
      target.dispatchEvent(escEvt);
      return escEvt;
    }

    const key = parts[parts.length - 1];
    const ctrlKey = parts.some(p => p.toLowerCase() === 'ctrl');
    const altKey = parts.some(p => p.toLowerCase() === 'alt');
    const shiftKey = parts.some(p => p.toLowerCase() === 'shift');

    return this.typeKey(key, { ...options, ctrlKey, altKey, shiftKey });
  }

  delay(ms) {
    if (this.performance && typeof this.performance.advance === 'function') {
      this.performance.advance(ms);
    }
    return Promise.resolve();
  }
}

export function createSimulator(target, options = {}) {
  return new UserSimulator({ target, ...options });
}
