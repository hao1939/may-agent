/**
 * gated-commit.ts — A "commit" tool that runs gate checks before `git commit`.
 *
 * Wraps `git commit` behind an ops-gate.  By default the gate requires:
 *   1. TypeScript compiles (`tsc --noEmit`)
 *   2. Test suite passes (`npm test` or configured command)
 *   3. Working tree is clean (no unstaged changes — forces explicit `git add`)
 *
 * If any check fails the commit is blocked and the agent gets a clear
 * explanation of what to fix.
 *
 * When the gate passes the tool runs `git commit -m "<message>"` and
 * returns the commit output.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import {
	evaluateGate,
	typescriptCheck,
	testSuiteCheck,
	cleanWorkingTreeCheck,
	createOpsReceipt,
	logOpsReceipt,
	type GateCheck,
	type OpsReceipt,
} from "../ops-gate.js";

// ── Schema ─────────────────────────────────────────────────────────────

const gatedCommitSchema: TSchema = Type.Object({
	message: Type.String({
		description: "Git commit message. Follow conventional-commits style when appropriate.",
	}),
	skipGate: Type.Optional(
		Type.Boolean({
			description:
				"Set to true to skip all pre-flight checks and commit directly. " +
				"Use only when you are absolutely certain (e.g. docs-only change).",
		}),
	),
});

export interface GatedCommitInput {
	message: string;
	skipGate?: boolean;
}

// ── Exec abstraction ───────────────────────────────────────────────────

export type ExecFn = (
	cmd: string,
	cwd: string,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

// ── Tool options ───────────────────────────────────────────────────────

export interface GatedCommitToolOptions {
	/** Working directory / repo root. */
	cwd: string;
	/** Test command used in the test-suite gate check. Default: `npm test`. */
	testCommand?: string;
	/** Additional gate checks beyond the built-in ones. */
	extraChecks?: GateCheck[];
	/** If true, skip the built-in TypeScript check. */
	skipTypeCheck?: boolean;
	/** If true, skip the built-in test-suite check. */
	skipTestCheck?: boolean;
	/** If true, skip the clean-working-tree check. */
	skipCleanCheck?: boolean;
	/** Injected command runner. */
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

export function createGatedCommitTool(options: GatedCommitToolOptions): AgentTool<TSchema> {
	const {
		cwd,
		testCommand = "npm test",
		extraChecks = [],
		skipTypeCheck = false,
		skipTestCheck = false,
		skipCleanCheck = false,
		exec = defaultExec,
	} = options;

	// Build the static check list once at creation time.
	const gateChecks: GateCheck[] = [];
	if (!skipCleanCheck) {
		// Run the cheap check first (ordering matters for readability, not perf — they run concurrently).
		gateChecks.push(cleanWorkingTreeCheck(cwd, exec));
	}
	if (!skipTypeCheck) {
		gateChecks.push(typescriptCheck(cwd, exec));
	}
	if (!skipTestCheck) {
		gateChecks.push(testSuiteCheck(cwd, exec, testCommand));
	}
	gateChecks.push(...extraChecks);

	return {
		name: "commit",
		label: "commit (gated)",
		description:
			"Create a git commit. Before committing, pre-flight checks are evaluated:\n" +
			"  1. No unstaged changes (you must `git add` explicitly)\n" +
			"  2. TypeScript compiles cleanly\n" +
			"  3. Test suite passes\n" +
			"If any check fails the commit is blocked with actionable feedback. " +
			"Pass `skipGate: true` to bypass (use sparingly).",
		parameters: gatedCommitSchema,
		execute: async (
			_toolCallId: string,
			_params: unknown,
			signal?: AbortSignal,
		) => {
			const { message, skipGate } = _params as GatedCommitInput;

			if (!message || message.trim().length === 0) {
				const receipt = createOpsReceipt("commit", "failure", "Commit message is required.");
				logOpsReceipt(receipt, undefined, cwd);
				return {
					content: [{ type: "text" as const, text: "❌ Commit message is required." }],
					details: receipt,
				};
			}

			// ── 1. Gate ────────────────────────────────────────────────
			if (!skipGate && gateChecks.length > 0) {
				const gate = await evaluateGate(gateChecks);
				if (!gate.passed) {
					const gateOutput = gate.summary;
					const receipt = createOpsReceipt("commit", "failure", gateOutput, {
						gateBlocked: true,
					});
					logOpsReceipt(receipt, undefined, cwd);
					return {
						content: [
							{
								type: "text" as const,
								text:
									`🚫 Pre-flight gate failed — commit blocked.\n\n` +
									`${gate.summary}\n\n` +
									`Fix the issues above, then \`git add\` and retry.`,
							},
						],
						details: receipt,
					};
				}
			}

			// ── 2. Commit ──────────────────────────────────────────────
			if (signal?.aborted) {
				throw new Error("Operation aborted");
			}

			// Escape single quotes in the commit message for safe shell interpolation.
			const escaped = message.replace(/'/g, "'\\''");
			const { stdout, stderr, exitCode } = await exec(`git commit -m '${escaped}'`, cwd);
			const output = (stdout + "\n" + stderr).trim();

			if (exitCode === 0) {
				const commitMeta = parseCommitMeta(output);
				const receipt = createOpsReceipt("commit", "success", output, commitMeta);
				logOpsReceipt(receipt, undefined, cwd);
				return {
					content: [{ type: "text" as const, text: `✅ Committed successfully.\n\n${output}` }],
					details: receipt,
				};
			}

			const receipt = createOpsReceipt("commit", "failure", output, { exitCode });
			logOpsReceipt(receipt, undefined, cwd);
			return {
				content: [
					{
						type: "text" as const,
						text: `❌ git commit failed (exit ${exitCode}).\n\n${output}`,
					},
				],
				details: receipt,
			};
		},
	};
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Best-effort extraction of commit metadata from `git commit` output.
 * Parses the short hash from lines like `[main abc1234] fix: stuff`
 * and file-change counts from `2 files changed, 10 insertions(+)`.
 */
function parseCommitMeta(output: string): Record<string, unknown> {
	const meta: Record<string, unknown> = {};

	// Match "[branch hash] message"
	const hashMatch = output.match(/\[[\w/.-]+\s+([0-9a-f]+)\]/i);
	if (hashMatch) meta.commitHash = hashMatch[1];

	// Match "N file(s) changed"
	const filesMatch = output.match(/(\d+)\s+files?\s+changed/i);
	if (filesMatch) meta.filesChanged = parseInt(filesMatch[1], 10);

	return meta;
}
