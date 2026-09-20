import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  buildApprovalProposal,
  packetHash,
  type ApprovalPacket,
} from "../../../improvement-approval";
import { runActivationFollowUp } from "./improvement-activation-follow-up";

function fixture(withActivation = true) {
  const root = mkdtempSync(join(tmpdir(), "may-activation-"));
  const repository = join(root, "repo");
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
    }).trim();
  execFileSync("git", ["init", "-b", "main", repository]);
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.test");
  writeFileSync(join(repository, "definition.txt"), "before\n");
  git("add", ".");
  git("commit", "-m", "baseline");
  const baselineCommit = git("rev-parse", "HEAD");
  writeFileSync(join(repository, "definition.txt"), "after\n");
  git("commit", "-am", "candidate");
  const candidateCommit = git("rev-parse", "HEAD");
  const diff = execFileSync("git", [
    "-C",
    repository,
    "diff",
    "--binary",
    "--no-ext-diff",
    "--no-renames",
    baselineCommit,
    candidateCommit,
  ]);
  const sha = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");
  const verification = "verified\n";
  const comparison = "compared\n";
  const body: Omit<ApprovalPacket, "packetHash"> = {
    baselineCommit,
    candidateCommit,
    candidateTreeHash: git("rev-parse", "HEAD^{tree}"),
    diffSha256: sha(diff),
    verificationSha256: sha(verification),
    comparisonSha256: sha(comparison),
    activationScope: `git-fast-forward:${repository}`,
    ...(withActivation
      ? {
          activation: {
            appId: "may-agent",
            operation: "runtime.reload.requested",
            target: "installed-app-definitions",
          },
        }
      : {}),
    rollbackCommit: baselineCommit,
  };
  const packet = { ...body, packetHash: packetHash(body) };
  const files = {
    repository,
    packet: join(root, "packet.json"),
    diff: join(root, "diff.patch"),
    verification: join(root, "verification.txt"),
    comparison: join(root, "comparison.txt"),
  };
  writeFileSync(files.packet, JSON.stringify(packet));
  writeFileSync(files.diff, diff);
  writeFileSync(files.verification, verification);
  writeFileSync(files.comparison, comparison);
  const proposal = buildApprovalProposal({
    packet,
    task: { appId: "may", taskId: "goal/improvement", generation: 2 },
    revision: 1,
    finding: {
      disposition: "improve",
      userImpact: "A real issue",
      recurrenceOrRisk: "Could recur",
      evidenceAndConfidence: "Fixture evidence",
      doNothingOrSimplerAlternative: "Reuse reload",
    },
    candidate: {
      disposition: "present-for-approval",
      verifiedBenefit: "Pinned reload",
      regressionRisk: "Narrow",
      implementationCost: "Small",
      ongoingCost: "None",
      scopeAndLimitations: "Fixture",
      simplerAlternative: "Existing operation",
      worthApplying: "Yes",
    },
  });
  const sourceReceipt = join(root, "source-receipt.json");
  writeFileSync(
    sourceReceipt,
    JSON.stringify({
      stage: "source-application",
      applied: true,
      appliedCommit: candidateCommit,
      authority: {
        kind: "trusted-journal-event",
        eventId: 42,
        packetHash: packet.packetHash,
        proposalHash: proposal.proposalHash,
        conditionId: proposal.conditionId,
      },
    }),
  );
  return {
    packet,
    proposal,
    sourceReceipt,
    files,
    input: {
      files,
      proposal,
      approvalEventId: 42,
      sourceReceipt,
      newSubjectTask: {
        appId: "may" as const,
        taskId: "goal/new-subject",
        generation: 1,
      },
    },
  };
}

