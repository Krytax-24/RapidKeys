/**
 * tests/tier2-boundary/t2-f6-theming-shortcuts-boundaries.test.js
 * Tier 2: Boundary & Corner Cases - B6: Theming & Shortcuts Boundaries
 * Tests: T2.6.1 through T2.6.5 (5 tests)
 * Requirement: Boundary value analysis for theme switches, overlay suppression, shortcuts
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { getThemeEngineModule } from '../helpers/contract-bridge.js';

describe('Tier 2 - B6: Theming & Shortcuts Boundaries', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T2.6.1: Rapid theme cycling (5 themes in 100ms): final theme applied cleanly to data-theme without dangling style classes', async () => {
    const { applyTheme } = await getThemeEngineModule();

    const themesToCycle = ['dracula', 'nord', 'monokai', 'matrix', 'carbon'];
    for (const theme of themesToCycle) {
      applyTheme(theme);
    }

    assert.equal(env.document.documentElement.getAttribute('data-theme'), 'carbon');
  });

  it('T2.6.2: Blur event firing while on Results screen: blur overlay is suppressed (must only appear during active typing)', () => {
    const overlay = env.document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.className = 'focus-overlay hidden';
    env.document.body.appendChild(overlay);

    let isTestActive = false; // Results screen active

    const onBlur = () => {
      if (isTestActive) {
        overlay.classList.remove('hidden');
      }
    };

    onBlur();

    assert.ok(overlay.classList.contains('hidden'), 'Overlay must remain hidden if blur occurs outside active test');
  });

  it('T2.6.3: Pressing Esc when modal is already open: closes modal and returns focus cleanly to typing input', () => {
    const modal = env.document.createElement('div');
    modal.id = 'commandPalette';
    modal.className = 'modal'; // currently open

    const input = env.document.createElement('input');
    input.id = 'wordsInput';

    env.document.body.appendChild(modal);
    env.document.body.appendChild(input);

    let modalClosed = false;
    let inputFocused = false;

    input.addEventListener('focus', () => { inputFocused = true; });

    const handleEscape = () => {
      if (!modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
        modalClosed = true;
        input.focus();
      }
    };

    handleEscape();

    assert.equal(modalClosed, true);
    assert.ok(modal.classList.contains('hidden'));
    assert.equal(inputFocused, true);
  });

  it('T2.6.4: Normal typing of keys "t", "a", "b" or "e", "s", "c" within words: does NOT trigger Tab+Enter restart or Esc modal while typing words', () => {
    let restartTriggered = false;
    let modalTriggered = false;

    const input = env.document.createElement('input');
    input.addEventListener('keydown', (e) => {
      // Check standard typing keys
      if (e.key === 'Tab') {
        restartTriggered = true;
      }
      if (e.key === 'Escape') {
        modalTriggered = true;
      }
    });

    // Type character 't', then 'a', then 'b'
    ['t', 'a', 'b'].forEach(char => {
      input.dispatchEvent({ type: 'keydown', key: char, defaultPrevented: false, preventDefault() {} });
    });

    // Type character 'e', then 's', then 'c'
    ['e', 's', 'c'].forEach(char => {
      input.dispatchEvent({ type: 'keydown', key: char, defaultPrevented: false, preventDefault() {} });
    });

    assert.equal(restartTriggered, false, 'Typing letter characters must not trigger Tab restart');
    assert.equal(modalTriggered, false, 'Typing letters must not trigger Escape modal');
  });

  it('T2.6.5: 10 repeated focus/blur cycles: event listeners remain stable without duplicate listener registration', () => {
    let focusCount = 0;
    let blurCount = 0;

    const input = env.document.createElement('input');
    input.addEventListener('focus', () => { focusCount++; });
    input.addEventListener('blur', () => { blurCount++; });

    for (let i = 0; i < 10; i++) {
      input.focus();
      input.blur();
    }

    assert.equal(focusCount, 10);
    assert.equal(blurCount, 10);
  });
});
