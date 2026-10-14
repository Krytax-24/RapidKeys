/**
 * tests/tier1-features/t1-f1-typing-surface.test.js
 * Tier 1: Feature Coverage - F1: In-Place Typing Surface
 * Tests: T1.1.1 through T1.1.6 (6 tests)
 * Requirement: ORIGINAL_REQUEST R1, Acceptance Criteria #39, #40, #13
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { createSimulator } from '../helpers/user-simulator.js';
import { getTypingSurfaceModule } from '../helpers/contract-bridge.js';

describe('Tier 1 - F1: In-Place Typing Surface', () => {
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
    typingSurface.loadWords(['speed', 'typing', 'surface']);

    sim = createSimulator(typingSurface.input, { performance: env.performance });
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T1.1.1: Correct keystroke adds .correct class to current <letter> and increments character pointer', () => {
    const activeWord = typingSurface.getActiveWord();
    assert.equal(activeWord.text, 'speed');
    assert.equal(typingSurface.currentCharIdx, 0);

    const firstLetter = activeWord.letters[0].el;
    assert.ok(!firstLetter.classList.contains('correct'));

    // Type 's' which matches the first letter of 'speed'
    sim.typeKey('s');

    assert.equal(typingSurface.currentCharIdx, 1);
    assert.ok(firstLetter.classList.contains('correct'));
    assert.ok(!firstLetter.classList.contains('incorrect'));
  });

  it('T1.1.2: Incorrect keystroke adds .incorrect class to current <letter> and increments character pointer', () => {
    const activeWord = typingSurface.getActiveWord();
    const firstLetter = activeWord.letters[0].el;

    // Target is 's', type 'x'
    sim.typeKey('x');

    assert.equal(typingSurface.currentCharIdx, 1);
    assert.ok(firstLetter.classList.contains('incorrect'));
    assert.ok(!firstLetter.classList.contains('correct'));
  });

  it('T1.1.3: Typing past word length dynamically creates and appends <letter class="letter extra incorrect">', () => {
    // Type all 5 characters of 'speed'
    sim.typeString('speed');
    assert.equal(typingSurface.currentCharIdx, 5);

    const activeWord = typingSurface.getActiveWord();
    assert.equal(activeWord.letters.length, 5);

    // Type extra characters 'x' and 'y'
    sim.typeKey('x');
    assert.equal(typingSurface.currentCharIdx, 6);
    assert.equal(activeWord.letters.length, 6);

    const extraLetter = activeWord.letters[5].el;
    assert.equal(extraLetter.textContent, 'x');
    assert.ok(extraLetter.classList.contains('extra'));
    assert.ok(extraLetter.classList.contains('incorrect'));

    sim.typeKey('y');
    assert.equal(typingSurface.currentCharIdx, 7);
    assert.equal(activeWord.letters.length, 7);
    assert.equal(activeWord.letters[6].el.textContent, 'y');
  });

  it('T1.1.4: Backspace unmarks previous character, restores .letter untyped state, or removes extra letter node', () => {
    // Type 's', then 'p'
    sim.typeString('sp');
    assert.equal(typingSurface.currentCharIdx, 2);

    const activeWord = typingSurface.getActiveWord();
    assert.ok(activeWord.letters[1].el.classList.contains('correct'));

    // Hit Backspace
    sim.pressBackspace();
    assert.equal(typingSurface.currentCharIdx, 1);
    assert.ok(!activeWord.letters[1].el.classList.contains('correct'));
    assert.ok(!activeWord.letters[1].el.classList.contains('incorrect'));

    // Now type entire word + extra letter
    sim.typeString('peedx');
    assert.equal(typingSurface.currentCharIdx, 6);
    assert.equal(activeWord.letters.length, 6);

    // Hit Backspace on extra letter
    sim.pressBackspace();
    assert.equal(typingSurface.currentCharIdx, 5);
    assert.equal(activeWord.letters.length, 5);
  });

  it('T1.1.5: Ctrl+Backspace clears entire current word, removing all extra letters and resetting untyped state', () => {
    // Type 3 letters + 2 extra letters
    sim.typeString('spexyz');
    const activeWord = typingSurface.getActiveWord();
    assert.ok(activeWord.letters.length > 5);

    // Press Ctrl+Backspace
    sim.pressShortcut('Ctrl+Backspace');

    assert.equal(typingSurface.currentCharIdx, 0);
    assert.equal(activeWord.letters.length, 5);
    activeWord.letters.forEach(letter => {
      assert.ok(!letter.el.classList.contains('correct'));
      assert.ok(!letter.el.classList.contains('incorrect'));
      assert.ok(!letter.el.classList.contains('extra'));
    });
  });

  it('T1.1.6: Space bar advances to next word, marks any remaining untyped letters in current word as .missed', () => {
    // Type first 2 letters of 'speed' ('sp'), then hit Space to skip remainder
    sim.typeString('sp');
    assert.equal(typingSurface.currentWordIdx, 0);

    const firstWord = typingSurface.getActiveWord();

    sim.pressSpace();

    // Must have advanced to word index 1
    assert.equal(typingSurface.currentWordIdx, 1);
    assert.equal(typingSurface.currentCharIdx, 0);
    assert.equal(typingSurface.getActiveWord().text, 'typing');

    // Remaining letters in first word ('e', 'e', 'd') must be marked missed
    assert.ok(firstWord.letters[2].el.classList.contains('missed'));
    assert.ok(firstWord.letters[3].el.classList.contains('missed'));
    assert.ok(firstWord.letters[4].el.classList.contains('missed'));
  });
});
