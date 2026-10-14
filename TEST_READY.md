# TEST READY: RapidKeys Multi-Tier E2E Test Suite

**Author**: `test_writer_1` (E2E Test Writer)  
**Date**: 2026-10-14  
**Project**: RapidKeys Rebuild  
**Test Runner**: Native Node.js `node:test` + `node:assert/strict` (Node v18+)  
**External Build / Test Dependencies**: **Zero** (0 npm packages needed)  
**Total Automated Tests**: **78 tests** across 4 tiers  

---

## 1. Executive Summary

A comprehensive, opaque-box, requirement-driven test suite comprising **78 automated tests** has been authored and structured across 4 distinct testing tiers. The entire suite operates on native ES modules and Node's built-in `node:test` runner, paired with a zero-dependency headless DOM and browser environment harness (`tests/helpers/dom-harness.js`) and a realistic typing interaction simulator (`tests/helpers/user-simulator.js`).

Every test directly maps to requirements (R1–R5) and acceptance criteria specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

---

## 2. Test Execution Commands

| Target | Command | Test Count |
|---|---|:---:|
| **Full Test Suite** | `node --test tests/**/*.test.js` | **78** |
| **npm test script** | `npm test` | **78** |
| **Spec Reporter Output** | `node --test --test-reporter=spec tests/**/*.test.js` | **78** |
| **Tier 1: Feature Coverage** | `node --test tests/tier1-features/*.test.js` | **32** |
| **Tier 2: Boundary Cases** | `node --test tests/tier2-boundary/*.test.js` | **31** |
| **Tier 3: Pairwise Combinations**| `node --test tests/tier3-combinations/*.test.js` | **10** |
| **Tier 4: Realistic Scenarios** | `node --test tests/tier4-scenarios/*.test.js` | **5** |

---

## 3. Test Breakdown by Tier & Feature Area

```
====================================================================================================
TIER                          FEATURE AREA                       TESTS   SPEC MAPPING
====================================================================================================
Tier 1: Feature Coverage      F1: In-Place Typing Surface          6     R1, AC #39, #40, #13
                              F2: Caret Mechanics & Line Scroll    5     R1, AC #41, #42
                              F3: Scoring & Live Telemetry         6     R2, AC #46, #47, #48, #49, #50
                              F4: Test Modes, Words & Config       5     R3, AC #53, #54, #55, #56, #57
                              F5: Results View & Chart             5     R4, AC #31, #60, #61, #62
                              F6: Theming Engine & Shortcuts       5     R5, AC #33, #34, #43
----------------------------------------------------------------------------------------------------
                              Tier 1 Subtotal:                    32 tests
====================================================================================================
Tier 2: Boundary Cases        B1: Typing Boundaries                5     dt=0, zero-speed, modifiers
                              B2: Caret & Layout Boundaries        5     word wrap, rapid backspaces, cap
                              B3: Precision Scoring Boundaries     6     sigma=0, CV>1, 1-sec, restart
                              B4: Modes & Storage Boundaries       5     JSON corruption, quota, mixed
                              B5: Results & Chart Boundaries       5     0-sec chart, error dots, double restart
                              B6: Theming & Shortcuts Boundaries   5     rapid cycling, blur suppression
----------------------------------------------------------------------------------------------------
                              Tier 2 Subtotal:                    31 tests
====================================================================================================
Tier 3: Pairwise Matrix       C1 - C10 Pairwise Combinations      10     Orthogonal factor matrix
====================================================================================================
Tier 4: Realistic Scenarios   S1: Casual Typer Journey             1     Corrections, dirty word, Tab+Enter
                              S2: Competitive Speed Demon          1     >120 WPM sprint, extra overflow
                              S3: Programmer Code & Data           1     25 words, punct + num, case-sensitive
                              S4: Interrupted Session & Recovery   1     60s test, blur overlay, refocus
                              S5: Persistent Preference Reload     1     Theme 'nord', 60s, localStorage
----------------------------------------------------------------------------------------------------
                              Tier 4 Subtotal:                     5 tests
====================================================================================================
GRAND TOTAL                                                       78 tests
====================================================================================================
```

