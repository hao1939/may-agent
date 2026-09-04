import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
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

  it("binds the projected corpus to the frozen source instead of its own report", () => {
    const appDir = resolve(import.meta.dir, "..");
    const run = spawnSync(
      "bun",
      [
        "./scripts/scout-history-projection.ts",
        "scout-history-projection-cycle410.json",
      ],
      { cwd: appDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    expect(run.status).toBe(0);
    const result = JSON.parse(run.stdout) as {
      corpus_reference: string;
      absent_after_projection: { commit_refs: string[] };
      broad_links: {
        ok: boolean;
        documents: number;
        checked: number;
        errors: string[];
      };
    };
    expect(result.corpus_reference).toBe(
      "73088d8c912fadb2fb6b3e6e1e721c854ce70ff9",
    );
    expect(result.absent_after_projection.commit_refs).toEqual([
      "1a8ea9c904eb439b53703e1067cfa5172dc8072a",
      "255232f3b0977d1938e62a52cdaf2e9cda1e0dff",
      "300ff7ea03469d7c3d7f07ef3427089eb57785a2",
      "8b8f7179cf",
      "8dca8f4576",
      "9c52296961",
    ]);
    expect(result.broad_links).toEqual({
      ok: true,
      documents: 1546,
      checked: 1774,
      errors: [],
    });
  }, 30_000);
});
