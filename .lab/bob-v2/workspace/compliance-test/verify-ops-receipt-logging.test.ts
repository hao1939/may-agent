/**
 * verify-ops-receipt-logging.ts
 *
 * Compliance test that verifies ops-receipts are correctly written to
 * .state/ops-receipts.jsonl by the logOpsReceipt() function and the
 * gated tools (gated-test, gated-commit).
 *
 * This is a real integration test: it calls the actual functions with
 * injected exec stubs, writes to a real temp directory, then reads the
 * JSONL file back and asserts its contents.
 *
 * Run with:  npx vitest run agents/bob/workspace/compliance-test/verify-ops-receipt-logging.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createOpsReceipt,
  logOpsReceipt,
  OPS_RECEIPTS_PATH,
  type OpsReceipt,
} from "../../../../src/lib/ops-gate.js";

// ── Helpers ────────────────────────────────────────────────────────────

/** Create a unique temp dir for each test to avoid cross-contamination. */
function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    `ops-receipt-compliance-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  return dir;
}

/** Read all receipts from a JSONL file, returning parsed OpsReceipt[]. */
function readReceipts(dir: string, logFile?: string): OpsReceipt[] {
  const path = join(dir, logFile ?? OPS_RECEIPTS_PATH);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8").trim();
  if (raw.length === 0) return [];
  return raw.split("\n").map((line) => JSON.parse(line) as OpsReceipt);
}

/** Stub exec that returns a fixed result. */
function stubExec(exitCode: number, stdout = "", stderr = "") {
  return async (_cmd: string, _cwd: string) => ({ stdout, stderr, exitCode });
}

// ── Test Suite ─────────────────────────────────────────────────────────

describe("Compliance: ops-receipt logging to .state/ops-receipts.jsonl", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup failures */
    }
  });

  // ── 1. Core logOpsReceipt() writes to the file system ───────────────

  describe("logOpsReceipt() file-system verification", () => {
    it("creates .state/ops-receipts.jsonl when it does not exist", () => {
      const receipt = createOpsReceipt("test", "success", "all passed");
      logOpsReceipt(receipt, undefined, tempDir);

      const filePath = join(tempDir, OPS_RECEIPTS_PATH);
      expect(existsSync(filePath)).toBe(true);
    });

    it("writes a valid JSON line with all required OpsReceipt fields", () => {
      const receipt = createOpsReceipt("test", "success", "output-data");
      logOpsReceipt(receipt, undefined, tempDir);

      const receipts = readReceipts(tempDir);
      expect(receipts).toHaveLength(1);

      const r = receipts[0];
      // Required fields per OpsReceipt interface:
      expect(r).toHaveProperty("operation");
      expect(r).toHaveProperty("status");
      expect(r).toHaveProperty("timestamp");
      expect(r).toHaveProperty("outputHash");

      expect(r.operation).toBe("test");
      expect(r.status).toBe("success");
      expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(r.outputHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is append-only — multiple receipts accumulate as separate lines", () => {
      const r1 = createOpsReceipt("test", "success", "a");
      const r2 = createOpsReceipt("commit", "failure", "b");
      const r3 = createOpsReceipt("deploy", "success", "c");

      logOpsReceipt(r1, undefined, tempDir);
      logOpsReceipt(r2, undefined, tempDir);
      logOpsReceipt(r3, undefined, tempDir);

      const receipts = readReceipts(tempDir);
      expect(receipts).toHaveLength(3);
      expect(receipts[0].operation).toBe("test");
      expect(receipts[1].operation).toBe("commit");
      expect(receipts[2].operation).toBe("deploy");
    });

    it("preserves meta fields in the written JSON", () => {
      const receipt = createOpsReceipt("commit", "success", "done", {
        commitHash: "abc1234",
        filesChanged: 3,
      });
      logOpsReceipt(receipt, undefined, tempDir);

      const receipts = readReceipts(tempDir);
      expect(receipts[0].meta).toEqual({ commitHash: "abc1234", filesChanged: 3 });
    });

    it("preserves logPath when provided", () => {
      const receipt = createOpsReceipt(
        "test",
        "success",
        "ok",
        undefined,
        "/tmp/test-run.log",
      );
      logOpsReceipt(receipt, undefined, tempDir);

      const receipts = readReceipts(tempDir);
      expect(receipts[0].logPath).toBe("/tmp/test-run.log");
    });

    it("each line is independently parseable JSON (JSONL format)", () => {
      for (let i = 0; i < 5; i++) {
        logOpsReceipt(
          createOpsReceipt("test", i % 2 === 0 ? "success" : "failure", `run-${i}`),
          undefined,
          tempDir,
        );
      }

      const filePath = join(tempDir, OPS_RECEIPTS_PATH);
      const raw = readFileSync(filePath, "utf-8").trim();
      const lines = raw.split("\n");

      expect(lines).toHaveLength(5);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line) as OpsReceipt;
        expect(parsed.operation).toBe("test");
        expect(["success", "failure"]).toContain(parsed.status);
      }
    });

    it("outputHash is deterministic for the same output", () => {
      const r1 = createOpsReceipt("test", "success", "identical-output");
      const r2 = createOpsReceipt("test", "success", "identical-output");
      logOpsReceipt(r1, undefined, tempDir);
      logOpsReceipt(r2, undefined, tempDir);

      const receipts = readReceipts(tempDir);
      expect(receipts[0].outputHash).toBe(receipts[1].outputHash);
    });

    it("outputHash differs for different output", () => {
      const r1 = createOpsReceipt("test", "success", "output-alpha");
      const r2 = createOpsReceipt("test", "success", "output-beta");
      logOpsReceipt(r1, undefined, tempDir);
      logOpsReceipt(r2, undefined, tempDir);

      const receipts = readReceipts(tempDir);
      expect(receipts[0].outputHash).not.toBe(receipts[1].outputHash);
    });

    it("does not throw on write failure (fire-and-forget guarantee)", () => {
      const receipt = createOpsReceipt("test", "failure", "x");
      expect(() =>
        logOpsReceipt(receipt, "/dev/null/impossible/path.jsonl"),
      ).not.toThrow();
    });
  });

  // ── 2. gated-test tool writes receipts on success ────────────────────

  describe("gated-test tool receipt logging", () => {
    it("writes a success receipt when tests pass", { timeout: 15000 }, async () => {
      const { createGatedTestTool } = await import(
        "../../../../src/lib/tools/gated-test.js"
      );

      let callCount = 0;
      const exec = async (_cmd: string, _cwd: string) => {
        callCount++;
        // First call: tsc (gate), second: actual tests
        return {
          stdout: callCount === 1 ? "" : "Tests  5 passed, 5 total",
          stderr: "",
          exitCode: 0,
        };
      };

      const tool = createGatedTestTool({ cwd: tempDir, exec });
      const result = await tool.execute("tc1", {});

      // Verify receipt was written to disk
      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBeGreaterThanOrEqual(1);

      const last = receipts[receipts.length - 1];
      expect(last.operation).toBe("test");
      expect(last.status).toBe("success");
      expect(last.outputHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("writes a failure receipt when gate blocks", async () => {
      const { createGatedTestTool } = await import(
        "../../../../src/lib/tools/gated-test.js"
      );

      const exec = stubExec(1, "", "error TS2345: Argument of type ...");
      const tool = createGatedTestTool({ cwd: tempDir, exec });
      await tool.execute("tc2", {});

      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBeGreaterThanOrEqual(1);

      const last = receipts[receipts.length - 1];
      expect(last.operation).toBe("test");
      expect(last.status).toBe("failure");
      expect(last.meta).toEqual({ gateBlocked: true });
    });

    it("writes a failure receipt when tests fail after gate passes", async () => {
      const { createGatedTestTool } = await import(
        "../../../../src/lib/tools/gated-test.js"
      );

      let callCount = 0;
      const exec = async (_cmd: string, _cwd: string) => {
        callCount++;
        if (callCount === 1) return { stdout: "", stderr: "", exitCode: 0 }; // tsc OK
        return {
          stdout: "FAIL src/broken.test.ts\n2 passed, 1 failed, 3 total",
          stderr: "",
          exitCode: 1,
        };
      };

      const tool = createGatedTestTool({ cwd: tempDir, exec });
      await tool.execute("tc3", {});

      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBeGreaterThanOrEqual(1);

      const last = receipts[receipts.length - 1];
      expect(last.operation).toBe("test");
      expect(last.status).toBe("failure");
      expect(last.meta).toMatchObject({ exitCode: 1 });
    });

    it("writes receipt even with skipGate=true", async () => {
      const { createGatedTestTool } = await import(
        "../../../../src/lib/tools/gated-test.js"
      );

      const exec = async (_cmd: string, _cwd: string) => ({
        stdout: "10 passed",
        stderr: "",
        exitCode: 0,
      });

      const tool = createGatedTestTool({ cwd: tempDir, exec });
      await tool.execute("tc4", { skipGate: true });

      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBeGreaterThanOrEqual(1);

      const last = receipts[receipts.length - 1];
      expect(last.operation).toBe("test");
      expect(last.status).toBe("success");
    });
  });

  // ── 3. gated-commit tool writes receipts ─────────────────────────────

  describe("gated-commit tool receipt logging", () => {
    it("writes a success receipt when commit succeeds", async () => {
      const { createGatedCommitTool } = await import(
        "../../../../src/lib/tools/gated-commit.js"
      );

      const exec = async (cmd: string, _cwd: string) => {
        if (cmd.includes("git commit")) {
          return {
            stdout: "[main abc1234] fix: stuff\n 2 files changed, 10 insertions(+)",
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 }; // all gate checks pass
      };

      const tool = createGatedCommitTool({ cwd: tempDir, exec });
      await tool.execute("cc1", { message: "fix: stuff" });

      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBeGreaterThanOrEqual(1);

      const last = receipts[receipts.length - 1];
      expect(last.operation).toBe("commit");
      expect(last.status).toBe("success");
      expect(last.meta).toMatchObject({ commitHash: "abc1234", filesChanged: 2 });
    });

    it("writes a failure receipt when gate blocks the commit", async () => {
      const { createGatedCommitTool } = await import(
        "../../../../src/lib/tools/gated-commit.js"
      );

      const exec = async (cmd: string, _cwd: string) => {
        if (cmd.includes("git diff")) {
          return { stdout: "dirty.ts", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      };

      const tool = createGatedCommitTool({
        cwd: tempDir,
        exec,
        skipTypeCheck: true,
        skipTestCheck: true,
      });
      await tool.execute("cc2", { message: "fix: stuff" });

      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBeGreaterThanOrEqual(1);

      const last = receipts[receipts.length - 1];
      expect(last.operation).toBe("commit");
      expect(last.status).toBe("failure");
      expect(last.meta).toEqual({ gateBlocked: true });
    });

    it("writes a failure receipt for empty commit message", async () => {
      const { createGatedCommitTool } = await import(
        "../../../../src/lib/tools/gated-commit.js"
      );

      const tool = createGatedCommitTool({ cwd: tempDir, exec: stubExec(0) });
      await tool.execute("cc3", { message: "" });

      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBeGreaterThanOrEqual(1);

      const last = receipts[receipts.length - 1];
      expect(last.operation).toBe("commit");
      expect(last.status).toBe("failure");
    });
  });

  // ── 4. End-to-end: multiple tools accumulate in the same JSONL ───────

  describe("end-to-end audit log accumulation", () => {
    it("receipts from different tools accumulate in the same JSONL file", async () => {
      const { createGatedTestTool } = await import(
        "../../../../src/lib/tools/gated-test.js"
      );
      const { createGatedCommitTool } = await import(
        "../../../../src/lib/tools/gated-commit.js"
      );

      // Simulate: test passes → commit succeeds → test fails
      const testExecPass = async (_cmd: string, _cwd: string) => ({
        stdout: "3 passed",
        stderr: "",
        exitCode: 0,
      });

      const commitExec = async (cmd: string, _cwd: string) => {
        if (cmd.includes("git commit")) {
          return {
            stdout: "[main def5678] chore: update",
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      };

      const testExecFail = async (_cmd: string, _cwd: string) => ({
        stdout: "1 failed",
        stderr: "",
        exitCode: 1,
      });

      // 1) Test pass (skipGate to simplify)
      const testTool1 = createGatedTestTool({
        cwd: tempDir,
        exec: testExecPass,
        skipTypeCheck: true,
      });
      await testTool1.execute("e2e-1", { skipGate: true });

      // 2) Commit success
      const commitTool = createGatedCommitTool({
        cwd: tempDir,
        exec: commitExec,
      });
      await commitTool.execute("e2e-2", { message: "chore: update" });

      // 3) Test fail (skipGate to simplify)
      const testTool2 = createGatedTestTool({
        cwd: tempDir,
        exec: testExecFail,
        skipTypeCheck: true,
      });
      await testTool2.execute("e2e-3", { skipGate: true });

      // Verify: 3 receipts accumulated in chronological order
      const receipts = readReceipts(tempDir);
      expect(receipts.length).toBe(3);

      expect(receipts[0].operation).toBe("test");
      expect(receipts[0].status).toBe("success");

      expect(receipts[1].operation).toBe("commit");
      expect(receipts[1].status).toBe("success");

      expect(receipts[2].operation).toBe("test");
      expect(receipts[2].status).toBe("failure");

      // Verify timestamps are in non-decreasing order
      for (let i = 1; i < receipts.length; i++) {
        expect(receipts[i].timestamp >= receipts[i - 1].timestamp).toBe(true);
      }
    });
  });

  // ── 5. Schema compliance: every receipt matches the OpsReceipt type ──

  describe("OpsReceipt schema compliance", () => {
    it("every receipt has exactly the expected shape", () => {
      const scenarios: Array<{
        op: string;
        status: "success" | "failure";
        output: string;
        meta?: Record<string, unknown>;
        logPath?: string;
      }> = [
        { op: "test", status: "success", output: "all green" },
        { op: "test", status: "failure", output: "FAIL" },
        { op: "commit", status: "success", output: "committed", meta: { commitHash: "xyz" } },
        { op: "deploy", status: "failure", output: "timeout", logPath: "/var/log/deploy.log" },
      ];

      for (const s of scenarios) {
        logOpsReceipt(
          createOpsReceipt(s.op, s.status, s.output, s.meta, s.logPath),
          undefined,
          tempDir,
        );
      }

      const receipts = readReceipts(tempDir);
      expect(receipts).toHaveLength(scenarios.length);

      for (let i = 0; i < receipts.length; i++) {
        const r = receipts[i];
        const s = scenarios[i];

        // Required fields
        expect(typeof r.operation).toBe("string");
        expect(r.operation).toBe(s.op);
        expect(["success", "failure"]).toContain(r.status);
        expect(r.status).toBe(s.status);
        expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(r.outputHash).toMatch(/^[0-9a-f]{64}$/);

        // Optional fields: present only when provided
        if (s.meta) {
          expect(r.meta).toEqual(s.meta);
        } else {
          expect(r.meta).toBeUndefined();
        }

        if (s.logPath) {
          expect(r.logPath).toBe(s.logPath);
        } else {
          expect(r.logPath).toBeUndefined();
        }
      }
    });
  });
});
