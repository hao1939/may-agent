/**
 * codex_worker tool — Single persistent Codex CLI session.
 *
 * Always resumes the same session. First call creates it, subsequent calls
 * resume via stored session ID. Master doesn't need to track session IDs.
 *
 * Uses codex-stream-parser to produce structured envelopes with tool outputs,
 * agent messages, usage stats, and status information.
 */
import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseCodexStream, formatCodexEnvelope } from "./codex-stream-parser";

const TIMEOUT_DEFAULT = 300;
const TIMEOUT_MIN = 60;
const SESSION_FILE = "codex-session-id";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

function normalizeTimeout(timeout: unknown): { seconds: number; notice: string | null } {
  const requested = typeof timeout === "number" && Number.isFinite(timeout) ? timeout : TIMEOUT_DEFAULT;
  if (requested >= TIMEOUT_MIN) return { seconds: requested, notice: null };
  return {
    seconds: TIMEOUT_MIN,
    notice: `Requested timeout ${requested}s is below the ${TIMEOUT_MIN}s minimum; using ${TIMEOUT_MIN}s.`,
  };
}

function exitCodeFromClose(code: number | null, signal: string | null): number {
  if (code !== null) return code;
  if (signal === "SIGTERM") return 143;
  if (signal === "SIGKILL") return 137;
  return 1;
}

function appendWrapperNotice(text: string, notice: string | null): string {
  return notice ? `${text}\n\n## Worker wrapper notice\n${notice}` : text;
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
    name: "codex_worker",
    label: "Codex Worker",
    description:
      "Single persistent Codex CLI session. Always resumes the same session — it remembers prior context. " +
      "Use `new_session: true` only to start fresh (discard prior context).",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The task or follow-up message." },
        timeout: { type: "number", description: "Timeout in seconds. Default: 300." },
        cwd: { type: "string", description: "Working directory. Defaults to project root." },
        new_session: { type: "boolean", description: "Force a new session, discarding prior context." },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
    async execute(_toolCallId: string, params: any) {
      const { prompt, timeout, cwd, new_session } = params;
      const { seconds: timeoutSec, notice: timeoutNotice } = normalizeTimeout(timeout);
      const workDir = cwd ?? _opts.projectRoot;

      const existingSession = new_session ? null : loadSessionId(stateDir);
      const args: string[] = [];
      if (existingSession) {
        args.push("exec", "resume", existingSession, prompt);
      } else {
        args.push("exec", prompt);
      }
      args.push("--json", "--dangerously-bypass-approvals-and-sandbox");

      const env = {
        ...process.env,
        LITELLM_API_KEY: process.env.LITELLM_API_KEY || "sk-local",
        HOME: process.env.HOME || "/app/.state",
      };

      return new Promise((resolve) => {
        const spawnOpts: any = { cwd: workDir, env, timeout: timeoutSec * 1000, stdio: ["pipe", "pipe", "pipe"] };
        if (process.getuid?.() === 0) spawnOpts.uid = 1000;
        const child = spawn("codex", args, spawnOpts);
        child.stdin?.end();
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        child.stdout?.on("data", (data: Buffer) => {
          stdoutChunks.push(data.toString());
        });

        child.stderr?.on("data", (data: Buffer) => {
          stderrChunks.push(data.toString());
        });

        child.on("close", (code, signal) => {
          const stdoutStr = stdoutChunks.join("");
          const stderrStr = stderrChunks.join("");
          const exitCode = exitCodeFromClose(code, signal);
          const envelope = parseCodexStream(stdoutStr, stderrStr, exitCode);

          // Persist session ID for next call
          if (envelope.thread_id) saveSessionId(stateDir, envelope.thread_id);

          resolve(textResult(appendWrapperNotice(formatCodexEnvelope(envelope), timeoutNotice)));
        });

        child.on("error", (err) => {
          resolve(textResult(appendWrapperNotice(`[error] ${err.message}`, timeoutNotice)));
        });
      });
    },
  };
}
