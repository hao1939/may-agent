import { describe, expect, test } from "bun:test";
import type { WorkflowContext } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitStep, execute, parseInput } from "./verified-coder";

const reproducedRunCommand =
  "cd /app/projects/may-agent && bun test src/app/project-app-task-reconciler.test.ts src/app/loader/project-app-loader.test.ts && bun run check && git diff --check -- src/app/project-app-task-reconciler.test.ts src/app/loader/project-app-loader.test.ts src/app/loader/project-app-loader.ts src/app/project-app-task-reconciler.ts";

function reconciliationInput(outcome: string): string {
  const envelope = {
    appId: "may-agent",
    taskId: "restore-lease-cas-regressions-and-fence-residue-20260811",
    generation: 2,
    mode: "achieve",
    outcome,
    acceptance: [
      "Restore exact lease/CAS regressions.",
      "Run focused tests, typecheck, diff check, and canonical readback.",
    ],
    input: { staleReceiptSession: "s_1786421665210_125" },
  };

  return (
    "Reconcile task through workflow verified-coder\n" +
    "app: /app/projects/may-agent.app\n\n" +
    "## Reconciliation Task\n```json\n" +
    JSON.stringify(envelope, null, 2) +
    "\n```\n\n" +
    "## Trigger Event\n```json\n" +
    JSON.stringify({ outcome: "unrelated" }) +
    "\n```\n" +
    "verifyCommand: exit 99"
  );
}

describe("verified-coder input contract", () => {
  for (const status of ["blocked", "interrupted", "error"] as const) {
    test(`does not run verification or report success after a ${status} coder`, async () => {
      const root = mkdtempSync(join(tmpdir(), "verified-coder-status-"));
      try {
        const result = await execute(
          createTestAppWorkflowContext({
            input: {
              task: "Repair one scoped defect",
              verifyCommand: "printf verified > checked.txt",
            },
            workspace: { appRoot: root, projectRoot: root, root, output: root },
            callAgent: (async () => ({
              id: "test-coder",
              kind: "agent",
              status,
              summary: "Could not finish",
            })) as WorkflowContext["agents"]["call"],
          }),
        );
        expect(result.status).toBe("blocked");
        expect(existsSync(join(root, "checked.txt"))).toBeFalse();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  test("gives the coder the same checkout that the verifier reads", async () => {
    const root = mkdtempSync(join(tmpdir(), "verified-coder-checkout-"));
    let prompt = "";
    try {
      const result = await execute(
        createTestAppWorkflowContext({
          input: {
            task: "Write the scoped candidate",
            verifyCommand:
              "test -f candidate.txt && printf verified > checked.txt",
          },
          workspace: {
            appRoot: "/canonical/app",
            projectRoot: "/canonical/project",
            root,
            output: root,
          },
          callAgent: (async (_agent: string, task: string) => {
            prompt = task;
            writeFileSync(join(root, "candidate.txt"), "candidate");
            return {
              id: "test-coder",
              kind: "agent",
              status: "done",
              summary: "Candidate prepared",
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(prompt).toContain(`allocated workspace: ${root}`);
      expect(prompt).not.toContain("/canonical/project");
      expect(prompt).toContain("not permission to merge or deploy");
      expect(result.status).toBe("done");
      expect(readFileSync(join(root, "checked.txt"), "utf8")).toBe("verified");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps task-owned progress markers attempt-local", async () => {
    const logs: string[] = [];
    let published = false;
    const ctx = {
      reconciliation: { taskId: "runtime/source-repair" },
      log: { info: (message: string) => logs.push(message) },
      events: {
        emit: async () => {
          published = true;
          throw new Error(
            "Task-owned workflow events require a stable localKey",
          );
        },
      },
    } as unknown as WorkflowContext;

    await emitStep(ctx, "init");

    expect(published).toBeFalse();
    expect(logs).toEqual(["verified-coder step: init"]);
  });

  test("preserves legacy standalone step markers", async () => {
    const emitted: unknown[] = [];
    const ctx = {
      log: { info: () => {} },
      events: { emit: async (event: unknown) => void emitted.push(event) },
    } as unknown as WorkflowContext;

    await emitStep(ctx, "init");

    expect(emitted).toEqual([{ type: "step_start", data: { step: "init" } }]);
  });

  test("parses JSON-escaped verification metadata from reconciliation run wr_1786444540483_ubof", () => {
    const parsed = parseInput(
      reconciliationInput(
        "Restore durable lease/CAS and model-progress regressions.\n" +
          `verifyCommand: ${reproducedRunCommand}\n` +
          "maxAttempts: 5",
      ),
    );

    expect(parsed.verifyCommand).toBe(reproducedRunCommand);
    expect(parsed.maxAttempts).toBe(5);
    expect(parsed.task).toContain("Restore durable lease/CAS");
    expect(parsed.task).toContain("Restore exact lease/CAS regressions.");
    expect(parsed.task).not.toContain("verifyCommand");
    expect(parsed.task).not.toContain("Trigger Event");
    expect(parsed.task).not.toContain("exit 99");
  });

  test("preserves legacy raw task input with physical metadata lines", () => {
    const parsed = parseInput(
      "Implement the bounded fix.\nverifyCommand: bun test focused.test.ts\nmaxAttempts: 2",
    );

    expect(parsed).toEqual({
      task: "Implement the bounded fix.",
      verifyCommand: "bun test focused.test.ts",
      maxAttempts: 2,
    });
  });

  test("safely blocks missing verification commands instead of using trigger text", () => {
    expect(() =>
      parseInput(reconciliationInput("Implement the bounded fix.")),
    ).toThrow("non-empty 'verifyCommand: <command>'");
    expect(() => parseInput("Implement the bounded fix.")).toThrow(
      "non-empty 'verifyCommand: <command>'",
    );
  });

  test("safely blocks empty verification commands", () => {
    expect(() =>
      parseInput(
        reconciliationInput("Implement the bounded fix.\nverifyCommand:   "),
      ),
    ).toThrow("non-empty 'verifyCommand: <command>'");
    expect(() =>
      parseInput("Implement the bounded fix.\nverifyCommand:   "),
    ).toThrow("non-empty 'verifyCommand: <command>'");
  });
});
