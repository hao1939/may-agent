import { describe, expect, it } from "bun:test";
import { parseProcessRows, processTreeRssKiB } from "./codex-goal-resources.js";

describe("Codex goal resource sampling", () => {
  it("sums only the selected process tree", () => {
    const rows = parseProcessRows(`
       10       1    100
       11      10    200
       12      11    300
       20       1    900
    malformed
    `);
    expect(processTreeRssKiB(rows, 10)).toBe(600);
    expect(processTreeRssKiB(rows, 20)).toBe(900);
    expect(processTreeRssKiB(rows, 99)).toBeNull();
  });
});
