/// <reference path="../../types/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "scout-heartbeat";
export const description = "scout's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "scout");
