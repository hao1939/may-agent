/**
 * codex_worker tool — Invoke Codex CLI as a worker coding agent.
 * Routes through litellm proxy via config.toml model_providers.
 */
import { spawn } from "child_process";

const TIMEOUT_DEFAULT = 300;

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

export default function factory(_opts: { projectRoot: string; agentRoot: string; persistDir: string }) {
  return {
    name: "codex_worker",
    label: "Codex Worker",
    description:
      "Invoke Codex CLI as a worker agent for implementation or analysis. Runs with full auto-approval. " +
      "Best for: high-reasoning implementation, alternative perspective, cross-review of cc_worker output.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The task description. Be specific about files, constraints, verification." },
        timeout: { type: "number", description: "Timeout in seconds. Default: 300." },
        cwd: { type: "string", description: "Working directory. Must be a git repo. Defaults to project root." },
        continue_session: { type: "boolean", description: "Resume the most recent Codex session (uses `codex exec resume --last`)." },
        session_id: { type: "string", description: "Resume a specific Codex session by UUID." },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
    async execute(_toolCallId: string, params: any) {
      const { prompt, timeout, cwd, continue_session, session_id } = params;
      const timeoutSec = timeout ?? TIMEOUT_DEFAULT;
      const workDir = cwd ?? _opts.projectRoot;

      const args: string[] = [];
      if (session_id) {
        args.push("exec", "resume", session_id, prompt);
      } else if (continue_session) {
        args.push("exec", "resume", "--last", prompt);
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
        const spawnOpts: any = { cwd: workDir, env, timeout: timeoutSec * 1000 };
        if (process.getuid?.() === 0) spawnOpts.uid = 1000;
        const child = spawn("codex", args, spawnOpts);
        const chunks: string[] = [];
        let lastMessage = "";
        let sessionId = "";

        child.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          chunks.push(text);
          for (const line of text.split("\n")) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === "thread.started" && obj.thread_id) {
                sessionId = obj.thread_id;
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
          const sessionSuffix = sessionId ? `\n\n[codex_session_id: ${sessionId}]` : "";
          if (lastMessage) {
            resolve(textResult(lastMessage + sessionSuffix));
          } else {
            const output = chunks.join("").slice(-8000);
            resolve(textResult((code === 0 ? output || "(no output)" : `[exit ${code}] ${output}`) + sessionSuffix));
          }
        });

        child.on("error", (err) => {
          resolve(textResult(`[error] ${err.message}`));
        });
      });
    },
  };
}
