import { describe, it, expect } from "vitest";
import {
  extractFactsMechanical,
  type TranscriptMessage,
} from "../evaluation/context-learn.ts";

// Helper to create tool call messages
function bashCall(command: string, index: number): TranscriptMessage {
  return {
    role: "assistant",
    content: [{ type: "tool_use", name: "bash", arguments: { command }, index }],
  } as unknown as TranscriptMessage;
}

function bashResult(content: string, index: number, isError = false): TranscriptMessage {
  return { role: "tool", toolName: "bash", content, isError, index } as unknown as TranscriptMessage;
}

function readCall(path: string, index: number): TranscriptMessage {
  return {
    role: "assistant",
    content: [{ type: "tool_use", name: "read", arguments: { path }, index }],
  } as unknown as TranscriptMessage;
}

function readResult(content: string, index: number, isError = false): TranscriptMessage {
  return { role: "tool", toolName: "read", content, isError, index } as unknown as TranscriptMessage;
}

describe("extractCommandCorrections - node to bun/deno", () => {
  it("detects node->bun correction", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("node script.js", 0),
      bashResult("Error: something failed", 1, true),
      bashCall("bun script.js", 2),
      bashResult("Success", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("bun") && f.content.includes("node"))).toBe(true);
  });

  it("detects node->deno correction", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("node run.ts", 0),
      bashResult("Error: crash", 1, true),
      bashCall("deno run.ts", 2),
      bashResult("ok", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("deno") && f.content.includes("node"))).toBe(true);
  });
});

describe("extractCommandCorrections - npm test to other runner", () => {
  it("detects npm test->vitest correction", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("npm test", 0),
      bashResult("error npm test failed", 1, true),
      bashCall("npx vitest", 2),
      bashResult("Tests passed", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("vitest") || f.content.includes("Test runner"))).toBe(true);
  });

  it("detects npm test->bun test correction", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("npm test", 0),
      bashResult("error", 1, true),
      bashCall("bun test", 2),
      bashResult("ok", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("bun test") || f.content.includes("Test runner"))).toBe(true);
  });

  it("detects npm test->jest correction", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("npm test", 0),
      bashResult("err", 1, true),
      bashCall("npx jest", 2),
      bashResult("ok", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("jest") || f.content.includes("Test runner"))).toBe(true);
  });
});

describe("extractCommandCorrections - command not found", () => {
  it("detects command not found and suggests alternative", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("yarn install", 0),
      bashResult("bash: yarn: command not found", 1, true),
      bashCall("npm install", 2),
      bashResult("added 50 packages", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("npm") && f.content.includes("yarn"))).toBe(true);
  });

  it("detects 'not found' variant", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("pnpm run build", 0),
      bashResult("pnpm: not found", 1, true),
      bashCall("npm run build", 2),
      bashResult("Build complete", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("npm") && f.content.includes("pnpm"))).toBe(true);
  });
});

describe("extractCommandCorrections - generic command correction", () => {
  it("detects same-binary flag correction", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("cd /app && git log --oneline -5", 0),
      bashResult("fatal: not a git repository", 1, true),
      bashCall("cd /app/agents && git log --oneline -5", 2),
      bashResult("abc123 commit msg", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("Correct command") || f.content.includes("git"))).toBe(true);
  });
});

describe("extractRuntimeFacts", () => {
  it("detects Deno runtime from deno.json", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/deno.json", 0),
      readResult('{"tasks": {}}', 1, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("Deno"))).toBe(true);
  });

  it("detects Deno runtime from deno.jsonc", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/deno.jsonc", 0),
      readResult('{}', 1, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("Deno"))).toBe(true);
  });

  it("detects Bun runtime from bunfig.toml", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/bunfig.toml", 0),
      readResult('[install]\npeer = false', 1, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("Bun") && f.content.includes("bunfig"))).toBe(true);
  });

  it("detects Bun runtime from package.json with runtime field", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/package.json", 0),
      readResult('{"name":"test","runtime":"bun","dependencies":{}}', 1, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("Bun") && f.content.includes("package.json"))).toBe(true);
  });

  it("does not detect Bun from package.json without runtime field", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/package.json", 0),
      readResult('{"name":"test","dependencies":{"bun":"1.0"}}', 1, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.every(f => !f.content.includes("Bun runtime (package.json"))).toBe(true);
  });

  it("ignores read errors", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/deno.json", 0),
      readResult("File not found", 1, true),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.every(f => !f.content.includes("Deno"))).toBe(true);
  });
});

describe("extractPathDiscoveries", () => {
  it("detects file path correction when same filename at different path", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/src/config.ts", 0),
      readResult("File not found", 1, true),
      readCall("/project/lib/config.ts", 2),
      readResult("export const config = {}", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("config.ts") && f.content.includes("/project/lib/config.ts"))).toBe(true);
  });

  it("ignores when different filenames", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/src/index.ts", 0),
      readResult("not found", 1, true),
      readCall("/project/lib/config.ts", 2),
      readResult("ok", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.every(f => !f.content.includes("is at"))).toBe(true);
  });

  it("ignores when same path succeeds", () => {
    const msgs: TranscriptMessage[] = [
      readCall("/project/src/config.ts", 0),
      readResult("not found", 1, true),
      readCall("/project/src/config.ts", 2),
      readResult("ok", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    // Same path, so no "is at" fact
    expect(facts.every(f => !f.content.includes("is at"))).toBe(true);
  });
});

describe("tryParseJson via tool_use with string arguments", () => {
  it("parses valid JSON string arguments", () => {
    const msgs: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", name: "bash", arguments: '{"command":"echo hello"}' }],
      } as unknown as TranscriptMessage,
      bashResult("hello", 1, false),
    ];
    // Should not throw - tryParseJson handles the string
    const facts = extractFactsMechanical(msgs);
    expect(Array.isArray(facts)).toBe(true);
  });

  it("handles invalid JSON string arguments gracefully", () => {
    const msgs: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", name: "bash", arguments: "not-json{{{" }],
      } as unknown as TranscriptMessage,
      bashResult("ok", 1, false),
    ];
    // tryParseJson returns {} for invalid JSON
    const facts = extractFactsMechanical(msgs);
    expect(Array.isArray(facts)).toBe(true);
  });
});

describe("toolResult content handling", () => {
  it("handles array content in tool results", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("npm install", 0),
      {
        role: "tool",
        toolName: "bash",
        content: [{ text: "error: " }, { text: "command not found" }],
        isError: true,
        index: 1,
      } as unknown as TranscriptMessage,
      bashCall("bun install", 2),
      bashResult("done", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("bun") && f.content.includes("npm"))).toBe(true);
  });

  it("handles non-string non-array content", () => {
    const msgs: TranscriptMessage[] = [
      bashCall("echo hi", 0),
      {
        role: "tool",
        toolName: "bash",
        content: 42,
        isError: false,
        index: 1,
      } as unknown as TranscriptMessage,
    ];
    const facts = extractFactsMechanical(msgs);
    expect(Array.isArray(facts)).toBe(true);
  });
});

describe("toolCall type variants", () => {
  it("handles toolCall type (not just tool_use)", () => {
    const msgs: TranscriptMessage[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", toolName: "bash", input: { command: "npm install" } }],
      } as unknown as TranscriptMessage,
      bashResult("error", 1, true),
      bashCall("bun install", 2),
      bashResult("done", 3, false),
    ];
    const facts = extractFactsMechanical(msgs);
    expect(facts.some(f => f.content.includes("bun") && f.content.includes("npm"))).toBe(true);
  });
});
