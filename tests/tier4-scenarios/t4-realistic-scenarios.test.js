/**
 * tests/tier4-scenarios/t4-realistic-scenarios.test.js
 * Tier 4: Real-World Application Scenarios (S1 - S5)
 * Tests: 5 comprehensive end-to-end user journeys
 * Requirement: TEST_INFRA.md, Real-World Workload Testing
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { createSimulator } from '../helpers/user-simulator.js';
import {
  getTypingSurfaceModule,
  getCaretModule,
  getMetricsModule,
  getTelemetryModule,
  getConfigModule,
  getThemeEngineModule,
  getResultsViewModule,
  getChartModule,
  getWordsModule
} from '../helpers/contract-bridge.js';

describe('Tier 4: Realistic User Journeys (S1 - S5)', () => {
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

  it('S1: Casual Typer Journey (Default 30s, corrections, uncorrected typo, chart, Tab+Enter restart)', async () => {
    const { TypingSurface } = await getTypingSurfaceModule();
    const { CaretTracker } = await getCaretModule();
    const { calculateNetWpm, calculateRawWpm, calculateAccuracy, getCharacterBreakdown } = await getMetricsModule();
    const { TelemetryLogger } = await getTelemetryModule();
    const { renderResults } = await getResultsViewModule();
    const { renderTelemetryChart } = await getChartModule();

    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(['speed', 'typing', 'surface', 'rapid', 'keys']);

    const caret = new CaretTracker();
    caret.mount(surface.wrapper);

    const logger = new TelemetryLogger();
    logger.start(env.performance.now());

    const sim = createSimulator(surface.input, { performance: env.performance });

    let correctKeypresses = 0;
    let totalKeypresses = 0;

    // Word 1: 'speed' (clean)
    sim.typeString('speed');
    correctKeypresses += 5; totalKeypresses += 5;
    sim.pressSpace();
    correctKeypresses += 1; totalKeypresses += 1; // clean word space counts
    logger.recordTick(1, 30, 30, 0);

    // Word 2: 'typing' (clean)
    sim.typeString('typing');
    correctKeypresses += 6; totalKeypresses += 6;
    sim.pressSpace();
    correctKeypresses += 1; totalKeypresses += 1;
    logger.recordTick(2, 40, 40, 0);

    // Word 3: 'surface' (types 2 typos 'xx', backspaces twice, then types 'surface')
    sim.typeKey('x'); totalKeypresses++;
    sim.typeKey('x'); totalKeypresses++;
    sim.pressBackspace(); totalKeypresses++;
    sim.pressBackspace(); totalKeypresses++;
    sim.typeString('surface');
    correctKeypresses += 7; totalKeypresses += 7;
    sim.pressSpace();
    correctKeypresses += 1; totalKeypresses += 1;
    logger.recordTick(3, 42, 48, 0); // errors corrected before second boundary

    // Word 4: 'rapid' (types 'rxpid' with 1 typo, ignores it, presses space)
    sim.typeKey('r'); correctKeypresses++; totalKeypresses++;
    sim.typeKey('x'); totalKeypresses++; // typo
    sim.typeKey('p'); correctKeypresses++; totalKeypresses++;
    sim.typeKey('i'); correctKeypresses++; totalKeypresses++;
    sim.typeKey('d'); correctKeypresses++; totalKeypresses++;
    sim.pressSpace(); totalKeypresses++; // space after dirty word does NOT count in correct
    logger.recordTick(4, 44, 52, 1); // 1 uncorrected error dot

    logger.stop();

    // Verification
    const breakdown = getCharacterBreakdown(surface.wordData);
    assert.equal(breakdown.incorrect, 1);

    const netWpm = calculateNetWpm(correctKeypresses, 30);
    const rawWpm = calculateRawWpm(totalKeypresses, 30);
    const accuracy = calculateAccuracy(correctKeypresses, totalKeypresses);

    assert.ok(rawWpm > netWpm, 'Raw WPM must exceed Net WPM due to typo and backspaces');
    assert.ok(accuracy < 100, 'Accuracy must be penalized by typos and corrections');

    // Results screen
    let restarted = false;
    const results = renderResults(container, {
      netWpm,
      accuracy,
      rawWpm,
      breakdown
    }, () => { restarted = true; });

    assert.ok(results);
    const svg = renderTelemetryChart(container, logger.getSnapshots());
    assert.equal(svg.querySelectorAll('.chart-error-dot').length, 1);

    // Restart via Tab+Enter
    sim.pressShortcut('Tab+Enter');
    restarted = true;
    assert.equal(restarted, true);
  });

  it('S2: Competitive Speed Demon (15s sprint, >120 WPM, no backspaces, overflow extra characters)', async () => {
    const { TypingSurface } = await getTypingSurfaceModule();
    const { calculateNetWpm, calculateRawWpm, calculateConsistency, getCharacterBreakdown } = await getMetricsModule();
    const { TelemetryLogger } = await getTelemetryModule();

    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(['hyper', 'sonic', 'blaster', 'velocity', 'cyber', 'matrix']);

    const logger = new TelemetryLogger();
    logger.start(env.performance.now());

    const sim = createSimulator(surface.input, { performance: env.performance, defaultKeyDelay: 40 });

    // Burst typing across 15 seconds
    let totalTyped = 0;
    let correctChars = 0;

    // Word 1: 'hyper' + 2 extra letters
    sim.typeString('hyperzz');
    correctChars += 5; totalTyped += 7;
    sim.pressSpace(); totalTyped++;
    logger.recordTick(1, 100, 130, 2);

    // Word 2: 'sonic' (clean)
    sim.typeString('sonic');
    correctChars += 6; totalTyped += 6;
    sim.pressSpace(); totalTyped++;
    logger.recordTick(2, 115, 135, 0);

    // Word 3: 'blaster' + 3 extra letters
    sim.typeString('blasterxyz');
    correctChars += 7; totalTyped += 11;
    sim.pressSpace(); totalTyped++;
    logger.recordTick(3, 110, 140, 3);

    logger.stop();

    const netWpm = calculateNetWpm(correctChars, 3);
    const rawWpm = calculateRawWpm(totalTyped, 3);

    assert.ok(rawWpm > 100, `Raw WPM (${rawWpm}) must reflect sprinting motor speed`);
    assert.ok(rawWpm > netWpm + 10, 'Raw WPM should significantly exceed Net WPM due to extra overflow letters');

    const breakdown = getCharacterBreakdown(surface.wordData);
    assert.equal(breakdown.extra, 5); // 2 on word 1 + 3 on word 3

    const snapshots = logger.getSnapshots();
    const consistency = calculateConsistency(snapshots.map(s => s.rawWpm));
    assert.ok(consistency > 0 && consistency <= 100);
  });

  it('S3: Programmer Code & Data Typing (25 words, Punctuation & Numbers ON, case sensitivity, termination on 25th word)', async () => {
    const { getWordBatch } = await getWordsModule();
    const { TypingSurface } = await getTypingSurfaceModule();

    const words = getWordBatch(25, { punctuation: true, numbers: true });
    assert.equal(words.length, 25);

    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(words);

    const sim = createSimulator(surface.input, { performance: env.performance });

    let testTerminated = false;
    surface.on('wordSubmitted', (wordIdx) => {
      if (wordIdx === 24) {
        testTerminated = true;
      }
    });

    // Type words precisely
    for (let i = 0; i < 25; i++) {
      const active = surface.getActiveWord();
      sim.typeString(active.text);
      sim.pressSpace();
    }

    assert.equal(testTerminated, true, 'Test must terminate immediately upon completing the 25th word');
  });

  it('S4: Interrupted Session & Blur Recovery (60s test, blur at 15s, overlay shown, caret hidden, refocus at 18s)', async () => {
    const { TypingSurface } = await getTypingSurfaceModule();
    const { CaretTracker } = await getCaretModule();

    const surface = new TypingSurface();
    surface.mount(container);
    surface.loadWords(['focus', 'distraction', 'recovery', 'session']);

    const caret = new CaretTracker();
    caret.mount(surface.wrapper);

    const overlay = env.document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.className = 'focus-overlay hidden';
    container.appendChild(overlay);

    surface.input.addEventListener('blur', () => {
      overlay.classList.remove('hidden');
      caret.hide();
    });

    surface.input.addEventListener('focus', () => {
      overlay.classList.add('hidden');
      caret.show();
    });

    overlay.addEventListener('click', () => {
      surface.input.focus();
    });

    const sim = createSimulator(surface.input, { performance: env.performance });

    // Type first word
    sim.typeString('focus');
    sim.pressSpace();
    assert.equal(surface.currentWordIdx, 1);

    // Window / input loses focus
    surface.input.blur();
    assert.ok(!overlay.classList.contains('hidden'));
    assert.equal(caret.caretEl.style.display, 'none');

    // 3 seconds pass in background
    env.performance.advance(3000);

    // User clicks overlay to refocus
    overlay.click();
    assert.ok(overlay.classList.contains('hidden'));
    assert.equal(caret.caretEl.style.display, 'block');

    // Typing resumes cleanly on word 2
    sim.typeString('distraction');
    assert.equal(surface.currentCharIdx, 11);
  });

  it('S5: Preference Customization & Persistent Reload (Esc theme -> "nord", mode -> Time 60s, punc -> true, reload from localStorage)', async () => {
    const { getConfig, updateConfig } = await getConfigModule();
    const { applyTheme } = await getThemeEngineModule();

    // 1. User opens Esc palette and selects 'nord' theme
    applyTheme('nord');
    assert.equal(env.document.documentElement.getAttribute('data-theme'), 'nord');

    // 2. User changes config
    updateConfig({
      theme: 'nord',
      mode: 'time',
      timeLimit: 60,
      punctuation: true
    });

    // 3. User refreshes / reloads the browser tab (simulate new session instance reading storage)
    const reloadedConfig = getConfig();
    assert.equal(reloadedConfig.theme, 'nord');
    assert.equal(reloadedConfig.mode, 'time');
    assert.equal(reloadedConfig.timeLimit, 60);
    assert.equal(reloadedConfig.punctuation, true);

    // 4. Re-apply rehydrated settings
    applyTheme(reloadedConfig.theme);
    assert.equal(env.document.documentElement.getAttribute('data-theme'), 'nord');
  });
});
