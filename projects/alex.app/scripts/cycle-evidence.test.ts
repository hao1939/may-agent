import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

test("generation rejects output and evidence under declared disposable roots", () => {
  const t = fixture();
  const disposable = join(t.root, "task-worktree");
  mkdirSync(disposable);
  const disposableArtifact = join(disposable, "artifact.json");
  writeFileSync(disposableArtifact, JSON.stringify({ result: "temporary" }));

  const outputInput = JSON.parse(readFileSync(t.input, "utf8"));
  outputInput.generation = { disposableRoots: [disposable] };
  writeFileSync(t.input, JSON.stringify(outputInput));
  expect(() => generateCycleRecord(t.input, join(disposable, "output"))).toThrow("outputRoot is within disposable root");

  outputInput.artifacts[0].path = disposableArtifact;
  writeFileSync(t.input, JSON.stringify(outputInput));
  expect(() => generateCycleRecord(t.input, join(t.retained, "artifact-output"))).toThrow("artifact is within disposable root");

  outputInput.artifacts[0].path = t.artifact;
  outputInput.executions[0].directEvidence[0].artifactPath = disposableArtifact;
  writeFileSync(t.input, JSON.stringify(outputInput));
  expect(() => generateCycleRecord(t.input, join(t.retained, "evidence-output"))).toThrow("direct evidence is within disposable root");
});

test("generation rejects artifact symlinks into disposable roots", () => {
  const t = fixture();
  const disposable = join(t.root, "task-worktree");
  mkdirSync(disposable);
  const disposableArtifact = join(disposable, "artifact.json");
  writeFileSync(disposableArtifact, JSON.stringify({ result: "temporary" }));
  const linkedArtifact = join(t.retained, "artifact-link.json");
  symlinkSync(disposableArtifact, linkedArtifact, "file");

  const linkedInput = JSON.parse(readFileSync(t.input, "utf8"));
  linkedInput.generation = { disposableRoots: [disposable] };
  linkedInput.artifacts[0].path = linkedArtifact;
  linkedInput.executions[0].directEvidence[0].artifactPath = linkedArtifact;
  writeFileSync(t.input, JSON.stringify(linkedInput));

  expect(() => generateCycleRecord(t.input, join(t.retained, "linked-artifact-output"))).toThrow("artifact is within disposable root");
});

test("generation rejects output-parent symlinks into disposable roots before creation", () => {
  const t = fixture();
  const disposable = join(t.root, "task-worktree");
  mkdirSync(disposable);
  const outputParent = join(t.retained, "output-parent-link");
  symlinkSync(disposable, outputParent, "dir");

  const linkedInput = JSON.parse(readFileSync(t.input, "utf8"));
  linkedInput.generation = { disposableRoots: [disposable] };
  writeFileSync(t.input, JSON.stringify(linkedInput));
  const output = join(outputParent, "output");

  expect(() => generateCycleRecord(t.input, output)).toThrow("outputRoot is within disposable root");
  expect(existsSync(join(disposable, "output"))).toBe(false);
});

test("direct evidence is hash-bound even without JSON pointers", () => {
  const t = fixture();
  const record = {
    createdAt: new Date().toISOString(),
    executions: [{ directEvidence: [{ artifactPath: join(t.root, "unlisted.json") }] }],
    artifacts: [{ path: t.artifact, sha256: sha(t.artifact) }],
  };
  const recordPath = join(t.root, "unbound-record.json");
  writeFileSync(recordPath, JSON.stringify(record));
  expect(validateCycleRecord(recordPath).errors.join(" ")).toContain("direct evidence is not hash-bound");
});

test("generation preserves pinned hashes and normalizes relative evidence paths", () => {
  const t = fixture();
  const relativeInput = JSON.parse(readFileSync(t.input, "utf8"));
  relativeInput.artifacts[0].path = "retained/artifact.json";
  relativeInput.artifacts[0].sha256 = sha(t.artifact);
  relativeInput.executions[0].directEvidence[0].artifactPath = "retained/artifact.json";
  writeFileSync(t.input, JSON.stringify(relativeInput));
  const generated = generateCycleRecord(t.input, join(t.retained, "relative"));
  expect(validateCycleRecord(generated.recordPath).passed).toBe(true);

  writeFileSync(t.artifact, JSON.stringify({ result: "changed" }));
  expect(() => generateCycleRecord(t.input, join(t.retained, "changed"))).toThrow("changed artifact");
});

test("retained-format v1 is rejected for bad pointer and timestamp while v2 passes", () => {
  const t = fixture();
  const interval = { startedAt: "2026-11-16T09:34:56.483Z", finishedAt: "2026-11-16T09:37:02.042Z" };
  const base = {
    executions: [{ directEvidence: [{ artifactPath: t.artifact, jsonPointers: ["/result/status"] }] }],
    artifacts: [{ path: t.artifact, sha256: sha(t.artifact), jsonPointers: ["/values/1"] }],
  };
  const v1Path = join(t.root, "retained-v1.json");
  writeFileSync(v1Path, JSON.stringify({ ...base, createdAt: "2026-11-16T09:31:45.600Z", executions: [{ directEvidence: [{ artifactPath: t.artifact, jsonPointers: ["/environment/paths/workspaceDir"] }] }] }));
  const v1 = validateCycleRecord(v1Path, { attemptInterval: interval });
  expect(v1.passed).toBe(false);
  expect(v1.errors.join(" ")).toContain("/environment/paths/workspaceDir");
  expect(v1.errors.join(" ")).toContain("outside recorded attempt interval");

  const v2Path = join(t.root, "retained-v2.json");
  writeFileSync(v2Path, JSON.stringify({ ...base, createdAt: "2026-11-16T09:35:30.000Z" }));
  const v2 = validateCycleRecord(v2Path, { attemptInterval: interval });
  expect(v2.passed).toBe(true);
  expect(v2.pointerChecks.some((check) => check.pointer === "/result/status" && check.resolved)).toBe(true);
});
