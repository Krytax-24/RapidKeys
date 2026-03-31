// Set up minimal mock DOM elements needed before requiring script.js
global.document = {
  getElementById: (id) => {
    return {
      id,
      classList: {
        classes: new Set(),
        add: function(cls) { this.classes.add(cls); },
        remove: function(cls) { this.classes.delete(cls); },
        contains: function(cls) { return this.classes.has(cls); },
        clear: function() { this.classes.clear(); }
      },
      innerText: '',
      addEventListener: jest.fn(),
      style: {},
      appendChild: jest.fn(),
      setAttribute: jest.fn()
    };
  },
  createElement: (tagName) => {
    return {
      tagName,
      innerText: '',
      setAttribute: jest.fn(),
      appendChild: jest.fn()
    };
  }
};

const script = require('./script.js');

describe('displayScore', () => {
  beforeEach(() => {
    // Reset inner text and classes before each test
    script.time.innerText = '';
    script.timeName.innerText = '';
    script.cw.innerText = '';
    script.cwName.innerText = '';

    script.time.classList.clear();
    script.cw.classList.clear();
  });

  it('should calculate accurate percentage and update DOM correctly', () => {
    script.setWordsSubmitted(10);
    script.setWordsCorrect(8);
    script.setFactor(2);

    script.displayScore();

    expect(script.time.classList.contains("current")).toBe(true);
    expect(script.cw.classList.contains("current")).toBe(true);

    expect(script.time.innerText).toBe("80%");
    expect(script.timeName.innerText).toBe("PA");

    expect(script.cw.innerText).toBe(16);
    expect(script.cwName.innerText).toBe("WPM");
  });

  it('should handle zero words submitted (division by zero prevention)', () => {
    script.setWordsSubmitted(0);
    script.setWordsCorrect(0);
    script.setFactor(1);

    script.displayScore();

    expect(script.time.innerText).toBe("0%");
    expect(script.cw.innerText).toBe(0);
  });

  it('should calculate floor of fractional percentage', () => {
    script.setWordsSubmitted(3);
    script.setWordsCorrect(1);
    script.setFactor(1);

    script.displayScore();

    // 1 / 3 = 0.33333... -> 33%
    expect(script.time.innerText).toBe("33%");
    expect(script.cw.innerText).toBe(1);
  });
});
