/**
 * tests/tier1-features/t1-f3-scoring-telemetry.test.js
 * Tier 1: Feature Coverage - F3: Scoring, WPM & Live Telemetry
 * Tests: T1.3.1 through T1.3.6 (6 tests)
 * Requirement: ORIGINAL_REQUEST R2, Acceptance Criteria #46, #47, #48, #49, #50, #60
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMetricsModule, getTelemetryModule } from '../helpers/contract-bridge.js';

describe('Tier 1 - F3: Scoring, WPM & Live Telemetry', () => {
  it('T1.3.1: Net WPM formula: typing 25 correct characters in 30.0s outputs exactly 10 Net WPM', async () => {
    const { calculateNetWpm } = await getMetricsModule();
    const correctChars = 25;
    const elapsedSec = 30.0;

    const netWpm = calculateNetWpm(correctChars, elapsedSec);
    // Formula: (25 / 5) / (30 / 60) = 5 / 0.5 = 10
    assert.equal(netWpm, 10);
  });

  it('T1.3.2: Raw vs Net WPM: 25 correct + 10 uncorrected error characters in 30s outputs 10 Net WPM and 14 Raw WPM', async () => {
    const { calculateNetWpm, calculateRawWpm } = await getMetricsModule();
    const correctChars = 25;
    const errorChars = 10;
    const totalTypedChars = correctChars + errorChars; // 35
    const elapsedSec = 30.0;

    const netWpm = calculateNetWpm(correctChars, elapsedSec);
    const rawWpm = calculateRawWpm(totalTypedChars, elapsedSec);

    // Net WPM: (25/5)/0.5 = 10
    assert.equal(netWpm, 10);
    // Raw WPM: (35/5)/0.5 = 7 / 0.5 = 14
    assert.equal(rawWpm, 14);
  });

  it('T1.3.3: Accuracy calculation with corrected errors: typing error + backspace + correct letter reduces overall accuracy', async () => {
    const { calculateAccuracy } = await getMetricsModule();

    // Flawless typing: 10 correct keypresses out of 10
    assert.equal(calculateAccuracy(10, 10), 100);

    // Corrected error: 1 error keypress + 1 backspace keypress + 1 correct keypress = 3 total keypresses, 1 correct
    const accuracy = calculateAccuracy(1, 3);
    // (1 / 3) * 100 = 33.33%
    assert.ok(accuracy >= 33.3 && accuracy <= 33.4, `Expected ~33.3%, got ${accuracy}`);
  });

  it('T1.3.4: Consistency calculation: deterministically computes coefficient of variation bounded [0, 100]', async () => {
    const { calculateConsistency } = await getMetricsModule();

    // Case 1: Perfectly uniform speed (sigma = 0) => Consistency = 100%
    const uniformSamples = [50, 50, 50, 50, 50];
    assert.equal(calculateConsistency(uniformSamples), 100);

    // Case 2: Fluctuation: [40, 60, 40, 60] -> mean = 50, variance = 100, sigma = 10, cv = 0.2 -> 80%
    const variableSamples = [40, 60, 40, 60];
    const consistency = calculateConsistency(variableSamples);
    assert.equal(consistency, 80);

    // Case 3: Extreme variance clamped to 0% (never negative)
    const erraticSamples = [0, 120, 0, 0];
    const erraticConsistency = calculateConsistency(erraticSamples);
    assert.equal(erraticConsistency, 0);
  });

  it('T1.3.5: Per-second telemetry logger captures { second, timestamp, netWpm, rawWpm, errors } for each elapsed second', async () => {
    const { TelemetryLogger } = await getTelemetryModule();
    const logger = new TelemetryLogger();
    logger.start(1000);

    logger.recordTick(1, 45, 50, 0);
    logger.recordTick(2, 52, 58, 1);
    logger.recordTick(3, 60, 65, 0);
    logger.stop();

    const snapshots = logger.getSnapshots();
    assert.equal(snapshots.length, 3);

    assert.deepEqual(snapshots[0], {
      second: 1,
      timestamp: 1000,
      netWpm: 45,
      rawWpm: 50,
      errors: 0
    });

    assert.deepEqual(snapshots[1], {
      second: 2,
      timestamp: 2000,
      netWpm: 52,
      rawWpm: 58,
      errors: 1
    });

    assert.deepEqual(snapshots[2], {
      second: 3,
      timestamp: 3000,
      netWpm: 60,
      rawWpm: 65,
      errors: 0
    });
  });

  it('T1.3.6: Character breakdown counters accurately tally correct, incorrect, extra, and missed characters', async () => {
    const { getCharacterBreakdown } = await getMetricsModule();

    const mockWords = [
      {
        letters: [
          { state: 'correct' },
          { state: 'correct' },
          { state: 'incorrect' }
        ]
      },
      {
        letters: [
          { state: 'correct' },
          { state: 'extra' },
          { state: 'missed' },
          { state: 'missed' }
        ]
      }
    ];

    const breakdown = getCharacterBreakdown(mockWords);
    assert.deepEqual(breakdown, {
      correct: 3,
      incorrect: 1,
      extra: 1,
      missed: 2
    });
  });
});
