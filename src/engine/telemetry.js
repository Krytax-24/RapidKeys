/**
 * RapidKeys Engine - Telemetry Logger
 * Records immutable per-second snapshots during typing tests for real-time tracking
 * and interactive line chart rendering.
 * 
 * Schema:
 * {
 *   second: number,     // Elapsed integer second (1, 2, 3...)
 *   timestamp: number,  // Elapsed milliseconds from test start (via performance.now)
 *   netWpm: number,     // Net WPM at this second
 *   rawWpm: number,     // Raw WPM at this second
 *   errors: number      // Errors committed strictly within this 1-second interval
 * }
 */

import { calculateNetWpm, calculateRawWpm } from './metrics.js';

/**
 * Returns current timestamp in milliseconds using performance.now() if available.
 * @returns {number}
 */
function getNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * TelemetryLogger manages periodic sampling and recording of typing performance.
 */
export class TelemetryLogger {
  /**
   * @param {Object|Function} [optionsOrFn] - Options object or metrics getter function
   * @param {Function} [optionsOrFn.getMetrics] - Optional callback returning { netWpm, rawWpm, errors, correctChars, totalTypedChars }
   * @param {number} [optionsOrFn.intervalMs=1000] - Sampling interval in milliseconds
   */
  constructor(optionsOrFn = {}) {
    let options = {};
    if (typeof optionsOrFn === 'function') {
      options = { getMetrics: optionsOrFn };
    } else if (optionsOrFn && typeof optionsOrFn === 'object') {
      options = optionsOrFn;
    }

    this.options = options;
    this.getMetrics = typeof options.getMetrics === 'function' ? options.getMetrics : null;
    this.intervalMs = Number(options.intervalMs) || 1000;

    this.snapshots = [];
    this.startTime = 0;
    this.isRunning = false;
    this.active = false;
    this.timerId = null;
    this.errorsSinceLastSecond = 0;
    this.totalErrors = 0;
  }

  /**
   * Starts telemetry logging.
   * Resets snapshot array and error counters.
   * 
   * @param {number} [startTime] - Optional start timestamp in ms (performance.now)
   * @returns {void}
   */
  start(startTime) {
    this.stop(); // Clear any existing timer
    this.snapshots = [];
    this.errorsSinceLastSecond = 0;
    this.totalErrors = 0;
    this.startTime = (typeof startTime === 'number' && Number.isFinite(startTime))
      ? startTime
      : getNow();
    this.isRunning = true;
    this.active = true;

    // Start 1-second interval timer if environment supports setInterval
    if (typeof setInterval !== 'undefined') {
      this.timerId = setInterval(() => {
        if (this.isRunning) {
          this.recordTick();
        }
      }, this.intervalMs);
      if (this.timerId && typeof this.timerId.unref === 'function') {
        this.timerId.unref();
      }
    }
  }

  /**
   * Records errors committed in the active interval.
   * 
   * @param {number} [count=1] - Number of errors to add
   */
  recordError(count = 1) {
    const errorCount = Math.max(0, Number(count) || 1);
    this.errorsSinceLastSecond += errorCount;
    this.totalErrors += errorCount;
  }

  /**
   * Alias for recordError for backward/forward compatibility.
   * @param {number} [count=1]
   */
  logError(count = 1) {
    this.recordError(count);
  }

