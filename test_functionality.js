const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;

// We need to provide the environment to the script
window.eval(script);

// Check if displayTest generated words
window.displayTest(1);

const textDisplay = document.getElementById("textDisplay");
if (textDisplay.children.length === 100) {
  console.log("Success: displayTest correctly appended 100 span elements.");
} else {
  console.log(`Error: displayTest appended ${textDisplay.children.length} elements instead of 100.`);
}

const firstWord = document.getElementById("word 1");
if (firstWord && firstWord.classList.contains("current")) {
    console.log("Success: The first word was correctly highlighted.");
} else {
    console.log("Error: The first word was not highlighted correctly.");
}
