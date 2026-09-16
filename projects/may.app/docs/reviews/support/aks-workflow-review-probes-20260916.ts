// Diagnostic reproductions for the reviewed revision, not acceptance tests for a fix.
// bun <this-file> <aks-app-repository> <resolved-sdk-directory>
// All provider responses are injected or disabled; Git uses only temporary local files.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [repoArg, sdkArg] = process.argv.slice(2);
assert(
  repoArg && sdkArg,
  "Pass the AKS repository and resolved SDK directories",
);
const repo = resolve(repoArg),
  sdk = resolve(sdkArg);
const readModule = (root: string, file: string) =>
  import(pathToFileURL(join(root, file)).href);
const { approvedRepairScope } = await readModule(
  repo,
  "agents/owner/workflows/lib/approved-repair-scope.ts",
);
const { masterRepairIdentity, testHealthTaskId } = await readModule(
  repo,
  "master-validation-task.ts",
);
const { admitTaskReconcileResult } = await readModule(sdk, "src/index.ts");
const { aksObservers, trackedPipelineObserver } = await readModule(
  repo,
  "watchers/observers.ts",
);
const { observeAksPipelines } = await readModule(
  repo,
  "watchers/aks-pipeline.ts",
);
const { observeRepoRef } = await readModule(repo, "watchers/repo-ref.ts");
const { decideDomainWriteRouting } = await readModule(
  repo,
  "domain-write-routing.ts",
);
const root = mkdtempSync(join(tmpdir(), "aks-independent-probes-"));
const results: Record<string, unknown> = {};
try {
  const identity = masterRepairIdentity("review-fixture");
  const task = {
    id: identity.id,
    parentId: testHealthTaskId,
    generation: 1,
    status: "waiting",
    workflow: "non-spec-main-publication",
    conditions: [],
    input: {
      publicationBranch: identity.publicationBranch,
      targetBranch: "main",
      failureFingerprint: "review-fixture",
      completion: "review-ready",
      publicationAuthorized: true,
      requireLiveProof: true,
      allowedChangedFiles: ["a.ts"],
    },
    result: {
      publication: {
        pullRequestId: 123,
        sourceBranch: identity.publicationBranch,
        targetBranch: "main",
      },
    },
  };
  const judgment = {
    truncated: false,
    items: [
      {
        eventId: 42,
        event: {
          type: "project.owner.requested",
          source: "control-socket",
          owner: "app:aks-rp-e2e",
          target: { appId: "aks-rp-e2e", taskId: testHealthTaskId },
          data: {
            relatedTaskIds: [task.id],
            scopeExtension: {
              taskId: task.id,
              expectedGeneration: 1,
              pullRequestId: 123,
              previousFiles: ["a.ts"],
              addFiles: ["b.ts"],
              reason: "Approved fixture correction",
            },
          },
        },
      },
    ],
  };
  const eligible = approvedRepairScope(testHealthTaskId, [task], judgment);
  assert.equal(eligible.actions.length, 1);
  const admission = admitTaskReconcileResult(
    {
      state: "converged",
      summary: "Fixture",
      facts: [],
      actions: eligible.actions,
    },
    { allowNeedsAgent: true },
  );
  assert.equal(admission.ok, false);
  results.retiredAction = admission;
  const running = approvedRepairScope(
    testHealthTaskId,
    [{ ...task, status: "running" }],
    judgment,
  );
  const pipelineWaiting = approvedRepairScope(
    testHealthTaskId,
    [{ ...task, conditions: [{ type: "pipeline-run.state" }] }],
    judgment,
  );
  assert.equal(running.actions.length, 0);
  assert.equal(pipelineWaiting.actions.length, 0);
  results.requirementStatusGate = {
    eligibleActions: eligible.actions.length,
    running,
    pipelineWaiting,
  };

  const appRoot = join(root, "app"),
    projectRoot = join(root, "domain");
  mkdirSync(appRoot);
  mkdirSync(projectRoot);
  const registered = aksObservers.find(
    (observer: any) => observer.id === "pipeline",
  );
  assert.notEqual(registered, trackedPipelineObserver);
  let taskReads = 0;
  const priorDisable = process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO;
  process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO = "0";
  try {
    await registered.run({
      workspace: { appRoot, projectRoot },
      read: {
        tasks: {
          list: async () => {
            taskReads++;
            return { items: [{ id: "fixture" }] };
          },
          get: async () => {
            taskReads++;
            return {
              conditions: [
                { type: "pipeline-run.state", subject: "pipeline-run:123" },
              ],
            };
          },
        },
      },
    });
  } finally {
    if (priorDisable === undefined)
      delete process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO;
    else process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO = priorDisable;
  }
  assert.equal(taskReads, 0);
  results.registeredObserver = {
    usesConditionRecoveryAdapter: false,
    taskReads,
    providerDisabledForProbe: true,
  };

  const lossRoot = join(root, "loss");
  mkdirSync(lossRoot);
  const run = {
    runId: "123",
    fingerprint: "completed:succeeded",
    status: "completed",
    result: "succeeded",
    sourceBranch: "refs/heads/task/fixture",
    sourceVersion: "a".repeat(40),
    finishTime: "2026-09-16T00:00:00Z",
    queueTime: null,
    artifacts: [],
    artifactObservable: false,
    progressive: false,
  };
  async function collect() {
    const events: any[] = [];
    await observeAksPipelines(
      {
        appPath: (path: string) => resolve(lossRoot, path),
        record: (event: unknown) => events.push(event),
        noop: () => ({}),
      },
      { scanAdoRuns: async () => [run], listArtifactNames: async () => [] },
    );
    return events;
  }
  const discarded = await collect(); // Simulates Host rejecting this result before any event is persisted.
  const retry = await collect();
  assert(discarded.some((event) => event.type === "pipeline-run.state"));
  assert.equal(
    retry.filter((event) => event.type === "pipeline-run.state").length,
    0,
  );
  results.lostPublication = {
    discardedTypes: discarded.map((event) => event.type),
    nextPollTypes: retry.map((event) => event.type),
  };

  const gitRoot = join(root, "git");
  mkdirSync(gitRoot);
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: gitRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-b", "dev");
  git("config", "user.name", "Review fixture");
  git("config", "user.email", "review@example.invalid");
  writeFileSync(join(gitRoot, "a"), "fixture\n");
  git("add", "a");
  git("commit", "-m", "fixture");
  const commit = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/dev", commit);
  git("remote", "add", "origin", join(root, "nonexistent-remote.git"));
  const cached = await observeRepoRef(gitRoot, "origin/dev", commit);
  assert.equal(cached?.commit, commit);
  results.failedFetch = { returnedObservation: cached, remoteExists: false };

  const routing = decideDomainWriteRouting({
    id: "domain/fixture",
    agent: "aks-explorer",
    outcome: "Fix the broken assertion in tests/example.ts",
    acceptance: ["Regression test passes"],
  });
  assert.equal(routing.decision, "read-only-agent");
  results.proseRouting = routing;
  console.log(JSON.stringify(results, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
