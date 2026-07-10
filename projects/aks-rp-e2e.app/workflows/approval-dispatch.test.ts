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
