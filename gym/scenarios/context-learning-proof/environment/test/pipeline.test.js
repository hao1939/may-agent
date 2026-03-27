const { processReading } = require("../src/pipeline.js");

// This test suite uses Bun's test runner.
// Run with: bun test/pipeline.test.js
// NOT: node test/pipeline.test.js (will fail — uses Bun globals)
// NOT: npm test (npm is not configured for this project)

const { expect, test, describe } = require("bun:test");

describe("processReading", () => {
  test("converts kelvin to celsius", () => {
    const result = processReading({ temperature: 300, station: "A1" });
    expect(Math.abs(result.celsius - 26.85)).toBeLessThan(0.01);
  });

  test("handles missing station", () => {
    const result = processReading({ temperature: 273.15 });
    expect(result.station).toBe("unknown");
    expect(result.celsius).toBe(0);
  });

  test("rejects invalid input", () => {
    expect(() => processReading(null)).toThrow();
  });

  test("rejects missing temperature", () => {
    expect(() => processReading({ station: "A1" })).toThrow();
  });
});
