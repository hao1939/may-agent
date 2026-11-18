import { describe, expect, it } from "bun:test";

import { buildEventIngressFrame } from "./server.js";

describe("HTTP event ingress acknowledgement recovery", () => {
  it("persists top-level event contract fields inside canonical data", () => {
    expect(
      buildEventIngressFrame(
        {
          type: "project.approval.submitted",
          approvalId: "approval-52",
          taskId: "improve/may",
          taskGeneration: 52,
          artifactFingerprint: "sha256:artifact",
          decision: "approve",
          data: { projectId: "gym", projectPath: "/app/projects/gym.app/project.json" },
        },
      ),
    ).toEqual({
      type: "publish",
      event: {
        type: "project.approval.submitted",
        target: { taskId: "improve/may" },
        data: {
          projectId: "gym",
          projectPath: "/app/projects/gym.app/project.json",
          approvalId: "approval-52",
          taskId: "improve/may",
          taskGeneration: 52,
          artifactFingerprint: "sha256:artifact",
          decision: "approve",
        },
      },
    });
  });
});
