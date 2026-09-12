import { describe, expect, it } from "bun:test";
import { storedResultFacts } from "./result-facts.js";

describe("retained result facts", () => {
  it.each([{ facts: ["Current observation"] }, { facts: [] }])(
    "prefers canonical facts over malformed legacy data: %j",
    ({ facts }) => {
      const result = { facts, evidence: { stale: true }, result: { evidence: "App-owned data" } };
      expect(storedResultFacts(result)).toEqual({ facts, result: { evidence: "App-owned data" } });
    },
  );

  it("reads a legacy-only result and keeps validation when no canonical facts exist", () => {
    expect(storedResultFacts({ evidence: ["Saved observation"] } as { facts?: string[] })).toEqual({
      facts: ["Saved observation"],
    });
    expect(() => storedResultFacts({ evidence: { malformed: true } } as { facts?: string[] })).toThrow(
      "Invalid retained result facts",
    );
  });
});
