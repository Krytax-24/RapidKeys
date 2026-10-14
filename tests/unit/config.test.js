import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  STORAGE_KEY,
  VALID_MODES,
  VALID_TIME_LIMITS,
  VALID_WORD_COUNTS,
  VALID_THEMES,
  getConfig,
  updateConfig,
  resetConfig,
  validateConfig,
  _clearCache
} from '../../src/config.js';

class MockStorage {
  constructor() {
    this.store = new Map();
    this.throwOnSet = false;
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError: LocalStorage quota reached');
    }
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

describe('Config Constants & Defaults', () => {
  it('defines STORAGE_KEY as rapidkeys_config', () => {
    assert.strictEqual(STORAGE_KEY, 'rapidkeys_config');
  });

  it('provides frozen DEFAULT_CONFIG matching spec', () => {
    assert.strictEqual(Object.isFrozen(DEFAULT_CONFIG), true);
    assert.deepStrictEqual(DEFAULT_CONFIG, {
      mode: 'time',
      timeLimit: 30,
      wordCount: 25,
      punctuation: false,
      numbers: false,
      theme: 'rapidkeys'
    });
  });

  it('exports frozen validation arrays for modes, limits, word counts, and themes', () => {
    assert.ok(Object.isFrozen(VALID_MODES));
    assert.ok(Object.isFrozen(VALID_TIME_LIMITS));
    assert.ok(Object.isFrozen(VALID_WORD_COUNTS));
    assert.ok(Object.isFrozen(VALID_THEMES));

    assert.deepStrictEqual(Array.from(VALID_MODES), ['time', 'words']);
    assert.deepStrictEqual(Array.from(VALID_TIME_LIMITS), [15, 30, 60, 120]);
    assert.deepStrictEqual(Array.from(VALID_WORD_COUNTS), [10, 25, 50, 100]);
    assert.deepStrictEqual(Array.from(VALID_THEMES), [
      'rapidkeys',
      'dracula',
      'nord',
      'monokai',
      'matrix',
      'carbon'
    ]);
  });
});

describe('validateConfig helper', () => {
  it('returns DEFAULT_CONFIG for null, undefined, primitive, or array candidate', () => {
    assert.deepStrictEqual(validateConfig(null), DEFAULT_CONFIG);
    assert.deepStrictEqual(validateConfig(undefined), DEFAULT_CONFIG);
    assert.deepStrictEqual(validateConfig('invalid'), DEFAULT_CONFIG);
    assert.deepStrictEqual(validateConfig(12345), DEFAULT_CONFIG);
    assert.deepStrictEqual(validateConfig([1, 2, 3]), DEFAULT_CONFIG);
  });

  it('sanitizes invalid fields while preserving valid fields', () => {
    const candidate = {
      mode: 'nonsense',
      timeLimit: 60,
      wordCount: 999,
      punctuation: true,
      numbers: 'not-a-boolean',
      theme: 'dracula'
    };
    const validated = validateConfig(candidate);

    assert.strictEqual(validated.mode, 'time'); // Default fallback
    assert.strictEqual(validated.timeLimit, 60); // Valid retained
    assert.strictEqual(validated.wordCount, 25); // Default fallback
    assert.strictEqual(validated.punctuation, true); // Valid retained
    assert.strictEqual(validated.numbers, false); // Default fallback
    assert.strictEqual(validated.theme, 'dracula'); // Valid retained
  });

  it('normalizes theme casing to lowercase', () => {
    assert.strictEqual(validateConfig({ theme: 'Dracula' }).theme, 'dracula');
    assert.strictEqual(validateConfig({ theme: 'NORD' }).theme, 'nord');
    assert.strictEqual(validateConfig({ theme: 'unknown_theme' }).theme, 'rapidkeys');
  });
});

describe('State Management & Isolation', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    // @ts-ignore
    globalThis.localStorage = mockStorage;
    _clearCache();
  });

  it('getConfig returns default config on clean start', () => {
    const config = getConfig();
    assert.deepStrictEqual(config, DEFAULT_CONFIG);
  });

  it('getConfig returns a defensive clone that cannot be mutated from outside', () => {
    const config1 = getConfig();
    // @ts-ignore
    config1.timeLimit = 999;
    // @ts-ignore
    config1.theme = 'mutated';

    const config2 = getConfig();
    assert.strictEqual(config2.timeLimit, 30);
    assert.strictEqual(config2.theme, 'rapidkeys');
  });

  it('updateConfig updates valid fields and saves to localStorage', () => {
    const updated = updateConfig({
      mode: 'words',
      wordCount: 50,
      punctuation: true,
      numbers: true,
      theme: 'nord'
    });

    assert.strictEqual(updated.mode, 'words');
    assert.strictEqual(updated.wordCount, 50);
    assert.strictEqual(updated.punctuation, true);
    assert.strictEqual(updated.numbers, true);
    assert.strictEqual(updated.theme, 'nord');

    // Verify localStorage item is written
    const storedRaw = mockStorage.getItem(STORAGE_KEY);
    assert.ok(storedRaw !== null);
    const parsed = JSON.parse(storedRaw);
    assert.strictEqual(parsed.mode, 'words');
    assert.strictEqual(parsed.wordCount, 50);
    assert.strictEqual(parsed.punctuation, true);
    assert.strictEqual(parsed.theme, 'nord');
  });

  it('updateConfig ignores invalid fields and retains existing settings', () => {
    updateConfig({ timeLimit: 60, theme: 'monokai' });

    // Attempt invalid updates
    // @ts-ignore
    const result = updateConfig({
      // @ts-ignore
      timeLimit: 45,
      // @ts-ignore
      mode: 'unsupported_mode',
      // @ts-ignore
      theme: 'unsupported_theme'
    });

    assert.strictEqual(result.timeLimit, 60, 'Valid timeLimit must be retained');
    assert.strictEqual(result.mode, 'time', 'Previous mode must be retained');
    assert.strictEqual(result.theme, 'monokai', 'Valid theme must be retained');
  });

  it('updateConfig safely ignores null, undefined, or non-object payloads', () => {
    const before = getConfig();
    // @ts-ignore
    assert.deepStrictEqual(updateConfig(null), before);
    // @ts-ignore
    assert.deepStrictEqual(updateConfig(undefined), before);
    // @ts-ignore
    assert.deepStrictEqual(updateConfig('string'), before);
  });

  it('resetConfig resets active config and storage to DEFAULT_CONFIG', () => {
    updateConfig({ timeLimit: 120, punctuation: true, theme: 'carbon' });
    const reset = resetConfig();

    assert.deepStrictEqual(reset, DEFAULT_CONFIG);
    assert.deepStrictEqual(getConfig(), DEFAULT_CONFIG);

    const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY));
    assert.deepStrictEqual(stored, DEFAULT_CONFIG);
  });
});

