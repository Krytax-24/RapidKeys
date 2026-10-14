/**
 * RapidKeys UI - Telemetry Chart Component
 * 
 * Renders an interactive SVG timeline chart plotting:
 * - Net WPM curve (.chart-net-wpm)
 * - Raw WPM curve (.chart-raw-wpm)
 * - Error indicator markers (.chart-error-dot)
 * 
 * Resilient against 0-second tests, empty snapshot arrays, and erratic ranges.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_VIEW_WIDTH = 600;
const DEFAULT_VIEW_HEIGHT = 200;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 30;
const PADDING_LEFT = 20;
const PADDING_RIGHT = 20;

/**
 * Creates an SVG element with attributes in the SVG namespace.
 * 
 * @param {Document} doc
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 * @returns {SVGElement}
 */
function createSvgElement(doc, tag, attrs = {}) {
  const el = doc.createElementNS ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, String(val));
  }
  return el;
}

/**
 * Renders the telemetry line chart inside container.
 * 
 * @param {HTMLElement} container - Target DOM container element
 * @param {Array<{ second: number, timestamp?: number, netWpm: number, rawWpm: number, errors: number }>} [snapshots=[]] - Recorded telemetry samples
 * @returns {SVGElement} The rendered SVG root element
 */
export function renderTelemetryChart(container, snapshots = []) {
  const doc = container?.ownerDocument || globalThis.document;
  if (!doc) {
    throw new Error('renderTelemetryChart requires a valid DOM container');
  }

  const svg = createSvgElement(doc, 'svg', {
    class: 'telemetry-chart',
    viewBox: `0 0 ${DEFAULT_VIEW_WIDTH} ${DEFAULT_VIEW_HEIGHT}`,
    preserveAspectRatio: 'none',
    width: '100%',
    height: '200'
  });

  const width = DEFAULT_VIEW_WIDTH;
  const height = DEFAULT_VIEW_HEIGHT;
  const plotWidth = width - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;

  // Handle empty snapshots gracefully (e.g. 0-second test)
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    // Render clean empty baseline paths
    const baselineY = height - PADDING_BOTTOM;
    const netPath = createSvgElement(doc, 'path', {
      class: 'chart-net-wpm',
      d: `M ${PADDING_LEFT} ${baselineY} L ${width - PADDING_RIGHT} ${baselineY}`,
      fill: 'none'
    });
    const rawPath = createSvgElement(doc, 'path', {
      class: 'chart-raw-wpm',
      d: `M ${PADDING_LEFT} ${baselineY} L ${width - PADDING_RIGHT} ${baselineY}`,
      fill: 'none'
    });

    svg.appendChild(netPath);
    svg.appendChild(rawPath);

    if (container) {
      container.appendChild(svg);
    }
    return svg;
  }

  // Determine vertical scale range
  let maxWpm = 0;
  for (const snap of snapshots) {
    if (snap) {
      if (typeof snap.rawWpm === 'number' && snap.rawWpm > maxWpm) maxWpm = snap.rawWpm;
      if (typeof snap.netWpm === 'number' && snap.netWpm > maxWpm) maxWpm = snap.netWpm;
    }
  }

  // Guarantee minimum headroom
  const scaleMax = Math.max(40, Math.ceil((maxWpm + 10) / 20) * 20);

  /**
   * Maps a WPM value to an SVG Y-coordinate.
   * @param {number} wpm
   * @returns {number}
   */
  const mapY = (wpm) => {
    const clamped = Math.max(0, Number(wpm) || 0);
    const fraction = clamped / scaleMax;
    return (height - PADDING_BOTTOM) - (fraction * plotHeight);
  };

  /**
   * Maps a sample index to an SVG X-coordinate.
   * @param {number} index
   * @param {number} total
   * @returns {number}
   */
  const mapX = (index, total) => {
    if (total <= 1) {
      return PADDING_LEFT + plotWidth / 2;
    }
    return PADDING_LEFT + (index / (total - 1)) * plotWidth;
  };

  // Add subtle background grid lines
  const gridGroup = createSvgElement(doc, 'g', { class: 'chart-grid' });
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const wpmVal = Math.round((scaleMax / gridSteps) * i);
    const y = mapY(wpmVal);
    const line = createSvgElement(doc, 'line', {
      x1: PADDING_LEFT,
      y1: y.toFixed(1),
      x2: width - PADDING_RIGHT,
      y2: y.toFixed(1),
      class: 'chart-grid-line',
      stroke: 'var(--sub-alt-color, #222)',
      'stroke-dasharray': '3 3'
    });
    gridGroup.appendChild(line);
  }
  svg.appendChild(gridGroup);

  // Generate paths and collect error dots
  let netPathD = '';
  let rawPathD = '';
  const errorDots = [];

  snapshots.forEach((snap, idx) => {
    const x = mapX(idx, snapshots.length);
    const netWpm = Math.max(0, snap.netWpm || 0);
    const rawWpm = Math.max(0, snap.rawWpm || 0);
    const netY = mapY(netWpm);
    const rawY = mapY(rawWpm);

    const xStr = x.toFixed(1);
    const netYStr = netY.toFixed(1);
    const rawYStr = rawY.toFixed(1);

    if (idx === 0) {
      netPathD += `M ${xStr} ${netYStr}`;
      rawPathD += `M ${xStr} ${rawYStr}`;
    } else {
      netPathD += ` L ${xStr} ${netYStr}`;
      rawPathD += ` L ${xStr} ${rawYStr}`;
    }

    // Error dots placed at seconds where errors occurred
    if (snap.errors > 0) {
      const dot = createSvgElement(doc, 'circle', {
        class: 'chart-error-dot',
        cx: xStr,
        cy: rawYStr,
        r: '4',
        'data-second': String(snap.second ?? (idx + 1)),
        'data-errors': String(snap.errors)
      });
      errorDots.push(dot);
    }
  });

  // If only 1 snapshot, extend path horizontally so it renders visibly
  if (snapshots.length === 1) {
    const single = snapshots[0];
    const netY = mapY(single.netWpm || 0).toFixed(1);
    const rawY = mapY(single.rawWpm || 0).toFixed(1);
    netPathD = `M ${PADDING_LEFT} ${netY} L ${width - PADDING_RIGHT} ${netY}`;
    rawPathD = `M ${PADDING_LEFT} ${rawY} L ${width - PADDING_RIGHT} ${rawY}`;
  }

  // Raw WPM path (drawn behind Net curve)
  const rawPath = createSvgElement(doc, 'path', {
    class: 'chart-raw-wpm',
    d: rawPathD,
    fill: 'none'
  });
  svg.appendChild(rawPath);

  // Net WPM path (drawn on top of Raw curve)
  const netPath = createSvgElement(doc, 'path', {
    class: 'chart-net-wpm',
    d: netPathD,
    fill: 'none'
  });
  svg.appendChild(netPath);

  // Append error dots on top
  for (const dot of errorDots) {
    svg.appendChild(dot);
  }

  if (container) {
    container.appendChild(svg);
  }

  return svg;
}

export default renderTelemetryChart;