function context(
  f: ReturnType<typeof fixture>,
  reload?: { ok: boolean; sourceCommit?: string },
  subject = true,
) {
  const approval = {
    eventId: 42,
    observedAt: new Date(0).toISOString(),
    event: {
      type: "project.approval.submitted",
      source: "telegram",
      target: { appId: "may", taskId: "goal/improvement" },
      data: {
        approvalId: f.proposal.approvalId,
        packetHash: f.proposal.packetHash,
        proposalHash: f.proposal.proposalHash,
        proposalRevision: f.proposal.proposalRevision,
        taskGeneration: 2,
        conditionId: f.proposal.conditionId,
        decision: "approve",
        provenance: {
          provider: "telegram",
          authenticatedSenderId: "7",
          sourceMessageId: 10,
          replyToMessageId: 9,
        },
      },
    },
  };
  const items: any[] = [approval];
  if (reload)
    items.push({
      eventId: 77,
      observedAt: new Date(1).toISOString(),
      event: {
        type: "runtime.reload.finished",
        source: "runtime",
        data: {
          requestId: `improvement-activation:${f.packet.packetHash}`,
          ...reload,
        },
      },
    });
  const ctx = createTestAppWorkflowContext({
    input: f.input,
    reconciliation: {
      taskId: "goal/improvement",
      generation: 2,
      events: { items, truncated: false },
    } as any,
    readEvent: async () =>
      reload
        ? {
            eventId: 66,
            data: {
              requestId: `improvement-activation:${f.packet.packetHash}`,
              expectedSourceCommit: f.packet.candidateCommit,
              approvalEventId: 42,
              packetHash: f.packet.packetHash,
              proposalHash: f.proposal.proposalHash,
              taskId: "goal/improvement",
              taskGeneration: 2,
              conditionId: f.proposal.conditionId,
            },
          }
        : null,
  });
  const conditionSpec = {
    type: "project.approval.submitted",
    subject: `approvalId:${f.proposal.approvalId}`,
    expected: {
      approvalId: f.proposal.approvalId,
      packetHash: f.proposal.packetHash,
      proposalHash: f.proposal.proposalHash,
      proposalRevision: 1,
      taskGeneration: 2,
      conditionId: f.proposal.conditionId,
    },
    owner: "human",
    requestedAction: f.proposal.text,
    reviewAfterMs: 1,
  };
  const owner = {
    appId: "may",
    taskId: "goal/improvement",
    generation: 2,
    status: "waiting",
    terminal: false,
    diagnostics: {
      conditions: [
        {
          id: f.proposal.conditionId,
          condition: { spec: conditionSpec, status: { state: "true" } },
        },
      ],
    },
  };
  const provider = {
    getEvent: async (id: number) => {
      if (id === 42) return { ...approval.event, id: 42 };
      if (id === 77 && reload)
        return {
          id: 77,
          type: "runtime.reload.finished",
          source: "runtime",
          timestamp: 1_000,
          data: {
            requestId: `improvement-activation:${f.packet.packetHash}`,
            ...reload,
          },
        };
      throw new Error(`missing event ${id}`);
    },
    getTask: async (appId: string, taskId: string) => {
      if (appId === "may" && taskId === "goal/improvement") return owner;
      if (subject && taskId === "goal/new-subject")
        return {
          appId,
          taskId,
          generation: 1,
          status: "up-to-date",
          updatedAt: 1_002,
          acceptedAttempt: {
            id: "attempt-new",
            generation: 1,
            startedAt: new Date(1_001).toISOString(),
            finishedAt: new Date(1_002).toISOString(),
          },
          history: [
            {
              eventType: "project.task.reconciled",
              timestamp: 1_002,
              attemptId: "attempt-new",
              generation: 1,
              disposition: "converged",
            },
            {
              eventType: "project.task.reconcile.started",
              timestamp: 1_001,
              attemptId: "attempt-new",
              generation: 1,
            },
          ],
        };
      return {};
    },
    getAppTask: async () => ({}),
  };
  (ctx as any).evidenceProvider = provider;
  return ctx;
}

