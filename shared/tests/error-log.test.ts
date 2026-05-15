import { describe, it, expect } from "bun:test";
import {
  extractErrorCodes,
  parseIssueToErrorEntry,
  appendErrorLogs,
} from "../evaluation/error-log.js";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("extractErrorCodes", () => {
  it("extracts FM codes from issue string", () => {
    expect(extractErrorCodes("[FM-1.2][LABEL] description")).toEqual(["FM-1.2"]);
  });
  it("extracts multiple FM codes", () => {
    expect(extractErrorCodes("[FM-1.2 / FM-3.4] text")).toEqual(["FM-1.2", "FM-3.4"]);
  });
  it("returns empty for no codes", () => {
    expect(extractErrorCodes("no codes here")).toEqual([]);
  });
});

describe("parseIssueToErrorEntry", () => {
  it("parses issue with FM code and label", () => {
    const entries = parseIssueToErrorEntry("[FM-1.2][CONSTRAINT_MISMATCH] Did not follow spec", "sess-1", "2024-01-01");
    expect(entries).toHaveLength(1);
    expect(entries[0].error_code).toBe("FM-1.2");
    expect(entries[0].trigger).toBe("CONSTRAINT_MISMATCH");
    expect(entries[0].critique).toBe("Did not follow spec");
  });
  it("returns empty for no FM codes", () => {
    expect(parseIssueToErrorEntry("no codes", "s1", "2024-01-01")).toEqual([]);
  });
  it("creates entry per FM code", () => {
    const entries = parseIssueToErrorEntry("[FM-1.1 / FM-2.3][LABEL] desc", "s1", "2024-01-01");
    expect(entries).toHaveLength(2);
  });
});

describe("appendErrorLogs", () => {
  function tempRoot(): string {
    return mkdtempSync(join(tmpdir(), "error-log-test-"));
  }

  it("writes JSONL entries for agents with FM-coded issues", () => {
    const result = {
      agents: {
        "sess-1": { score: 3, issues: ["[FM-1.2][WRONG] bad thing"], suggestions: [] },
      },
    } as any;
    const children = [{ sessionId: "sess-1", agent: "coder" }] as any;
    const root = tempRoot();
    try {
      appendErrorLogs(result, children, root);
      const log = readFileSync(join(root, "agents", "coder", "ERROR_LOG.jsonl"), "utf-8");
      expect(log).toContain("FM-1.2");
      expect(log).toContain("WRONG");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips agents with no FM-coded issues", () => {
    const result = {
      agents: {
        "sess-1": { score: 5, issues: ["minor style issue"], suggestions: [] },
      },
    } as any;
    const children = [{ sessionId: "sess-1", agent: "coder" }] as any;
    const root = tempRoot();
    try {
      appendErrorLogs(result, children, root);
      expect(() => readFileSync(join(root, "agents", "coder", "ERROR_LOG.jsonl"), "utf-8")).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips agents not in result", () => {
    const result = { agents: {} } as any;
    const children = [{ sessionId: "sess-1", agent: "coder" }] as any;
    const root = tempRoot();
    try {
      appendErrorLogs(result, children, root);
      expect(() => readFileSync(join(root, "agents", "coder", "ERROR_LOG.jsonl"), "utf-8")).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("handles appendFileSync errors gracefully", () => {
    const dir = tempRoot();
    const root = join(dir, "not-a-dir");
    writeFileSync(root, "blocks mkdir");
    const result = {
      agents: {
        "sess-1": { score: 3, issues: ["[FM-1.2][X] y"], suggestions: [] },
      },
    } as any;
    const children = [{ sessionId: "sess-1", agent: "coder" }] as any;
    // Should not throw
    expect(() => appendErrorLogs(result, children, root)).not.toThrow();
  });
});
