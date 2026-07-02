import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type CommandResult = {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export type GitHubWorkflowRun = {
  databaseId?: number;
  status?: string;
  conclusion?: string;
  url?: string;
  createdAt?: string;
  displayTitle?: string;
};

export type GitHubDispatchMetadata = {
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

type GitHubRepo = {
  owner: string;
  repo: string;
};

export type GitHubClient =
  | {
      kind: "gh";
    }
  | {
      kind: "api";
      repo: GitHubRepo;
      token: string;
    };

type GitHubArtifact = {
  id?: number;
  name?: string;
  archive_download_url?: string;
};

type DownloadedArtifactInspection = {
  ok: boolean;
  responseKind: "zip" | "json" | "missing" | "other";
  detail?: string;
};

type GitHubApiResponse = {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
};

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

export function githubPollIntervalMs(): number {
  const parsed = Number.parseInt(
    process.env.MAY_GITHUB_ACTIONS_POLL_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
}

export function githubRunLookupPollIntervalMs(): number {
  const parsed = Number.parseInt(
    process.env.MAY_GITHUB_ACTIONS_RUN_LOOKUP_POLL_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

function parseGitHubRepo(input: string): GitHubRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ssh = trimmed.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (ssh) {
    return { owner: ssh[1], repo: ssh[2] };
  }
  try {
    const url = new URL(trimmed);
    if (!/github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname
      .replace(/^\/+/, "")
      .replace(/\.git$/i, "")
      .split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

function readOriginRemoteUrl(projectDir: string): string {
  const remote = runCommand(
    projectDir,
    "git",
    ["remote", "get-url", "origin"],
    30_000,
  );
  if (remote.ok && remote.stdout.trim()) {
    return remote.stdout.trim();
  }
  try {
    const gitConfig = readFileSync(join(projectDir, ".git", "config"), "utf-8");
    const match = gitConfig.match(
      /\[remote\s+"origin"\][\s\S]*?^\s*url\s*=\s*(.+)\s*$/m,
    );
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

function resolveGitHubRepo(projectDir: string): GitHubRepo | null {
  return parseGitHubRepo(readOriginRemoteUrl(projectDir));
}

function resolveGitHubToken(projectDir: string): string {
  const envToken =
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GITHUB_PAT ||
    process.env.MAY_GITHUB_TOKEN ||
    process.env.MAY_GITHUB_PAT;
  if (envToken?.trim()) return envToken.trim();
  try {
    const url = new URL(readOriginRemoteUrl(projectDir));
    if (!/github\.com$/i.test(url.hostname)) return "";
    return decodeURIComponent(url.username || "").trim();
  } catch {
    return "";
  }
}

export function resolveGitHubClient(projectDir: string): {
  client: GitHubClient | null;
  reason?: string;
} {
  const repo = resolveGitHubRepo(projectDir);
  const token = repo ? resolveGitHubToken(projectDir) : "";
  if (repo && token) {
    return { client: { kind: "api", repo, token } };
  }

  const ghVersion = runCommand(projectDir, "gh", ["--version"], 30_000);
  if (ghVersion.ok) {
    const ghAuth = runCommand(projectDir, "gh", ["auth", "status"], 30_000);
    if (ghAuth.ok) {
      return { client: { kind: "gh" } };
    }
    return {
      client: null,
      reason:
        ghAuth.stderr ||
        ghAuth.stdout ||
        "GitHub API unavailable because no token was found and gh CLI is not authenticated.",
    };
  }

  if (!repo) {
    return {
      client: null,
      reason:
        ghVersion.error ||
        ghVersion.stderr ||
        "GitHub API unavailable because origin repo could not be resolved, and gh CLI is unavailable.",
    };
  }
  return {
    client: null,
    reason:
      ghVersion.error ||
      ghVersion.stderr ||
      "GitHub API unavailable because no token was found in env or origin remote, and gh CLI is unavailable.",
  };
}

function githubApi(
  client: Extract<GitHubClient, { kind: "api" }>,
  method: string,
  apiPath: string,
  body?: unknown,
): GitHubApiResponse {
  const url = `https://api.github.com${apiPath}`;
  const args = [
    "-sS",
    "-L",
    "-X",
    method,
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    `Authorization: Bearer ${client.token}`,
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
  ];
  if (body !== undefined) {
    args.push(
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify(body),
    );
  }
  args.push("-w", "\n%{http_code}", url);
  const result = runCommand("/app", "curl", args, 120_000);
  if (!result.ok && !result.stdout) {
    return {
      ok: false,
      status: result.status ?? 0,
      body: result.stderr || result.error || "",
      error: result.error || result.stderr,
    };
  }
  const output = result.stdout || "";
  const match = output.match(/\n(\d{3})\s*$/);
  const status = match ? Number(match[1]) : (result.status ?? 0);
  const responseBody = match ? output.slice(0, match.index) : output;
  return {
    ok: status >= 200 && status < 300,
    status,
    body: responseBody,
    error: result.ok ? undefined : result.stderr || result.error,
  };
}

function pickNewestWorkflowRun(input: {
  runs: GitHubWorkflowRun[];
  sinceMs: number;
  match?: (run: GitHubWorkflowRun) => boolean;
}): GitHubWorkflowRun | null {
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

function newestWorkflowRunViaGh(input: {
  projectDir: string;
  workflow: string;
  branch: string;
  sinceMs: number;
  match?: (run: GitHubWorkflowRun) => boolean;
}): GitHubWorkflowRun | null {
  const list = runCommand(input.projectDir, "gh", [
    "run",
    "list",
    "--workflow",
    input.workflow,
    "--branch",
    input.branch,
    "--event",
    "workflow_dispatch",
    "--limit",
    "50",
    "--json",
    "databaseId,status,conclusion,url,createdAt,displayTitle",
  ]);
  if (!list.ok) return null;
  try {
    const runs = JSON.parse(list.stdout) as GitHubWorkflowRun[];
    return pickNewestWorkflowRun({
      runs,
      sinceMs: input.sinceMs,
      match: input.match,
    });
  } catch {
    return null;
  }
}

function newestWorkflowRunViaApi(input: {
  client: Extract<GitHubClient, { kind: "api" }>;
  workflow: string;
  branch: string;
  sinceMs: number;
  match?: (run: GitHubWorkflowRun) => boolean;
}): GitHubWorkflowRun | null {
  const response = githubApi(
    input.client,
    "GET",
    `/repos/${input.client.repo.owner}/${input.client.repo.repo}/actions/workflows/${encodeURIComponent(input.workflow)}/runs?branch=${encodeURIComponent(input.branch)}&event=workflow_dispatch&per_page=50`,
  );
  if (!response.ok) return null;
  try {
    const payload = JSON.parse(response.body) as {
      workflow_runs?: Array<Record<string, unknown>>;
    };
    const runs = (payload.workflow_runs ?? []).map(
      (run) =>
        ({
          databaseId: typeof run.id === "number" ? run.id : Number(run.id),
          status: typeof run.status === "string" ? run.status : undefined,
          conclusion:
            typeof run.conclusion === "string" ? run.conclusion : undefined,
          url:
            typeof run.html_url === "string"
              ? run.html_url
              : typeof run.url === "string"
                ? run.url
                : undefined,
          createdAt:
            typeof run.created_at === "string" ? run.created_at : undefined,
          displayTitle:
            typeof run.display_title === "string"
              ? run.display_title
              : undefined,
        }) satisfies GitHubWorkflowRun,
    );
    return pickNewestWorkflowRun({
      runs,
      sinceMs: input.sinceMs,
      match: input.match,
    });
  } catch {
    return null;
  }
}

export function newestWorkflowRun(input: {
  client: GitHubClient;
  projectDir: string;
  workflow: string;
  branch: string;
  sinceMs: number;
  match?: (run: GitHubWorkflowRun) => boolean;
}): GitHubWorkflowRun | null {
  return input.client.kind === "gh"
    ? newestWorkflowRunViaGh(input)
    : newestWorkflowRunViaApi({
        client: input.client,
        workflow: input.workflow,
        branch: input.branch,
        sinceMs: input.sinceMs,
        match: input.match,
      });
}

export function activeWorkflowRuns(input: {
  client: GitHubClient;
  projectDir: string;
  branch: string;
}): GitHubWorkflowRun[] {
  if (input.client.kind === "gh") {
    const list = runCommand(input.projectDir, "gh", [
      "run",
      "list",
      "--branch",
      input.branch,
      "--status",
      "in_progress",
      "--limit",
      "100",
      "--json",
      "databaseId,status,conclusion,url,createdAt,displayTitle",
    ]);
    if (!list.ok) return [];
    try {
      return JSON.parse(list.stdout) as GitHubWorkflowRun[];
    } catch {
      return [];
    }
  }

  const response = githubApi(
    input.client,
    "GET",
    `/repos/${input.client.repo.owner}/${input.client.repo.repo}/actions/runs?branch=${encodeURIComponent(input.branch)}&status=in_progress&per_page=100`,
  );
  if (!response.ok) return [];
  try {
    const payload = JSON.parse(response.body) as {
      workflow_runs?: Array<Record<string, unknown>>;
    };
    return (payload.workflow_runs ?? []).map(
      (run) =>
        ({
          databaseId: typeof run.id === "number" ? run.id : Number(run.id),
          status: typeof run.status === "string" ? run.status : undefined,
          conclusion:
            typeof run.conclusion === "string" ? run.conclusion : undefined,
          url:
            typeof run.html_url === "string"
              ? run.html_url
              : typeof run.url === "string"
                ? run.url
                : undefined,
          createdAt:
            typeof run.created_at === "string" ? run.created_at : undefined,
          displayTitle:
            typeof run.display_title === "string"
              ? run.display_title
              : undefined,
        }) satisfies GitHubWorkflowRun,
    );
  } catch {
    return [];
  }
}

export function writeGitHubDispatchMetadata(
  path: string,
  metadata: GitHubDispatchMetadata,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
}

export function dispatchWorkflow(input: {
  client: GitHubClient;
  projectDir: string;
  workflow: string;
  branch: string;
  inputs: Record<string, string>;
}): CommandResult {
  if (input.client.kind === "gh") {
    const args = ["workflow", "run", input.workflow, "--ref", input.branch];
    for (const [key, value] of Object.entries(input.inputs)) {
      args.push("-f", `${key}=${value}`);
    }
    return runCommand(input.projectDir, "gh", args);
  }
  const response = githubApi(
    input.client,
    "POST",
    `/repos/${input.client.repo.owner}/${input.client.repo.repo}/actions/workflows/${encodeURIComponent(input.workflow)}/dispatches`,
    {
      ref: input.branch,
      inputs: input.inputs,
    },
  );
  return {
    ok: response.ok,
    status: response.status,
    stdout: response.body,
    stderr: response.ok ? "" : response.body,
    error: response.error,
  };
}

function listRunArtifacts(input: {
  client: Extract<GitHubClient, { kind: "api" }>;
  runId: string;
}): GitHubArtifact[] {
  const response = githubApi(
    input.client,
    "GET",
    `/repos/${input.client.repo.owner}/${input.client.repo.repo}/actions/runs/${encodeURIComponent(input.runId)}/artifacts`,
  );
  if (!response.ok) return [];
  try {
    const payload = JSON.parse(response.body) as {
      artifacts?: Array<Record<string, unknown>>;
    };
    return (payload.artifacts ?? []).map((artifact) => ({
      id: typeof artifact.id === "number" ? artifact.id : Number(artifact.id),
      name: typeof artifact.name === "string" ? artifact.name : undefined,
      archive_download_url:
        typeof artifact.archive_download_url === "string"
          ? artifact.archive_download_url
          : undefined,
    }));
  } catch {
    return [];
  }
}

function inspectDownloadedArtifact(
  zipPath: string,
): DownloadedArtifactInspection {
  if (!existsSync(zipPath)) {
    return {
      ok: false,
      responseKind: "missing",
      detail: `artifact download did not create ${zipPath}`,
    };
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(zipPath);
  } catch (error) {
    return {
      ok: false,
      responseKind: "other",
      detail: `artifact download could not be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return { ok: true, responseKind: "zip" };
  }

  const text = bytes.toString("utf-8").trim();
  if (text) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const message =
        typeof parsed.message === "string" ? parsed.message.trim() : "";
      const status =
        typeof parsed.status === "string" || typeof parsed.status === "number"
          ? String(parsed.status).trim()
          : "";
      return {
        ok: false,
        responseKind: "json",
        detail: [
          "artifact download returned non-zip JSON",
          message ? `message=${message}` : "",
          status ? `status=${status}` : "",
        ]
          .filter(Boolean)
          .join("; "),
      };
    } catch {
      // Fall through to preview reporting.
    }
  }

  const preview = bytes
    .subarray(0, Math.min(bytes.length, 120))
    .toString("utf-8")
    .replace(/\s+/g, " ")
    .trim();
  return {
    ok: false,
    responseKind: "other",
    detail: preview
      ? `artifact download returned non-zip payload preview=${preview}`
      : `artifact download returned non-zip payload (${bytes.length} bytes)`,
  };
}

export function downloadWorkflowRunArtifacts(input: {
  client: GitHubClient;
  projectDir: string;
  artifactDir: string;
  runId: string;
}): CommandResult {
  mkdirSync(input.artifactDir, { recursive: true });
  if (input.client.kind === "gh") {
    return runCommand(
      input.projectDir,
      "gh",
      ["run", "download", input.runId, "--dir", input.artifactDir],
      10 * 60_000,
    );
  }

  const artifacts = listRunArtifacts({
    client: input.client,
    runId: input.runId,
  });
  if (artifacts.length === 0) {
    return {
      ok: false,
      status: 404,
      stdout: "",
      stderr: `No artifacts were listed for GitHub run ${input.runId}.`,
    };
  }
  for (const artifact of artifacts) {
    if (!artifact.id || !artifact.archive_download_url) continue;
    const zipPath = join(
      input.artifactDir,
      `${artifact.name || artifact.id}.zip`,
    );
    const curl = runCommand(
      "/app",
      "curl",
      [
        "-sS",
        "-L",
        "-H",
        "Accept: application/vnd.github+json",
        "-H",
        `Authorization: Bearer ${input.client.token}`,
        "-H",
        "X-GitHub-Api-Version: 2022-11-28",
        "-o",
        zipPath,
        artifact.archive_download_url,
      ],
      10 * 60_000,
    );
    if (!curl.ok) return curl;
    const artifactInspection = inspectDownloadedArtifact(zipPath);
    if (!artifactInspection.ok) {
      return {
        ok: false,
        status: 422,
        stdout: "",
        stderr: `Artifact ${artifact.name || artifact.id} for GitHub run ${input.runId} failed validation before unzip: ${artifactInspection.detail || "unknown artifact payload"}`,
      };
    }
    const extractDir = join(
      input.artifactDir,
      artifact.name || String(artifact.id),
    );
    mkdirSync(extractDir, { recursive: true });
    const unzip = runCommand(
      "/app",
      "unzip",
      ["-oq", zipPath, "-d", extractDir],
      10 * 60_000,
    );
    if (!unzip.ok) return unzip;
  }
  return {
    ok: true,
    status: 0,
    stdout: `Downloaded ${artifacts.length} artifact(s).`,
    stderr: "",
  };
}

export function getWorkflowRun(input: {
  client: GitHubClient;
  projectDir: string;
  runId: string;
}): GitHubWorkflowRun | null {
  if (input.client.kind === "gh") {
    const result = runCommand(input.projectDir, "gh", [
      "run",
      "view",
      input.runId,
      "--json",
      "databaseId,status,conclusion,url,createdAt,displayTitle",
    ]);
    if (!result.ok) return null;
    try {
      return JSON.parse(result.stdout) as GitHubWorkflowRun;
    } catch {
      return null;
    }
  }
  const response = githubApi(
    input.client,
    "GET",
    `/repos/${input.client.repo.owner}/${input.client.repo.repo}/actions/runs/${encodeURIComponent(input.runId)}`,
  );
  if (!response.ok) return null;
  try {
    const run = JSON.parse(response.body) as Record<string, unknown>;
    return {
      databaseId: typeof run.id === "number" ? run.id : Number(run.id),
      status: typeof run.status === "string" ? run.status : undefined,
      conclusion:
        typeof run.conclusion === "string" ? run.conclusion : undefined,
      url:
        typeof run.html_url === "string"
          ? run.html_url
          : typeof run.url === "string"
            ? run.url
            : undefined,
      createdAt:
        typeof run.created_at === "string" ? run.created_at : undefined,
      displayTitle:
        typeof run.display_title === "string" ? run.display_title : undefined,
    };
  } catch {
    return null;
  }
}

export async function waitForWorkflowRun(input: {
  client: GitHubClient;
  projectDir: string;
  runId: string;
  timeoutMs: number;
  onPoll?: (run: GitHubWorkflowRun | null) => void;
}): Promise<{ ok: boolean; run: GitHubWorkflowRun | null; detail?: string }> {
  const deadline = Date.now() + input.timeoutMs;
  let lastRun: GitHubWorkflowRun | null = null;
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
            : `GitHub run completed with conclusion ${lastRun.conclusion ?? "unknown"}`,
      };
    }
    await sleepMs(githubPollIntervalMs());
  }
  return {
    ok: false,
    run: lastRun,
    detail: `Timed out waiting for GitHub run ${input.runId} to complete.`,
  };
}
