import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ArtifactDescriptor {
  ref: string;
  sha256: string;
  bytes: number;
}

function digest(content: string): Omit<ArtifactDescriptor, "ref"> {
  return {
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: Buffer.byteLength(content),
  };
}

function writeAtomic(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, filePath);
}

export function describeText(ref: string, content: string): ArtifactDescriptor {
  return { ref, ...digest(content) };
}

export function writeJsonArtifact(
  persistDir: string,
  ref: string,
  value: unknown,
): ArtifactDescriptor {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  writeAtomic(join(persistDir, ref), content);
  return describeText(ref, content);
}

export function readJsonArtifact<T>(persistDir: string, ref: string): T | null {
  return readJsonArtifactWithDescriptor<T>(persistDir, ref)?.value ?? null;
}

export function readJsonArtifactWithDescriptor<T>(
  persistDir: string,
  ref: string,
): { value: T; descriptor: ArtifactDescriptor } | null {
  try {
    const content = readFileSync(join(persistDir, ref), "utf8");
    return {
      value: JSON.parse(content) as T,
      descriptor: describeText(ref, content),
    };
  } catch {
    return null;
  }
}

/** Write an immutable JSON body once and return its content-addressed reference. */
export function writeContentAddressedJson(
  persistDir: string,
  directory: string,
  value: unknown,
): ArtifactDescriptor {
  const content = `${JSON.stringify(value)}\n`;
  const metadata = digest(content);
  const ref = `${directory}/${metadata.sha256}.json`;
  const filePath = join(persistDir, ref);
  if (!existsSync(filePath)) writeAtomic(filePath, content);
  return { ref, ...metadata };
}

/** Write immutable text exactly as supplied and return its content-addressed reference. */
export function writeContentAddressedText(
  persistDir: string,
  directory: string,
  content: string,
): ArtifactDescriptor {
  const metadata = digest(content);
  const ref = `${directory}/${metadata.sha256}.txt`;
  const filePath = join(persistDir, ref);
  if (!existsSync(filePath)) writeAtomic(filePath, content);
  return { ref, ...metadata };
}

export function sessionMetaRef(sessionId: string): string {
  return `sessions/${sessionId}/meta.json`;
}

export function workflowRunRef(runId: string): string {
  return `workflow-runs/${runId}/run.json`;
}

export function writeSessionResult(
  persistDir: string,
  sessionId: string,
  result: Record<string, unknown>,
): ArtifactDescriptor {
  const activeRef = `sessions/${sessionId}/result.json`;
  const historyRef = `sessions/history/${sessionId}/result.json`;
  const ref = existsSync(join(persistDir, "sessions", "history", sessionId)) ? historyRef : activeRef;
  return writeJsonArtifact(persistDir, ref, {
    schemaVersion: 1,
    sessionId,
    ...result,
  });
}
