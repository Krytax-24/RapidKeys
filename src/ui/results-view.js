/**
 * RapidKeys UI - Results View Screen
 * 
 * Renders the dedicated post-test performance overview screen displaying:
 * - Primary hero metrics (Net WPM, Accuracy)
 * - Secondary metrics (Raw WPM, Consistency, Mode, Elapsed Time)
 * - Detailed character breakdown HUD (correct / incorrect / extra / missed)
 * - Embedded SVG telemetry line chart via src/ui/chart.js
 * - Restart button with shortcut tooltip label
 * - View transition management (hiding typing surface, displaying results)
 */

import { renderTelemetryChart } from './chart.js';

/**
 * Formats time elapsed into clean display string (e.g. "30s" or "32.6s").
 * 
 * @param {number|string} elapsed
 * @returns {string}
 */
function formatTimeElapsed(elapsed) {
  if (typeof elapsed === 'string' && elapsed.endsWith('s')) {
    return elapsed;
  }
  const num = Number(elapsed);
  if (!Number.isFinite(num) || num <= 0) {
    return '0s';
  }
  if (Number.isInteger(num)) {
    return `${num}s`;
  }
  return `${Number(num.toFixed(1))}s`;
}

/**
 * Renders the full results view into the given container.
 * 
 * @param {HTMLElement} container - Target mount element
 * @param {Object} [testSummary={}] - Final scoring metrics object
 * @param {Function} [onRestart=()=>{}] - Callback invoked when restart is triggered
 * @returns {HTMLElement} The created results-view element
 */
