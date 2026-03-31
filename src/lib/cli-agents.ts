/**
 * Dedicated tools for invoking CLI coding agents (claude-code, gemini-cli, codex).
 *
 * These are the master agent's primary way to interact with the codebase.
 * Each tool spawns the CLI binary asynchronously, streams output via the
 * onUpdate callback so the orchestrating agent can observe progress, and
 * returns the full result when the process exits.
 *
 * Key design decisions (inspired by OpenClaw's skill architecture):
 *   - Async spawn, NOT execSync — agent context is not blocked
 *   - Streaming partial output via onUpdate — agent sees progress
 *   - Configurable model — not hardcoded
 *   - Session continuity — --continue/--resume support
 *   - Structured JSON output where supported (--output-format stream-json)
 *   - Generous default timeout (300s) with proper cleanup
 */

import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/pi-agent-core";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

// ── Shared params ──────────────────────────────────────────────────────

const ClaudeCodeParams: TSchema = Type.Object({
  prompt: Type.String({
    description:
      "The task/prompt to send to Claude Code. Be specific: include file paths, constraints, what to change, and what to verify.",
  }),
  timeout: Type.Optional(
    Type.Number({ description: "Timeout in seconds (default: 300). Increase for complex tasks." }),
  ),
  continue_session: Type.Optional(
    Type.Boolean({ description: "Continue the most recent conversation in the current directory." }),
  ),
  resume_session_id: Type.Optional(
    Type.String({ description: "Resume a specific conversation by session ID." }),
  ),
  model: Type.Optional(
    Type.String({ description: "Model override for this invocation (e.g. 'sonnet', 'opus'). Uses tool default if not set." }),
  ),
});

interface ClaudeCodeInput {
  prompt: string;
  timeout?: number;
  continue_session?: boolean;
  resume_session_id?: string;
  model?: string;
}

const GeminiCliParams: TSchema = Type.Object({
  prompt: Type.String({
    description:
      "The task/prompt to send to Gemini CLI. Be specific: include file paths, constraints, what to analyze/change, and what output you expect.",
  }),
  timeout: Type.Optional(
    Type.Number({ description: "Timeout in seconds (default: 300). Increase for complex tasks." }),
  ),
  resume_session: Type.Optional(
    Type.String({ description: "Resume a previous session. Use 'latest' for most recent or an index number." }),
  ),
  model: Type.Optional(
    Type.String({ description: "Model override for this invocation. Uses tool default if not set." }),
  ),
});

interface GeminiCliInput {
  prompt: string;
  timeout?: number;
  resume_session?: string;
  model?: string;
}

const CodexParams: TSchema = Type.Object({
  prompt: Type.String({
    description:
      "The task/prompt to send to Codex. Be specific: include file paths, constraints, what to change, and what to verify.",
  }),
  timeout: Type.Optional(
    Type.Number({ description: "Timeout in seconds (default: 300). Increase for complex tasks." }),
  ),
  reasoning_effort: Type.Optional(
    Type.String({ description: "Reasoning effort: 'low', 'medium', 'high'. Default: 'high'." }),
  ),
  model: Type.Optional(
    Type.String({ description: "Model override (e.g. 'gpt-5.1-codex-max'). Uses tool default if not set." }),
  ),
});

interface CodexInput {
  prompt: string;
  timeout?: number;
  reasoning_effort?: string;
  model?: string;
}

// ── Options ────────────────────────────────────────────────────────────

export interface CliAgentToolOptions {
  /** Working directory for the CLI agent process. */
  cwd: string;
  /** Maximum output length before truncation. Default: 80_000. */
  maxOutputLength?: number;
  /** Model to use. */
  model?: string;
}

export interface GeminiCliToolOptions extends CliAgentToolOptions {
  /** API key for the proxy. Default: "dummy". */
  apiKey?: string;
  /** Base URL for the Gemini proxy. Default: "http://localhost:4000". */
  baseUrl?: string;
}

export interface CodexToolOptions extends CliAgentToolOptions {
  // Codex uses OPENAI_API_KEY from env, no extra config needed
}

// ── Output truncation ──────────────────────────────────────────────────

