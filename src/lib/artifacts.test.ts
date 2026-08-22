import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeJsonArtifact } from "./artifacts.js";

describe("artifact atomic writes", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("removes an incomplete staging file when publication fails", () => {
    const root = mkdtempSync(join(tmpdir(), "may-artifact-failure-"));
    roots.push(root);
    const target = join(root, "artifacts", "result.json");
    mkdirSync(target, { recursive: true });

    expect(() => writeJsonArtifact(root, "artifacts/result.json", { result: "not-published" })).toThrow();
    expect(readdirSync(join(root, "artifacts"))).toEqual(["result.json"]);
  });
});
