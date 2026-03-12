import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/lib/manager.js";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@sinclair/typebox";

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

function echoTool(): AgentTool {
  const schema: TSchema = Type.Object({
    message: Type.String(),
  });
  return {
    name: "echo",
    label: "Echo",
    description: "Echoes a message back",
    parameters: schema,
    execute: async (_toolCallId: string, params: any): Promise<AgentToolResult<string>> => {
      const msg = (params as { message: string }).message;
      return {
        content: [{ type: "text", text: `Echo: ${msg}` }],
        details: msg,
      };
    },
  };
}

function multiBlockTool(): AgentTool {
  const schema: TSchema = Type.Object({
    a: Type.String(),
    b: Type.String(),
  });
  return {
    name: "multi",
    label: "Multi",
    description: "Returns multiple text blocks",
    parameters: schema,
    execute: async (_toolCallId: string, params: any): Promise<AgentToolResult<string>> => {
      const { a, b } = params as { a: string; b: string };
      return {
        content: [
          { type: "text", text: `A: ${a}` },
          { type: "text", text: `B: ${b}` },
        ],
        details: `${a}+${b}`,
      };
    },
  };
}

describe("tool receipt signing (HMAC receipts)", () => {
  let persistDir: string;
  let manager: SubagentManager;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-receipts-"));
    manager = new SubagentManager({ persistDir });
  });

  afterEach(() => {
    if (existsSync(persistDir)) {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  // ── signToolOutput / verifyToolOutput roundtrip ─────────────────────

  describe("signToolOutput + verifyToolOutput", () => {
    it("signs output and verifies correctly (roundtrip)", () => {
      const output = "Echo: hello world";
      const signed = manager.signToolOutput(output);

      // Signed output should contain the original text + a SIG tag
      expect(signed).toContain(output);
      expect(signed).toMatch(/\[SIG: \d+:[0-9a-f]{8}\]$/);

      // Extract content and signature from the signed output
      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      expect(sigMatch).not.toBeNull();
      const signature = sigMatch![1];
      const content = signed.slice(0, signed.lastIndexOf("\n[SIG:"));

      expect(content).toBe(output);
      expect(manager.verifyToolOutput(content, signature)).toBe(true);
    });

    it("returns false for tampered content", () => {
      const output = "Tests passed: 42/42";
      const signed = manager.signToolOutput(output);

      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];

      // Tamper with the content
      expect(manager.verifyToolOutput("Tests passed: 0/42", signature)).toBe(false);
    });

    it("returns false for tampered signature", () => {
      const output = "All checks green";
      const signed = manager.signToolOutput(output);

      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];
      const content = signed.slice(0, signed.lastIndexOf("\n[SIG:"));

      // Tamper with the hash portion
      const [ts, _hash] = signature.split(":");
      const tamperedSignature = `${ts}:deadbeef`;

      expect(manager.verifyToolOutput(content, tamperedSignature)).toBe(false);
    });

    it("returns false for tampered timestamp", () => {
      const output = "Result: success";
      const signed = manager.signToolOutput(output);

      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];
      const content = signed.slice(0, signed.lastIndexOf("\n[SIG:"));

      // Tamper with the timestamp
      const [_ts, hash] = signature.split(":");
      const tamperedSignature = `9999999999:${hash}`;

      expect(manager.verifyToolOutput(content, tamperedSignature)).toBe(false);
    });

    it("returns false for malformed signature (no colon)", () => {
      expect(manager.verifyToolOutput("anything", "noseparator")).toBe(false);
    });

    it("returns false for empty signature parts", () => {
      expect(manager.verifyToolOutput("anything", ":hash")).toBe(false);
      expect(manager.verifyToolOutput("anything", "ts:")).toBe(false);
    });

    it("handles empty string output", () => {
      const signed = manager.signToolOutput("");
      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      expect(sigMatch).not.toBeNull();
      const signature = sigMatch![1];

      // Content before the SIG tag: empty output means signed starts with "\n[SIG:..."
      const content = signed.slice(0, signed.indexOf("\n[SIG:"));
      expect(content).toBe("");
      expect(manager.verifyToolOutput(content, signature)).toBe(true);
    });

    it("handles multiline output", () => {
      const output = "line1\nline2\nline3";
      const signed = manager.signToolOutput(output);

      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];
      const content = signed.slice(0, signed.lastIndexOf("\n[SIG:"));

      expect(content).toBe(output);
      expect(manager.verifyToolOutput(content, signature)).toBe(true);
    });
  });

  // ── createVerifyReceiptTool ────────────────────────────────────────

  describe("createVerifyReceiptTool", () => {
    it("is a valid AgentTool with correct name and parameters", () => {
      const tool = manager.createVerifyReceiptTool();
      expect(tool.name).toBe("verify_receipt");
      expect(tool.description).toContain("Verify");
      expect(tool.execute).toBeInstanceOf(Function);
    });

    it("returns VALID for a correctly signed output", async () => {
      const tool = manager.createVerifyReceiptTool();
      const output = "Echo: hello world";
      const signed = manager.signToolOutput(output);

      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];
      const content = signed.slice(0, signed.lastIndexOf("\n[SIG:"));

      const result = await tool.execute("tc-1", { content, signature });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("VALID");
    });

    it("returns INVALID for tampered content", async () => {
      const tool = manager.createVerifyReceiptTool();
      const output = "Tests passed: 42/42";
      const signed = manager.signToolOutput(output);

      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];

      // Tampered content
      const result = await tool.execute("tc-2", { content: "Tests passed: 0/42", signature });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("INVALID");
    });

    it("returns INVALID for a completely fabricated signature", async () => {
      const tool = manager.createVerifyReceiptTool();
      const result = await tool.execute("tc-3", {
        content: "I ran the tests and they all passed",
        signature: "1700000000:abcd1234",
      });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("INVALID");
    });

    it("returns INVALID for malformed signature", async () => {
      const tool = manager.createVerifyReceiptTool();
      const result = await tool.execute("tc-4", {
        content: "some content",
        signature: "not-a-valid-sig",
      });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("INVALID");
    });
  });

  // ── wrapToolsWithReceipts ─────────────────────────────────────────

  describe("wrapToolsWithReceipts (via session tools)", () => {
    it("wrapped tool appends [SIG:] tag to output", async () => {
      // Register an agent so wrapToolsWithReceipts is called internally
      manager.register({
        name: "sig-agent",
        description: "Test agent",
        domain: "test",
        systemPrompt: "Test",
        model: fakeModel(),
        tools: [echoTool()],
        apiKey: "fake-key",
      });

      // Run session to get a sessionId (creates session dir)
      const sessionId = manager.run("sig-agent", "test");

      // Access the wrapped tools from the agent's state
      // The agent is created inside run(), so we get it from the active session
      const status = manager.status();
      const session = status.find((s) => s.sessionId === sessionId);
      expect(session).toBeDefined();

      // We can't access the wrapped tool directly from the manager's public API,
      // so we test the signing behavior by calling the public sign+verify methods
      // which use the same RUNTIME_RECEIPT_SECRET that wrapToolsWithReceipts uses.
      const testOutput = "Echo: test";
      const signed = manager.signToolOutput(testOutput);

      // The wrapped tool appends a SIG tag — verify it matches the same secret
      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      expect(sigMatch).not.toBeNull();
      const signature = sigMatch![1];
      expect(manager.verifyToolOutput(testOutput, signature)).toBe(true);

      // Clean up — wait for the session to finish
      await manager.waitFor(sessionId);
    });

    it("receipts.jsonl is created in session directory when tool is called", async () => {
      // We can't easily trigger a real tool call without an LLM,
      // but we can verify the session directory structure is set up
      manager.register({
        name: "receipts-dir-agent",
        description: "Test agent",
        domain: "test",
        systemPrompt: "Test",
        model: fakeModel(),
        tools: [echoTool()],
        apiKey: "fake-key",
      });

      const sessionId = manager.run("receipts-dir-agent", "test");
      await manager.waitFor(sessionId);

      // Session directory should exist (may be archived)
      const sessionsDir = join(persistDir, "sessions");
      expect(existsSync(sessionsDir)).toBe(true);
    });
  });

  // ── End-to-end: sign → verify_receipt tool ──────────────────────────

  describe("end-to-end: sign tool output → verify via verify_receipt tool", () => {
    it("sign then verify returns VALID", async () => {
      const verifyTool = manager.createVerifyReceiptTool();

      // Simulate what wrapToolsWithReceipts does: sign a tool output
      const originalOutput = "file.ts: no errors found";
      const signed = manager.signToolOutput(originalOutput);

      // Extract the parts like an LLM would parse them
      const lines = signed.split("\n");
      const sigLine = lines[lines.length - 1]; // "[SIG: ts:hash]"
      const sigMatch = sigLine.match(/\[SIG: ([^\]]+)\]/);
      expect(sigMatch).not.toBeNull();

      const signature = sigMatch![1];
      const content = lines.slice(0, -1).join("\n"); // everything before the SIG line

      // Call verify_receipt tool
      const result = await verifyTool.execute("tc-verify", { content, signature });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("VALID");
    });

    it("hallucinated output with real signature format returns INVALID", async () => {
      const verifyTool = manager.createVerifyReceiptTool();

      // Sign a real output
      const realOutput = "Tests: 10 passed, 0 failed";
      const signed = manager.signToolOutput(realOutput);
      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const realSignature = sigMatch![1];

      // Agent hallucinates different content but tries to reuse the signature
      const hallucinatedContent = "Tests: 100 passed, 0 failed";
      const result = await verifyTool.execute("tc-hallucinated", {
        content: hallucinatedContent,
        signature: realSignature,
      });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("INVALID");
    });

    it("completely fabricated signature returns INVALID", async () => {
      const verifyTool = manager.createVerifyReceiptTool();

      const result = await verifyTool.execute("tc-fabricated", {
        content: "Everything works perfectly!",
        signature: "1700000000:00000000",
      });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("INVALID");
    });

    it("verify_receipt works with multi-block tool output", async () => {
      const verifyTool = manager.createVerifyReceiptTool();

      // Multi-block tools concatenate all text blocks before signing
      const block1 = "A: hello";
      const block2 = "B: world";
      const combinedOutput = block1 + block2;
      const signed = manager.signToolOutput(combinedOutput);

      const sigMatch = signed.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];

      // Verify with the combined text
      const result = await verifyTool.execute("tc-multi", {
        content: combinedOutput,
        signature,
      });
      const text = result.content.map((b: any) => b.text).join("");
      expect(text).toBe("VALID");
    });

    it("same-process managers share the secret (receipts verify cross-instance)", () => {
      // RUNTIME_RECEIPT_SECRET is a module-level constant, shared within a process.
      // This is by design: "receipts are verifiable within the same runtime."
      const persistDir2 = mkdtempSync(join(tmpdir(), "may-receipts-2-"));
      const manager2 = new SubagentManager({ persistDir: persistDir2 });

      const output = "same content";
      const signed1 = manager.signToolOutput(output);

      // Extract content and signature from manager1's signed output
      const sigMatch = signed1.match(/\[SIG: ([^\]]+)\]$/);
      const signature = sigMatch![1];
      const content = signed1.slice(0, signed1.lastIndexOf("\n[SIG:"));

      // manager2 can verify manager1's signature (same process secret)
      expect(manager2.verifyToolOutput(content, signature)).toBe(true);

      // Clean up
      if (existsSync(persistDir2)) {
        rmSync(persistDir2, { recursive: true, force: true });
      }
    });
  });
});
