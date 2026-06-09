/**
 * Background exec tool — long-lived child process management.
 *
 * Unlike the regular exec tool (synchronous, returns output), this spawns
 * processes that run in the background while the agent continues working.
 * Output is buffered and read on demand with drain semantics.
 *
 * Used by the coach agent to spawn coachee may-agent processes.
 */

import { Type, StringEnum } from "@earendil-works/pi-ai";
import type { TSchema } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { spawn, type ChildProcess } from "node:child_process";
import { isMetaRecursionCommand } from "./tools/may-utils.js";

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

// ── Ring buffer for process output ──────────────────────────────────────

const MAX_BUFFER_SIZE = 100_000; // 100KB

class OutputBuffer {
  private buffer = "";
  private readCursor = 0;

  append(data: string): void {
    this.buffer += data;
    // Trim from the front if buffer exceeds max, keeping readCursor valid
    if (this.buffer.length > MAX_BUFFER_SIZE * 2) {
      const trim = this.buffer.length - MAX_BUFFER_SIZE;
      this.buffer = this.buffer.slice(trim);
      this.readCursor = Math.max(0, this.readCursor - trim);
    }
  }

  /** Read unread output (drain semantics — advances cursor). */
  drain(maxLines?: number): string {
    const unread = this.buffer.slice(this.readCursor);
    if (!unread) return "";

    // Always advance cursor to end
    this.readCursor = this.buffer.length;

    if (maxLines !== undefined && maxLines > 0) {
      const lines = unread.split("\n");
      // Filter empty trailing element from trailing newline
      const nonEmpty = lines.filter((l) => l.length > 0);
      const selected = nonEmpty.slice(-maxLines);
      return selected.join("\n");
    }

    return unread;
  }
}

// ── Process tracking ────────────────────────────────────────────────────

interface ProcessEntry {
  pid: number;
  label: string;
  process: ChildProcess;
  output: OutputBuffer;
  exitCode: number | null;
  alive: boolean;
}

/** Options for the background exec tool. */
export interface BackgroundExecToolOptions {
  /** Working directory for spawned processes. */
  cwd?: string;
  /** Patterns that block command execution. */
  denyPatterns?: { test(s: string): boolean }[];
  /** Message shown when a command is blocked by a deny pattern. */
  denyMessage?: string;
  /**
   * Skip the meta-recursion guard (which normally blocks bun src/app/may.ts etc.).
   * Enable this for the coach agent, which legitimately needs to spawn coachee processes.
   */
  allowAgentSpawn?: boolean;
}

const BackgroundExecParams: TSchema = Type.Object({
  action: StringEnum(["spawn", "output", "input", "kill", "list"] as const, {
    description: "Action to perform on background processes.",
  }),
  command: Type.Optional(Type.String({ description: "Shell command to spawn (required for 'spawn')" })),
  label: Type.Optional(Type.String({ description: "Human-readable label for the process (optional for 'spawn')" })),
  pid: Type.Optional(Type.Number({ description: "Process ID (required for 'output', 'input', 'kill')" })),
  text: Type.Optional(Type.String({ description: "Text to write to stdin (required for 'input')" })),
  lines: Type.Optional(
    Type.Number({ description: "Max lines to return (optional for 'output', default: all unread)" }),
  ),
  signal: Type.Optional(Type.String({ description: "Signal to send (optional for 'kill', default: SIGTERM)" })),
});
interface BackgroundExecInput {
  action: "spawn" | "output" | "input" | "kill" | "list";
  command?: string;
  label?: string;
  pid?: number;
  text?: string;
  lines?: number;
  signal?: string;
}

/**
 * Create a background exec tool for managing long-lived child processes.
 *
 * Returns the tool and a cleanup function. The cleanup function kills all
 * tracked processes — call it when the agent's session ends.
 */
