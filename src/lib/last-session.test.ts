import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatLastSession, writeLastSession, LAST_SESSION_FILENAME } from "./last-session.js";
import type { LastSessionData } from "./last-session.js";

let testDir: string;
let agentDir: string;

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
    expect(md).toContain("## Reported Completed Work");
    expect(md).toContain("- Fix auth bug");
  });

  it("reports follow-up suggestions without claiming Task creation", () => {
    const md = formatLastSession(makeData({
      newItems: ["Add retry logic"],
    }));
    expect(md).toContain("## Suggested Follow-up Work");
    expect(md).not.toContain("New Tasks Created");
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

describe("writeLastSession", () => {
  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "may-last-session-"));
    agentDir = join(testDir, "agents", "coder");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates the agent directory and writes last-session.md", () => {
    const data = makeData();
    writeLastSession(agentDir, data);

    const filePath = join(agentDir, LAST_SESSION_FILENAME);
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain("# Last Session");
    expect(content).toContain("s_test_123");
    expect(content).toContain("Implemented feature X");
  });

  it("overwrites previous file", () => {
    writeLastSession(agentDir, makeData({ summary: "First session" }));
    writeLastSession(agentDir, makeData({ summary: "Second session" }));

    const content = readFileSync(join(agentDir, LAST_SESSION_FILENAME), "utf8");
    expect(content).toContain("Second session");
    expect(content).not.toContain("First session");
  });
});
