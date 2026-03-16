/**
 * string-helpers.test.ts — Tests for string utility functions.
 */

import { describe, it, expect } from "vitest";
import { truncateWithEllipsis } from "../src/lib/utils/string-helpers.js";

describe("truncateWithEllipsis", () => {
  it("returns the original string when it fits within maxLen", () => {
    expect(truncateWithEllipsis("hello", 5)).toBe("hello");
    expect(truncateWithEllipsis("hello", 10)).toBe("hello");
  });

  it("returns the original string when it exactly equals maxLen", () => {
    expect(truncateWithEllipsis("abc", 3)).toBe("abc");
  });

  it("truncates and appends ellipsis when string exceeds maxLen", () => {
    expect(truncateWithEllipsis("hello world", 5)).toBe("hell…");
    expect(truncateWithEllipsis("hello world", 6)).toBe("hello…");
  });

  it("returns just ellipsis when maxLen is 1", () => {
    expect(truncateWithEllipsis("hello", 1)).toBe("…");
  });

  it("returns just ellipsis when maxLen is less than 1", () => {
    expect(truncateWithEllipsis("hello", 0)).toBe("…");
    expect(truncateWithEllipsis("hello", -5)).toBe("…");
  });

  it("handles empty string input", () => {
    expect(truncateWithEllipsis("", 5)).toBe("");
    expect(truncateWithEllipsis("", 0)).toBe("");
  });

  it("handles single-character strings", () => {
    expect(truncateWithEllipsis("a", 1)).toBe("a");
    expect(truncateWithEllipsis("a", 5)).toBe("a");
  });

  it("result length does not exceed maxLen", () => {
    const result = truncateWithEllipsis("a]very long string that goes on and on", 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).toBe("a]very lo…");
  });
});
