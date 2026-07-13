import { resolveTaskTreePath } from "@may-agent/sdk";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "spec-loop.ts",
);

async function runSpecLoop(
  args: string[],
  env: Record<string, string | undefined>,
) {
  const proc = Bun.spawn(["bun", scriptPath, ...args], {
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), "aks-spec-loop-"));
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");

  await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(appDir, ".state", "journal.jsonl"), "", "utf8");

  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        active_task_id: null,
        active_task_ids: [],
        updated_at: new Date().toISOString(),
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            status: "backlog",
            children: ["existing-holder"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "existing-holder": {
            id: "existing-holder",
            parent_id: "project",
            state: "blocked",
            status: "blocked",
            kind: "domain_leaf",
            priority: "P2",
            owner: "aks-explorer",
            children: [],
            goal: "Existing holder.",
            outputs: ["evidence/archive/existing-holder.md"],
            acceptance: ["reviewed"],
            blocker: {
              condition: "existing wait",
              category: "external-wait",
              owner: "aks-explorer",
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    join(appDir, ".state", "spec-loop", "state.json"),
    `${JSON.stringify(
      {
        loopTaskId: "aks-spec-verification-loop",
        windowSize: 1,
        cursor: 0,
        prioritySpecIds: [],
        specs: {
          "spec.alpha": {
            status: "pending",
            taskId: null,
            attempts: 5,
            lastRunId: "171350866",
            lastRunUrl: "https://example.test/run/171350866",
            lastResultPath: "/tmp/result.json",
            lastPrUrl: null,
            updatedAt: "2026-07-10T14:33:19.974Z",
            review: {
              classification: "environment_blocker",
              lastRootCause: "old root cause",
              lastAction: "self represent this blocker",
              reviewedAt: "2026-07-08T10:21:41.674Z",
            },
            successorDisposition:
              "reviewed-environment-node-readiness-blocker-self-represented",
            successorEvidencePath: "/tmp/old-evidence.md",
            successorStateReason: "old self-represented reason",
            resumeCondition: "old resume condition",
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  return { root, appDir, projectDir };
}

describe("spec-loop CLI", () => {
  test("update-successor can replace self-represented metadata with exact holder-linked fields", async () => {
    const fixture = await makeFixture();

    const result = await runSpecLoop(
      [
        "update-successor",
        "spec.alpha",
        "--task-id",
        "existing-holder",
        "--successor-disposition",
        "exact-wait-node-readiness-holder",
        "--successor-evidence-path",
        "evidence/archive/exact-holder.md",
        "--successor-state-reason",
        "linked to exact holder",
        "--resume-condition",
        "resume only when the exact wait changes",
        "--review-last-action",
        "Keep pending under the exact holder. Do not rerun unchanged.",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      after?: {
        taskId?: string | null;
        successorDisposition?: string;
        successorEvidencePath?: string;
        successorStateReason?: string;
        resumeCondition?: string;
        review?: Record<string, unknown>;
      };
    };
    expect(parsed.after).toMatchObject({
      taskId: "existing-holder",
      successorDisposition: "exact-wait-node-readiness-holder",
      successorEvidencePath: "evidence/archive/exact-holder.md",
      successorStateReason: "linked to exact holder",
      resumeCondition: "resume only when the exact wait changes",
      review: {
        lastAction:
          "Keep pending under the exact holder. Do not rerun unchanged.",
      },
    });

    const saved = JSON.parse(
      await readFile(join(fixture.appDir, ".state", "spec-loop", "state.json"), "utf8"),
    ) as {
      specs: Record<string, Record<string, unknown>>;
    };
    expect(saved.specs["spec.alpha"]).toMatchObject({
      taskId: "existing-holder",
      successorDisposition: "exact-wait-node-readiness-holder",
      successorEvidencePath: "evidence/archive/exact-holder.md",
      successorStateReason: "linked to exact holder",
      resumeCondition: "resume only when the exact wait changes",
    });
  });

  test("update-successor can clear stale self-represented metadata", async () => {
    const fixture = await makeFixture();

    const result = await runSpecLoop(
      [
        "update-successor",
        "spec.alpha",
        "--clear-successor-disposition",
        "--clear-successor-evidence-path",
        "--clear-successor-state-reason",
        "--clear-resume-condition",
        "--clear-review",
      ],
      {
        ...process.env,
        APP_DIR: fixture.appDir,
        PROJECT_DIR: fixture.projectDir,
        WORKER: "aks-explorer",
      },
    );

    expect(result.exitCode).toBe(0);
    const saved = JSON.parse(
      await readFile(join(fixture.appDir, ".state", "spec-loop", "state.json"), "utf8"),
    ) as {
      specs: Record<string, Record<string, unknown>>;
    };
    expect(saved.specs["spec.alpha"].successorDisposition).toBeUndefined();
    expect(saved.specs["spec.alpha"].successorEvidencePath).toBeUndefined();
    expect(saved.specs["spec.alpha"].successorStateReason).toBeUndefined();
    expect(saved.specs["spec.alpha"].resumeCondition).toBeUndefined();
    expect(saved.specs["spec.alpha"].review).toBeUndefined();
  });
});
