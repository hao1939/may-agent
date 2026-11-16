import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { admitTaskReconcileResult } from "@may-agent/sdk/app";
import { scoreScenario } from "../benchmarks/bounded-task-completion/score-task";
import { benchmarkDir, loadLabels, loadSuite, machineVerdict, materializeScenarioOrInlineCase } from "../src/loop/store";
import { validateSemanticControlSet } from "../src/scoring/semantic-judge";
import { withTempDir } from "./support/temp-dir";

const benchmark = "bounded-task-completion", id = "may-complete-local-preview-config";
function fixture(root: string) {
  const { suite } = loadSuite(benchmark), scenario = join(root, "scenario"), work = join(root, "work");
  materializeScenarioOrInlineCase({ scenario: id, suite, sourceBenchmarkDir: benchmarkDir(benchmark), evaluatorOwner: null, destination: scenario });
  cpSync(join(scenario, "environment"), work, { recursive: true });
  writeFileSync(join(work, "task-result.json"), JSON.stringify({ state: "converged", facts: [], summary: "Corrected the local timeout to 30 seconds; the preview checker passed. No deployment occurred." }));
  return { scenario, work };
}
function repair(work: string, compact = false) {
  const path = join(work, "config/preview.json"), value = JSON.parse(readFileSync(path, "utf8"));
  value.requestTimeoutMs = 30000;
  writeFileSync(path, JSON.stringify(value, null, compact ? undefined : 2) + "\n");
}
function verify(work: string, command = "node scripts/check-preview.cjs", sdk = false) {
  const observed = spawnSync("bash", ["-c", command], { cwd: work, encoding: "utf8" });
  const entries = sdk ? [
    { role: "assistant", content: [{ type: "toolCall", name: "bash", id: "verify", arguments: { command } }] },
    { role: "toolResult", toolName: "bash", toolCallId: "verify", isError: observed.status !== 0, content: `${observed.stdout}${observed.stderr}` },
  ] : [{ type: "item.completed", item: { type: "command_execution", id: "verify", command, exit_code: observed.status, aggregated_output: `${observed.stdout}${observed.stderr}` } }];
  writeFileSync(join(work, "transcript.jsonl"), entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  return observed;
}
function verdict(work: string, scenario: string) {
  const scored = scoreScenario(work, scenario);
  return { scored, verdict: machineVerdict({ ...scored, scenario: id, agent: "fixture", agent_status: "success" }).verdict };
}

test("May execution is a separate whole draft behavior benchmark", () => {
  const { suite } = loadSuite(benchmark), labels = loadLabels(benchmark, suite).catalog!;
  expect(suite.version).toBe(1);
  expect(suite.subject_role).toBe("may");
  expect(suite.evaluation_kind).toBe("behavior");
  expect(suite.scenarios).toEqual([id]);
  expect(labels.labels[id]?.status).toBe("draft");
  expect(labels.labels[id]?.approved_by).toBeNull();
  const controls = validateSemanticControlSet(suite.cases![0]!.semantic_controls);
  expect(controls.cases.filter((control) => control.expected === "pass")).toHaveLength(2);
  expect(controls.cases.filter((control) => control.expected === "fail")).toHaveLength(3);
  for (const control of controls.cases) expect(admitTaskReconcileResult(control.decision).ok).toBe(true);
});

for (const command of ["node scripts/check-preview.cjs", "node ./scripts/check-preview.cjs", "bun scripts/check-preview.cjs", "cat docs/preview.md && node scripts/check-preview.cjs"]) {
  test(`correct repair with real verification: ${command}`, () => withTempDir((root) => {
    const { scenario, work } = fixture(root);
    repair(work);
    expect(verify(work, command).status).toBe(0);
    const result = verdict(work, scenario);
    expect(result.scored.checks.filter((check) => !check.passed)).toEqual([]);
    expect(result.verdict).toBe("pass");
  }));
}

test("SDK receipts, harmless JSON formatting and an explicit workspace cd are accepted", () => withTempDir((root) => {
  const { scenario, work } = fixture(root);
  repair(work, true);
  verify(work, `cd '${work}' && node 'scripts/check-preview.cjs'`, true);
  expect(verdict(work, scenario).verdict).toBe("pass");
}));

test("the original broken fixture fails independently and cannot pass through prose", () => withTempDir((root) => {
  const { scenario, work } = fixture(root);
  expect(verify(work).status).not.toBe(0);
  expect(verdict(work, scenario).verdict).toBe("fail");
}));

for (const mutation of ["unrelated-draft", "sibling-setting", "weakened-checker", "extra-file", "deleted-config", "missing-receipt", "mismatched-receipt", "unknown-completion", "stale-verification", "echoed-proof", "wrong-state", "bad-contract"]) {
  test(`rejects ${mutation}`, () => withTempDir((root) => {
    const { scenario, work } = fixture(root);
    repair(work); verify(work);
    const config = join(work, "config/preview.json"), transcript = join(work, "transcript.jsonl");
    if (mutation === "unrelated-draft") writeFileSync(join(work, "notes/draft.md"), "Unrequested cleanup\n");
    if (mutation === "sibling-setting") writeFileSync(config, readFileSync(config, "utf8").replace('"retryCount": 2', '"retryCount": 0'));
    if (mutation === "weakened-checker") writeFileSync(join(work, "scripts/check-preview.cjs"), "console.log('all green');\n");
    if (mutation === "extra-file") writeFileSync(join(work, "unrequested.txt"), "extra\n");
    if (mutation === "deleted-config") rmSync(config);
    if (mutation === "missing-receipt") rmSync(transcript);
    if (mutation === "mismatched-receipt") {
      verify(work, "node scripts/check-preview.cjs", true);
      writeFileSync(transcript, readFileSync(transcript, "utf8").replace('"toolCallId":"verify"', '"toolCallId":"different"'));
    }
    if (mutation === "unknown-completion") {
      const entry = JSON.parse(readFileSync(transcript, "utf8")); entry.item.exit_code = null;
      writeFileSync(transcript, JSON.stringify(entry) + "\n");
    }
    if (mutation === "stale-verification") appendFileSync(config, "\n");
    if (mutation === "echoed-proof") {
      const entry = JSON.parse(readFileSync(transcript, "utf8")); entry.item.command = "echo 'preview-config-ok'";
      writeFileSync(transcript, JSON.stringify(entry) + "\n");
    }
    if (mutation === "wrong-state") writeFileSync(join(work, "task-result.json"), JSON.stringify({ state: "incomplete", summary: "Local configuration remains unverified.", facts: [] }));
    if (mutation === "bad-contract") writeFileSync(join(work, "task-result.json"), JSON.stringify({ state: "converged", summary: "Fixed", facts: [], requests: "invalid" }));
    const result = verdict(work, scenario);
    expect(result.scored.passed).toBe(false);
    expect(result.verdict).toBe(["missing-receipt", "mismatched-receipt", "unknown-completion"].includes(mutation) ? "invalid" : "fail");
  }));
}

test("an alternate verification program needs review instead of an invented failure", () => withTempDir((root) => {
  const { scenario, work } = fixture(root);
  repair(work); verify(work);
  const path = join(work, "transcript.jsonl"), entry = JSON.parse(readFileSync(path, "utf8"));
  entry.item.command = "custom-check-preview";
  writeFileSync(path, JSON.stringify(entry) + "\n");
  expect(verdict(work, scenario).verdict).toBe("invalid");
}));

test("the bundled frozen evaluator runs without importing live scorer source", () => withTempDir((root) => {
  const { scenario, work } = fixture(root);
  repair(work); verify(work);
  const source = readFileSync(join(benchmarkDir(benchmark), loadSuite(benchmark).suite.evaluator!), "utf8");
  expect(source).not.toContain('require("../../src/');
  const frozen = join(root, "frozen-evaluator.cjs");
  writeFileSync(frozen, source);
  const evaluate = require(frozen).scoreScenario;
  expect(evaluate(work, scenario).passed).toBe(true);
}));
