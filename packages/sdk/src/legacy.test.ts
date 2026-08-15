import { describe, expect, test } from "bun:test";
import {
  defineProjectApp,
  eventDetails,
  projectAppTaskHandlerResultSchema,
  projectRuntimePaths,
  workflowResultVersion,
} from "@may-agent/sdk/legacy";

describe("legacy ProjectApp compatibility", () => {
  test("loads the staged package subpath with the AKS app runtime values", () => {
    expect(typeof defineProjectApp).toBe("function");
    expect(typeof eventDetails).toBe("function");
    expect(typeof projectRuntimePaths).toBe("function");
    expect(projectAppTaskHandlerResultSchema).toBeDefined();
    expect(workflowResultVersion).toBe("workflow-result-v1");
  });

  test("requires only the concurrency budget used by the runtime", () => {
    const app = defineProjectApp({
      id: "legacy-app",
      version: 1,
      owner: "owner",
      description: "Legacy ProjectApp consumer",
      budget: { maxConcurrent: 2 },
    });

    expect(app.budget).toEqual({ maxConcurrent: 2 });
  });

  test("continues to accept retired daily caps during migration", () => {
    const app = defineProjectApp({
      id: "older-legacy-app",
      version: 1,
      owner: "owner",
      description: "Older ProjectApp consumer",
      budget: {
        sessionsPerDay: 10,
        tokensPerDay: 100_000,
        maxConcurrent: 1,
      },
    });

    expect(app.budget?.maxConcurrent).toBe(1);
  });
});
