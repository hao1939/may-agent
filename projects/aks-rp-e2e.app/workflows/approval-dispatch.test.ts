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
      },
    });
    expect(String(dispatched[0].payload.content)).toContain(packetPath);
    expect(String(dispatched[0].payload.content)).toContain(
      "path.network-cni-azure-overlay-dual-stack-migration",
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
  });
});
