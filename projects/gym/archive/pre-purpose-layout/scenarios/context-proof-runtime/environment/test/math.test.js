const { expect, test, describe } = require("bun:test");
const { add, subtract, multiply } = require("../src/math.js");

describe("math", () => {
  test("add", () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });

  test("subtract", () => {
    // BUG: arguments are swapped — should be subtract(5, 3) = 2
    expect(subtract(3, 5)).toBe(2);
  });

  test("multiply", () => {
    expect(multiply(3, 4)).toBe(12);
    expect(multiply(0, 100)).toBe(0);
  });
});
