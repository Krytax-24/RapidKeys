/**
 * RapidKeys Engine - Finite State Machine & Timing Controller
 * Manages typing test lifecycle states (IDLE, RUNNING, PAUSED, FINISHED),
 * state transitions, event triggers, and high-precision elapsed time tracking.
 */

/**
 * Typing test state enumeration.
 * @readonly
 * @enum {string}
 */
export const TypingState = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED'
});

/**
 * Returns current high-precision timestamp in milliseconds.
 * Uses performance.now() if available, with Date.now() fallback.
 * @returns {number}
 */
function getNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * Valid transitions mapping for each state.
 */
const VALID_TRANSITIONS = {
  [TypingState.IDLE]: [TypingState.RUNNING, TypingState.FINISHED],
  [TypingState.RUNNING]: [TypingState.PAUSED, TypingState.FINISHED, TypingState.IDLE],
  [TypingState.PAUSED]: [TypingState.RUNNING, TypingState.FINISHED, TypingState.IDLE],
  [TypingState.FINISHED]: [TypingState.IDLE, TypingState.RUNNING]
};

/**
 * Determines whether a transition from one state to another is valid.
 * 
 * @param {string} fromState - Origin state
 * @param {string} toState - Target destination state
 * @returns {boolean} True if transition is permitted
 */
export function isValidTransition(fromState, toState) {
  if (fromState === toState) {
    return true; // Idempotent transitions are safe
  }
  const allowed = VALID_TRANSITIONS[fromState];
  return Array.isArray(allowed) && allowed.includes(toState);
}

/**
 * TypingStateMachine manages test states, elapsed timing, and event dispatch.
 */
export class TypingStateMachine {
  /**
   * @param {string} [initialState=TypingState.IDLE]
   */
  constructor(initialState = TypingState.IDLE) {
    this.state = initialState;
    this.startTime = 0;
    this.endTime = 0;
    this.pauseStartTime = 0;
    this.accumulatedPausedMs = 0;
    this._listeners = new Map();
  }

  /**
   * Returns current active state.
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Convenience state inspectors.
   */
  isIdle() {
    return this.state === TypingState.IDLE;
  }

  isRunning() {
    return this.state === TypingState.RUNNING;
  }

  isPaused() {
    return this.state === TypingState.PAUSED;
  }

  isFinished() {
    return this.state === TypingState.FINISHED;
  }

