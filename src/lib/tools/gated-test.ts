/**
 * gated-test.ts — A "test" tool that runs gate checks before executing tests.
 *
 * Wraps a configurable test command behind an ops-gate.  If the gate fails
 * (e.g. TypeScript errors), the tool returns the failure summary *without*
 * running the potentially slow test suite, giving the agent fast feedback.
 *
 * When the gate passes, the test command is executed and its output is
 * returned as-is.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import {
	evaluateGate,
	typescriptCheck,
	createOpsReceipt,
	logOpsReceipt,
	type GateCheck,
	type OpsReceipt,
} from "../ops-gate.js";

// ── Schema ─────────────────────────────────────────────────────────────

const gatedTestSchema: TSchema = Type.Object({
	command: Type.Optional(
		Type.String({
			description:
				"Test command to run (default: the command configured at tool creation, or `npm test`). " +
				"Override to run a subset, e.g. `npx vitest run src/lib/foo.test.ts`.",
		}),
	),
	skipGate: Type.Optional(
		Type.Boolean({
			description:
				"Set to true to skip pre-flight checks and run the test command directly. " +
				"Use sparingly — the gate exists to save time.",
		}),
	),
});

export interface GatedTestInput {
	command?: string;
	skipGate?: boolean;
}

// ── Exec abstraction (injectable for testing) ──────────────────────────

export type ExecFn = (
	cmd: string,
	cwd: string,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

// ── Tool options ───────────────────────────────────────────────────────

export interface GatedTestToolOptions {
	/** Working directory / project root. */
	cwd: string;
	/** Default test command when the agent doesn't supply one. */
	defaultCommand?: string;
	/** Additional gate checks beyond the built-in TypeScript check. */
	extraChecks?: GateCheck[];
	/** If true, skip the built-in TypeScript check (e.g. for non-TS projects). */
	skipTypeCheck?: boolean;
	/** Injected command runner — defaults to child_process based runner. */
	exec?: ExecFn;
}

// ── Default exec implementation ────────────────────────────────────────

import { exec as cpExec } from "node:child_process";

const defaultExec: ExecFn = (cmd, cwd) =>
	new Promise((resolve) => {
		cpExec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
			resolve({
				stdout: stdout ?? "",
				stderr: stderr ?? "",
				exitCode: err && "code" in err ? (err as any).code ?? 1 : err ? 1 : 0,
			});
		});
	});

// ── Factory ────────────────────────────────────────────────────────────

export function createGatedTestTool(options: GatedTestToolOptions): AgentTool<TSchema> {
	const {
		cwd,
		defaultCommand = "npm test",
		extraChecks = [],
		skipTypeCheck = false,
		exec = defaultExec,
	} = options;

	// Build the static check list once at creation time.
	const gateChecks: GateCheck[] = [];
	if (!skipTypeCheck) {
		gateChecks.push(typescriptCheck(cwd, exec));
	}
	gateChecks.push(...extraChecks);

	return {
		name: "test",
		label: "test (gated)",
		description:
			"Run the project test suite. Before executing tests, pre-flight checks " +
			"(TypeScript compilation, etc.) are evaluated. If any check fails the " +
			"test run is skipped and you receive immediate feedback to fix the issue. " +
			"Pass `skipGate: true` to bypass pre-flight checks.",
		parameters: gatedTestSchema,
		execute: async (
			_toolCallId: string,
			_params: unknown,
			signal?: AbortSignal,
		) => {
			const { command, skipGate } = (_params ?? {}) as GatedTestInput;
			const testCmd = command ?? defaultCommand;

			// ── 1. Gate ────────────────────────────────────────────────
			if (!skipGate && gateChecks.length > 0) {
				const gate = await evaluateGate(gateChecks);
				if (!gate.passed) {
					const gateOutput = gate.summary;
					const receipt = createOpsReceipt("test", "failure", gateOutput, {
						gateBlocked: true,
					});
					logOpsReceipt(receipt, undefined, cwd);
					return {
						content: [
							{
								type: "text" as const,
								text:
									`🚫 Pre-flight gate failed — test run skipped.\n\n` +
									`${gate.summary}\n\n` +
									`Fix the issues above and retry. Use \`skipGate: true\` only if you're certain the gate is wrong.`,
							},
						],
						details: receipt,
					};
				}
			}

			// ── 2. Run tests ───────────────────────────────────────────
			if (signal?.aborted) {
				throw new Error("Operation aborted");
			}

			const { stdout, stderr, exitCode } = await exec(testCmd, cwd);
			const output = (stdout + "\n" + stderr).trim();
			const truncated = output.length > 8000 ? output.slice(-8000) + "\n…(truncated)" : output;

			// Parse test counts from output (best-effort).
			const testMeta = parseTestMeta(output);

			if (exitCode === 0) {
				const receipt = createOpsReceipt("test", "success", output, testMeta);
				logOpsReceipt(receipt, undefined, cwd);
				return {
					content: [{ type: "text" as const, text: `✅ Tests passed.\n\n${truncated}` }],
					details: receipt,
				};
			}

			const receipt = createOpsReceipt("test", "failure", output, {
				...testMeta,
				exitCode,
			});
			logOpsReceipt(receipt, undefined, cwd);
			return {
				content: [
					{
						type: "text" as const,
						text: `❌ Tests failed (exit ${exitCode}).\n\n${truncated}`,
					},
				],
				details: receipt,
			};
		},
	};
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Best-effort extraction of test counts from common test runner output.
 * Handles vitest ("Tests  3 passed | 1 failed") and jest ("Tests: 3 passed, 1 failed, 4 total").
 * Returns an empty object if nothing is detected.
 */
function parseTestMeta(output: string): Record<string, unknown> {
	const meta: Record<string, unknown> = {};

	// vitest style: "Tests  3 passed | 1 failed"  or  "Tests  3 passed"
	// jest style:   "Tests:       3 passed, 1 failed, 4 total"
	const passedMatch = output.match(/(\d+)\s+passed/i);
	const failedMatch = output.match(/(\d+)\s+failed/i);
	const totalMatch = output.match(/(\d+)\s+total/i);

	if (passedMatch) meta.passed = parseInt(passedMatch[1], 10);
	if (failedMatch) meta.failed = parseInt(failedMatch[1], 10);

	if (totalMatch) {
		meta.totalTests = parseInt(totalMatch[1], 10);
	} else if (passedMatch || failedMatch) {
		meta.totalTests = ((meta.passed as number) ?? 0) + ((meta.failed as number) ?? 0);
	}

	return meta;
}