---

## 4. Test Catalog Inventory

### Tier 1: Feature Coverage (32 Tests)

#### `tests/tier1-features/t1-f1-typing-surface.test.js` (6 tests)
- `T1.1.1`: Correct keystroke adds `.correct` class to current `<letter>` and increments character pointer.
- `T1.1.2`: Incorrect keystroke adds `.incorrect` class to current `<letter>` and increments character pointer.
- `T1.1.3`: Typing past word length dynamically creates and appends `<letter class="letter extra incorrect">`.
- `T1.1.4`: Backspace unmarks previous character, restores `.letter` untyped state, or removes extra letter node.
- `T1.1.5`: Ctrl+Backspace clears entire current word, removing all extra letters and resetting untyped state.
- `T1.1.6`: Space bar advances to next word, marks any remaining untyped letters in current word as `.missed`.

#### `tests/tier1-features/t1-f2-caret-mechanics.test.js` (5 tests)
- `T1.2.1`: Caret initializes at first letter coordinates (`left: 0, top: 0`) with `.blinking` animation class.
- `T1.2.2`: First valid keypress removes `.blinking` class and translates caret smoothly to next letter offset.
- `T1.2.3`: Caret correctly positions at trailing edge of word when awaiting Space or after extra characters.
- `T1.2.4`: Active line detection: when active word moves to line 2+, container scrolls to keep active line locked.
- `T1.2.5`: Idle timer resumes caret blinking after 500ms of typing inactivity.

#### `tests/tier1-features/t1-f3-scoring-telemetry.test.js` (6 tests)
- `T1.3.1`: Net WPM formula: typing 25 correct characters in 30.0s outputs exactly 10 Net WPM `((25/5)/0.5 = 10)`.
- `T1.3.2`: Raw vs Net WPM: 25 correct + 10 uncorrected error characters in 30s outputs 10 Net WPM and 14 Raw WPM.
- `T1.3.3`: Accuracy calculation with corrected errors: typing error + backspace + correct letter reduces overall accuracy.
- `T1.3.4`: Consistency calculation: deterministically computes coefficient of variation $(1 - \sigma/\mu) \times 100$ bounded $[0, 100]$.
- `T1.3.5`: Per-second telemetry logger captures `{ second, timestamp, netWpm, rawWpm, errors }` for each elapsed second.
- `T1.3.6`: Character breakdown counters accurately tally correct, incorrect, extra, and missed characters.

#### `tests/tier1-features/t1-f4-modes-config.test.js` (5 tests)
- `T1.4.1`: Time mode (15s, 30s, 60s, 120s) terminates test precisely when elapsed time reaches target duration.
- `T1.4.2`: Word count mode (10, 25, 50, 100) terminates test immediately upon submitting final word.
- `T1.4.3`: Punctuation toggle injects capitals, periods, commas, quotes, and question marks into word stream.
- `T1.4.4`: Numbers toggle injects numeric digits into word stream.
- `T1.4.5`: Active configuration persists to `localStorage` and rehydrates on startup.

#### `tests/tier1-features/t1-f5-results-chart.test.js` (5 tests)
- `T1.5.1`: Results screen mounts upon test completion, hides typing surface, and exposes restart button.
- `T1.5.2`: Primary cards render Net WPM and Accuracy percentages matching calculated test score.
- `T1.5.3`: Secondary metrics render Raw WPM, Consistency percentage, mode label, and total time elapsed.
- `T1.5.4`: SVG telemetry chart renders Net WPM curve, Raw WPM curve, and error indicator circles on error seconds.
- `T1.5.5`: Pressing `Tab` + `Enter` or clicking restart button resets test state and returns to fresh typing surface.

#### `tests/tier1-features/t1-f6-theming-shortcuts.test.js` (5 tests)
- `T1.6.1`: Theme switcher modifies CSS custom property palette via `document.documentElement[data-theme]`.
- `T1.6.2`: Distraction-free focus mode adds `.is-typing` class to body on first keypress, dimming header and footer.
- `T1.6.3`: Out-of-focus blur event displays `#focusOverlay` notice and blurs typing surface.
- `T1.6.4`: Clicking `#focusOverlay` or pressing any key refocuses input and hides blur notice.
- `T1.6.5`: Pressing `Esc` key opens command palette / theme switcher modal.

