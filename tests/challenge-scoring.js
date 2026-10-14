/**
 * tests/challenge-scoring.js
 * Adversarial Challenger Stress Harness for RapidKeys Precision Scoring & Telemetry
 * 
 * Stress-tests:
 * 1. 25 correct characters in 30.0s = exactly 10 Net WPM (+ precision & boundary cases)
 * 2. Raw WPM vs Net WPM with uncorrected errors and extra letters
 * 3. Accuracy calculations with multiple typo corrections (typo + backspace + correct)
 * 4. Consistency CV formula with zero deviation, massive variance, single-sample,
 *    zero elapsed time, and extreme values (verify bounded [0, 100])
 * 5. Rapid burst keypresses with dt = 0
 * 6. High-volume Monte Carlo / Fuzz invariant verification
 */

import assert from 'node:assert/strict';
import {
  calculateNetWpm,
  calculateRawWpm,
  calculateAccuracy,
  calculateConsistency,
  getCharacterBreakdown
} from '../src/engine/metrics.js';
import { TelemetryLogger, createTelemetryLogger } from '../src/engine/telemetry.js';
import { TypingStateMachine, TypingState } from '../src/engine/state.js';
import { TypingSurface, LetterState, MAX_EXTRA_LETTERS } from '../src/ui/typing-surface.js';
import { createTestEnvironment } from './helpers/dom-harness.js';
import { createSimulator } from './helpers/user-simulator.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) {
      console.error(`    ${err.stack.split('\n').slice(1, 3).join('\n')}`);
    }
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('================================================================');
console.log('RAPIDKEYS ADVERSARIAL STRESS HARNESS — PRECISION SCORING ENGINE');
console.log('================================================================\n');

// ============================================================================
// SECTION 1: 25 Correct Chars in 30.0s = Exactly 10 Net WPM & Precision Cases
// ============================================================================
console.log('--- Section 1: Net WPM Precision & Authoritative 25 in 30.0s ---');

runTest('1.1: Authoritative spec check: 25 correct chars in 30.0s returns exactly 10 Net WPM', () => {
  const result = calculateNetWpm(25, 30.0);
  assert.strictEqual(result, 10, `Expected 10, got ${result}`);
});

runTest('1.2: Integer 30s elapsed time check: 25 chars in 30s = 10 Net WPM', () => {
  const result = calculateNetWpm(25, 30);
  assert.strictEqual(result, 10);
});

runTest('1.3: Scaled durations matching 10 Net WPM: 50 in 60s, 100 in 120s, 12.5 in 15s', () => {
  assert.strictEqual(calculateNetWpm(50, 60.0), 10);
  assert.strictEqual(calculateNetWpm(100, 120.0), 10);
  assert.strictEqual(calculateNetWpm(12.5, 15.0), 10);
});

runTest('1.4: Microsecond jitter around 30.0s: 29.999s and 30.001s rounds to 10 Net WPM', () => {
  assert.strictEqual(calculateNetWpm(25, 29.999), 10);
  assert.strictEqual(calculateNetWpm(25, 30.001), 10);
  assert.strictEqual(calculateNetWpm(25, 29.999999), 10);
  assert.strictEqual(calculateNetWpm(25, 30.000001), 10);
});

runTest('1.5: Rounding thresholds at 30s: 24 chars -> 10 WPM (9.6), 23 chars -> 9 WPM (9.2)', () => {
  assert.strictEqual(calculateNetWpm(24, 30.0), 10);
  assert.strictEqual(calculateNetWpm(23, 30.0), 9);
  assert.strictEqual(calculateNetWpm(26, 30.0), 10); // 10.4
  assert.strictEqual(calculateNetWpm(27, 30.0), 11); // 10.8
});

runTest('1.6: String coercion: string "25" and "30.0" evaluate safely to 10', () => {
  assert.strictEqual(calculateNetWpm('25', '30.0'), 10);
});

runTest('1.7: Non-finite and boundary guards: 0, negative, NaN, Infinity return 0', () => {
  assert.strictEqual(calculateNetWpm(0, 30), 0);
  assert.strictEqual(calculateNetWpm(25, 0), 0);
  assert.strictEqual(calculateNetWpm(-25, 30), 0);
  assert.strictEqual(calculateNetWpm(25, -30), 0);
  assert.strictEqual(calculateNetWpm(NaN, 30), 0);
  assert.strictEqual(calculateNetWpm(25, NaN), 0);
  assert.strictEqual(calculateNetWpm(Infinity, 30), 0);
  assert.strictEqual(calculateNetWpm(25, Infinity), 0);
  assert.strictEqual(calculateNetWpm(null, undefined), 0);
});

