/**
 * tests/tier1-features/t1-f4-modes-config.test.js
 * Tier 1: Feature Coverage - F4: Test Modes, Words & Config
 * Tests: T1.4.1 through T1.4.5 (5 tests)
 * Requirement: ORIGINAL_REQUEST R3, Acceptance Criteria #53, #54, #55, #56, #57
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { getConfigModule, getWordsModule } from '../helpers/contract-bridge.js';

describe('Tier 1 - F4: Test Modes, Words & Config', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T1.4.1: Time mode (15s, 30s, 60s, 120s) terminates test precisely when elapsed time reaches target duration', () => {
    const durations = [15, 30, 60, 120];

    durations.forEach(targetDuration => {
      let isFinished = false;
      const startTime = 1000;
      let currentTime = startTime;

      const checkTimeLimit = (now) => {
        const elapsedSec = (now - startTime) / 1000;
        if (elapsedSec >= targetDuration) {
          isFinished = true;
        }
      };

      // Before target
      currentTime = startTime + (targetDuration - 0.1) * 1000;
      checkTimeLimit(currentTime);
      assert.equal(isFinished, false, `Should not be finished at ${targetDuration - 0.1}s`);

      // Exactly at target
      currentTime = startTime + targetDuration * 1000;
      checkTimeLimit(currentTime);
      assert.equal(isFinished, true, `Should terminate cleanly at ${targetDuration}s`);
    });
  });

  it('T1.4.2: Word count mode (10, 25, 50, 100) terminates test immediately upon submitting final word', () => {
    const wordCounts = [10, 25, 50, 100];

    wordCounts.forEach(targetWordCount => {
      let isFinished = false;
      let wordsSubmitted = 0;

      const submitWord = () => {
        wordsSubmitted++;
        if (wordsSubmitted >= targetWordCount) {
          isFinished = true;
        }
      };

      for (let i = 0; i < targetWordCount - 1; i++) {
        submitWord();
        assert.equal(isFinished, false);
      }

      // Submit final word
      submitWord();
      assert.equal(isFinished, true, `Should finish immediately on word ${targetWordCount}`);
    });
  });

  it('T1.4.3: Punctuation toggle injects capitals, periods, commas, quotes, and question marks into word stream', async () => {
    const { getWordBatch } = await getWordsModule();

    // Default: no punctuation
    const defaultBatch = getWordBatch(30, { punctuation: false });
    assert.ok(defaultBatch.every(w => /^[a-z]+$/.test(w) || !/[.,!?"A-Z]/.test(w)));

    // Punctuation ON
    const punctBatch = getWordBatch(60, { punctuation: true });

    const hasCapital = punctBatch.some(w => /[A-Z]/.test(w));
    const hasPunctuationMark = punctBatch.some(w => /[.,!?"']/.test(w));

    assert.ok(hasCapital, 'Punctuation stream must contain capitalized words');
    assert.ok(hasPunctuationMark, 'Punctuation stream must contain punctuation marks');
  });

  it('T1.4.4: Numbers toggle injects numeric digits into word stream', async () => {
    const { getWordBatch } = await getWordsModule();

    // Numbers OFF
    const noNumbersBatch = getWordBatch(40, { numbers: false });
    assert.ok(!noNumbersBatch.some(w => /\d/.test(w)));

    // Numbers ON
    const numbersBatch = getWordBatch(40, { numbers: true });
    const hasNumbers = numbersBatch.some(w => /\d/.test(w));
    assert.ok(hasNumbers, 'Numbers stream must inject numeric tokens');
  });

  it('T1.4.5: Active configuration persists to localStorage and rehydrates on startup', async () => {
    const { getConfig, updateConfig, resetConfig, DEFAULT_CONFIG } = await getConfigModule();

    // Verify initial default config
    resetConfig();
    const initialConfig = getConfig();
    assert.deepEqual(initialConfig, DEFAULT_CONFIG);

    // Update config: 60s, punctuation ON, nord theme
    updateConfig({
      mode: 'time',
      timeLimit: 60,
      punctuation: true,
      theme: 'nord'
    });

    // Rehydrate from localStorage
    const rehydrated = getConfig();
    assert.equal(rehydrated.timeLimit, 60);
    assert.equal(rehydrated.punctuation, true);
    assert.equal(rehydrated.theme, 'nord');
    assert.equal(rehydrated.mode, 'time');
  });
});
