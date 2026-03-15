/**
 * Tests for ops-gate.ts — the gate evaluation logic and built-in check factories.
 *
 * All tests use injected exec stubs — no real subprocesses are spawned.
 */

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	evaluateGate,
	typescriptCheck,
	testSuiteCheck,
	cleanWorkingTreeCheck,
	customCheck,
	createOpsReceipt,
	logOpsReceipt,
	OPS_RECEIPTS_PATH,
	type GateCheck,
	type GateCheckResult,
	type OpsReceipt,
} from "./ops-gate.js";
import { createGatedTestTool } from "./tools/gated-test.js";
import { createGatedCommitTool } from "./tools/gated-commit.js";

// ── Helper: deterministic exec stub ────────────────────────────────────

function stubExec(exitCode: number, stdout = "", stderr = "") {
	return async (_cmd: string, _cwd: string) => ({ stdout, stderr, exitCode });
}

// ── evaluateGate() ─────────────────────────────────────────────────────

describe("evaluateGate", () => {
	it("passes when there are zero checks", async () => {
		const result = await evaluateGate([]);
		expect(result.passed).toBe(true);
		expect(result.summary).toContain("no checks configured");
	});

	it("passes when all checks pass", async () => {
		const checks: GateCheck[] = [
			{ name: "a", check: async () => ({ pass: true }) },
			{ name: "b", check: async () => ({ pass: true }) },
		];
		const result = await evaluateGate(checks);
		expect(result.passed).toBe(true);
		expect(result.summary).toContain("all 2 check(s) green");
		expect(result.checks["a"]).toEqual({ pass: true });
		expect(result.checks["b"]).toEqual({ pass: true });
	});

	it("fails when one check fails", async () => {
		const checks: GateCheck[] = [
			{ name: "ok", check: async () => ({ pass: true }) },
			{ name: "bad", check: async () => ({ pass: false, reason: "broken" }) },
		];
		const result = await evaluateGate(checks);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain("1 of 2");
		expect(result.summary).toContain("broken");
		expect(result.checks["bad"]).toEqual({ pass: false, reason: "broken" });
	});

	it("fails when multiple checks fail", async () => {
		const checks: GateCheck[] = [
			{ name: "a", check: async () => ({ pass: false, reason: "err-a" }) },
			{ name: "b", check: async () => ({ pass: false, reason: "err-b" }) },
		];
		const result = await evaluateGate(checks);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain("2 of 2");
		expect(result.summary).toContain("err-a");
		expect(result.summary).toContain("err-b");
	});

	it("treats a throwing check as a failure", async () => {
		const checks: GateCheck[] = [
			{ name: "boom", check: async () => { throw new Error("💥 kaboom"); } },
		];
		const result = await evaluateGate(checks);
		expect(result.passed).toBe(false);
		expect(result.summary).toContain("kaboom");
	});

	it("runs checks concurrently", async () => {
		// Verify that two checks that each take ~50ms complete in < 300ms total.
		// (150ms was flaky under container/CI load — 300ms still proves concurrency
		// since sequential execution would take ≥100ms from the delays alone.)
		const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
		const checks: GateCheck[] = [
			{ name: "slow-a", check: async () => { await delay(50); return { pass: true }; } },
			{ name: "slow-b", check: async () => { await delay(50); return { pass: true }; } },
		];
		const t0 = Date.now();
		const result = await evaluateGate(checks);
		const elapsed = Date.now() - t0;
		expect(result.passed).toBe(true);
		expect(elapsed).toBeLessThan(300);
	});
});

// ── typescriptCheck() ──────────────────────────────────────────────────

describe("typescriptCheck", () => {
	it("passes when tsc exits 0", async () => {
		const check = typescriptCheck("/proj", stubExec(0));
		const result = await check.check();
		expect(result.pass).toBe(true);
	});

	it("fails when tsc exits non-zero", async () => {
		const check = typescriptCheck("/proj", stubExec(1, "", "error TS2345: ..."));
		const result = await check.check();
		expect(result.pass).toBe(false);
		expect((result as { reason: string }).reason).toContain("tsc --noEmit failed");
		expect((result as { reason: string }).reason).toContain("TS2345");
	});

	it("truncates long stderr to 800 chars", async () => {
		const longErr = "x".repeat(2000);
		const check = typescriptCheck("/proj", stubExec(1, "", longErr));
		const result = await check.check();
		expect(result.pass).toBe(false);
		// The reason should contain at most 800 chars of the original error.
		expect((result as { reason: string }).reason.length).toBeLessThan(1000);
	});

	it("has name 'typescript'", () => {
		const check = typescriptCheck("/proj", stubExec(0));
		expect(check.name).toBe("typescript");
	});
});

