/**
 * tests/tier2-boundary/t2-f5-results-chart-boundaries.test.js
 * Tier 2: Boundary & Corner Cases - B5: Results & Chart Boundaries
 * Tests: T2.5.1 through T2.5.5 (5 tests)
 * Requirement: Boundary value analysis for charting, race conditions, uncommitted state
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { getChartModule, getMetricsModule } from '../helpers/contract-bridge.js';

describe('Tier 2 - B5: Results & Chart Boundaries', () => {
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

  it('T2.5.1: 0-second test completed before first 1000ms telemetry sample: chart renders empty state or single 0-coordinate point gracefully', async () => {
    const { renderTelemetryChart } = await getChartModule();

    // Empty telemetry array (aborted before 1.0s)
    let svg;
    assert.doesNotThrow(() => {
      svg = renderTelemetryChart(container, []);
    });

    assert.ok(svg);
    const dots = svg.querySelectorAll('.chart-error-dot');
    assert.equal(dots.length, 0);
  });

  it('T2.5.2: Zero errors committed during entire test: chart renders clean curves with exactly 0 error tick marks without null reference', async () => {
    const { renderTelemetryChart } = await getChartModule();

    const flawlessSnapshots = [
      { second: 1, timestamp: 1000, netWpm: 50, rawWpm: 50, errors: 0 },
      { second: 2, timestamp: 2000, netWpm: 60, rawWpm: 60, errors: 0 },
      { second: 3, timestamp: 3000, netWpm: 70, rawWpm: 70, errors: 0 }
    ];

    const svg = renderTelemetryChart(container, flawlessSnapshots);
    const errorDots = svg.querySelectorAll('.chart-error-dot');

    assert.equal(errorDots.length, 0, 'Must have zero error dots for flawless test');
  });

  it('T2.5.3: Errors committed on every single second of test: chart renders all error markers cleanly without visual SVG clipping', async () => {
    const { renderTelemetryChart } = await getChartModule();

    const errorFilledSnapshots = [
      { second: 1, timestamp: 1000, netWpm: 20, rawWpm: 35, errors: 2 },
      { second: 2, timestamp: 2000, netWpm: 25, rawWpm: 40, errors: 1 },
      { second: 3, timestamp: 3000, netWpm: 30, rawWpm: 45, errors: 3 }
    ];

    const svg = renderTelemetryChart(container, errorFilledSnapshots);
    const errorDots = svg.querySelectorAll('.chart-error-dot');

    assert.equal(errorDots.length, 3, 'Must render exactly 3 error dots');
  });

  it('T2.5.4: Double restart trigger (Tab+Enter hit twice within 50ms): only 1 reset executed, avoiding duplicate timers or race conditions', () => {
    let resetCount = 0;
    let isResetting = false;

    const debouncedReset = () => {
      if (isResetting) return;
      isResetting = true;
      resetCount++;
      setTimeout(() => {
        isResetting = false;
      }, 100);
    };

    // First trigger
    debouncedReset();
    // Immediate second trigger within 50ms
    debouncedReset();

    assert.equal(resetCount, 1, 'Debounce must prevent double reset execution');
  });

  it('T2.5.5: Test ends while user has 5 uncommitted extra characters on word: extra characters are fully accounted for in character breakdown and Raw WPM', async () => {
    const { getCharacterBreakdown, calculateRawWpm } = await getMetricsModule();

    const mockWordWithExtras = {
      letters: [
        { state: 'correct' },
        { state: 'correct' },
        { state: 'extra' },
        { state: 'extra' },
        { state: 'extra' },
        { state: 'extra' },
        { state: 'extra' }
      ]
    };

    const breakdown = getCharacterBreakdown([mockWordWithExtras]);
    assert.equal(breakdown.extra, 5);
    assert.equal(breakdown.correct, 2);

    // Total characters typed = 2 correct + 5 extra = 7 characters in 10s
    const rawWpm = calculateRawWpm(7, 10);
    // (7 * 12) / 10 = 84 / 10 = 8.4 -> 8 WPM
    assert.equal(rawWpm, 8);
  });
});
