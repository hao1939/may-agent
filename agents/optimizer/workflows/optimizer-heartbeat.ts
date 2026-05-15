/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "optimizer-heartbeat";
export const description = "optimizer's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "optimizer");
