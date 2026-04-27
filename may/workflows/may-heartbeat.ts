/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "may-heartbeat";
export const description = "may's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "may");
