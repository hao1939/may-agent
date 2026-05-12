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

function stopChildProcessGroup(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  if (child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to killing the direct child below.
    }
  }
  child.kill(signal);
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
    async execute(_toolCallId: string, params: any, signal?: AbortSignal) {
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
      if (signal?.aborted) {
        return textResult("[aborted]", { host, command, timedOut: false, aborted: true });
      }

      return new Promise((resolve) => {
        const sshHome = process.env.HOME || "/app/.state";
        const sshArgs = [
          "-F", `${sshHome}/.ssh/config`,
          "-i", `${sshHome}/.ssh/id_rsa`,
          host,
          command,
        ];
        const spawnOpts: Parameters<typeof spawn>[2] = {
          env: { ...process.env, HOME: sshHome },
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
        };
        if (process.getuid?.() === 0) spawnOpts.uid = 1000;

        const child = spawn("ssh", sshArgs, spawnOpts);

        const stdout: string[] = [];
        const stderr: string[] = [];
        let timedOut = false;
        let aborted = false;
        let forceKillTimer: NodeJS.Timeout | null = null;

        const stop = (reason: "timeout" | "abort") => {
          if (reason === "timeout") timedOut = true;
          if (reason === "abort") aborted = true;
          stopChildProcessGroup(child, "SIGTERM");
          if (forceKillTimer) return;
          forceKillTimer = setTimeout(() => {
            stopChildProcessGroup(child, "SIGKILL");
          }, 5000);
        };

        const timer = setTimeout(() => stop("timeout"), Math.max(1, timeoutSec) * 1000);
        const abortHandler = () => stop("abort");
        signal?.addEventListener("abort", abortHandler, { once: true });

        child.stdout?.on("data", (data: Buffer) => stdout.push(data.toString()));
        child.stderr?.on("data", (data: Buffer) => stderr.push(data.toString()));

        child.on("close", (code, childSignal) => {
          clearTimeout(timer);
          signal?.removeEventListener?.("abort", abortHandler);
          if (forceKillTimer) clearTimeout(forceKillTimer);
          const out = stdout.join("");
          const err = stderr.join("");
          const statusLine = timedOut
            ? `[timeout after ${timeoutSec}s]`
            : aborted
              ? `[aborted${childSignal ? ` signal ${childSignal}` : ""}]`
              : `[exit ${code ?? "unknown"}${childSignal ? ` signal ${childSignal}` : ""}]`;
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
            signal: childSignal,
            timedOut,
            aborted,
          }));
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          signal?.removeEventListener?.("abort", abortHandler);
          if (forceKillTimer) clearTimeout(forceKillTimer);
          resolve(textResult(`[error] ${err.message}`, { host, command, timedOut, aborted }));
        });
      });
    },
  };
}