---

### Tier 2: Boundary & Corner Cases (31 Tests)

#### `tests/tier2-boundary/t2-f1-typing-boundaries.test.js` (5 tests)
- `T2.1.1`: Zero keypresses during active test until timeout: returns 0 Net WPM, 0 Raw WPM, 100% accuracy without NaN / `0/0` errors.
- `T2.1.2`: Backspace at index 0 of first word: no-op, pointer stays $\ge 0$, no negative indexing or crash.
- `T2.1.3`: Space pressed at index 0 of word (empty word): ignored completely, prevents accidental word skipping.
- `T2.1.4`: Rapid burst keypresses within 0ms timestamp difference (`dt == 0`): velocity calculation avoids division by zero (`Infinity`).
- `T2.1.5`: Non-printable modifier keys pressed (Shift, Control, Alt, CapsLock): ignored by typing engine, does not register as incorrect character.

#### `tests/tier2-boundary/t2-f2-caret-boundaries.test.js` (5 tests)
- `T2.2.1`: Extreme single-word length wrapping across multiple lines: caret coordinates track word wrap without escaping viewport boundary.
- `T2.2.2`: Fast consecutive Backspaces (5 backspaces in 50ms): caret repositions instantly without animation queue lagging.
- `T2.2.3`: Window resize event during active test: triggers caret re-measurement to prevent floating detached caret.
- `T2.2.4`: Rapid typing at >200 WPM: caret translation keeps pace with active letter without frame dropping.
- `T2.2.5`: Extra characters exceeding safety cap (15 extra letters): additional keystrokes ignored to prevent DOM explosion.

#### `tests/tier2-boundary/t2-f3-scoring-boundaries.test.js` (6 tests)
- `T2.3.1`: Immediate test restart at elapsed time = 0.0s: Net and Raw WPM guard against division by zero, return 0.
- `T2.3.2`: 100% incorrect typing (every key typed is wrong): Net WPM clamped to 0, Accuracy is 0%, Raw WPM reflects gross speed.
- `T2.3.3`: Perfectly uniform typing speed across all seconds: standard deviation $\sigma = 0$, Consistency outputs exactly 100%.
- `T2.3.4`: Wildly erratic typing speed (e.g. 150 WPM, then 0 WPM, then 120 WPM): standard deviation exceeds mean, Consistency is cleanly clamped to 0%.
- `T2.3.5`: Single-second test duration ($k=1$ sample): Consistency outputs 100% (if $w_1 > 0$) or 0% without NaN.
- `T2.3.6`: All typed characters deleted with backspace before space submitted: Accuracy properly reflects total keystrokes attempted including deleted ones.

#### `tests/tier2-boundary/t2-f4-modes-boundaries.test.js` (5 tests)
- `T2.4.1`: Mid-test mode toggle attempt while typing: cleanly cancels running test, clears timers, resets state to IDLE.
- `T2.4.2`: 100-word mode lazy buffer generation: buffers words continuously without UI latency or memory leak.
- `T2.4.3`: Corrupted `localStorage` data (invalid JSON or missing fields): gracefully falls back to `DEFAULT_CONFIG` without throwing uncaught exceptions.
- `T2.4.4`: Simultaneous toggle of Punctuation AND Numbers: correctly generates mixed tokens (e.g. "Rapid, 123 speed.").
- `T2.4.5`: Incognito / storage quota exceeded on `localStorage`: storage errors caught safely; app continues with in-memory settings.

