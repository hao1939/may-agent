import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runStage } from "./standalone-stage.ts";

const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function trial(kind: "done" | "blocked" | "cancel" = "done") {
  const root = mkdtempSync(join(tmpdir(), "standalone-stage-"));
  roots.push(root);
  const repo = join(root, "repo");
  const cwd = join(root, "worktree");
  const outputRoot = join(root, "evidence", "invocation");
  mkdirSync(repo);
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "user.name", "Standalone fixture");
  git("config", "user.email", "fixture@example.invalid");
  writeFileSync(join(repo, ".gitignore"), ".state/\n");
  const sdkIndex = fileURLToPath(import.meta.resolve("@may-agent/sdk"));
  writeFileSync(join(repo, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths: { "@may-agent/sdk": [sdkIndex] } } }));
  // Give the fixture its own linked source root even when tests run on shared main.
  const appRoot = resolve(import.meta.dir, "..");
  for (const agent of ["alex", "gym"]) {
    const target = join(repo, "projects", "alex.app", "agents", agent);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "agent.json"), readFileSync(join(appRoot, "agents", agent, "agent.json")));
    writeFileSync(join(target, "AGENTS.md"), `# ${agent} fixture\n`);
    if (agent === "alex") {
      mkdirSync(join(target, "workflows"));
      writeFileSync(join(target, "workflows", "diagnose-improvement.ts"), readFileSync(join(appRoot, "agents", agent, "workflows", "diagnose-improvement.ts")));
    }
  }
  writeFileSync(join(repo, "projects/alex.app/app.ts"), "export {};\n");
  git("add", ".");
  git("commit", "-m", "fixture baseline");
  git("worktree", "add", "-b", "trial", cwd);
  const baselineDir = join(root, "baseline");
  mkdirSync(baselineDir);
  writeFileSync(join(baselineDir, "manifest.json"), JSON.stringify({
    agent: "scout", benchmark: "fixture", scenarios: ["blocked"],
    trials: [{ scenario: "blocked", machine_verdict: "fail", result_path: "result.json" }],
  }));
  writeFileSync(join(baselineDir, "result.json"), JSON.stringify({ agent_status: "blocked", checks: [] }));
  const fixtureFile = join(root, "fixtures.ts");
  const output = { target: "scout", disposition: "insufficient_evidence", detected_regimes: ["execution_failure"], root_cause_summary: "Blocked execution cannot establish a behavior regression.", proposed_changes: [] };
  const handler = kind === "cancel"
    ? "({signal}) => new Promise((resolve, reject) => { if (signal.aborted) reject(signal.reason); else signal.addEventListener('abort', () => reject(signal.reason), {once:true}); })"
    : `async () => ({id:'fixture',kind:'agent',status:${JSON.stringify(kind === "blocked" ? "error" : "done")},summary:'Fixture result',output:${JSON.stringify(output)},cleanupConfirmed:true})`;
  // Standalone fixture keys name the backing prompt definition; the workflow
  // still calls the canonical App-local address alex/gym.
  writeFileSync(fixtureFile, `export const agentFixtures = { gym: ${handler} };\n`);
  const config = {
    target: "alex/diagnose-improvement", input: { prompt: "Diagnose the frozen baseline", data: { baselineDir } },
    task: { outcome: "Diagnose the captured execution failure", acceptance: ["Preserve insufficient evidence"] },
    cwd, projectRoot: cwd, outputRoot, timeoutMs: 10_000, fixtureFile,
  };
  const configFile = join(root, "stage.json");
  writeFileSync(configFile, JSON.stringify(config));
  return { root, cwd, outputRoot, config, configFile, read: (file: string) => JSON.parse(readFileSync(join(outputRoot, file), "utf8")) };
}

test("real standalone diagnosis retains authoritative status, hold decision and provenance", async () => {
  const t = trial();
  const result = await runStage(t.configFile);
  expect(result.exitCode).toBe(0);
  expect(t.read("result.json").result.output.output.disposition).toBe("insufficient_evidence");
  expect(t.read("result.json").result.output.output.proposed_changes).toEqual([]);
  expect(t.read("receipt.json").cleanupConfirmed).toBe(true);
  expect(t.read("provenance.json").sdk.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(t.read("provenance.json").working.commit).toMatch(/^[a-f0-9]{40}$/);
  expect(existsSync(join(t.outputRoot, "trace", "run.json"))).toBe(true);
  expect(readFileSync(join(t.outputRoot, "events.jsonl"), "utf8")).toContain('"type":"finished"');
});

test("a blocked workflow retains its report and exits distinctly from success", async () => {
  const t = trial("blocked");
  const result = await runStage(t.configFile);
  expect(result.exitCode).toBe(2);
  expect(t.read("receipt.json").status).toBe("blocked");
  expect(t.read("result.json").result.type).toBe("blocked");
});

test("parent cancellation reaches an active specialist and preserves interrupted evidence", async () => {
  const t = trial("cancel");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Stop fixture")), 250);
  try {
    const result = await runStage(t.configFile, controller.signal);
    expect(result.exitCode).toBe(130);
    expect(t.read("receipt.json").status).toBe("interrupted");
    expect(t.read("result.json").report.cleanup.confirmed).toBe(true);
  } finally { clearTimeout(timer); }
});

test("replay cannot overwrite an existing invocation", async () => {
  const t = trial();
  await runStage(t.configFile);
  const receipt = readFileSync(join(t.outputRoot, "receipt.json"), "utf8");
  await expect(runStage(t.configFile)).rejects.toThrow("EEXIST");
  expect(readFileSync(join(t.outputRoot, "receipt.json"), "utf8")).toBe(receipt);
});

test("shared checkouts are rejected before running or writing evidence", async () => {
  const t = trial();
  writeFileSync(t.configFile, JSON.stringify({ ...t.config, cwd: join(t.root, "repo") }));
  await expect(runStage(t.configFile)).rejects.toThrow("isolated linked Git worktree");
  expect(existsSync(t.outputRoot)).toBe(false);
});

test("fixture import errors leave an inspectable error receipt", async () => {
  const t = trial();
  writeFileSync(t.config.fixtureFile, "export const other = {};\n");
  const result = await runStage(t.configFile);
  expect(result.exitCode).toBe(1);
  expect(t.read("receipt.json").error.message).toContain("export agentFixtures");
  expect(existsSync(join(t.outputRoot, "input.json"))).toBe(true);
});
