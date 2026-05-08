/// <reference path="../../types/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "dev-heartbeat";
export const description = "dev's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "dev");
