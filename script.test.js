const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Word Checking Logic Integration Tests', () => {
  let dom;
  let document;
  let window;
  let checkWord;
  let displayTest;
  let getWordNo;
  let setWordNo;
  let getWordsSubmitted;
  let setWordsSubmitted;
  let getWordsCorrect;
  let setWordsCorrect;
  let getDifficulty;
  let inputItem;
  let cw;
  let testItem;

  beforeEach(() => {
    // Load HTML structure
    const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');
    dom = new JSDOM(html);
    window = dom.window;
    document = dom.window.document;

    // Set global variables required by script.js
    global.window = window;
    global.document = document;

    // Reset module cache to ensure script.js re-evaluates and binds to the new document
    jest.resetModules();

    // Require script.js after setting up globals
    const script = require('./script.js');
    checkWord = script.checkWord;
    displayTest = script.displayTest;
    getWordNo = script.getWordNo;
    setWordNo = script.setWordNo;
    getWordsSubmitted = script.getWordsSubmitted;
    setWordsSubmitted = script.setWordsSubmitted;
    getWordsCorrect = script.getWordsCorrect;
    setWordsCorrect = script.setWordsCorrect;
    getDifficulty = script.getDifficulty;

    // Elements
    inputItem = document.getElementById("textInput");
    cw = document.getElementById("cw");
    testItem = document.getElementById("textDisplay");
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  test('Happy path: checkWord correctly processes a valid matched word', () => {
    // Initialize the test state
    displayTest(1); // Generates spans inside testItem
    setWordNo(1);
    setWordsSubmitted(0);
    setWordsCorrect(0);

    const checkSpan = document.getElementById("word 1");
    expect(checkSpan).not.toBeNull();

    // Set input correctly
    inputItem.value = checkSpan.innerText;

    // Call the function under test
    checkWord();

    // Assertions
    expect(inputItem.value).toBe('');
    expect(getWordNo()).toBe(2);
    expect(getWordsSubmitted()).toBe(1);
    expect(getWordsCorrect()).toBe(1);
    expect(String(cw.innerText)).toBe("1");
    expect(checkSpan.classList.contains('correct')).toBe(true);

    // Verify the next word is styled as current
    const nextSpan = document.getElementById("word 2");
    expect(nextSpan.classList.contains('current')).toBe(true);
  });

  test('Error condition: checkWord correctly processes an incorrect word', () => {
    // Initialize the test state
    displayTest(1);
    setWordNo(1);
    setWordsSubmitted(0);
    setWordsCorrect(0);

    const checkSpan = document.getElementById("word 1");
    expect(checkSpan).not.toBeNull();

    // Set input incorrectly
    inputItem.value = "wrongword";

    // Call the function under test
    checkWord();

    // Assertions
    expect(inputItem.value).toBe('');
    expect(getWordNo()).toBe(2);
    expect(getWordsSubmitted()).toBe(1);
    expect(getWordsCorrect()).toBe(0); // Should not increment
    expect(String(cw.innerText || '0')).toBe("0"); // cw was initialized to 0 in HTML or undefined if unchanged
    expect(checkSpan.classList.contains('wrong')).toBe(true);

    // Verify the next word is styled as current
    const nextSpan = document.getElementById("word 2");
    expect(nextSpan.classList.contains('current')).toBe(true);
  });

  test('Edge case: checkWord triggers displayTest when wordNo > 40', () => {
    // Initialize the test state
    displayTest(1);
    setWordNo(40);
    setWordsSubmitted(39);
    setWordsCorrect(39);

    const checkSpan = document.getElementById("word 40");
    expect(checkSpan).not.toBeNull();
    inputItem.value = checkSpan.innerText;

    // Spy on displayTest or verify its side effect
    const initialFirstWord = document.getElementById("word 1").innerText;

    // Call the function under test
    checkWord();

    // WordNo gets incremented to 41 inside the function, which is > 40
    // so displayTest is called, which resets wordNo to 1 and generates new words

    expect(getWordNo()).toBe(1);
    expect(getWordsSubmitted()).toBe(40);
    expect(getWordsCorrect()).toBe(40);

    // Check if new words are generated
    const newFirstSpan = document.getElementById("word 1");
    expect(newFirstSpan).not.toBeNull();
    expect(newFirstSpan.classList.contains('current')).toBe(true);
  });
});