async function execute(ctx: ReturnType<typeof context>) {
  const f = ctx.input;
  const retained = await ctx.events.read(
    "runtime.reload.requested",
    `improvement-activation:${f.proposal.packetHash}`,
  );
  const provider = (ctx as any).evidenceProvider;
  return runActivationFollowUp(ctx, provider, async (command) => {
    if (command.type === "event.get")
      return {
        type: "ok",
        command: "event.get",
        event: {
          event: {
            id: retained?.eventId,
            type: "runtime.reload.requested",
            data: retained?.data,
          },
          links: retained ? [{ kind: "operation", id: "event:77" }] : [],
        },
      } as any;
    if (command.type === "apps.list")
      return {
        type: "ok",
        command: "apps.list",
        apps: [{ id: "may" }],
      } as any;
    if (command.type === "app.task.get") {
      const task = await provider.getTask("may", String(command.taskId));
      return {
        type: "ok",
        command: "app.task.get",
        appId: "may",
        taskId: command.taskId,
        task: {
          id: command.taskId,
          generation: task.generation,
          status: task.status,
          acceptedAttempt: task.acceptedAttempt,
          outcome: "Exercise post-adoption behavior",
          acceptance: ["Return an accepted outcome"],
        },
      } as any;
    }
    if (command.type === "task.get")
      return {
        type: "ok",
        command: "task.get",
        task: await provider.getTask("may", String(command.taskId)),
      } as any;
    throw new Error(`unexpected public command ${String(command.type)}`);
  });
}

const output = (result: Awaited<ReturnType<typeof execute>>) =>
  result.output as any;

