import { expect, test } from "bun:test";
import { createTestAppRead, createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { validateGitHubPullRequestCondition } from "../../../../../shared/tools/github-pull-request.js";
import * as procedure from "./pull-request-wait.js";

for (const fingerprint of [null, "a".repeat(64)]) test(`builds a source-bound installed observer wait for ${fingerprint ? "rearm" : "initial snapshot"}`, async () => {
  const ctx = createTestAppWorkflowContext({
    input: {prompt: "Build the exact PR feedback wait", data: {id: "feedback", repository: "example/project", number: 42, fingerprint}},
    read: createTestAppRead({ contract: async appId => ({
      appId, agent: appId, inputSchema: {}, observations: [{
        appId, id: "github-pull-request", type: "alex.github.pull-request.state", description: "Test observer", intervalMs: 1000, timeoutMs: 1000,
      }],
    }) }),
  });
  const result = await procedure.execute(ctx);
  expect(result.status).toBe("done");
  const condition = (result.output as {condition: Parameters<typeof validateGitHubPullRequestCondition>[0]}).condition;
  expect(condition).toMatchObject({
    id: "feedback", type: "alex.github.pull-request.state", subject: "resource:github:example/project#42",
    expected: {field: "fingerprint", notEquals: fingerprint, source: "app:alex:observer:github-pull-request"},
    mode: "continuous",
  });
  expect(validateGitHubPullRequestCondition(condition, "alex")).toBeNull();
});

test("returns a blocker when the installed observer is absent", async () => {
  const result = await procedure.execute(createTestAppWorkflowContext({
    input: {prompt: "Build the exact PR feedback wait", data: {id: "feedback", repository: "example/project", number: 42, fingerprint: null}},
    read: createTestAppRead({contract: async appId => ({appId, agent: appId, inputSchema: {}, observations: []})}),
  }));
  expect(result.status).toBe("blocked");
  expect(result.output).toBeUndefined();
});
