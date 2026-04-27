/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "tech-lead-heartbeat";
export const description = "tech-lead's heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "tech-lead");
