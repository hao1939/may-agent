import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const paramsSchema = Type.Object({
  tool: Type.Union([Type.Literal("claude"), Type.Literal("codex")], {
    description: "CLI worker to run.",
  }),
  mode: Type.Optional(
    Type.Union([Type.Literal("investigate"), Type.Literal("review"), Type.Literal("patch")], {
      description: "Kind of work requested. Default: investigate.",
    }),
  ),
  prompt: Type.String({
    description: "Focused task prompt for the CLI worker.",
  }),
  cwd: Type.Optional(
    Type.String({
      description: "Working directory. Defaults to project root.",
    }),
  ),
  files: Type.Optional(
    Type.Array(Type.String(), {
      description: "Relevant files to inspect or modify.",
    }),
  ),
  sandbox: Type.Optional(
    Type.Union([Type.Literal("read-only"), Type.Literal("workspace-write"), Type.Literal("danger-full-access")], {
      description: "Execution sandbox. Defaults to danger-full-access for May's trusted CLI workers.",
    }),
  ),
  timeoutMs: Type.Optional(
    Type.Number({
      description: "Timeout in milliseconds. Default: 600000.",
    }),
  ),
  worktree: Type.Optional(
    Type.String({
      description: "Optional isolated worktree for patch mode.",
    }),
  ),
  resumeSessionId: Type.Optional(
    Type.String({
      description: "Optional native Claude/Codex session id to resume.",
    }),
  ),
  reuseSession: Type.Optional(
    Type.Boolean({
      description: "Resume/store May's default native CLI session for this tool.",
    }),
  ),
});

type RunCliAgentParams = Static<typeof paramsSchema>;

export interface RunCliAgentToolOptions {
  agentName: string;
  projectRoot: string;
  persistDir: string;
  emit?: (event: { type: string; [key: string]: unknown }) => void;
  getCallerSessionId?: () => string | undefined;
}

function textResult(text: string): AgentToolResult<undefined> {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

function createTaskId(): string {
  return `cli_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureInside(root: string, path: string): string {
  const base = resolve(root);
  const resolved = resolve(base, path);
  if (resolved === base || resolved.startsWith(`${base}/`)) return resolved;
  throw new Error(`Path outside project root: ${path}`);
}

function safeCwd(projectRoot: string, cwd?: string): string {
  if (!cwd || !cwd.trim()) return resolve(projectRoot);
  return ensureInside(projectRoot, cwd);
}

function defaultSandbox(_tool: RunCliAgentParams["tool"], _mode: NonNullable<RunCliAgentParams["mode"]>): string {
  return "danger-full-access";
}

export function createRunCliAgentTool(opts: RunCliAgentToolOptions): AgentTool {
  return {
    name: "run_cli_agent",
    label: "Run CLI Agent",
    description:
      "Delegate focused work to Claude Code or Codex through the durable async CLI task runner. Returns accepted immediately; completion arrives as cli.task.completed/failed.",
    parameters: paramsSchema,
    execute: async (_toolCallId: string, rawParams: unknown): Promise<AgentToolResult<undefined>> => {
      const params = rawParams as RunCliAgentParams;
      if (!params.prompt || !params.prompt.trim()) {
        return textResult(JSON.stringify({ error: "prompt is required" }));
      }

      const taskId = createTaskId();
      const dir = join(opts.persistDir, "cli-tasks", taskId);
      const promptPath = join(dir, "prompt.md");
      const resultPath = join(dir, "result.md");
      const structuredResultPath = join(dir, "result.json");
      const eventsPath = join(dir, "events.jsonl");
      const cwd = safeCwd(opts.projectRoot, params.cwd);
      const mode = params.mode ?? "investigate";
      const sandbox = params.sandbox ?? defaultSandbox(params.tool, mode);
      const timeoutMs = params.timeoutMs && Number.isFinite(params.timeoutMs) ? params.timeoutMs : DEFAULT_TIMEOUT_MS;

      mkdirSync(dir, { recursive: true });
      writeFileSync(promptPath, params.prompt);
      writeFileSync(
        join(dir, "request.json"),
        `${JSON.stringify(
          {
            taskId,
            tool: params.tool,
            mode,
            cwd,
            promptPath,
            resultPath,
            structuredResultPath,
            eventsPath,
            sandbox,
            timeoutMs,
            sourceOwner: `agent:${opts.agentName}`,
            sourceSessionId: opts.getCallerSessionId?.(),
            resumeSessionId: params.resumeSessionId,
            reuseSession: params.reuseSession === true,
            files: params.files,
            worktree: params.worktree,
            requestedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
      );

      opts.emit?.({
        type: "cli.task.requested",
        source: `agent:${opts.agentName}`,
        owner: "runtime:cli-task-runner",
        urgency: "normal",
        data: {
          taskId,
          tool: params.tool,
          mode,
          cwd,
          promptPath,
          resultPath,
          structuredResultPath,
          eventsPath,
          sandbox,
          timeoutMs,
          sourceOwner: `agent:${opts.agentName}`,
          sourceSessionId: opts.getCallerSessionId?.(),
          resumeSessionId: params.resumeSessionId,
          reuseSession: params.reuseSession === true,
          files: params.files,
          worktree: params.worktree,
        },
      });

      return textResult(
        JSON.stringify({
          taskId,
          status: "accepted",
          resultPath,
          structuredResultPath,
          eventsPath,
        }),
      );
    },
  };
}
