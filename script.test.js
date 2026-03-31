// Set up manual DOM mocking before requiring script.js
const mockElements = {};
global.document = {
  getElementById: (id) => {
    if (!mockElements[id]) {
      mockElements[id] = {
        innerText: '',
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        style: {},
        addEventListener: jest.fn(),
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        innerHTML: '',
        disabled: false,
        focus: jest.fn(),
        value: ''
      };
    }
    return mockElements[id];
  },
  createElement: (tagName) => ({
    tagName,
    innerText: '',
    setAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    appendChild: jest.fn()
  })
};

const script = require('./script.js');

describe('displayScore function', () => {
  beforeEach(() => {
    // Reset the mocked innerText for elements used in displayScore
    ['time', 'timeName', 'cw', 'cwName'].forEach(id => {
      if (mockElements[id]) {
        mockElements[id].innerText = '';
        mockElements[id].classList.add.mockClear();
      }
    });
  });

  test('should handle edge case where wordsSubmitted is 0 (division by zero prevention)', () => {
    // Setup initial state: 0 words submitted to test division by zero protection
    script.setWordsSubmitted(0);
    script.setWordsCorrect(0);
    script.setFactor(1); // default factor

    // Execute the function
    script.displayScore();

    // Verify outcomes
    // Since wordsSubmitted is 0, percentageAcc should be 0 (default), displaying 0%
    expect(mockElements['time'].innerText).toBe('0%');
    expect(mockElements['timeName'].innerText).toBe('PA');

    // Words correct is 0, so WPM should be 0
    expect(mockElements['cw'].innerText).toBe(0); // 0 * factor = 0
    expect(mockElements['cwName'].innerText).toBe('WPM');

    // It should also add "current" class to time and cw
    expect(mockElements['time'].classList.add).toHaveBeenCalledWith('current');
    expect(mockElements['cw'].classList.add).toHaveBeenCalledWith('current');
  });

  test('should calculate percentage correctly when wordsSubmitted is greater than 0', () => {
    // Setup state: 10 submitted, 8 correct, 2x factor
    script.setWordsSubmitted(10);
    script.setWordsCorrect(8);
    script.setFactor(2);

    // Execute the function
    script.displayScore();

    // Verify outcomes
    // Percentage = floor((8/10)*100) = 80
    expect(mockElements['time'].innerText).toBe('80%');
    expect(mockElements['timeName'].innerText).toBe('PA');

    // Words correct is 8, factor is 2, so WPM = 16
    expect(mockElements['cw'].innerText).toBe(16);
    expect(mockElements['cwName'].innerText).toBe('WPM');
  });
});
