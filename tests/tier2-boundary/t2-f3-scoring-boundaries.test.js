/**
 * tests/tier2-boundary/t2-f3-scoring-boundaries.test.js
 * Tier 2: Boundary & Corner Cases - B3: Scoring Boundaries
 * Tests: T2.3.1 through T2.3.6 (6 tests)
 * Requirement: Boundary value analysis for precision scoring and consistency math
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMetricsModule } from '../helpers/contract-bridge.js';

describe('Tier 2 - B3: Precision Scoring Boundaries', () => {
  it('T2.3.1: Immediate test restart at elapsed time = 0.0s: Net and Raw WPM guard against division by zero, return 0', async () => {
    const { calculateNetWpm, calculateRawWpm } = await getMetricsModule();

    assert.equal(calculateNetWpm(0, 0), 0);
    assert.equal(calculateRawWpm(0, 0), 0);
    assert.equal(calculateNetWpm(10, 0), 0);
    assert.equal(calculateRawWpm(10, 0), 0);
  });

  it('T2.3.2: 100% incorrect typing (every key typed is wrong): Net WPM clamped to 0, Accuracy is 0%, Raw WPM reflects gross speed', async () => {
    const { calculateNetWpm, calculateRawWpm, calculateAccuracy } = await getMetricsModule();
    const correctChars = 0;
    const totalChars = 50;
    const elapsedSec = 30.0;

    const netWpm = calculateNetWpm(correctChars, elapsedSec);
    const rawWpm = calculateRawWpm(totalChars, elapsedSec);
    const accuracy = calculateAccuracy(0, totalChars);

    assert.equal(netWpm, 0, 'Net WPM must be 0 when no correct characters typed');
    assert.equal(accuracy, 0, 'Accuracy must be 0%');
    // Raw WPM: (50 / 5) / (30 / 60) = 10 / 0.5 = 20
    assert.equal(rawWpm, 20, 'Raw WPM must reflect gross motor typing speed');
  });

  it('T2.3.3: Perfectly uniform typing speed across all seconds: standard deviation sigma = 0, Consistency outputs exactly 100%', async () => {
    const { calculateConsistency } = await getMetricsModule();

    // 10 consecutive seconds at exactly 75 WPM
    const samples = Array(10).fill(75);
    const consistency = calculateConsistency(samples);

    assert.equal(consistency, 100);
  });

  it('T2.3.4: Wildly erratic typing speed (e.g. 150 WPM, then 0 WPM, then 120 WPM): standard deviation exceeds mean, Consistency is cleanly clamped to 0%', async () => {
    const { calculateConsistency } = await getMetricsModule();

    // Samples where CV > 1.0 (mean ~ 36, sigma ~ 65 -> CV ~ 1.8)
    const erraticSamples = [150, 0, 0, 120, 0, 0, 0, 20];
    const consistency = calculateConsistency(erraticSamples);

    assert.equal(consistency, 0, 'Consistency must be clamped to 0% and never negative');
  });

  it('T2.3.5: Single-second test duration (k=1 sample): Consistency outputs 100% (if w1 > 0) or 0% without NaN', async () => {
    const { calculateConsistency } = await getMetricsModule();

    assert.equal(calculateConsistency([80]), 100);
    assert.equal(calculateConsistency([0]), 0);
    assert.equal(calculateConsistency([]), 0);
  });

  it('T2.3.6: All typed characters deleted with backspace before space submitted: Accuracy properly reflects total keystrokes attempted including deleted ones', async () => {
    const { calculateAccuracy } = await getMetricsModule();

    // User types 10 wrong characters, hits Backspace 10 times, then types 5 correct characters
    // Total keypresses = 10 (typos) + 10 (backspaces) + 5 (correct) = 25
    // Correct keypresses = 5
    const accuracy = calculateAccuracy(5, 25);

    // Accuracy: (5 / 25) * 100 = 20.0%
    assert.equal(accuracy, 20.0);
  });
});