export function truncateOutput(output: string, maxLen: number): string {
  if (maxLen <= 0 || output.length <= maxLen) return output;
  const keepEach = Math.floor(maxLen / 2);
  const head = output.slice(0, keepEach);
  const tail = output.slice(-keepEach);
  const omitted = output.length - keepEach * 2;
  return `${head}\n\n--- TRUNCATED (${omitted} chars omitted) ---\n\n${tail}`;
}

// ── Shared async spawn helper ──────────────────────────────────────────

/** Default timeout for CLI agent invocations (seconds). */
const DEFAULT_TIMEOUT = 300;

/**
 * Resolve extended PATH that includes host node bin directories.
 * CLI agents (claude, codex, gemini) are installed via npm/nvm on the host
 * but the container PATH doesn't include them.
 */
function resolveCliPath(): string {
  const basePath = process.env.PATH ?? "";
  try {
    const { readdirSync, existsSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    // Common nvm installation paths
    const nvmDirs = ["/home/hao/.nvm/versions/node", "/root/.nvm/versions/node"];
    for (const nvmDir of nvmDirs) {
      if (!existsSync(nvmDir)) continue;
      const versions = readdirSync(nvmDir).sort().reverse();
      for (const ver of versions) {
        const binDir = join(nvmDir, ver, "bin");
        if (existsSync(join(binDir, "claude")) || existsSync(join(binDir, "node"))) {
          return `${binDir}:${basePath}`;
        }
      }
    }
  } catch { /* best-effort */ }
  return basePath;
}

const CLI_PATH = resolveCliPath();

/** How often to push partial output updates (ms). */
const UPDATE_INTERVAL_MS = 3000;

interface SpawnResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
}

/**
 * Spawn a CLI agent process asynchronously with streaming output.
 *
 * - Collects stdout+stderr into a single buffer
 * - Periodically calls onUpdate with the latest output so the orchestrating
 *   agent can see progress without waiting for completion
 * - Respects AbortSignal for cancellation
 * - Returns full output when process exits
 */
export function spawnCliAgent(
  command: string,
  args: string[],
  opts: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs: number;
    maxOutput: number;
    signal?: AbortSignal;
    onUpdate?: AgentToolUpdateCallback<any>;
  },
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const { cwd, env, timeoutMs, maxOutput, signal, onUpdate } = opts;

    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd,
        env: env ?? {
          ...process.env,
          PATH: CLI_PATH,
          ANTHROPIC_BASE_URL: process.env.MODEL_BASE_URL ?? process.env.ANTHROPIC_BASE_URL ?? "",
          OPENAI_BASE_URL: (process.env.MODEL_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "") + "/v1",
          OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "dummy",
          GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "dummy",
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reject(new Error(`Failed to spawn ${command}: ${msg}`));
      return;
    }

    let output = "";
    let timedOut = false;
    let exited = false;

    // Collect output
    const appendOutput = (data: Buffer) => {
      output += data.toString();
      // Cap in-memory buffer at 2x maxOutput to prevent OOM
      if (output.length > maxOutput * 2) {
        output = output.slice(-maxOutput * 2);
      }
    };

    child.stdout?.on("data", appendOutput);
    child.stderr?.on("data", appendOutput);

    // Periodic progress updates
    let updateTimer: ReturnType<typeof setInterval> | undefined;
    if (onUpdate) {
      updateTimer = setInterval(() => {
        if (output.length > 0) {
          onUpdate(textResult(truncateOutput(output, maxOutput)));
        }
      }, UPDATE_INTERVAL_MS);
    }

    // Timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
        // Give it 5s to clean up, then SIGKILL
        setTimeout(() => {
          if (!exited) {
            try { child.kill("SIGKILL"); } catch { /* already dead */ }
          }
        }, 5000);
      } catch { /* already dead */ }
    }, timeoutMs);

    // Abort signal
    const onAbort = () => {
      try { child.kill("SIGTERM"); } catch { /* already dead */ }
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    // Cleanup helper
    const cleanup = () => {
      clearTimeout(timeoutHandle);
      if (updateTimer) clearInterval(updateTimer);
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    child.on("error", (err) => {
      exited = true;
      cleanup();
      reject(new Error(`${command} process error: ${err.message}`));
    });

    child.on("close", (code) => {
      exited = true;
      cleanup();

      if (signal?.aborted) {
        reject(new Error(`${command} aborted. Partial output:\n${truncateOutput(output, maxOutput)}`));
        return;
      }

      resolve({ output, exitCode: code, timedOut });
    });
  });
}

