import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTaskTreePath } from "@may-agent/sdk";
import { taskTreeConfig } from "./lib/task-tree-tools.ts";
import {
  adoptExactPipelineWaitV2,
  applyTaskTreeFollowupReviewV2,
  revisePipelineVerificationPhaseV2,
} from "./lib/work-commands-v2.ts";

async function fixture() {
  const appDir = await mkdtemp(join(tmpdir(), "work-commands-v2-"));
  await mkdir(join(appDir, ".state"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        root_task_id: "project",
        active_task_ids: [],
        tasks: {
          project: {
            id: "project",
            state: "active",
            children: ["lane"],
          },
          lane: {
            id: "lane",
            parent_id: "project",
            state: "active",
            children: ["source"],
          },
          source: {
            id: "source",
            revision: 2,
            parent_id: "lane",
            state: "review",
            kind: "domain_leaf",
            owner: "aks-explorer",
            workflow: "default-task-worker",
            children: [],
            goal: "Review source.",
            outputs: ["source.md"],
            acceptance: ["reviewed"],
            trace: { current_attempt_id: "attempt-2" },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return {
    appDir,
    config: taskTreeConfig({
      appDir,
      projectDir: appDir,
      worker: "aks-explorer",
      maxConcurrent: 2,
    }),
  };
}

const action = {
  actionKind: "task-tree-followup" as const,
  idBase: "domain/direct-successor",
  parentId: "lane",
  owner: "aks-explorer",
  goal: "Execute the reviewed domain successor directly.",
  outputs: ["successor.md"],
  acceptance: ["successor evidence is reviewed"],
  conflictScopes: ["domain:direct-successor"],
};

async function tree(appDir: string) {
  return JSON.parse(await readFile(resolveTaskTreePath(appDir), "utf8"));
}

describe("work commands v2", () => {
  test("atomically closes review and creates one exact successor", async () => {
    const input = await fixture();
    const result = applyTaskTreeFollowupReviewV2(input.config, {
      taskId: "source",
      taskRevision: 2,
      attemptId: "attempt-2",
      decision: "followup",
      summary: "Create the exact successor.",
      action,
    });

    expect(result).toMatchObject({
      applied: true,
      replayed: false,
      successorTaskId: "domain/direct-successor",
    });
    const updated = await tree(input.appDir);
    expect(updated.tasks.source.state).toBe("done");
    expect(updated.tasks.lane.children).toContain("domain/direct-successor");
    expect(updated.tasks["domain/direct-successor"]).toMatchObject({
      state: "backlog",
      revision: 0,
      parent_id: "lane",
      owner: "aks-explorer",
    });
  });

  test("replay returns the same successor without duplication", async () => {
    const input = await fixture();
    const command = {
      taskId: "source",
      taskRevision: 2,
      attemptId: "attempt-2",
      decision: "followup" as const,
      summary: "Create the exact successor.",
      action,
    };
    applyTaskTreeFollowupReviewV2(input.config, command);
    const replay = applyTaskTreeFollowupReviewV2(input.config, command);

    expect(replay).toMatchObject({ applied: true, replayed: true });
    const updated = await tree(input.appDir);
    expect(
      updated.tasks.lane.children.filter(
        (id: string) => id === "domain/direct-successor",
      ),
    ).toHaveLength(1);
  });

  test("stale revision and invalid contracts leave the source untouched", async () => {
    const staleFixture = await fixture();
    const stale = applyTaskTreeFollowupReviewV2(staleFixture.config, {
      taskId: "source",
      taskRevision: 1,
      attemptId: "attempt-2",
      decision: "followup",
      summary: "stale",
      action,
    });
    expect(stale).toMatchObject({
      applied: false,
      reason: expect.stringContaining("stale"),
    });
    expect((await tree(staleFixture.appDir)).tasks.source.state).toBe("review");

    const invalidFixture = await fixture();
    const invalid = applyTaskTreeFollowupReviewV2(invalidFixture.config, {
      taskId: "source",
      taskRevision: 2,
      attemptId: "attempt-2",
      decision: "followup",
      summary: "invalid",
      action: { ...action, parentId: "missing" },
    });
    expect(invalid).toMatchObject({
      applied: false,
      reason: "successor parent does not exist",
    });
    const unchanged = await tree(invalidFixture.appDir);
    expect(unchanged.tasks.source.state).toBe("review");
    expect(unchanged.tasks["domain/direct-successor"]).toBeUndefined();

    const ownerFixture = await fixture();
    const wrongOwner = applyTaskTreeFollowupReviewV2(ownerFixture.config, {
      taskId: "source",
      taskRevision: 2,
      attemptId: "attempt-2",
      decision: "followup",
      summary: "wrong owner",
      action: { ...action, owner: "other-agent" },
    });
    expect(wrongOwner).toMatchObject({
      applied: false,
      reason: "successor owner override is outside the canary scope",
    });

    const workflowFixture = await fixture();
    const wrongWorkflow = applyTaskTreeFollowupReviewV2(
      workflowFixture.config,
      {
        taskId: "source",
        taskRevision: 2,
        attemptId: "attempt-2",
        decision: "followup",
        summary: "wrong workflow",
        action: { ...action, workflow: "unknown-workflow" },
      },
    );
    expect(wrongWorkflow).toMatchObject({
      applied: false,
      reason: "successor workflow override is outside the canary scope",
    });
  });

  test("revises an accepted fix-forward phase into one verification schema", async () => {
    const input = await fixture();
    const before = await tree(input.appDir);
    before.tasks.source.context = {
      workflow: "fix-forward",
      specId: "spec.one",
      controlPlaneVersion: 2,
    };
    await writeFile(
      resolveTaskTreePath(input.appDir),
      `${JSON.stringify(before, null, 2)}\n`,
      "utf8",
    );

    const gatedOff = revisePipelineVerificationPhaseV2(input.config, {
      taskId: "source",
      taskRevision: 2,
      attemptId: "attempt-2",
      summary: "Fix-forward queued run 172459471.",
      runId: "172459471",
      runUrl: "https://dev.azure.com/example/_build/results?buildId=172459471",
      specIds: ["spec.one"],
      reason: "Wait for the exact run.",
    });
    expect(gatedOff).toMatchObject({
      applied: false,
      reason: "exact ADO Condition V2 writer is disabled",
    });
    expect((await tree(input.appDir)).tasks.source).toMatchObject({
      revision: 2,
      state: "review",
    });

    const revised = revisePipelineVerificationPhaseV2(input.config, {
      conditionV2: "exact-ado-revisioned",
      taskId: "source",
      taskRevision: 2,
      attemptId: "attempt-2",
      summary: "Fix-forward queued run 172459471.",
      runId: "172459471",
      runUrl: "https://dev.azure.com/example/_build/results?buildId=172459471",
      specIds: ["spec.one"],
      reason: "Wait for the exact run.",
    });
    expect(revised).toMatchObject({
      applied: true,
      replayed: false,
      fromRevision: 2,
      toRevision: 3,
    });
    const updated = await tree(input.appDir);
    expect(updated.tasks.source).toMatchObject({
      revision: 3,
      state: "blocked",
      workflow: "default-task-worker",
      context: {
        workflow: "spec-result-review",
        phaseContract: {
          revision: 3,
          resultSchema: "SPEC_RESULT_REVIEW",
        },
      },
    });
    expect(updated.tasks.source.acceptance.join(" ")).not.toContain(
      "FIX_FORWARD_RESULT",
    );
    expect(updated.tasks.source.trace.current_attempt_id).toBeUndefined();
    expect(
      updated.conditions["condition:pipeline:ado:172459471:terminal"],
    ).toMatchObject({
      status: "open",
      subject: { id: "source", revision: 3 },
    });
    expect(updated.tasks.source.blocker.condition_id).toBe(
      "condition:pipeline:ado:172459471:terminal",
    );

    const replay = revisePipelineVerificationPhaseV2(input.config, {
      conditionV2: "exact-ado-revisioned",
      taskId: "source",
      taskRevision: 2,
      attemptId: "attempt-2",
      summary: "Fix-forward queued run 172459471.",
      runId: "172459471",
      runUrl: "https://dev.azure.com/example/_build/results?buildId=172459471",
      specIds: ["spec.one"],
      reason: "Wait for the exact run.",
    });
    expect(replay).toMatchObject({
      applied: true,
      replayed: true,
      toRevision: 3,
    });
  });

  test("adopts one exact compatibility ADO wait into the explicit V2 cohort", async () => {
    const input = await fixture();
    const before = await tree(input.appDir);
    before.tasks.source.revision = 0;
    before.tasks.source.state = "blocked";
    before.tasks.source.context = {};
    before.tasks.source.blocker = {
      condition: "Wait for run 172480751.",
      category: "external-wait",
      owner: "ado",
      waiting_for: {
        type: "ado.pipeline_run.completed",
        runId: "172480751",
        runUrl:
          "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172480751",
        specIds: ["spec.egress-lockdown.windows-baseline"],
      },
      next_check_at: "2026-07-16T08:47:43.395Z",
      resume_condition: "Run 172480751 is terminal.",
      fallback_at: "2026-07-16T09:30:40.139Z",
      fallback_action: "Escalate the exact run wait.",
    };
    await writeFile(
      resolveTaskTreePath(input.appDir),
      `${JSON.stringify(before, null, 2)}\n`,
      "utf8",
    );

    expect(
      adoptExactPipelineWaitV2(input.config, {
        conditionV2: "exact-ado-revisioned",
        taskId: "source",
        runId: "172480751",
      }),
    ).toMatchObject({
      applied: false,
      reason: "exact pipeline Condition adoption V2 writer is disabled",
    });

    const adopted = adoptExactPipelineWaitV2(input.config, {
      adoptionV2: "exact-task",
      conditionV2: "exact-ado-revisioned",
      taskId: "source",
      runId: "172480751",
    });
    expect(adopted).toMatchObject({
      applied: true,
      replayed: false,
      fromRevision: 0,
      toRevision: 1,
      conditionId: "condition:pipeline:ado:172480751:terminal",
    });
    const updated = await tree(input.appDir);
    expect(updated.tasks.source).toMatchObject({
      revision: 1,
      state: "blocked",
      context: {
        controlPlaneVersion: 2,
        conditionId: "condition:pipeline:ado:172480751:terminal",
      },
      blocker: {
        condition_id: "condition:pipeline:ado:172480751:terminal",
        waiting_for: {
          runId: "172480751",
          subjectRevision: 1,
        },
      },
    });
    expect(
      updated.conditions["condition:pipeline:ado:172480751:terminal"],
    ).toMatchObject({
      status: "open",
      subject: { id: "source", revision: 1 },
    });
    expect(
      adoptExactPipelineWaitV2(input.config, {
        adoptionV2: "exact-task",
        conditionV2: "exact-ado-revisioned",
        taskId: "source",
        runId: "172480751",
      }),
    ).toMatchObject({ applied: true, replayed: true, toRevision: 1 });
  });
});
