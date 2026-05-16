import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "../../../shared/agent-sdk.ts";

export const name = "optimizer-heartbeat";
export const description = "optimizer's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "optimizer");
