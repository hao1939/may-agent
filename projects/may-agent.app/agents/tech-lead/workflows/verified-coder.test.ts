import { describe, expect, test } from "bun:test";
import { parseInput } from "./verified-coder";

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
