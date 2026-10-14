/**
 * tests/helpers/dom-harness.js
 * Zero-dependency DOM and Browser Environment Emulation for RapidKeys
 * Works natively in Node.js (v18+) without JSDOM, Vitest, or external npm packages.
 */

export class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.className = '';
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this._styleProps = {};
    this.dataset = {};
    this.listeners = new Map();
    this._textContent = '';
    this._value = '';
    this.disabled = false;
    this.offsetLeft = 0;
    this.offsetTop = 0;
    this.offsetWidth = 12;
    this.offsetHeight = 48;
    this.scrollTop = 0;
    this.scrollHeight = 144;
    this.clientHeight = 144;
    this.scrollLeft = 0;
    this.scrollWidth = 800;
    this.clientWidth = 800;
  }

  get style() {
    const self = this;
    return new Proxy(this._styleProps, {
      get(target, prop) {
        if (prop === 'setProperty') {
          return (name, value) => {
            target[name] = String(value);
          };
        }
        if (prop === 'getPropertyValue') {
          return (name) => target[name] || '';
        }
        return target[prop] || '';
      },
      set(target, prop, value) {
        target[prop] = String(value);
        return true;
      }
    });
  }

  set style(val) {
    if (typeof val === 'object' && val !== null) {
      this._styleProps = { ...val };
    }
  }

  get classList() {
    const self = this;
    return {
      _get: () => (self.className ? self.className.trim().split(/\s+/).filter(Boolean) : []),
      _set: (arr) => { self.className = arr.join(' '); },
      add: (...tokens) => {
        const set = new Set(self.classList._get());
        tokens.forEach(t => {
          if (t) String(t).split(/\s+/).forEach(token => set.add(token));
        });
        self.classList._set(Array.from(set));
      },
      remove: (...tokens) => {
        const set = new Set(self.classList._get());
        tokens.forEach(t => {
          if (t) String(t).split(/\s+/).forEach(token => set.delete(token));
        });
        self.classList._set(Array.from(set));
      },
      toggle: (token, force) => {
        const set = new Set(self.classList._get());
        const shouldAdd = force !== undefined ? force : !set.has(token);
        if (shouldAdd) set.add(token);
        else set.delete(token);
        self.classList._set(Array.from(set));
        return shouldAdd;
      },
      contains: (token) => self.classList._get().includes(token)
    };
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this.children = [];
    this._textContent = String(val !== undefined && val !== null ? val : '');
  }

  get innerText() {
    return this.textContent;
  }

  set innerText(val) {
    this.textContent = val;
  }

  get innerHTML() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => {
      const tag = c.tagName.toLowerCase();
      const cls = c.className ? ` class="${c.className}"` : '';
      const id = c.id ? ` id="${c.id}"` : '';
      return `<${tag}${id}${cls}>${c.innerHTML}</${tag}>`;
    }).join('');
  }

  set innerHTML(val) {
    this.children = [];
    this._textContent = String(val !== undefined && val !== null ? val : '');
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = String(val !== undefined && val !== null ? val : '');
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get lastElementChild() {
    return this.children[this.children.length - 1] || null;
  }

  get childElementCount() {
    return this.children.length;
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  setAttribute(name, value) {
    const strVal = String(value);
    this.attributes.set(name, strVal);
    if (name === 'id') this.id = strVal;
    if (name === 'class') this.className = strVal;
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      this.dataset[prop] = strVal;
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'id') this.id = '';
    if (name === 'class') this.className = '';
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      delete this.dataset[prop];
    }
  }

  appendChild(child) {
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  replaceChild(newChild, oldChild) {
    const idx = this.children.indexOf(oldChild);
    if (idx !== -1) {
      if (newChild.parentElement) {
        newChild.parentElement.removeChild(newChild);
      }
      newChild.parentElement = this;
      oldChild.parentElement = null;
      this.children[idx] = newChild;
    }
    return newChild;
  }

  insertBefore(newChild, refChild) {
    if (!refChild) {
      return this.appendChild(newChild);
    }
    const idx = this.children.indexOf(refChild);
    if (idx !== -1) {
      if (newChild.parentElement) {
        newChild.parentElement.removeChild(newChild);
      }
      newChild.parentElement = this;
      this.children.splice(idx, 0, newChild);
      return newChild;
    }
    return this.appendChild(newChild);
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.listeners.has(type)) return;
    const arr = this.listeners.get(type);
    const idx = arr.indexOf(listener);
    if (idx !== -1) arr.splice(idx, 1);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    if (typeof event.preventDefault !== 'function') {
      event.defaultPrevented = false;
      event.preventDefault = function() { this.defaultPrevented = true; };
    }
    if (typeof event.stopPropagation !== 'function') {
      event.stopPropagation = function() {};
    }
    const handlers = (this.listeners.get(event.type) || []).slice();
    for (const h of handlers) {
      h.call(this, event);
    }
    return !event.defaultPrevented;
  }

  focus() {
    this.dispatchEvent({ type: 'focus', target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
  }

  blur() {
    this.dispatchEvent({ type: 'blur', target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const parts = selector.trim().split(/\s+/);

    if (parts.length === 1) {
      const match = (el) => matchesSelector(el, parts[0]);
      const walk = (node) => {
        for (const child of node.children) {
          if (match(child)) results.push(child);
          walk(child);
        }
      };
      walk(this);
      return results;
    }

    // Multi-part selector (e.g. ".words-container .word" or ".word letter")
    let currentPool = [this];
    for (const part of parts) {
      const nextPool = [];
      for (const parent of currentPool) {
        const walk = (node) => {
          for (const c of node.children) {
            if (matchesSelector(c, part)) nextPool.push(c);
            walk(c);
          }
        };
        walk(parent);
      }
      currentPool = nextPool;
    }
    return currentPool;
  }

  getBoundingClientRect() {
    return {
      left: this.offsetLeft,
      top: this.offsetTop,
      width: this.offsetWidth,
      height: this.offsetHeight,
      right: this.offsetLeft + this.offsetWidth,
      bottom: this.offsetTop + this.offsetHeight,
      x: this.offsetLeft,
      y: this.offsetTop
    };
  }
}

function matchesSelector(el, sel) {
  if (!sel) return false;

  // Attribute selector [data-theme="nord"] or [data-theme]
  if (sel.startsWith('[') && sel.endsWith(']')) {
    const content = sel.slice(1, -1);
    if (content.includes('=')) {
      const [attrName, rawVal] = content.split('=');
      const expectedVal = rawVal.replace(/['"]/g, '');
      return el.getAttribute(attrName.trim()) === expectedVal;
    }
    return el.hasAttribute(content.trim());
  }

  // Combined tag and class / id e.g. div.word or letter.correct
  const tagMatch = sel.match(/^([a-zA-Z0-9_-]+)/);
  let remaining = sel;
  if (tagMatch) {
    const tag = tagMatch[1];
    if (el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    remaining = sel.slice(tag.length);
  }

  if (remaining.startsWith('#')) {
    return el.id === remaining.slice(1);
  }

  if (remaining.startsWith('.')) {
    const classes = remaining.split('.').filter(Boolean);
    return classes.every(c => el.classList.contains(c));
  }

  return remaining === '';
}

export class MockDocument extends MockElement {
  constructor() {
    super('DOCUMENT');
    this.documentElement = new MockElement('HTML');
    this.head = new MockElement('HEAD');
    this.body = new MockElement('BODY');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  createElementNS(ns, tagName) {
    const el = new MockElement(tagName);
    el.namespaceURI = ns;
    return el;
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }
}

export function createTestEnvironment() {
  const document = new MockDocument();
  const storage = new Map();

  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(String(k), String(v)),
    removeItem: (k) => storage.delete(String(k)),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (i) => Array.from(storage.keys())[i] || null
  };

  let simulatedTime = 1000;
  const performance = {
    now: () => simulatedTime,
    advance: (ms) => { simulatedTime += ms; },
    reset: (startMs = 1000) => { simulatedTime = startMs; }
  };

  const window = {
    document,
    localStorage,
    performance,
    innerWidth: 1024,
    innerHeight: 768,
    devicePixelRatio: 1,
    addEventListener: (type, fn) => document.addEventListener(type, fn),
    removeEventListener: (type, fn) => document.removeEventListener(type, fn),
    dispatchEvent: (evt) => document.dispatchEvent(evt),
    requestAnimationFrame: (cb) => { cb(performance.now()); return 1; },
    cancelAnimationFrame: () => {},
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id)
  };

  const originalGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    performance: globalThis.performance
  };

  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = localStorage;
  globalThis.performance = performance;

  const cleanup = () => {
    globalThis.document = originalGlobals.document;
    globalThis.window = originalGlobals.window;
    globalThis.localStorage = originalGlobals.localStorage;
    globalThis.performance = originalGlobals.performance;
  };

  return { document, window, localStorage, performance, cleanup };
}

export const setupTestDom = createTestEnvironment;
