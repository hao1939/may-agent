import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "@may-agent/sdk";

export const name = "tech-lead-heartbeat";
export const description = "tech-lead's heartbeat.";
export const execute = (ctx: WorkflowContext) =>
  genericHeartbeat(ctx, "tech-lead");
