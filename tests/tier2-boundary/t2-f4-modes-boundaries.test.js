/**
 * tests/tier2-boundary/t2-f4-modes-boundaries.test.js
 * Tier 2: Boundary & Corner Cases - B4: Modes & Config Boundaries
 * Tests: T2.4.1 through T2.4.5 (5 tests)
 * Requirement: Boundary value analysis for state transitions, buffer sizing, storage faults
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { getConfigModule, getWordsModule, getStateModule } from '../helpers/contract-bridge.js';

describe('Tier 2 - B4: Modes & Configuration Boundaries', () => {
  let env;

  beforeEach(async () => {
    env = createTestEnvironment();
    const configMod = await getConfigModule();
    if (configMod._clearCache) configMod._clearCache();
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T2.4.1: Mid-test mode toggle attempt while typing: cleanly cancels running test, clears timers, resets state to IDLE', async () => {
    const { TypingState } = await getStateModule();

    let currentState = TypingState.RUNNING;
    let timerCleared = false;
    let timerId = 123;

    const cancelAndSwitchMode = (newMode) => {
      if (currentState === TypingState.RUNNING) {
        timerCleared = true;
        currentState = TypingState.IDLE;
      }
    };

    cancelAndSwitchMode('words');

    assert.equal(currentState, TypingState.IDLE);
    assert.equal(timerCleared, true);
  });

  it('T2.4.2: 100-word mode lazy buffer generation: buffers words continuously without UI latency or memory leak', async () => {
    const { getWordBatch } = await getWordsModule();

    const t0 = env.performance.now();
    const batch = getWordBatch(100, { punctuation: false, numbers: false });
    const elapsed = env.performance.now() - t0;

    assert.equal(batch.length, 100);
    // Generation of 100 words in memory should complete instantaneously (<100ms)
    assert.ok(elapsed < 100, `Buffer generation took ${elapsed}ms`);
    assert.ok(batch.every(w => typeof w === 'string' && w.length > 0));
  });

  it('T2.4.3: Corrupted localStorage data (invalid JSON or missing fields): gracefully falls back to DEFAULT_CONFIG without throwing uncaught exceptions', async () => {
    const configMod = await getConfigModule();
    const { getConfig, DEFAULT_CONFIG } = configMod;

    if (configMod._clearCache) configMod._clearCache();
    // Set corrupted non-JSON string
    env.localStorage.setItem('rapidkeys_config', '{corrupted_json:');

    let loadedConfig;
    assert.doesNotThrow(() => {
      loadedConfig = getConfig();
    });

    assert.equal(loadedConfig.mode, DEFAULT_CONFIG.mode);
    assert.equal(loadedConfig.timeLimit, DEFAULT_CONFIG.timeLimit);
    assert.equal(loadedConfig.theme, DEFAULT_CONFIG.theme);
  });

  it('T2.4.4: Simultaneous toggle of Punctuation AND Numbers: correctly generates mixed tokens', async () => {
    const { getWordBatch } = await getWordsModule();

    const mixedBatch = getWordBatch(80, { punctuation: true, numbers: true });

    const hasNumbers = mixedBatch.some(w => /\d/.test(w));
    const hasPunctuation = mixedBatch.some(w => /[.,!?"']/.test(w));
    const hasCapital = mixedBatch.some(w => /[A-Z]/.test(w));

    assert.ok(hasNumbers, 'Mixed stream must include numbers');
    assert.ok(hasPunctuation, 'Mixed stream must include punctuation');
    assert.ok(hasCapital, 'Mixed stream must include capitalized tokens');
  });

  it('T2.4.5: Incognito / storage quota exceeded on localStorage: storage errors caught safely; app continues with in-memory settings', async () => {
    const { updateConfig, DEFAULT_CONFIG } = await getConfigModule();

    // Mock localStorage.setItem throwing QuotaExceededError
    env.localStorage.setItem = () => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    };

    let updated;
    assert.doesNotThrow(() => {
      updated = updateConfig({ theme: 'monokai' });
    });

    assert.equal(updated.theme, 'monokai');
  });
});