describe("approved activation and independent follow-up", () => {
  test("requires the same accountable owner Task", async () => {
    const f = fixture();
    const ctx = context(f);
    (ctx.reconciliation as any).taskId = "goal/other-owner";
    const emitted: unknown[] = [];
    ctx.events.emit = async (event) => void emitted.push(event);
    expect((await execute(ctx)).summary).toContain("different owner Task");
    expect(emitted).toEqual([]);
  });

  test("source-only packet and source drift cannot activate", async () => {
    const sourceOnly = fixture(false);
    expect((await execute(context(sourceOnly))).summary).toContain(
      "source-application-only",
    );
    const drift = fixture();
    drift.packet.candidateCommit = "9".repeat(40);
    writeFileSync(drift.files.packet, JSON.stringify(drift.packet));
    expect((await execute(context(drift))).status).toBe("blocked");
  });

  test("publishes the existing pinned reload operation and waits for its exact result", async () => {
    const f = fixture();
    const ctx = context(f);
    const emitted: any[] = [];
    ctx.events.emit = async (event) => void emitted.push(event);
    const result = await execute(ctx);
    expect(emitted).toEqual([
      expect.objectContaining({
        type: "runtime.reload.requested",
        data: expect.objectContaining({
          expectedSourceCommit: f.packet.candidateCommit,
          requestId: `improvement-activation:${f.packet.packetHash}`,
        }),
      }),
    ]);
    expect(output(result)).toMatchObject({
      state: "waiting",
      result: { stage: "activation-requested" },
      conditions: [{ id: `improvement-activation:${f.packet.packetHash}` }],
    });
  });

  test("continues the exact issued operation after the satisfied approval wait is unlinked", async () => {
    const f = fixture();
    const ctx = context(f, {
      ok: true,
      sourceCommit: f.packet.candidateCommit,
    });
    writeFileSync(join(f.files.repository, "later.txt"), "later source work\n");
    execFileSync("git", ["-C", f.files.repository, "add", "."]);
    execFileSync("git", [
      "-C",
      f.files.repository,
      "commit",
      "-m",
      "later unrelated source",
    ]);
    const provider = (ctx as any).evidenceProvider;
    const owner = await provider.getTask("may", "goal/improvement");
    owner.status = "pending";
    owner.diagnostics.conditions = [];
    rmSync(f.files.packet);
    rmSync(f.sourceReceipt);
    const result = await execute(ctx);
    expect(output(result)).toMatchObject({
      state: "waiting",
      result: { stage: "post-adoption-evaluation-requested" },
    });
  });

  test("rejects an uncorrelated reload result", async () => {
    const f = fixture();
    const ctx = context(f, {
      ok: true,
      sourceCommit: f.packet.candidateCommit,
    });
    const provider = (ctx as any).evidenceProvider;
    const original = provider.getEvent;
    provider.getEvent = async (id: number) => {
      const event = await original(id);
      return id === 77
        ? { ...event, data: { ...(event as any).data, requestId: "other" } }
        : event;
    };
    expect((await execute(ctx)).summary).toContain(
      "does not name its exact completion",
    );
  });

  test("failed or wrong-revision adoption remains incomplete", async () => {
    for (const reload of [
      { ok: false },
      { ok: true, sourceCommit: "8".repeat(40) },
    ]) {
      const f = fixture();
      const result = await execute(context(f, reload));
      expect(output(result)).toMatchObject({
        state: "incomplete",
        result: {
          stage: reload.ok ? "activation-inconclusive" : "activation-failed",
        },
      });
    }
  });

  test("running and Evaluation-owned subjects are not follow-up outcomes", async () => {
    const f = fixture();
    const reload = { ok: true, sourceCommit: f.packet.candidateCommit };
    const running = context(f, reload);
    const provider = (running as any).evidenceProvider;
    const original = provider.getTask;
    provider.getTask = async (appId: string, taskId: string) =>
      taskId === "goal/new-subject"
        ? {
            appId,
            taskId,
            status: "running",
            history: [
              {
                eventType: "project.task.reconciled",
                timestamp: 1_001,
                data: { state: "converged" },
              },
            ],
          }
        : original(appId, taskId);
    expect((await execute(running)).summary).toContain(
      "accepted post-activation outcome",
    );

    for (const disposition of ["progress", "retrying"]) {
      const unfinished = context(f, reload);
      const unfinishedProvider = (unfinished as any).evidenceProvider;
      const read = unfinishedProvider.getTask;
      unfinishedProvider.getTask = async (appId: string, taskId: string) => {
        const task = await read(appId, taskId);
        if (taskId === "goal/new-subject") {
          task.status = "attention";
          task.history[0].disposition = disposition;
        }
        return task;
      };
      expect((await execute(unfinished)).summary).toContain(
        "accepted post-activation outcome",
      );
    }

    const evaluation = fixture();
    evaluation.input.newSubjectTask = {
      appId: "evaluation" as any,
      taskId: "goal/new-subject",
    };
    expect(
      (
        await execute(
          context(evaluation, {
            ok: true,
            sourceCommit: evaluation.packet.candidateCommit,
          }),
        )
      ).summary,
    ).toContain("concrete external new work");
  });

  test("exact adoption requires readable current-generation new work and targets it for Evaluation", async () => {
    const f = fixture();
    const missing = await execute(
      context(f, { ok: true, sourceCommit: f.packet.candidateCommit }, false),
    );
    expect(missing.status).toBe("blocked");
    expect(missing.summary).toContain("post-activation outcome");

    const staleGeneration = context(f, {
      ok: true,
      sourceCommit: f.packet.candidateCommit,
    });
    const staleProvider = (staleGeneration as any).evidenceProvider;
    const staleRead = staleProvider.getTask;
    staleProvider.getTask = async (appId: string, taskId: string) => {
      const task = await staleRead(appId, taskId);
      if (taskId === "goal/new-subject") task.generation = 0;
      return task;
    };
    expect((await execute(staleGeneration)).summary).toContain(
      "post-activation outcome",
    );

    const staleRawHistory = context(f, {
      ok: true,
      sourceCommit: f.packet.candidateCommit,
    });
    const staleRawProvider = (staleRawHistory as any).evidenceProvider;
    const staleRawRead = staleRawProvider.getTask;
    staleRawProvider.getTask = async (appId: string, taskId: string) => {
      const task = await staleRawRead(appId, taskId);
      if (taskId === "goal/new-subject")
        task.acceptedAttempt.startedAt = new Date(999).toISOString();
      return task;
    };
    expect((await execute(staleRawHistory)).summary).toContain(
      "post-activation outcome",
    );

    const result = await execute(
      context(f, { ok: true, sourceCommit: f.packet.candidateCommit }),
    );
    expect(output(result)).toMatchObject({
      state: "waiting",
      result: { stage: "post-adoption-evaluation-requested" },
      dependencies: [
        {
          appId: "evaluation",
          input: {
            kind: "review-task-outcome",
            data: { appId: "may", taskId: "goal/new-subject" },
          },
        },
      ],
    });

    const evidenceHash = output(result).dependencies[0].input.data.evidenceHash;
    const completed = context(f, {
      ok: true,
      sourceCommit: f.packet.candidateCommit,
    });
    const admittedRequestId = `appdep_${"a".repeat(24)}`;
    (completed.read as any).tasks.get = async () => ({
      id: "goal/improvement",
      status: "waiting",
      generation: 2,
      outcome: "Improve safely",
      parentId: "may",
      acceptance: [],
      input: {},
      conditions: [
        {
          id: "app-request:fixture",
          type: "app.dependency.updated",
          subject: `id:${admittedRequestId}`,
          expected: { field: "status", equals: "done" },
          owner: "app:evaluation",
        },
      ],
      result: output(result).result,
    });
    const readResultIds: string[] = [];
    (completed.read as any).appResult = async (id: string) => {
      readResultIds.push(id);
      return {
        summary: "Independent review retained",
        facts: [
          "review-disposition:insufficient-evidence",
          "subject:may/goal/new-subject",
          "subject-generation:1",
          `evidence-hash:${evidenceHash}`,
          "report:task-outcomes/may/report.md",
        ],
      };
    };
    (completed.reconciliation as any).events.items.push({
      event: {
        type: "app.dependency.updated",
        data: {
          kind: "app",
          id: admittedRequestId,
          appId: "evaluation",
          taskId: "runtime/task-outcome/may/goal-new-subject",
          status: "done",
          summary: "Independent review retained",
          facts: [
            "review-disposition:insufficient-evidence",
            "subject:may/goal/new-subject",
            "subject-generation:1",
            `evidence-hash:${evidenceHash}`,
            "report:task-outcomes/may/report.md",
          ],
        },
      },
    });
    expect(output(await execute(completed))).toMatchObject({
      state: "converged",
      result: {
        stage: "post-adoption-evaluation-complete",
        evaluationDisposition: "insufficient-evidence",
      },
    });
    expect(readResultIds).toEqual([admittedRequestId]);

    const staleCompleted = context(f, {
      ok: true,
      sourceCommit: f.packet.candidateCommit,
    });
    (staleCompleted.read as any).tasks.get = (completed.read as any).tasks.get;
    (staleCompleted.read as any).appResult = (completed.read as any).appResult;
    (staleCompleted.reconciliation as any).events.items = [
      ...(completed.reconciliation as any).events.items,
    ];
    const staleCompletedProvider = (staleCompleted as any).evidenceProvider;
    const staleCompletedRead = staleCompletedProvider.getTask;
    staleCompletedProvider.getTask = async (appId: string, taskId: string) => {
      const task = await staleCompletedRead(appId, taskId);
      if (taskId === "goal/new-subject")
        task.facts = [...(task.facts ?? []), "later-owner-update"];
      return task;
    };
    expect(output(await execute(staleCompleted))).toMatchObject({
      state: "converged",
      result: {
        stage: "post-adoption-evaluation-inconclusive",
        evaluationDisposition: "stale",
      },
      facts: [
        expect.stringContaining("activation-result-event:"),
        expect.any(String),
        expect.any(String),
        expect.stringContaining("current-subject-evidence:"),
        "review-freshness:stale",
      ],
    });

    const differentReview = context(f, {
      ok: true,
      sourceCommit: f.packet.candidateCommit,
    });
    const differentRequestId = `appdep_${"b".repeat(24)}`;
    (differentReview.read as any).tasks.get = async () => ({
      id: "goal/improvement",
      status: "waiting",
      generation: 2,
      outcome: "Improve safely",
      parentId: "may",
      acceptance: [],
      input: {},
      conditions: [
        {
          id: "app-request:different",
          type: "app.dependency.updated",
          subject: `id:${differentRequestId}`,
          expected: { field: "status", equals: "done" },
          owner: "app:evaluation",
        },
      ],
      result: output(result).result,
    });
    (differentReview.read as any).appResult = async (id: string) => {
      expect(id).toBe(differentRequestId);
      return {
        facts: [
          "review-disposition:assessed",
          "subject:may/goal/new-subject",
          "subject-generation:1",
          `evidence-hash:${"f".repeat(64)}`,
        ],
      };
    };
    (differentReview.reconciliation as any).events.items.push({
      event: {
        type: "app.dependency.updated",
        data: {
          kind: "app",
          id: differentRequestId,
          appId: "evaluation",
          status: "done",
        },
      },
    });
    expect(output(await execute(differentReview))).toMatchObject({
      state: "waiting",
      result: { stage: "post-adoption-evaluation-requested" },
    });
  });
});
