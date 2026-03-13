// Broken compiler tool — randomly throws errors
let callCount = 0;

function compile(source) {
  callCount++;
  // Fails on every other call (simulating flaky tool)
  if (callCount % 2 === 1) {
    return { error: "SEGFAULT: internal compiler error (flaky)" };
  }
  return { output: `compiled_${source}` };
}

module.exports = { compile };
