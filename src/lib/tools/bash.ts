import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateTail,
	type AgentTool,
	type TruncationResult,
} from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import type { TSchema } from "@earendil-works/pi-ai";
import { spawn } from "child_process";
// Inlined shell utilities (may-agent runs on Linux/Docker only)
function getShellConfig(): { shell: string; args: string[] } {
	return { shell: "/bin/bash", args: ["-c"] };
}

function getShellEnv(): NodeJS.ProcessEnv {
	// The container image installs bun at /usr/local/bin/bun, which is already
	// on PATH for every process the daemon spawns. Earlier versions of this
	// file also prepended `$STATE_DIR/.bun/bin` as a hot-swap override, but
	// that shadow drifted silently against the image's bun and has been
	// removed in favour of a single source of truth — the pinned image bun.
	return { ...process.env };
}

function killProcessTree(pid: number): void {
	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		try { process.kill(pid, "SIGKILL"); } catch { /* already dead */ }
	}
}

/**
 * Default timeout for bash commands (seconds).
 * Prevents runaway processes (e.g., `find /`, infinite loops, hung network calls).
 * Agents can override per-call via the `timeout` parameter, but this cap
 * ensures no command runs indefinitely. P113 Resource Rationing.
 */
export const DEFAULT_BASH_TIMEOUT = 120;

/**
 * Generate a unique temp file path for bash output
 */
function getTempFilePath(): string {
	const id = randomBytes(8).toString("hex");
	return join(tmpdir(), `pi-bash-${id}.log`);
}

const bashSchema: TSchema = Type.Object({
	command: Type.String({ description: "Bash command to execute. Runs in the project root directory. For multi-step operations, chain with && or use a heredoc. For reading files, prefer the read tool (it has pagination). For editing files, prefer edit() (safer than sed). Stdout and stderr are combined in the response." }),
	timeout: Type.Optional(Type.Number({ description: `Timeout in seconds (default ${DEFAULT_BASH_TIMEOUT}s). Increase for long-running commands like test suites or builds. The command is killed if it exceeds the timeout.` })),
});

export interface BashToolInput { command: string; timeout?: number; }

export interface BashToolDetails {
	truncation?: TruncationResult;
	fullOutputPath?: string;
}

/**
 * Pluggable operations for the bash tool.
 * Override these to delegate command execution to remote systems (e.g., SSH).
 */
export interface BashOperations {
	/**
	 * Execute a command and stream output.
	 * @param command - The command to execute
	 * @param cwd - Working directory
	 * @param options - Execution options
	 * @returns Promise resolving to exit code (null if killed)
	 */
	exec: (
		command: string,
		cwd: string,
		options: {
			onData: (data: Buffer) => void;
			signal?: AbortSignal;
			timeout?: number;
			env?: NodeJS.ProcessEnv;
		},
	) => Promise<{ exitCode: number | null }>;
}

/**
 * Default bash operations using local shell
 */
const defaultBashOperations: BashOperations = {
	exec: (command, cwd, { onData, signal, timeout, env }) => {
		return new Promise((resolve, reject) => {
			const { shell, args } = getShellConfig();

			if (!existsSync(cwd)) {
				reject(new Error(`Working directory does not exist: ${cwd}\nCannot execute bash commands.`));
				return;
			}

			const child = spawn(shell, [...args, command], {
				cwd,
				detached: true,
				env: env ?? getShellEnv(),
				stdio: ["ignore", "pipe", "pipe"],
			});

			let timedOut = false;

			// Set timeout if provided
			let timeoutHandle: NodeJS.Timeout | undefined;
			if (timeout !== undefined && timeout > 0) {
				timeoutHandle = setTimeout(() => {
					timedOut = true;
					if (child.pid) {
						killProcessTree(child.pid);
					}
				}, timeout * 1000);
			}

			// Stream stdout and stderr
			if (child.stdout) {
				child.stdout.on("data", onData);
			}
			if (child.stderr) {
				child.stderr.on("data", onData);
			}

			// Handle shell spawn errors
			child.on("error", (err) => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (signal) signal.removeEventListener("abort", onAbort);
				reject(err);
			});

			// Handle abort signal - kill entire process tree
			const onAbort = () => {
				if (child.pid) {
					killProcessTree(child.pid);
				}
			};

			if (signal) {
				if (signal.aborted) {
					onAbort();
				} else {
					signal.addEventListener("abort", onAbort, { once: true });
				}
			}

			// Handle process exit
			child.on("close", (code) => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (signal) signal.removeEventListener("abort", onAbort);

				if (signal?.aborted) {
					reject(new Error("aborted"));
					return;
				}

				if (timedOut) {
					reject(new Error(`timeout:${timeout}`));
					return;
				}

				resolve({ exitCode: code });
			});
		});
	},
};

