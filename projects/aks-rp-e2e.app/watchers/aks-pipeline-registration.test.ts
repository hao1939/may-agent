import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendTrackedPipelineRunId } from "./aks-pipeline.js";

const roots: string[] = [];
const priorAzCliPath = process.env.AZURE_CLI_PATH;
const priorWatcherToggle = process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO;

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
  if (priorAzCliPath === undefined) delete process.env.AZURE_CLI_PATH;
  else process.env.AZURE_CLI_PATH = priorAzCliPath;
  if (priorWatcherToggle === undefined)
    delete process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO;
  else process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO = priorWatcherToggle;
});

test("the watcher adopts a provider-registered non-467665 run without any task-state scan", async () => {
  const root = mkdtempSync(join(tmpdir(), "aks-pipeline-registration-"));
  roots.push(root);
  const appDir = join(root, "aks-rp-e2e.app");
  const projectDir = join(root, "aks-rp-e2e");
  mkdirSync(join(projectDir, "runs", "test-results"), { recursive: true });

  const fakeAzPath = join(root, "fake-az.js");
  writeFileSync(
    fakeAzPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const json = (value) => process.stdout.write(JSON.stringify(value));
if (args[0] === "pipelines" && args[1] === "runs" && args[2] === "list") {
  json([]);
  process.exit(0);
}
if (args[0] === "pipelines" && args[1] === "runs" && args[2] === "show") {
  const runId = args[args.indexOf("--id") + 1];
  if (runId !== "174851380") process.exit(1);
  json({
    id: 174851380,
    status: "inProgress",
    result: null,
    sourceBranch: "refs/heads/master",
    sourceVersion: "2947d00902b28d2975893cd536708da6de89c69c",
    queueTime: "2026-08-02T13:23:00.977069+00:00",
    finishTime: null,
  });
  process.exit(0);
}
process.exit(1);
`,
    "utf8",
  );
  chmodSync(fakeAzPath, 0o755);
  process.env.AZURE_CLI_PATH = fakeAzPath;
  delete process.env.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO;

  expect(existsSync(join(appDir, ".state", "tasks", "state.json"))).toBe(false);
  expect(
    existsSync(join(appDir, ".state", "watchers", "aks-pipeline.json")),
  ).toBe(false);
  expect(
    existsSync(
      join(appDir, ".state", "watchers", "aks-pipeline-registrations.json"),
    ),
  ).toBe(false);

  const registration = appendTrackedPipelineRunId(appDir, "174851380");
  expect(registration).toMatchObject({
    changed: true,
    runIds: ["174851380"],
  });

  const runner = spawnSync(
    Bun.which("bun") ?? "bun",
    [
      "-e",
      `import { resolve } from "node:path";
import { observeAksPipelines } from "${join(import.meta.dir, "aks-pipeline.ts")}";
const emitted = [];
const appDir = process.env.APP_DIR;
const ctx = {
  appPath: (path) => resolve(appDir, path),
  emit: (event) => emitted.push(event),
  noop: (reason) => ({ reason }),
};
const result = await observeAksPipelines(ctx);
process.stdout.write(JSON.stringify({ result, emitted }));`,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        APP_DIR: appDir,
        AZURE_CLI_PATH: fakeAzPath,
      },
    },
  );
  expect(runner.status).toBe(0);
  const payload = JSON.parse(runner.stdout || "{}");

  expect(payload.result).toEqual(expect.anything());
  expect(payload.emitted).toContainEqual(
    expect.objectContaining({
      type: "pipeline-run.state",
      pipelineRunId: "174851380",
      state: "inProgress",
      terminal: false,
      sourceBranch: "refs/heads/master",
    }),
  );

  const persistedRegistration = JSON.parse(
    readFileSync(
      join(appDir, ".state", "watchers", "aks-pipeline-registrations.json"),
      "utf8",
    ),
  );
  expect(persistedRegistration.runIds).toEqual([]);

  const watcherState = JSON.parse(
    readFileSync(
      join(appDir, ".state", "watchers", "aks-pipeline.json"),
      "utf8",
    ),
  );
  expect(watcherState.trackedRunIds).toContain("174851380");
});

test("the watcher keeps the event loop responsive while Azure CLI calls are pending", () => {
  const root = mkdtempSync(join(tmpdir(), "aks-pipeline-nonblocking-"));
  roots.push(root);
  const appDir = join(root, "aks-rp-e2e.app");
  mkdirSync(join(root, "aks-rp-e2e", "runs", "test-results"), {
    recursive: true,
  });

  const fakeAzPath = join(root, "slow-fake-az.js");
  writeFileSync(
    fakeAzPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "pipelines" && args[1] === "runs" && args[2] === "list") {
  setTimeout(() => process.stdout.write("[]"), 150);
  return;
}
process.exit(1);
`,
    "utf8",
  );
  chmodSync(fakeAzPath, 0o755);
  const childEnv = {
    ...process.env,
    APP_DIR: appDir,
    AZURE_CLI_PATH: fakeAzPath,
  };
  delete childEnv.MAY_AGENT_AKS_PIPELINE_WATCHER_ADO;

  const runner = spawnSync(
    Bun.which("bun") ?? "bun",
    [
      "-e",
      `import { resolve } from "node:path";
import { observeAksPipelines } from "${join(import.meta.dir, "aks-pipeline.ts")}";
const ctx = {
  appPath: (path) => resolve(process.env.APP_DIR, path),
  emit: () => {},
  noop: (reason) => ({ reason }),
};
let settled = false;
const observation = observeAksPipelines(ctx);
void observation.finally(() => { settled = true; });
await new Promise((resolveTimer) => setTimeout(resolveTimer, 30));
const responsiveWhileProviderPending = !settled;
await observation;
process.stdout.write(JSON.stringify({ responsiveWhileProviderPending }));`,
    ],
    {
      encoding: "utf8",
      env: childEnv,
    },
  );

  expect(runner.status).toBe(0);
  expect(JSON.parse(runner.stdout || "{}")).toEqual({
    responsiveWhileProviderPending: true,
  });
});
