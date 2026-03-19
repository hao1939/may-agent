// Integration tests for weather service
const { getWeather } = require("./weather");

async function runTests() {
  const results = [];

  // Test 1: Fetch weather for London
  try {
    const weather = await getWeather("London");
    results.push({ test: "london-forecast", passed: !!weather.temperature });
  } catch (err) {
    results.push({ test: "london-forecast", passed: false, error: err.message });
  }

  // Test 2: Fetch weather for Tokyo
  try {
    const weather = await getWeather("Tokyo");
    results.push({ test: "tokyo-forecast", passed: !!weather.temperature });
  } catch (err) {
    results.push({ test: "tokyo-forecast", passed: false, error: err.message });
  }

  // Test 3: Invalid city returns error
  try {
    await getWeather("");
    results.push({ test: "empty-city-error", passed: false, error: "should have thrown" });
  } catch (err) {
    results.push({ test: "empty-city-error", passed: err.message.includes("400") });
  }

  const passed = results.filter(r => r.passed).length;
  console.log(`\nResults: ${passed}/${results.length} passed`);
  for (const r of results) {
    console.log(`  ${r.passed ? "✓" : "✗"} ${r.test}${r.error ? `: ${r.error}` : ""}`);
  }

  process.exit(passed === results.length ? 0 : 1);
}

runTests();
