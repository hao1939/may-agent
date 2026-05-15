/// <reference path="../../types/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "arc-heartbeat";
export const description = "arc's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "arc");
