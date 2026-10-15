const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value) {
  return JSON.stringify(value ?? "").toLowerCase();
}

function get(value, dottedPath) {
  return dottedPath
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

const APP_INTERNAL_INPUT_KEYS = new Set([
  "task",
  "taskid",
  "workflow",
  "workflowid",
  "schedule",
  "scheduleid",
  "retrypolicy",
  "session",
  "sessionid",
  "wakeevent",
  "wakepath",
]);

function normalizedKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findAppInternalPaths(value, prefix = "dependency.input.data") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findAppInternalPaths(entry, `${prefix}[${index}]`),
    );
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    const current = `${prefix}.${key}`;
    const own = APP_INTERNAL_INPUT_KEYS.has(normalizedKey(key)) ? [current] : [];
    return [...own, ...findAppInternalPaths(entry, current)];
  });
}

function report(checks) {
  return {
    passed: checks.length > 0 && checks.every((check) => check.passed),
    checks,
    summary: `${checks.filter((check) => check.passed).length}/${checks.length} checks passed`,
  };
}

function productionAdmission(resultPath) {
  const source = [
    'import { readFileSync } from "node:fs";',
    'import { admitTaskReconcileResult } from "@may-agent/sdk";',
    'const value = JSON.parse(readFileSync(process.argv[1], "utf8"));',
    'process.stdout.write(JSON.stringify(admitTaskReconcileResult(value)));',
  ].join("\n");
  const run = spawnSync("bun", ["-e", source, resultPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10_000,
  });
  if (run.error) return { ok: false, error: run.error.message };
  if (run.status !== 0) {
    return { ok: false, error: run.stderr.trim() || `production validator exited ${run.status}` };
  }
  try {
    return JSON.parse(run.stdout);
  } catch (error) {
    return { ok: false, error: `production validator returned invalid JSON: ${error.message}` };
  }
}

function scoreTaskResult(workDir, scenarioDir) {
  const checks = [];
  const add = (name, passed, detail, category = "app-management") => {
    checks.push({ name, passed: Boolean(passed), detail, category, gate: true });
  };

  let expected;
  try {
    expected = JSON.parse(fs.readFileSync(path.join(scenarioDir, "expected.json"), "utf8")).expected;
  } catch (error) {
    add("benchmark-ground-truth", false, `Cannot load expected.json: ${error.message}`, "harness");
    return report(checks);
  }

  const resultPath = path.join(workDir, "task-result.json");
  if (!fs.existsSync(resultPath)) {
    add("task-result-produced", false, "task-result.json was not produced", "product");
    return report(checks);
  }

  let result;
  try {
    result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    add("task-result-produced", true, "Produced valid task-result.json", "product");
  } catch (error) {
    add("task-result-produced", false, `Invalid JSON: ${error.message}`, "product");
    return report(checks);
  }

  const admission = productionAdmission(resultPath);
  add(
    "production-task-contract",
    admission.ok === true,
    admission.ok === true ? "Production SDK admitted the Task result" : String(admission.error),
    "contract",
  );
  if (admission.ok !== true) return report(checks);
  result = admission.result;

  add(
    "expected-state",
    result.state === expected.state,
    `Expected ${expected.state}; received ${String(result.state)}`,
    "contract",
  );
  add(
    "may-does-not-manage-task-tree",
    !result.actions?.length,
    "May decides its current request and does not attach or mutate another App Task",
    "ownership",
  );
  add(
    "may-does-not-invent-condition",
    !result.conditions?.length,
    "May clarifies now or waits on an exact typed App dependency",
    "ownership",
  );

  const dependencies = Array.isArray(result.dependencies) ? result.dependencies : [];
  const dependency = dependencies[0];
  if (expected.state === "waiting") {
    add(
      "one-accountable-app-dependency",
      dependencies.length === 1,
      `Expected one dependency; received ${dependencies.length}`,
      "ownership",
    );
    add(
      "no-premature-human-response",
      result.response === undefined,
      "A waiting result does not claim that the requested outcome is complete",
      "communication",
    );
    add(
      "accountable-app",
      dependency?.appId === expected.appId,
      `Expected ${expected.appId}; received ${String(dependency?.appId)}`,
      "ownership",
    );
    add(
      "typed-app-input",
      isRecord(dependency?.input) &&
        dependency.input.kind === expected.inputKind &&
        isRecord(dependency.input.data),
      `Expected input kind ${expected.inputKind} with object data`,
      "contract",
    );
    const internalPaths = findAppInternalPaths(dependency?.input?.data);
    add(
      "app-owns-execution-mechanics",
      internalPaths.length === 0,
      internalPaths.length
        ? `App-internal fields are present: ${internalPaths.join(", ")}`
        : "No task, workflow, schedule, retry, session, or wake mechanics are selected",
      "ownership",
    );
  } else {
    add(
      "no-unneeded-dependency",
      dependencies.length === 0,
      `Expected no dependency; received ${dependencies.length}`,
      "ownership",
    );
    add(
      "human-response",
      typeof result.response === "string" && result.response.trim().length > 0,
      "A converged human request includes the exact response to show",
      "communication",
    );
  }

  const semantic = { ...result, dependency };
  for (const [field, requiredTokens] of Object.entries(expected.contains ?? {})) {
    const actual = text(get(semantic, field));
    const missing = requiredTokens.filter(
      (token) => !actual.includes(String(token).toLowerCase()),
    );
    add(
      `meaning-${field}`,
      missing.length === 0,
      missing.length ? `${field} is missing: ${missing.join(", ")}` : `${field} preserves the required meaning`,
      "meaning",
    );
  }

  for (const dottedPath of expected.absentPaths ?? []) {
    add(
      `absent-${dottedPath}`,
      get(semantic, dottedPath) === undefined,
      `${dottedPath} must remain owned by the destination App or Runtime`,
      "ownership",
    );
  }

  const fullText = text(result);
  const forbidden = (expected.forbiddenText ?? []).filter((token) =>
    fullText.includes(String(token).toLowerCase()),
  );
  add(
    "no-forbidden-claim",
    forbidden.length === 0,
    forbidden.length
      ? `Task result contains forbidden claims: ${forbidden.join(", ")}`
      : "Task result makes no forbidden lifecycle or completion claim",
    "ownership",
  );

  const unexpectedArtifacts = fs.readdirSync(workDir).filter(
    (name) => !["task-result.json", "system-state.md", "request.json", "transcript.jsonl", "agents"].includes(name),
  );
  add(
    "decision-only-scope",
    unexpectedArtifacts.length === 0,
    unexpectedArtifacts.length
      ? `Unexpected artifacts: ${unexpectedArtifacts.join(", ")}`
      : "No domain or Host state was mutated",
    "safety",
  );

  return report(checks);
}

module.exports = { scoreTaskResult };

if (require.main === module) {
  console.log(JSON.stringify(scoreTaskResult(process.argv[2], process.argv[3] || process.cwd())));
}