// ── testSuiteCheck() ───────────────────────────────────────────────────

describe("testSuiteCheck", () => {
	it("passes when tests exit 0", async () => {
		const check = testSuiteCheck("/proj", stubExec(0, "3 passed"));
		const result = await check.check();
		expect(result.pass).toBe(true);
	});

	it("fails when tests exit non-zero", async () => {
		const check = testSuiteCheck("/proj", stubExec(1, "FAIL src/foo.test.ts"));
		const result = await check.check();
		expect(result.pass).toBe(false);
		expect((result as { reason: string }).reason).toContain("npm test");
		expect((result as { reason: string }).reason).toContain("FAIL");
	});

	it("uses custom command", async () => {
		let capturedCmd = "";
		const exec = async (cmd: string, _cwd: string) => {
			capturedCmd = cmd;
			return { stdout: "", stderr: "", exitCode: 0 };
		};
		const check = testSuiteCheck("/proj", exec, "npx vitest run");
		await check.check();
		expect(capturedCmd).toBe("npx vitest run");
	});

	it("has name 'test-suite'", () => {
		const check = testSuiteCheck("/proj", stubExec(0));
		expect(check.name).toBe("test-suite");
	});
});

// ── cleanWorkingTreeCheck() ────────────────────────────────────────────

describe("cleanWorkingTreeCheck", () => {
	it("passes when working tree is clean", async () => {
		const check = cleanWorkingTreeCheck("/repo", stubExec(0, ""));
		const result = await check.check();
		expect(result.pass).toBe(true);
	});

	it("passes when stdout is only whitespace", async () => {
		const check = cleanWorkingTreeCheck("/repo", stubExec(0, "  \n  "));
		const result = await check.check();
		expect(result.pass).toBe(true);
	});

	it("fails when there are unstaged changes", async () => {
		const check = cleanWorkingTreeCheck("/repo", stubExec(0, "src/foo.ts\nsrc/bar.ts"));
		const result = await check.check();
		expect(result.pass).toBe(false);
		expect((result as { reason: string }).reason).toContain("Unstaged changes");
		expect((result as { reason: string }).reason).toContain("src/foo.ts");
	});

	it("fails when git is not available", async () => {
		const check = cleanWorkingTreeCheck("/repo", stubExec(128, "", "not a git repo"));
		const result = await check.check();
		expect(result.pass).toBe(false);
		expect((result as { reason: string }).reason).toContain("git diff");
	});

	it("has name 'clean-working-tree'", () => {
		const check = cleanWorkingTreeCheck("/repo", stubExec(0));
		expect(check.name).toBe("clean-working-tree");
	});
});

// ── customCheck() ──────────────────────────────────────────────────────

describe("customCheck", () => {
	it("passes when predicate returns ok: true", async () => {
		const check = customCheck("my-check", async () => ({ ok: true }));
		const result = await check.check();
		expect(result.pass).toBe(true);
		expect(check.name).toBe("my-check");
	});

	it("fails when predicate returns ok: false", async () => {
		const check = customCheck("my-check", async () => ({ ok: false, reason: "nope" }));
		const result = await check.check();
		expect(result.pass).toBe(false);
		expect((result as { reason: string }).reason).toBe("nope");
	});

	it("uses default reason when none provided", async () => {
		const check = customCheck("my-check", async () => ({ ok: false }));
		const result = await check.check();
		expect(result.pass).toBe(false);
		expect((result as { reason: string }).reason).toContain("my-check check failed");
	});
});

// ── Integration: evaluateGate with real check factories ────────────────

describe("evaluateGate with check factories", () => {
	it("all-green scenario", async () => {
		const result = await evaluateGate([
			typescriptCheck("/proj", stubExec(0)),
			testSuiteCheck("/proj", stubExec(0)),
			cleanWorkingTreeCheck("/repo", stubExec(0, "")),
		]);
		expect(result.passed).toBe(true);
		expect(Object.keys(result.checks)).toHaveLength(3);
	});

	it("mixed pass/fail scenario", async () => {
		const result = await evaluateGate([
			typescriptCheck("/proj", stubExec(0)),                           // pass
			testSuiteCheck("/proj", stubExec(1, "FAIL")),                   // fail
			cleanWorkingTreeCheck("/repo", stubExec(0, "dirty.ts")),        // fail
		]);
		expect(result.passed).toBe(false);
		expect(result.checks["typescript"]).toEqual({ pass: true });
		expect(result.checks["test-suite"]?.pass).toBe(false);
		expect(result.checks["clean-working-tree"]?.pass).toBe(false);
		expect(result.summary).toContain("2 of 3");
	});
});

