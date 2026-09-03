import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  navigate,
  navigationFixtureName,
  parseNavigationEntries,
  rankingDiagnostics,
  rankNavigation,
  tokenize,
} from "./scout-navigation-outcomes";

describe("Scout navigation outcome evaluation", () => {
  it("selects only versioned held-out fixtures", () => {
    expect(navigationFixtureName(undefined)).toBe(
      "scout-navigation-heldout-v1.json",
    );
    expect(navigationFixtureName("scout-navigation-heldout-v2.json")).toBe(
      "scout-navigation-heldout-v2.json",
    );
    expect(() => navigationFixtureName("../private.json")).toThrow(
      "--fixture must name a versioned scout-navigation-heldout-vN.json fixture",
    );
    expect(() => navigationFixtureName("")).toThrow(
      "--fixture must name a versioned scout-navigation-heldout-vN.json fixture",
    );
  });

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

  it("reports ranking evidence without changing the navigation decision", () => {
    const entries = parseNavigationEntries(
      [
        "- [Memory governance](./governance.md) — verified caller identity write read",
        "- [Memory notes](./notes.md) — write read",
      ].join("\n"),
    );
    const query = "memory governance verified caller identity write read";
    const before = navigate(query, entries);
    const diagnostics = rankingDiagnostics(rankNavigation(query, entries));

    expect(navigate(query, entries)).toEqual(before);
    expect(diagnostics.schema).toBe("scout.navigation-ranking-diagnostics/v1");
    expect(diagnostics.ranked_count).toBe(2);
    expect(diagnostics.top_tie_count).toBe(1);
    expect(diagnostics.runner_up?.target).toBe("./notes.md");
    expect(diagnostics.second_score_tier.map((entry) => entry.target)).toEqual([
      "./notes.md",
    ]);
    expect(diagnostics.second_score_includes_top).toBe(false);
    expect(diagnostics.absolute_gap).toBeGreaterThan(0);
    expect(diagnostics.relative_gap).toBeGreaterThan(0);
    expect(rankingDiagnostics([])).toMatchObject({
      schema: "scout.navigation-ranking-diagnostics/v1",
      ranked_count: 0,
      second_score_tier: [],
    });

    const tied = parseNavigationEntries(
      [
        "- [Coordination patterns](./a.md) — one",
        "- [Coordination patterns](./b.md) — two",
      ].join("\n"),
    );
    expect(
      rankingDiagnostics(rankNavigation("coordination patterns", tied)),
    ).toMatchObject({
      ranked_count: 2,
      top_tie_count: 2,
      second_score_tier: [
        expect.objectContaining({ target: "./a.md" }),
        expect.objectContaining({ target: "./b.md" }),
      ],
      second_score_includes_top: true,
      absolute_gap: 0,
      relative_gap: 0,
    });

    const tiedSecond = parseNavigationEntries(
      [
        "- [Alpha beta gamma](./top.md) — delta",
        "- [Alpha beta](./second-a.md) — one",
        "- [Alpha beta](./second-b.md) — two",
      ].join("\n"),
    );
    expect(
      rankingDiagnostics(rankNavigation("alpha beta gamma delta", tiedSecond)),
    ).toMatchObject({
      top_tie_count: 1,
      second_score_tier: [
        expect.objectContaining({ target: "./second-a.md" }),
        expect.objectContaining({ target: "./second-b.md" }),
      ],
      second_score_includes_top: false,
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

  it("replays the exact caller-bound diagnostic controls", () => {
    const fixtureBytes = readFileSync(
      resolve(
        import.meta.dir,
        "fixtures/scout-navigation-diagnostic-controls-v1.json",
      ),
      "utf8",
    );
    expect(createHash("sha256").update(fixtureBytes).digest("hex")).toBe(
      "0adba8052ebeb28d2e6a40387b224ba164f3f2448bebad9029a84595268e5c27",
    );
    const fixture = JSON.parse(fixtureBytes) as {
      schema: string;
      cases: Array<{
        query: string;
        expected_ranks: Array<{
          target: string;
          matched: string[];
          coverage: number;
          score: number;
        }>;
      }>;
    };
    const index = readFileSync(
      resolve(import.meta.dir, "../../scout-knowledge-lib/knowledge/INDEX.md"),
      "utf8",
    );
    const entries = parseNavigationEntries(index);

    expect(fixture.schema).toBe("scout.navigation-diagnostic-controls/v1");
    for (const testCase of fixture.cases) {
      const ranks = rankNavigation(testCase.query, entries);
      expect(
        ranks.slice(0, testCase.expected_ranks.length).map((entry) => ({
          target: entry.target,
          matched: entry.matched,
          coverage: Number(entry.coverage.toFixed(6)),
          score: Number(entry.score.toFixed(6)),
        })),
      ).toEqual(testCase.expected_ranks);
    }
  });
});