  /**
   * Records a snapshot for an elapsed second.
   * Supports:
   * 1. Positional signature: recordTick(elapsedSec, netWpm, rawWpm, errors)
   * 2. Object signature: recordTick({ second, timestamp, netWpm, rawWpm, errors, correctChars, totalTypedChars })
   * 3. Automatic periodic signature: recordTick()
   * 
   * @param {number|Object} [firstArg] - Elapsed second or metrics object
   * @param {number} [netWpmArg] - Net WPM (when firstArg is number)
   * @param {number} [rawWpmArg] - Raw WPM (when firstArg is number)
   * @param {number} [errorsArg] - Errors count (when firstArg is number)
   * @returns {Object} The recorded TelemetrySnapshot
   */
  recordTick(firstArg, netWpmArg, rawWpmArg, errorsArg) {
    let second;
    let timestamp;
    let netWpm = 0;
    let rawWpm = 0;
    let errors = this.errorsSinceLastSecond;

    if (typeof firstArg === 'number') {
      // Positional call: recordTick(elapsedSec, netWpm, rawWpm, errors)
      second = firstArg;
      timestamp = second * 1000;
      if (typeof netWpmArg === 'number') netWpm = netWpmArg;
      if (typeof rawWpmArg === 'number') rawWpm = rawWpmArg;
      if (typeof errorsArg === 'number') errors = Math.max(0, errorsArg);
    } else if (firstArg && typeof firstArg === 'object') {
      // Object call: recordTick({ second, timestamp, netWpm, rawWpm, errors, ... })
      const now = getNow();
      const elapsedMs = Math.max(0, now - (this.startTime || now));
      second = typeof firstArg.second === 'number' ? firstArg.second : this.snapshots.length + 1;
      timestamp = typeof firstArg.timestamp === 'number' ? firstArg.timestamp : Math.round(elapsedMs);

      if (typeof firstArg.netWpm === 'number') {
        netWpm = firstArg.netWpm;
      } else if (typeof firstArg.correctChars === 'number') {
        netWpm = calculateNetWpm(firstArg.correctChars, second);
      }

      if (typeof firstArg.rawWpm === 'number') {
        rawWpm = firstArg.rawWpm;
      } else if (typeof firstArg.totalTypedChars === 'number') {
        rawWpm = calculateRawWpm(firstArg.totalTypedChars, second);
      }

      if (typeof firstArg.errors === 'number') {
        errors = Math.max(0, firstArg.errors);
      }
    } else {
      // No-arg call: automatic periodic timer tick
      const now = getNow();
      const elapsedMs = Math.max(0, now - (this.startTime || now));
      second = this.snapshots.length + 1;
      timestamp = Math.round(elapsedMs);

      if (this.getMetrics) {
        const live = this.getMetrics();
        if (live && typeof live === 'object') {
          if (typeof live.netWpm === 'number') {
            netWpm = live.netWpm;
          } else if (typeof live.correctChars === 'number') {
            netWpm = calculateNetWpm(live.correctChars, second);
          }

          if (typeof live.rawWpm === 'number') {
            rawWpm = live.rawWpm;
          } else if (typeof live.totalTypedChars === 'number') {
            rawWpm = calculateRawWpm(live.totalTypedChars, second);
          }

          if (typeof live.errors === 'number') {
            errors = Math.max(0, live.errors);
          }
        }
      }
    }

    const snapshot = {
      second,
      timestamp,
      netWpm: Math.max(0, Math.round(netWpm)),
      rawWpm: Math.max(0, Math.round(rawWpm)),
      errors: Math.max(0, Math.round(errors))
    };

    this.snapshots.push(snapshot);
    this.errorsSinceLastSecond = 0; // Reset errors committed strictly within this 1s interval

    return snapshot;
  }

  /**
   * Stops telemetry sampling and clears interval timer.
   * 
   * @returns {Array<Object>} The collected telemetry snapshots
   */
  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    this.active = false;
    return this.getSnapshots();
  }

  /**
   * Returns a copy of all recorded snapshots.
   * 
   * @returns {Array<Object>} Array of immutable snapshot objects
   */
  getSnapshots() {
    return this.snapshots.map(s => ({ ...s }));
  }

  /**
   * Resets the logger completely.
   */
  reset() {
    this.stop();
    this.snapshots = [];
    this.startTime = 0;
    this.errorsSinceLastSecond = 0;
    this.totalErrors = 0;
  }
}

/**
 * Factory helper function to instantiate a TelemetryLogger.
 * @param {Object} [options]
 * @returns {TelemetryLogger}
 */
export function createTelemetryLogger(options) {
  return new TelemetryLogger(options);
}
