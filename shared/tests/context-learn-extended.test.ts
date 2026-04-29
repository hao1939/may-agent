import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  extractFactsMechanical,
  applyContextUpdates,
  readContext,
  learnFromSession,
  type ContextUpdate,
  type TranscriptMessage,
} from "../evaluation/context-learn.js";

const TEST_DIR = "/tmp/test-context-learn-" + Date.now();

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true }); } catch {}
});

describe("extractFactsMechanical", () => {
  it("returns empty for empty messages", () => {
    expect(extractFactsMechanical([])).toEqual([]);
  });

  it("detects npm→bun command correction", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "npm install" } }],
      },
      { role: "toolResult", toolName: "bash", content: "npm ERR! not found", isError: true },
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "bun install" } }],
      },
      { role: "toolResult", toolName: "bash", content: "success", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("bun");
    expect(facts[0].action).toBe("add");
  });

  it("detects node→bun runtime correction", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "node test.js" } }],
      },
      { role: "toolResult", toolName: "bash", content: "error", isError: true },
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test.js" } }],
      },
      { role: "toolResult", toolName: "bash", content: "ok", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("bun");
  });

  it("detects npm test→vitest correction", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "npm test" } }],
      },
      { role: "toolResult", toolName: "bash", content: "error", isError: true },
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "npx vitest run" } }],
      },
      { role: "toolResult", toolName: "bash", content: "pass", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("vitest");
  });

  it("detects command not found corrections", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "yarn install" } }],
      },
      { role: "toolResult", toolName: "bash", content: "yarn: command not found", isError: true },
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "npm install" } }],
      },
      { role: "toolResult", toolName: "bash", content: "ok", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("npm");
  });

  it("detects same-command different-args correction", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "cd src && tsc --strict" } }],
      },
      { role: "toolResult", toolName: "bash", content: "error", isError: true },
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "cd src && tsc --noEmit" } }],
      },
      { role: "toolResult", toolName: "bash", content: "ok", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].content).toContain("tsc --noEmit");
  });

  it("detects deno.json runtime fact", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "read", arguments: { path: "deno.json" } }],
      },
      { role: "toolResult", toolName: "read", content: '{"tasks":{}}', isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.some(f => f.content.includes("Deno"))).toBe(true);
  });

  it("detects bunfig.toml runtime fact", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "read", arguments: { path: "bunfig.toml" } }],
      },
      { role: "toolResult", toolName: "read", content: "[install]", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.some(f => f.content.includes("Bun"))).toBe(true);
  });

  it("detects path discovery from failed→successful reads", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "read", arguments: { path: "src/config.ts" } }],
      },
      { role: "toolResult", toolName: "read", content: "not found", isError: true },
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "read", arguments: { path: "lib/config.ts" } }],
      },
      { role: "toolResult", toolName: "read", content: "export default {}", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(facts.some(f => f.content.includes("lib/config.ts"))).toBe(true);
  });

  it("handles string arguments in toolCall", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: '{"command":"echo hi"}' }],
      },
      { role: "toolResult", toolName: "bash", content: "hi", isError: false },
    ];
    // Should not crash
    const facts = extractFactsMechanical(messages);
    expect(Array.isArray(facts)).toBe(true);
  });

  it("handles tool_use type (alternative format)", () => {
    const messages: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", name: "bash", input: { command: "echo hi" } }],
      },
      { role: "tool", toolName: "bash", content: "hi", isError: false },
    ];
    const facts = extractFactsMechanical(messages);
    expect(Array.isArray(facts)).toBe(true);
  });
});

describe("applyContextUpdates", () => {
  it("adds new facts to empty file", () => {
    const path = join(TEST_DIR, "context.md");
    const result = applyContextUpdates(path, [
      { action: "add", content: "Use bun not npm" },
    ]);
    expect(result.added).toEqual(["Use bun not npm"]);
    expect(readFileSync(path, "utf-8")).toContain("Use bun not npm");
  });

  it("deduplicates existing facts", () => {
    const path = join(TEST_DIR, "context.md");
    writeFileSync(path, "- Use bun not npm\n");
    const result = applyContextUpdates(path, [
      { action: "add", content: "Use bun not npm" },
    ]);
    expect(result.added).toEqual([]);
  });

  it("removes matching facts", () => {
    const path = join(TEST_DIR, "context.md");
    writeFileSync(path, "- Use bun not npm\n- Other fact\n");
    const result = applyContextUpdates(path, [
      { action: "remove", content: "use bun not npm" },
    ]);
    expect(result.removed.length).toBe(1);
  });

  it("trims content to maxSize", () => {
    const path = join(TEST_DIR, "context.md");
    const updates: ContextUpdate[] = [];
    for (let i = 0; i < 50; i++) {
      updates.push({ action: "add", content: `Fact number ${i} with some extra text to fill space` });
    }
    applyContextUpdates(path, updates, 500);
    const content = readFileSync(path, "utf-8");
    expect(content.length).toBeLessThanOrEqual(500 + 100); // some tolerance
  });

  it("returns empty when nothing changes", () => {
    const path = join(TEST_DIR, "context.md");
    writeFileSync(path, "- Existing fact\n");
    const result = applyContextUpdates(path, []);
    expect(result).toEqual({ added: [], removed: [] });
  });
});

describe("readContext", () => {
  it("returns empty string for missing file", () => {
    expect(readContext("/tmp/nonexistent-" + Date.now())).toBe("");
  });

  it("returns trimmed content for existing file", () => {
    const path = join(TEST_DIR, "ctx.md");
    writeFileSync(path, "  - fact one\n  ");
    expect(readContext(path)).toBe("- fact one");
  });
});

describe("learnFromSession", () => {
  it("returns empty for messages with no learnable patterns", () => {
    const agentDir = join(TEST_DIR, "agent");
    mkdirSync(agentDir, { recursive: true });
    const result = learnFromSession({
      agentDir,
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result).toEqual({ added: [], removed: [] });
  });

  it("writes context.md with learned facts", () => {
    const agentDir = join(TEST_DIR, "agent2");
    mkdirSync(agentDir, { recursive: true });
    const result = learnFromSession({
      agentDir,
      messages: [
        {
          role: "assistant",
          content: [{ type: "toolCall", name: "read", arguments: { path: "deno.jsonc" } }],
        },
        { role: "toolResult", toolName: "read", content: '{"tasks":{}}', isError: false },
      ],
    });
    expect(result.added.length).toBeGreaterThan(0);
    expect(existsSync(join(agentDir, "context.md"))).toBe(true);
  });
});
