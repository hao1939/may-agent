import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute } from "./approval-dispatch.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-approval-dispatch-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(projectDir, "evidence", "archive"), { recursive: true });
  return { appDir, projectDir };
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

describe("approval-dispatch workflow", () => {
  test("returns owner fallback when the requested packet is unavailable", async () => {
    const { appDir, projectDir } = await makeWorkspace();

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.approval.requested",
          project: "aks-rp-e2e",
          packetPath: "evidence/archive/missing-packet.md",
          pathId: "path.missing-packet",
          requestedAction: "Review the missing packet",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string, output?: unknown) => ({
        status: "done",
        message,
        output,
      }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result).toMatchObject({
      output: {
        state: "needs-owner",
        summary: expect.stringContaining("was not found"),
        evidence: ["approval-dispatch:path.missing-packet:packet-not-found"],
        actions: [],
      },
    });
  });

  test("emits packet-linked message.created record for an approval packet", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath = "evidence/archive/network-cni-approval-packet.md";
    await writeFile(
      join(projectDir, packetPath),
      "# exact packet\n\nPlease approve the bounded replay.\n",
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        triggerEvent({
          type: "project.approval.requested",
          project: "aks-rp-e2e",
          packetPath,
          pathId: "path.network-cni-azure-overlay-dual-stack-migration",
          requestedAction: "Approve one bounded live execution",
          reason: "Need durable local send proof for the exact packet.",
          summary:
            "This is the exact execute-approval packet for the migration replay.",
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string, output?: unknown) => ({
        status: "done",
        message,
        output,
      }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Approval dispatch emitted message.created",
    );
    expect(result).toMatchObject({
      output: {
        state: "converged",
        summary: expect.stringContaining(
          "Approval dispatch emitted message.created",
        ),
        evidence: [
          "approval-dispatch:aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
        ],
        actions: [],
      },
    });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "message.created",
      payload: {
        from: "aks-explorer",
        to: "human",
        intent: "approval-packet-dispatch",
        project: "aks-rp-e2e",
        projectId: "projects/aks-rp-e2e.app",
        projectPath: "projects/aks-rp-e2e.app",
        packetPath,
        pathId: "path.network-cni-azure-overlay-dual-stack-migration",
        requestedAction: "Approve one bounded live execution",
        approval: {
          kind: "approval-packet-dispatch",
          approvalId:
            "aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
          waitId:
            "wait:aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
          pathId: "path.network-cni-azure-overlay-dual-stack-migration",
          packetPath,
          directEvent: {
            type: "project.approval.submitted",
            project: "aks-rp-e2e",
            projectPath: "projects/aks-rp-e2e.app",
            approvalKind: "approval-packet-dispatch",
            approvalId:
              "aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
            waitId:
              "wait:aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
            pathId: "path.network-cni-azure-overlay-dual-stack-migration",
            packetPath,
          },
        },
        approvalId:
          "aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
        waitId:
          "wait:aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
        correlationKey:
          "aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
        expectedResponse: {
          type: "project.approval.submitted",
          approvalKind: "approval-packet-dispatch",
          approvalId:
            "aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
          waitId:
            "wait:aks-rp-e2e:approval:path.network-cni-azure-overlay-dual-stack-migration:evidence-archive-network-cni-approval-packet.md",
        },
      },
    });
    expect(String(dispatched[0].payload.content)).toContain("Approval id:");
    expect(String(dispatched[0].payload.content)).toContain("Wait id:");
    expect(String(dispatched[0].payload.content)).toContain(packetPath);
    expect(String(dispatched[0].payload.content)).toContain(
      "path.network-cni-azure-overlay-dual-stack-migration",
    );
    expect(String(dispatched[0].payload.content)).toContain(
      "Reply to this notification with one bounded decision",
    );
    expect(String(dispatched[0].payload.content)).toContain(
      "project.approval.submitted",
    );
    expect(String((dispatched[0].payload as any).dedupKey)).toContain(
      "path.network-cni-azure-overlay-dual-stack-migration",
    );

    const runs = await readFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"workflow":"approval-dispatch"');
    expect(runs).toContain('"result":"message.created"');
    expect(runs).toContain(packetPath);
    expect(runs).toContain('"approvalId"');
    expect(runs).toContain('"waitId"');
    expect(runs).toContain('"expectedResponse"');
  });

  test("normalizes absolute app-workspace evidence/archive packets to repo-relative packet paths", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath = "evidence/archive/app-rooted-approval-packet.md";
    const appPacketPath = join(appDir, packetPath);
    await mkdir(join(appDir, "evidence", "archive"), { recursive: true });
    await writeFile(
      appPacketPath,
      "# app-rooted packet\n\nRoute this exact approval.\n",
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: app-ops",
        triggerEvent({
          type: "project.approval.requested",
          project: "aks-rp-e2e",
          packetPath: appPacketPath,
          pathId: "path.rp-nodepool-lifecycle.rollback",
          requestedAction: "Route this exact rollback-history environment ask",
          reason: "App-owned evidence packet should still dispatch.",
        }),
      ].join("\n"),
      agent: "app-ops",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Approval dispatch emitted message.created",
    );
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "message.created",
      payload: {
        packetPath,
        packetAbsolutePath: appPacketPath,
        pathId: "path.rp-nodepool-lifecycle.rollback",
        approvalId:
          "aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-app-rooted-approval-packet.md",
        waitId:
          "wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-app-rooted-approval-packet.md",
        approval: {
          packetPath,
        },
      },
    });

    const runs = await readFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"result":"message.created"');
    expect(runs).toContain(`"packetPath":"${packetPath}"`);
    expect(runs).toContain(appPacketPath);
  });

  test("ignores malformed local-only ledger rows when deciding duplicate suppression", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath =
      "evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md";
    await mkdir(join(appDir, "evidence", "archive"), { recursive: true });
    await writeFile(
      join(appDir, packetPath),
      "# exact packet\n\nRoute this exact rollback-history environment ask.\n",
      "utf8",
    );
    await writeFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      [
        JSON.stringify({
          ts: "2026-07-16T19:25:04.292Z",
          workflow: "approval-dispatch",
          result: "message.created",
          packetPath,
          packetAbsolutePath: packetPath,
          pathId: "path.rp-nodepool-lifecycle.rollback",
          requestedAction:
            "Route this exact rollback-history environment ask through the human:operator lane for spec.rp-nodepool-lifecycle.rollback.",
          approvalId:
            "aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md",
          waitId:
            "wait:aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md",
          correlationKey:
            "aks-rp-e2e:approval:path.rp-nodepool-lifecycle.rollback:evidence-archive-ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md",
        }),
      ].join("\n") + "\n",
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: app-ops",
        triggerEvent({
          type: "project.approval.requested",
          project: "aks-rp-e2e",
          packetPath,
          pathId: "path.rp-nodepool-lifecycle.rollback",
          requestedAction:
            "Route this exact rollback-history environment ask through the human:operator lane for spec.rp-nodepool-lifecycle.rollback.",
          reason:
            "Re-emit only when prior duplicate proof was local-only ledger contamination.",
        }),
      ].join("\n"),
      agent: "app-ops",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain(
      "Approval dispatch emitted message.created",
    );
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "message.created",
      payload: {
        packetPath,
        packetAbsolutePath: join(appDir, packetPath),
        pathId: "path.rp-nodepool-lifecycle.rollback",
      },
    });

    const runs = await readFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain(
      '"packetAbsolutePath":"evidence/archive/ops-escalate-spec-rp-nodepool-lifecycle-rollback-no-rollback-history-20260716.md"',
    );
    expect(runs).toContain(
      `"packetAbsolutePath":"${join(appDir, packetPath)}"`,
    );
    expect(runs).not.toContain('"result":"duplicate-suppressed"');
  });

  test("suppresses duplicate message.created for the same approval lineage", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath = "evidence/archive/network-cni-approval-packet.md";
    await writeFile(
      join(projectDir, packetPath),
      "# exact packet\n\nPlease approve the bounded replay.\n",
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const baseTask = [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      "agent: aks-explorer",
      triggerEvent({
        type: "project.approval.requested",
        project: "aks-rp-e2e",
        packetPath,
        pathId: "path.network-cni-azure-overlay-dual-stack-migration",
        requestedAction: "Approve one bounded live execution",
        reason: "Need durable local send proof for the exact packet.",
        summary:
          "This is the exact execute-approval packet for the migration replay.",
      }),
    ].join("\n");

    const first = await execute({
      task: baseTask,
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    const second = await execute({
      task: baseTask,
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(first.status).toBe("done");
    expect(second.status).toBe("done");
    expect(second.message).toContain(
      "Approval dispatch suppressed duplicate message.created",
    );
    expect(dispatched).toHaveLength(1);

    const runs = await readFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"result":"message.created"');
    expect(runs).toContain('"result":"duplicate-suppressed"');
  });
});