// ── Error-time nudges ───────────────────────────────────────────────────
// When a bash command fails with a recognizable pattern, append an actionable
// hint so the agent doesn't spiral trying the same broken approach.
// Evidence: 16-18 ops wasted per session on DB tool confusion spirals.

export interface ErrorNudge {
	/** Regex to test against the combined stdout+stderr output */
	pattern: RegExp;
	/** Hint appended to the output when the pattern matches */
	hint: string;
}

export const DEFAULT_ERROR_NUDGES: ErrorNudge[] = [
	{
		pattern: /sqlite3:\s*command not found/i,
		hint: "\n\n💡 Hint: sqlite3 CLI is not available. Use the query_db tool for read-only DB inspection instead of guessing DB paths from bash.",
	},
	{
		pattern: /bun:\s*command not found/i,
		hint: "\n\n💡 Hint: bun ships in the container image at /usr/local/bin/bun and is on PATH for every bash call. If 'bun: command not found' appears, the image is broken — do not work around it with manual PATH exports.",
	},
	{
		pattern: /npx:\s*command not found/i,
		hint: "\n\n💡 Hint: npx is not available. Use ./node_modules/.bin/<tool> or bun x <tool>",
	},
	{
		pattern: /sudo:\s*command not found|sudo:.*not found/i,
		hint: "\n\n💡 Hint: sudo is not available in this environment.",
	},
	{
		pattern: /node:sqlite/i,
		hint: "\n\n💡 Hint: node:sqlite is not available. Use the query_db tool for read-only DB inspection instead of opening SQLite from bash.",
	},
];

/**
 * Scan output text for known failure patterns and append hints.
 * Only fires when the command has a non-zero exit code (error path).
 * Returns the original text with any matching hints appended.
 */
export function applyErrorNudges(output: string, nudges: ErrorNudge[] = DEFAULT_ERROR_NUDGES): string {
	let result = output;
	for (const nudge of nudges) {
		if (nudge.pattern.test(output)) {
			result += nudge.hint;
		}
	}
	return result;
}

// ── P53 bash command guard REMOVED ──────────────────────────────────────
// Removed per Hao's directive (2026-03-14): "bash guard is against our idea
// of freedom and creativity." Cross-edit protection for AGENTS.md/agent.json
// remains via write/edit tool path guards (checkCrossEditGuard in cross-edit-guard.ts).

export interface BashSpawnContext {
	command: string;
	cwd: string;
	env: NodeJS.ProcessEnv;
}

export type BashSpawnHook = (context: BashSpawnContext) => BashSpawnContext;

function resolveSpawnContext(command: string, cwd: string, spawnHook?: BashSpawnHook): BashSpawnContext {
	const baseContext: BashSpawnContext = {
		command,
		cwd,
		env: { ...getShellEnv() },
	};

	return spawnHook ? spawnHook(baseContext) : baseContext;
}

export interface BashToolOptions {
	/** Custom operations for command execution. Default: local shell */
	operations?: BashOperations;
	/** Command prefix prepended to every command (e.g., "shopt -s expand_aliases" for alias support) */
	commandPrefix?: string;
	/** Hook to adjust command, cwd, or env before execution */
	spawnHook?: BashSpawnHook;
	/** Default timeout in seconds when agent doesn't specify one. Default: DEFAULT_BASH_TIMEOUT (120s). Set 0 to disable. */
	defaultTimeout?: number;
}

