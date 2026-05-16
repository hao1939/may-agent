import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "../../../shared/agent-sdk.ts";

export const name = "tech-lead-heartbeat";
export const description = "tech-lead's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "tech-lead");
