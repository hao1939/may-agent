/**
 * codex_worker tool — Single persistent Codex CLI session.
 *
 * Always resumes the same session. First call creates it, subsequent calls
 * resume via stored session ID. Master doesn't need to track session IDs.
 */
import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const TIMEOUT_DEFAULT = 300;
const SESSION_FILE = "codex-session-id";

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
      const timeoutSec = timeout ?? TIMEOUT_DEFAULT;
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
        const chunks: string[] = [];
        let lastMessage = "";
        let threadId = "";

        child.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          chunks.push(text);
          for (const line of text.split("\n")) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === "thread.started" && obj.thread_id) {
                threadId = obj.thread_id;
              }
              if (obj.type === "item.completed" && obj.item?.text) {
                lastMessage = obj.item.text;
              }
            } catch {}
          }
        });

        child.stderr?.on("data", (data: Buffer) => {
          chunks.push(`[stderr] ${data.toString()}`);
        });

        child.on("close", (code) => {
          // Persist session ID for next call
          if (threadId) saveSessionId(stateDir, threadId);

          if (lastMessage) {
            resolve(textResult(lastMessage));
          } else {
            const output = chunks.join("").slice(-8000);
            resolve(textResult(code === 0 ? output || "(no output)" : `[exit ${code}] ${output}`));
          }
        });

        child.on("error", (err) => {
          resolve(textResult(`[error] ${err.message}`));
        });
      });
    },
  };
}
