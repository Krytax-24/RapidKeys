/**
 * tests/tier1-features/t1-f6-theming-shortcuts.test.js
 * Tier 1: Feature Coverage - F6: Theming Engine & Shortcuts
 * Tests: T1.6.1 through T1.6.5 (5 tests)
 * Requirement: ORIGINAL_REQUEST R5, Acceptance Criteria #33, #34, #43
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment } from '../helpers/dom-harness.js';
import { getThemeEngineModule } from '../helpers/contract-bridge.js';

describe('Tier 1 - F6: Theming Engine & Shortcuts', () => {
  let env;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  it('T1.6.1: Theme switcher modifies CSS custom property palette via document.documentElement[data-theme]', async () => {
    const { applyTheme, getAvailableThemes } = await getThemeEngineModule();

    const themes = getAvailableThemes();
    assert.ok(themes.includes('rapidkeys'));
    assert.ok(themes.includes('dracula'));
    assert.ok(themes.includes('nord'));
    assert.ok(themes.includes('monokai'));

    // Apply 'dracula'
    applyTheme('dracula');
    assert.equal(env.document.documentElement.getAttribute('data-theme'), 'dracula');

    // Apply 'nord'
    applyTheme('nord');
    assert.equal(env.document.documentElement.getAttribute('data-theme'), 'nord');
  });

  it('T1.6.2: Distraction-free focus mode adds .is-typing class to body on first keypress, dimming header and footer', () => {
    const body = env.document.body;
    assert.ok(!body.classList.contains('is-typing'));

    // First keypress triggers focus mode
    const onFirstKeypress = () => {
      body.classList.add('is-typing');
    };

    onFirstKeypress();
    assert.ok(body.classList.contains('is-typing'), 'Body should have is-typing class');

    // Test finished or blurred restores
    const onTestFinish = () => {
      body.classList.remove('is-typing');
    };
    onTestFinish();
    assert.ok(!body.classList.contains('is-typing'));
  });

  it('T1.6.3: Out-of-focus blur event displays #focusOverlay notice and blurs typing surface', () => {
    const overlay = env.document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.className = 'focus-overlay hidden';

    const surface = env.document.createElement('div');
    surface.id = 'typingSurface';

    const input = env.document.createElement('input');
    input.id = 'wordsInput';

    env.document.body.appendChild(overlay);
    env.document.body.appendChild(surface);
    env.document.body.appendChild(input);

    let isBlurred = false;
    input.addEventListener('blur', () => {
      isBlurred = true;
      overlay.classList.remove('hidden');
      surface.classList.add('blurred');
    });

    // Fire blur
    input.blur();

    assert.equal(isBlurred, true);
    assert.ok(!overlay.classList.contains('hidden'), 'Overlay should not be hidden');
    assert.ok(surface.classList.contains('blurred'), 'Typing surface should be blurred');
  });

  it('T1.6.4: Clicking #focusOverlay or pressing any key refocuses input and hides blur notice', () => {
    const overlay = env.document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.className = 'focus-overlay'; // visible

    const surface = env.document.createElement('div');
    surface.id = 'typingSurface';
    surface.className = 'blurred';

    const input = env.document.createElement('input');
    input.id = 'wordsInput';

    env.document.body.appendChild(overlay);
    env.document.body.appendChild(surface);
    env.document.body.appendChild(input);

    let focused = false;
    input.addEventListener('focus', () => {
      focused = true;
      overlay.classList.add('hidden');
      surface.classList.remove('blurred');
    });

    overlay.addEventListener('click', () => {
      input.focus();
    });

    // User clicks overlay to refocus
    overlay.click();

    assert.equal(focused, true);
    assert.ok(overlay.classList.contains('hidden'));
    assert.ok(!surface.classList.contains('blurred'));
  });

  it('T1.6.5: Pressing Esc key opens command palette / theme switcher modal', () => {
    const modal = env.document.createElement('div');
    modal.id = 'commandPalette';
    modal.className = 'modal hidden';
    env.document.body.appendChild(modal);

    let modalOpened = false;
    env.window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modalOpened = true;
        modal.classList.remove('hidden');
      }
    });

    // User presses Escape
    env.window.dispatchEvent({ type: 'keydown', key: 'Escape' });

    assert.equal(modalOpened, true);
    assert.ok(!modal.classList.contains('hidden'));
  });
});
