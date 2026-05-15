import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "evaluator-heartbeat";
export const description = "evaluator's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "evaluator");
