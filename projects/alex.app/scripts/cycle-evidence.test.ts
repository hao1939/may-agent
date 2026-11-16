import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCycleRecord, validateCycleRecord } from "./cycle-evidence.ts";

const roots: string[] = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cycle-evidence-"));
  roots.push(root);
  const retained = join(root, "retained");
  mkdirSync(retained);
  const artifact = join(retained, "artifact.json");
  writeFileSync(artifact, JSON.stringify({ result: { status: "passed" }, values: [1, 2] }));
  const input = join(root, "input.json");
  writeFileSync(input, JSON.stringify({
    recordPurpose: "fresh separately identified invocation",
    invocation: { id: "hosted-fixture-2" },
    objective: { hypothesis: "deterministic evidence survives closure", rejectionCriterion: "reject missing, changed, or unresolvable evidence" },
    executions: [{ name: "fresh", directEvidence: [{ artifactPath: artifact, jsonPointers: ["/result/status"] }] }],
    artifacts: [{ path: artifact, jsonPointers: ["/result", "/values/1"] }],
  }));
  return { root, retained, artifact, input };
}

test("generates a clock-timestamped hash-bound record for a separate invocation", () => {
  const t = fixture();
  const before = Date.now();
  const output = join(t.retained, "invocation-2");
  const generated = generateCycleRecord(t.input, output);
  const record = JSON.parse(readFileSync(generated.recordPath, "utf8"));
  const validation = JSON.parse(readFileSync(generated.validationPath, "utf8"));
  expect(record.invocation.id).toBe("hosted-fixture-2");
  expect(Date.parse(record.createdAt)).toBeGreaterThanOrEqual(before);
  expect(record.artifacts[0].sha256).toBe(sha(t.artifact));
  expect(validation.passed).toBe(true);
});

test("rejects missing, changed, and invalid linked evidence", () => {
  const t = fixture();
  const generated = generateCycleRecord(t.input, join(t.retained, "valid"));
  writeFileSync(t.artifact, JSON.stringify({ result: { status: "changed" } }));
  expect(validateCycleRecord(generated.recordPath).errors.join(" ")).toContain("changed artifact");

  const missing = JSON.parse(readFileSync(generated.recordPath, "utf8"));
  missing.artifacts[0].path = join(t.root, "missing.json");
  const missingPath = join(t.root, "missing-record.json");
  writeFileSync(missingPath, JSON.stringify(missing));
  expect(validateCycleRecord(missingPath).errors.join(" ")).toContain("missing artifact");

  writeFileSync(t.artifact, JSON.stringify({ result: { status: "passed" }, values: [1, 2] }));
  const invalid = JSON.parse(readFileSync(generated.recordPath, "utf8"));
  invalid.artifacts[0].sha256 = sha(t.artifact);
  invalid.executions[0].directEvidence[0].jsonPointers = ["/does/not/exist"];
  const invalidPath = join(t.root, "invalid-record.json");
  writeFileSync(invalidPath, JSON.stringify(invalid));
  expect(validateCycleRecord(invalidPath).errors.join(" ")).toContain("does not resolve");
});

test("retained session-10 v1 is rejected for bad pointer and timestamp while v2 passes", () => {
  const base = "/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-10";
  const v1 = validateCycleRecord(join(base, "alex-output/cycle-record.json"), { attemptInterval: { startedAt: "2026-11-16T09:31:45.600Z", finishedAt: "2026-11-16T09:33:53.905Z" } });
  expect(v1.passed).toBe(false);
  expect(v1.errors.join(" ")).toContain("/environment/paths/workspaceDir");
  expect(v1.errors.join(" ")).toContain("outside recorded attempt interval");

  const v2 = validateCycleRecord(join(base, "alex-output-v2/cycle-record.json"), { attemptInterval: { startedAt: "2026-11-16T09:34:56.483Z", finishedAt: "2026-11-16T09:37:02.042Z" } });
  expect(v2.passed).toBe(true);
  expect(v2.pointerChecks.some((check) => check.pointer === "/paths/workspaceDir" && check.resolved)).toBe(true);
});
