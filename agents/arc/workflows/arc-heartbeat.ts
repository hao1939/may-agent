import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "@may-agent/sdk";

export const name = "arc-heartbeat";
export const description = "arc's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "arc");
