const { performance } = require('perf_hooks');
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

// Now benchmark displayTest
const iterations = 1000;
let totalDuration = 0;

for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  window.displayTest(1); // Call the function
  const end = performance.now();
  totalDuration += (end - start);
}

const avgDuration = totalDuration / iterations;
console.log(`Baseline Average Execution Time: ${avgDuration.toFixed(4)} ms`);
