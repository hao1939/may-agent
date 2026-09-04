import { describe, expect, it } from "bun:test";
import {
  literalInventory,
  projectPorcelainBlame,
} from "./scout-history-projection";

describe("commit-scoped Scout history projection", () => {
  it("removes only lines last attributed to the selected commits", () => {
    const kept = "a".repeat(40);
    const removed = "b".repeat(40);
    const porcelain = [
      `${kept} 1 1 1`,
      "author Test",
      "\tkeep one",
      `${removed} 2 2 1`,
      "author Test",
      "\tremove this",
      `${kept} 3 3 1`,
      "author Test",
      "\tkeep two",
      "",
    ].join("\n");

    expect(projectPorcelainBlame(porcelain, new Set([removed]))).toEqual({
      contents: "keep one\nkeep two\n",
      removedLines: ["remove this"],
      removedByCommit: { [removed]: 1 },
    });
  });

  it("inventories exact provenance literals without interpreting them", () => {
    expect(
      literalInventory(
        "## Decision\n`abcdef123` at 2026-09-05T06:00:00+08:00 from https://example.test/a\n",
      ),
    ).toEqual({
      headings: ["Decision"],
      commitRefs: ["abcdef123"],
      timestamps: ["2026-09-05T06:00:00+08:00"],
      urls: ["https://example.test/a"],
    });
  });
});
