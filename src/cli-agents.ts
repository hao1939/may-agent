/**
 * Dedicated tools for invoking CLI coding agents (claude-code, gemini-cli).
 *
 * These are the master agent's only way to interact with the codebase.
 * Each tool constructs the exact CLI invocation with all required flags
 * and returns the output. No general exec, no read, no write — just
 * prompt in, result out.
 */

import { Type, type Static } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { execSync } from "node:child_process";

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

// ── Shared params ──────────────────────────────────────────────────────

const CliAgentParams: TSchema = Type.Object({
  prompt: Type.String({ description: "The task/prompt to send to the CLI agent. Be specific: include file paths, constraints, what to change, and what to verify." }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 180). Increase for complex tasks." })),
});

interface CliAgentInput { prompt: string; timeout?: number; }

// ── Options ────────────────────────────────────────────────────────────

export interface CliAgentToolOptions {
  /** Working directory for the CLI agent process. */
  cwd: string;
  /** Maximum output length before truncation. Default: 80_000. */
  maxOutputLength?: number;
}

// ── Output truncation ──────────────────────────────────────────────────

function truncateOutput(output: string, maxLen: number): string {
  if (maxLen <= 0 || output.length <= maxLen) return output;
  const keepEach = Math.floor(maxLen / 2);
  const head = output.slice(0, keepEach);
  const tail = output.slice(-keepEach);
  const omitted = output.length - keepEach * 2;
  return `${head}\n\n--- TRUNCATED (${omitted} chars omitted) ---\n\n${tail}`;
}

// ── Claude Code tool ───────────────────────────────────────────────────

export function createClaudeCodeTool(opts: CliAgentToolOptions): AgentTool {
  const maxOutput = opts.maxOutputLength ?? 80_000;

  return {
    name: "claude_code",
    label: "claude_code",
    description:
      "Run claude-code to implement code changes. Best for: multi-file changes, debugging, refactoring, writing tests. " +
      "Claude-code has full read/write access to the project and runs with auto-approval. " +
      "Frame your prompt carefully — include specific file paths, what to change, constraints, and verification steps.",
    parameters: CliAgentParams,
    execute: async (_toolCallId: string, _input: unknown) => {
      const input = _input as CliAgentInput;
      const timeout = (input.timeout ?? 180) * 1000;
      const prompt = input.prompt;

      // Escape single quotes in the prompt for shell safety
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      const command = `claude --print --dangerously-skip-permissions --model claude-opus-4.6 -p '${escapedPrompt}' 2>&1`;

      try {
        const result = execSync(command, {
          cwd: opts.cwd,
          timeout,
          maxBuffer: 10 * 1024 * 1024,
          encoding: "utf-8",
          env: { ...process.env },
        });
        return textResult(truncateOutput(result, maxOutput));
      } catch (err: any) {
        const output = (err.stdout ?? "") + (err.stderr ?? "");
        if (err.killed || err.signal === "SIGTERM") {
          return textResult(`TIMEOUT after ${input.timeout ?? 180}s. Partial output:\n${truncateOutput(output, maxOutput)}`);
        }
        const exitCode = err.status ?? "unknown";
        return textResult(`Exit code ${exitCode}:\n${truncateOutput(output || err.message, maxOutput)}`);
      }
    },
  };
}

// ── Gemini CLI tool ────────────────────────────────────────────────────

export interface GeminiCliToolOptions extends CliAgentToolOptions {
  /** API key for the proxy. Default: "dummy". */
  apiKey?: string;
  /** Base URL for the Gemini proxy. Default: "http://localhost:4000". */
  baseUrl?: string;
  /** Model to use. Default: "gemini-3.1-pro-preview". */
  model?: string;
}

export function createGeminiCliTool(opts: GeminiCliToolOptions): AgentTool {
  const maxOutput = opts.maxOutputLength ?? 80_000;
  const apiKey = opts.apiKey ?? "dummy";
  const baseUrl = opts.baseUrl ?? "http://localhost:4000";
  const model = opts.model ?? "gemini-3.1-pro-preview";

  return {
    name: "gemini_cli",
    label: "gemini_cli",
    description:
      "Run gemini-cli for analysis, exploration, or code changes with very large context. " +
      "Best for: codebase analysis, architectural reasoning, large-context tasks. " +
      "Gemini-cli has full read/write access to the project and runs with auto-approval. " +
      "Frame your prompt carefully — include specific file paths, what to analyze/change, and what output you expect.",
    parameters: CliAgentParams,
    execute: async (_toolCallId: string, _input: unknown) => {
      const input = _input as CliAgentInput;
      const timeout = (input.timeout ?? 180) * 1000;
      const prompt = input.prompt;

      // Escape single quotes in the prompt for shell safety
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      const command = `GEMINI_API_KEY=${apiKey} GOOGLE_GEMINI_BASE_URL=${baseUrl} gemini --prompt '${escapedPrompt}' --model ${model} --yolo 2>&1`;

      try {
        const result = execSync(command, {
          cwd: opts.cwd,
          timeout,
          maxBuffer: 10 * 1024 * 1024,
          encoding: "utf-8",
          env: { ...process.env, GEMINI_API_KEY: apiKey, GOOGLE_GEMINI_BASE_URL: baseUrl },
        });
        return textResult(truncateOutput(result, maxOutput));
      } catch (err: any) {
        const output = (err.stdout ?? "") + (err.stderr ?? "");
        if (err.killed || err.signal === "SIGTERM") {
          return textResult(`TIMEOUT after ${input.timeout ?? 180}s. Partial output:\n${truncateOutput(output, maxOutput)}`);
        }
        const exitCode = err.status ?? "unknown";
        return textResult(`Exit code ${exitCode}:\n${truncateOutput(output || err.message, maxOutput)}`);
      }
    },
  };
}
