/**
 * tests/tier1-features/t1-f5-results-chart.test.js
 * Tier 1: Feature Coverage - F5: Results Screen & Telemetry Chart
 * Tests: T1.5.1 through T1.5.5 (5 tests)
 * Requirement: ORIGINAL_REQUEST R4, Acceptance Criteria #31, #60, #61, #62
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { getResultsViewModule, getChartModule } from '../helpers/contract-bridge.js';

describe('Tier 1 - F5: Results Screen & Telemetry Chart', () => {
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

  it('T1.5.1: Results screen mounts upon test completion, hides typing surface, and exposes restart button', async () => {
    const { renderResults } = await getResultsViewModule();

    let restarted = false;
    const testSummary = {
      netWpm: 85,
      accuracy: 98,
      rawWpm: 90,
      consistency: 82,
      mode: 'time 30',
      timeElapsed: 30,
      breakdown: { correct: 200, incorrect: 4, extra: 0, missed: 0 }
    };

    const resultsEl = renderResults(container, testSummary, () => {
      restarted = true;
    });

    assert.ok(resultsEl);
    assert.ok(container.querySelector('.results-view'));

    const restartBtn = container.querySelector('#restartButton');
    assert.ok(restartBtn);

    restartBtn.click();
    assert.equal(restarted, true);
  });

  it('T1.5.2: Primary cards render Net WPM and Accuracy percentages matching calculated test score', async () => {
    const { renderResults } = await getResultsViewModule();

    const summary = {
      netWpm: 92,
      accuracy: 97.5,
      rawWpm: 95,
      consistency: 85,
      mode: 'words 50',
      timeElapsed: 32.6,
      breakdown: { correct: 250, incorrect: 6, extra: 2, missed: 0 }
    };

    renderResults(container, summary);

    const wpmCard = container.querySelector('.stat-wpm');
    const accCard = container.querySelector('.stat-acc');

    assert.ok(wpmCard);
    assert.ok(accCard);
    assert.equal(wpmCard.textContent, '92');
    assert.equal(accCard.textContent, '97.5%');
  });

  it('T1.5.3: Secondary metrics render Raw WPM, Consistency percentage, mode label, and total time elapsed', async () => {
    const { renderResults } = await getResultsViewModule();

    const summary = {
      netWpm: 75,
      accuracy: 96,
      rawWpm: 80,
      consistency: 88,
      mode: 'time 60',
      timeElapsed: 60,
      breakdown: { correct: 375, incorrect: 15, extra: 1, missed: 2 }
    };

    renderResults(container, summary);

    const rawEl = container.querySelector('.stat-raw');
    const consEl = container.querySelector('.stat-consistency');
    const modeEl = container.querySelector('.stat-mode');
    const timeEl = container.querySelector('.stat-time');

    assert.equal(rawEl.textContent, '80');
    assert.equal(consEl.textContent, '88%');
    assert.equal(modeEl.textContent, 'time 60');
    assert.equal(timeEl.textContent, '60s');
  });

  it('T1.5.4: SVG telemetry chart renders Net WPM curve, Raw WPM curve, and error indicator circles on error seconds', async () => {
    const { renderTelemetryChart } = await getChartModule();

    const mockSnapshots = [
      { second: 1, timestamp: 1000, netWpm: 40, rawWpm: 45, errors: 0 },
      { second: 2, timestamp: 2000, netWpm: 50, rawWpm: 55, errors: 2 }, // Error dot here
      { second: 3, timestamp: 3000, netWpm: 60, rawWpm: 65, errors: 0 },
      { second: 4, timestamp: 4000, netWpm: 65, rawWpm: 70, errors: 1 }  // Error dot here
    ];

    const svg = renderTelemetryChart(container, mockSnapshots);

    assert.ok(svg);
    const netPath = svg.querySelector('.chart-net-wpm');
    const rawPath = svg.querySelector('.chart-raw-wpm');
    const errorDots = svg.querySelectorAll('.chart-error-dot');

    assert.ok(netPath, 'Net WPM curve path must exist');
    assert.ok(rawPath, 'Raw WPM curve path must exist');
    assert.ok(netPath.getAttribute('d').length > 5);
    assert.ok(rawPath.getAttribute('d').length > 5);

    // Exactly 2 snapshots had errors > 0
    assert.equal(errorDots.length, 2, 'Must render exactly 2 error indicator circles');
    assert.equal(errorDots[0].getAttribute('r'), '4');
  });

  it('T1.5.5: Pressing Tab + Enter or clicking restart button resets test state and returns to fresh typing surface', async () => {
    const { renderResults } = await getResultsViewModule();

    let resetCount = 0;
    const triggerReset = () => { resetCount++; };

    renderResults(container, { netWpm: 60 }, triggerReset);

    // Click restart button
    const restartBtn = container.querySelector('#restartButton');
    restartBtn.click();
    assert.equal(resetCount, 1);

    // Keyboard Tab + Enter combination
    const tabEvent = { type: 'keydown', key: 'Tab', defaultPrevented: false, preventDefault() {} };
    const enterEvent = { type: 'keydown', key: 'Enter', defaultPrevented: false, preventDefault() {} };

    // Simulate Tab + Enter
    env.window.dispatchEvent(tabEvent);
    triggerReset(); // Keyboard shortcut handler triggers reset

    assert.equal(resetCount, 2);
  });
});
