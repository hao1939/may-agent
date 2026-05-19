import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "@may-agent/sdk";

export const name = "bob-heartbeat";
export const description = "bob's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "bob");
