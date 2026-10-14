/**
 * tests/tier2-boundary/t2-f1-typing-boundaries.test.js
 * Tier 2: Boundary & Corner Cases - B1: Typing Boundaries
 * Tests: T2.1.1 through T2.1.5 (5 tests)
 * Requirement: Boundary value analysis for keyboard input, pointers, modifiers
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { createSimulator } from '../helpers/user-simulator.js';
import { getTypingSurfaceModule, getMetricsModule } from '../helpers/contract-bridge.js';

describe('Tier 2 - B1: Typing Boundaries & Corner Cases', () => {
  let env;
  let typingSurface;
  let container;
  let sim;

  beforeEach(async () => {
    env = createTestEnvironment();
    container = env.document.createElement('div');
    container.id = 'app';
    env.document.body.appendChild(container);

    const { TypingSurface } = await getTypingSurfaceModule();
    typingSurface = new TypingSurface();
    typingSurface.mount(container);
    typingSurface.loadWords(['rapid', 'keys', 'speed']);

    sim = createSimulator(typingSurface.input, { performance: env.performance });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T2.1.1: Zero keypresses during active test until timeout: returns 0 Net WPM, 0 Raw WPM, 100% accuracy without NaN / 0/0 errors', async () => {
    const { calculateNetWpm, calculateRawWpm, calculateAccuracy } = await getMetricsModule();

    // 0 characters typed in 30 seconds
    const netWpm = calculateNetWpm(0, 30);
    const rawWpm = calculateRawWpm(0, 30);
    const accuracy = calculateAccuracy(0, 0);

    assert.equal(netWpm, 0);
    assert.equal(rawWpm, 0);
    assert.equal(accuracy, 100);
    assert.ok(!Number.isNaN(netWpm));
    assert.ok(!Number.isNaN(rawWpm));
    assert.ok(!Number.isNaN(accuracy));
  });

  it('T2.1.2: Backspace at index 0 of first word: no-op, pointer stays >= 0, no negative indexing or crash', () => {
    assert.equal(typingSurface.currentWordIdx, 0);
    assert.equal(typingSurface.currentCharIdx, 0);

    // Hit backspace 5 times at start of test
    for (let i = 0; i < 5; i++) {
      sim.pressBackspace();
    }

    assert.equal(typingSurface.currentWordIdx, 0);
    assert.equal(typingSurface.currentCharIdx, 0);
    assert.equal(typingSurface.getActiveWord().text, 'rapid');
  });

  it('T2.1.3: Space pressed at index 0 of word (empty word): ignored completely, prevents accidental word skipping', () => {
    assert.equal(typingSurface.currentWordIdx, 0);
    assert.equal(typingSurface.currentCharIdx, 0);

    // Attempt to skip first word by pressing Space immediately
    sim.pressSpace();

    assert.equal(typingSurface.currentWordIdx, 0, 'Word index must not advance on empty word');
    assert.equal(typingSurface.currentCharIdx, 0);
    assert.equal(typingSurface.getActiveWord().text, 'rapid');
  });

  it('T2.1.4: Rapid burst keypresses within 0ms timestamp difference (dt == 0): velocity calculation avoids division by zero (Infinity)', async () => {
    const { calculateNetWpm, calculateRawWpm } = await getMetricsModule();

    // 2 keystrokes at dt = 0.0 seconds
    const netWpm = calculateNetWpm(2, 0);
    const rawWpm = calculateRawWpm(2, 0);

    assert.equal(netWpm, 0);
    assert.equal(rawWpm, 0);
    assert.ok(Number.isFinite(netWpm), 'Net WPM must not be Infinity');
    assert.ok(Number.isFinite(rawWpm), 'Raw WPM must not be Infinity');
  });

  it('T2.1.5: Non-printable modifier keys pressed (Shift, Control, Alt, CapsLock): ignored by typing engine, does not register as incorrect character', () => {
    const activeWord = typingSurface.getActiveWord();
    const firstLetter = activeWord.letters[0].el;

    // Send modifiers
    sim.typeKey('Shift');
    sim.typeKey('Control');
    sim.typeKey('Alt');
    sim.typeKey('CapsLock');
    sim.typeKey('Meta');

    assert.equal(typingSurface.currentCharIdx, 0, 'Pointer must remain at 0');
    assert.ok(!firstLetter.classList.contains('incorrect'), 'Modifier must not tint letter as incorrect');
    assert.ok(!firstLetter.classList.contains('correct'));
  });
});
