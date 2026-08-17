import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AppDependencyObservation } from "@may-agent/sdk";
import type { AppAnalysisAttacher } from "./app-inbox-host.js";
import type { EventBus } from "./event-bus.js";

type AnalysisRecord = {
  taskId: string;
  status: "requested" | "running" | "completed" | "failed" | "orphaned";
  summary?: string;
  error?: string;
  resultPath?: string;
  structuredResultPath?: string;
  eventsPath?: string;
};

export type AppAnalysisCapability = {
  attach: AppAnalysisAttacher;
  read(id: string): AppDependencyObservation | null;
  isTerminal(id: string): boolean;
};

function safeId(idempotencyKey: string): string {
  return `analysis_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

function taskDir(persistDir: string, id: string): string {
  return join(persistDir, "cli-tasks", id);
}

function recordPath(persistDir: string, id: string): string {
  return join(taskDir(persistDir, id), "task.json");
}

function readRecord(persistDir: string, id: string): AnalysisRecord | null {
  try {
    return JSON.parse(readFileSync(recordPath(persistDir, id), "utf8")) as AnalysisRecord;
  } catch {
    return null;
  }
}

function ensureInside(root: string, candidate: string): string {
  const base = resolve(root);
  const value = resolve(base, candidate);
  if (value === base || value.startsWith(`${base}/`)) return value;
  throw new Error(`Analysis path outside project root: ${candidate}`);
}

function terminal(record: AnalysisRecord | null): boolean {
  return Boolean(record && ["completed", "failed", "orphaned"].includes(record.status));
}

export function createAppAnalysisCapability(options: {
  bus: EventBus;
  persistDir: string;
  projectRoot: string;
}): AppAnalysisCapability {
  const attach: AppAnalysisAttacher = async ({ analysis, idempotencyKey }) => {
    const analysisId = safeId(idempotencyKey);
    const directory = taskDir(options.persistDir, analysisId);
    const promptPath = join(directory, "prompt.md");
    const resultPath = join(directory, "result.md");
    const structuredResultPath = join(directory, "result.json");
    const eventsPath = join(directory, "events.jsonl");
    const cwd = analysis.cwd ? ensureInside(options.projectRoot, analysis.cwd) : resolve(options.projectRoot);
    const files = analysis.files?.map((file) => ensureInside(cwd, file));
    const existing = readRecord(options.persistDir, analysisId);

    if (!existing) {
      mkdirSync(directory, { recursive: true });
      writeFileSync(promptPath, analysis.question);
      writeFileSync(
        join(directory, "request.json"),
        `${JSON.stringify(
          {
            taskId: analysisId,
            purpose: "may-analysis",
            tool: analysis.tool,
            mode: "review",
            cwd,
            promptPath,
            resultPath,
            structuredResultPath,
            eventsPath,
            sandbox: "read-only",
            timeoutMs: analysis.timeoutMs,
            sourceOwner: "agent:may",
            files,
            expectedOutput: analysis.expectedOutput,
          },
          null,
          2,
        )}\n`,
      );
      options.bus.emit({
        type: "cli.task.requested",
        source: "app:may",
        owner: "runtime:cli-task-runner",
        data: {
          taskId: analysisId,
          purpose: "may-analysis",
          tool: analysis.tool,
          mode: "review",
          cwd,
          promptPath,
          resultPath,
          structuredResultPath,
          eventsPath,
          sandbox: "read-only",
          timeoutMs: analysis.timeoutMs,
          sourceOwner: "agent:may",
          files,
          expectedOutput: analysis.expectedOutput,
        },
      } as any);
    }

    return {
      analysisId,
      isComplete: async () => terminal(readRecord(options.persistDir, analysisId)),
    };
  };

  return {
    attach,
    isTerminal: (id) => terminal(readRecord(options.persistDir, id)),
    read(id) {
      const record = readRecord(options.persistDir, id);
      if (!record) return null;
      const status: AppDependencyObservation["status"] =
        record.status === "completed"
          ? "done"
          : record.status === "failed"
            ? "error"
            : record.status === "orphaned"
              ? "interrupted"
              : record.status === "running"
                ? "running"
                : "pending";
      return {
        kind: "analysis",
        id,
        status,
        summary: record.summary ?? record.error,
        evidence: [record.resultPath, record.structuredResultPath, record.eventsPath].filter(
          (value): value is string => typeof value === "string" && existsSync(value),
        ),
      };
    },
  };
}