#### `tests/tier2-boundary/t2-f5-results-chart-boundaries.test.js` (5 tests)
- `T2.5.1`: 0-second test completed before first 1000ms telemetry sample: chart renders empty state or single 0-coordinate point gracefully.
- `T2.5.2`: Zero errors committed during entire test: chart renders clean curves with exactly 0 error tick marks without null reference.
- `T2.5.3`: Errors committed on every single second of test: chart renders all error markers cleanly without visual SVG clipping.
- `T2.5.4`: Double restart trigger (`Tab+Enter` hit twice within 50ms): only 1 reset executed, avoiding duplicate timers or race conditions.
- `T2.5.5`: Test ends while user has 5 uncommitted extra characters on word: extra characters are fully accounted for in character breakdown and Raw WPM.

#### `tests/tier2-boundary/t2-f6-theming-shortcuts-boundaries.test.js` (5 tests)
- `T2.6.1`: Rapid theme cycling (5 themes in 100ms): final theme applied cleanly to `data-theme` without dangling style classes.
- `T2.6.2`: Blur event firing while on Results screen: blur overlay is suppressed (must only appear during active typing).
- `T2.6.3`: Pressing `Esc` when modal is already open: closes modal and returns focus cleanly to typing input.
- `T2.6.4`: Normal typing of keys 't', 'a', 'b' or 'e', 's', 'c' within words: does NOT trigger Tab+Enter restart or Esc modal while typing words.
- `T2.6.5`: 10 repeated focus/blur cycles: event listeners remain stable without duplicate listener registration.

---

### Tier 3: Cross-Feature Combinations (10 Tests)

#### `tests/tier3-combinations/t3-pairwise-combinations.test.js`
- `C1`: Time 15s + Punctuation ON + High Typos & Backspaces.
- `C2`: Words 10w + Numbers ON + Flawless (100% Acc) + Tab+Enter Restart.
- `C3`: Time 30s + Punct & Numbers ON + Normal Typing + Blur at 10s & Refocus at 12s.
- `C4`: Words 25w + Default mode + Overflow extra chars on 5 words + Space advance.
- `C5`: Time 60s + Punctuation ON + Rapid Ctrl+Backspace on every word + Tab+Enter mid-test.
- `C6`: Words 50w + Numbers ON + Consistent 80 WPM + Esc Theme Switch -> Monokai.
- `C7`: Time 120s + Punct & Numbers ON + Highly uniform cadence -> Consistency >= 95%.
- `C8`: Words 100w + Default + Burst typing >140 WPM + Window resize.
- `C9`: Time 15s + Default + 0 keypresses until timeout.
- `C10`: Words 10w + Punctuation ON + Complete -> Restart -> Type Test 2.

---

### Tier 4: Real-World Scenarios (5 Tests)

#### `tests/tier4-scenarios/t4-realistic-scenarios.test.js`
- `S1`: Scenario 1: Casual Typer Journey (Default 30s, corrections, uncorrected typo, chart, Tab+Enter restart).
- `S2`: Scenario 2: Competitive Speed Demon (15s sprint, >120 WPM, no backspaces, overflow extra characters).
- `S3`: Scenario 3: Programmer Code & Data Typing (25 words, Punctuation & Numbers ON, case sensitivity, termination on 25th word).
- `S4`: Scenario 4: Interrupted Session & Blur Recovery (60s test, blur at 15s, overlay shown, caret hidden, refocus at 18s).
- `S5`: Scenario 5: Preference Customization & Persistent Reload (Esc theme -> "nord", mode -> Time 60s, punc -> true, reload from localStorage).

---

## 5. Test Infrastructure Modules

1. **`tests/helpers/dom-harness.js`**:
   Zero-dependency in-memory DOM implementation providing `MockElement`, `MockDocument`, `classList`, `setAttribute`/`getAttribute`, `dataset`, `addEventListener`/`removeEventListener`/`dispatchEvent`, `querySelector`/`querySelectorAll`, and window/localStorage/performance mocks.
2. **`tests/helpers/user-simulator.js`**:
   High-fidelity programmatic keyboard simulator providing `typeKey`, `typeString`, `pressBackspace`, `pressSpace`, `pressShortcut`, and `delay`.
3. **`tests/helpers/contract-bridge.js`**:
   Dynamic contract bridge that directly imports authored ES modules from `src/...`, ensuring strict fidelity to the target implementation while maintaining resilience during milestone development.
