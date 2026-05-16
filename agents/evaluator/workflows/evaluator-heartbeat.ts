import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "../../../shared/agent-sdk.ts";

export const name = "evaluator-heartbeat";
export const description = "evaluator's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "evaluator");
