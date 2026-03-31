/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

// Mock DOM elements
const mockElements = {};
const createMockElement = (id) => ({
  id,
  innerText: '',
  innerHTML: '',
  classList: {
    add: jest.fn(),
    remove: jest.fn()
  },
  style: {
    visibility: 'visible'
  },
  addEventListener: jest.fn(),
  appendChild: jest.fn(),
  setAttribute: jest.fn(),
  disabled: false,
  value: '',
  focus: jest.fn()
});

const elementIds = [
  'textDisplay', 'textInput', 'timeName', 'time', 'cwName', 'cw',
  'restartBtn', 'thirty', 'sixty', 'beg', 'pro'
];

elementIds.forEach(id => {
  mockElements[id] = createMockElement(id);
});

global.document = {
  getElementById: (id) => mockElements[id] || createMockElement(id),
  createElement: jest.fn().mockImplementation(() => createMockElement('dynamic')),
  body: {
    innerHTML: ''
  }
};

global.window = {
  setInterval: jest.fn(),
  clearInterval: jest.fn()
};
global.setInterval = global.window.setInterval;
global.clearInterval = global.window.clearInterval;

const script = require('./script.js');

describe('RapidKeys script.js tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    elementIds.forEach(id => {
      mockElements[id].innerText = '';
      mockElements[id].innerHTML = '';
      mockElements[id].style.visibility = 'visible';
    });
  });

  test('randomWords returns 100 strings ending with a space', () => {
    const words = script.randomWords(1);
    expect(words.length).toBe(100);
    words.forEach(word => {
      expect(typeof word).toBe('string');
      expect(word.endsWith(' ')).toBe(true);
    });
  });

  test('limitColor adds yellow class to itema and removes from itemr', () => {
    const itema = createMockElement('itema');
    const itemr = createMockElement('itemr');
    script.limitColor(itema, itemr);
    expect(itema.classList.add).toHaveBeenCalledWith('yellow');
    expect(itemr.classList.remove).toHaveBeenCalledWith('yellow');
  });

  test('limitVisible sets visibility to visible', () => {
    script.limitVisible();
    expect(mockElements['thirty'].style.visibility).toBe('visible');
    expect(mockElements['sixty'].style.visibility).toBe('visible');
    expect(mockElements['beg'].style.visibility).toBe('visible');
    expect(mockElements['pro'].style.visibility).toBe('visible');
  });

  test('limitInvisible sets visibility to hidden', () => {
    script.limitInvisible();
    expect(mockElements['thirty'].style.visibility).toBe('hidden');
    expect(mockElements['sixty'].style.visibility).toBe('hidden');
    expect(mockElements['beg'].style.visibility).toBe('hidden');
    expect(mockElements['pro'].style.visibility).toBe('hidden');
  });

  test('displayScore calculates accuracy and WPM correctly', () => {
    script.setTestData({
      wordsSubmitted: 10,
      wordsCorrect: 8,
      factor: 2
    });

    script.displayScore();

    // accuracy = floor(8/10 * 100) = 80
    expect(mockElements['time'].innerText).toBe('80%');
    // WPM = 8 * 2 = 16
    expect(mockElements['cw'].innerText).toBe(16);
    expect(mockElements['timeName'].innerText).toBe('PA');
    expect(mockElements['cwName'].innerText).toBe('WPM');
  });

  test('displayScore handles zero submitted words', () => {
    script.setTestData({
      wordsSubmitted: 0,
      wordsCorrect: 0,
      factor: 2
    });

    script.displayScore();

    expect(mockElements['time'].innerText).toBe('0%');
    expect(mockElements['cw'].innerText).toBe(0);
  });
});
