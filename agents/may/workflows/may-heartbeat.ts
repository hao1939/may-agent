import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "@may-agent/sdk";

export const name = "may-heartbeat";
export const description = "may's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "may");
