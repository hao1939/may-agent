import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { learnFromSession } from "../src/lib/context-learn.js";

const tmpDir = join(process.cwd(), "test-workspace", "context-learn-test");
const agentDir = join(tmpDir, "test-agent");

describe("learnFromSession", () => {
  beforeEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(agentDir, { recursive: true });
  });

  it("extracts npm→bun correction", () => {
    const messages = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "npm test" } }] },
      { role: "toolResult", toolName: "bash", content: 'npm ERR! Missing script: "test"', isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test" } }] },
      { role: "toolResult", toolName: "bash", content: "4 passed, 0 failed", isError: false },
    ];

    const result = learnFromSession({ agentDir, messages });
    expect(result.added.length).toBeGreaterThanOrEqual(1);
    expect(result.added.some((f) => f.toLowerCase().includes("bun"))).toBe(true);
    expect(existsSync(join(agentDir, "context.md"))).toBe(true);
  });

  it("extracts node→bun correction", () => {
    const messages = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "node test/run.js" } }] },
      { role: "toolResult", toolName: "bash", content: "Error: Cannot find module 'bun:test'", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test/run.js" } }] },
      { role: "toolResult", toolName: "bash", content: "All tests passed", isError: false },
    ];

    const result = learnFromSession({ agentDir, messages });
    expect(result.added.length).toBeGreaterThanOrEqual(1);
    expect(result.added.some((f) => f.toLowerCase().includes("bun"))).toBe(true);
  });

  it("extracts general command correction (same tool, different args)", () => {
    const messages = [
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test/pipeline.test.js" } }],
      },
      {
        role: "toolResult",
        toolName: "bash",
        content: "error: Cannot use describe() outside of the test runner",
        isError: true,
      },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test" } }] },
      { role: "toolResult", toolName: "bash", content: "4 passed, 0 failed", isError: false },
    ];

    const result = learnFromSession({ agentDir, messages });
    expect(result.added.length).toBeGreaterThanOrEqual(1);
    expect(result.added.some((f) => f.includes("bun test"))).toBe(true);
  });

  it("extracts runtime fact from deno.json", () => {
    const messages = [
      { role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "/work/deno.json" } }] },
      { role: "toolResult", toolName: "read", content: '{ "tasks": { "test": "deno test" } }', isError: false },
    ];

    const result = learnFromSession({ agentDir, messages });
    expect(result.added.some((f) => f.toLowerCase().includes("deno"))).toBe(true);
  });

  it("extracts path discovery after failed read", () => {
    const messages = [
      { role: "assistant", content: [{ type: "toolCall", name: "read", arguments: { path: "/work/src/config.ts" } }] },
      { role: "toolResult", toolName: "read", content: "File not found", isError: true },
      {
        role: "assistant",
        content: [{ type: "toolCall", name: "read", arguments: { path: "/work/config/config.ts" } }],
      },
      { role: "toolResult", toolName: "read", content: "export const config = {}", isError: false },
    ];

    const result = learnFromSession({ agentDir, messages });
    expect(result.added.some((f) => f.includes("config.ts") && f.includes("config/config.ts"))).toBe(true);
  });

  it("deduplicates against existing context.md", () => {
    const messages = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "npm test" } }] },
      { role: "toolResult", toolName: "bash", content: "npm ERR!", isError: true },
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "bun test" } }] },
      { role: "toolResult", toolName: "bash", content: "ok", isError: false },
    ];

    // First call
    const r1 = learnFromSession({ agentDir, messages });
    expect(r1.added.length).toBeGreaterThanOrEqual(1);

    // Second call with same messages
    const r2 = learnFromSession({ agentDir, messages });
    expect(r2.added.length).toBe(0);
  });

  it("returns empty when no patterns found", () => {
    const messages = [
      { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command: "ls" } }] },
      { role: "toolResult", toolName: "bash", content: "file1.ts file2.ts", isError: false },
      { role: "assistant", content: [{ type: "toolCall", name: "finish", arguments: { status: "success" } }] },
    ];

    const result = learnFromSession({ agentDir, messages });
    expect(result.added.length).toBe(0);
    expect(existsSync(join(agentDir, "context.md"))).toBe(false);
  });
});
