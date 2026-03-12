/**
 * ops-gate.ts — Lightweight pre-condition gate for destructive operations.
 *
 * Before a gated tool (test, commit, deploy, …) runs, it evaluates a list
 * of `GateCheck` predicates.  Each check is a pure async function that
 * returns either `{ pass: true }` or `{ pass: false, reason: string }`.
 *
 * If *any* check fails the gate returns early with a human-readable
 * explanation so the agent can self-correct instead of pushing broken work.
 *
 * Design goals:
 *   • Zero coupling to the tools themselves — a gate is just data.
 *   • Composable — callers pick which checks to wire in.
 *   • Deterministic & testable — every check is a pure function on
 *     injected inputs (no singletons, no global state).
 */

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

/** Result of a single gate check. */
export type GateCheckResult =
	| { pass: true }
	| { pass: false; reason: string };

/**
 * A named predicate evaluated before a destructive operation.
 *
 * `name`    — short label used in logs / error output (e.g. "typescript").
 * `check`   — async function that inspects the environment and returns
 *             pass / fail.  Must not have side-effects.
 */
export interface GateCheck {
	name: string;
	check: () => Promise<GateCheckResult>;
}

/** Aggregate result of running all gate checks. */
export interface GateResult {
	/** True only if every check passed. */
	passed: boolean;
	/** Individual results keyed by check name. */
	checks: Record<string, GateCheckResult>;
	/** Pre-formatted summary suitable for returning directly to the agent. */
	summary: string;
}

// ── Evidence Receipt ───────────────────────────────────────────────────

/**
 * Structured receipt returned in a tool's `details` field after a gated
 * operation completes (or is blocked).  Consumers (e.g. Evaluator) can
 * inspect `status` and `outputHash` instead of parsing natural-language
 * `content`.
 */
export interface OpsReceipt {
	/** Which operation was attempted: "test", "commit", etc. */
	operation: string;
	/** Whether the operation succeeded end-to-end. */
	status: "success" | "failure";
	/** ISO-8601 timestamp of when the receipt was created. */
	timestamp: string;
	/** SHA-256 hex digest of the combined stdout+stderr output. */
	outputHash: string;
	/** Optional path to a persistent log file. */
	logPath?: string;
	/** Operation-specific metadata (e.g. commitHash, testCount). */
	meta?: Record<string, unknown>;
}

/**
 * Create an `OpsReceipt` from the operation result.
 *
 * @param operation - short label ("test", "commit", …)
 * @param status    - "success" | "failure"
 * @param output    - raw stdout+stderr string to hash
 * @param meta      - optional operation-specific metadata
 * @param logPath   - optional path to a persistent log file
 */
export function createOpsReceipt(
	operation: string,
	status: "success" | "failure",
	output: string,
	meta?: Record<string, unknown>,
	logPath?: string,
): OpsReceipt {
	return {
		operation,
		status,
		timestamp: new Date().toISOString(),
		outputHash: createHash("sha256").update(output).digest("hex"),
		...(logPath != null ? { logPath } : {}),
		...(meta != null ? { meta } : {}),
	};
}

// ── Receipt logging ────────────────────────────────────────────────────

/** Default path for the ops-receipts audit log, relative to cwd. */
export const OPS_RECEIPTS_PATH = ".state/ops-receipts.jsonl";

/**
 * Append an `OpsReceipt` as a single JSON line to the audit log.
 *
 * This creates a permanent, append-only record that the Evaluator (or any
 * downstream consumer) can read without parsing natural-language output.
 *
 * The function is intentionally **fire-and-forget** — a logging failure
 * must never break the tool itself.  Errors are swallowed and printed to
 * stderr so they surface in process logs but don't propagate.
 *
 * @param receipt  - The `OpsReceipt` to persist.
 * @param logFile  - Absolute or relative path to the JSONL file.
 *                   Defaults to `OPS_RECEIPTS_PATH` resolved from `cwd`.
 * @param cwd      - Working directory used to resolve a relative `logFile`.
 *                   Defaults to `process.cwd()`.
 */
export function logOpsReceipt(
	receipt: OpsReceipt,
	logFile?: string,
	cwd?: string,
): void {
	try {
		const base = cwd ?? process.cwd();
		const dest = resolve(base, logFile ?? OPS_RECEIPTS_PATH);
		mkdirSync(dirname(dest), { recursive: true });
		appendFileSync(dest, JSON.stringify(receipt) + "\n", "utf-8");
	} catch (err) {
		// Logging must never break the tool.
		console.error("[ops-gate] Failed to log receipt:", err);
	}
}

// ── Core gate logic ────────────────────────────────────────────────────

