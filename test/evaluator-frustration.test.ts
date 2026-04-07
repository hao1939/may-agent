import { describe, it, expect } from "vitest";
import { detectFrustrationSignals } from "../src/lib/evaluator.js";

// ── Helper builders ──

function toolResult(text: string, isError = false): any {
  return {
    role: "toolResult",
    toolCallId: "tc_" + Math.random().toString(36).slice(2),
    toolName: "bash",
    content: [{ type: "text", text }],
  };
}

function assistantRead(path: string): any {
  return {
    role: "assistant",
    content: [
      { type: "toolCall", name: "read", id: "tc_r_" + Math.random().toString(36).slice(2), arguments: { path } },
    ],
  };
}

function assistantEdit(path: string): any {
  return {
    role: "assistant",
    content: [
      {
        type: "toolCall",
        name: "edit",
        id: "tc_e_" + Math.random().toString(36).slice(2),
        arguments: { path, oldText: "a", newText: "b" },
      },
    ],
  };
}

function assistantBash(command: string): any {
  return {
    role: "assistant",
    content: [
      {
        type: "toolCall",
        name: "bash",
        id: "tc_b_" + Math.random().toString(36).slice(2),
        arguments: { command },
      },
    ],
  };
}

function errorResult(msg = "ENOENT: no such file or directory"): any {
  return toolResult(msg);
}

function successResult(msg = "File contents here... all looks good"): any {
  return toolResult(msg);
}

// ── Tests ──

