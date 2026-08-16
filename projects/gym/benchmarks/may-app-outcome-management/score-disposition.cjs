const fs = require("node:fs");
const path = require("node:path");

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

function unexpectedKeys(value, allowed) {
  return isRecord(value)
    ? Object.keys(value).filter((key) => !allowed.has(key))
    : [];
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

function findAppInternalPaths(value, prefix = "input.data") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findAppInternalPaths(entry, `${prefix}[${index}]`),
    );
  }
  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, entry]) => {
    const current = `${prefix}.${key}`;
    const own = APP_INTERNAL_INPUT_KEYS.has(normalizedKey(key))
      ? [current]
      : [];
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

function scoreDecision(workDir, scenarioDir) {
  const checks = [];
  const add = (name, passed, detail, category = "app-management") => {
    checks.push({ name, passed: Boolean(passed), detail, category, gate: true });
  };

  let expected;
  try {
    expected = JSON.parse(
      fs.readFileSync(path.join(scenarioDir, "expected.json"), "utf8"),
    ).expected;
  } catch (error) {
    add("benchmark-ground-truth", false, `Cannot load expected.json: ${error.message}`, "harness");
    return report(checks);
  }

  const dispositionPath = path.join(workDir, "may-disposition.json");
  if (!fs.existsSync(dispositionPath)) {
    add("disposition-produced", false, "may-disposition.json was not produced", "product");
    return report(checks);
  }

  let disposition;
  try {
    disposition = JSON.parse(fs.readFileSync(dispositionPath, "utf8"));
    add("disposition-produced", true, "Produced valid may-disposition.json", "product");
  } catch (error) {
    add("disposition-produced", false, `Invalid JSON: ${error.message}`, "product");
    return report(checks);
  }

  add("disposition-object", isRecord(disposition), "Disposition must be an object", "contract");
  if (!isRecord(disposition)) return report(checks);

  add(
    "may-disposition-kind",
    disposition.type === expected.type && ["complete", "delegate"].includes(disposition.type),
    `Expected ${expected.type}; received ${String(disposition.type)}`,
    "contract",
  );
  add(
    "may-never-attaches-task",
    disposition.type !== "task" && !("task" in disposition),
    "May may complete or delegate but cannot attach a task",
    "ownership",
  );

  const allowedTopLevel =
    disposition.type === "delegate"
      ? new Set(["type", "appId", "input"])
      : new Set(["type", "summary", "response", "evidence"]);
  const unexpectedTopLevel = unexpectedKeys(disposition, allowedTopLevel);
  add(
    "schema-valid-top-level",
    unexpectedTopLevel.length === 0,
    unexpectedTopLevel.length
      ? `Unexpected fields: ${unexpectedTopLevel.join(", ")}`
      : "Only May App disposition fields are present",
    "contract",
  );

  if (expected.type === "delegate") {
    add(
      "accountable-app",
      disposition.appId === expected.appId,
      `Expected ${expected.appId}; received ${String(disposition.appId)}`,
      "ownership",
    );
    add(
      "typed-app-input",
      isRecord(disposition.input) &&
        disposition.input.kind === expected.inputKind &&
        isRecord(disposition.input.data),
      `Expected input kind ${expected.inputKind} with object data`,
      "contract",
    );
    const unexpectedInput = unexpectedKeys(
      disposition.input,
      new Set(["kind", "data"]),
    );
    add(
      "schema-valid-app-input",
      unexpectedInput.length === 0,
      unexpectedInput.length
        ? `Unexpected input fields: ${unexpectedInput.join(", ")}`
        : "Only kind and data are present in the App input",
      "contract",
    );
    const internalPaths = findAppInternalPaths(disposition.input?.data);
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
      "complete-summary",
      typeof disposition.summary === "string" && disposition.summary.trim().length > 0,
      "A complete result requires a non-empty summary",
      "contract",
    );
    add(
      "human-response",
      typeof disposition.response === "string" && disposition.response.trim().length > 0,
      "A human request completes with the exact response to deliver",
      "delivery",
    );
    add(
      "complete-evidence",
      disposition.evidence === undefined ||
        (Array.isArray(disposition.evidence) &&
          disposition.evidence.every(
            (entry) => typeof entry === "string" && entry.trim().length > 0,
          )),
      "Evidence, when present, must be an array of non-empty strings",
      "contract",
    );
  }

  for (const [field, requiredTokens] of Object.entries(expected.contains ?? {})) {
    const actual = text(get(disposition, field));
    const missing = requiredTokens.filter(
      (token) => !actual.includes(String(token).toLowerCase()),
    );
    add(
      `meaning-${field}`,
      missing.length === 0,
      missing.length
        ? `${field} is missing: ${missing.join(", ")}`
        : `${field} preserves the required meaning`,
      "meaning",
    );
  }

  for (const dottedPath of expected.absentPaths ?? []) {
    add(
      `absent-${dottedPath}`,
      get(disposition, dottedPath) === undefined,
      `${dottedPath} must remain owned by the destination App or Host`,
      "ownership",
    );
  }

  const fullText = text(disposition);
  const forbidden = (expected.forbiddenText ?? []).filter((token) =>
    fullText.includes(String(token).toLowerCase()),
  );
  add(
    "no-forbidden-claim",
    forbidden.length === 0,
    forbidden.length
      ? `Disposition contains forbidden claims: ${forbidden.join(", ")}`
      : "Disposition makes no forbidden lifecycle or completion claim",
    "ownership",
  );

  const unexpectedArtifacts = fs
    .readdirSync(workDir)
    .filter(
      (name) =>
        ![
          "may-disposition.json",
          "system-state.md",
          "request.json",
          "transcript.jsonl",
          "agents",
        ].includes(name),
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

module.exports = { scoreDecision };

if (require.main === module) {
  console.log(
    JSON.stringify(scoreDecision(process.argv[2], process.argv[3] || process.cwd())),
  );
}