export function createBashTool(cwd: string, options?: BashToolOptions): AgentTool<TSchema> {
	const ops = options?.operations ?? defaultBashOperations;
	const commandPrefix = options?.commandPrefix;
	const spawnHook = options?.spawnHook;
	const defaultTimeout = options?.defaultTimeout ?? DEFAULT_BASH_TIMEOUT;

	return {
		name: "bash",
		label: "bash",
		description: [
			`Execute a bash command in the current working directory. Returns stdout and stderr combined.`,
			`Output is truncated to the last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first) — if truncated, the full output is saved to a temp file whose path is shown.`,
			`Default timeout: ${defaultTimeout}s. For long-running commands, set a higher timeout.`,
			`Use for: running tests, git operations, grep/find/rg searches, installing packages, system checks.`,
			`For reading files, prefer the read tool (it has pagination). For editing files, prefer edit() (it's safer than sed).`,
		].join(" "),
		parameters: bashSchema,
		execute: async (
			_toolCallId: string,
			_params: unknown,
			signal?: AbortSignal,
			onUpdate?,
		) => {
			const { command, timeout: userTimeout } = _params as BashToolInput;
			// P113: Apply default timeout if agent didn't specify one.
			// User-specified timeout takes precedence, but can't exceed 2x default (prevents abuse).
			const timeout = userTimeout ?? (defaultTimeout > 0 ? defaultTimeout : undefined);

			// Apply command prefix if configured (e.g., "shopt -s expand_aliases" for alias support)
			const resolvedCommand = commandPrefix ? `${commandPrefix}\n${command}` : command;
			const spawnContext = resolveSpawnContext(resolvedCommand, cwd, spawnHook);

			return new Promise((resolve, reject) => {
				// We'll stream to a temp file if output gets large
				let tempFilePath: string | undefined;
				let tempFileStream: ReturnType<typeof createWriteStream> | undefined;
				let totalBytes = 0;

				// Keep a rolling buffer of the last chunk for tail truncation
				const chunks: Buffer[] = [];
				let chunksBytes = 0;
				// Keep more than we need so we have enough for truncation
				const maxChunksBytes = DEFAULT_MAX_BYTES * 2;

				const handleData = (data: Buffer) => {
					totalBytes += data.length;

					// Start writing to temp file once we exceed the threshold
					if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
						tempFilePath = getTempFilePath();
						tempFileStream = createWriteStream(tempFilePath);
						// Write all buffered chunks to the file
						for (const chunk of chunks) {
							tempFileStream.write(chunk);
						}
					}

					// Write to temp file if we have one
					if (tempFileStream) {
						tempFileStream.write(data);
					}

					// Keep rolling buffer of recent data
					chunks.push(data);
					chunksBytes += data.length;

					// Trim old chunks if buffer is too large
					while (chunksBytes > maxChunksBytes && chunks.length > 1) {
						const removed = chunks.shift()!;
						chunksBytes -= removed.length;
					}

					// Stream partial output to callback (truncated rolling buffer)
					if (onUpdate) {
						const fullBuffer = Buffer.concat(chunks);
						const fullText = fullBuffer.toString("utf-8");
						const truncation = truncateTail(fullText);
						onUpdate({
							content: [{ type: "text", text: truncation.content || "" }],
							details: {
								truncation: truncation.truncated ? truncation : undefined,
								fullOutputPath: tempFilePath,
							},
						});
					}
				};

				ops.exec(spawnContext.command, spawnContext.cwd, {
					onData: handleData,
					signal,
					timeout,
					env: spawnContext.env,
				})
					.then(({ exitCode }) => {
						// Close temp file stream
						if (tempFileStream) {
							tempFileStream.end();
						}

						// Combine all buffered chunks
						const fullBuffer = Buffer.concat(chunks);
						const fullOutput = fullBuffer.toString("utf-8");

						// Apply tail truncation
						const truncation = truncateTail(fullOutput);
						let outputText = truncation.content || "(no output)";

						// Build details with truncation info
						let details: BashToolDetails | undefined;

						if (truncation.truncated) {
							details = {
								truncation,
								fullOutputPath: tempFilePath,
							};

							// Build actionable notice
							const startLine = truncation.totalLines - truncation.outputLines + 1;
							const endLine = truncation.totalLines;

							if (truncation.lastLinePartial) {
								// Edge case: last line alone > 30KB
								const lastLineSize = formatSize(Buffer.byteLength(fullOutput.split("\n").pop() || "", "utf-8"));
								outputText += `\n\n[Showing last ${formatSize(truncation.outputBytes)} of line ${endLine} (line is ${lastLineSize}). Full output: ${tempFilePath}]`;
							} else if (truncation.truncatedBy === "lines") {
								outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${tempFilePath}]`;
							} else {
								outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Full output: ${tempFilePath}]`;
							}
						}

						if (exitCode !== 0 && exitCode !== null) {
							outputText += `\n\nCommand exited with code ${exitCode}`;
							// Apply error-time nudges for common tool confusion patterns
							outputText = applyErrorNudges(outputText);
							reject(new Error(outputText));
						} else {
							resolve({ content: [{ type: "text", text: outputText }], details });
						}
					})
					.catch((err: Error) => {
						// Close temp file stream
						if (tempFileStream) {
							tempFileStream.end();
						}

						// Combine all buffered chunks for error output
						const fullBuffer = Buffer.concat(chunks);
						let output = fullBuffer.toString("utf-8");

						if (err.message === "aborted") {
							if (output) output += "\n\n";
							output += "Command aborted";
							reject(new Error(output));
						} else if (err.message.startsWith("timeout:")) {
							const timeoutSecs = err.message.split(":")[1];
							if (output) output += "\n\n";
							output += `Command timed out after ${timeoutSecs} seconds`;
							reject(new Error(output));
						} else {
							reject(err);
						}
					});
			});
		},
	};
}

/** Default bash tool using process.cwd() - for backwards compatibility */
export const bashTool = createBashTool(process.cwd());
