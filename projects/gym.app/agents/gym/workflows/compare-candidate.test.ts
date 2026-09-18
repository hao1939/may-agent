import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  compareCandidate,
  fingerprintTree,
  type Comparison,
} from "./compare-candidate";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture(mode: "valid" | "fail" | "abort" | "control" | "wrong-scope") {
  const root = mkdtempSync(join(tmpdir(), "gym-adapter-"));
  roots.push(root);
  const gym = join(root, "projects", "gym");
  const output = join(root, "output");
  const agents = join(root, "separate-may-worktree", "agents");
  const candidate = join(agents, ".lab", `candidate-${mode}`);
  const baseline = join(root, "separate-baseline-task", "baseline-1");
  mkdirSync(join(baseline, "inputs"), { recursive: true });
  mkdirSync(candidate, { recursive: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(join(candidate, "AGENTS.md"), `candidate ${mode}\n`);
  writeFileSync(join(candidate, "mode"), mode);
  const scorer = Buffer.from("export default true;\n");
  writeFileSync(join(baseline, "inputs", "score.js"), scorer);
  const scenarios = ["incident", "paraphrase", "opposite", "transfer"];
  const baselineManifest = {
    run_id: "baseline-1",
    baseline_run_id: null,
    agent: "may",
    benchmark: "tiny",
    candidate: "baseline",
    scenarios,
    trials_per_scenario: 1,
    completed_at: "2026-01-01T00:00:00.000Z",
    trials: scenarios.map((scenario) => ({
      scenario,
      trial: 1,
      machine_verdict: "fail",
    })),
    proof: {
      candidate_fingerprint: null,
      models: ["fixture-model"],
      framework_revisions: ["fixture-framework"],
    },
    source: { evaluator_snapshot: "inputs/score.js" },
  };
  writeFileSync(
    join(baseline, "manifest.json"),
    JSON.stringify(baselineManifest),
  );
  mkdirSync(join(gym, "src", "loop"), { recursive: true });
  writeFileSync(
    join(gym, "src", "loop", "cli.ts"),
    `
import { mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { basename, join } from "node:path";
const argv = process.argv.slice(2).filter((x) => x !== "--");
const value = (key) => argv[argv.indexOf(key) + 1];
const baselineDir = value("--baseline");
const candidate = value("--candidate");
const mode = readFileSync(join(process.env.GYM_AGENTS_ROOT, ".lab", candidate, "mode"), "utf8").trim();
writeFileSync(join(process.env.GYM_STATE_DIR, "spawned"), mode);
if (mode === "fail") console.error("x".repeat(100_000));
if (mode === "abort") {
  const sentinel = join(process.env.GYM_STATE_DIR, "leaked-descendant");
  Bun.spawn(["bash", "-c", "trap '' TERM; sleep 1; touch '" + sentinel + "'; sleep 30"], {
    stdout: "ignore", stderr: "ignore",
  });
  await Bun.sleep(10_000);
}
const base = JSON.parse(readFileSync(join(baselineDir, "manifest.json"), "utf8"));
const runId = "tiny-verify-" + mode;
const run = join(process.env.GYM_STATE_DIR, "benchmarks", runId);
mkdirSync(join(run, "inputs"), { recursive: true });
cpSync(join(baselineDir, "inputs", "score.js"), join(run, "inputs", "score.js"));
const manifest = { ...base, run_id: runId, baseline_run_id: base.run_id, candidate,
  trials_per_scenario: mode === "wrong-scope" ? 2 : 1,
  proof: { ...base.proof, candidate_fingerprint: ${JSON.stringify(fingerprintTree(candidate))} } };
writeFileSync(join(run, "manifest.json"), JSON.stringify(manifest));
writeFileSync(join(run, "comparison.json"), JSON.stringify({ baseline_run_id: base.run_id, candidate_run_id: runId, gate: mode === "control" ? "fail" : "pass" }));
console.log(run);
if (mode === "fail") process.exit(7);
if (mode === "control") process.exit(1);
`,
  );
  const request: Comparison = {
    requestId: `request-${mode}`,
    agent: "may",
    baselineRunId: "baseline-1",
    baselinePath: baseline,
    baselineFingerprint: fingerprintTree(baseline),
    candidate: `candidate-${mode}`,
    candidatePath: candidate,
    candidateFingerprint: fingerprintTree(candidate),
    benchmark: "tiny",
    scorerRevision: createHash("sha256").update(scorer).digest("hex"),
    frameworkRevision: "fixture-framework",
    model: "fixture-model",
    scenarios,
    trials: 1,
    timeoutMs: 60_000,
    totalAllowanceMs: 60_000,
  };
  return { root, gym, output, request };
}

function context(setup: ReturnType<typeof fixture>, signal?: AbortSignal) {
  const ctx = createTestAppWorkflowContext({ input: setup.request, signal });
  if (signal) (ctx as typeof ctx & { signal: AbortSignal }).signal = signal;
  ctx.workspace = {
    root: setup.root,
    projectRoot: setup.gym,
    appRoot: join(setup.root, "projects/gym.app"),
    output: setup.output,
  };
  return ctx;
}
function result(output: Awaited<ReturnType<typeof compareCandidate>>) {
  return (
    output.output as {
      result: { verdict: string; receiptPath: string; receiptHash: string };
    }
  ).result;
}

describe("standalone Gym comparison adapter", () => {
  test("refuses partial or invalid baseline trials before spending a candidate run", async () => {
    for (const change of ["partial", "invalid", "duplicate"]) {
      const setup = fixture("valid");
      const file = join(setup.request.baselinePath, "manifest.json");
      const manifest = JSON.parse(readFileSync(file, "utf8"));
      if (change === "partial") manifest.completed_at = null;
      if (change === "invalid") manifest.trials[0].machine_verdict = "invalid";
      if (change === "duplicate") manifest.trials[1] = manifest.trials[0];
      writeFileSync(file, JSON.stringify(manifest));
      setup.request.baselineFingerprint = fingerprintTree(
        setup.request.baselinePath,
      );
      expect((await compareCandidate(context(setup))).status).toBe("blocked");
      expect(
        existsSync(join(setup.output, "gym-state", "spawned")),
      ).toBeFalse();
    }
  });

  test("does not trust a passing comparison when the actual trial scope differs", async () => {
    const setup = fixture("wrong-scope");
    const saved = result(await compareCandidate(context(setup)));
    expect(saved.verdict).toBe("hold");
    expect(
      JSON.parse(readFileSync(saved.receiptPath, "utf8")).outputMatches,
    ).toBeFalse();
  });

  test("rejects an identity mismatch before spawning the standalone runner", async () => {
    const setup = fixture("valid");
    setup.request.model = "wrong";
    const execution = await compareCandidate(context(setup));
    expect(execution.status).toBe("blocked");
    expect(existsSync(join(setup.output, "gym-state", "spawned"))).toBeFalse();
  });

  test("retains a bounded hold receipt for a failing subprocess", async () => {
    const setup = fixture("fail");
    const execution = await compareCandidate(context(setup));
    const saved = result(execution);
    expect(saved.verdict).toBe("hold");
    const receipt = JSON.parse(readFileSync(saved.receiptPath, "utf8"));
    expect(receipt.exitCode).toBe(7);
    expect(receipt.stderr.truncated).toBeTrue();
    expect(Buffer.byteLength(receipt.stderr.text)).toBeLessThanOrEqual(65_536);
    expect(
      createHash("sha256")
        .update(readFileSync(saved.receiptPath))
        .digest("hex"),
    ).toBe(saved.receiptHash);
  });

  test("verifies the trusted run and exact identities after a valid subprocess", async () => {
    const setup = fixture("valid");
    const execution = await compareCandidate(context(setup));
    const saved = result(execution);
    const receipt = JSON.parse(readFileSync(saved.receiptPath, "utf8"));
    expect(saved.verdict).toBe("candidate-supported");
    expect(receipt.outputMatches).toBeTrue();
    expect(receipt.env.GYM_AGENTS_ROOT).toBe(
      join(setup.root, "separate-may-worktree", "agents"),
    );
    expect(receipt.argv.slice(1, 4)).toEqual([
      process.env.BUN_EXEC_PATH || "bun",
      join(setup.gym, "src", "loop", "cli.ts"),
      "verify",
    ]);
    expect(receipt.argv.slice(-2)).toEqual(["--timeout", "1"]);
    expect(
      receipt.runDir.startsWith(join(setup.output, "gym-state", "benchmarks")),
    ).toBeTrue();
  });

  test("holds a verified no-change control without pretending improvement", async () => {
    const setup = fixture("control");
    const execution = await compareCandidate(context(setup));
    const saved = result(execution);
    const receipt = JSON.parse(readFileSync(saved.receiptPath, "utf8"));
    expect(saved.verdict).toBe("hold");
    expect(receipt.outputMatches).toBeTrue();
    expect(receipt.comparison.gate).toBe("fail");
  });

  test("kills an aborted subprocess and retains no fabricated successful run", async () => {
    const setup = fixture("abort");
    const controller = new AbortController();
    const pending = compareCandidate(context(setup, controller.signal));
    while (!existsSync(join(setup.output, "gym-state", "spawned")))
      await Bun.sleep(10);
    controller.abort();
    const execution = await pending;
    const saved = result(execution);
    const receipt = JSON.parse(readFileSync(saved.receiptPath, "utf8"));
    expect(saved.verdict).toBe("hold");
    expect(receipt.aborted).toBeTrue();
    expect(receipt.outputMatches).toBeFalse();
    await Bun.sleep(1_200);
    expect(
      existsSync(join(setup.output, "gym-state", "leaked-descendant")),
    ).toBeFalse();
  });
});
