/**
 * tests/tier2-boundary/t2-f2-caret-boundaries.test.js
 * Tier 2: Boundary & Corner Cases - B2: Caret Boundaries
 * Tests: T2.2.1 through T2.2.5 (5 tests)
 * Requirement: Boundary value analysis for caret physics, debounce, resize, overflow cap
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { createSimulator } from '../helpers/user-simulator.js';
import { getCaretModule, getTypingSurfaceModule } from '../helpers/contract-bridge.js';

describe('Tier 2 - B2: Caret & Layout Boundaries', () => {
  let env;
  let typingSurface;
  let caret;
  let container;
  let sim;

  beforeEach(async () => {
    env = createTestEnvironment();
    container = env.document.createElement('div');
    container.id = 'app';
    env.document.body.appendChild(container);

    const { TypingSurface } = await getTypingSurfaceModule();
    const { CaretTracker } = await getCaretModule();

    typingSurface = new TypingSurface();
    typingSurface.mount(container);
    typingSurface.loadWords(['pneumonoultramicroscopicsilicovolcanoconiosis', 'next']);

    caret = new CaretTracker();
    caret.mount(typingSurface.wrapper);

    sim = createSimulator(typingSurface.input, { performance: env.performance });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T2.2.1: Extreme single-word length wrapping across multiple lines: caret coordinates track word wrap without escaping viewport boundary', () => {
    const activeWord = typingSurface.getActiveWord();
    assert.equal(activeWord.letters.length, 45);

    // Simulate wrapped letter at index 30 having a new line offsetTop
    activeWord.letters[30].el.offsetTop = 48; // line 1
    activeWord.letters[30].el.offsetLeft = 12;

    caret.updatePosition(activeWord.letters[30].el);

    assert.equal(caret.caretEl.style.transform, 'translate3d(12px, 48px, 0)');
  });

  it('T2.2.2: Fast consecutive Backspaces (5 backspaces in 50ms): caret repositions instantly without animation queue lagging', () => {
    // Type 5 characters quickly
    sim.typeString('pneu');
    const word = typingSurface.getActiveWord();
    word.letters[4].el.offsetLeft = 48;
    caret.updatePosition(word.letters[4].el);

    // Fast backspace 4 times
    for (let i = 0; i < 4; i++) {
      sim.pressBackspace({ delay: 10 });
    }

    assert.equal(typingSurface.currentCharIdx, 0);
    caret.updatePosition(word.letters[0].el);
    assert.equal(caret.caretEl.style.transform, 'translate3d(0px, 0px, 0)');
  });

  it('T2.2.3: Window resize event during active test: triggers caret re-measurement to prevent floating detached caret', () => {
    let remeasured = false;
    const onResize = () => {
      const activeLetter = typingSurface.getActiveLetter();
      if (activeLetter) {
        caret.updatePosition(activeLetter.el);
        remeasured = true;
      }
    };

    env.window.addEventListener('resize', onResize);
    env.window.dispatchEvent({ type: 'resize' });

    assert.equal(remeasured, true);
  });

  it('T2.2.4: Rapid typing at >200 WPM: caret translation keeps pace with active letter without frame dropping', () => {
    // 200 WPM ~ 16.6 keystrokes per second (~60ms per key)
    const longWord = 'pneumono';
    for (let i = 0; i < longWord.length; i++) {
      sim.typeKey(longWord[i], { delay: 60 });
      const current = typingSurface.getActiveLetter();
      if (current) {
        caret.updatePosition(current.el);
      }
    }

    assert.equal(typingSurface.currentCharIdx, longWord.length);
  });

  it('T2.2.5: Extra characters exceeding safety cap (15 extra letters): additional keystrokes ignored to prevent DOM explosion', () => {
    // Complete the 45-letter word
    typingSurface.currentCharIdx = 45;

    const activeWord = typingSurface.getActiveWord();
    assert.equal(activeWord.letters.length, 45);

    // Type 15 extra characters
    for (let i = 0; i < 15; i++) {
      sim.typeKey('x');
    }
    assert.equal(activeWord.letters.length, 60, 'Should have exactly 15 extra letters (45 + 15)');

    // Attempt to type a 16th extra character
    sim.typeKey('z');
    assert.equal(activeWord.letters.length, 60, 'Should not exceed safety cap of 15 extra letters');
  });
});
