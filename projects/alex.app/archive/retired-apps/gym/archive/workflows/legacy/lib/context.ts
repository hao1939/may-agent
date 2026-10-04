import { dirname } from "node:path";
import type {
  AgentCallOptions,
  AppEvent,
  ExecutionResult,
  Static,
  TSchema,
  WorkflowContext,
} from "@may-agent/sdk";

export type GymAgentResult<T = unknown> = {
  status: ExecutionResult["status"];
  sessionId: string;
  lastAssistantText: string;
  structuredResult?: T;
  cliCalls?: ExecutionResult["cliCalls"];
};

function workspace(
  ctx: WorkflowContext,
): NonNullable<WorkflowContext["workspace"]> {
  if (!ctx.workspace) {
    throw new Error("Gym workflow requires a canonical App workspace");
  }
  return ctx.workspace;
}

export function gymProjectsRoot(ctx: WorkflowContext): string {
  return dirname(workspace(ctx).appRoot);
}

export function gymAppRoot(ctx: WorkflowContext): string {
  return workspace(ctx).appRoot;
}

export function gymProjectRoot(ctx: WorkflowContext): string {
  return workspace(ctx).projectRoot;
}

export function callGymAgent<S extends TSchema>(
  ctx: WorkflowContext,
  agent: string,
  task: string,
  options: AgentCallOptions & { schema: S },
): Promise<GymAgentResult<Static<S>>>;
export function callGymAgent(
  ctx: WorkflowContext,
  agent: string,
  task: string,
  options?: AgentCallOptions,
): Promise<GymAgentResult>;
export async function callGymAgent(
  ctx: WorkflowContext,
  agent: string,
  task: string,
  options: AgentCallOptions & { schema?: TSchema } = {},
): Promise<GymAgentResult> {
  const result = options.schema
    ? await ctx.agents.call(agent, task, {
        ...options,
        schema: options.schema,
      })
    : await ctx.agents.call(agent, task, options);
  return {
    status: result.status,
    sessionId: result.id,
    lastAssistantText: result.summary,
    ...(result.output !== undefined ? { structuredResult: result.output } : {}),
    ...(result.cliCalls !== undefined ? { cliCalls: result.cliCalls } : {}),
  };
}

export function emitGymEvent(
  ctx: WorkflowContext,
  event: AppEvent<Record<string, unknown>>,
): Promise<void> {
  return ctx.events.emit(event);
}

export function gymEvent(
  type: string,
  data: Record<string, unknown>,
  options: Pick<AppEvent, "owner" | "source" | "target"> = {},
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data: { project: "gym", ...data },
    source: options.source ?? "app:gym",
    owner: options.owner ?? "app:gym",
    target: options.target ?? { appId: "gym", project: "gym" },
  };
}
