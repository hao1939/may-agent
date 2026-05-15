/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "bob-heartbeat";
export const description = "bob's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "bob");
