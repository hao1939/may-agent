import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  navigate,
  parseNavigationEntries,
  tokenize,
} from "./scout-navigation-outcomes";

describe("Scout navigation outcome evaluation", () => {
  it("classifies linked and explicitly unavailable entries while ignoring archives", () => {
    const entries = parseNavigationEntries(
      [
        "- [Live note](./live.md) — exact evidence",
        "- **Missing note** *(accepted target unavailable; intended path: `./missing.md`; restore only on acceptance)* — preserved distinction",
        "- ~~[Archived note](./old.md)~~ → merged",
      ].join("\n"),
    );

    expect(entries).toEqual([
      {
        kind: "available",
        title: "Live note",
        target: "./live.md",
        text: "exact evidence",
      },
      {
        kind: "unavailable",
        title: "Missing note",
        target: "./missing.md",
        text: "preserved distinction",
      },
    ]);
  });

  it("preserves a unique result, an exact-title ambiguity, and a miss", () => {
    const entries = parseNavigationEntries(
      [
        "- [Caller-bound memory](./caller.md) — write read revise forget identity",
        "- [Coordination Patterns](./coordination.md) — canonical",
        "- [Coordination Patterns](./finding.md) — historical finding",
      ].join("\n"),
    );

    expect(navigate("memory write read identity", entries).kind).toBe(
      "available",
    );
    expect(navigate("coordination patterns", entries).kind).toBe("ambiguous");
    expect(navigate("quantum greenhouse gardening", entries)).toEqual({
      kind: "miss",
    });
  });

  it("normalizes case, punctuation, and common inflections deterministically", () => {
    expect(
      tokenize("Reconciliations, RECONCILING and reconciled records"),
    ).toEqual(["reconcil", "record"]);
  });

  it("runs every frozen case without changing the fixture", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(import.meta.dir, "fixtures/scout-navigation-heldout-v1.json"),
        "utf8",
      ),
    ) as { cases: Array<{ query: string }> };
    const index = readFileSync(
      resolve(import.meta.dir, "../../scout-knowledge-lib/knowledge/INDEX.md"),
      "utf8",
    );
    const entries = parseNavigationEntries(index);

    expect(fixture.cases).toHaveLength(14);
    expect(
      fixture.cases.map((testCase) => navigate(testCase.query, entries)),
    ).toHaveLength(14);
  });
});
