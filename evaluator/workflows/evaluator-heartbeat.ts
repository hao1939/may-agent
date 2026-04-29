/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "evaluator-heartbeat";
export const description = "evaluator's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "evaluator");
