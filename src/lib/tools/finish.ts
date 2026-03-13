/**
 * Finish tool — optional lesson capture on task completion (P63 Trajectory Extraction).
 *
 * Agents call this tool to signal task completion. If the task involved a
 * non-obvious solution or recovery from an error, they can include a brief
 * lesson that gets appended to agents/shared/lessons.jsonl for future agents.
 */

import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

// ── Schema ─────────────────────────────────────────────────────────────

const FinishParams: TSchema = Type.Object({
  result: Type.String({
    description: "Brief summary of what was accomplished.",
  }),
  lesson: Type.Optional(
    Type.String({
      description:
        "If this task involved a non-obvious solution or recovery from an error, share a brief tip for future agents (1-2 sentences).",
    }),
  ),
});

export interface FinishInput {
  result: string;
  lesson?: string;
}

// ── JSONL entry ────────────────────────────────────────────────────────

export interface LessonEntry {
  timestamp: string;
  agent: string;
  task: string;
  lesson: string;
}

// ── Options ────────────────────────────────────────────────────────────

export interface FinishToolOptions {
  /** Path to the shared lessons JSONL file (default: agents/shared/lessons.jsonl). */
  lessonsPath: string;
  /** Agent name to record in the lesson entry. */
  agentName: string;
  /** Task description (set dynamically per session). */
  getTask: () => string;
}

// ── Helper ─────────────────────────────────────────────────────────────

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

// ── Factory ────────────────────────────────────────────────────────────

/**
 * Create a finish tool that optionally records a lesson to the shared lessons JSONL.
 */
export function createFinishTool(opts: FinishToolOptions): AgentTool {
  const { lessonsPath, agentName, getTask } = opts;

  return {
    name: "finish",
    label: "Finish",
    description:
      "Signal that the current task is complete. Provide a brief result summary. " +
      "Optionally include a lesson if this task involved a non-obvious solution " +
      "or recovery from an error — future agents can learn from it.",
    parameters: FinishParams,
    execute: async (_id, _params) => {
      const params = _params as FinishInput;

      if (!params.result) {
        return textResult("Error: 'result' parameter is required.");
      }

      // If a lesson was provided, append it to the shared JSONL
      if (params.lesson && params.lesson.trim()) {
        try {
          const dir = dirname(lessonsPath);
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }

          const entry: LessonEntry = {
            timestamp: new Date().toISOString(),
            agent: agentName,
            task: getTask(),
            lesson: params.lesson.trim(),
          };

          appendFileSync(lessonsPath, JSON.stringify(entry) + "\n", "utf-8");

          return textResult(
            `Task complete. Lesson recorded to shared knowledge.\n\nResult: ${params.result}`,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // Don't fail the task just because lesson recording failed
          return textResult(
            `Task complete (lesson recording failed: ${msg}).\n\nResult: ${params.result}`,
          );
        }
      }

      return textResult(`Task complete.\n\nResult: ${params.result}`);
    },
  };
}
