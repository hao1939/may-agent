import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppEvent, TaskIntent, TaskReconcileResult } from "@may-agent/sdk";
import { execute, verify } from "./approval-dispatch.ts";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-approval-dispatch-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  const packetPath = "evidence/archive/network-approval.md";
  await mkdir(join(appDir, "evidence", "archive"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(appDir, packetPath), "# Network approval\n", "utf8");
  return { appDir, projectDir, packetPath };
}

function context(input: {
  appDir: string;
  projectDir: string;
  taskInput: Record<string, unknown>;
  trigger?: AppEvent<Record<string, unknown>>;
  events?: AppEvent[];
}) {
  return {
    input: input.taskInput,
    reconciliation: {
      appId: "aks-rp-e2e",
      taskId: "runtime/approval-dispatch/test",
      generation: 1,
      resourceVersion: 1,
      agent: "app-ops",
      mode: "achieve",
      outcome: "Dispatch one approval",
      acceptance: ["The exact decision route is admitted."],
      input: input.taskInput,
      children: { live: [], completed: [] },
      events: {
        items: input.trigger
          ? [
              {
                observedAt: "2026-08-21T00:00:00.000Z",
                event: input.trigger,
              },
            ]
          : [],
        truncated: false,
      },
    },
    workspace: {
      appRoot: input.appDir,
      projectRoot: input.projectDir,
      root: input.projectDir,
      output: input.projectDir,
    },
    events: {
      async emit(event: AppEvent) {
        input.events?.push(event);
      },
    },
    done(summary: string, output?: unknown) {
      return {
        id: "workflow:test",
        kind: "workflow",
        status: "done",
        summary,
        output,
      };
    },
  } as any;
}

function approvalInput(
  packetPath: string,
  extra: Record<string, unknown> = {},
) {
  return {
    packetPath,
    pathId: "path.network-cni",
    requestedAction: "Approve the bounded network change",
    reason: "Network change requires decision",
    summary: "The packet contains exact verification evidence.",
    ...extra,
  };
}

function intent(input: Record<string, unknown>): TaskIntent {
  return {
    id: "runtime/approval-dispatch/test",
    parentId: "group/app-operations",
    outcome: "Dispatch one approval",
    acceptance: ["The exact route is admitted."],
    mode: "achieve",
    input,
  };
}

describe("approval-dispatch workflow", () => {
  test("reports missing required lineage without creating a side ledger", async () => {
    const { appDir, projectDir } = await fixture();
    const events: AppEvent[] = [];

    const result = await execute(
      context({ appDir, projectDir, taskInput: {}, events }),
    );

    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "needs-agent",
        evidence: ["approval-dispatch:missing-required-fields"],
      },
    });
    expect(events).toEqual([]);
  });

  test("hands owner-authority decisions back to the same task", async () => {
    const { appDir, projectDir, packetPath } = await fixture();
    const events: AppEvent[] = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        taskInput: approvalInput(packetPath),
        events,
      }),
    );

    expect(result).toMatchObject({
      output: {
        state: "needs-agent",
        evidence: expect.arrayContaining([
          "owner-handoff:approval-dispatch",
          "path-id:path.network-cni",
          `packet:${packetPath}`,
        ]),
      },
    });
    expect(events).toEqual([]);
  });

  test("durably emits an idempotent human decision request", async () => {
    const { appDir, projectDir, packetPath } = await fixture();
    const events: AppEvent[] = [];

    const result = await execute(
      context({
        appDir,
        projectDir,
        taskInput: approvalInput(packetPath, {
          authority: "human",
          target: "human:operator",
        }),
        events,
      }),
    );

    expect(result).toMatchObject({
      output: {
        state: "converged",
        evidence: expect.arrayContaining(["event:message.created"]),
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "message.created",
      target: { appId: "aks-rp-e2e", project: "aks-rp-e2e", human: true },
      data: {
        from: "app-ops",
        to: "human:operator",
        intent: "approval-packet-dispatch",
        pathId: "path.network-cni",
        packetPath,
        approvalId:
          "aks-rp-e2e:approval:path.network-cni:evidence-archive-network-approval.md",
        waitId:
          "wait:aks-rp-e2e:approval:path.network-cni:evidence-archive-network-approval.md",
        idempotencyKey:
          "aks-rp-e2e:approval:path.network-cni:evidence-archive-network-approval.md",
      },
    });
  });

  test("preserves explicit approval and wait identities", async () => {
    const { appDir, projectDir, packetPath } = await fixture();
    const events: AppEvent[] = [];
    await execute(
      context({
        appDir,
        projectDir,
        taskInput: approvalInput(packetPath, {
          requiresHumanDecision: true,
          approvalId: "approval:exact",
          waitId: "wait:exact",
        }),
        events,
      }),
    );

    expect(events[0]?.data).toMatchObject({
      approvalId: "approval:exact",
      waitId: "wait:exact",
      approval: {
        approvalId: "approval:exact",
        waitId: "wait:exact",
        directEvent: {
          approvalId: "approval:exact",
          waitId: "wait:exact",
        },
      },
    });
  });

  test("rejects a packet outside evidence/archive", async () => {
    const { appDir, projectDir } = await fixture();
    await writeFile(join(projectDir, "outside.md"), "not an approval packet\n");

    const result = await execute(
      context({
        appDir,
        projectDir,
        taskInput: approvalInput("outside.md", { authority: "human" }),
      }),
    );

    expect(result).toMatchObject({
      output: {
        state: "needs-agent",
        evidence: [
          "approval-dispatch:path.network-cni:packet-outside-evidence-archive",
        ],
      },
    });
  });

  test("verifies exact human delivery evidence without querying runtime storage", async () => {
    const packetPath = "evidence/archive/network-approval.md";
    const taskInput = approvalInput(packetPath, { authority: "human" });
    const correlationKey =
      "aks-rp-e2e:approval:path.network-cni:evidence-archive-network-approval.md";
    const result: TaskReconcileResult = {
      state: "converged",
      summary: `Delivered path.network-cni from ${packetPath}`,
      evidence: [
        `approval-id:${correlationKey}`,
        `wait-id:wait:${correlationKey}`,
        "event:message.created",
      ],
    };

    await expect(
      verify(
        {
          appId: "aks-rp-e2e",
          taskId: "runtime/approval-dispatch/test",
          generation: 1,
          workspaceDir: "/tmp/worktree",
          intent: intent(taskInput),
        },
        result,
      ),
    ).resolves.toMatchObject({ accepted: true });
  });

  test("rejects a converged result without its selected route proof", async () => {
    const packetPath = "evidence/archive/network-approval.md";
    await expect(
      verify(
        {
          appId: "aks-rp-e2e",
          taskId: "runtime/approval-dispatch/test",
          generation: 1,
          workspaceDir: "/tmp/worktree",
          intent: intent(approvalInput(packetPath, { authority: "human" })),
        },
        {
          state: "converged",
          summary: "No durable route proof",
          evidence: [],
        },
      ),
    ).resolves.toMatchObject({
      accepted: false,
      evidence: expect.arrayContaining([
        "expected-route:event:message.created",
      ]),
    });
  });
});