/**
 * Run all `checks` concurrently and return an aggregate result.
 *
 * The gate **passes** only when every individual check passes.
 * On failure the `summary` field contains a bullet list of what went
 * wrong so the agent has enough context to fix the issue.
 */
export async function evaluateGate(checks: GateCheck[]): Promise<GateResult> {
	if (checks.length === 0) {
		return { passed: true, checks: {}, summary: "✅ Gate passed (no checks configured)." };
	}

	// Run all checks concurrently — they are side-effect-free.
	const settled = await Promise.allSettled(
		checks.map(async (c) => ({ name: c.name, result: await c.check() })),
	);

	const results: Record<string, GateCheckResult> = {};
	const failures: string[] = [];

	for (const entry of settled) {
		if (entry.status === "fulfilled") {
			const { name, result } = entry.value;
			results[name] = result;
			if (!result.pass) {
				failures.push(`• **${name}**: ${result.reason}`);
			}
		} else {
			// If a check itself throws, treat it as a failure with the error message.
			// We can't recover the name from a rejected promise, so use a generic label.
			const reason = entry.reason instanceof Error ? entry.reason.message : String(entry.reason);
			const label = `check-error`;
			results[label] = { pass: false, reason };
			failures.push(`• **${label}**: ${reason}`);
		}
	}

	const passed = failures.length === 0;
	const summary = passed
		? `✅ Gate passed — all ${checks.length} check(s) green.`
		: `🚫 Gate blocked — ${failures.length} of ${checks.length} check(s) failed:\n${failures.join("\n")}`;

	return { passed, checks: results, summary };
}

// ── Reusable check factories ───────────────────────────────────────────

/**
 * Creates a gate check that runs `tsc --noEmit` in the given directory.
 *
 * @param cwd     — project root (must contain tsconfig.json or equivalent)
 * @param exec    — injected command runner (same shape as child_process.exec
 *                  returning `{ stdout, stderr, exitCode }`) so tests can stub it.
 */
export function typescriptCheck(
	cwd: string,
	exec: (cmd: string, cwd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
): GateCheck {
	return {
		name: "typescript",
		check: async () => {
			const { stderr, exitCode } = await exec("npx tsc --noEmit 2>&1", cwd);
			if (exitCode === 0) return { pass: true };
			// Trim to first 800 chars to keep error messages agent-friendly.
			const trimmed = stderr.slice(0, 800) || "(no stderr — check stdout for errors)";
			return { pass: false, reason: `tsc --noEmit failed (exit ${exitCode}):\n${trimmed}` };
		},
	};
}

/**
 * Creates a gate check that runs a test command (e.g. `npm test`).
 *
 * @param cwd      — project root
 * @param command  — test command to run (default: `npm test`)
 * @param exec     — injected command runner (same as typescriptCheck)
 */
export function testSuiteCheck(
	cwd: string,
	exec: (cmd: string, cwd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
	command = "npm test",
): GateCheck {
	return {
		name: "test-suite",
		check: async () => {
			const { stdout, stderr, exitCode } = await exec(command, cwd);
			if (exitCode === 0) return { pass: true };
			const output = (stderr || stdout).slice(0, 800);
			return { pass: false, reason: `\`${command}\` failed (exit ${exitCode}):\n${output}` };
		},
	};
}

/**
 * Creates a gate check that ensures no unstaged changes exist.
 * Useful before committing — forces the agent to explicitly `git add` first.
 *
 * @param cwd  — repo root
 * @param exec — injected command runner
 */
export function cleanWorkingTreeCheck(
	cwd: string,
	exec: (cmd: string, cwd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
): GateCheck {
	return {
		name: "clean-working-tree",
		check: async () => {
			const { stdout, exitCode } = await exec("git diff --name-only", cwd);
			if (exitCode !== 0) {
				return { pass: false, reason: "Could not run `git diff` — is this a git repo?" };
			}
			const dirty = stdout.trim();
			if (dirty.length === 0) return { pass: true };
			const files = dirty.split("\n").slice(0, 10).join(", ");
			return {
				pass: false,
				reason: `Unstaged changes detected: ${files}. Stage them with \`git add\` first.`,
			};
		},
	};
}

/**
 * Creates a gate check from a simple boolean predicate.
 * Convenience helper for one-off checks.
 */
export function customCheck(
	name: string,
	predicate: () => Promise<{ ok: boolean; reason?: string }>,
): GateCheck {
	return {
		name,
		check: async () => {
			const { ok, reason } = await predicate();
			return ok ? { pass: true } : { pass: false, reason: reason ?? `${name} check failed` };
		},
	};
}
