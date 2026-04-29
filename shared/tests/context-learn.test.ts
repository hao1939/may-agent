import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  extractFactsMechanical,
  applyContextUpdates,
  readContext,
  learnFromSession,
  type TranscriptMessage,
  type ContextUpdate,
} from "../evaluation/context-learn.ts";

// ── extractFactsMechanical ──────────────────────────────────────────────

describe("extractFactsMechanical", () => {
  it("returns empty for empty messages", () => {
    expect(extractFactsMechanical([])).toEqual([]);
  });

  it("returns empty when no tool calls", () => {
    const msgs: TranscriptMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    expect(extractFactsMechanical(msgs)).toEqual([]);
  });

  it("detects npm->bun command correction", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "npm test" } }] },
      { role: "toolResult", toolName: "bash", content: "npm ERR! command not found", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test" } }] },
      { role: "toolResult", toolName: "bash", content: "3 tests passed", isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].action).toBe("add");
    expect(facts[0].content).toContain("bun");
  });

  it("detects node->bun runtime correction", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "node run.js" } }] },
      { role: "toolResult", toolName: "bash", content: "error: module not found", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "bun run.js" } }] },
      { role: "toolResult", toolName: "bash", content: "success", isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("bun");
  });

  it("detects path discoveries from read calls", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "/src/config.ts" } }] },
      { role: "toolResult", toolName: "read", content: "file not found", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "/lib/config.ts" } }] },
      { role: "toolResult", toolName: "read", content: "export const config = {}", isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("config.ts");
    expect(facts[0].content).toContain("/lib/config.ts");
  });

  it("detects deno runtime from deno.json read", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "/project/deno.json" } }] },
      { role: "toolResult", toolName: "read", content: '{ "tasks": {} }', isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("Deno"))).toBe(true);
  });

  it("detects bun runtime from bunfig.toml read", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "/project/bunfig.toml" } }] },
      { role: "toolResult", toolName: "read", content: '[install]', isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("Bun"))).toBe(true);
  });

  it("detects command not found corrections", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "yarn install" } }] },
      { role: "toolResult", toolName: "bash", content: "yarn: command not found", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "npm install" } }] },
      { role: "toolResult", toolName: "bash", content: "added 50 packages", isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("npm");
  });

  it("handles tool_use format (Claude style)", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "tool_use", name: "bash", input: { command: "npm test" } }] },
      { role: "toolResult", toolName: "bash", content: "error", isError: true },
      { role: "assistant", content: [{ type: "tool_use", name: "bash", input: { command: "bun test" } }] },
      { role: "tool", toolName: "bash", content: "pass", isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.length).toBeGreaterThan(0);
  });

  it("detects npm test -> vitest correction", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "npm test" } }] },
      { role: "toolResult", toolName: "bash", content: "error missing script", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "npx vitest run" } }] },
      { role: "toolResult", toolName: "bash", content: "5 passed", isError: false },
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("vitest");
  });
});

// ── applyContextUpdates ─────────────────────────────────────────────────

describe("applyContextUpdates", () => {
  let tmpDir: string;
  let contextPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ctx-test-"));
    contextPath = join(tmpDir, "context.md");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates file and adds facts", () => {
    const updates: ContextUpdate[] = [
      { action: "add", content: "Use bun not npm" },
      { action: "add", content: "Config at /lib/config.ts" },
    ];
    const result = applyContextUpdates(contextPath, updates);
    expect(result.added).toHaveLength(2);
    const content = readFileSync(contextPath, "utf-8");
    expect(content).toContain("Use bun not npm");
    expect(content).toContain("Config at /lib/config.ts");
  });

  it("deduplicates case-insensitively", () => {
    writeFileSync(contextPath, "- Use bun not npm\n");
    const updates: ContextUpdate[] = [{ action: "add", content: "use BUN not NPM" }];
    const result = applyContextUpdates(contextPath, updates);
    expect(result.added).toHaveLength(0);
  });

  it("removes matching lines", () => {
    writeFileSync(contextPath, "- Use bun not npm\n- Config at /lib\n");
    const updates: ContextUpdate[] = [{ action: "remove", content: "bun not npm" }];
    const result = applyContextUpdates(contextPath, updates);
    expect(result.removed).toHaveLength(1);
    const content = readFileSync(contextPath, "utf-8");
    expect(content).not.toContain("bun not npm");
    expect(content).toContain("Config at /lib");
  });

  it("returns empty when no changes needed", () => {
    writeFileSync(contextPath, "- existing fact\n");
    const updates: ContextUpdate[] = [{ action: "add", content: "existing fact" }];
    const result = applyContextUpdates(contextPath, updates);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it("trims content to maxSize", () => {
    const updates: ContextUpdate[] = [];
    for (let i = 0; i < 50; i++) {
      updates.push({ action: "add", content: `Fact number ${i} with some extra content to fill space` });
    }
    applyContextUpdates(contextPath, updates, 500);
    const content = readFileSync(contextPath, "utf-8");
    expect(content.length).toBeLessThanOrEqual(500);
  });

  it("creates parent directories", () => {
    const deepPath = join(tmpDir, "deep", "nested", "context.md");
    const result = applyContextUpdates(deepPath, [{ action: "add", content: "new fact" }]);
    expect(result.added).toHaveLength(1);
    expect(readFileSync(deepPath, "utf-8")).toContain("new fact");
  });
});

// ── readContext ──────────────────────────────────────────────────────────

describe("readContext", () => {
  it("returns empty string for missing file", () => {
    expect(readContext("/nonexistent/context.md")).toBe("");
  });

  it("returns trimmed file content", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rc-test-"));
    const path = join(tmp, "context.md");
    writeFileSync(path, "  some content  \n");
    expect(readContext(path)).toBe("some content");
    rmSync(tmp, { recursive: true, force: true });
  });
});

// ── learnFromSession ────────────────────────────────────────────────────

describe("learnFromSession", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "learn-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when no patterns found", () => {
    const result = learnFromSession({
      agentDir: tmpDir,
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it("writes facts to context.md in agent dir", () => {
    const msgs: TranscriptMessage[] = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "npm test" } }] },
      { role: "toolResult", toolName: "bash", content: "command not found", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test" } }] },
      { role: "toolResult", toolName: "bash", content: "pass", isError: false },
    ];
    const result = learnFromSession({ agentDir: tmpDir, messages: msgs });
    expect(result.added.length).toBeGreaterThan(0);
    const content = readFileSync(join(tmpDir, "context.md"), "utf-8");
    expect(content).toContain("bun");
  });
});
