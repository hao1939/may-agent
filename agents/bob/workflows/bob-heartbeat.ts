import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "bob-heartbeat";
export const description = "bob's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "bob");
