/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "amy-kimi-heartbeat";
export const description = "amy-kimi's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "amy-kimi");