runTest('1.8: Extreme speed test: 1,500 chars in 60s outputs 300 Net WPM without overflow', () => {
  assert.strictEqual(calculateNetWpm(1500, 60.0), 300);
});

// ============================================================================
// SECTION 2: Raw WPM vs Net WPM With Uncorrected Errors and Extra Letters
// ============================================================================
console.log('\n--- Section 2: Raw WPM vs Net WPM (Errors & Extra Letters) ---');

runTest('2.1: 25 correct + 10 uncorrected errors in 30s: Net WPM = 10, Raw WPM = 14', () => {
  const correct = 25;
  const uncorrected = 10;
  const total = correct + uncorrected; // 35
  const elapsed = 30.0;

  assert.strictEqual(calculateNetWpm(correct, elapsed), 10);
  assert.strictEqual(calculateRawWpm(total, elapsed), 14);
});

runTest('2.2: 25 correct + 5 extra overflow letters in 30s: Net WPM = 10, Raw WPM = 12', () => {
  const correct = 25;
  const extra = 5;
  const total = correct + extra; // 30
  const elapsed = 30.0;

  assert.strictEqual(calculateNetWpm(correct, elapsed), 10);
  assert.strictEqual(calculateRawWpm(total, elapsed), 12);
});

runTest('2.3: Combined 25 correct + 10 uncorrected + 5 extra in 30s: Net = 10, Raw = 16', () => {
  const correct = 25;
  const uncorrected = 10;
  const extra = 5;
  const total = correct + uncorrected + extra; // 40
  const elapsed = 30.0;

  assert.strictEqual(calculateNetWpm(correct, elapsed), 10);
  assert.strictEqual(calculateRawWpm(total, elapsed), 16);
});

runTest('2.4: 100% incorrect typing (0 correct, 50 wrong chars in 30s): Net = 0, Raw = 20', () => {
  const elapsed = 30.0;
  assert.strictEqual(calculateNetWpm(0, elapsed), 0);
  assert.strictEqual(calculateRawWpm(50, elapsed), 20);
});

runTest('2.5: Missed characters do NOT count towards Raw WPM or Net WPM', () => {
  // User typed 2 chars out of a 5 char word, then pressed space (leaving 3 missed)
  const breakdown = getCharacterBreakdown([
    { original: 'speed', typed: 'sp' }
  ]);

  assert.strictEqual(breakdown.correct, 2);
  assert.strictEqual(breakdown.missed, 3);
  assert.strictEqual(breakdown.incorrect, 0);
  assert.strictEqual(breakdown.extra, 0);

  // In main.js, totalTypedChars = correctChars + breakdown.incorrect + breakdown.extra
  const totalTyped = breakdown.correct + breakdown.incorrect + breakdown.extra;
  assert.strictEqual(totalTyped, 2, 'Missed characters must not contribute to typed total');

  const elapsed = 10.0;
  assert.strictEqual(calculateNetWpm(breakdown.correct, elapsed), 2);
  assert.strictEqual(calculateRawWpm(totalTyped, elapsed), 2);
});

runTest('2.6: Character breakdown correctly isolates extra letters with compound classes', () => {
  const mockNode = {
    classList: {
      contains: (cls) => ['letter', 'extra', 'incorrect'].includes(cls)
    }
  };
  const mockWord = {
    querySelectorAll: () => [mockNode]
  };

  const breakdown = getCharacterBreakdown([mockWord]);
  assert.strictEqual(breakdown.extra, 1, 'Extra class must take priority over incorrect');
  assert.strictEqual(breakdown.incorrect, 0);
});

runTest('2.7: Extra character cap (MAX_EXTRA_LETTERS = 15) enforced in TypingSurface', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  const surface = new TypingSurface();
  surface.mount(container);
  surface.loadWords(['cat']);

  const sim = createSimulator(surface.input, { performance: env.performance });

  // Type correct word: 'c', 'a', 't'
  sim.typeString('cat');
  assert.strictEqual(surface.currentCharIdx, 3);

  // Type 25 extra characters: only 15 should be accepted
  for (let i = 0; i < 25; i++) {
    sim.typeKey('z');
  }

  const activeWord = surface.getActiveWord();
  assert.strictEqual(activeWord.letters.length, 3 + MAX_EXTRA_LETTERS, 'Word letters must cap at target length + 15');
  assert.strictEqual(surface.currentCharIdx, 3 + MAX_EXTRA_LETTERS);

  // Verify breakdown classifies all 15 as extra
  const breakdown = getCharacterBreakdown([activeWord]);
  assert.strictEqual(breakdown.correct, 3);
  assert.strictEqual(breakdown.extra, 15);

  env.cleanup();
});

