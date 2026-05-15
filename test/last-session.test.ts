import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { formatLastSession, writeLastSession, readLastSession, LAST_SESSION_FILENAME } from "../src/lib/last-session.js";
import type { LastSessionData } from "../src/lib/last-session.js";

const TEST_DIR = join(import.meta.dirname ?? ".", ".test-last-session");
const AGENT_DIR = join(TEST_DIR, "agents", "coder");

function makeData(overrides: Partial<LastSessionData> = {}): LastSessionData {
  return {
    sessionId: "s_test_123",
    agent: "coder",
    status: "success",
    summary: "Implemented feature X and all tests pass.",
    duration: "2m 30s",
    filesModified: ["/src/feature.ts", "/test/feature.test.ts"],
    nextSteps: "Deploy to staging.",
    timestamp: 1713200000000,
    ...overrides,
  };
}

describe("formatLastSession", () => {
  it("includes session metadata", () => {
    const md = formatLastSession(makeData());
    expect(md).toContain("# Last Session");
    expect(md).toContain("s_test_123");
    expect(md).toContain("success");
    expect(md).toContain("2m 30s");
  });

  it("includes summary in What Happened section", () => {
    const md = formatLastSession(makeData());
    expect(md).toContain("## What Happened");
    expect(md).toContain("Implemented feature X");
  });

  it("includes files modified", () => {
    const md = formatLastSession(makeData());
    expect(md).toContain("## Files Modified");
    expect(md).toContain("- /src/feature.ts");
    expect(md).toContain("- /test/feature.test.ts");
  });

  it("includes next steps", () => {
    const md = formatLastSession(makeData());
    expect(md).toContain("## Still Open / Next Steps");
    expect(md).toContain("Deploy to staging.");
  });

  it("includes blockers", () => {
    const md = formatLastSession(makeData({
      blockers: [{ reason: "Need API key", context: "Ask admin" }],
    }));
    expect(md).toContain("## Blockers");
    expect(md).toContain("- Need API key — Ask admin");
  });

  it("includes completed items", () => {
    const md = formatLastSession(makeData({
      completedItems: ["Fix auth bug", "Update docs"],
    }));
    expect(md).toContain("## Completed");
    expect(md).toContain("- Fix auth bug");
  });

  it("includes new tasks", () => {
    const md = formatLastSession(makeData({
      newItems: ["Add retry logic"],
    }));
    expect(md).toContain("## New Tasks Created");
    expect(md).toContain("- Add retry logic");
  });

  it("omits empty sections", () => {
    const md = formatLastSession(makeData({
      filesModified: [],
      nextSteps: undefined,
      blockers: undefined,
    }));
    expect(md).not.toContain("## Files Modified");
    expect(md).not.toContain("## Still Open");
    expect(md).not.toContain("## Blockers");
  });
});

describe("writeLastSession / readLastSession", () => {
  beforeEach(() => {
    mkdirSync(AGENT_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("writes and reads last-session.md", () => {
    const data = makeData();
    writeLastSession(AGENT_DIR, data);

    const filePath = join(AGENT_DIR, LAST_SESSION_FILENAME);
    expect(existsSync(filePath)).toBe(true);

    const content = readLastSession(AGENT_DIR);
    expect(content).toContain("# Last Session");
    expect(content).toContain("s_test_123");
    expect(content).toContain("Implemented feature X");
  });

  it("returns null when file does not exist", () => {
    const content = readLastSession(join(TEST_DIR, "nonexistent"));
    expect(content).toBeNull();
  });

  it("overwrites previous file", () => {
    writeLastSession(AGENT_DIR, makeData({ summary: "First session" }));
    writeLastSession(AGENT_DIR, makeData({ summary: "Second session" }));

    const content = readLastSession(AGENT_DIR);
    expect(content).toContain("Second session");
    expect(content).not.toContain("First session");
  });
});
