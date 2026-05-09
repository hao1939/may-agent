/**
 * cc_worker tool — Invoke Claude Code CLI as a worker coding agent.
 * Routes through litellm proxy via ANTHROPIC_BASE_URL.
 */
import { spawn } from "child_process";

const TIMEOUT_DEFAULT = 300;

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

export default function factory(_opts: { projectRoot: string; agentRoot: string; persistDir: string }) {
  return {
    name: "cc_worker",
    label: "Claude Code Worker",
    description:
      "Invoke Claude Code CLI as a worker agent to implement code changes. Runs with auto-approval and full project access. " +
      "Best for: multi-file changes, debugging, refactoring, writing tests. Default choice when unsure.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The task description. Be specific about files, constraints, verification." },
        timeout: { type: "number", description: "Timeout in seconds. Default: 300." },
        cwd: { type: "string", description: "Working directory. Defaults to project root." },
        model: { type: "string", description: "Model override (e.g. 'claude-sonnet-4-20250514'). Omit for default." },
        continue_session: { type: "boolean", description: "Continue the most recent conversation." },
        max_turns: { type: "number", description: "Max conversation turns. Default: unlimited." },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
    async execute(_toolCallId: string, params: any) {
      const { prompt, timeout, cwd, model, continue_session, max_turns } = params;
      const timeoutSec = timeout ?? TIMEOUT_DEFAULT;
      const workDir = cwd ?? _opts.projectRoot;

      const args = [
        "-p", prompt,
        "--dangerously-skip-permissions",
        "--verbose",
        "--output-format", "stream-json",
        "--max-budget-usd", "5",
      ];

      if (model) args.push("--model", model);
      if (continue_session) args.push("--continue");
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

        child.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          chunks.push(text);
          for (const line of text.split("\n")) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === "result") {
                lastResult = obj.result || JSON.stringify(obj);
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