  /**
   * Registers an event listener.
   * 
   * @param {string} event - Event name ('stateChange', 'start', 'pause', 'resume', 'finish', 'reset')
   * @param {Function} callback - Event handler
   * @returns {() => void} Unsubscribe function
   */
  on(event, callback) {
    if (typeof callback !== 'function') return () => {};
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unregisters an event listener.
   * 
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this._listeners.has(event)) {
      this._listeners.get(event).delete(callback);
    }
  }

  /**
   * Emits an event to all registered listeners.
   * 
   * @param {string} event
   * @param {any} payload
   */
  emit(event, payload) {
    if (this._listeners.has(event)) {
      for (const callback of this._listeners.get(event)) {
        try {
          callback(payload);
        } catch (err) {
          console.error(`Error in TypingStateMachine '${event}' handler:`, err);
        }
      }
    }
  }

  /**
   * Transitions to a new state if valid.
   * 
   * @param {string} nextState
   * @param {any} [payload]
   * @returns {boolean} True if transition succeeded
   */
  transitionTo(nextState, payload) {
    if (!isValidTransition(this.state, nextState)) {
      throw new Error(`Invalid TypingStateMachine transition: cannot transition from ${this.state} to ${nextState}`);
    }

    if (this.state === nextState) {
      return true;
    }

    const previousState = this.state;
    this.state = nextState;

    this.emit('stateChange', {
      from: previousState,
      to: nextState,
      payload
    });

    return true;
  }

  /**
   * Starts or restarts typing test.
   * Transitions from IDLE (or FINISHED/PAUSED) to RUNNING.
   * 
   * @param {number} [timestamp] - High-precision start timestamp
   */
  start(timestamp) {
    const now = (typeof timestamp === 'number' && Number.isFinite(timestamp)) ? timestamp : getNow();
    this.startTime = now;
    this.endTime = 0;
    this.pauseStartTime = 0;
    this.accumulatedPausedMs = 0;

    this.transitionTo(TypingState.RUNNING, { timestamp: now });
    this.emit('start', { timestamp: now });
  }

  /**
   * Pauses an active running test.
   * 
   * @param {number} [timestamp]
   */
  pause(timestamp) {
    if (this.state !== TypingState.RUNNING) {
      return;
    }
    const now = (typeof timestamp === 'number' && Number.isFinite(timestamp)) ? timestamp : getNow();
    this.pauseStartTime = now;

    this.transitionTo(TypingState.PAUSED, { timestamp: now });
    this.emit('pause', {
      timestamp: now,
      elapsedMs: this.getElapsedMs(now)
    });
  }

  /**
   * Resumes a paused test.
   * 
   * @param {number} [timestamp]
   */
  resume(timestamp) {
    if (this.state !== TypingState.PAUSED) {
      return;
    }
    const now = (typeof timestamp === 'number' && Number.isFinite(timestamp)) ? timestamp : getNow();
    if (this.pauseStartTime > 0) {
      const pauseDuration = Math.max(0, now - this.pauseStartTime);
      this.accumulatedPausedMs += pauseDuration;
      this.pauseStartTime = 0;
    }

    this.transitionTo(TypingState.RUNNING, { timestamp: now });
    this.emit('resume', {
      timestamp: now,
      elapsedMs: this.getElapsedMs(now)
    });
  }

  /**
   * Finishes an active or paused test.
   * 
   * @param {number} [timestamp]
   * @param {any} [results]
   */
  finish(timestamp, results = {}) {
    if (this.state === TypingState.FINISHED || this.state === TypingState.IDLE) {
      return;
    }
    const now = (typeof timestamp === 'number' && Number.isFinite(timestamp)) ? timestamp : getNow();

    // If finishing while paused, account for paused time
    if (this.pauseStartTime > 0) {
      this.accumulatedPausedMs += Math.max(0, now - this.pauseStartTime);
      this.pauseStartTime = 0;
    }

    this.endTime = now;
    const finalElapsedMs = this.getElapsedMs(now);

    this.transitionTo(TypingState.FINISHED, { timestamp: now, elapsedMs: finalElapsedMs, results });
    this.emit('finish', {
      timestamp: now,
      elapsedMs: finalElapsedMs,
      elapsedSec: finalElapsedMs / 1000,
      results
    });
  }

  /**
   * Resets the state machine back to IDLE.
   */
  reset() {
    this.startTime = 0;
    this.endTime = 0;
    this.pauseStartTime = 0;
    this.accumulatedPausedMs = 0;

    if (this.state !== TypingState.IDLE) {
      this.transitionTo(TypingState.IDLE);
    }
    this.emit('reset', {});
  }

  /**
   * Returns elapsed time in milliseconds, excluding paused periods.
   * 
   * @param {number} [nowTimestamp] - Optional reference timestamp (useful for deterministic tests)
   * @returns {number} Elapsed ms >= 0
   */
  getElapsedMs(nowTimestamp) {
    if (this.state === TypingState.IDLE || this.startTime === 0) {
      return 0;
    }

    if (this.state === TypingState.FINISHED) {
      const finishTime = this.endTime || this.startTime;
      return Math.max(0, (finishTime - this.startTime) - this.accumulatedPausedMs);
    }

    if (this.state === TypingState.PAUSED) {
      const pauseRef = this.pauseStartTime || this.startTime;
      return Math.max(0, (pauseRef - this.startTime) - this.accumulatedPausedMs);
    }

    // RUNNING
    const current = (typeof nowTimestamp === 'number' && Number.isFinite(nowTimestamp))
      ? nowTimestamp
      : getNow();
    return Math.max(0, (current - this.startTime) - this.accumulatedPausedMs);
  }

  /**
   * Returns elapsed time in seconds, excluding paused periods.
   * 
   * @param {number} [nowTimestamp]
   * @returns {number} Elapsed seconds >= 0
   */
  getElapsedSeconds(nowTimestamp) {
    return this.getElapsedMs(nowTimestamp) / 1000;
  }
}

/**
 * Factory helper function to instantiate a TypingStateMachine.
 * @param {string} [initialState]
 * @returns {TypingStateMachine}
 */
export function createStateMachine(initialState) {
  return new TypingStateMachine(initialState);
}
