#!/usr/bin/env bun
/** Deterministic generation and validation for retained improvement-cycle evidence. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const sha256File = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const object = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("cycle record must be an object");
  return value as Record<string, any>;
};

export interface AttemptInterval { startedAt: string; finishedAt: string }
export interface ValidationOptions { attemptInterval?: AttemptInterval; now?: Date }

function pointerValue(document: unknown, pointer: string): unknown {
  if (pointer === "") return document;
  if (!pointer.startsWith("/") || pointer.includes("{") || pointer.includes("}")) throw new Error(`invalid JSON pointer: ${pointer}`);
  return pointer.slice(1).split("/").reduce((value: any, token) => {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) throw new Error(`JSON pointer does not resolve: ${pointer}`);
    return value[key];
  }, document);
}

function evidenceDeclarations(record: Record<string, any>) {
  const found: Array<{ path: unknown; pointers: unknown[]; declaredBy: string }> = [];
  for (const [executionIndex, execution] of (record.executions ?? []).entries()) {
    for (const [evidenceIndex, evidence] of (execution.directEvidence ?? []).entries()) {
      found.push({ path: evidence.artifactPath, pointers: evidence.jsonPointers ?? [], declaredBy: `executions/${executionIndex}/directEvidence/${evidenceIndex}` });
    }
  }
  return found;
}

function pointerDeclarations(record: Record<string, any>) {
  const found: Array<{ path: unknown; pointer: unknown; declaredBy: string }> = [];
  for (const declaration of evidenceDeclarations(record)) {
    for (const pointer of declaration.pointers) found.push({ path: declaration.path, declaredBy: declaration.declaredBy, pointer });
  }
  for (const [artifactIndex, artifact] of (record.artifacts ?? []).entries()) {
    for (const pointer of artifact.jsonPointers ?? []) found.push({ path: artifact.path, pointer, declaredBy: `artifacts/${artifactIndex}` });
  }
  return found;
}

function isWithin(root: string, candidate: string) {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

export function validateCycleRecord(recordFile: string, options: ValidationOptions = {}) {
  const path = resolve(recordFile);
  const record = object(JSON.parse(readFileSync(path, "utf8")));
  const errors: string[] = [];
  const artifactChecks: any[] = [];
  const pointerChecks: any[] = [];
  const artifacts = Array.isArray(record.artifacts) ? record.artifacts : [];
  if (!artifacts.length) errors.push("artifacts must be non-empty");
  const artifactByPath = new Map<string, any>();
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.path !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? "")) {
      errors.push("each artifact requires path and sha256");
      continue;
    }
    const artifactPath = resolve(artifact.path);
    const exists = existsSync(artifactPath);
    const actualSha256 = exists ? sha256File(artifactPath) : undefined;
    const matched = exists && actualSha256 === artifact.sha256;
    if (!matched) errors.push(`${exists ? "changed" : "missing"} artifact: ${artifactPath}`);
    artifactByPath.set(artifactPath, artifact);
    artifactChecks.push({ path: artifactPath, expectedSha256: artifact.sha256, actualSha256, exists, matched });
  }
  for (const declaration of evidenceDeclarations(record)) {
    if (typeof declaration.path !== "string") {
      errors.push(`${declaration.declaredBy} requires artifactPath`);
      continue;
    }
    const artifactPath = resolve(declaration.path);
    if (!artifactByPath.has(artifactPath)) errors.push(`direct evidence is not hash-bound: ${artifactPath}`);
  }
  for (const declaration of pointerDeclarations(record)) {
    if (typeof declaration.path !== "string") continue;
    const artifactPath = resolve(declaration.path);
    if (!artifactByPath.has(artifactPath)) continue;
    if (typeof declaration.pointer !== "string") {
      errors.push(`${declaration.declaredBy} contains a non-string JSON pointer`);
      continue;
    }
    try {
      const value = pointerValue(JSON.parse(readFileSync(artifactPath, "utf8")), declaration.pointer);
      pointerChecks.push({ ...declaration, path: artifactPath, resolved: true, valueType: Array.isArray(value) ? "array" : typeof value });
    } catch (error) {
      errors.push(`${artifactPath} ${error instanceof Error ? error.message : String(error)}`);
      pointerChecks.push({ ...declaration, path: artifactPath, resolved: false });
    }
  }
  const createdAt = Date.parse(record.createdAt);
  if (!Number.isFinite(createdAt)) errors.push("createdAt must be an ISO timestamp");
  const interval = options.attemptInterval ?? record.generation?.attemptInterval;
  if (interval) {
    const startedAt = Date.parse(interval.startedAt);
    const finishedAt = Date.parse(interval.finishedAt);
    if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || createdAt < startedAt || createdAt > finishedAt) {
      errors.push(`createdAt is outside recorded attempt interval ${interval.startedAt}..${interval.finishedAt}`);
    }
  } else if (createdAt > (options.now ?? new Date()).getTime() + 1000) errors.push("createdAt is in the future");
  return {
    schema: "alex.improvement-cycle-validation/v1",
    validatedAt: (options.now ?? new Date()).toISOString(),
    recordPath: path,
    recordSha256: sha256File(path),
    artifactChecks,
    pointerChecks,
    errors,
    passed: errors.length === 0,
  };
}

export function generateCycleRecord(inputFile: string, outputRoot: string, now = new Date()) {
  const inputPath = resolve(inputFile);
  const input = object(JSON.parse(readFileSync(inputPath, "utf8")));
  const inputRoot = dirname(inputPath);
  const root = resolve(outputRoot);
  const disposableRoots = (input.generation?.disposableRoots ?? []).map((path: unknown) => {
    if (typeof path !== "string") throw new Error("generation.disposableRoots must contain paths");
    return resolve(inputRoot, path);
  });
  const rejectDisposable = (path: string, label: string) => {
    const disposableRoot = disposableRoots.find((candidate: string) => isWithin(candidate, path));
    if (disposableRoot) throw new Error(`${label} is within disposable root ${disposableRoot}: ${path}`);
  };
  rejectDisposable(root, "outputRoot");
  const artifacts = (input.artifacts ?? []).map((artifact: any) => {
    if (!artifact || typeof artifact.path !== "string") throw new Error("each artifact requires path");
    const path = resolve(inputRoot, artifact.path);
    rejectDisposable(path, "artifact");
    if (!existsSync(path)) throw new Error(`missing artifact: ${path}`);
    const actualSha256 = sha256File(path);
    if (artifact.sha256 !== undefined && (!/^[a-f0-9]{64}$/.test(artifact.sha256) || artifact.sha256 !== actualSha256)) {
      throw new Error(`changed artifact: ${path}`);
    }
    return { ...artifact, path, sha256: artifact.sha256 ?? actualSha256 };
  });
  const executions = (input.executions ?? []).map((execution: any) => ({
    ...execution,
    directEvidence: (execution.directEvidence ?? []).map((evidence: any) => {
      if (!evidence || typeof evidence.artifactPath !== "string") return evidence;
      const artifactPath = resolve(inputRoot, evidence.artifactPath);
      rejectDisposable(artifactPath, "direct evidence");
      return { ...evidence, artifactPath };
    }),
  }));
  mkdirSync(root);
  const record = { ...input, schema: "alex.improvement-cycle-record/v1", createdAt: now.toISOString(), executions, artifacts };
  const recordPath = join(root, "cycle-record.json");
  writeFileSync(recordPath, json(record));
  const validation = validateCycleRecord(recordPath, { now });
  const validationPath = join(root, "validation.json");
  writeFileSync(validationPath, json(validation));
  if (!validation.passed) throw new Error(`generated record failed validation: ${validation.errors.join("; ")}`);
  return { recordPath, validationPath, recordSha256: validation.recordSha256 };
}

if (import.meta.main) {
  const [command, source, destination] = process.argv.slice(2);
  try {
    if (command === "generate" && source && destination) console.log(json(generateCycleRecord(source, destination)).trim());
    else if (command === "validate" && source && !destination) {
      const result = validateCycleRecord(source);
      console.log(json(result).trim());
      if (!result.passed) process.exitCode = 1;
    } else throw new Error("Usage: cycle-evidence.ts generate <input.json> <new-output-dir> | validate <cycle-record.json>");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
