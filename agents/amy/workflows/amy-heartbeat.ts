import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.ts";
export const name = "amy-heartbeat";
export const description = "Amy's XHS research heartbeat";
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return genericHeartbeat(ctx, "amy");
}
