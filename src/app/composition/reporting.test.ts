import { expect, it, spyOn } from "bun:test";
import { createAppReporting } from "./reporting.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { buildAgentSDK } from "../../lib/sdk-impl.js";
import * as metrics from "../../lib/metrics.js";
import * as query from "../../lib/query-service.js";
import { EventBus } from "../event-bus.js";

it("does not construct reporting services merely to prepare runtime/SDK capabilities", () => {
  const metricFactory = spyOn(metrics, "createMetricService");
  const queryFactory = spyOn(query, "createQueryService");
  try {
    const options = {
      bus: new EventBus(),
      agentName: "fixture",
      persistDir: "/unused/state",
      projectRoot: "/unused",
      agentsRoot: "/unused/agents",
      sharedRoot: "/unused/shared",
      projectsRoot: "/unused/projects",
    };
    buildRuntimeCtx(options);
    buildAgentSDK(options);
    const reports = createAppReporting(() => {
      throw new Error("read was not requested");
    });
    reports.syncDefinitions([]);
    expect(metricFactory).not.toHaveBeenCalled();
    expect(queryFactory).not.toHaveBeenCalled();
  } finally {
    metricFactory.mockRestore();
    queryFactory.mockRestore();
  }
});