// ── Strip ANSI escape codes ────────────────────────────────────────────

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

// ── Claude Code tool ───────────────────────────────────────────────────

export function createClaudeCodeTool(opts: CliAgentToolOptions): AgentTool {
  const maxOutput = opts.maxOutputLength ?? 80_000;
  const defaultModel = opts.model;

  // Build a project-context system prompt (injected into every CLI agent run)
  const systemPrompt = [
    `You are working on the may-agent project at ${opts.cwd}.`,
    `Key facts:`,
    `- Build check: npm run check (runs tsc --noEmit) — run after every code change`,
    `- npx is NOT available — use ./node_modules/.bin/<tool> or bun x <tool>`,
    `- agents/ is a separate git repo (gitignored from main)`,
    `- Tests: vitest via ./node_modules/.bin/vitest`,
    `- Verify every change with npm run check before finishing`,
  ].join("\n");

  // Track the last session ID for automatic continuity
  let lastSessionId: string | undefined;

  return {
    name: "claude_code",
    label: "claude_code",
    description:
      "Run Claude Code to implement code changes. Best for: multi-file changes, debugging, refactoring, writing tests. " +
      "Claude Code has full read/write access to the project and runs with auto-approval. " +
      "Supports session continuity — use continue_session to resume the last conversation " +
      "(keeps full context from previous turns), or resume_session_id for a specific session. " +
      "Multi-turn pattern: first call implements, follow-up calls with continue_session review and fix. " +
      "Each call returns a session_id you can resume later.",
    parameters: ClaudeCodeParams,
    execute: async (_toolCallId: string, _input: unknown, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback<any>) => {
      const input = _input as ClaudeCodeInput;
      const timeoutSecs = input.timeout ?? DEFAULT_TIMEOUT;
      const model = input.model ?? defaultModel;

      // Generate or reuse session ID for continuity
      const sessionId = input.resume_session_id ?? (input.continue_session ? lastSessionId : undefined);
      const isNewSession = !sessionId;
      const effectiveSessionId = sessionId ?? randomUUID();

      const args: string[] = [
        "--print",
        "--dangerously-skip-permissions",
        "--output-format", "text",
      ];

      // Only pass --model if explicitly specified; otherwise Claude Code uses its own config
      if (model) {
        args.push("--model", model);
      }

      // System prompt — project context (only on new sessions, not resume)
      if (isNewSession) {
        args.push("--system-prompt", systemPrompt);
        args.push("--session-id", effectiveSessionId);
      } else {
        args.push("--resume", effectiveSessionId);
      }

      // Prompt goes last as a positional argument
      args.push("-p", input.prompt);

      try {
        const result = await spawnCliAgent("claude", args, {
          cwd: opts.cwd,
          timeoutMs: timeoutSecs * 1000,
          maxOutput,
          signal,
          onUpdate,
        });

        const cleanOutput = stripAnsi(result.output);

        if (result.timedOut) {
          return textResult(
            `TIMEOUT after ${timeoutSecs}s. Partial output:\n${truncateOutput(cleanOutput, maxOutput)}`,
          );
        }

        if (result.exitCode !== 0 && result.exitCode !== null) {
          return textResult(
            `Exit code ${result.exitCode}:\n${truncateOutput(cleanOutput, maxOutput)}`,
          );
        }
        lastSessionId = effectiveSessionId;
        return textResult(truncateOutput(cleanOutput, maxOutput) + `\n\n[session_id: ${effectiveSessionId}]`);
        return textResult(truncateOutput(cleanOutput, maxOutput));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error: ${msg}`);
      }
    },
  };
}

// ── Gemini CLI tool ────────────────────────────────────────────────────

export function createGeminiCliTool(opts: GeminiCliToolOptions): AgentTool {
  const maxOutput = opts.maxOutputLength ?? 80_000;
  const apiKey = opts.apiKey ?? "dummy";
  const baseUrl = opts.baseUrl ?? "http://localhost:4000";
  const defaultModel = opts.model; // undefined = let Gemini CLI use its own default

  return {
    name: "gemini_cli",
    label: "gemini_cli",
    description:
      "Run Gemini CLI for analysis, exploration, or code changes with very large context. " +
      "Best for: codebase analysis, architectural reasoning, large-context tasks. " +
      "Gemini CLI has full read/write access to the project and runs with auto-approval. " +
      "Supports session resumption via resume_session. " +
      "Frame your prompt carefully — include specific file paths, what to analyze/change, and what output you expect.",
    parameters: GeminiCliParams,
    execute: async (_toolCallId: string, _input: unknown, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback<any>) => {
      const input = _input as GeminiCliInput;
      const timeoutSecs = input.timeout ?? DEFAULT_TIMEOUT;
      const model = input.model ?? defaultModel;

      const args: string[] = [
        "--prompt", input.prompt,
        "--yolo",
      ];

      // Only pass --model if explicitly specified
      if (model) {
        args.push("--model", model);
      }

      if (input.resume_session) {
        args.push("--resume", input.resume_session);
      }

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: CLI_PATH,
        GEMINI_API_KEY: apiKey,
        GOOGLE_GEMINI_BASE_URL: process.env.MODEL_BASE_URL ?? baseUrl,
      };

      try {
        const result = await spawnCliAgent("gemini", args, {
          cwd: opts.cwd,
          env,
          timeoutMs: timeoutSecs * 1000,
          maxOutput,
          signal,
          onUpdate,
        });

        const cleanOutput = stripAnsi(result.output);

        if (result.timedOut) {
          return textResult(
            `TIMEOUT after ${timeoutSecs}s. Partial output:\n${truncateOutput(cleanOutput, maxOutput)}`,
          );
        }

        if (result.exitCode !== 0 && result.exitCode !== null) {
          return textResult(
            `Exit code ${result.exitCode}:\n${truncateOutput(cleanOutput, maxOutput)}`,
          );
        }

        return textResult(truncateOutput(cleanOutput, maxOutput));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error: ${msg}`);
      }
    },
  };
}

