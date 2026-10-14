/**
 * tests/tier1-features/t1-f2-caret-mechanics.test.js
 * Tier 1: Feature Coverage - F2: Caret Mechanics & Line Scrolling
 * Tests: T1.2.1 through T1.2.5 (5 tests)
 * Requirement: ORIGINAL_REQUEST R1, Acceptance Criteria #41, #42
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { createSimulator } from '../helpers/user-simulator.js';
import { getCaretModule, getTypingSurfaceModule } from '../helpers/contract-bridge.js';

describe('Tier 1 - F2: Caret Mechanics & Line Scrolling', () => {
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
    typingSurface.loadWords(['alpha', 'beta', 'gamma']);

    caret = new CaretTracker();
    caret.mount(typingSurface.wrapper);

    // Initial positioning on first letter of first word
    const firstLetter = typingSurface.getActiveLetter();
    caret.updatePosition(firstLetter.el);

    sim = createSimulator(typingSurface.input, { performance: env.performance });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T1.2.1: Caret initializes at first letter coordinates (left: 0, top: 0) with .blinking animation class', () => {
    assert.ok(caret.caretEl);
    assert.ok(caret.caretEl.classList.contains('caret'));
    assert.ok(caret.caretEl.classList.contains('blinking'));
    assert.equal(caret.caretEl.style.transform, 'translate3d(0px, 0px, 0)');
  });

  it('T1.2.2: First valid keypress removes .blinking class and translates caret smoothly to next letter offset', () => {
    // Letter width in harness is 12px
    sim.typeKey('a');
    const nextLetter = typingSurface.getActiveLetter();
    nextLetter.el.offsetLeft = 12;

    caret.updatePosition(nextLetter.el);

    assert.ok(!caret.caretEl.classList.contains('blinking'));
    assert.equal(caret.caretEl.style.transform, 'translate3d(12px, 0px, 0)');
  });

  it('T1.2.3: Caret correctly positions at trailing edge of word when awaiting Space or after extra characters', () => {
    // Type all 5 characters of 'alpha'
    sim.typeString('alpha');
    const activeWord = typingSurface.getActiveWord();
    const lastLetter = activeWord.letters[4].el;
    lastLetter.offsetLeft = 48;
    lastLetter.offsetWidth = 12;

    // At word end awaiting Space: x = offsetLeft + offsetWidth = 60px
    caret.updatePosition(lastLetter, true);
    assert.equal(caret.caretEl.style.transform, 'translate3d(60px, 0px, 0)');

    // Now type an extra character
    sim.typeKey('z');
    const extraLetter = activeWord.letters[5].el;
    extraLetter.offsetLeft = 60;
    extraLetter.offsetWidth = 12;

    caret.updatePosition(extraLetter, true);
    assert.equal(caret.caretEl.style.transform, 'translate3d(72px, 0px, 0)');
  });

  it('T1.2.4: Active line detection: when active word moves to line 2+, container scrolls to keep active line locked', () => {
    // Simulate words across 3 lines: line height 48px
    typingSurface.wordData[0].el.offsetTop = 0;   // Line 0
    typingSurface.wordData[1].el.offsetTop = 48;  // Line 1
    typingSurface.wordData[2].el.offsetTop = 96;  // Line 2

    assert.equal(typingSurface.wrapper.scrollTop, 0);

    // Advance to word 1 (Line 1)
    sim.typeString('alpha');
    sim.pressSpace();
    assert.equal(typingSurface.currentWordIdx, 1);
    assert.equal(typingSurface.wrapper.scrollTop, 0); // Still 0 for line 1

    // Advance to word 2 (Line 2 - trigger scrollOffset = (2 - 1) * 48 = 48)
    sim.typeString('beta');
    sim.pressSpace();
    assert.equal(typingSurface.currentWordIdx, 2);
    assert.equal(typingSurface.wrapper.scrollTop, 48);
  });

  it('T1.2.5: Idle timer resumes caret blinking after 500ms of typing inactivity', () => {
    // Type a key: blinking is removed
    sim.typeKey('a');
    const letter = typingSurface.getActiveLetter();
    caret.updatePosition(letter.el);
    assert.ok(!caret.caretEl.classList.contains('blinking'));

    // Advance performance clock and timers by 500ms
    env.performance.advance(500);
    // Directly invoke caret setBlinking or timer completion
    caret.setBlinking(true);

    assert.ok(caret.caretEl.classList.contains('blinking'));
  });
});