// ============================================================================
// SECTION 3: Accuracy Calculations With Multiple Typo Corrections
// ============================================================================
console.log('\n--- Section 3: Keystroke Accuracy (Multiple Typo Corrections) ---');

runTest('3.1: Pristine typing: 10 correct keypresses out of 10 = exactly 100%', () => {
  assert.strictEqual(calculateAccuracy(10, 10), 100);
});

runTest('3.2: Single correction (typo + backspace + correct): 1 correct / 3 total = 33.333%', () => {
  const acc = calculateAccuracy(1, 3);
  assert.ok(Math.abs(acc - (100 / 3)) < 1e-10, `Expected 33.333...%, got ${acc}`);
});

runTest('3.3: Double correction on same letter (typo + bs + typo + bs + correct): 1 / 5 = 20.0%', () => {
  const acc = calculateAccuracy(1, 5);
  assert.strictEqual(acc, 20.0);
});

runTest('3.4: Word-level scenario: 10 typos deleted by 10 backspaces, then 5 correct = 20.0%', () => {
  const correct = 5;
  const total = 10 + 10 + 5; // 25
  const acc = calculateAccuracy(correct, total);
  assert.strictEqual(acc, 20.0);
});

runTest('3.5: Ctrl+Backspace deletion: 10 typos wiped with 1 Ctrl+Backspace + 5 correct = 31.25%', () => {
  // 10 typo keys + 1 Ctrl+BS key + 5 correct keys = 16 total keypresses
  const correct = 5;
  const total = 16;
  const acc = calculateAccuracy(correct, total);
  assert.strictEqual(acc, 31.25);
});

runTest('3.6: Pristine baseline guard: 0 total keypresses returns 100%', () => {
  assert.strictEqual(calculateAccuracy(0, 0), 100);
  assert.strictEqual(calculateAccuracy(0, -5), 100);
});

runTest('3.7: 0 correct keypresses with positive total returns 0%', () => {
  assert.strictEqual(calculateAccuracy(0, 50), 0);
  assert.strictEqual(calculateAccuracy(-10, 50), 0);
});

runTest('3.8: Clamping and boundary guards: correct >= total clamps to 100%', () => {
  assert.strictEqual(calculateAccuracy(15, 10), 100);
  assert.strictEqual(calculateAccuracy(Infinity, 100), 100);
  assert.strictEqual(calculateAccuracy(50, NaN), 100);
  assert.strictEqual(calculateAccuracy(NaN, 50), 0);
});

runTest('3.9: High keypress volume: 1,000,000 keypresses with 990,000 correct = 99.0%', () => {
  assert.strictEqual(calculateAccuracy(990000, 1000000), 99.0);
});

// ============================================================================
// SECTION 4: Consistency CV Formula Under Extreme Variance & Bounds [0, 100]
// ============================================================================
console.log('\n--- Section 4: Consistency CV Formula & Boundedness [0, 100] ---');

runTest('4.1: Zero deviation (perfectly uniform speed): returns exactly 100%', () => {
  assert.strictEqual(calculateConsistency([60, 60, 60, 60]), 100);
  assert.strictEqual(calculateConsistency([120, 120, 120]), 100);
});

runTest('4.2: Known mathematical CV: [40, 60, 40, 60] -> mean 50, sigma 10, CV 0.2 -> 80%', () => {
  assert.strictEqual(calculateConsistency([40, 60, 40, 60]), 80);
});

runTest('4.3: Known mathematical CV: [45, 55] -> mean 50, sigma 5, CV 0.1 -> 90%', () => {
  assert.strictEqual(calculateConsistency([45, 55]), 90);
});

runTest('4.4: Massive variance: [0, 150, 0, 0, 0] -> CV > 1.0 -> strictly clamped to 0%', () => {
  const result = calculateConsistency([0, 150, 0, 0, 0]);
  assert.strictEqual(result, 0, 'Must be clamped to 0% and never negative');
});

runTest('4.5: Super-massive variance: [0, 100000, 0, 0] -> clamped to 0%', () => {
  const result = calculateConsistency([0, 100000, 0, 0]);
  assert.strictEqual(result, 0);
});

