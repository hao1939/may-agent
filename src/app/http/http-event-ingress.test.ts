import { describe, expect, it } from "bun:test";

import {
  buildEventIngressFrame,
} from "./server.js";

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

describe("HTTP project comment App ingress", () => {
  const command = buildAppAdmissionCommand({
    projectPath: "projects/alpha-project.app",
    projectId: "alpha-project",
    comment: "Review the current normalization gap.",
    idempotencyKey: "project-comment-17",
  });

  it("addresses Web UI project comments through explicit App admission", () => {
    expect(command).toEqual({
      type: "publish",
      event: {
        type: "app.input.requested",
        target: { appId: "alpha-project" },
        data: {
          input: {
            kind: "message",
            data: {
              message: "Review the current normalization gap.",
              context: {
                intent: "project-comment",
                projectId: "alpha-project",
                projectPath: "projects/alpha-project.app",
              },
            },
          },
          source: { kind: "human", id: "web-ui:project-comment-17" },
          conversationId: "web-ui:project:alpha-project",
          channel: "web-ui",
        },
        idempotencyKey: "project-comment-17",
      },
    });
  });
});
