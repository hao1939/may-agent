/**
 * cc_worker tool — Single persistent Claude Code CLI session.
 *
 * Always resumes the same session. First call creates it, subsequent calls
 * resume via stored session ID. Master doesn't need to track session IDs.
 *
 * Uses cc-stream-parser to produce structured envelopes with tool outputs,
 * files touched, and status information.
 */
import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseCCStream, formatEnvelope } from "./cc-stream-parser";

const TIMEOUT_DEFAULT = 300;
const SESSION_FILE = "cc-session-id";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

function loadSessionId(dir: string): string | null {
  try { return readFileSync(join(dir, SESSION_FILE), "utf-8").trim() || null; } catch { return null; }
}

function saveSessionId(dir: string, id: string): void {
  try { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, SESSION_FILE), id); } catch {}
}

export default function factory(_opts: { projectRoot: string; agentRoot: string; persistDir: string }) {
  const stateDir = join(_opts.agentRoot, "workspace");

  return {
    name: "cc_worker",
    label: "Claude Code Worker",
    description:
      "Single persistent Claude Code CLI session. Always resumes the same session — it remembers prior context. " +
      "Use `new_session: true` only to start fresh (discard prior context). Default choice when unsure.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The task or follow-up message." },
        timeout: { type: "number", description: "Timeout in seconds. Default: 300." },
        cwd: { type: "string", description: "Working directory. Defaults to project root." },
        model: { type: "string", description: "Model override (e.g. 'claude-sonnet-4-20250514'). Omit for default." },
        new_session: { type: "boolean", description: "Force a new session, discarding prior context." },
        max_turns: { type: "number", description: "Max conversation turns. Default: unlimited." },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
    async execute(_toolCallId: string, params: any) {
      const { prompt, timeout, cwd, model, new_session, max_turns } = params;
      const timeoutSec = timeout ?? TIMEOUT_DEFAULT;
      const workDir = cwd ?? _opts.projectRoot;

      const existingSession = new_session ? null : loadSessionId(stateDir);
      const args = [
        "-p", prompt,
        "--dangerously-skip-permissions",
        "--verbose",
        "--output-format", "stream-json",
        "--max-budget-usd", "5",
      ];

      if (existingSession) {
        args.push("--resume", existingSession);
      }
      if (model) args.push("--model", model);
      if (max_turns) args.push("--max-turns", String(max_turns));

      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || process.env.MODEL_BASE_URL || "http://localhost:4000",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.LITELLM_API_KEY || "sk-local",
        HOME: process.env.HOME || "/app/.state",
      };

      return new Promise((resolve) => {
        const spawnOpts: any = { cwd: workDir, env, timeout: timeoutSec * 1000 };
        if (process.getuid?.() === 0) spawnOpts.uid = 1000;
        const child = spawn("claude", args, spawnOpts);
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        child.stdout?.on("data", (data: Buffer) => {
          stdoutChunks.push(data.toString());
        });

        child.stderr?.on("data", (data: Buffer) => {
          stderrChunks.push(data.toString());
        });

        child.on("close", (code) => {
          const stdoutStr = stdoutChunks.join("");
          const stderrStr = stderrChunks.join("");
          const envelope = parseCCStream(stdoutStr, stderrStr, code ?? 1);

          // Persist session ID for next call
          if (envelope.session_id) saveSessionId(stateDir, envelope.session_id);

          resolve(textResult(formatEnvelope(envelope)));
        });

        child.on("error", (err) => {
          resolve(textResult(`[error] ${err.message}`));
        });
      });
    },
  };
}
