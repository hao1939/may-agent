import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// The separately versioned Gym CLI imports this adapter, and its alignment
// benchmark calls these scripts. Host-only reference scans miss those callers.
describe("Gym's retained Host entry points", () => {
  it("keeps the direct preparation adapter importable without starting a runtime", async () => {
    const adapter = await import("../../src/app/direct-agent.js");
    expect(typeof adapter.runDirectAgent).toBe("function");
    expect(typeof adapter.prepareDirectAgentExecution).toBe("function");
    expect(adapter.resolveDirectToolPolicy("fixture", ["read-only"])).toEqual({
      agent: "fixture",
      configuredTools: ["read-only"],
      deniedTools: [],
      effectiveTools: ["read-only"],
    });
  });

  it("lists scenarios and records a baseline through the existing wrapper chain", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-gym-compat-"));
    roots.push(root);
    const host = join(root, "projects", "may-agent");
    const scripts = join(host, "scripts");
    const gym = join(root, "projects", "gym", "src");
    mkdirSync(scripts, { recursive: true });
    mkdirSync(gym, { recursive: true });
    for (const script of ["gym-run.sh", "gym-baseline.sh", "gym-batch.sh", "gym-record.ts"]) {
      copyFileSync(new URL(`../../scripts/${script}`, import.meta.url), join(scripts, script));
    }
    // No real scenario or model is run. Exercise the actual shell/recorder
    // integration against a deterministic CLI, entirely under the temp root.
    writeFileSync(
      join(gym, "cli.ts"),
      `
if (process.argv.includes("--list")) console.log("fixture-scenario");
else console.log(JSON.stringify({
  scenario: "fixture-scenario", agent: "fixture", passed: true,
  duration_ms: 12, checks: [{ name: "fixture-check", passed: true }]
}));
`,
    );
    const run = (script: string, args: string[]) => exec(join(scripts, script), args, { cwd: host, timeout: 10_000 });
    const listed = await run("gym-run.sh", ["--list"]);
    expect(listed.stdout.trim()).toBe("fixture-scenario");
    expect(existsSync(join(host, ".state"))).toBe(false);
    const baseline = await run("gym-baseline.sh", ["--scenario", "fixture-scenario", "--agent", "fixture"]);
    expect(baseline.stdout).toContain("1 pass, 0 fail, 0 error");
    const db = new Database(join(host, ".state", "may.db"), { readonly: true });
    try {
      expect(db.query("SELECT agent_name, scenario, passed FROM gym_runs").all()).toEqual([
        { agent_name: "fixture", scenario: "fixture-scenario", passed: 1 },
      ]);
      expect(db.query("SELECT check_name, passed FROM gym_checks").all()).toEqual([
        { check_name: "fixture-check", passed: 1 },
      ]);
    } finally {
      db.close();
    }
    expect((await run("gym-batch.sh", ["--help"])).stdout).toContain("--trials");
  });
});