export function createBackgroundExecTool(opts?: BackgroundExecToolOptions): { tool: AgentTool; cleanup: () => void } {
  const cwd = opts?.cwd ?? process.cwd();
  const denyPatterns = opts?.denyPatterns ?? [];
  const denyMessage = opts?.denyMessage ?? "Command blocked by deny pattern.";
  const allowAgentSpawn = opts?.allowAgentSpawn ?? false;

  const processes = new Map<number, ProcessEntry>();

  function cleanup(): void {
    for (const entry of processes.values()) {
      if (entry.alive) {
        try {
          entry.process.kill("SIGTERM");
        } catch {
          /* ignore */
        }
      }
    }
    processes.clear();
  }

  function getProcess(pid: number): ProcessEntry {
    const entry = processes.get(pid);
    if (!entry) throw new Error(`No tracked process with PID ${pid}`);
    return entry;
  }

  const tool: AgentTool = {
    name: "background_exec",
    label: "Background Exec",
    description:
      "Spawn and manage long-lived background processes. Use for processes that run while you continue working (e.g. servers, watchers, other agent processes).",
    parameters: BackgroundExecParams,
    execute: async (_toolCallId, _params) => {
      const params = _params as BackgroundExecInput;
      try {
        switch (params.action) {
          case "spawn": {
            if (!params.command) {
              return textResult(JSON.stringify({ error: "action 'spawn' requires 'command'" }));
            }
            const command = params.command;

            // Deny pattern check
            if (!allowAgentSpawn && isMetaRecursionCommand(command)) {
              return textResult(
                JSON.stringify({
                  error:
                    "Blocked: command would recursively start the agent runtime. Use socket_watch to interact with other agent processes.",
                }),
              );
            }
            for (const pattern of denyPatterns) {
              if (pattern.test(command)) {
                return textResult(
                  JSON.stringify({ error: `Blocked: command matches a denied pattern.\n${denyMessage}` }),
                );
              }
            }

            const child = spawn("sh", ["-c", command], {
              cwd,
              stdio: ["pipe", "pipe", "pipe"],
              detached: false,
            });

            if (!child.pid) {
              return textResult(JSON.stringify({ error: "Failed to spawn process" }));
            }

            const output = new OutputBuffer();
            const label = params.label ?? command.slice(0, 60);

            const entry: ProcessEntry = {
              pid: child.pid,
              label,
              process: child,
              output,
              exitCode: null,
              alive: true,
            };

            child.stdout?.on("data", (data: Buffer) => {
              output.append(data.toString());
            });
            child.stderr?.on("data", (data: Buffer) => {
              output.append(data.toString());
            });
            child.on("exit", (code) => {
              entry.exitCode = code;
              entry.alive = false;
            });
            child.on("error", (err) => {
              output.append(`[process error: ${err.message}]\n`);
              entry.alive = false;
            });

            processes.set(child.pid, entry);

            return textResult(JSON.stringify({ pid: child.pid, label }));
          }

          case "output": {
            if (params.pid === undefined) {
              return textResult(JSON.stringify({ error: "action 'output' requires 'pid'" }));
            }
            const entry = getProcess(params.pid);
            const text = entry.output.drain(params.lines);
            if (!text) {
              return textResult(
                JSON.stringify({
                  pid: entry.pid,
                  alive: entry.alive,
                  exitCode: entry.exitCode,
                  output: "(no new output)",
                }),
              );
            }
            return textResult(
              JSON.stringify({
                pid: entry.pid,
                alive: entry.alive,
                exitCode: entry.exitCode,
                output: text,
              }),
            );
          }

          case "input": {
            if (params.pid === undefined) {
              return textResult(JSON.stringify({ error: "action 'input' requires 'pid'" }));
            }
            if (!params.text) {
              return textResult(JSON.stringify({ error: "action 'input' requires 'text'" }));
            }
            const entry = getProcess(params.pid);
            if (!entry.alive) {
              return textResult(
                JSON.stringify({ error: `Process ${params.pid} is not alive (exit code: ${entry.exitCode})` }),
              );
            }
            if (!entry.process.stdin) {
              return textResult(JSON.stringify({ error: `Process ${params.pid} has no stdin` }));
            }
            entry.process.stdin.write(params.text);
            // Keep a transcript of stdin writes. Bun's child_process implementation
            // does not reliably surface echoed stdin from simple interactive
            // commands like `cat`, so the transcript still lets callers confirm
            // what was sent.
            entry.output.append(params.text);
            return textResult(JSON.stringify({ written: true, pid: params.pid }));
          }

          case "kill": {
            if (params.pid === undefined) {
              return textResult(JSON.stringify({ error: "action 'kill' requires 'pid'" }));
            }
            const entry = getProcess(params.pid);
            const signal = (params.signal ?? "SIGTERM") as NodeJS.Signals;
            if (entry.alive) {
              try {
                entry.process.kill(signal);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return textResult(JSON.stringify({ error: `Failed to kill process ${params.pid}: ${msg}` }));
              }
            }
            processes.delete(params.pid);
            return textResult(JSON.stringify({ killed: true, pid: params.pid }));
          }

          case "list": {
            const entries = Array.from(processes.values()).map((e) => ({
              pid: e.pid,
              label: e.label,
              alive: e.alive,
              exitCode: e.exitCode,
            }));
            return textResult(JSON.stringify(entries));
          }

          default:
            return textResult(JSON.stringify({ error: `Unknown action: ${params.action}` }));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(JSON.stringify({ error: msg }));
      }
    },
  };

  return { tool, cleanup };
}
