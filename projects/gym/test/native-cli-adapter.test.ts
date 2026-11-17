import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNativeCliAdapter } from "../src/native-cli-adapter";

test("native CLI backends use the capability primitive and preserve its receipts", async () => {
  const root = mkdtempSync(join(tmpdir(), "gym-native-cli-"));
  let received: any;
  const result = await runNativeCliAdapter({
    tool: "codex",
    prompt: "Return the task result",
    projectRoot: root,
    workDir: root,
    persistDir: join(root, "trace"),
    timeoutMs: 1_000,
    outputContract: "task-agent-result",
    runCli: (async (input: any, options: any) => {
      received = { input, options };
      return {
        taskId: "cli-task",
        nativeSessionId: "native-session",
        tool: "codex",
        status: "completed",
        summary: "done",
        outputText: JSON.stringify({ state: "converged", summary: "done" }),
        cleanupConfirmed: true,
        resultPath: join(root, "result.md"),
        structuredResultPath: join(root, "result.json"),
        eventsPath: join(root, "events.jsonl"),
        factsRefs: [],
        effectiveSandbox: "danger-full-access",
      };
    }) as any,
  });

  expect(received.input).toMatchObject({
    tool: "codex",
    prompt: "Return the task result",
    expectedOutput: { format: "json", requiredFields: ["state", "summary"] },
  });
  expect(received.options.agentName).toBe("gym");
  expect(result).toMatchObject({ sessionId: "native-session", status: "success" });
  expect(JSON.parse(readFileSync(join(root, "task-result.json"), "utf8"))).toEqual({
    state: "converged",
    summary: "done",
  });
});
