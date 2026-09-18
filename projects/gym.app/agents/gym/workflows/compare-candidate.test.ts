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

function fixture(mode: "valid" | "fail" | "abort") {
  const root = mkdtempSync(join(tmpdir(), "gym-adapter-"));
  roots.push(root);
  const gym = join(root, "projects", "gym");
  const output = join(root, "output");
  const agents = join(root, "agents");
  const candidate = join(agents, ".lab", `candidate-${mode}`);
  const baseline = join(gym, ".state", "benchmarks", "baseline-1");
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
  writeFileSync(
    join(gym, "package.json"),
    JSON.stringify({ scripts: { loop: "bun fixture-runner.ts" } }),
  );
  writeFileSync(
    join(gym, "fixture-runner.ts"),
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
if (mode === "abort") await Bun.sleep(10_000);
const base = JSON.parse(readFileSync(join(baselineDir, "manifest.json"), "utf8"));
const runId = "tiny-verify-" + mode;
const run = join(process.env.GYM_STATE_DIR, "benchmarks", runId);
mkdirSync(join(run, "inputs"), { recursive: true });
cpSync(join(baselineDir, "inputs", "score.js"), join(run, "inputs", "score.js"));
const manifest = { ...base, run_id: runId, baseline_run_id: base.run_id, candidate,
  proof: { ...base.proof, candidate_fingerprint: ${JSON.stringify(fingerprintTree(candidate))} } };
writeFileSync(join(run, "manifest.json"), JSON.stringify(manifest));
writeFileSync(join(run, "comparison.json"), JSON.stringify({ baseline_run_id: base.run_id, candidate_run_id: runId, gate: "pass" }));
console.log(run);
if (mode === "fail") process.exit(7);
`,
  );
  const request: Comparison = {
    requestId: `request-${mode}`,
    agent: "may",
    baselineRunId: "baseline-1",
    candidate: `candidate-${mode}`,
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
    expect(receipt.env.GYM_AGENTS_ROOT).toBe(join(setup.root, "agents"));
    expect(
      receipt.runDir.startsWith(join(setup.output, "gym-state", "benchmarks")),
    ).toBeTrue();
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
  });
});
