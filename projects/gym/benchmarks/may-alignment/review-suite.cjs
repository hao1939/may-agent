const fs = require("node:fs");
const path = require("node:path");

const here = __dirname;
const repoRoot = path.resolve(here, "../../../..");
const scenariosRoot = path.join(repoRoot, "projects/gym/scenarios");
const suite = JSON.parse(fs.readFileSync(path.join(here, "suite.json"), "utf8"));
const labelsPath = path.join(here, suite.labels_file || "labels.json");
const labels = fs.existsSync(labelsPath) ? JSON.parse(fs.readFileSync(labelsPath, "utf8")) : null;
const checks = [];

function add(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), detail });
}

add("suite-size", suite.scenarios.length >= 10, `${suite.scenarios.length} scenarios (minimum 10)`);
add("suite-unique", new Set(suite.scenarios).size === suite.scenarios.length, "Scenario names are unique");
add("labels-present", Boolean(labels), labels ? "Ground-truth label catalog exists" : `Missing: ${labelsPath}`);

let safetyCount = 0;
let controlCount = 0;
let paraphraseCount = 0;

for (const name of suite.scenarios) {
  const dir = path.join(scenariosRoot, name);
  const required = ["scenario.json", "task.md", "expected.json", "success_criteria.js", "environment/system-state.md"];
  const missing = required.filter((file) => !fs.existsSync(path.join(dir, file)));
  add(`${name}:files`, missing.length === 0, missing.length ? `Missing: ${missing.join(", ")}` : "All scenario files exist");
  if (missing.length) continue;

  const meta = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8"));
  const expected = JSON.parse(fs.readFileSync(path.join(dir, "expected.json"), "utf8"));
  const task = fs.readFileSync(path.join(dir, "task.md"), "utf8");
  const state = fs.readFileSync(path.join(dir, "environment/system-state.md"), "utf8");
  const scorer = fs.readFileSync(path.join(dir, "success_criteria.js"), "utf8");
  const label = labels?.labels?.[name];

  add(`${name}:label`, Boolean(label), label ? `Ground truth is explicitly ${label.status}` : "Missing ground-truth label");
  add(`${name}:label-status`, ["draft", "approved"].includes(label?.status), "Label status is draft or approved");
  add(`${name}:label-rationale`, Boolean(label?.rationale?.trim()), "Label records its rationale");
  add(
    `${name}:approval-integrity`,
    label?.status !== "approved" || Boolean(label.approved_by && label.approved_at),
    label?.status === "approved" ? "Approval includes reviewer and timestamp" : "Draft makes no approval claim",
  );

  safetyCount += meta.tags?.includes("safety") ? 1 : 0;
  controlCount += meta.tags?.includes("control-pair") ? 1 : 0;
  paraphraseCount += meta.tags?.includes("paraphrase") ? 1 : 0;

  add(`${name}:identity`, meta.agent_type === "may" && meta.tags?.includes("may-alignment"), "Targets May and carries the suite tag");
  add(`${name}:shadow-mode`, /decision-only benchmark/i.test(task) && /do not execute/i.test(task), "Task is explicitly non-executing");
  add(`${name}:state-depth`, (state.match(/^-/gm) ?? []).length >= 3, "State contains at least three decision-relevant facts");
  add(`${name}:common-scorer`, scorer.includes("score-decision.cjs"), "Uses the shared scorer");
  add(`${name}:response-bound`, Number.isFinite(expected.response_max_words), "Defines a response-length bound");
  add(`${name}:delegation-ground-truth`, expected.delegations && Number.isFinite(expected.delegations.min), "Defines delegation expectations");
  add(`${name}:canonical-answer`, Boolean(expected.human_answer?.trim()), "Provides a plain-language answer for human review");

  const scoredFields = new Set([
    ...Object.keys(expected.exact ?? {}),
    ...Object.keys(expected.one_of ?? {}),
    ...Object.keys(expected.contains_all ?? {}),
    ...Object.keys(expected.contains_any ?? {}),
    ...Object.keys(expected.contains_groups ?? {}),
  ]);
  add(`${name}:mode-ground-truth`, scoredFields.has("mode"), "Defines acceptable operating-mode concepts");
  add(`${name}:priority-ground-truth`, scoredFields.has("priority"), "Defines acceptable priority concepts");
  add(
    `${name}:preference-ground-truth`,
    scoredFields.has("preference_updates") || expected.empty?.includes("preference_updates"),
    "Defines whether this turn changes standing preferences",
  );

  const brittleExact = Object.entries(expected.exact ?? {}).filter(([, value]) => typeof value === "string");
  add(`${name}:no-brittle-exact-labels`, brittleExact.length === 0, brittleExact.length ? `Exact string labels: ${brittleExact.map(([key]) => key).join(", ")}` : "Open-ended labels use acceptable sets or semantic matching");
}

add("coverage:safety", safetyCount >= 3, `${safetyCount} safety scenarios (minimum 3)`);
add("coverage:controls", controlCount >= 3, `${controlCount} control-pair scenarios (minimum 3)`);
add("coverage:paraphrases", paraphraseCount >= 1, `${paraphraseCount} explicit paraphrase scenarios (minimum 1)`);

const passed = checks.every((check) => check.passed);
console.log(JSON.stringify({ passed, checks, summary: `${checks.filter((check) => check.passed).length}/${checks.length} benchmark-review checks passed` }, null, 2));
process.exitCode = passed ? 0 : 1;
