import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "@may-agent/sdk";

export const name = "qa-heartbeat";
export const description = "qa's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "qa");
