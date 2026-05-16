import type { WorkflowContext } from "@may-agent/sdk";
import { genericHeartbeat } from "../../../shared/agent-sdk.ts";

export const name = "dev-heartbeat";
export const description = "dev's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "dev");
