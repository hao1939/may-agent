import { Type, type Static } from "typebox";

import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { CliCallFacts } from "@may-agent/sdk";
import {
  cliCallFacts,
  runCliAgent,
  type CliAgentOptions,
  type EventTrace,
} from "@may-agent/sdk/runtime";

export { cliCallFacts };

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
  worktreePolicy: Type.Optional(
    Type.Union([Type.Literal("use-existing"), Type.Literal("require")], {
      description: "Patch isolation policy. 'require' rejects patch work without an explicitly prepared worktree.",
    }),
  ),
  expectedOutput: Type.Optional(
    Type.Object(
      {
        format: Type.Union([Type.Literal("markdown"), Type.Literal("json")]),
        requiredFields: Type.Optional(Type.Array(Type.String())),
      },
      { description: "Optional deterministic output contract checked before returning." },
    ),
  ),
  resumeSessionId: Type.Optional(
    Type.String({
      description: "Optional native Claude/Codex session id to resume.",
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
  getCallerTrace?: () => EventTrace | undefined;
  spawnCommand?: CliAgentOptions["spawnCommand"];
  drainProcessGroup?: CliAgentOptions["drainProcessGroup"];
}

export function createRunCliAgentTool(opts: RunCliAgentToolOptions): AgentTool {
  return {
    name: "run_cli_agent",
    label: "Run CLI Agent",
    description:
      "Run one bounded Codex or Claude investigation, review, or patch. Waits for completion and returns a terminal result with facts paths. Cancellation stops the native process; work that must outlive this call belongs to a Task.",
    parameters: paramsSchema,
    execute: async (
      toolCallId,
      rawParams,
      signal,
      onUpdate,
    ): Promise<AgentToolResult<{ cliCall: CliCallFacts } | undefined>> => {
      try {
        // Capture identity once, before awaiting: tools can be shared by concurrent sessions.
        const sessionId = opts.getCallerSessionId?.();
        if (!sessionId) throw new Error("CLI execution requires its exact caller session");
        const result = await runCliAgent(rawParams as RunCliAgentParams, {
          ...opts,
          sessionId,
          trace: opts.getCallerTrace?.(),
          signal,
          onProgress: (progress) =>
            onUpdate?.({
              content: [{ type: "text", text: `${progress.tool}: ${progress.event}` }],
              details: undefined,
            }),
        });
        const cliCall: CliCallFacts = {
          sessionId,
          toolCallId,
          taskId: result.taskId,
          tool: result.tool,
          status: result.status,
          ...(result.failureCategory ? { failureCategory: result.failureCategory } : {}),
          resultPath: result.resultPath,
          structuredResultPath: result.structuredResultPath,
          eventsPath: result.eventsPath,
        };
        return { content: [{ type: "text", text: JSON.stringify(result) }], details: { cliCall } };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "failed", error: error instanceof Error ? error.message : String(error) }),
            },
          ],
          details: undefined,
        };
      }
    },
  };
}
