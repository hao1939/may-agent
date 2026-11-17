import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  runCliAgent,
  type CliAgentResult,
} from "@may-agent/sdk/runtime";

export interface NativeCliAdapterResult {
  sessionId: string;
  status: string;
  sessionPath: string;
  error?: string;
}

export interface NativeCliAdapterOptions {
  tool: "codex" | "claude";
  prompt: string;
  projectRoot: string;
  workDir: string;
  persistDir: string;
  timeoutMs: number;
  outputContract?: "task-agent-result";
  runCli?: typeof runCliAgent;
}

/** Run a native coding backend as a capability, not as a public callable alias. */
export async function runNativeCliAdapter(
  options: NativeCliAdapterOptions,
): Promise<NativeCliAdapterResult> {
  mkdirSync(options.persistDir, { recursive: true });
  const execute = options.runCli ?? runCliAgent;
  const result: CliAgentResult = await execute(
    {
      tool: options.tool,
      prompt: options.prompt,
      mode: "investigate",
      cwd: options.workDir,
      timeoutMs: options.timeoutMs,
      ...(options.outputContract === "task-agent-result"
        ? {
            expectedOutput: {
              format: "json" as const,
              requiredFields: ["state", "summary"],
            },
          }
        : {}),
    },
    {
      agentName: "gym",
      projectRoot: options.projectRoot,
      persistDir: options.persistDir,
      sessionId: `gym-cli-${process.pid}-${randomUUID()}`,
    },
  );

  writeFileSync(
    join(options.workDir, "workflow-run.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  if (
    options.outputContract === "task-agent-result" &&
    result.status === "completed" &&
    result.outputText
  ) {
    writeFileSync(
      join(options.workDir, "task-result.json"),
      `${JSON.stringify(JSON.parse(result.outputText), null, 2)}\n`,
    );
  }

  return {
    sessionId: result.nativeSessionId ?? result.taskId,
    status: result.status === "completed" ? "success" : "error",
    sessionPath: result.eventsPath,
    ...(result.error ? { error: result.error } : {}),
  };
}
