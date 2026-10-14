import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WORDS_VOCABULARY, createWordStream, getWordBatch } from '../../src/data/words.js';

describe('WORDS_VOCABULARY', () => {
  it('contains exactly 1,287 preserved words', () => {
    assert.strictEqual(WORDS_VOCABULARY.length, 1287);
  });

  it('is deeply immutable (frozen)', () => {
    assert.strictEqual(Object.isFrozen(WORDS_VOCABULARY), true);
    assert.throws(() => {
      // @ts-ignore
      WORDS_VOCABULARY.push('newword');
    }, TypeError);
  });

  it('contains unique words with no empty entries or whitespace', () => {
    const set = new Set(WORDS_VOCABULARY);
    assert.strictEqual(set.size, 1287);
    for (const word of WORDS_VOCABULARY) {
      assert.strictEqual(typeof word, 'string');
      assert.ok(word.length > 0, 'Word must not be empty');
      assert.strictEqual(word, word.trim(), 'Word must not have surrounding whitespace');
      assert.strictEqual(word, word.toLowerCase(), 'Vocabulary word must be lowercase');
    }
  });

  it('preserves known legacy vocabulary tokens from both wordlists', () => {
    const sampleWords = ['ability', 'able', 'about', 'program', 'system', 'water', 'write', 'zero', 'zoo'];
    for (const sample of sampleWords) {
      assert.ok(WORDS_VOCABULARY.includes(sample), `Expected vocabulary to include "${sample}"`);
    }
  });
});

describe('getWordBatch', () => {
  it('returns empty array when count is <= 0 or invalid', () => {
    assert.deepStrictEqual(getWordBatch(0), []);
    assert.deepStrictEqual(getWordBatch(-5), []);
    // @ts-ignore
    assert.deepStrictEqual(getWordBatch(NaN), []);
    // @ts-ignore
    assert.deepStrictEqual(getWordBatch('ten'), []);
    // @ts-ignore
    assert.deepStrictEqual(getWordBatch(null), []);
  });

  it('returns the exact requested number of words', () => {
    for (const count of [1, 5, 10, 25, 50, 100]) {
      const batch = getWordBatch(count);
      assert.strictEqual(batch.length, count);
    }
  });

  it('generates strictly lowercase alphabet tokens when punctuation and numbers are disabled', () => {
    const batch = getWordBatch(200, { punctuation: false, numbers: false });
    for (const token of batch) {
      assert.match(token, /^[a-z]+$/, `Token "${token}" should be lowercase letters only`);
      assert.ok(WORDS_VOCABULARY.includes(token), `Token "${token}" should exist in WORDS_VOCABULARY`);
    }
  });

  it('does not generate immediately consecutive identical words', () => {
    const batch = getWordBatch(300, { punctuation: false, numbers: false });
    for (let i = 1; i < batch.length; i++) {
      assert.notStrictEqual(batch[i], batch[i - 1], `Consecutive words at index ${i} should not be identical`);
    }
  });
});

describe('Punctuation formatting', () => {
  it('capitalizes the initial word of a sentence', () => {
    const batch = getWordBatch(1, { punctuation: true, numbers: false });
    assert.match(batch[0], /^[A-Z]/, 'First word of batch should be capitalized when punctuation is true');
  });

  it('introduces periods, commas, quotes, and question marks', () => {
    // Generate large enough batch to ensure all punctuation marks appear
    const batch = getWordBatch(300, { punctuation: true, numbers: false });

    let hasPeriod = false;
    let hasComma = false;
    let hasQuote = false;
    let hasQuestion = false;

    for (const token of batch) {
      if (token.endsWith('.')) hasPeriod = true;
      if (token.endsWith(',')) hasComma = true;
      if (token.startsWith('"') && token.endsWith('"')) hasQuote = true;
      if (token.endsWith('?')) hasQuestion = true;
    }

    assert.ok(hasPeriod, 'Batch should contain words terminating with a period');
    assert.ok(hasComma, 'Batch should contain words terminating with a comma');
    assert.ok(hasQuote, 'Batch should contain words wrapped in quotes');
    assert.ok(hasQuestion, 'Batch should contain words terminating with a question mark');
  });

  it('capitalizes words immediately following sentence-ending punctuation', () => {
    const batch = getWordBatch(200, { punctuation: true, numbers: false });
    for (let i = 0; i < batch.length - 1; i++) {
      const current = batch[i];
      const next = batch[i + 1];
      if (current.endsWith('.') || current.endsWith('?')) {
        assert.match(next, /^[A-Z]/, `Word "${next}" following terminator "${current}" must be capitalized`);
      }
    }
  });
});

describe('Numbers injection', () => {
  it('injects 1-4 digit numeric strings at an approximate rate of ~12%', () => {
    const count = 1000;
    const batch = getWordBatch(count, { numbers: true, punctuation: false });
    const numbers = batch.filter(token => /^\d+$/.test(token));

    assert.ok(numbers.length > 50, `Expected at least 50 numbers in 1000 tokens, got ${numbers.length}`);
    assert.ok(numbers.length < 220, `Expected at most 220 numbers in 1000 tokens, got ${numbers.length}`);

    // Verify all injected numbers are 1-4 digits
    for (const num of numbers) {
      assert.match(num, /^\d{1,4}$/, `Number "${num}" should be between 1 and 4 digits`);
      const val = parseInt(num, 10);
      assert.ok(val >= 0 && val <= 9999, `Number "${num}" out of bounds`);
    }
  });

  it('never injects numeric digits when numbers option is false', () => {
    const batch = getWordBatch(200, { numbers: false });
    for (const token of batch) {
      assert.strictEqual(/\d/.test(token), false, `Token "${token}" should not contain any digits`);
    }
  });
});

describe('createWordStream (Infinite Lazy Generator)', () => {
  it('yields words lazily on demand without memory leak or termination', () => {
    const stream = createWordStream();
    for (let i = 0; i < 5000; i++) {
      const iter = stream.next();
      assert.strictEqual(iter.done, false);
      assert.strictEqual(typeof iter.value, 'string');
      assert.ok(iter.value.length > 0);
    }
  });

  it('produces 100% deterministic output with a custom pseudo-random function', () => {
    // Linear Congruential Generator (LCG) for deterministic tests
    function makeLcg(seed) {
      let s = seed;
      return function () {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    }

    const batch1 = getWordBatch(30, { punctuation: true, numbers: true, random: makeLcg(42) });
    const batch2 = getWordBatch(30, { punctuation: true, numbers: true, random: makeLcg(42) });

    assert.deepStrictEqual(batch1, batch2, 'Seeded runs must produce identical token streams');
  });
});

