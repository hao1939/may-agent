import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectExamples, loadExample, injectFewShot } from "../workflows/fewshot-inject-helpers.js";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, readFileSync: vi.fn() };
});
import { readFileSync } from "node:fs";

describe("selectExamples", () => {
  it("matches binary patterns", () => {
    expect(selectExamples("handle binary file")).toContain("binary-file-escalation");
  });
  it("matches bug patterns", () => {
    expect(selectExamples("fix the failing test")).toContain("reproduce-first-debugging");
  });
  it("matches upgrade/dependency patterns", () => {
    expect(selectExamples("upgrade dependency across multiple files")).toContain("escalation-judgment");
  });
  it("matches blocked patterns", () => {
    expect(selectExamples("I'm blocked, can't find the key")).toContain("know-when-blocked");
  });
  it("matches fix bug patterns", () => {
    expect(selectExamples("fix bug in output")).toContain("evidence-over-narrative");
  });
  it("returns max 2 examples", () => {
    expect(selectExamples("fix failing binary bug blocked").length).toBeLessThanOrEqual(2);
  });
  it("returns empty for unmatched task", () => {
    expect(selectExamples("write a haiku about clouds")).toEqual([]);
  });
  it("strips verification blocks before matching", () => {
    const task = "write code\n## Verification\n```\n./node_modules/.bin/tsc\n```";
    // "binary" appears in path but should be stripped
    const results = selectExamples(task);
    expect(results).not.toContain("binary-file-escalation");
  });
});

describe("loadExample", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("extracts Worked Example section", () => {
    (readFileSync as any).mockReturnValue(
      "# Few-Shot Example: Test\n## Trigger Patterns\nstuff\n## Worked Example\nDo this thing\n## Evidence\nproof"
    );
    expect(loadExample("test-file")).toBe("Do this thing");
  });

  it("falls back to stripped content if no Worked Example section", () => {
    (readFileSync as any).mockReturnValue(
      "# Few-Shot Example: Test\n**Domain class**: testing\nSome useful content here"
    );
    const result = loadExample("test-file");
    expect(result).toContain("Some useful content");
  });

  it("returns null for missing file", () => {
    (readFileSync as any).mockImplementation(() => { throw new Error("ENOENT"); });
    expect(loadExample("nonexistent")).toBeNull();
  });
});

describe("injectFewShot", () => {
  const savedEnv = process.env.GYM_NO_FEWSHOT;
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.GYM_NO_FEWSHOT;
    else process.env.GYM_NO_FEWSHOT = savedEnv;
  });

  it("returns task unchanged when GYM_NO_FEWSHOT=1", () => {
    process.env.GYM_NO_FEWSHOT = "1";
    expect(injectFewShot("fix the bug")).toBe("fix the bug");
  });

  it("returns task unchanged when no patterns match", () => {
    delete process.env.GYM_NO_FEWSHOT;
    expect(injectFewShot("write a haiku")).toBe("write a haiku");
  });

  it("prepends examples when patterns match", () => {
    delete process.env.GYM_NO_FEWSHOT;
    (readFileSync as any).mockReturnValue("## Worked Example\nStep 1: reproduce\n## Evidence\nproof");
    const result = injectFewShot("fix the failing test case");
    expect(result).toContain("Reference: How a similar task");
    expect(result).toContain("Step 1: reproduce");
    expect(result).toContain("fix the failing test case");
  });

  it("returns unchanged if example files can't load", () => {
    delete process.env.GYM_NO_FEWSHOT;
    (readFileSync as any).mockImplementation(() => { throw new Error("ENOENT"); });
    const task = "fix the binary file bug";
    expect(injectFewShot(task)).toBe(task);
  });
});
