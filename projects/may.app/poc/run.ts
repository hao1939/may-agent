/** Explicit paid-model trial. Isolated fixture state; never connects to a live Task DB. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { admitTaskReconcileResult } from "@may-agent/sdk";
import { createTestAppRead } from "@may-agent/sdk/testing";

if (!process.argv.includes("--live"))
  throw new Error(
    "Pass --live to explicitly run the Bob/tech-lead model trial",
  );
const host = process.env.MAY_HOST_SOURCE;
if (!host)
  throw new Error(
    "MAY_HOST_SOURCE must identify the reviewed Host source checkout",
  );
if (!process.env.MODEL_BASE_URL)
  throw new Error("MODEL_BASE_URL is required for the isolated model trial");
const load = (path: string) => import(pathToFileURL(join(host, path)).href);
const { SubagentManager } = await load("src/lib/manager.ts");
const { createWorkflowRunner } = await load("src/lib/workflow-tool.ts");
const { createModelRegistry } = await load("src/app/model-registry.ts");
const { buildAgentDefinition } = await load(
  "src/app/loader/agent-definition.ts",
);
const { createCodingTools } = await load("src/lib/tools/coding.ts");
const { createReadTool } = await load("src/lib/tools/read.ts");
const { createFinishTool } = await load("src/lib/tools/lifecycle.ts");
const { getBuiltinModel } = await import(
  pathToFileURL(
    join(host, "node_modules/@earendil-works/pi-ai/dist/providers/all.js"),
  ).href
);

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = mkdtempSync(join(tmpdir(), "may-development-live-"));
const repo = join(root, "repository"),
  worktree = join(root, "candidate"),
  persist = join(root, "runtime");
mkdirSync(repo);
mkdirSync(persist);
mkdirSync(join(root, "shared"));
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
git(repo, "init", "-b", "main");
git(repo, "config", "user.name", "Development PoC");
git(repo, "config", "user.email", "development@example.invalid");
writeFileSync(
  join(repo, "duration.cjs"),
  "exports.minutes = input => parseInt(input, 10);\n",
);
writeFileSync(
  join(repo, "verify.cjs"),
  `const assert = require('node:assert/strict'); const {minutes} = require('./duration.cjs'); assert.equal(minutes('15m'),15); assert.equal(minutes('2h'),120); assert.equal(minutes('0m'),0); for(const value of ['bad','-1m','1.5h','2h trailing']) assert.throws(()=>minutes(value)); if(process.argv[2]==='revised') {assert.equal(minutes('1h 30m'),90); assert.equal(minutes('0h 0m'),0); assert.throws(()=>minutes('1h -2m'));} console.log('duration checks passed');\n`,
);
writeFileSync(
  join(repo, "README.md"),
  "A dependency-free duration parser. Export minutes(input) from duration.cjs.\n",
);
writeFileSync(join(repo, ".gitignore"), ".state/\n");
git(repo, "add", ".");
git(repo, "commit", "-m", "duration parser baseline");
git(repo, "worktree", "add", "-b", "task/duration", worktree);
const models = createModelRegistry();
// Temporary registry selection for this isolated trial. Catalog metadata and
// exact requested model are used; no substitution or production configuration.
models["gpt-6-astra"] ??= {
  ...getBuiltinModel("github-copilot", "gpt-6-astra"),
  baseUrl: process.env.MODEL_BASE_URL,
  apiKey: process.env.MODEL_API_KEY || "not-needed",
};
const manager = new SubagentManager({
  persistDir: persist,
  projectRoot: worktree,
});
for (const profile of ["bob", "tech-lead"]) {
  const dir = join(appRoot, "agents", profile);
  const config = JSON.parse(readFileSync(join(dir, "agent.json"), "utf8"));
  const definition = await buildAgentDefinition({
    config,
    source: {
      name: profile,
      dir,
      agentsRoot: join(appRoot, "agents"),
      projectId: "may",
      projectDir: worktree,
      relativeDir: `projects/may.app/agents/${profile}`,
    },
    model: models[config.model],
    tools: [
      ...(profile === "bob"
        ? [createReadTool(worktree)]
        : createCodingTools(worktree, { agentName: config.name })),
      createFinishTool({
        agentName: config.name,
        projectRoot: worktree,
        persistDir: persist,
      }),
    ],
    projectRoot: worktree,
    sharedRoot: join(root, "shared"),
    globalAgentsRoot: join(root, "agents"),
    appLocal: true,
  });
  manager.register(definition);
}
const specification = (revised: boolean) => ({
  kind: "goal",
  data: {
    outcome: revised
      ? "Parse whole-number minute/hour durations, including combined hours and minutes"
      : "Parse whole-number minute or hour durations correctly",
    acceptance: [
      "15m returns 15; 2h returns 120; 0m returns 0",
      "Reject malformed, negative and fractional durations",
      ...(revised
        ? [
            "1h 30m returns 90; 0h 0m returns 0; reject negative combined values",
          ]
        : []),
    ],
    constraints: [
      "Use Node built-ins only; preserve existing verification assertions",
      "Only create a local candidate; no network, dependencies, PR, push, merge or deployment",
    ],
    verify: ["node", "verify.cjs", ...(revised ? ["revised"] : [])],
  },
});
let task: any = {
  id: "goal/duration-poc",
  parentId: "may",
  generation: 1,
  status: "running",
  conditions: [],
  input: specification(false),
  outcome: specification(false).data.outcome,
  acceptance: specification(false).data.acceptance,
};
const taskFile = join(root, "fixture-task.json");
const reports: unknown[] = [];
async function run(label: string) {
  console.log(
    JSON.stringify({
      event: "invocation",
      label,
      taskId: task.id,
      generation: task.generation,
      root,
    }),
  );
  const runner = createWorkflowRunner({
    manager,
    agentName: "may-tech-lead",
    projectId: "may",
    persistDir: persist,
    workflowDir: join(appRoot, "agents/may/workflows"),
    workflowInput: task.input,
    read: createTestAppRead({
      tasks: {
        list: async () => ({ items: [] }),
        outcomes: async () => {
          throw Error("unused");
        },
        get: async () => task,
      },
    }),
    executionPaths: {
      appDir: appRoot,
      projectDir: repo,
      workspaceDir: worktree,
    },
    reconciliation: {
      appId: "may",
      taskId: task.id,
      generation: task.generation,
      resourceVersion: task.generation,
      agent: "may-tech-lead",
      owner: "may-tech-lead",
      outcome: task.outcome,
      acceptance: task.acceptance,
      input: task.input,
      children: { live: [], completed: [] },
      waits: { open: [], note: "" },
      taskSnapshot: { live: [], truncated: false },
      events: { items: [], truncated: false },
    },
    executionTimeoutMs: 720_000,
    onEvent: (event: any) => {
      if (
        ["workflow.step_started", "workflow.step_completed"].includes(
          event.type,
        )
      )
        console.log(
          JSON.stringify({
            event: event.type,
            step: event.step,
            sessionId: event.sessionId,
          }),
        );
    },
  });
  const started = Date.now();
  const result = await runner.run("develop-change", label);
  const admitted = admitTaskReconcileResult(result.output);
  if (!admitted.ok)
    throw new Error(
      `Workflow result did not satisfy Task admission: ${JSON.stringify(result)}`,
    );
  task.result = result.output.result;
  writeFileSync(taskFile, JSON.stringify(task, null, 2));
  const report = {
    label,
    durationMs: Date.now() - started,
    state: result.output.state,
    summary: result.output.summary,
    taskId: task.id,
    generation: task.generation,
    result: task.result,
  };
  reports.push(report);
  writeFileSync(join(root, "reports.json"), JSON.stringify(reports, null, 2));
  console.log(
    JSON.stringify({
      event: "result",
      label,
      state: report.state,
      summary: report.summary,
      durationMs: report.durationMs,
    }),
  );
  if (report.state !== "converged")
    throw new Error(`Trial needs investigation: ${report.summary}`);
  // Independent check, outside the candidate's editable verification script.
  const probe = `const a=require('node:assert/strict');const m=require('./duration.cjs').minutes;a.equal(m('2h'),120);a.throws(()=>m('-1m'));a.throws(()=>m('1.5h'));${task.generation === 2 ? "a.equal(m('1h 30m'),90);a.throws(()=>m('1h -2m'));" : ""}`;
  execFileSync("node", ["-e", probe], { cwd: worktree });
}
await run("initial requirement");
task = JSON.parse(readFileSync(taskFile, "utf8"));
await run("fresh invocation with unchanged evidence");
task.generation = 2;
task.input = specification(true);
task.outcome = task.input.data.outcome;
task.acceptance = task.input.data.acceptance;
await run("creator requirement correction on same Task");
console.log(
  JSON.stringify({
    event: "complete",
    evidence: root,
    baseUnchanged:
      readFileSync(join(repo, "duration.cjs"), "utf8") ===
      "exports.minutes = input => parseInt(input, 10);\n",
  }),
);
