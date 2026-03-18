import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runPreflightCheck,
  updatePreflightState,
  loadPreflightState,
  savePreflightState,
} from "../../agents/may/handlers/run-agent-task.js";
import type { PreflightCheck } from "../../src/lib/cron-tool.js";

const TEST_ROOT = join(tmpdir(), "preflight-test-" + Date.now());
const PERSIST_DIR = join(TEST_ROOT, ".state");
const logs: string[] = [];
const log = (msg: string) => logs.push(msg);

beforeEach(() => {
  mkdirSync(PERSIST_DIR, { recursive: true });
  logs.length = 0;
});

afterEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("preflight: file-has-content", () => {
  it("returns false when file does not exist", () => {
    const check: PreflightCheck = { type: "file-has-content", path: "missing.md" };
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(false);
    expect(logs[0]).toContain("Skip");
    expect(logs[0]).toContain("not found");
  });

  it("returns false when file is empty", () => {
    writeFileSync(join(TEST_ROOT, "empty.md"), "");
    const check: PreflightCheck = { type: "file-has-content", path: "empty.md" };
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(false);
  });

  it("returns true when file has content", () => {
    writeFileSync(join(TEST_ROOT, "data.md"), "line1\nline2\nline3\n");
    const check: PreflightCheck = { type: "file-has-content", path: "data.md" };
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(true);
    expect(logs[0]).toContain("Pass");
  });

  it("respects minLines threshold", () => {
    writeFileSync(join(TEST_ROOT, "short.md"), "only one line\n");
    const check: PreflightCheck = { type: "file-has-content", path: "short.md", minLines: 3 };
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(false);
    expect(logs[0]).toContain("1 lines (need 3)");
  });

  it("counts only non-empty lines", () => {
    writeFileSync(join(TEST_ROOT, "sparse.md"), "\n\nreal line\n\n\n");
    const check: PreflightCheck = { type: "file-has-content", path: "sparse.md", minLines: 1 };
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(true);
  });
});

describe("preflight: new-entries-since", () => {
  it("returns true on first run (no state)", () => {
    writeFileSync(join(TEST_ROOT, "data.jsonl"), '{"a":1}\n');
    const check: PreflightCheck = {
      type: "new-entries-since",
      path: "data.jsonl",
      stateKey: "test-key",
    };
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(true);
    expect(logs[0]).toContain("Pass");
  });

  it("returns false when file size unchanged since last check", () => {
    const filePath = join(TEST_ROOT, "data.jsonl");
    writeFileSync(filePath, '{"a":1}\n');

    const check: PreflightCheck = {
      type: "new-entries-since",
      path: "data.jsonl",
      stateKey: "test-key",
    };

    // Simulate a previous successful run
    updatePreflightState(check, TEST_ROOT, PERSIST_DIR, "test-job");

    // No new data added — should skip
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(false);
    expect(logs[0]).toContain("Skip");
  });

  it("returns true when file has grown since last check", () => {
    const filePath = join(TEST_ROOT, "data.jsonl");
    writeFileSync(filePath, '{"a":1}\n');

    const check: PreflightCheck = {
      type: "new-entries-since",
      path: "data.jsonl",
      stateKey: "test-key",
    };

    // Record state
    updatePreflightState(check, TEST_ROOT, PERSIST_DIR, "test-job");

    // Add new data
    writeFileSync(filePath, '{"a":1}\n{"b":2}\n');

    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(true);
    expect(logs[0]).toContain("Pass");
  });

  it("returns false when file does not exist", () => {
    const check: PreflightCheck = {
      type: "new-entries-since",
      path: "nonexistent.jsonl",
      stateKey: "test-key",
    };
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(false);
  });

  it("handles directories — returns true when new files added", () => {
    const dirPath = join(TEST_ROOT, "evals");
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(join(dirPath, "eval-1.json"), "{}");

    const check: PreflightCheck = {
      type: "new-entries-since",
      path: "evals",
      stateKey: "evals-check",
    };

    // Record state (1 file)
    updatePreflightState(check, TEST_ROOT, PERSIST_DIR, "test-job");

    // No change — skip
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(false);

    // Add a file
    writeFileSync(join(dirPath, "eval-2.json"), "{}");
    logs.length = 0;
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(true);
    expect(logs[0]).toContain("2 files");
  });

  it("uses entry name as fallback stateKey", () => {
    writeFileSync(join(TEST_ROOT, "log.jsonl"), "entry\n");
    const check: PreflightCheck = {
      type: "new-entries-since",
      path: "log.jsonl",
      // No stateKey — should use entryName
    };

    updatePreflightState(check, TEST_ROOT, PERSIST_DIR, "my-job-name");
    const state = loadPreflightState(PERSIST_DIR);
    expect(state["my-job-name"]).toBeDefined();
    expect(state["my-job-name"].fileSize).toBeGreaterThan(0);
  });
});

describe("preflight state persistence", () => {
  it("round-trips state through save/load", () => {
    const state = {
      "key-1": { checkedAt: 1000, fileSize: 500 },
      "key-2": { checkedAt: 2000, fileCount: 10 },
    };
    savePreflightState(PERSIST_DIR, state);
    const loaded = loadPreflightState(PERSIST_DIR);
    expect(loaded).toEqual(state);
  });

  it("returns empty object when state file missing", () => {
    const loaded = loadPreflightState(join(TEST_ROOT, "nonexistent-dir"));
    expect(loaded).toEqual({});
  });
});

describe("preflight: unknown type", () => {
  it("returns true for unknown check type (fail-open)", () => {
    const check = { type: "unknown-future-type", path: "data.jsonl" } as unknown as PreflightCheck;
    expect(runPreflightCheck(check, TEST_ROOT, PERSIST_DIR, "test-job", log)).toBe(true);
    expect(logs[0]).toContain("Unknown check type");
  });
});
