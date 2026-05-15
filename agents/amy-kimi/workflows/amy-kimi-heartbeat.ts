import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "../../../shared/workflows/heartbeat-data.js";

export const name = "amy-kimi-heartbeat";
export const description = "amy-kimi's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "amy-kimi");
