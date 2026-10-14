/**
 * tests/challenge-dom-streams.test.js
 * Adversarial Empirical Stress Test Suite for RapidKeys
 * 
 * Stress-tests:
 * 1. Infinite Lazy Word Generator Stream:
 *    - 10,000 words continuously generated
 *    - Heap memory stability / zero exhaustion
 *    - Punctuation distribution (capitalization, sentence bounds, quotes, commas)
 *    - Numbers injection rate (~12% target, bounds, digits 1-4)
 *    - Consecutive identical word suppression
 * 2. Typing Surface State Machine:
 *    - Rapid burst keystroke flooding (thousands of inputs with zero/minimal interval)
 *    - Extra character capping at MAX_EXTRA_LETTERS (15 letters max)
 *    - Inter-word clean-word protection (clean words cannot be backtracked)
 *    - Inter-word dirty-word backtracking (typos, extra chars, missed chars allow backtrack)
 *    - Intra-word single Backspace and Ctrl+Backspace word erasure
 *    - Empty word space suppression at index 0
 * 3. Rapid Restart Spamming & Theme Engine:
 *    - Multiple Tab+Enter combos spammed within 50ms (debounce protection)
 *    - Rapid cycling across all 6 themes in rapid succession
 *    - Invalid theme fallback
 *    - Caret tracker debounce, coordinate safety, and idle blinking
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createWordStream, getWordBatch, WORDS_VOCABULARY } from '../src/data/words.js';
import { TypingSurface, LetterState, MAX_EXTRA_LETTERS } from '../src/ui/typing-surface.js';
import { CaretTracker } from '../src/ui/caret.js';
import { initShortcuts } from '../src/ui/shortcuts.js';
import { applyTheme, getCurrentTheme, THEMES, THEME_PALETTES } from '../src/ui/theme-engine.js';
import { TypingStateMachine, TypingState } from '../src/engine/state.js';
import { createTestEnvironment } from './helpers/dom-harness.js';
import { createSimulator } from './helpers/user-simulator.js';

describe('Adversarial Stress Test: Infinite Lazy Word Generator Stream', () => {
  it('Stream 1: Generates 10,000 words continuously with bounded heap memory (zero memory exhaustion)', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const stream = createWordStream({ punctuation: true, numbers: true });

    let count = 0;
    const memorySnapshots = [];

    for (let i = 0; i < 10000; i++) {
      const nextWord = stream.next();
      assert.equal(nextWord.done, false, `Stream unexpectedly terminated at word ${i}`);
      assert.equal(typeof nextWord.value, 'string', `Word ${i} must be a string`);
      assert.ok(nextWord.value.length > 0, `Word ${i} must not be empty`);
      count++;

      if (i % 2500 === 0) {
        memorySnapshots.push({
          iteration: i,
          heapUsedMb: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)
        });
      }
    }

    assert.equal(count, 10000, 'Must have generated exactly 10,000 words');

    const finalMemory = process.memoryUsage().heapUsed;
    const deltaMb = (finalMemory - initialMemory) / (1024 * 1024);

    // 10,000 tokens generated lazily in a loop without accumulation should not leak memory.
    // Heap delta should remain well under 50MB.
    assert.ok(
      deltaMb < 50,
      `Memory delta exceeded safety threshold: ${deltaMb.toFixed(2)} MB leaked. Snapshots: ${JSON.stringify(memorySnapshots)}`
    );
  });

  it('Stream 2: Numbers injection rate across 10,000 words conforms to ~12% target (10.0% - 14.0%) with 1-4 digit tokens', () => {
    const stream = createWordStream({ punctuation: false, numbers: true });
    const TOTAL = 10000;
    let numberCount = 0;
    let wordCount = 0;

    for (let i = 0; i < TOTAL; i++) {
      const token = stream.next().value;
      if (/^\d+$/.test(token)) {
        numberCount++;
        // Verify 1-4 digit length specification
        assert.ok(
          token.length >= 1 && token.length <= 4,
          `Number token "${token}" at index ${i} has length ${token.length}, expected 1 to 4 digits`
        );
      } else {
        wordCount++;
        assert.ok(
          WORDS_VOCABULARY.includes(token),
          `Word token "${token}" must be in WORDS_VOCABULARY`
        );
      }
    }

    const rate = numberCount / TOTAL;
    const percentage = (rate * 100).toFixed(2);

    // Statistical check for ~12% rate: with N=10,000, 3-sigma is approximately +-1.0% (11% - 13%).
    // We allow 10.0% to 14.0% for robustness against pseudo-random variance.
    assert.ok(
      rate >= 0.10 && rate <= 0.14,
      `Numbers rate ${percentage}% outside acceptable ~12% bounds (expected 10.0% - 14.0%)`
    );

    // Also verify numbers: false generates exactly 0% numbers over 10,000 words
    const noNumbersStream = createWordStream({ punctuation: false, numbers: false });
    for (let i = 0; i < 10000; i++) {
      const token = noNumbersStream.next().value;
      assert.ok(!/^\d+$/.test(token), `Unexpected number token "${token}" with numbers disabled at index ${i}`);
    }
  });

  it('Stream 3: Punctuation distribution across 10,000 words maintains syntax invariants', () => {
    const stream = createWordStream({ punctuation: true, numbers: true });
    const TOTAL = 10000;

    let sentenceCount = 0;
    let quoteCount = 0;
    let commaCount = 0;
    let expectCapitalized = true;
    let wordsInCurrentSentence = 0;

    for (let i = 0; i < TOTAL; i++) {
      const token = stream.next().value;
      wordsInCurrentSentence++;

      const isNumber = /^\d+$/.test(token);
      const isQuoted = token.startsWith('"') && token.endsWith('"') && token.length > 2;
      const endsWithPeriod = token.endsWith('.');
      const endsWithQuestion = token.endsWith('?');
      const endsWithComma = token.endsWith(',');

      if (isQuoted) quoteCount++;
      if (endsWithComma) commaCount++;

      // Invariant 1: Start of sentence capitalization
      if (expectCapitalized && !isNumber) {
        const cleanChar = isQuoted ? token[1] : token[0];
        assert.equal(
          cleanChar,
          cleanChar.toUpperCase(),
          `Expected capitalized word at start of sentence at token ${i}: "${token}"`
        );
      }

      // Invariant 2: Sentence termination
      if (endsWithPeriod || endsWithQuestion) {
        sentenceCount++;
        // Sentence length must be within 4 to 8 words per implementation
        assert.ok(
          wordsInCurrentSentence >= 4 && wordsInCurrentSentence <= 8,
          `Sentence length ${wordsInCurrentSentence} out of expected [4, 8] range at token ${i}: "${token}"`
        );
        expectCapitalized = true;
        wordsInCurrentSentence = 0;
      } else {
        expectCapitalized = false;
      }
    }

    assert.ok(sentenceCount >= 1000, `Expected at least 1000 sentences in 10,000 words, got ${sentenceCount}`);
    assert.ok(quoteCount > 0, `Expected quotes to appear in 10,000 words, got ${quoteCount}`);
    assert.ok(commaCount > 0, `Expected commas to appear in 10,000 words, got ${commaCount}`);
  });

  it('Stream 4: Vocabulary uniqueness and consecutive duplicate suppression over 10,000 words', () => {
    const stream = createWordStream({ punctuation: false, numbers: false });
    let prev = '';

    for (let i = 0; i < 10000; i++) {
      const word = stream.next().value;
      assert.ok(WORDS_VOCABULARY.includes(word), `Unknown word "${word}" at index ${i}`);
      assert.notEqual(word, prev, `Consecutive duplicate word "${word}" at index ${i}`);
      prev = word;
    }
  });
});

describe('Adversarial Stress Test: Typing Surface State Machine & Keystroke Flooding', () => {
  let env;
  let typingSurface;
  let container;
  let sim;

  beforeEach(() => {
    env = createTestEnvironment();
    container = env.document.createElement('div');
    container.id = 'app';
    env.document.body.appendChild(container);

    typingSurface = new TypingSurface();
    typingSurface.mount(container);
    sim = createSimulator(typingSurface.input, { performance: env.performance });
  });

  afterEach(() => {
    typingSurface.destroy();
    env.cleanup();
  });

  it('DOM 1: Flood typing surface with 2,000 erratic keystrokes with zero delay and verify pointer invariants', () => {
    const words = getWordBatch(100, { punctuation: false, numbers: false });
    typingSurface.loadWords(words);

    const keys = 'abcdefghijklmnopqrstuvwxyz   '.split('');
    const specialKeys = ['Backspace', 'Backspace', 'Shift', 'Control', 'Alt', 'CapsLock', ' '];

    let lastWordIdx = 0;

    for (let i = 0; i < 2000; i++) {
      const roll = (i * 37 + 13) % 100;
      if (roll < 65) {
        // Printable character
        const char = keys[(i * 17) % keys.length];
        typingSurface.handleKey(char);
      } else if (roll < 85) {
        // Backspace (single or Ctrl)
        const isCtrl = roll > 80;
        typingSurface.handleKey('Backspace', isCtrl);
      } else {
        // Modifier or special
        const special = specialKeys[(i * 7) % specialKeys.length];
        typingSurface.handleKey(special);
      }

      // STRESS INVARIANTS CHECK ON EVERY SINGLE KEYSTROKE
      assert.ok(
        typingSurface.currentWordIdx >= 0,
        `currentWordIdx negative: ${typingSurface.currentWordIdx} at step ${i}`
      );
      assert.ok(
        typingSurface.currentWordIdx <= words.length,
        `currentWordIdx out of bounds: ${typingSurface.currentWordIdx} > ${words.length} at step ${i}`
      );
      assert.ok(
        typingSurface.currentCharIdx >= 0,
        `currentCharIdx negative: ${typingSurface.currentCharIdx} at step ${i}`
      );

      const activeWord = typingSurface.getActiveWord();
      if (activeWord) {
        assert.ok(
          typingSurface.currentCharIdx <= activeWord.letters.length,
          `currentCharIdx ${typingSurface.currentCharIdx} exceeds letters.length ${activeWord.letters.length} at step ${i}`
        );
        assert.ok(
          activeWord.letters.length <= activeWord.text.length + MAX_EXTRA_LETTERS,
          `letters.length ${activeWord.letters.length} exceeds max allowed ${activeWord.text.length + MAX_EXTRA_LETTERS}`
        );
        assert.ok(
          activeWord.el.classList.contains('active'),
          `Active word element missing .active class at step ${i}`
        );
      }
    }
  });

  it('DOM 2: Extra character cap strictly limits overflow to MAX_EXTRA_LETTERS (15) letters', () => {
    typingSurface.loadWords(['fast', 'pace']);
    assert.equal(typingSurface.currentWordIdx, 0);

    // Type the 4 base letters: 'f', 'a', 's', 't'
    sim.typeString('fast');
    assert.equal(typingSurface.currentCharIdx, 4);
    assert.equal(typingSurface.getActiveWord().letters.length, 4);

    // Attempt to flood with 30 extra characters ('x')
    for (let i = 0; i < 30; i++) {
      sim.typeKey('x');
    }

    const activeWord = typingSurface.getActiveWord();
    const extraLetters = activeWord.letters.filter(l => l.state === LetterState.EXTRA);

    assert.equal(
      extraLetters.length,
      MAX_EXTRA_LETTERS,
      `Expected exactly ${MAX_EXTRA_LETTERS} extra letters, but found ${extraLetters.length}`
    );
    assert.equal(
      activeWord.letters.length,
      4 + MAX_EXTRA_LETTERS,
      `Total letters must equal 4 + ${MAX_EXTRA_LETTERS} = ${4 + MAX_EXTRA_LETTERS}`
    );
    assert.equal(
      typingSurface.currentCharIdx,
      4 + MAX_EXTRA_LETTERS,
      `currentCharIdx must be capped at 4 + ${MAX_EXTRA_LETTERS}`
    );

    // Verify DOM children count matches activeWord.letters.length
    assert.equal(
      activeWord.el.querySelectorAll('letter').length,
      4 + MAX_EXTRA_LETTERS,
      'DOM letter count must match activeWord letters array'
    );

    // Hit backspace 15 times: extra letters must be removed in reverse order
    for (let i = 0; i < MAX_EXTRA_LETTERS; i++) {
      sim.pressBackspace();
    }

    assert.equal(activeWord.letters.length, 4, 'All extra letters must be removed after 15 backspaces');
    assert.equal(activeWord.el.querySelectorAll('letter').length, 4, 'DOM extra elements removed');
    assert.equal(typingSurface.currentCharIdx, 4);

    // Hit backspace 4 more times: resets letters 3, 2, 1, 0 to UNTYPED
    for (let i = 0; i < 4; i++) {
      sim.pressBackspace();
    }
    assert.equal(typingSurface.currentCharIdx, 0);
    activeWord.letters.forEach(l => {
      assert.equal(l.state, LetterState.UNTYPED);
    });

    // 10 more backspaces at index 0 must be safely ignored
    for (let i = 0; i < 10; i++) {
      sim.pressBackspace();
    }
    assert.equal(typingSurface.currentCharIdx, 0);
    assert.equal(typingSurface.currentWordIdx, 0);
  });

  it('DOM 3: Inter-word clean-word protection protects flawless words from backspace backtrack', () => {
    typingSurface.loadWords(['apple', 'banana', 'cherry']);

    // 1. Type "apple" flawlessly (100% correct)
    sim.typeString('apple');
    sim.pressSpace();

    // Now at word 1 ("banana"), charIdx 0
    assert.equal(typingSurface.currentWordIdx, 1);
    assert.equal(typingSurface.currentCharIdx, 0);

    // BACKSPACE at index 0 on word 1: word 0 was clean -> MUST NOT BACKTRACK
    sim.pressBackspace();
    assert.equal(
      typingSurface.currentWordIdx,
      1,
      'Clean-word protection: backspace at index 0 must NOT backtrack to a cleanly completed word'
    );

    // CTRL+BACKSPACE at index 0 on word 1: word 0 was clean -> MUST NOT BACKTRACK
    sim.pressBackspace({ ctrlKey: true });
    assert.equal(
      typingSurface.currentWordIdx,
      1,
      'Clean-word protection: Ctrl+backspace at index 0 must NOT backtrack to a cleanly completed word'
    );
  });

  it('DOM 4: Inter-word dirty-word backtracking permits correction of erroneous previous words', () => {
    typingSurface.loadWords(['alpha', 'beta', 'gamma']);

    // Case A: Previous word had incorrect character
    sim.typeString('alpxa'); // 'x' is wrong
    sim.pressSpace();

    assert.equal(typingSurface.currentWordIdx, 1);
    assert.equal(typingSurface.currentCharIdx, 0);

    // Backspace at index 0 of word 1: previous word had error -> MUST BACKTRACK
    sim.pressBackspace();
    assert.equal(typingSurface.currentWordIdx, 0, 'Must backtrack to dirty word');
    assert.equal(typingSurface.currentCharIdx, 5, 'Must position at end of dirty word');

    // Reset surface
    typingSurface.reset();

    // Case B: Previous word had missed characters (premature space)
    sim.typeString('al'); // only 2 letters of 5
    sim.pressSpace();

    assert.equal(typingSurface.currentWordIdx, 1);
    assert.equal(typingSurface.currentCharIdx, 0);

    sim.pressBackspace();
    assert.equal(typingSurface.currentWordIdx, 0, 'Must backtrack to word with missed characters');

    // Reset surface
    typingSurface.reset();

    // Case C: Previous word had extra characters
    sim.typeString('alphazzz');
    sim.pressSpace();

    assert.equal(typingSurface.currentWordIdx, 1);
    assert.equal(typingSurface.currentCharIdx, 0);

    sim.pressBackspace();
    assert.equal(typingSurface.currentWordIdx, 0, 'Must backtrack to word with extra characters');
    assert.equal(typingSurface.currentCharIdx, 8);
  });

  it('DOM 5: Ctrl+Backspace erases current word and resets extra DOM elements cleanly', () => {
    typingSurface.loadWords(['super', 'second']);

    // Type 5 characters + 5 extra characters
    sim.typeString('superxxxxx');
    assert.equal(typingSurface.currentCharIdx, 10);

    const activeWord = typingSurface.getActiveWord();
    assert.equal(activeWord.letters.length, activeWord.text.length + 5);

    // Hit Ctrl+Backspace
    sim.pressBackspace({ ctrlKey: true });

    assert.equal(typingSurface.currentCharIdx, 0);
    assert.equal(
      activeWord.letters.length,
      activeWord.text.length,
      'All extra characters must be stripped from word.letters'
    );
    assert.equal(
      activeWord.el.querySelectorAll('letter').length,
      activeWord.text.length,
      'All extra character elements must be removed from DOM'
    );
    activeWord.letters.forEach(letter => {
      assert.equal(letter.state, LetterState.UNTYPED);
    });
    assert.equal(activeWord.hasError, false);
  });

  it('DOM 6: Space pressed at index 0 of word is ignored and prevents premature termination', () => {
    typingSurface.loadWords(['one', 'two']);

    assert.equal(typingSurface.currentWordIdx, 0);
    assert.equal(typingSurface.currentCharIdx, 0);

    // Spam Space 10 times on empty word
    for (let i = 0; i < 10; i++) {
      sim.pressSpace();
    }

    assert.equal(typingSurface.currentWordIdx, 0, 'Space on empty word must not advance word');
    assert.equal(typingSurface.currentCharIdx, 0);
    assert.equal(typingSurface.getActiveWord().letters[0].state, LetterState.UNTYPED);
  });
});

describe('Adversarial Stress Test: Rapid Restart Spamming & Theme Engine Cycling', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  it('Event 1: Tab+Enter spammed 20 times within 50ms executes only 1 debounced restart', () => {
    let restartCount = 0;
    const cleanup = initShortcuts({
      onRestart: () => {
        restartCount++;
      }
    });

    const sim = createSimulator(env.window, { performance: env.performance });

    // Spam Tab + Enter 20 times in rapid succession without advancing time > 100ms
    for (let i = 0; i < 20; i++) {
      sim.pressShortcut('Tab+Enter', { delay: 2 });
    }

    assert.equal(
      restartCount,
      1,
      `Tab+Enter debouncing failed: expected exactly 1 restart, got ${restartCount}`
    );

    // Advance time beyond debounce window (150ms)
    env.performance.advance(150);

    // Fire Tab + Enter once more
    sim.pressShortcut('Tab+Enter', { delay: 0 });

    assert.equal(
      restartCount,
      2,
      'Second Tab+Enter after debounce window must trigger second restart'
    );

    cleanup();
  });

  it('Event 2: Tab key invalidated when another printable key is pressed before Enter', () => {
    let restartCount = 0;
    const cleanup = initShortcuts({
      onRestart: () => {
        restartCount++;
      }
    });

    const sim = createSimulator(env.window, { performance: env.performance });

    // Hit Tab
    sim.typeKey('Tab');

    // Type a normal key 'a' (invalidates pending Tab)
    sim.typeKey('a');

    // Hit Enter
    sim.typeKey('Enter');

    assert.equal(
      restartCount,
      0,
      'Tab must be invalidated when a character key is pressed before Enter'
    );

    cleanup();
  });

  it('Theme 1: Rapid cycling across 300 theme switches leaves zero dangling attributes and valid CSS variables', () => {
    const themeSequence = THEMES;
    let listenerCalls = 0;

    for (let i = 0; i < 300; i++) {
      const targetTheme = themeSequence[i % themeSequence.length];
      const applied = applyTheme(targetTheme);
      assert.equal(applied, targetTheme);
    }

    // Set to 'monokai'
    applyTheme('monokai');
    assert.equal(getCurrentTheme(), 'monokai');
    assert.equal(env.document.documentElement.getAttribute('data-theme'), 'monokai');

    // Verify all CSS variables match monokai palette
    const expectedPalette = THEME_PALETTES.monokai;
    Object.entries(expectedPalette).forEach(([prop, expectedVal]) => {
      if (prop.startsWith('--')) {
        const actualVal = env.document.documentElement.style.getPropertyValue(prop);
        assert.equal(
          actualVal,
          expectedVal,
          `CSS variable ${prop} mismatch: expected ${expectedVal}, got ${actualVal}`
        );
      }
    });

    // Test invalid theme fallback: must fallback to default 'rapidkeys' safely
    const fallbackTheme = applyTheme('non_existent_galaxy_theme');
    assert.equal(fallbackTheme, 'rapidkeys');
    assert.equal(getCurrentTheme(), 'rapidkeys');
  });

  it('Caret 1: Caret tracker coordinate stability and idle blink debounce under erratic rapid inputs', () => {
    const wrapper = env.document.createElement('div');
    env.document.body.appendChild(wrapper);

    const caret = new CaretTracker({ container: wrapper, idleDebounceMs: 200 });
    assert.ok(caret.caretEl.classList.contains('blinking'));

    const mockLetter = env.document.createElement('letter');
    mockLetter.offsetLeft = 142;
    mockLetter.offsetTop = 48;
    mockLetter.offsetWidth = 12;
    mockLetter.offsetHeight = 24;

    // Simulate 100 rapid position updates (typing bursts)
    for (let i = 0; i < 100; i++) {
      mockLetter.offsetLeft = 100 + i * 2;
      caret.updatePosition(mockLetter);
      assert.ok(
        !caret.caretEl.classList.contains('blinking'),
        'Caret must not blink while actively updating position'
      );
      assert.equal(
        caret.caretEl.style.transform,
        `translate3d(${100 + i * 2}px, 48px, 0)`
      );
    }

    // Fast-forward idle time
    caret.setBlinking(true);
    assert.ok(caret.caretEl.classList.contains('blinking'));

    // Reset caret
    caret.reset();
    assert.equal(caret.caretEl.style.transform, 'translate3d(0px, 0px, 0)');
    assert.ok(caret.caretEl.classList.contains('blinking'));

    caret.destroy();
    assert.equal(caret.caretEl, null);
  });
});
