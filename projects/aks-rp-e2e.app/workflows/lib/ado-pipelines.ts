import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CommandResult = {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export type PipelineRun = {
  databaseId?: number;
  status?: string;
  conclusion?: string;
  url?: string;
  createdAt?: string;
  displayTitle?: string;
};

export type PipelineDispatchMetadata = {
  dispatchedAt: string;
  workflow: string;
  branch: string;
  inputs: Record<string, string>;
  loopKey?: string;
  taskId?: string;
  attemptId?: string;
  planPath?: string;
  capabilityId?: string;
  dispatchResult: {
    ok: boolean;
    status: number | null;
    stdout: string;
    stderr: string;
    error?: string;
  };
};

export type PipelineClient =
  | {
      kind: "ado";
      organization: string;
      project: string;
      pipelineId: string;
    }
  | {
      kind: "test";
    }
  | {
      kind: "gh";
    }
  | {
      kind: "api";
      repo?: unknown;
      token?: string;
    };

type AdoRunPayload = Record<string, unknown>;

type AdoArtifactPayload = {
  name?: unknown;
};

export type PipelineBackend = {
  resolve?: (projectDir: string) => { ok: boolean; reason?: string };
  newestRun?: (input: {
    projectDir: string;
    workflow: string;
    branch: string;
    sinceMs: number;
    match?: (run: PipelineRun) => boolean;
  }) => PipelineRun | null;
  activeRuns?: (input: { projectDir: string; branch: string }) => PipelineRun[];
  dispatch?: (input: {
    projectDir: string;
    workflow: string;
    branch: string;
    inputs: Record<string, string>;
  }) => CommandResult;
  downloadArtifacts?: (input: {
    projectDir: string;
    artifactDir: string;
    runId: string;
  }) => CommandResult;
  getRun?: (input: { projectDir: string; runId: string }) => PipelineRun | null;
};

let testPipelineBackend: PipelineBackend | null = null;

export function setPipelineBackendForTests(
  backend: PipelineBackend | null,
): void {
  testPipelineBackend = backend;
}

function commandEnv(): NodeJS.ProcessEnv {
  const localBin = "/app/.state/.local/bin";
  const path = process.env.PATH ?? "";
  return {
    ...process.env,
    PATH: path.split(":").includes(localBin) ? path : `${localBin}:${path}`,
  };
}

export function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs = 120_000,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: commandEnv(),
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pipelinePollIntervalMs(): number {
  const parsed = Number.parseInt(
    process.env.MAY_ADO_PIPELINES_POLL_MS ??
      process.env.MAY_GITHUB_ACTIONS_POLL_MS ??
      "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
}

export function pipelineRunLookupPollIntervalMs(): number {
  const parsed = Number.parseInt(
    process.env.MAY_ADO_PIPELINES_RUN_LOOKUP_POLL_MS ??
      process.env.MAY_GITHUB_ACTIONS_RUN_LOOKUP_POLL_MS ??
      "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

function adoOrganization(): string {
  return (
    process.env.AKS_RP_E2E_ADO_ORGANIZATION ||
    process.env.MAY_ADO_ORGANIZATION ||
    "https://dev.azure.com/msazure"
  ).replace(/\/+$/g, "");
}

function adoProject(): string {
  return (
    process.env.AKS_RP_E2E_ADO_PROJECT ||
    process.env.MAY_ADO_PROJECT ||
    "CloudNativeCompute"
  ).trim();
}

function adoPipelineId(): string {
  return (
    process.env.AKS_RP_E2E_ADO_PIPELINE_ID ||
    process.env.MAY_ADO_PIPELINE_ID ||
    "467665"
  ).trim();
}

export function defaultAdoAgentPool(): string {
  return (
    process.env.AKS_RP_E2E_ADO_AGENT_POOL ||
    process.env.MAY_ADO_AGENT_POOL ||
    "1ES-AKS-DevInfra-Normal-Yellow"
  ).trim();
}

function isUnitTestProcess(): boolean {
  return (
    process.env.AKS_RP_E2E_APP_ALLOW_ADO_TEST_DISPATCH !== "1" &&
    process.argv.some((arg) => /\btest\b/.test(arg))
  );
}

function adoClient(
  client: PipelineClient,
): Extract<PipelineClient, { kind: "ado" }> {
  return client.kind === "ado"
    ? client
    : {
        kind: "ado",
        organization: adoOrganization(),
        project: adoProject(),
        pipelineId: adoPipelineId(),
      };
}

function adoArgs(client: PipelineClient): string[] {
  const ado = adoClient(client);
  return ["--organization", ado.organization, "--project", ado.project];
}

function resultConclusion(result: string): string | undefined {
  if (!result) return undefined;
  if (result === "succeeded") return "success";
  return result;
}

function runUrl(client: PipelineClient, runId: string | number): string {
  const ado = adoClient(client);
  return `${ado.organization}/${encodeURIComponent(ado.project)}/_build/results?buildId=${String(runId)}`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function displayTitleForRun(run: AdoRunPayload): string {
  const params = objectValue(run.templateParameters);
  const interesting = [
    stringValue(run.buildNumber),
    stringValue(params.metadata),
    stringValue(params.specs),
    stringValue(params.spec),
    stringValue(params.plan_path),
    stringValue(params.feature_set),
  ].filter(Boolean);
  return interesting.join(" ");
}

function parseAdoRun(client: PipelineClient, run: AdoRunPayload): PipelineRun {
  const id = Number(run.id);
  const status = stringValue(run.status);
  const result = stringValue(run.result);
  return {
    databaseId: Number.isFinite(id) ? id : undefined,
    status: status || undefined,
    conclusion: resultConclusion(result),
    url:
      stringValue(run._links) ||
      (Number.isFinite(id) ? runUrl(client, id) : undefined),
    createdAt:
      stringValue(run.queueTime) ||
      stringValue(run.startTime) ||
      stringValue(run.createdDate) ||
      undefined,
    displayTitle: displayTitleForRun(run),
  };
}

function parseJsonArray(output: string): AdoRunPayload[] {
  try {
    const parsed = JSON.parse(output) as unknown;
    return Array.isArray(parsed) ? (parsed as AdoRunPayload[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(output: string): AdoRunPayload | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AdoRunPayload)
      : null;
  } catch {
    return null;
  }
}

export function resolvePipelineClient(projectDir: string): {
  client: PipelineClient | null;
  reason?: string;
} {
  if (testPipelineBackend) {
    const resolved = testPipelineBackend.resolve?.(projectDir) ?? { ok: true };
    return resolved.ok
      ? { client: { kind: "test" } }
      : {
          client: null,
          reason: resolved.reason || "test pipeline unavailable",
        };
  }
  const client: PipelineClient = {
    kind: "ado",
    organization: adoOrganization(),
    project: adoProject(),
    pipelineId: adoPipelineId(),
  };
  const probe = runCommand(
    projectDir,
    "az",
    [
      "pipelines",
      "runs",
      "list",
      "--pipeline-ids",
      client.pipelineId,
      ...adoArgs(client),
      "--top",
      "1",
      "-o",
      "json",
    ],
    60_000,
  );
  if (probe.ok) return { client };
  return {
    client: null,
    reason:
      probe.stderr ||
      probe.stdout ||
      probe.error ||
      `Azure DevOps pipeline access is unavailable for pipeline ${client.pipelineId}.`,
  };
}

function pickNewestWorkflowRun(input: {
  runs: PipelineRun[];
  sinceMs: number;
  match?: (run: PipelineRun) => boolean;
}): PipelineRun | null {
  const recentRuns = input.runs
    .filter((run) => {
      const createdAt = Date.parse(run.createdAt ?? "");
      return Number.isFinite(createdAt) && createdAt >= input.sinceMs - 30_000;
    })
    .sort(
      (a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""),
    );
  const matchedRuns = input.match ? recentRuns.filter(input.match) : recentRuns;
  return matchedRuns[0] ?? null;
}

export function newestWorkflowRun(input: {
  client: PipelineClient;
  projectDir: string;
  workflow: string;
  branch: string;
  sinceMs: number;
  match?: (run: PipelineRun) => boolean;
}): PipelineRun | null {
  if (testPipelineBackend?.newestRun) {
    return testPipelineBackend.newestRun(input);
  }
  const list = runCommand(input.projectDir, "az", [
    "pipelines",
    "runs",
    "list",
    "--pipeline-ids",
    adoClient(input.client).pipelineId,
    ...adoArgs(input.client),
    "--branch",
    input.branch,
    "--top",
    "50",
    "--query-order",
    "QueueTimeDesc",
    "-o",
    "json",
  ]);
  if (!list.ok) return null;
  return pickNewestWorkflowRun({
    runs: parseJsonArray(list.stdout).map((run) =>
      parseAdoRun(input.client, run),
    ),
    sinceMs: input.sinceMs,
    match: input.match,
  });
}

export function activeWorkflowRuns(input: {
  client: PipelineClient;
  projectDir: string;
  branch: string;
}): PipelineRun[] {
  if (testPipelineBackend?.activeRuns) {
    return testPipelineBackend.activeRuns(input);
  }
  const runs: PipelineRun[] = [];
  for (const status of ["inProgress", "notStarted"]) {
    const list = runCommand(input.projectDir, "az", [
      "pipelines",
      "runs",
      "list",
      "--pipeline-ids",
      adoClient(input.client).pipelineId,
      ...adoArgs(input.client),
      "--branch",
      input.branch,
      "--status",
      status,
      "--top",
      "100",
      "-o",
      "json",
    ]);
    if (!list.ok) continue;
    runs.push(
      ...parseJsonArray(list.stdout).map((run) =>
        parseAdoRun(input.client, run),
      ),
    );
  }
  return runs;
}

export function writePipelineDispatchMetadata(
  path: string,
  metadata: PipelineDispatchMetadata,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
}

export function dispatchWorkflow(input: {
  client: PipelineClient;
  projectDir: string;
  workflow: string;
  branch: string;
  inputs: Record<string, string>;
}): CommandResult {
  if (testPipelineBackend?.dispatch) {
    return testPipelineBackend.dispatch(input);
  }
  if (isUnitTestProcess()) {
    return {
      ok: false,
      status: 1,
      stdout: "",
      stderr:
        "Azure DevOps pipeline dispatch is disabled during unit tests. Set AKS_RP_E2E_APP_ALLOW_ADO_TEST_DISPATCH=1 only for an intentional live pipeline test.",
    };
  }
  const args = [
    "pipelines",
    "run",
    "--id",
    adoClient(input.client).pipelineId,
    ...adoArgs(input.client),
    "--branch",
    input.branch,
  ];
  const parameters = Object.entries(input.inputs).map(
    ([key, value]) => `${key}=${value}`,
  );
  if (parameters.length > 0) {
    args.push("--parameters", ...parameters);
  }
  args.push("-o", "json");
  return runCommand(input.projectDir, "az", args, 120_000);
}

export function downloadWorkflowRunArtifacts(input: {
  client: PipelineClient;
  projectDir: string;
  artifactDir: string;
  runId: string;
}): CommandResult {
  if (testPipelineBackend?.downloadArtifacts) {
    mkdirSync(input.artifactDir, { recursive: true });
    return testPipelineBackend.downloadArtifacts(input);
  }
  mkdirSync(input.artifactDir, { recursive: true });
  const list = runCommand(
    input.projectDir,
    "az",
    [
      "pipelines",
      "runs",
      "artifact",
      "list",
      "--run-id",
      input.runId,
      ...adoArgs(input.client),
      "-o",
      "json",
    ],
    120_000,
  );
  if (!list.ok) return list;
  let artifacts: AdoArtifactPayload[] = [];
  try {
    const parsed = JSON.parse(list.stdout) as unknown;
    artifacts = Array.isArray(parsed) ? (parsed as AdoArtifactPayload[]) : [];
  } catch {
    artifacts = [];
  }
  if (artifacts.length === 0) {
    return {
      ok: false,
      status: 404,
      stdout: "",
      stderr: `No artifacts were listed for Azure DevOps pipeline run ${input.runId}.`,
    };
  }
  for (const artifact of artifacts) {
    const name = typeof artifact.name === "string" ? artifact.name : "";
    if (!name) continue;
    const download = runCommand(
      input.projectDir,
      "az",
      [
        "pipelines",
        "runs",
        "artifact",
        "download",
        "--run-id",
        input.runId,
        "--artifact-name",
        name,
        "--path",
        input.artifactDir,
        ...adoArgs(input.client),
        "-o",
        "none",
      ],
      10 * 60_000,
    );
    if (!download.ok) return download;
  }
  return {
    ok: true,
    status: 0,
    stdout: `Downloaded ${artifacts.length} Azure DevOps artifact(s).`,
    stderr: "",
  };
}

export function getWorkflowRun(input: {
  client: PipelineClient;
  projectDir: string;
  runId: string;
}): PipelineRun | null {
  if (testPipelineBackend?.getRun) {
    return testPipelineBackend.getRun(input);
  }
  const result = runCommand(input.projectDir, "az", [
    "pipelines",
    "runs",
    "show",
    "--id",
    input.runId,
    ...adoArgs(input.client),
    "-o",
    "json",
  ]);
  if (!result.ok) return null;
  const parsed = parseJsonObject(result.stdout);
  return parsed ? parseAdoRun(input.client, parsed) : null;
}

export async function waitForWorkflowRun(input: {
  client: PipelineClient;
  projectDir: string;
  runId: string;
  timeoutMs: number;
  onPoll?: (run: PipelineRun | null) => void;
}): Promise<{ ok: boolean; run: PipelineRun | null; detail?: string }> {
  const deadline = Date.now() + input.timeoutMs;
  let lastRun: PipelineRun | null = null;
  while (Date.now() < deadline) {
    lastRun = getWorkflowRun(input);
    input.onPoll?.(lastRun);
    if (lastRun?.status === "completed") {
      return {
        ok: lastRun.conclusion === "success",
        run: lastRun,
        detail:
          lastRun.conclusion === "success"
            ? undefined
            : `Azure DevOps pipeline run completed with result ${lastRun.conclusion ?? "unknown"}`,
      };
    }
    await sleepMs(pipelinePollIntervalMs());
  }
  return {
    ok: false,
    run: lastRun,
    detail: `Timed out waiting for Azure DevOps pipeline run ${input.runId} to complete.`,
  };
}