describe("detectFrustrationSignals", () => {
  it("returns zero for empty/short message sequences", () => {
    expect(detectFrustrationSignals([])).toEqual({
      errorBursts: 0,
      fileReReads: 0,
      editThrash: 0,
      lateErrorRatio: 0,
      frustrationScore: 0,
    });

    expect(detectFrustrationSignals([assistantRead("a.ts"), successResult()])).toMatchObject({
      frustrationScore: 0,
    });
  });

  it("returns zero for a clean successful session", () => {
    const messages = [
      assistantRead("src/app.ts"),
      successResult("export function main() { ... }"),
      assistantEdit("src/app.ts"),
      successResult("Edit applied successfully"),
      assistantBash("bun run check"),
      successResult("No errors found"),
      assistantBash("bun test"),
      successResult("3 tests passed"),
    ];
    const signals = detectFrustrationSignals(messages);
    expect(signals.frustrationScore).toBe(0);
    expect(signals.errorBursts).toBe(0);
    expect(signals.fileReReads).toBe(0);
    expect(signals.editThrash).toBe(0);
  });

  it("detects error bursts (3+ consecutive errors)", () => {
    const messages = [
      assistantBash("cat binary.bin"),
      errorResult("Error: unable to parse binary data"),
      assistantBash("file binary.bin"),
      errorResult("Error: unsupported format"),
      assistantBash("xxd binary.bin | head"),
      errorResult("Error: command not found"),
      assistantBash("echo 'done'"),
      successResult("done"),
    ];
    const signals = detectFrustrationSignals(messages);
    expect(signals.errorBursts).toBeGreaterThanOrEqual(1);
    expect(signals.frustrationScore).toBeGreaterThan(0);
  });

  it("detects file re-reads (same file read 4+ times)", () => {
    const messages = [
      assistantRead("src/config.ts"),
      successResult("export const config = { ... }"),
      assistantEdit("src/config.ts"),
      errorResult("Error: oldText not found"),
      assistantRead("src/config.ts"),
      successResult("export const config = { ... }"),
      assistantEdit("src/config.ts"),
      errorResult("Error: oldText not found"),
      assistantRead("src/config.ts"),
      successResult("export const config = { ... }"),
      assistantEdit("src/config.ts"),
      errorResult("Error: oldText not found"),
      assistantRead("src/config.ts"),
      successResult("export const config = { ... }"),
      assistantEdit("src/config.ts"),
      successResult("Edit applied"),
    ];
    const signals = detectFrustrationSignals(messages);
    expect(signals.fileReReads).toBeGreaterThanOrEqual(1);
    expect(signals.frustrationScore).toBeGreaterThan(0);
  });

  it("detects edit thrashing (same file edited 3+ times)", () => {
    const messages = [
      assistantEdit("src/app.ts"),
      errorResult("Error: oldText not found"),
      assistantEdit("src/app.ts"),
      errorResult("Error: oldText not found"),
      assistantEdit("src/app.ts"),
      successResult("Edit applied"),
      assistantBash("bun run check"),
      errorResult("TypeError: missing property"),
      assistantEdit("src/app.ts"),
      successResult("Edit applied"),
    ];
    const signals = detectFrustrationSignals(messages);
    expect(signals.editThrash).toBeGreaterThanOrEqual(1);
    expect(signals.frustrationScore).toBeGreaterThan(0);
  });

  it("detects late-session error escalation", () => {
    // First half: mostly success (4 tool results, 0 errors)
    const messages = [
      assistantRead("src/a.ts"),
      successResult("file contents"),
      assistantEdit("src/a.ts"),
      successResult("edit applied"),
      assistantBash("bun test"),
      successResult("all tests pass"),
      assistantBash("bun run check"),
      successResult("no errors"),
      // Second half: mostly errors (4 tool results, 3+ errors)
      assistantEdit("src/b.ts"),
      errorResult("Error: oldText not found"),
      assistantEdit("src/b.ts"),
      errorResult("Error: oldText not found"),
      assistantBash("bun test"),
      errorResult("Error: 3 tests failed"),
      assistantBash("bun run check"),
      errorResult("TypeError: property undefined"),
    ];
    const signals = detectFrustrationSignals(messages);
    expect(signals.lateErrorRatio).toBeGreaterThan(1);
    expect(signals.frustrationScore).toBeGreaterThan(0);
  });

  it("computes high frustration score for combined patterns", () => {
    // Simulate an impossible-task session: repeated errors, re-reads, thrashing
    const messages = [
      // Attempt 1: read and try
      assistantRead("binary.bin"),
      successResult("binary content..."),
      assistantBash("cat binary.bin"),
      errorResult("Error: unable to parse"),
      // Attempt 2: re-read and retry
      assistantRead("binary.bin"),
      successResult("binary content..."),
      assistantBash("xxd binary.bin"),
      errorResult("Error: command failed"),
      // Attempt 3: re-read again
      assistantRead("binary.bin"),
      successResult("binary content..."),
      assistantEdit("binary.bin"),
      errorResult("Error: cannot edit binary"),
      // Attempt 4: re-read again (4th read = re-read threshold)
      assistantRead("binary.bin"),
      successResult("binary content..."),
      assistantEdit("binary.bin"),
      errorResult("Error: oldText not found"),
      // Attempt 5: thrashing edits
      assistantEdit("binary.bin"),
      errorResult("Error: oldText not found"),
      assistantEdit("binary.bin"),
      errorResult("Validation failed for tool"),
    ];
    const signals = detectFrustrationSignals(messages);
    expect(signals.frustrationScore).toBeGreaterThanOrEqual(4);
    expect(signals.fileReReads).toBeGreaterThanOrEqual(1);
    expect(signals.editThrash).toBeGreaterThanOrEqual(1);
  });

  it("does not false-positive on legitimate multi-read workflows", () => {
    // Reading multiple DIFFERENT files is not thrashing
    const messages = [
      assistantRead("src/a.ts"),
      successResult("content a"),
      assistantRead("src/b.ts"),
      successResult("content b"),
      assistantRead("src/c.ts"),
      successResult("content c"),
      assistantRead("src/d.ts"),
      successResult("content d"),
      assistantEdit("src/a.ts"),
      successResult("edit applied"),
      assistantBash("bun test"),
      successResult("all pass"),
    ];
    const signals = detectFrustrationSignals(messages);
    expect(signals.frustrationScore).toBe(0);
    expect(signals.fileReReads).toBe(0);
    expect(signals.editThrash).toBe(0);
  });

  it("ignores errors in long tool results (file content, not actual errors)", () => {
    // Long output containing 'Error' keyword should not be treated as errors
    const longContent = "x".repeat(2500) + "\nError: this is in the file content, not an actual error";
    const messages = [
      assistantRead("src/app.ts"),
      toolResult(longContent),
      assistantRead("src/test.ts"),
      toolResult(longContent),
      assistantRead("src/lib.ts"),
      toolResult(longContent),
      assistantEdit("src/app.ts"),
      successResult("edit applied"),
    ];
    const signals = detectFrustrationSignals(messages);
    // Should not count long results as errors
    expect(signals.errorBursts).toBe(0);
  });
});
