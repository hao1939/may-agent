/**
 * cc_worker tool — Single persistent Claude Code CLI session.
 *
 * Always resumes the same session. First call creates it, subsequent calls
 * resume via stored session ID. Master doesn't need to track session IDs.
 */
import { spawn } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
        const chunks: string[] = [];
        let lastResult = "";
        let sessionId = "";

        child.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          chunks.push(text);
          for (const line of text.split("\n")) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === "system" && obj.session_id) {
                sessionId = obj.session_id;
              }
              if (obj.type === "result") {
                lastResult = obj.result || JSON.stringify(obj);
                if (obj.session_id) sessionId = obj.session_id;
              } else if (obj.type === "assistant" && obj.message?.content) {
                for (const block of obj.message.content) {
                  if (block.type === "text") lastResult = block.text;
                }
              }
            } catch {}
          }
        });

        child.stderr?.on("data", (data: Buffer) => {
          chunks.push(`[stderr] ${data.toString()}`);
        });

        child.on("close", (code) => {
          // Persist session ID for next call
          if (sessionId) saveSessionId(stateDir, sessionId);

          if (lastResult) {
            resolve(textResult(lastResult));
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
