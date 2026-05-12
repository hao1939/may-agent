import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_SEC = 120;
const DEFAULT_MAX_OUTPUT = 20000;
const ALLOWED_HOSTS = new Set(["devbox"]);

function textResult(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details };
}

function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.55);
  const tail = Math.max(0, max - head - 80);
  return `${text.slice(0, head)}\n\n... <truncated ${text.length - head - tail} chars> ...\n\n${text.slice(-tail)}`;
}

export function createSshExecTool() {
  return {
    name: "ssh_exec",
    label: "SSH Exec",
    description:
      "Run an exact command on an approved SSH host and return stdout/stderr. " +
      "This is not an LLM worker; use it when you need faithful remote command execution.",
    parameters: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "SSH host alias. Currently allowed: devbox.",
          default: "devbox",
        },
        command: {
          type: "string",
          description: "Remote shell command to execute exactly on the SSH host.",
        },
        timeout: {
          type: "number",
          description: `Timeout in seconds. Default: ${DEFAULT_TIMEOUT_SEC}.`,
        },
        max_output: {
          type: "number",
          description: `Maximum combined output characters to return. Default: ${DEFAULT_MAX_OUTPUT}.`,
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
    async execute(_toolCallId: string, params: any) {
      const host = String(params.host || "devbox");
      const command = String(params.command || "");
      const timeoutSec = Number(params.timeout || DEFAULT_TIMEOUT_SEC);
      const maxOutput = Number(params.max_output || DEFAULT_MAX_OUTPUT);

      if (!ALLOWED_HOSTS.has(host)) {
        return textResult(`[error] SSH host "${host}" is not allowed. Allowed hosts: ${[...ALLOWED_HOSTS].join(", ")}`);
      }
      if (!command.trim()) {
        return textResult("[error] command is required");
      }

      return new Promise((resolve) => {
        const spawnOpts: Parameters<typeof spawn>[2] = {
          env: process.env,
          timeout: Math.max(1, timeoutSec) * 1000,
          stdio: ["ignore", "pipe", "pipe"],
        };
        if (process.getuid?.() === 0) spawnOpts.uid = 1000;

        const child = spawn("ssh", [host, command], spawnOpts);

        const stdout: string[] = [];
        const stderr: string[] = [];
        let timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, Math.max(1, timeoutSec) * 1000);

        child.stdout?.on("data", (data: Buffer) => stdout.push(data.toString()));
        child.stderr?.on("data", (data: Buffer) => stderr.push(data.toString()));

        child.on("close", (code, signal) => {
          clearTimeout(timer);
          const out = stdout.join("");
          const err = stderr.join("");
          const statusLine = timedOut
            ? `[timeout after ${timeoutSec}s]`
            : `[exit ${code ?? "unknown"}${signal ? ` signal ${signal}` : ""}]`;
          const combined = [
            statusLine,
            `$ ssh ${host} ${JSON.stringify(command)}`,
            "",
            "## stdout",
            out || "(empty)",
            "",
            "## stderr",
            err || "(empty)",
          ].join("\n");
          resolve(textResult(truncateMiddle(combined, maxOutput), {
            host,
            command,
            exitCode: code,
            signal,
            timedOut,
          }));
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          resolve(textResult(`[error] ${err.message}`, { host, command, timedOut }));
        });
      });
    },
  };
}
