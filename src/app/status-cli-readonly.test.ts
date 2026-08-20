import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { EventBus } from "./event-bus.js";
import { attachEventPersistence } from "./daemon-events.js";
import { closeDb } from "../lib/requests.js";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");
const DEV_ENTRY = resolve(import.meta.dir, "may.ts");
const buildDir = mkdtempSync(join(tmpdir(), "may-status-compiled-"));
const compiledEntry = join(buildDir, "may-agent");

function stateDigest(root: string): string[] {
  const entries: string[] = [];
  const visit = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const rel = relative(root, path);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        entries.push(`d ${rel}`);
        visit(path);
      } else {
        const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
        entries.push(`f ${rel} ${stat.size} ${hash}`);
      }
    }
  };
  visit(root);
  return entries;
}

function makeFixture(): string {
  const stateDir = mkdtempSync(join(tmpdir(), "may-status-state-"));
  writeFileSync(join(stateDir, "sentinel.txt"), "must remain unchanged\n");
  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir: stateDir });
  bus.emit({
    type: "workflow.started",
    source: "workflow:status-readonly-regression",
    owner: "agent:may",
    data: {
      workflowRunId: "wr_status_readonly_seed",
      workflow: "status-readonly-regression",
      task: "must remain open",
      projectId: "may-agent",
    },
  } as any);
  closeDb(stateDir);
  return stateDir;
}

function invoke(entry: string, args: string[], stateDir: string) {
  const command = entry === DEV_ENTRY ? process.execPath : entry;
  const commandArgs = entry === DEV_ENTRY ? [entry, ...args] : args;
  return spawnSync(command, commandArgs, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PROJECT_ROOT,
      STATE_DIR: stateDir,
      INSTANCE: "status-regression",
    },
    encoding: "utf8",
    timeout: 15_000,
  });
}

beforeAll(() => {
  const build = spawnSync("bun", ["build", "--compile", "src/app/binary-entry.ts", "--outfile", compiledEntry], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    timeout: 120_000,
  });
  expect(build.status, build.stderr).toBe(0);
}, 120_000);

afterAll(() => rmSync(buildDir, { recursive: true, force: true }));

describe.each([
  ["development", DEV_ENTRY],
  ["compiled operator", compiledEntry],
])("%s status CLI", (_label, entry) => {
  it("returns --status without recovery, startup, stale-pair closure, or persisted-state mutation", () => {
    const stateDir = makeFixture();
    const before = stateDigest(stateDir);
    try {
      const result = invoke(entry, ["--status"], stateDir);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("may-agent status");
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("workflow-recovery");
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("handler-recovery");
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("Starting (");
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("[app-inbox] Started");
      expect(stateDigest(stateDir)).toEqual(before);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("rejects positional status before recovery, startup, or persisted-state mutation", () => {
    const stateDir = makeFixture();
    const before = stateDigest(stateDir);
    try {
      const result = invoke(entry, ["status"], stateDir);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Unsupported positional command "status". Use "may-agent --status".');
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("workflow-recovery");
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("handler-recovery");
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("Starting (");
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("[app-inbox] Started");
      expect(stateDigest(stateDir)).toEqual(before);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