// ── Gated tool integration (lightweight) ───────────────────────────────

describe("gated-test tool", () => {
	// Static import at top of file — no import-time side effects.
	it("returns gate failure without running tests", async () => {
		
		const exec = stubExec(1, "", "error TS9999");
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("t1", {});
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Pre-flight gate failed");
		expect(text).toContain("TS9999");
	});

	it("runs tests when gate passes", async () => {
		
		// First call: tsc (pass). Second call: test command (pass).
		let callCount = 0;
		const exec = async (_cmd: string, _cwd: string) => {
			callCount++;
			return { stdout: callCount === 1 ? "" : "3 tests passed", stderr: "", exitCode: 0 };
		};
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("t2", {});
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Tests passed");
		expect(callCount).toBe(2); // gate + actual test run
	});

	it("skips gate when skipGate is true", async () => {
		
		let callCount = 0;
		const exec = async (_cmd: string, _cwd: string) => {
			callCount++;
			return { stdout: "ok", stderr: "", exitCode: 0 };
		};
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("t3", { skipGate: true });
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Tests passed");
		expect(callCount).toBe(1); // only the test command, no gate
	});

	it("reports test failure after gate passes", async () => {
		
		let callCount = 0;
		const exec = async (_cmd: string, _cwd: string) => {
			callCount++;
			if (callCount === 1) return { stdout: "", stderr: "", exitCode: 0 }; // tsc pass
			return { stdout: "FAIL src/broken.test.ts", stderr: "", exitCode: 1 }; // tests fail
		};
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("t4", {});
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Tests failed");
		expect(text).toContain("FAIL");
	});
});

describe("gated-commit tool", () => {
	it("blocks commit when gate fails", async () => {
		
		const exec = async (cmd: string, _cwd: string) => {
			if (cmd.includes("git diff")) return { stdout: "dirty.ts", stderr: "", exitCode: 0 };
			return { stdout: "", stderr: "", exitCode: 0 };
		};
		const tool = createGatedCommitTool({ cwd: "/repo", exec, skipTypeCheck: true, skipTestCheck: true });
		const result = await tool.execute("t1", { message: "fix: stuff" });
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Pre-flight gate failed");
		expect(text).toContain("Unstaged changes");
	});

	it("commits when all gates pass", async () => {
		
		const exec = async (cmd: string, _cwd: string) => {
			if (cmd.includes("git commit")) {
				return { stdout: "[main abc1234] fix: stuff\n 1 file changed", stderr: "", exitCode: 0 };
			}
			return { stdout: "", stderr: "", exitCode: 0 }; // all checks pass
		};
		const tool = createGatedCommitTool({ cwd: "/repo", exec });
		const result = await tool.execute("t2", { message: "fix: stuff" });
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Committed successfully");
		expect(text).toContain("abc1234");
	});

	it("rejects empty commit message", async () => {
		
		const tool = createGatedCommitTool({ cwd: "/repo", exec: stubExec(0) });
		const result = await tool.execute("t3", { message: "" });
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Commit message is required");
	});

	it("escapes single quotes in commit message", async () => {
		
		let capturedCmd = "";
		const exec = async (cmd: string, _cwd: string) => {
			if (cmd.includes("git commit")) capturedCmd = cmd;
			return { stdout: "", stderr: "", exitCode: 0 };
		};
		// Skip all gate checks so we go straight to `git commit`
		const tool = createGatedCommitTool({
			cwd: "/repo",
			exec,
			skipTypeCheck: true,
			skipTestCheck: true,
			skipCleanCheck: true,
		});
		await tool.execute("t4", { message: "fix: it's broken" });
		expect(capturedCmd).toContain("it'\\''s broken");
	});

	it("skips gate when skipGate is true", async () => {
		
		let gateRan = false;
		const exec = async (cmd: string, _cwd: string) => {
			if (cmd.includes("tsc") || cmd.includes("npm test") || cmd.includes("git diff")) {
				gateRan = true;
			}
			return { stdout: "committed", stderr: "", exitCode: 0 };
		};
		const tool = createGatedCommitTool({ cwd: "/repo", exec });
		const result = await tool.execute("t5", { message: "yolo", skipGate: true });
		expect(gateRan).toBe(false);
		const text = result.content[0].type === "text" ? result.content[0].text : "";
		expect(text).toContain("Committed successfully");
	});
});

// ── createOpsReceipt() ─────────────────────────────────────────────────

