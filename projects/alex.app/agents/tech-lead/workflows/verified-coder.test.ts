import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWorkflowTest } from "@may-agent/sdk/testing";
import * as verifiedCoder from "./verified-coder.js";

const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("verified-coder executable-skill workflow", () => {
  test("rejects schema-invalid input before execute() runs", async () => {
    const run = await runWorkflowTest(verifiedCoder, {
      input: { task: "", verifyCommand: "" } as any,
    });
    expect(run.ok).toBe(false);
    expect(run.started).toBe(false);
  });

  test("repairs across attempts using failed verification output and validates outputSchema", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "verified-coder-unit-"));
    roots.push(workDir);
    writeFileSync(join(workDir, "math.cjs"), "exports.add = (a, b) => a - b;\n");
    writeFileSync(
      join(workDir, "verify.cjs"),
      "const assert = require('node:assert/strict'); assert.equal(require('./math.cjs').add(2, 3), 5); console.log('math ok');\n",
    );

    const seenPrompts: string[] = [];
    let callCount = 0;

    const run = await runWorkflowTest(verifiedCoder, {
      input: {
        task: "Fix exports.add in math.cjs so add(2, 3) === 5",
        verifyCommand: "node verify.cjs",
        maxAttempts: 2,
      },
      workspace: {
        appRoot: workDir,
        projectRoot: workDir,
        root: workDir,
        output: workDir,
      },
      agents: {
        "tech-lead": async ({ task }) => {
          callCount++;
          seenPrompts.push(task);
          if (callCount === 2) {
            writeFileSync(join(workDir, "math.cjs"), "exports.add = (a, b) => a + b;\n");
          }
          return {
            status: "done",
            summary: callCount === 1 ? "Attempted initial edit" : "Fixed operator to +",
          };
        },
      },
    });

    expect(run.ok).toBe(true);
    expect(run.status).toBe("done");
    expect(run.steps).toHaveLength(2);
    expect(seenPrompts[1]).toContain("Fix Required (attempt 2/2)");
    expect(seenPrompts[1]).toContain("Expected values to be strictly equal");
    expect(run.result?.output).toMatchObject({
      attemptsUsed: 2,
      verifyCommand: "node verify.cjs",
      coderSummary: "Fixed operator to +",
    });
  });

  test("returns blocked with lastOutput when maxAttempts is exhausted", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "verified-coder-blocked-"));
    roots.push(workDir);
    writeFileSync(join(workDir, "verify.cjs"), "console.error('still broken'); process.exit(1);\n");

    const run = await runWorkflowTest(verifiedCoder, {
      input: {
        task: "Fix broken check",
        verifyCommand: "node verify.cjs",
        maxAttempts: 1,
      },
      workspace: {
        appRoot: workDir,
        projectRoot: workDir,
        root: workDir,
        output: workDir,
      },
      agents: {
        "tech-lead": [{ status: "done", summary: "Incomplete attempt" }],
      },
    });

    expect(run.ok).toBe(true);
    expect(run.status).toBe("blocked");
    expect(run.result?.type === "blocked" ? run.result.context : null).toMatchObject({
      verifyCommand: "node verify.cjs",
      lastExitCode: 1,
      lastOutput: expect.stringContaining("still broken"),
    });
  });
});
