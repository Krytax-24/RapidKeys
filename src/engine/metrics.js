/**
 * RapidKeys Engine - Scoring & Metrics Calculations
 * Pure mathematical formulas matching standard typing metrics (Monkeytype / Typing.com standard).
 * 
 * Formulas:
 * - Net WPM = ((correctChars / 5) / (elapsedSec / 60)) = (correctChars * 12) / elapsedSec
 * - Raw WPM = ((totalTypedChars / 5) / (elapsedSec / 60)) = (totalTypedChars * 12) / elapsedSec
 * - Accuracy = (correctKeypresses / totalKeypresses) * 100
 * - Consistency = clamp(round(100 * (1 - (sigma / mu))), 0, 100)
 */

/**
 * Calculates Normalized Net WPM (Words Per Minute).
 * Returns integer >= 0.
 * Guard: if elapsedSec <= 0 or correctChars <= 0, returns 0.
 * Authoritative test: 25 correct characters in 30.0s returns exactly 10 WPM.
 * 
 * @param {number} correctChars - Number of correctly typed characters (in-place letters + valid spaces)
 * @param {number} elapsedSec - Elapsed time in seconds
 * @returns {number} Net WPM as an integer >= 0
 */
export function calculateNetWpm(correctChars, elapsedSec) {
  const chars = Number(correctChars);
  const seconds = Number(elapsedSec);

  if (!Number.isFinite(chars) || !Number.isFinite(seconds) || seconds <= 0 || chars <= 0) {
    return 0;
  }

  const netWpm = (chars * 12) / seconds;
  return Math.max(0, Math.round(netWpm));
}

/**
 * Calculates Gross Raw WPM (Motor typing speed).
 * Uncorrected errors and extra characters contribute to Raw WPM but not Net WPM.
 * Returns integer >= 0.
 * Guard: if elapsedSec <= 0 or totalTypedChars <= 0, returns 0.
 * 
 * @param {number} totalTypedChars - Total characters typed (correct + incorrect + extra + spaces)
 * @param {number} elapsedSec - Elapsed time in seconds
 * @returns {number} Raw WPM as an integer >= 0
 */
export function calculateRawWpm(totalTypedChars, elapsedSec) {
  const chars = Number(totalTypedChars);
  const seconds = Number(elapsedSec);

  if (!Number.isFinite(chars) || !Number.isFinite(seconds) || seconds <= 0 || chars <= 0) {
    return 0;
  }

  const rawWpm = (chars * 12) / seconds;
  return Math.max(0, Math.round(rawWpm));
}

/**
 * Calculates Keystroke Accuracy percentage.
 * Corrected errors (error + backspace + correct keypress) penalize overall accuracy.
 * Returns float [0, 100].
 * Guard: if totalKeypresses == 0, returns 100 (pristine baseline).
 * 
 * @param {number} correctKeypresses - Total keystrokes that produced a correct character
 * @param {number} totalKeypresses - All character keystrokes plus Backspaces
 * @returns {number} Accuracy percentage in range [0, 100]
 */
export function calculateAccuracy(correctKeypresses, totalKeypresses) {
  const total = Number(totalKeypresses);
  const correct = Number(correctKeypresses);

  if (!Number.isFinite(total) || total <= 0) {
    return 100;
  }

  if (!Number.isFinite(correct) || correct <= 0) {
    return 0;
  }

  if (correct >= total) {
    return 100;
  }

  const accuracy = (correct / total) * 100;
  return Math.min(100, Math.max(0, accuracy));
}

/**
 * Calculates Typing Consistency percentage based on the Coefficient of Variation (CV)
 * of per-second raw WPM samples recorded once per second.
 * 
 * Formula:
 * mu = mean(samples)
 * sigma = sqrt(sum((w_i - mu)^2) / k)
 * CV = sigma / mu (if mu > 0 else 0)
 * Consistency = clamp(round(100 * (1 - CV)), 0, 100)
 * 
 * Edge cases:
 * - k == 0 or all zeros: 0%
 * - k == 1 and w_1 > 0: 100%
 * - Perfectly uniform (sigma == 0): 100%
 * - High fluctuation (CV >= 1): clamped to 0% (never negative)
 * 
 * @param {Array<number|{rawWpm: number}>} rawWpmSamples - Array of per-second raw WPM values
 * @returns {number} Consistency as integer in range [0, 100]
 */
export function calculateConsistency(rawWpmSamples) {
  if (!Array.isArray(rawWpmSamples) || rawWpmSamples.length === 0) {
    return 0;
  }

  // Extract numeric samples whether passed as numbers or snapshot objects
  const samples = rawWpmSamples.map(sample => {
    if (typeof sample === 'number') return Number.isFinite(sample) ? sample : 0;
    if (sample && typeof sample.rawWpm === 'number') {
      return Number.isFinite(sample.rawWpm) ? sample.rawWpm : 0;
    }
    const parsed = Number(sample);
    return Number.isFinite(parsed) ? parsed : 0;
  });

  const k = samples.length;
  if (k === 0) return 0;

  // Single sample edge case
  if (k === 1) {
    return samples[0] > 0 ? 100 : 0;
  }

  // Calculate Mean (mu)
  const sum = samples.reduce((acc, val) => acc + val, 0);
  const mu = sum / k;

  if (mu <= 0) {
    return 0;
  }

  // Calculate Population Standard Deviation (sigma)
  const sumSquaredDiffs = samples.reduce((acc, val) => {
    const diff = val - mu;
    return acc + (diff * diff);
  }, 0);

  const variance = sumSquaredDiffs / k;
  const sigma = Math.sqrt(variance);

  // If variance is 0, typing is 100% uniform
  if (sigma === 0) {
    return 100;
  }

  // Coefficient of Variation: CV = sigma / mu
  const cv = sigma / mu;

  // Consistency = clamp(round(100 * (1 - CV)), 0, 100)
  const consistency = Math.round(100 * (1 - cv));
  return Math.min(100, Math.max(0, consistency));
}