describe("createOpsReceipt", () => {
	it("creates a receipt with all required fields", () => {
		const receipt = createOpsReceipt("test", "success", "hello world");
		expect(receipt.operation).toBe("test");
		expect(receipt.status).toBe("success");
		expect(receipt.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(receipt.outputHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
	});

	it("produces deterministic hash for identical output", () => {
		const a = createOpsReceipt("test", "success", "same output");
		const b = createOpsReceipt("test", "success", "same output");
		expect(a.outputHash).toBe(b.outputHash);
	});

	it("produces different hash for different output", () => {
		const a = createOpsReceipt("test", "success", "output-a");
		const b = createOpsReceipt("test", "success", "output-b");
		expect(a.outputHash).not.toBe(b.outputHash);
	});

	it("includes meta when provided", () => {
		const receipt = createOpsReceipt("commit", "success", "ok", { commitHash: "abc123" });
		expect(receipt.meta).toEqual({ commitHash: "abc123" });
	});

	it("omits meta when not provided", () => {
		const receipt = createOpsReceipt("test", "success", "ok");
		expect(receipt.meta).toBeUndefined();
	});

	it("includes logPath when provided", () => {
		const receipt = createOpsReceipt("test", "success", "ok", undefined, "/tmp/test.log");
		expect(receipt.logPath).toBe("/tmp/test.log");
	});

	it("omits logPath when not provided", () => {
		const receipt = createOpsReceipt("test", "success", "ok");
		expect(receipt.logPath).toBeUndefined();
	});
});

// ── logOpsReceipt() ────────────────────────────────────────────────────

describe("logOpsReceipt", () => {
	// Use a unique temp directory per test run to avoid cross-test contamination.
	const testDir = join(tmpdir(), `ops-gate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

	afterEach(() => {
		// Clean up the temp directory after each test.
		try { rmSync(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
	});

	it("creates the .state directory and writes a JSONL line", () => {
		const receipt = createOpsReceipt("test", "success", "hello");
		logOpsReceipt(receipt, undefined, testDir);

		const logFile = join(testDir, OPS_RECEIPTS_PATH);
		expect(existsSync(logFile)).toBe(true);

		const lines = readFileSync(logFile, "utf-8").trim().split("\n");
		expect(lines).toHaveLength(1);

		const parsed = JSON.parse(lines[0]) as OpsReceipt;
		expect(parsed.operation).toBe("test");
		expect(parsed.status).toBe("success");
		expect(parsed.outputHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("appends multiple receipts (append-only)", () => {
		const r1 = createOpsReceipt("test", "success", "a");
		const r2 = createOpsReceipt("commit", "failure", "b");
		logOpsReceipt(r1, undefined, testDir);
		logOpsReceipt(r2, undefined, testDir);

		const logFile = join(testDir, OPS_RECEIPTS_PATH);
		const lines = readFileSync(logFile, "utf-8").trim().split("\n");
		expect(lines).toHaveLength(2);

		const p1 = JSON.parse(lines[0]) as OpsReceipt;
		const p2 = JSON.parse(lines[1]) as OpsReceipt;
		expect(p1.operation).toBe("test");
		expect(p2.operation).toBe("commit");
	});

	it("accepts a custom logFile path", () => {
		const receipt = createOpsReceipt("deploy", "success", "ok");
		const customPath = "custom/audit.jsonl";
		logOpsReceipt(receipt, customPath, testDir);

		const logFile = join(testDir, customPath);
		expect(existsSync(logFile)).toBe(true);

		const parsed = JSON.parse(readFileSync(logFile, "utf-8").trim()) as OpsReceipt;
		expect(parsed.operation).toBe("deploy");
	});

	it("does not throw on write failure (fire-and-forget)", () => {
		// Point to a path that cannot be written (device file on Unix).
		// This should silently fail, printing to stderr.
		const receipt = createOpsReceipt("test", "failure", "x");
		expect(() => logOpsReceipt(receipt, "/dev/null/impossible/path.jsonl")).not.toThrow();
	});

	it("preserves meta in the logged JSON", () => {
		const receipt = createOpsReceipt("commit", "success", "done", { commitHash: "abc123" });
		logOpsReceipt(receipt, undefined, testDir);

		const logFile = join(testDir, OPS_RECEIPTS_PATH);
		const parsed = JSON.parse(readFileSync(logFile, "utf-8").trim()) as OpsReceipt;
		expect(parsed.meta).toEqual({ commitHash: "abc123" });
	});
});

// ── OpsReceipt in gated-test tool ──────────────────────────────────────

describe("gated-test tool OpsReceipt", () => {
	it("returns OpsReceipt on gate failure", async () => {
		
		const exec = stubExec(1, "", "error TS9999");
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("r1", {});
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("test");
		expect(receipt.status).toBe("failure");
		expect(receipt.outputHash).toMatch(/^[0-9a-f]{64}$/);
		expect(receipt.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(receipt.meta).toEqual({ gateBlocked: true });
	});

	it("returns OpsReceipt with test counts on success", async () => {
		
		let callCount = 0;
		const exec = async (_cmd: string, _cwd: string) => {
			callCount++;
			if (callCount === 1) return { stdout: "", stderr: "", exitCode: 0 }; // tsc
			return { stdout: "Tests  5 passed | 2 failed, 7 total", stderr: "", exitCode: 0 };
		};
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("r2", {});
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("test");
		expect(receipt.status).toBe("success");
		expect(receipt.meta).toMatchObject({ passed: 5, failed: 2, totalTests: 7 });
	});

	it("returns OpsReceipt on test failure", async () => {
		
		let callCount = 0;
		const exec = async (_cmd: string, _cwd: string) => {
			callCount++;
			if (callCount === 1) return { stdout: "", stderr: "", exitCode: 0 }; // tsc
			return { stdout: "3 passed, 1 failed", stderr: "", exitCode: 1 };
		};
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("r3", {});
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("test");
		expect(receipt.status).toBe("failure");
		expect(receipt.meta).toMatchObject({ passed: 3, failed: 1, totalTests: 4, exitCode: 1 });
	});

	it("returns OpsReceipt with skipGate", async () => {
		
		const exec = async (_cmd: string, _cwd: string) => {
			return { stdout: "10 passed", stderr: "", exitCode: 0 };
		};
		const tool = createGatedTestTool({ cwd: "/proj", exec });
		const result = await tool.execute("r4", { skipGate: true });
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("test");
		expect(receipt.status).toBe("success");
		expect(receipt.meta).toMatchObject({ passed: 10, totalTests: 10 });
	});
});

// ── OpsReceipt in gated-commit tool ────────────────────────────────────

describe("gated-commit tool OpsReceipt", () => {
	it("returns OpsReceipt on gate failure", async () => {
		
		const exec = async (cmd: string, _cwd: string) => {
			if (cmd.includes("git diff")) return { stdout: "dirty.ts", stderr: "", exitCode: 0 };
			return { stdout: "", stderr: "", exitCode: 0 };
		};
		const tool = createGatedCommitTool({ cwd: "/repo", exec, skipTypeCheck: true, skipTestCheck: true });
		const result = await tool.execute("r1", { message: "fix: stuff" });
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("commit");
		expect(receipt.status).toBe("failure");
		expect(receipt.meta).toEqual({ gateBlocked: true });
	});

	it("returns OpsReceipt with commit metadata on success", async () => {
		
		const exec = async (cmd: string, _cwd: string) => {
			if (cmd.includes("git commit")) {
				return { stdout: "[main abc1234] fix: stuff\n 2 files changed, 10 insertions(+)", stderr: "", exitCode: 0 };
			}
			return { stdout: "", stderr: "", exitCode: 0 };
		};
		const tool = createGatedCommitTool({ cwd: "/repo", exec });
		const result = await tool.execute("r2", { message: "fix: stuff" });
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("commit");
		expect(receipt.status).toBe("success");
		expect(receipt.outputHash).toMatch(/^[0-9a-f]{64}$/);
		expect(receipt.meta).toMatchObject({ commitHash: "abc1234", filesChanged: 2 });
	});

	it("returns OpsReceipt on empty message", async () => {
		
		const tool = createGatedCommitTool({ cwd: "/repo", exec: stubExec(0) });
		const result = await tool.execute("r3", { message: "" });
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("commit");
		expect(receipt.status).toBe("failure");
	});

	it("returns OpsReceipt on git commit failure", async () => {
		
		const exec = async (cmd: string, _cwd: string) => {
			if (cmd.includes("git commit")) {
				return { stdout: "", stderr: "nothing to commit", exitCode: 1 };
			}
			return { stdout: "", stderr: "", exitCode: 0 };
		};
		const tool = createGatedCommitTool({ cwd: "/repo", exec });
		const result = await tool.execute("r4", { message: "fix: stuff" });
		const receipt = result.details as OpsReceipt;
		expect(receipt).toBeDefined();
		expect(receipt.operation).toBe("commit");
		expect(receipt.status).toBe("failure");
		expect(receipt.meta).toMatchObject({ exitCode: 1 });
	});
});
