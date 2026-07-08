import { projectRuntimePaths, resolveTaskTreePath } from "@may-agent/sdk";
import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assignTask, taskTreeConfig } from "./lib/task-tree-tools.ts";
import { buildLoopKey, execute } from "./single-spec-verifier.ts";
import {
  bindKnownWorkflowRun,
  loadSpecLoopState,
} from "./lib/spec-loop-store.ts";
import {
  setPipelineBackendForTests,
  type CommandResult,
  type PipelineRun,
} from "./lib/ado-pipelines.ts";

async function readSpecState(appDir: string) {
  const state = JSON.parse(
    await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
  );
  return state.specs["spec.net-integration.authorized-ip-ranges"];
}

const createdRoots: string[] = [];

function appendPipelineLog(marker: string, payload: unknown = null): void {
  const log = process.env.TEST_PIPELINE_LOG;
  if (!log) return;
  writeFileSync(log, `${JSON.stringify([payload, marker])}\n`, {
    flag: "a",
  });
}

function defaultPipelineRun(runId = "123456", completed = true): PipelineRun {
  return {
    databaseId: Number(runId),
    status: completed ? "completed" : "inProgress",
    conclusion: completed ? (process.env.TEST_RUN_CONCLUSION ?? "success") : "",
    url: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=${runId}`,
    createdAt:
      process.env.TEST_CREATED_AT ??
      new Date(Date.now() + 60_000).toISOString(),
    displayTitle: [
      process.env.TEST_DISPLAY_TITLE ??
        "Single spec: spec.net-integration.authorized-ip-ranges",
      process.env.TEST_METADATA ?? "",
      process.env.TEST_SPEC_ID ?? "spec.net-integration.authorized-ip-ranges",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function writeSingleSpecArtifacts(artifactDir: string): void {
  const bundle = join(
    artifactDir,
    "aks-rp-e2e-123456-single-spec-test-results",
  );
  mkdirSync(bundle, { recursive: true });
  const status = process.env.TEST_RESULT_STATUS ?? "pass";
  const reason =
    process.env.TEST_RESULT_REASON ?? "Pipeline result artifact succeeded.";
  const category = process.env.TEST_RESULT_CATEGORY;
  const specId =
    process.env.TEST_RESULT_SPEC_ID ??
    "spec.net-integration.authorized-ip-ranges";
  const artifactFamily =
    process.env.TEST_ARTIFACT_FAMILY ?? "net-integration-authorized-ip-ranges";
  const loopKey =
    process.env.TEST_WORKFLOW_LOOP_KEY ??
    "verify-spec-net-integration-authorized-ip-ranges-a_test";
  const unzipLog = process.env.TEST_UNZIP_LOG;
  if (unzipLog) writeFileSync(unzipLog, `${bundle}\n`, { flag: "a" });
  writeFileSync(
    join(bundle, "workflow-metadata.json"),
    JSON.stringify({ loop_key: loopKey }, null, 2),
  );
  const artifactPath = join(bundle, "artifacts", artifactFamily, "spec-runner");
  mkdirSync(artifactPath, { recursive: true });
  const childPhase = process.env.TEST_CHILD_PHASE ?? "";
  const childPayload: Record<string, unknown> = {
    status: process.env.TEST_CHILD_STATUS ?? status,
    specId,
    ...(childPhase ? { phase: childPhase } : {}),
  };
  if (process.env.TEST_RESOURCE_GROUP || process.env.TEST_CLUSTER_NAME) {
    childPayload.audit = {
      subscriptionId: process.env.TEST_SUBSCRIPTION_ID ?? "sub-test",
      resourceGroup: process.env.TEST_RESOURCE_GROUP ?? "",
      clusterName: process.env.TEST_CLUSTER_NAME ?? "",
    };
    childPayload.probeEvidence = {
      config: {
        subscriptionId: process.env.TEST_SUBSCRIPTION_ID ?? "sub-test",
        location: process.env.TEST_LOCATION ?? "westus2",
        resourceGroup: process.env.TEST_RESOURCE_GROUP ?? "",
        clusterName: process.env.TEST_CLUSTER_NAME ?? "",
      },
      cleanup: {
        attempted: true,
        status: process.env.TEST_CLEANUP_STATUS ?? "pass",
      },
    };
  }
  if (
    process.env.TEST_CHILD_EVIDENCE_STATUS ||
    process.env.TEST_CHILD_FAILED_ASSERTION_NAME
  ) {
    childPayload.probeEvidence = {
      ...((childPayload.probeEvidence as Record<string, unknown>) ?? {}),
      status: process.env.TEST_CHILD_EVIDENCE_STATUS,
      assertions: [
        {
          name:
            process.env.TEST_CHILD_FAILED_ASSERTION_NAME ??
            "child-failed-assertion",
          ok: false,
          verdictImpact:
            process.env.TEST_CHILD_FAILED_ASSERTION_IMPACT ?? "preflight",
          detail:
            process.env.TEST_CHILD_FAILED_ASSERTION_DETAIL ??
            "child assertion failed",
        },
      ],
    };
  }
  writeFileSync(
    join(artifactPath, "status.json"),
    JSON.stringify(childPayload, null, 2),
  );
  writeFileSync(
    join(artifactPath, "result.json"),
    JSON.stringify({ ...childPayload, status }, null, 2),
  );
  const artifactRefKind = process.env.TEST_ARTIFACT_REF_KIND ?? "result";
  const artifactRefs =
    process.env.TEST_ARTIFACT_REFS === "empty"
      ? []
      : [
          `runs/test-results/single-${artifactFamily}_123456/artifacts/${artifactFamily}/spec-runner/${artifactRefKind}.json`,
        ];
  const topLevelSpecResults =
    process.env.TEST_TOP_LEVEL_SPEC_RESULTS === "empty"
      ? []
      : [
          {
            specId,
            status,
            reason,
            ...(category ? { category } : {}),
            artifactRefs,
          },
        ];
  writeFileSync(
    join(bundle, "result.json"),
    JSON.stringify(
      {
        status: process.env.TEST_TOP_LEVEL_STATUS ?? status,
        specResults: topLevelSpecResults,
      },
      null,
      2,
    ),
  );
}

function installPipelineBackendForSingleSpecTests(): void {
  setPipelineBackendForTests({
    activeRuns: () => [],
    dispatch: ({ inputs }): CommandResult => {
      appendPipelineLog("/dispatches", inputs);
      const rawStatuses =
        process.env.TEST_DISPATCH_STATUSES ||
        process.env.TEST_DISPATCH_STATUS ||
        "0";
      const rawBodies =
        process.env.TEST_DISPATCH_RESPONSES ||
        process.env.TEST_DISPATCH_RESPONSE ||
        "";
      const statuses = rawStatuses.split("||");
      const bodies = rawBodies.split("||");
      const counterPath = process.env.TEST_DISPATCH_COUNTER;
      let index = 0;
      if (counterPath) {
        try {
          index = Number.parseInt(
            readFileSync(counterPath, "utf-8").trim(),
            10,
          );
        } catch {
          index = 0;
        }
        mkdirSync(dirname(counterPath), { recursive: true });
        writeFileSync(counterPath, String(index + 1));
      }
      const statusText =
        statuses[index] ?? statuses[statuses.length - 1] ?? "0";
      const body = bodies[index] ?? bodies[bodies.length - 1] ?? "";
      const numericStatus = Number.parseInt(statusText, 10);
      return {
        ok:
          numericStatus === 0 || (numericStatus >= 200 && numericStatus < 300),
        status: Number.isFinite(numericStatus) ? numericStatus : 1,
        stdout:
          numericStatus === 0 || (numericStatus >= 200 && numericStatus < 300)
            ? body
            : "",
        stderr:
          numericStatus === 0 || (numericStatus >= 200 && numericStatus < 300)
            ? ""
            : body,
      };
    },
    newestRun: (input) => {
      appendPipelineLog("/runs", input.branch);
      if (process.env.TEST_WORKFLOW_RUNS_JSON) {
        const runs = JSON.parse(process.env.TEST_WORKFLOW_RUNS_JSON).map(
          (run: Record<string, unknown>) =>
            ({
              databaseId: Number(run.databaseId ?? run.id),
              status: String(run.status ?? "completed"),
              conclusion: String(run.conclusion ?? "success"),
              url: String(run.url ?? ""),
              createdAt: String(run.createdAt ?? run.createdAt ?? ""),
              displayTitle: String(run.displayTitle ?? run.displayTitle ?? ""),
            }) satisfies PipelineRun,
        );
        return (
          runs.find((run: PipelineRun) => input.match?.(run) ?? true) ?? null
        );
      }
      const run = defaultPipelineRun();
      return input.match?.(run) === false ? null : run;
    },
    getRun: ({ runId }) => {
      appendPipelineLog(`/runs/${runId}`, null);
      const counterPath = process.env.TEST_RUN_VIEW_COUNTER;
      const pendingCount = Number.parseInt(
        process.env.TEST_RUN_VIEW_PENDING_COUNT ?? "0",
        10,
      );
      let index = 0;
      if (counterPath) {
        try {
          index = Number.parseInt(
            readFileSync(counterPath, "utf-8").trim(),
            10,
          );
        } catch {
          index = 0;
        }
        mkdirSync(dirname(counterPath), { recursive: true });
        writeFileSync(counterPath, String(index + 1));
      }
      return defaultPipelineRun(runId, index >= pendingCount);
    },
    downloadArtifacts: ({ artifactDir }) => {
      appendPipelineLog("/artifacts", null);
      if (process.env.TEST_ARTIFACT_DOWNLOAD_FAIL) {
        return {
          ok: false,
          status: 1,
          stdout: "",
          stderr: process.env.TEST_ARTIFACT_DOWNLOAD_FAIL,
        };
      }
      writeSingleSpecArtifacts(artifactDir);
      return {
        ok: true,
        status: 0,
        stdout: "Downloaded test artifact.",
        stderr: "",
      };
    },
  });
}

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "aks-single-spec-"));
  createdRoots.push(root);
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  const binDir = join(root, "bin");
  await mkdir(join(appDir, "tasks"), { recursive: true });
  await mkdir(join(projectDir, "specs"), { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(
    join(projectDir, "specs", "index.json"),
    `${JSON.stringify({ specFiles: ["net-integration-authorized-ip-ranges.json"] }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(projectDir, "specs", "net-integration-authorized-ip-ranges.json"),
    `${JSON.stringify(
      {
        id: "spec.net-integration.authorized-ip-ranges",
        featurePathIds: ["path.net-integration.authorized-ip-ranges"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    resolveTaskTreePath(appDir),
    `${JSON.stringify(
      {
        version: 1,
        project: "aks-rp-e2e",
        project_lifecycle: "active",
        root_task_id: "project",
        updated_at: new Date().toISOString(),
        active_task_id: null,
        active_task_ids: [],
        tasks: {
          project: {
            id: "project",
            state: "backlog",
            status: "backlog",
            children: ["verify-spec-net-integration-authorized-ip-ranges"],
            goal: "project",
            outputs: ["tasks/tree.json"],
            acceptance: ["done"],
          },
          "verify-spec-net-integration-authorized-ip-ranges": {
            id: "verify-spec-net-integration-authorized-ip-ranges",
            parent_id: "project",
            state: "backlog",
            status: "backlog",
            workflow: "single-spec-verifier",
            priority: "P1",
            children: [],
            goal: "Run one spec",
            inputs: ["spec:spec.net-integration.authorized-ip-ranges"],
            outputs: [".state/spec-loop/state.json"],
            acceptance: [
              "Azure DevOps pipeline run completed or produced a concrete blocker.",
            ],
            forbidden: [],
            conflict_scope: ["spec:spec.net-integration.authorized-ip-ranges"],
            depends_on: [],
            context: {
              specId: "spec.net-integration.authorized-ip-ranges",
              pipelineWorkflow: "run-single-spec.yaml",
              target: "staging",
              branch: "dev",
              timeoutMinutes: "110",
              stateRef: ".state/spec-loop/state.json",
              loopTaskId: "aks-spec-verification-loop",
            },
            trace: {},
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  installPipelineBackendForSingleSpecTests();
  return { appDir, projectDir, binDir };
}

function triggerText(event: Record<string, unknown>): string {
  return `## Trigger Event\n\`\`\`json\n${JSON.stringify(event)}\n\`\`\``;
}

afterEach(async () => {
  setPipelineBackendForTests(null);
  delete process.env.AKS_RP_E2E_APP_ALLOW_ADO_TEST_DISPATCH;
  delete process.env.MAY_ADO_PIPELINES_POLL_MS;
  delete process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS;
  for (const root of createdRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("single-spec-verifier", () => {
  test("runs direct workflow input without requiring a task assignment", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    await writeFile(
      join(binDir, "bun"),
      `#!/bin/sh
if [ "$1" != "run" ] || [ "$2" != "spec" ]; then
  echo "unexpected bun args: $*" >&2
  exit 2
fi
mkdir -p runs/test-results/direct_123
cat > runs/test-results/direct_123/result.json <<'JSON'
{
  "status": "pass",
  "specResults": [
    {
      "specId": "spec.net-integration.authorized-ip-ranges",
      "status": "pass",
      "reason": "direct proof passed"
    }
  ]
}
JSON
echo "[test-executor] test-result=runs/test-results/direct_123"
exit 0
`,
      "utf8",
    );
    await chmod(join(binDir, "bun"), 0o755);

    const originalPath = process.env.PATH || "";
    process.env.PATH = `${binDir}:${originalPath}`;
    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "specId: spec.net-integration.authorized-ip-ranges",
          "target: staging",
          "mode: dry-run",
          "timeoutMinutes: 1",
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.workflow).toBe("single-spec-verifier");
      expect(result.subject).toEqual({
        kind: "spec",
        id: "spec.net-integration.authorized-ip-ranges",
      });
      expect(result.artifacts).toContain("runs/test-results/direct_123");
      expect(result.details.command).toContain(
        "bun run spec spec.net-integration.authorized-ip-ranges --target staging --dry-run",
      );
    } finally {
      process.env.PATH = originalPath;
    }
  });

  test("dispatches and classifies a workflow run via pipeline backend", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_ATTEMPT_ID = String(assignment.attemptId);
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE = `Single spec: spec.net-integration.authorized-ip-ranges [verify-spec-net-integration.authorized-ip-ranges-${assignment.attemptId}]`;
    process.env.TEST_RESOURCE_GROUP = "rg-test-proof";
    process.env.TEST_CLUSTER_NAME = "aks-test-proof";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      expect(result.message).toContain("Pipeline result artifact succeeded.");
      const pipelineCalls = (await readFile(pipelineLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      const unzipCalls = await readFile(unzipLog, "utf8");
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/dispatches"),
        ),
      ).toBeTrue();
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/artifacts"),
        ),
      ).toBeTrue();
      const dispatchCall = pipelineCalls.find((args) =>
        args[args.length - 1].includes("/dispatches"),
      );
      expect(JSON.stringify(dispatchCall?.[0])).toContain(
        '"timeout_minutes":"110"',
      );
      expect(unzipCalls.trim().length).toBeGreaterThan(0);

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("done");
      expect(task.trace.last_worker_summary).toContain("classified as pass");
      expect(task.trace.workflowResult.workflow).toBe("single-spec-verifier");
      expect(task.trace.workflowResult.details.runId).toBe("123456");
      expect(task.trace.workflowResult.details.resultPath).toContain(
        "artifacts/net-integration-authorized-ip-ranges/spec-runner/result.json",
      );
      expect(task.trace.workflowResult.details.liveVerified).toBeTrue();
      expect(task.trace.workflowResult.details.resourceGroup).toBe(
        "rg-test-proof",
      );
      expect(task.trace.workflowResult.details.clusterName).toBe(
        "aks-test-proof",
      );

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("pass");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_ATTEMPT_ID;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESOURCE_GROUP;
      delete process.env.TEST_CLUSTER_NAME;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("skips pipeline dispatch when local live policy fails", async () => {
    const { appDir, projectDir } = await makeProject();
    await mkdir(join(projectDir, "runner"), { recursive: true });
    await writeFile(
      join(projectDir, "runner", "check-private-source-policy.ts"),
      [
        "const specIndex = process.argv.indexOf('--spec');",
        "const specId = specIndex >= 0 ? process.argv[specIndex + 1] : '';",
        "console.log(`dependency policy passed for ${specId}`);",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(projectDir, "runner", "check-live-admission.ts"),
      [
        "const specIndex = process.argv.indexOf('--spec');",
        "const specId = specIndex >= 0 ? process.argv[specIndex + 1] : '';",
        "console.error('Live admission policy failed:');",
        "console.error(`- ${specId}: selected spec has missing carrier metadata`);",
        "process.exit(1);",
      ].join("\n"),
      "utf8",
    );

    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const result = await execute({
      task: [
        `app: ${appDir}`,
        `project: ${projectDir}`,
        "agent: aks-explorer",
        "maxConcurrent: 1",
        triggerText({
          type: "project.task.assigned",
          project: "aks-rp-e2e",
          ...assignment,
        }),
      ].join("\n"),
      agent: "aks-explorer",
      done: (message: string) => ({ status: "done", message }),
      escalate: (message: string) => ({ status: "escalated", message }),
      emit() {},
      dispatchEvent() {},
      runAgent: async () => ({ status: "success" }),
      summarize: () => "",
    } as any);

    expect(result.status).toBe("done");
    expect(result.message).toContain("Local live policy failed");
    expect(result.message).toContain("Azure DevOps pipeline dispatch skipped");
    expect(result.message).toContain("missing carrier metadata");
    expect(
      existsSync(
        join(
          appDir,
          ".state",
          "spec-loop",
          "dispatches",
          `verify-spec-net-integration-authorized-ip-ranges-${assignment.attemptId}.json`,
        ),
      ),
    ).toBeFalse();

    const tree = JSON.parse(
      await readFile(resolveTaskTreePath(appDir), "utf8"),
    );
    const task = tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
    expect(task.trace.last_worker_result).toBe("partial");
    expect(task.trace.last_worker_summary).toContain(
      "Local live policy failed",
    );

    const state = await readSpecState(appDir);
    expect(state.status).toBe("error");
    expect(state.activeWorkflowRunId).toBeNull();
    expect(state.lastRunId).toBeNull();
  });

  test("accepts top-level artifactRefs that only point at spec-runner status.json", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "passed";
    process.env.TEST_ARTIFACT_REF_KIND = "status";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      expect(result.message).toContain("spec-runner/result.json");
      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("pass");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toContain("spec-runner/result.json");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_ARTIFACT_REF_KIND;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("accepts empty top-level artifactRefs when result specId matches", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "blocked";
    process.env.TEST_ARTIFACT_REFS = "empty";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).not.toContain("artifact-routing-mismatch");

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("partial");
      expect(task.trace.last_worker_summary).not.toContain(
        "artifact-routing-mismatch",
      );

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_ARTIFACT_REFS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("keeps fixed-target capacity exhaustion visible as error", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "error";
    process.env.TEST_RESULT_CATEGORY = "environment_blocker";
    process.env.TEST_RESULT_REASON =
      "Create failed with AKSCapacityHeavyUsage: Following SKUs have failed for Capacity Restrictions: standard_d4lds_v5. SkuNotAvailable in westus2.";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).toContain(
        "Fixed-target staging capacity unavailable; keep visible",
      );

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("partial");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_CATEGORY;
      delete process.env.TEST_RESULT_REASON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("buildLoopKey preserves exact long retry leaf identity without truncation", () => {
    const row49TaskId =
      "verify-spec-cluster-autoscaler-vm-prerelease-row49-overscale-node-stability-retry-202606300647-2";
    const row49AttemptId =
      "a_verify-spec-cluster-autoscaler-vm-prerelease-row49-overscale-node-stability-retry-202606300647-2_20260630064953";
    const row53TaskId =
      "verify-spec-cluster-autoscaler-vm-prerelease-row53-long-unregistered-nodes-retry-202606300647-3";
    const row53AttemptId =
      "a_verify-spec-cluster-autoscaler-vm-prerelease-row53-long-unregistered-nodes-retry-202606300647-3_20260630064953";

    const row49LoopKey = buildLoopKey(row49TaskId, row49AttemptId);
    const row53LoopKey = buildLoopKey(row53TaskId, row53AttemptId);

    expect(row49LoopKey).toBe(
      "verify-spec-cluster-autoscaler-vm-prerelease-row49-overscale-node-stability-retry-202606300647-2-a_verify-spec-cluster-autoscaler-vm-prerelease-row49-overscale-node-stability-retry-202606300647-2_20260630064953",
    );
    expect(row49LoopKey).toContain(row49TaskId);
    expect(row49LoopKey).toContain(row49AttemptId);
    expect(row49LoopKey.length).toBeGreaterThan(90);

    expect(row53LoopKey).toBe(
      "verify-spec-cluster-autoscaler-vm-prerelease-row53-long-unregistered-nodes-retry-202606300647-3-a_verify-spec-cluster-autoscaler-vm-prerelease-row53-long-unregistered-nodes-retry-202606300647-3_20260630064953",
    );
    expect(row53LoopKey).toContain(row53TaskId);
    expect(row53LoopKey).toContain(row53AttemptId);
    expect(row53LoopKey.length).toBeGreaterThan(90);

    expect(row49LoopKey).not.toBe(row53LoopKey);
  });

  test("treats runner status passed as pass", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "passed";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("pass");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("fails closed when passed artifact has gated child evidence", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "passed";
    process.env.TEST_CHILD_EVIDENCE_STATUS = "gated";
    process.env.TEST_CHILD_FAILED_ASSERTION_NAME = "jumpbox-key-preflight";
    process.env.TEST_CHILD_FAILED_ASSERTION_DETAIL =
      "requires AKS_RP_E2E_JUMPBOX_SSH_PRIVATE_KEY";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).toContain(
        "same-spec artifact did not produce a live pass",
      );
      expect(result.message).toContain("child evidence status=gated");
      expect(result.message).toContain("jumpbox-key-preflight");
      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_CHILD_EVIDENCE_STATUS;
      delete process.env.TEST_CHILD_FAILED_ASSERTION_NAME;
      delete process.env.TEST_CHILD_FAILED_ASSERTION_IMPACT;
      delete process.env.TEST_CHILD_FAILED_ASSERTION_DETAIL;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("retries dispatch without loop_key when remote workflow rejects that input and still finds the run by spec title", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_ATTEMPT_ID = String(assignment.attemptId);
    process.env.TEST_DISPATCH_STATUSES = "422||204";
    process.env.TEST_DISPATCH_RESPONSES = `${JSON.stringify({
      message: 'Unexpected inputs provided: ["metadata"]',
      status: "422",
    })}||`;
    delete process.env.TEST_DISPATCH_STATUS;
    delete process.env.TEST_DISPATCH_RESPONSE;
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
      const pipelineCalls = (await readFile(pipelineLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      const dispatchCalls = pipelineCalls.filter((args) =>
        args[args.length - 1].includes("/dispatches"),
      );
      expect(dispatchCalls.length).toBe(2);
      expect(JSON.stringify(dispatchCalls[0])).toContain("loop_key");
      expect(JSON.stringify(dispatchCalls[1])).not.toContain("loop_key");
      expect(JSON.stringify(dispatchCalls[0])).toContain(
        '"timeout_minutes":"110"',
      );
      expect(JSON.stringify(dispatchCalls[1])).toContain(
        '"timeout_minutes":"110"',
      );

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("done");
      expect(task.trace.last_worker_summary).toContain("classified as pass");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
      expect((await readFile(unzipLog, "utf8")).trim().length).toBeGreaterThan(
        0,
      );
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_ATTEMPT_ID;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("clears verifier liveness fields after workflow completion", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "2";
    process.env.MAY_ADO_PIPELINES_POLL_MS = "10";
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      const specState =
        state.specs["spec.net-integration.authorized-ip-ranges"];
      expect(specState.lastRunId).toBe("123456");
      expect(specState.activeWorkflowRunId).toBeNull();
      expect(specState.activeTaskSessionId).toBeNull();
      expect(specState.heartbeatAt).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("bindKnownWorkflowRun records a bounded recovered run binding for later verifier ingestion", async () => {
    const { appDir, projectDir } = await makeProject();
    const { state } = loadSpecLoopState({
      appDir,
      projectDir,
      loopTaskId: "aks-spec-verification-loop",
      windowSize: 5,
    });

    bindKnownWorkflowRun(state, "spec.net-integration.authorized-ip-ranges", {
      runId: "28371054186",
      runUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=28371054186",
      taskId:
        "repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
      attemptId:
        "a_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629_test",
      taskSessionId:
        "s_task_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
      status: "running",
      loopKey:
        "repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629-a_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629_test",
      dispatchMetadataPath: "/tmp/recovered-dispatch-metadata.json",
    });

    const specState = state.specs["spec.net-integration.authorized-ip-ranges"];
    expect(specState.status).toBe("running");
    expect(specState.activeWorkflowRunId).toBe("28371054186");
    expect(specState.lastRunId).toBeNull();
    expect(specState.lastRunUrl).toBe(
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=28371054186",
    );
    expect(specState.lastWorkflowLoopKey).toBe(
      "repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629-a_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629_test",
    );
    expect(specState.lastDispatchMetadataPath).toBe(
      "/tmp/recovered-dispatch-metadata.json",
    );
    expect(specState.taskId).toBe(
      "repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
    );
    expect(specState.activeAttemptId).toBe(
      "a_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629_test",
    );
    expect(specState.activeTaskSessionId).toBe(
      "s_task_repair-spec-loop-runid-binding-and-artifact-ingestion-backfill-20260629",
    );
  });

  test("reattaches to a known recovered workflow run from task context instead of dispatching again", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const treePath = resolveTaskTreePath(appDir);
    const tree = JSON.parse(await readFile(treePath, "utf8"));
    tree.tasks["verify-spec-net-integration.authorized-ip-ranges"];
    tree.tasks["verify-spec-net-integration-authorized-ip-ranges"].context = {
      ...tree.tasks["verify-spec-net-integration-authorized-ip-ranges"].context,
      knownWorkflowRunId: "123456",
      knownWorkflowRunUrl:
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456",
    };
    await writeFile(treePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "1";
    process.env.MAY_ADO_PIPELINES_POLL_MS = "10";
    process.env.TEST_CREATED_AT = new Date(Date.now() - 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Reattached existing ADO run 123456");
      const pipelineCalls = (await readFile(pipelineLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/dispatches"),
        ),
      ).toBeFalse();
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/runs/123456"),
        ),
      ).toBeTrue();

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      const specState =
        state.specs["spec.net-integration.authorized-ip-ranges"];
      expect(specState.status).toBe("pass");
      expect(specState.lastRunId).toBe("123456");
      expect(specState.lastRunUrl).toBe(
        "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123456",
      );
      expect(specState.activeWorkflowRunId).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("reattaches to recorded active workflow run instead of dispatching again", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });
    await mkdir(join(appDir, ".state", "spec-loop"), { recursive: true });
    await writeFile(
      join(appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 5,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.net-integration.authorized-ip-ranges": {
              status: "running",
              taskId: "verify-spec-net-integration-authorized-ip-ranges",
              attempts: 1,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              activeAttemptId: "previous-attempt",
              activeTaskSessionId: "previous-session",
              activeWorkflowRunId: "123456",
              heartbeatAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "1";
    process.env.MAY_ADO_PIPELINES_POLL_MS = "10";
    process.env.TEST_CREATED_AT = new Date(Date.now() - 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("Reattached existing ADO run 123456");
      const pipelineCalls = (await readFile(pipelineLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/dispatches"),
        ),
      ).toBeFalse();
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/artifacts"),
        ),
      ).toBeTrue();

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      const specState =
        state.specs["spec.net-integration.authorized-ip-ranges"];
      expect(specState.status).toBe("pass");
      expect(specState.lastRunId).toBe("123456");
      expect(specState.activeWorkflowRunId).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("polls workflow completion without blocking the daemon event loop", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const runViewCounter = join(appDir, ".state", "run-view-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_RUN_VIEW_COUNTER = runViewCounter;
    process.env.TEST_RUN_VIEW_PENDING_COUNT = "3";
    process.env.MAY_ADO_PIPELINES_POLL_MS = "10";
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";

    try {
      let timerFired = false;
      const timer = new Promise<void>((resolve) => {
        setTimeout(() => {
          timerFired = true;
          resolve();
        }, 1);
      });
      const resultPromise = execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      await timer;
      expect(timerFired).toBeTrue();
      const result = await resultPromise;
      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as pass");
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("fails closed when the newest nearby workflow run is unrelated", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.ccp-agent.connectivity-tunnel";
    process.env.TEST_SPEC_ID = "spec.ccp-agent.connectivity-tunnel";
    process.env.TEST_RESULT_SPEC_ID =
      "spec.net-integration.authorized-ip-ranges";
    process.env.TEST_ARTIFACT_FAMILY = "net-integration-authorized-ip-ranges";
    process.env.TEST_WORKFLOW_LOOP_KEY =
      "verify-spec-net-integration-authorized-ip-ranges-a_test";
    process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS = "1";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("could not find the run id");
      expect(result.message).not.toContain("classified as pass");
      expect(result.message).not.toContain("run 123456");

      const pipelineCalls = (await readFile(pipelineLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        pipelineCalls.some((args) => args[args.length - 1].includes("/runs")),
      ).toBeTrue();
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/runs/123456/artifacts"),
        ),
      ).toBeFalse();

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain(
        "could not find the run id",
      );

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBeNull();
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_SPEC_ID;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_WORKFLOW_RUNS_JSON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
      delete process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS;
    }
  });

  test("preserves dispatch metadata and loop identity when run lookup cannot recover a run id", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const now = Date.now();
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    await writeFile(unzipLog, "", "utf8");
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(now + 60_000).toISOString();
    process.env.TEST_WORKFLOW_RUNS_JSON = JSON.stringify([
      {
        id: 223458,
        status: "queued",
        conclusion: null,
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=223458",
        createdAt: new Date(now + 55_000).toISOString(),
        displayTitle: "Single spec: spec.jwt-authenticator.external-idp-crud",
      },
      {
        id: 223457,
        status: "queued",
        conclusion: null,
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=223457",
        createdAt: new Date(now + 50_000).toISOString(),
        displayTitle: "Single spec: spec.ccp-agent.connectivity-tunnel",
      },
      {
        id: 223456,
        status: "queued",
        conclusion: null,
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=223456",
        createdAt: new Date(now + 45_000).toISOString(),
        displayTitle: "Single spec: spec.kms.v2plus-enable-cmk-from-v2-public",
      },
    ]);
    process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS = "1";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("could not find the run id");
      expect(result.message).toContain("Loop key:");
      expect(result.message).toContain("Dispatch metadata:");
      expect(result.message).not.toContain("run 223458");
      expect(result.message).not.toContain("run 223457");
      expect(result.message).not.toContain("run 223456");

      const pipelineCalls = (await readFile(pipelineLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223458"),
        ),
      ).toBeFalse();
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223457"),
        ),
      ).toBeFalse();
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223456"),
        ),
      ).toBeFalse();
      expect((await readFile(unzipLog, "utf8")).trim()).toBe("");

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain(
        "could not find the run id",
      );
      expect(task.trace.last_worker_summary).toContain("Dispatch metadata:");

      const specState = await readSpecState(appDir);
      expect(specState.status).toBe("error");
      expect(specState.lastRunId).toBeNull();
      expect(specState.lastWorkflowLoopKey).toContain(
        `verify-spec-net-integration-authorized-ip-ranges-${assignment.attemptId}`,
      );
      expect(specState.lastDispatchMetadataPath).toContain(
        `verify-spec-net-integration-authorized-ip-ranges-${assignment.attemptId}.json`,
      );

      const dispatchMetadata = JSON.parse(
        await readFile(specState.lastDispatchMetadataPath, "utf8"),
      );
      expect(dispatchMetadata.loopKey).toBe(specState.lastWorkflowLoopKey);
      expect(dispatchMetadata.taskId).toBe(
        "verify-spec-net-integration-authorized-ip-ranges",
      );
      expect(dispatchMetadata.attemptId).toBe(String(assignment.attemptId));
      expect(dispatchMetadata.inputs).toEqual({
        specs: "spec.net-integration.authorized-ip-ranges",
        target: "staging",
        timeout_minutes: "110",
        metadata: JSON.stringify({ loop_key: specState.lastWorkflowLoopKey }),
      });
      expect(dispatchMetadata.dispatchResult.ok).toBeTrue();
      expect(dispatchMetadata.dispatchResult.status).toBe(204);
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_WORKFLOW_RUNS_JSON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
      delete process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS;
    }
  });

  test("fails closed when a newer sibling spec only shares a prefix with the requested spec id", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    const now = Date.now();
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    await writeFile(unzipLog, "", "utf8");
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(now + 60_000).toISOString();
    process.env.TEST_WORKFLOW_RUNS_JSON = JSON.stringify([
      {
        id: 223458,
        status: "queued",
        conclusion: null,
        url: "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=223458",
        createdAt: new Date(now + 55_000).toISOString(),
        displayTitle:
          "Single spec: spec.net-integration.authorized-ip-ranges-firewall",
      },
    ]);
    process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS = "1";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("could not find the run id");
      expect(result.message).not.toContain("run 223458");

      const pipelineCalls = (await readFile(pipelineLog, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]);
      expect(
        pipelineCalls.some((args) =>
          args[args.length - 1].includes("/actions/runs/223458"),
        ),
      ).toBeFalse();
      expect((await readFile(unzipLog, "utf8")).trim()).toBe("");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_WORKFLOW_RUNS_JSON;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
      delete process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS;
    }
  });

  test("fails closed on non-zip artifact auth/error bodies before unzip and preserves unknown classification", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    await writeFile(unzipLog, "", "utf8");
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_ARTIFACT_DOWNLOAD_FAIL = JSON.stringify({
      message: "Bad credentials",
      status: "401",
    });

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).toContain("artifact download issue:");
      expect(result.message).toContain("Bad credentials");
      expect(result.message).toContain('"status":"401"');
      expect(result.message).not.toContain("missing specResults[0].specId");
      expect(result.message).not.toContain("missing loop_key");
      expect((await readFile(unzipLog, "utf8")).trim()).toBe("");

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain("Bad credentials");
      expect(task.trace.last_worker_summary).toContain('"status":"401"');

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toBeNull();
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_ARTIFACT_DOWNLOAD_FAIL;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("classifies empty top-level aggregate with same-spec child evidence as aggregation/publication failure", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_STATUS = "error";
    process.env.TEST_CHILD_STATUS = "error";
    process.env.TEST_CHILD_PHASE =
      "interrupted-live-run-net-integration-authorized-ip-ranges";
    process.env.TEST_TOP_LEVEL_STATUS = "empty";
    process.env.TEST_TOP_LEVEL_SPEC_RESULTS = "empty";
    process.env.TEST_ARTIFACT_REFS = "empty";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).toContain("aggregation/publication failure");
      expect(result.message).toContain("top-level result status=empty");
      expect(result.message).toContain("top-level specResults count=0");
      expect(result.message).toContain(
        "child specId=spec.net-integration.authorized-ip-ranges",
      );
      expect(result.message).toContain(
        "same-loop/same-spec child evidence exists while top-level result.json remained empty or omitted specResults[0].specId",
      );
      expect(result.message).not.toContain("artifact-routing-mismatch");

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain(
        "aggregation/publication failure",
      );
      expect(task.trace.last_worker_summary).not.toContain(
        "artifact-routing-mismatch",
      );

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toContain(
        "artifacts/net-integration-authorized-ip-ranges/spec-runner/result.json",
      );
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_CHILD_STATUS;
      delete process.env.TEST_CHILD_PHASE;
      delete process.env.TEST_TOP_LEVEL_STATUS;
      delete process.env.TEST_TOP_LEVEL_SPEC_RESULTS;
      delete process.env.TEST_ARTIFACT_REFS;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("fails closed on artifact identity mismatch and records a terminal spec-loop error", async () => {
    const { appDir, projectDir, binDir } = await makeProject();
    const config = taskTreeConfig({
      appDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: 1,
    });
    const assignment = assignTask(config, {
      taskId: "verify-spec-net-integration-authorized-ip-ranges",
    });

    const originalPath = process.env.PATH || "";
    const pipelineLog = join(appDir, ".state", "pipeline.log");
    const unzipLog = join(appDir, ".state", "unzip.log");
    const dispatchCounter = join(appDir, ".state", "dispatch-count.txt");
    process.env.PATH = `${binDir}:${originalPath}`;
    process.env.TEST_PIPELINE_LOG = pipelineLog;
    process.env.TEST_UNZIP_LOG = unzipLog;
    process.env.TEST_DISPATCH_COUNTER = dispatchCounter;
    process.env.TEST_DISPATCH_STATUS = "204";
    process.env.TEST_DISPATCH_RESPONSE = "";
    process.env.TEST_CREATED_AT = new Date(Date.now() + 60_000).toISOString();
    process.env.TEST_DISPLAY_TITLE =
      "Single spec: spec.net-integration.authorized-ip-ranges";
    process.env.TEST_RESULT_SPEC_ID =
      "spec.net-integration.authorized-ip-ranges-firewall";
    process.env.TEST_ARTIFACT_FAMILY =
      "net-integration-authorized-ip-ranges-firewall";
    process.env.TEST_WORKFLOW_LOOP_KEY =
      "verify-spec-net-integration-authorized-ip-ranges-firewall-a_other_attempt";

    try {
      const result = await execute({
        task: [
          `app: ${appDir}`,
          `project: ${projectDir}`,
          "agent: aks-explorer",
          "maxConcurrent: 1",
          triggerText({
            type: "project.task.assigned",
            project: "aks-rp-e2e",
            ...assignment,
          }),
        ].join("\n"),
        agent: "aks-explorer",
        done: (message: string) => ({ status: "done", message }),
        escalate: (message: string) => ({ status: "escalated", message }),
        emit() {},
        dispatchEvent() {},
        runAgent: async () => ({ status: "success" }),
        summarize: () => "",
      } as any);

      expect(result.status).toBe("done");
      expect(result.message).toContain("classified as error");
      expect(result.message).toContain("artifact-routing-mismatch");
      expect(result.message).toContain("run=123456");
      expect(result.message).toContain(
        "net-integration-authorized-ip-ranges-firewall",
      );
      expect(result.message).toContain("artifact family=");

      const tree = JSON.parse(
        await readFile(resolveTaskTreePath(appDir), "utf8"),
      );
      const task =
        tree.tasks["verify-spec-net-integration-authorized-ip-ranges"];
      expect(task.trace.last_worker_result).toBe("blocked");
      expect(task.trace.last_worker_summary).toContain(
        "artifact-routing-mismatch",
      );
      expect(task.trace.last_worker_summary).toContain("run=123456");

      const state = JSON.parse(
        await readFile(
          join(appDir, ".state", "spec-loop", "state.json"),
          "utf8",
        ),
      );
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].status,
      ).toBe("error");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastRunId,
      ).toBe("123456");
      expect(
        state.specs["spec.net-integration.authorized-ip-ranges"].lastResultPath,
      ).toContain(
        "artifacts/net-integration-authorized-ip-ranges-firewall/spec-runner/result.json",
      );
    } finally {
      process.env.PATH = originalPath;
      delete process.env.TEST_PIPELINE_LOG;
      delete process.env.TEST_UNZIP_LOG;
      delete process.env.TEST_DISPATCH_COUNTER;
      delete process.env.TEST_DISPATCH_STATUS;
      delete process.env.TEST_DISPATCH_RESPONSE;
      delete process.env.TEST_DISPATCH_STATUSES;
      delete process.env.TEST_DISPATCH_RESPONSES;
      delete process.env.TEST_CREATED_AT;
      delete process.env.TEST_DISPLAY_TITLE;
      delete process.env.TEST_RESULT_STATUS;
      delete process.env.TEST_RESULT_SPEC_ID;
      delete process.env.TEST_ARTIFACT_FAMILY;
      delete process.env.TEST_WORKFLOW_LOOP_KEY;
      delete process.env.TEST_RUN_VIEW_COUNTER;
      delete process.env.TEST_RUN_VIEW_PENDING_COUNT;
      delete process.env.MAY_ADO_PIPELINES_POLL_MS;
    }
  });

  test("keeps error status in spec-loop state when verifier completion is blocked", async () => {
    const root = await mkdtemp(join(tmpdir(), "aks-single-spec-state-"));
    createdRoots.push(root);
    const appDir = join(root, "aks-rp-e2e.app");
    const projectDir = join(root, "aks-rp-e2e");
    mkdirSync(join(appDir, "tasks"), { recursive: true });
    mkdirSync(join(appDir, ".state", "spec-loop"), { recursive: true });
    writeFileSync(
      resolveTaskTreePath(appDir),
      `${JSON.stringify(
        {
          version: 1,
          project: "aks-rp-e2e",
          project_lifecycle: "active",
          root_task_id: "project",
          updated_at: new Date().toISOString(),
          active_task_id: null,
          active_task_ids: [],
          tasks: {
            project: {
              id: "project",
              state: "backlog",
              status: "backlog",
              children: ["aks-spec-verification-loop", "verify-spec-a"],
              goal: "project",
              outputs: ["tasks/tree.json"],
              acceptance: ["done"],
            },
            "aks-spec-verification-loop": {
              id: "aks-spec-verification-loop",
              parent_id: "project",
              state: "backlog",
              status: "backlog",
              workflow: "spec-loop-controller",
              priority: "P1",
              children: ["verify-spec-a"],
              goal: "loop",
              inputs: [],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              conflict_scope: ["spec-loop"],
              context: {
                windowSize: 1,
                stateRef: ".state/spec-loop/state.json",
                pipelineWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
              },
            },
            "verify-spec-a": {
              id: "verify-spec-a",
              parent_id: "aks-spec-verification-loop",
              state: "review",
              status: "review",
              workflow: "single-spec-verifier",
              priority: "P1",
              goal: "Run spec.a",
              inputs: ["spec:spec.a"],
              outputs: [".state/spec-loop/state.json"],
              acceptance: ["done"],
              conflict_scope: ["spec:spec.a"],
              context: {
                specId: "spec.a",
                pipelineWorkflow: "run-single-spec.yaml",
                target: "staging",
                branch: "dev",
                stateRef: ".state/spec-loop/state.json",
                loopTaskId: "aks-spec-verification-loop",
              },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeFileSync(
      join(appDir, ".state", "spec-loop", "state.json"),
      `${JSON.stringify(
        {
          loopTaskId: "aks-spec-verification-loop",
          windowSize: 1,
          cursor: 0,
          prioritySpecIds: [],
          specs: {
            "spec.a": {
              status: "error",
              taskId: "verify-spec-a",
              attempts: 1,
              lastRunId: null,
              lastRunUrl: null,
              lastResultPath: null,
              lastPrUrl: null,
              updatedAt: new Date().toISOString(),
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const controllerResult = await import("./spec-loop-controller.ts").then(
      (m) =>
        m.execute({
          task: [
            `app: ${appDir}`,
            `project: ${projectDir}`,
            "agent: aks-explorer",
            "maxConcurrent: 1",
            triggerText({
              type: "project.task.completed",
              project: "aks-rp-e2e",
              taskId: "verify-spec-a",
              result: "blocked",
            }),
          ].join("\n"),
          agent: "aks-explorer",
          done: (message: string) => ({ status: "done", message }),
          escalate: (message: string) => ({ status: "escalated", message }),
          emit() {},
          dispatchEvent() {},
          runAgent: async () => ({ status: "success" }),
          summarize: () => "",
        } as any),
    );

    expect(controllerResult.status).toBe("done");
    const state = JSON.parse(
      await readFile(join(appDir, ".state", "spec-loop", "state.json"), "utf8"),
    );
    expect(state.specs["spec.a"].status).toBe("error");
  });
});
