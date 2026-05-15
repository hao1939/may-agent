/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "qa-heartbeat";
export const description = "qa's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "qa");
