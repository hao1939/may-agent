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

  const rejectedInputs: Array<[string, unknown]> = [
    ["legacy metadata string", "Fix math.cjs\nverifyCommand: node verify.cjs\nmaxAttempts: 2"],
    [
      "legacy reconciliation envelope",
      "## Reconciliation Task\n```json\n" +
        JSON.stringify({ outcome: "Fix math.cjs\nverifyCommand: node verify.cjs" }) +
        "\n```",
    ],
    ["blank task", { task: " \n\t", verifyCommand: "node verify.cjs" }],
    ["blank verification command", { task: "Fix math.cjs", verifyCommand: " \n\t" }],
    ["attempt limit above five", { task: "Fix math.cjs", verifyCommand: "node verify.cjs", maxAttempts: 6 }],
  ];

  test.each(rejectedInputs)("rejects %s before starting work", async (_label, input) => {
    const run = await runWorkflowTest(verifiedCoder, { input: input as never });
    expect(run.ok).toBe(false);
    expect(run.started).toBe(false);
    expect(run.steps).toEqual([]);
  });

  test("repairs with the selected helper using typed settings and failed verification output", async () => {
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
        task: "  Fix exports.add in math.cjs so add(2, 3) === 5\nverifyCommand: node unused.cjs\nmaxAttempts: 99  ",
        verifyCommand: "  node verify.cjs  ",
        maxAttempts: 2,
        agent: "  repairer  ",
      },
      workspace: {
        appRoot: workDir,
        projectRoot: workDir,
        root: workDir,
        output: workDir,
      },
      agents: {
        repairer: async ({ task }) => {
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
    expect(seenPrompts[0]).toStartWith("Fix exports.add");
    expect(seenPrompts[0]).toContain("verifyCommand: node unused.cjs\nmaxAttempts: 99");
    expect(seenPrompts[1]).toContain("Fix Required (attempt 2/2)");
    expect(seenPrompts[1]).toContain("Expected values to be strictly equal");
    expect(run.result?.output).toMatchObject({
      attemptsUsed: 2,
      verifyCommand: "node verify.cjs",
      coderSummary: "Fixed operator to +",
    });
  });

  test("defaults to three tech-lead attempts and retains the failed verification output", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "verified-coder-blocked-"));
    roots.push(workDir);
    writeFileSync(join(workDir, "verify.cjs"), "console.error('still broken'); process.exit(1);\n");

    const run = await runWorkflowTest(verifiedCoder, {
      input: {
        task: "Fix broken check",
        verifyCommand: "node verify.cjs",
      },
      workspace: {
        appRoot: workDir,
        projectRoot: workDir,
        root: workDir,
        output: workDir,
      },
      agents: {
        "tech-lead": async () => ({ status: "done", summary: "Incomplete attempt" }),
      },
    });

    expect(run.ok).toBe(true);
    expect(run.status).toBe("blocked");
    expect(run.steps).toHaveLength(3);
    expect(run.result?.type === "blocked" ? run.result.reason : null).toBe(
      "Verification failed after 3 attempts",
    );
    expect(run.result?.type === "blocked" ? run.result.context : null).toMatchObject({
      verifyCommand: "node verify.cjs",
      lastExitCode: 1,
      lastOutput: expect.stringContaining("still broken"),
    });
  });
});
