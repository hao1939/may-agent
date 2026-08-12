import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute, verify } from "./approval-dispatch.ts";

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "aks-approval-dispatch-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(projectDir, "evidence", "archive"), { recursive: true });
  return { appDir, projectDir };
}

function runtimeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      event_type TEXT NOT NULL,
      source TEXT,
      owner TEXT,
      data TEXT,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE notification_messages (
      telegram_msg_id INTEGER PRIMARY KEY,
      event_type TEXT,
      agent TEXT,
      session_id TEXT,
      project_id TEXT,
      data TEXT,
      sent_at INTEGER
    );
  `);
  return db;
}

function stableIdPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function approvalLineage(pathId: string, packetPath: string) {
  const correlationKey = `aks-rp-e2e:approval:${stableIdPart(pathId)}:${stableIdPart(packetPath)}`;
  return {
    correlationKey,
    approvalId: correlationKey,
    waitId: `wait:${correlationKey}`,
  };
}

function triggerEvent(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``;
}

function reconciliationTask(task: Record<string, unknown>): string {
  return `## Reconciliation Task\n\`\`\`json\n${JSON.stringify(task, null, 2)}\n\`\`\``;
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
      },
    });
    expect(result.output).not.toHaveProperty("actions");
  });

  test("recovers packet delivery from a task tick when the runtime task preserves the approval tuple", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath =
      "evidence/archive/localdns-auto-default-mirrored-slice-cleanup-approval.md";
    await writeFile(
      join(projectDir, packetPath),
      "# exact packet\n\nApprove this exact mirrored-slice cleanup ask.\n",
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
        reconciliationTask({
          input: {
            approvalId:
              "aks-rp-e2e:approval:ops/request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723:evidence-archive-localdns-auto-default-mirrored-slice-cleanup-approval.md",
            packetPath,
            pathId:
              "ops/request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723",
            reason: "manual-approval-packet-dispatch-request",
            requestedAction:
              "Route this exact LocalDNS mirrored-slice cleanup packet through the human:operator lane.",
            summary:
              "Use the attached packet unchanged to request one bounded operator decision.",
            target: "human:operator",
            waitId:
              "wait:aks-rp-e2e:approval:ops/request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723:evidence-archive-localdns-auto-default-mirrored-slice-cleanup-approval.md",
          },
        }),
        triggerEvent({
          type: "project.task.tick",
          source: "control",
          owner: "project:aks-rp-e2e",
          target: {
            project: "aks-rp-e2e",
            taskId:
              "runtime/approval-dispatch/aks-rp-e2e-approval-ops-request-approval-localdns-auto-default-mirrored-slice-clean-9d041b4b0dff",
          },
          reason: "manual-runtime-approval-dispatch-pulse",
          data: {
            project: "aks-rp-e2e",
            taskId:
              "runtime/approval-dispatch/aks-rp-e2e-approval-ops-request-approval-localdns-auto-default-mirrored-slice-clean-9d041b4b0dff",
            task_id:
              "runtime/approval-dispatch/aks-rp-e2e-approval-ops-request-approval-localdns-auto-default-mirrored-slice-clean-9d041b4b0dff",
            reason: "manual-runtime-approval-dispatch-pulse",
          },
        }),
      ].join("\n"),
      agent: "app-ops",
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

    expect(result).toMatchObject({
      output: {
        state: "converged",
        summary: expect.stringContaining(
          "routed ops/request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723 to the declared AKS project owner",
        ),
        evidence: [
          "approval-dispatch:aks-rp-e2e:approval:ops-request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723:evidence-archive-localdns-auto-default-mirrored-slice-cleanup-approval.md:project-owner",
        ],
        actions: [],
      },
    });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "project.owner.requested",
      payload: {
        reason: "approval-owner-routing",
        params: {
          packetPath,
          pathId:
            "ops/request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723",
          requestedAction:
            "Route this exact LocalDNS mirrored-slice cleanup packet through the human:operator lane.",
          approvalId:
            "aks-rp-e2e:approval:ops/request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723:evidence-archive-localdns-auto-default-mirrored-slice-cleanup-approval.md",
          waitId:
            "wait:aks-rp-e2e:approval:ops/request-approval-localdns-auto-default-mirrored-slice-cleanup-20260723:evidence-archive-localdns-auto-default-mirrored-slice-cleanup-approval.md",
        },
      },
    });
  });

  test("emits a human message only for an explicit human authority boundary", async () => {
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
          authority: "human",
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
          authority: "human",
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
          authority: "human",
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
          authority: "human",
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

  test("suppresses duplicate message.created when durable delivery proof still exists", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath = "evidence/archive/network-cni-approval-packet.md";
    const pathId = "path.network-cni-azure-overlay-dual-stack-migration";
    const db = runtimeDb();
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
        pathId,
        requestedAction: "Approve one bounded live execution",
        authority: "human",
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

    const lineage = approvalLineage(pathId, packetPath);
    db.prepare(
      "INSERT INTO events (id, event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      101,
      "message.created",
      "agent:aks-explorer",
      "agent:aks-explorer",
      JSON.stringify({
        approvalId: lineage.approvalId,
        waitId: lineage.waitId,
        pathId,
        packetPath,
        correlationKey: lineage.correlationKey,
      }),
      Date.now(),
    );
    db.prepare(
      "INSERT INTO notification_messages (telegram_msg_id, event_type, agent, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      45271,
      "message.created",
      "aks-explorer",
      "projects/aks-rp-e2e.app",
      JSON.stringify({
        approvalId: lineage.approvalId,
        waitId: lineage.waitId,
        pathId,
        packetPath,
        correlationKey: lineage.correlationKey,
      }),
      Date.now(),
    );

    const second = await execute({
      task: baseTask,
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      getDb: () => db,
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
    expect(runs).toContain('"duplicateReason":"durable notification_messages proof still exists (45271)"');
    db.close();
  });

  test("allows redispatch after reviewed human non-delivery for the same lineage", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath =
      "evidence/archive/ops-request-origin-dev-wt-jaeayq-detached-node-modules-cleanup-approval-20260802-packet.md";
    const pathId =
      "ops/request-approval-origin-dev-wt-jaeayq-detached-node-modules-cleanup-20260802";
    const db = runtimeDb();
    await writeFile(
      join(projectDir, packetPath),
      "# exact packet\n\nApprove the bounded cleanup reroute.\n",
      "utf8",
    );

    const dispatched: Array<{
      type: string;
      payload: Record<string, unknown>;
    }> = [];

    const baseTask = [
      `app: ${appDir}`,
      `project: ${projectDir}`,
      "agent: app-ops",
      triggerEvent({
        type: "project.approval.requested",
        project: "aks-rp-e2e",
        packetPath,
        pathId,
        requestedAction:
          "Route this exact detached-worktree cleanup packet through the human lane.",
        authority: "human",
        reason: "Retry the exact approval lineage only after transport non-delivery is verified.",
      }),
    ].join("\n");

    const first = await execute({
      task: baseTask,
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

    dispatched.length = 0;
    const lineage = approvalLineage(pathId, packetPath);
    db.prepare(
      "INSERT INTO events (id, event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      4851137,
      "message.created",
      "agent:app-ops",
      "agent:app-ops",
      JSON.stringify({
        approvalId: lineage.approvalId,
        waitId: lineage.waitId,
        pathId,
        packetPath,
        correlationKey: lineage.correlationKey,
      }),
      Date.now(),
    );
    db.prepare(
      "INSERT INTO events (id, event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      4851530,
      "human.attention.reviewed",
      "telegram-outbound",
      "agent:may",
      JSON.stringify({
        sourceEventId: 4851137,
        mode: "enforce",
        admitted: false,
        delivered: false,
        attempts: 2,
        status: "failed",
      }),
      Date.now(),
    );

    const second = await execute({
      task: baseTask,
      agent: "app-ops",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent(type: string, payload: Record<string, unknown>) {
        dispatched.push({ type, payload });
      },
      getDb: () => db,
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(first.status).toBe("done");
    expect(second.status).toBe("done");
    expect(second.message).toContain(
      "Approval dispatch emitted message.created",
    );
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      type: "message.created",
      payload: {
        pathId,
        packetPath,
        approvalId: lineage.approvalId,
        waitId: lineage.waitId,
      },
    });

    const runs = await readFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      "utf8",
    );
    expect(runs).toContain('"result":"message.created"');
    expect(runs).not.toContain('"result":"duplicate-suppressed"');
    db.close();
  });

  test("verifies converged dispatch work from trusted message.created proof", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath = "evidence/archive/network-cni-approval-packet.md";
    const pathId = "path.network-cni-azure-overlay-dual-stack-migration";
    const lineage = approvalLineage(pathId, packetPath);
    await writeFile(
      join(projectDir, packetPath),
      "# exact packet\n\nPlease approve the bounded replay.\n",
      "utf8",
    );
    await writeFile(
      join(appDir, ".state", "approval-dispatch-runs.jsonl"),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        workflow: "approval-dispatch",
        result: "message.created",
        correlationKey: lineage.correlationKey,
        packetAbsolutePath: join(projectDir, packetPath),
        approvalId: lineage.approvalId,
        waitId: lineage.waitId,
        pathId,
      })}\n`,
      "utf8",
    );

    const verified = await verify(
      {
        appId: "aks-rp-e2e",
        taskId: pathId,
        generation: 1,
        appDir,
        projectDir,
        workspaceDir: projectDir,
        intent: {
          id: pathId,
          parentId: "group/app-operations",
          outcome: "Dispatch one exact approval packet.",
          acceptance: [],
          mode: "achieve",
          owner: "app-ops",
          workflow: "approval-dispatch",
          input: {
            approvalId: lineage.approvalId,
            waitId: lineage.waitId,
            pathId,
            packetPath,
            authority: "human",
            target: "human:operator",
          },
        },
      },
      {
        state: "converged",
        summary: "Approval dispatch emitted message.created.",
        evidence: [`approval-dispatch:${lineage.correlationKey}`],
        actions: [],
      },
    );

    expect(verified).toEqual({
      accepted: true,
      summary:
        `Verified approval-dispatch handoff for ${pathId} from durable message.created proof.`,
      evidence: [
        `approval-dispatch:${lineage.correlationKey}`,
        "ledger-result:message.created",
        "deterministic:owner-handoff-postcondition",
      ],
    });
  });

  test("verifies converged dispatch work from exact project.approval.requested/message.created proof", async () => {
    const { appDir, projectDir } = await makeWorkspace();
    const packetPath =
      "evidence/archive/ops-request-master-validation-api-proxy-chaos-rp-proxy-kubeconfig-capability-20260806-packet.md";
    const pathId =
      "path.traffic-api-proxy.chaos-rp-proxy-kubeconfig-capability-20260806";
    const lineage = approvalLineage(pathId, packetPath);
    await writeFile(
      join(projectDir, packetPath),
      "# exact packet\n\nRoute the exact chaos kubeconfig capability ask.\n",
      "utf8",
    );

    const verified = await verify(
      {
        appId: "aks-rp-e2e",
        taskId:
          "ops/request-approval-master-validation-api-proxy-chaos-rp-proxy-kubeconfig-capability-20260806",
        generation: 1,
        appDir,
        projectDir,
        workspaceDir: projectDir,
        intent: {
          id: "ops/request-approval-master-validation-api-proxy-chaos-rp-proxy-kubeconfig-capability-20260806",
          parentId: "domain/master-validation-failure/spec.traffic-api-proxy.chaos",
          outcome: "Deliver one exact approval-dispatch request.",
          acceptance: [],
          mode: "achieve",
          owner: "app-ops",
          workflow: "approval-dispatch",
          input: {
            packetPath,
            pathId,
            approvalId: lineage.approvalId,
            waitId: lineage.waitId,
            authority: "human",
            target: "human:operator",
          },
        },
      },
      {
        state: "converged",
        summary:
          "Controller-visible proof exists for this exact lineage: project.approval.requested id 5144207 and message.created id 5145219 were emitted.",
        evidence: [
          packetPath,
          pathId,
          lineage.approvalId,
          lineage.waitId,
          "project.approval.requested id 5144207",
          "message.created id 5145219",
        ],
        actions: [],
      },
    );

    expect(verified).toEqual({
      accepted: true,
      summary:
        `Verified approval-dispatch handoff for ${pathId} from exact owner-returned event proof.`,
      evidence: [
        `approval-dispatch:${lineage.correlationKey}`,
        "event-proof:project.approval.requested+message.created",
        "deterministic:owner-handoff-postcondition",
      ],
    });
  });
});