// ── Codex CLI tool ─────────────────────────────────────────────────────

export function createCodexTool(opts: CodexToolOptions): AgentTool {
  const maxOutput = opts.maxOutputLength ?? 80_000;
  const defaultModel = opts.model; // undefined = use codex default

  return {
    name: "codex_cli",
    label: "codex_cli",
    description:
      "Run Codex CLI (OpenAI) to implement code changes or perform analysis. " +
      "Best for: implementation tasks, code review (read-only mode), large refactors. " +
      "Codex runs with full auto-approval and high reasoning effort by default. " +
      "Frame your prompt carefully — include specific file paths, what to change, constraints, and verification steps.",
    parameters: CodexParams,
    execute: async (_toolCallId: string, _input: unknown, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback<any>) => {
      const input = _input as CodexInput;
      const timeoutSecs = input.timeout ?? DEFAULT_TIMEOUT;
      const effort = input.reasoning_effort ?? "high";
      const model = input.model ?? defaultModel;

      const args: string[] = [
        "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        "-c", `model_reasoning_effort=${effort}`,
      ];

      if (model) {
        args.push("-m", model);
      }

      // Prompt goes last as positional
      args.push(input.prompt);

      try {
        const result = await spawnCliAgent("codex", args, {
          cwd: opts.cwd,
          timeoutMs: timeoutSecs * 1000,
          maxOutput,
          signal,
          onUpdate,
        });

        const cleanOutput = stripAnsi(result.output);

        if (result.timedOut) {
          return textResult(
            `TIMEOUT after ${timeoutSecs}s. Partial output:\n${truncateOutput(cleanOutput, maxOutput)}`,
          );
        }

        if (result.exitCode !== 0 && result.exitCode !== null) {
          return textResult(
            `Exit code ${result.exitCode}:\n${truncateOutput(cleanOutput, maxOutput)}`,
          );
        }

        return textResult(truncateOutput(cleanOutput, maxOutput));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error: ${msg}`);
      }
    },
  };
}
