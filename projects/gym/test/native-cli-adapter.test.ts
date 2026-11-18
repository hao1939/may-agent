import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  rmSync(root, { recursive: true, force: true });
});

test("native CLI execution admits an external isolated Gym workspace through the real SDK protocol path", async () => {
  const gymRoot = mkdtempSync(join(tmpdir(), "gym-native-cli-external-"));
  const workDir = join(gymRoot, "work");
  const binDir = join(gymRoot, "bin");
  mkdirSync(workDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  const codex = join(binDir, "codex");
  writeFileSync(codex, `#!/bin/sh
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then shift; out="$1"; fi
  shift
done
printf '%s' '{"state":"converged","summary":"protocol complete"}' > "$out"
printf '%s' "$PWD" > "$PWD/native-cwd.txt"
printf '%s\n' \
  '{"type":"thread.started","thread_id":"fixture-native-session"}' \
  '{"type":"turn.started"}' \
  '{"type":"item.completed","item":{"type":"agent_message","text":"protocol complete"}}' \
  '{"type":"turn.completed"}'
`);
  chmodSync(codex, 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${binDir}:${previousPath ?? ""}`;
  try {
    const result = await runNativeCliAdapter({
      tool: "codex",
      prompt: "Return the task result from the isolated workspace",
      projectRoot: gymRoot,
      workDir,
      persistDir: join(gymRoot, "state", "cli-trace"),
      timeoutMs: 5_000,
      outputContract: "task-agent-result",
    });

    expect(result).toMatchObject({
      sessionId: "fixture-native-session",
      status: "success",
    });
    expect(readFileSync(join(workDir, "native-cwd.txt"), "utf8")).toBe(workDir);
    expect(JSON.parse(readFileSync(join(workDir, "task-result.json"), "utf8"))).toEqual({
      state: "converged",
      summary: "protocol complete",
    });
    expect(readFileSync(result.sessionPath, "utf8")).toContain("turn.completed");
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    rmSync(gymRoot, { recursive: true, force: true });
  }
});