runTest('4.6: Single-sample edge cases: [75] -> 100%, [0] -> 0%, [-10] -> 0%', () => {
  assert.strictEqual(calculateConsistency([75]), 100);
  assert.strictEqual(calculateConsistency([0]), 0);
  assert.strictEqual(calculateConsistency([-10]), 0);
});

runTest('4.7: Zero elapsed time / empty input: [] -> 0%', () => {
  assert.strictEqual(calculateConsistency([]), 0);
  assert.strictEqual(calculateConsistency(null), 0);
  assert.strictEqual(calculateConsistency(undefined), 0);
  assert.strictEqual(calculateConsistency('invalid'), 0);
  assert.strictEqual(calculateConsistency({}), 0);
});

runTest('4.8: All zeros: [0, 0, 0, 0, 0] -> returns 0%', () => {
  assert.strictEqual(calculateConsistency([0, 0, 0, 0, 0]), 0);
});

runTest('4.9: Negative / zero mean: [-50, -50] -> 0%', () => {
  assert.strictEqual(calculateConsistency([-50, -50]), 0);
});

runTest('4.10: Support for TelemetrySnapshot objects: [{ rawWpm: 50 }, { rawWpm: 50 }] -> 100%', () => {
  const snapshots = [{ rawWpm: 50 }, { rawWpm: 50 }, { rawWpm: 50 }];
  assert.strictEqual(calculateConsistency(snapshots), 100);

  const variableSnapshots = [{ rawWpm: 40 }, { rawWpm: 60 }, { rawWpm: 40 }, { rawWpm: 60 }];
  assert.strictEqual(calculateConsistency(variableSnapshots), 80);
});

runTest('4.11: Malformed and mixed elements in sample array handled gracefully', () => {
  assert.strictEqual(calculateConsistency([50, '50', 50]), 100);
  const mixed = [50, NaN, null, 50]; // becomes [50, 0, 0, 50]
  const res = calculateConsistency(mixed);
  assert.ok(Number.isInteger(res));
  assert.ok(res >= 0 && res <= 100);
});

runTest('4.12: High-sample volume (10,000 samples) performance and bound verification', () => {
  const largeUniform = Array(10000).fill(85);
  assert.strictEqual(calculateConsistency(largeUniform), 100);

  const largeRandom = Array.from({ length: 10000 }, () => Math.floor(Math.random() * 150));
  const res = calculateConsistency(largeRandom);
  assert.ok(Number.isInteger(res));
  assert.ok(res >= 0 && res <= 100, `Result ${res} out of bounds [0, 100]`);
});

runTest('4.13: Monte Carlo / Fuzz Invariant: 1,000 random vectors ALWAYS bounded [0, 100]', () => {
  for (let iter = 0; iter < 1000; iter++) {
    const len = Math.floor(Math.random() * 30);
    const vector = Array.from({ length: len }, () => {
      const mode = Math.random();
      if (mode < 0.1) return 0;
      if (mode < 0.2) return -Math.random() * 100;
      if (mode < 0.3) return NaN;
      if (mode < 0.4) return Infinity;
      if (mode < 0.5) return { rawWpm: Math.random() * 200 };
      return Math.random() * 300;
    });

    const res = calculateConsistency(vector);
    assert.ok(Number.isInteger(res), `Iteration ${iter}: result ${res} must be an integer`);
    assert.ok(res >= 0 && res <= 100, `Iteration ${iter}: result ${res} must be in [0, 100]`);
  }
});

// ============================================================================
// SECTION 5: Rapid Burst Keypresses With dt = 0
// ============================================================================
console.log('\n--- Section 5: Rapid Burst Keypresses With dt = 0 ---');

runTest('5.1: Zero elapsed time division guard: calculateNetWpm and calculateRawWpm return 0 at dt=0', () => {
  assert.strictEqual(calculateNetWpm(20, 0), 0);
  assert.strictEqual(calculateRawWpm(20, 0), 0);
  assert.strictEqual(calculateNetWpm(20, 0.0), 0);
  assert.strictEqual(calculateRawWpm(20, 0.0), 0);
  assert.ok(Number.isFinite(calculateNetWpm(20, 0)));
  assert.ok(Number.isFinite(calculateRawWpm(20, 0)));
});

runTest('5.2: State machine elapsed time at dt=0: returns 0.0 without NaN or negative values', () => {
  const fsm = new TypingStateMachine();
  fsm.start(5000);
  assert.strictEqual(fsm.getElapsedMs(5000), 0);
  assert.strictEqual(fsm.getElapsedSeconds(5000), 0);

  fsm.finish(5000);
  assert.strictEqual(fsm.getElapsedMs(5000), 0);
  assert.strictEqual(fsm.getElapsedSeconds(5000), 0);
});

