import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { taskEscalationPacket } from "./project-health-evaluator.ts";

async function makeAppDirWithTree(tree: Record<string, unknown>) {
  const appDir = await mkdtemp(join(tmpdir(), "project-health-evaluator-"));
  await mkdir(join(appDir, ".state", "tasks"), { recursive: true });
  await writeFile(
    join(appDir, ".state", "tasks", "tree.json"),
    `${JSON.stringify(tree, null, 2)}\n`,
    "utf8",
  );
  return appDir;
}

describe("project health evaluator escalation audit", () => {
  test("blocked wait linkage reads structured blocker fields", async () => {
    const appDir = await makeAppDirWithTree({
      tasks: {
        project: {
          id: "project",
          state: "active",
          children: ["wait-runtime-input"],
        },
        "wait-runtime-input": {
          id: "wait-runtime-input",
          parent_id: "project",
          state: "blocked",
          children: [],
          goal: "Hold exact external runtime input wait.",
          blocker: {
            condition: "Missing approved underlay kubeconfig.",
            category: "external-wait",
            owner: "human",
            waiting_for: {
              type: "owner.decision",
              approvalId: "approval-underlay-kubeconfig",
            },
            resume_condition:
              "Resume when the owner returns the approved kubeconfig.",
            next_check_at: "2999-01-01T00:00:00.000Z",
            fallback_at: "2999-01-02T00:00:00.000Z",
            fallback_action: "Send one bounded follow-up.",
          },
        },
      },
    });

    const packet = taskEscalationPacket(appDir);

    expect(packet.counts).toMatchObject({
      blockedLeaves: 1,
      blockedWithEscalationHint: 1,
      blockedWithOwnerOrExternalPath: 1,
      blockedWithoutOwnerOrExternalPath: 0,
    });
  });
});