/**
 * Classifies a DOM letter element or node into the breakdown tally.
 * Mutually exclusive buckets: extra, missed, correct, incorrect.
 * Extra characters take priority over incorrect class because extra letters
 * typically have classes 'letter extra incorrect'.
 * 
 * @param {any} node 
 * @param {{ correct: number, incorrect: number, extra: number, missed: number }} breakdown 
 */
function classifyNode(node, breakdown) {
  if (!node) return;

  if (node.classList && typeof node.classList.contains === 'function') {
    if (node.classList.contains('extra')) {
      breakdown.extra++;
      return;
    }
    if (node.classList.contains('missed')) {
      breakdown.missed++;
      return;
    }
    if (node.classList.contains('correct')) {
      breakdown.correct++;
      return;
    }
    if (node.classList.contains('incorrect')) {
      breakdown.incorrect++;
      return;
    }
  }

  const className = node.className || '';
  if (typeof className === 'string') {
    if (className.includes('extra')) {
      breakdown.extra++;
      return;
    }
    if (className.includes('missed')) {
      breakdown.missed++;
      return;
    }
    if (className.includes('correct')) {
      breakdown.correct++;
      return;
    }
    if (className.includes('incorrect')) {
      breakdown.incorrect++;
      return;
    }
  }
}

/**
 * Classifies a structured letter/char record into the breakdown tally.
 * 
 * @param {any} letter 
 * @param {{ correct: number, incorrect: number, extra: number, missed: number }} breakdown 
 */
function classifyLetter(letter, breakdown) {
  if (!letter) return;

  if (typeof letter === 'string') {
    if (letter === 'extra') breakdown.extra++;
    else if (letter === 'missed') breakdown.missed++;
    else if (letter === 'correct') breakdown.correct++;
    else if (letter === 'incorrect') breakdown.incorrect++;
    return;
  }

  // Check DOM-like node
  if (letter.classList || typeof letter.className === 'string') {
    classifyNode(letter, breakdown);
    return;
  }

  const state = letter.state || letter.status || letter.type || '';
  if (state === 'extra') {
    breakdown.extra++;
  } else if (state === 'missed') {
    breakdown.missed++;
  } else if (state === 'correct') {
    breakdown.correct++;
  } else if (state === 'incorrect') {
    breakdown.incorrect++;
  }
}

/**
 * Computes character breakdown counts across all words in a test.
 * Supports:
 * - Word DOM elements containing `<letter>` / `.letter` children
 * - Objects with `letters` or `characters` or `chars` arrays
 * - Objects with pre-aggregated `correct`, `incorrect`, `extra`, `missed` numbers
 * - Objects with `original` and `typed` strings
 * 
 * @param {Array<any>} words - Array of word records or DOM elements
 * @returns {{ correct: number, incorrect: number, extra: number, missed: number }}
 */
export function getCharacterBreakdown(words) {
  const breakdown = { correct: 0, incorrect: 0, extra: 0, missed: 0 };

  if (!words || !Array.isArray(words)) {
    return breakdown;
  }

  for (const word of words) {
    if (!word) continue;

    // 1. Direct tally properties
    if (typeof word.correct === 'number' || typeof word.incorrect === 'number' ||
        typeof word.extra === 'number' || typeof word.missed === 'number') {
      breakdown.correct += word.correct || 0;
      breakdown.incorrect += word.incorrect || 0;
      breakdown.extra += word.extra || 0;
      breakdown.missed += word.missed || 0;
      continue;
    }

    // 2. DOM element with querySelectorAll
    if (typeof word.querySelectorAll === 'function') {
      const letters = word.querySelectorAll('letter, .letter');
      for (const letter of letters) {
        classifyNode(letter, breakdown);
      }
      continue;
    }

    // 3. DOM-like element with childNodes or children array
    const children = word.childNodes || word.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        classifyNode(child, breakdown);
      }
      continue;
    }

    // 4. Object with letters / characters / chars array
    const letters = word.letters || word.characters || word.chars;
    if (Array.isArray(letters)) {
      for (const letter of letters) {
        classifyLetter(letter, breakdown);
      }

      // Check optional separate extra letters array
      const extraList = word.extraLetters || word.extraChars;
      if (Array.isArray(extraList)) {
        breakdown.extra += extraList.length;
      }
      continue;
    }

    // 5. String-based word record comparison: { original: string, typed: string }
    if (typeof word.original === 'string' && typeof word.typed === 'string') {
      const orig = word.original;
      const typed = word.typed;
      const minLen = Math.min(orig.length, typed.length);

      for (let i = 0; i < minLen; i++) {
        if (orig[i] === typed[i]) {
          breakdown.correct++;
        } else {
          breakdown.incorrect++;
        }
      }

      if (typed.length > orig.length) {
        breakdown.extra += typed.length - orig.length;
      } else if (orig.length > typed.length) {
        breakdown.missed += orig.length - typed.length;
      }
    }
  }

  return breakdown;
}