runTest('5.3: TelemetryLogger handling of instant ticks at dt=0', () => {
  const logger = new TelemetryLogger();
  logger.start(1000);

  // Manual tick at second 0 / dt = 0
  const snap = logger.recordTick(0, 0, 0, 0);
  assert.strictEqual(snap.second, 0);
  assert.strictEqual(snap.netWpm, 0);
  assert.strictEqual(snap.rawWpm, 0);
  assert.ok(Number.isFinite(snap.netWpm));
  assert.ok(Number.isFinite(snap.rawWpm));

  logger.stop();
});

runTest('5.4: TypingSurface handles synchronous 20-character burst at dt = 0 without corruption', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  const surface = new TypingSurface();
  surface.mount(container);
  surface.loadWords(['rapidkeys', 'engine', 'stress']);

  const typedChars = [];
  surface.on('letterTyped', (data) => typedChars.push(data));

  const submittedWords = [];
  surface.on('wordSubmitted', (idx) => submittedWords.push(idx));

  // Dispatch all 20 keystrokes synchronously in same call stack (dt = 0)
  const burstString = 'rapidkeys engine ';
  for (let i = 0; i < burstString.length; i++) {
    surface.handleKey(burstString[i], false);
  }

  assert.strictEqual(typedChars.length, 15, '15 letter typed events (9 + 6)');
  assert.strictEqual(submittedWords.length, 2, '2 word submitted events');
  assert.strictEqual(surface.currentWordIdx, 2);
  assert.strictEqual(surface.currentCharIdx, 0);

  // Verify all 15 typed letters marked correct
  assert.ok(typedChars.every(e => e.correct === true));

  env.cleanup();
});

// ============================================================================
// SECTION 6: Full Simulated E2E Typing Journey Validation
// ============================================================================
console.log('\n--- Section 6: Full 30s Session Metric Convergence ---');

runTest('6.1: Full 30-second test convergence simulation', () => {
  // Scenario:
  // In 30.0s:
  // User types 25 correct characters across words.
  // User made 5 mistakes that were corrected with Backspace (5 typos + 5 BS + 5 correct letters).
  // User left 5 uncorrected errors.
  // User typed 2 extra characters at the end of a word.
  // Correct chars = 25.
  // Uncorrected errors = 5.
  // Extra chars = 2.
  // Total typed chars = 25 + 5 + 2 = 32.
  // Correct keypresses = 25.
  // Total keypresses = 25 (correct) + 5 (typos) + 5 (backspaces) + 5 (uncorrected) + 2 (extra) = 42.

  const elapsedSec = 30.0;
  const correctChars = 25;
  const uncorrected = 5;
  const extra = 2;
  const totalTypedChars = correctChars + uncorrected + extra; // 32
  const correctKeypresses = 25;
  const totalKeypresses = 42;

  const netWpm = calculateNetWpm(correctChars, elapsedSec);
  const rawWpm = calculateRawWpm(totalTypedChars, elapsedSec);
  const accuracy = calculateAccuracy(correctKeypresses, totalKeypresses);

  // Net WPM: (25 * 12) / 30 = 10
  assert.strictEqual(netWpm, 10);

  // Raw WPM: (32 * 12) / 30 = 384 / 30 = 12.8 -> rounded to 13
  assert.strictEqual(rawWpm, 13);

  // Accuracy: (25 / 42) * 100 = 59.5238%
  assert.ok(Math.abs(accuracy - 59.5238) < 0.01, `Accuracy expected ~59.52%, got ${accuracy}`);

  // Consistency of a 30s test with steady typing (e.g. 13 WPM average with minor variance)
  const rawWpmTimeline = [
    10, 12, 12, 14, 13, 13, 12, 14, 13, 13,
    14, 13, 12, 13, 14, 13, 12, 13, 14, 13,
    13, 12, 14, 13, 13, 12, 13, 14, 13, 13
  ];
  const consistency = calculateConsistency(rawWpmTimeline);
  assert.ok(consistency >= 90 && consistency <= 100, `Expected high consistency, got ${consistency}%`);
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n================================================================');
console.log(`STRESS TEST SUMMARY: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================\n');

if (failedTests > 0) {
  console.error(`VERDICT: REJECT (${failedTests} stress tests failed)`);
  process.exit(1);
} else {
  console.log('VERDICT: APPROVE (100% stress tests passed cleanly)');
  process.exit(0);
}