export function renderResults(container, testSummary = {}, onRestart = () => {}) {
  const doc = container?.ownerDocument || globalThis.document;
  if (!doc) {
    throw new Error('renderResults requires a valid container');
  }

  // Clear previous results view if already mounted inside container
  const oldResults = container.querySelector('.results-view');
  if (oldResults) {
    if (typeof oldResults.remove === 'function') {
      oldResults.remove();
    } else if (oldResults.parentElement) {
      oldResults.parentElement.removeChild(oldResults);
    }
  }

  // View transition: hide any active typing surface elements in container or parent
  const surfaceEl = container.querySelector('.typing-surface, #typingSurface, .words-wrapper') ||
                    doc.querySelector('.typing-surface, #typingSurface');
  if (surfaceEl) {
    surfaceEl.classList.add('hidden');
  }

  // Create results-view root
  const resultsEl = doc.createElement('div');
  resultsEl.className = 'results-view';
  resultsEl.id = 'resultsView';

  // -------------------------------------------------------------------
  // 1. Primary Hero Metrics Cards (Net WPM & Accuracy)
  // -------------------------------------------------------------------
  const heroGroup = doc.createElement('div');
  heroGroup.className = 'results-hero-group';

  // WPM Hero Card
  const wpmCard = doc.createElement('div');
  wpmCard.className = 'stat-card hero-card wpm-card';

  const wpmLabel = doc.createElement('div');
  wpmLabel.className = 'stat-label';
  wpmLabel.textContent = 'wpm';

  const wpmVal = doc.createElement('div');
  wpmVal.className = 'stat-val stat-wpm';
  wpmVal.textContent = String(testSummary.netWpm ?? 0);

  wpmCard.appendChild(wpmLabel);
  wpmCard.appendChild(wpmVal);

  // Accuracy Hero Card
  const accCard = doc.createElement('div');
  accCard.className = 'stat-card hero-card acc-card';

  const accLabel = doc.createElement('div');
  accLabel.className = 'stat-label';
  accLabel.textContent = 'acc';

  const accVal = doc.createElement('div');
  accVal.className = 'stat-val stat-acc';
  const accNum = testSummary.accuracy !== undefined ? testSummary.accuracy : 100;
  accVal.textContent = `${accNum}%`;

  accCard.appendChild(accLabel);
  accCard.appendChild(accVal);

  heroGroup.appendChild(wpmCard);
  heroGroup.appendChild(accCard);
  resultsEl.appendChild(heroGroup);

  // -------------------------------------------------------------------
  // 2. Interactive SVG Telemetry Line Chart
  // -------------------------------------------------------------------
  const chartWrapper = doc.createElement('div');
  chartWrapper.className = 'results-chart-wrapper';

  const snapshots = testSummary.snapshots || testSummary.telemetry || [];
  renderTelemetryChart(chartWrapper, snapshots);
  resultsEl.appendChild(chartWrapper);

  // -------------------------------------------------------------------
  // 3. Secondary Metrics Grid
  // -------------------------------------------------------------------
  const secondaryGroup = doc.createElement('div');
  secondaryGroup.className = 'results-secondary-group';

  // Raw WPM
  const rawItem = doc.createElement('div');
  rawItem.className = 'stat-item';
  const rawLabel = doc.createElement('span');
  rawLabel.className = 'stat-sub-label';
  rawLabel.textContent = 'raw: ';
  const rawVal = doc.createElement('span');
  rawVal.className = 'stat-raw';
  rawVal.textContent = String(testSummary.rawWpm ?? testSummary.netWpm ?? 0);
  rawItem.appendChild(rawLabel);
  rawItem.appendChild(rawVal);
  secondaryGroup.appendChild(rawItem);

  // Consistency
  const consItem = doc.createElement('div');
  consItem.className = 'stat-item';
  const consLabel = doc.createElement('span');
  consLabel.className = 'stat-sub-label';
  consLabel.textContent = 'consistency: ';
  const consVal = doc.createElement('span');
  consVal.className = 'stat-consistency';
  consVal.textContent = `${testSummary.consistency ?? 0}%`;
  consItem.appendChild(consLabel);
  consItem.appendChild(consVal);
  secondaryGroup.appendChild(consItem);

  // Mode
  const modeItem = doc.createElement('div');
  modeItem.className = 'stat-item';
  const modeLabel = doc.createElement('span');
  modeLabel.className = 'stat-sub-label';
  modeLabel.textContent = 'mode: ';
  const modeVal = doc.createElement('span');
  modeVal.className = 'stat-mode';
  modeVal.textContent = testSummary.mode || 'time 30';
  modeItem.appendChild(modeLabel);
  modeItem.appendChild(modeVal);
  secondaryGroup.appendChild(modeItem);

  // Time Elapsed
  const timeItem = doc.createElement('div');
  timeItem.className = 'stat-item';
  const timeLabel = doc.createElement('span');
  timeLabel.className = 'stat-sub-label';
  timeLabel.textContent = 'time: ';
  const timeVal = doc.createElement('span');
  timeVal.className = 'stat-time';
  timeVal.textContent = formatTimeElapsed(testSummary.timeElapsed ?? 30);
  timeItem.appendChild(timeLabel);
  timeItem.appendChild(timeVal);
  secondaryGroup.appendChild(timeItem);

  // -------------------------------------------------------------------
  // 4. Character Breakdown HUD
  // -------------------------------------------------------------------
  const breakdownItem = doc.createElement('div');
  breakdownItem.className = 'stat-item stat-item-breakdown';
  const breakdownLabel = doc.createElement('span');
  breakdownLabel.className = 'stat-sub-label';
  breakdownLabel.textContent = 'characters: ';
  breakdownItem.appendChild(breakdownLabel);

  const breakdownContainer = doc.createElement('div');
  breakdownContainer.className = 'character-breakdown';

  breakdownContainer.innerHTML = `
    <span class="stat-correct">${testSummary.breakdown?.correct ?? 0}</span> /
    <span class="stat-incorrect">${testSummary.breakdown?.incorrect ?? 0}</span> /
    <span class="stat-extra">${testSummary.breakdown?.extra ?? 0}</span> /
    <span class="stat-missed">${testSummary.breakdown?.missed ?? 0}</span>
  `;

  breakdownItem.appendChild(breakdownContainer);
  secondaryGroup.appendChild(breakdownItem);

  resultsEl.appendChild(secondaryGroup);

  // -------------------------------------------------------------------
  // 5. Restart Action Controls
  // -------------------------------------------------------------------
  const actionsGroup = doc.createElement('div');
  actionsGroup.className = 'results-actions-group';

  const restartBtn = doc.createElement('button');
  restartBtn.type = 'button';
  restartBtn.id = 'restartButton';
  restartBtn.className = 'btn-restart';
  restartBtn.setAttribute('aria-label', 'Restart Test (Tab + Enter)');
  restartBtn.setAttribute('title', 'restart test (Tab + Enter)');

  const restartIcon = doc.createElement('span');
  restartIcon.className = 'restart-icon';
  restartIcon.textContent = '↻';

  const restartText = doc.createElement('span');
  restartText.className = 'restart-text';
  restartText.textContent = 'Restart (Tab + Enter)';

  restartBtn.appendChild(restartIcon);
  restartBtn.appendChild(restartText);

  restartBtn.addEventListener('click', (e) => {
    if (typeof e?.preventDefault === 'function') e.preventDefault();
    if (typeof onRestart === 'function') {
      onRestart();
    }
  });

  actionsGroup.appendChild(restartBtn);
  resultsEl.appendChild(actionsGroup);

  // Mount to target container
  container.appendChild(resultsEl);
  return resultsEl;
}

export default renderResults;