describe('LocalStorage Fault Tolerance & Recovery', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    // @ts-ignore
    globalThis.localStorage = mockStorage;
    _clearCache();
  });

  it('recovers gracefully from corrupted JSON in localStorage', () => {
    mockStorage.setItem(STORAGE_KEY, '{ invalid json: broken syntax,');

    const config = getConfig();
    assert.deepStrictEqual(config, DEFAULT_CONFIG, 'Corrupt JSON must fall back to DEFAULT_CONFIG');
  });

  it('recovers gracefully from non-object payloads in localStorage', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    assert.deepStrictEqual(getConfig(), DEFAULT_CONFIG);

    _clearCache();
    mockStorage.setItem(STORAGE_KEY, JSON.stringify('a primitive string'));
    assert.deepStrictEqual(getConfig(), DEFAULT_CONFIG);
  });

  it('heals partially corrupted localStorage object by repairing invalid values', () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: 'corrupt_mode',
        timeLimit: 120, // valid
        wordCount: 9999, // invalid
        punctuation: true, // valid
        numbers: null, // invalid
        theme: 'matrix' // valid
      })
    );

    const config = getConfig();
    assert.strictEqual(config.mode, 'time'); // repaired
    assert.strictEqual(config.timeLimit, 120); // preserved
    assert.strictEqual(config.wordCount, 25); // repaired
    assert.strictEqual(config.punctuation, true); // preserved
    assert.strictEqual(config.numbers, false); // repaired
    assert.strictEqual(config.theme, 'matrix'); // preserved
  });

  it('handles QuotaExceededError when saving without crashing or throwing', () => {
    mockStorage.throwOnSet = true;

    assert.doesNotThrow(() => {
      const updated = updateConfig({ timeLimit: 60 });
      assert.strictEqual(updated.timeLimit, 60);
    });

    assert.doesNotThrow(() => {
      const reset = resetConfig();
      assert.strictEqual(reset.timeLimit, 30);
    });
  });
});

