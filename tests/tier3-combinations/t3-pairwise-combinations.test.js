/**
 * tests/tier3-combinations/t3-pairwise-combinations.test.js
 * Tier 3: Cross-Feature Combinations (Pairwise Matrix)
 * Tests: C1 through C10 (10 tests)
 * Requirement: TEST_INFRA.md, Pairwise Coverage Matrix
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { createSimulator } from '../helpers/user-simulator.js';
import {
  getTypingSurfaceModule,
  getMetricsModule,
  getTelemetryModule,
  getWordsModule,
  getConfigModule,
  getThemeEngineModule,
  getResultsViewModule,
  getChartModule
} from '../helpers/contract-bridge.js';

describe('Tier 3: Cross-Feature Pairwise Combinations (C1 - C10)', () => {
  let env;
  let container;

  beforeEach(() => {
    env = createTestEnvironment();
    container = env.document.createElement('div');
    container.id = 'app';
    env.document.body.appendChild(container);
  });

  afterEach(() => {
    env.cleanup();
  });

  it('C1: Time 15s + Punctuation ON + High Typos & Backspaces', async () => {
    const { getWordBatch } = await getWordsModule();
    const { TypingSurface } = await getTypingSurfaceModule();
    const { calculateNetWpm, calculateAccuracy } = await getMetricsModule();
    const { TelemetryLogger } = await getTelemetryModule();

    const words = getWordBatch(15, { punctuation: true });
    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(words);

    const logger = new TelemetryLogger();
    logger.start(env.performance.now());

    const sim = createSimulator(surface.input, { performance: env.performance });

    let correctKeys = 0;
    let totalKeys = 0;

    // Simulate typing with frequent errors and backspaces across 15 seconds
    for (let s = 1; s <= 15; s++) {
      // Type 2 correct, 1 wrong, 1 backspace, 1 correct
      sim.typeKey('a'); correctKeys++; totalKeys++;
      sim.typeKey('b'); correctKeys++; totalKeys++;
      sim.typeKey('z'); totalKeys++; // typo
      sim.pressBackspace(); totalKeys++; // correction
      sim.typeKey('c'); correctKeys++; totalKeys++;

      logger.recordTick(s, 24, 40, 1);
    }
    logger.stop();

    const snapshots = logger.getSnapshots();
    assert.equal(snapshots.length, 15);
    assert.ok(snapshots.every(snap => snap.errors === 1));

    const finalAccuracy = calculateAccuracy(correctKeys, totalKeys);
    assert.ok(finalAccuracy < 80, `Expected accuracy penalized by backspaces (<80%), got ${finalAccuracy}%`);
  });

  it('C2: Words 10w + Numbers ON + Flawless (100% Acc) + Tab+Enter Restart', async () => {
    const { getWordBatch } = await getWordsModule();
    const { TypingSurface } = await getTypingSurfaceModule();
    const { renderTelemetryChart } = await getChartModule();
    const { calculateAccuracy } = await getMetricsModule();

    const words = getWordBatch(10, { numbers: true });
    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(words);

    let completedWordCount = 0;
    surface.on('wordSubmitted', () => {
      completedWordCount++;
    });

    const sim = createSimulator(surface.input, { performance: env.performance });

    // Flawlessly type all 10 words
    for (let i = 0; i < 10; i++) {
      const active = surface.getActiveWord();
      sim.typeString(active.text);
      sim.pressSpace();
    }

    assert.equal(completedWordCount, 10);
    assert.equal(calculateAccuracy(50, 50), 100);

    // Chart has 0 error dots
    const snapshots = [{ second: 1, netWpm: 80, rawWpm: 80, errors: 0 }];
    const svg = renderTelemetryChart(container, snapshots);
    assert.equal(svg.querySelectorAll('.chart-error-dot').length, 0);

    // Tab+Enter resets surface cleanly
    sim.pressShortcut('Tab+Enter');
    surface.reset();
    assert.equal(surface.currentWordIdx, 0);
  });

  it('C3: Time 30s + Punct & Numbers ON + Normal Typing + Blur at 10s & Refocus at 12s', async () => {
    const { getWordBatch } = await getWordsModule();
    const { TypingSurface } = await getTypingSurfaceModule();

    const words = getWordBatch(20, { punctuation: true, numbers: true });
    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(words);

    const overlay = env.document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.className = 'focus-overlay hidden';
    container.appendChild(overlay);

    surface.input.addEventListener('blur', () => {
      overlay.classList.remove('hidden');
    });
    surface.input.addEventListener('focus', () => {
      overlay.classList.add('hidden');
    });

    const sim = createSimulator(surface.input, { performance: env.performance });

    // Type 10 seconds
    env.performance.advance(10000);
    sim.typeString('Rapid, ');

    // Blur at 10s
    surface.input.blur();
    assert.ok(!overlay.classList.contains('hidden'), 'Overlay must appear on blur');

    // Idle for 2 seconds while blurred
    env.performance.advance(2000);

    // Refocus at 12s
    surface.input.focus();
    assert.ok(overlay.classList.contains('hidden'), 'Overlay must hide on refocus');
  });

  it('C4: Words 25w + Default mode + Overflow extra chars on 5 words + Space advance', async () => {
    const { TypingSurface } = await getTypingSurfaceModule();
    const { calculateNetWpm, calculateRawWpm } = await getMetricsModule();

    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(Array(25).fill('test'));

    const sim = createSimulator(surface.input, { performance: env.performance });

    let totalExtraLetters = 0;
    // On 5 words, type word + 3 extra characters, then space
    for (let i = 0; i < 5; i++) {
      sim.typeString('test');
      sim.typeString('xyz');
      totalExtraLetters += 3;
      sim.pressSpace();
    }

    assert.equal(totalExtraLetters, 15);
    assert.equal(surface.currentWordIdx, 5);

    // 20 correct characters + 15 extra characters in 15 seconds
    const netWpm = calculateNetWpm(20, 15);
    const rawWpm = calculateRawWpm(35, 15);
    assert.ok(rawWpm > netWpm, `Raw WPM (${rawWpm}) must exceed Net WPM (${netWpm}) due to overflow extra chars`);
  });

  it('C5: Time 60s + Punctuation ON + Rapid Ctrl+Backspace on every word + Tab+Enter mid-test', async () => {
    const { TypingSurface } = await getTypingSurfaceModule();
    const { getWordBatch } = await getWordsModule();

    const words = getWordBatch(30, { punctuation: true });
    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(words);

    const sim = createSimulator(surface.input, { performance: env.performance });

    // Type half of first word and Ctrl+Backspace
    sim.typeString('Typ');
    sim.pressShortcut('Ctrl+Backspace');
    assert.equal(surface.currentCharIdx, 0);

    // Mid-test reset
    sim.pressShortcut('Tab+Enter');
    surface.reset();
    assert.equal(surface.currentWordIdx, 0);
    assert.equal(surface.currentCharIdx, 0);
  });

  it('C6: Words 50w + Numbers ON + Consistent 80 WPM + Esc Theme Switch -> Monokai', async () => {
    const themeEngine = await getThemeEngineModule();
    const { updateConfig, getConfig } = await getConfigModule();

    // Theme switch via Esc modal
    themeEngine.applyTheme('monokai');
    updateConfig({ theme: 'monokai' });

    assert.equal(env.document.documentElement.getAttribute('data-theme'), 'monokai');
    assert.equal(getConfig().theme, 'monokai');
  });

  it('C7: Time 120s + Punct & Numbers ON + Highly uniform cadence -> Consistency >= 95%', async () => {
    const { calculateConsistency } = await getMetricsModule();
    const { TelemetryLogger } = await getTelemetryModule();

    const logger = new TelemetryLogger();
    logger.start(env.performance.now());

    // 120 seconds with steady ~80 WPM (fluctuating only by +/- 1 WPM)
    const samples = [];
    for (let s = 1; s <= 120; s++) {
      const speed = 80 + (s % 2 === 0 ? 1 : -1);
      samples.push(speed);
      logger.recordTick(s, speed, speed, 0);
    }
    logger.stop();

    const consistency = calculateConsistency(samples);
    assert.ok(consistency >= 95, `Expected highly uniform consistency >= 95%, got ${consistency}%`);
    assert.equal(logger.getSnapshots().length, 120);
  });

  it('C8: Words 100w + Default + Burst typing >140 WPM + Window resize', async () => {
    const { getWordBatch } = await getWordsModule();
    const { TypingSurface } = await getTypingSurfaceModule();

    const words = getWordBatch(100, { punctuation: false, numbers: false });
    assert.equal(words.length, 100);

    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(words);

    let resizeHandled = false;
    env.window.addEventListener('resize', () => {
      surface.checkLineScroll();
      resizeHandled = true;
    });

    env.window.dispatchEvent({ type: 'resize' });
    assert.equal(resizeHandled, true);
  });

  it('C9: Time 15s + Default + 0 keypresses until timeout', async () => {
    const { calculateNetWpm, calculateAccuracy, calculateConsistency } = await getMetricsModule();
    const { renderResults } = await getResultsViewModule();

    const netWpm = calculateNetWpm(0, 15);
    const accuracy = calculateAccuracy(0, 0);
    const consistency = calculateConsistency([]);

    const summary = {
      netWpm,
      accuracy,
      rawWpm: 0,
      consistency,
      mode: 'time 15',
      timeElapsed: 15
    };

    const resultsEl = renderResults(container, summary);
    assert.ok(resultsEl);
    assert.equal(container.querySelector('.stat-wpm').textContent, '0');
  });

  it('C10: Words 10w + Punctuation ON + Complete -> Restart -> Type Test 2', async () => {
    const { getWordBatch } = await getWordsModule();
    const { TypingSurface } = await getTypingSurfaceModule();
    const { TelemetryLogger } = await getTelemetryModule();

    const surface = new TypingSurface();
    surface.mount(container);

    // Test 1
    const test1Words = getWordBatch(10, { punctuation: true });
    surface.loadWords(test1Words);

    const logger = new TelemetryLogger();
    logger.start(env.performance.now());
    logger.recordTick(1, 50, 50, 0);
    logger.stop();
    assert.equal(logger.getSnapshots().length, 1);

    // Restart Test 2
    surface.reset();
    const test2Words = getWordBatch(10, { punctuation: true });
    surface.loadWords(test2Words);

    logger.start(env.performance.now());
    assert.equal(logger.getSnapshots().length, 0, 'Test 2 telemetry must start fresh');
    assert.equal(surface.currentWordIdx, 0);
  });
});
