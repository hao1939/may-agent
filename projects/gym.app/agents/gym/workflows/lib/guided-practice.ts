import { existsSync, readFileSync } from "node:fs";
import { Type } from "@earendil-works/pi-ai";
import type {
  GuidedPracticeCase,
  GuidedPracticeRequirement,
  LearningUnitContext,
} from "@may-agent/gym/loop";
import type { WorkflowContext } from "@may-agent/sdk";

const TERMINAL_EVENTS = new Set([
  "cli.task.completed",
  "cli.task.failed",
  "cli.task.orphaned",
]);

const reflectionSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: 1_000 }),
    calls: Type.Array(
      Type.Object(
        {
          taskId: Type.String({ minLength: 1 }),
          tool: Type.Union([Type.Literal("codex"), Type.Literal("claude")]),
          outcome: Type.Union([
            Type.Literal("completed"),
            Type.Literal("failed"),
            Type.Literal("orphaned"),
          ]),
          evidence: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 8,
          }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 8 },
    ),
    lessons: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      maxItems: 8,
    }),
    decision: Type.String({ minLength: 1, maxLength: 1_000 }),
  },
  { additionalProperties: false },
);

export interface CliPracticeEvent {
  id: number;
  eventType: string;
  taskId: string;
  tool: "codex" | "claude" | null;
  failureCategory: string | null;
  resultPath: string | null;
  structuredResultPath: string | null;
  eventsPath: string | null;
}

export interface CliPracticeAssessment {
  passed: boolean;
  missing: string[];
  taskIds: string[];
  evidence: string[];
}

export interface GuidedPracticeAttempt {
  attempt: number;
  sessionId: string;
  agentStatus: string;
  agentSummary: string | null;
  reflection: unknown;
  lifecycle: CliPracticeAssessment;
  events: CliPracticeEvent[];
}

export interface GuidedPracticeCaseResult {
  unit: string;
  case: string;
  type: "live" | "simulation";
  passed: boolean;
  attempts: GuidedPracticeAttempt[];
}

export interface GuidedPracticeResult {
  schema_version: 1;
  agent: string;
  passed: boolean;
  units: Array<{ id: string; version: number }>;
  cases: GuidedPracticeCaseResult[];
  completed_at: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseData(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

export function parseCliPracticeEvents(
  rows: Record<string, unknown>[],
): CliPracticeEvent[] {
  return rows.map((row) => {
    const data = parseData(row.data);
    const tool =
      data.tool === "codex" || data.tool === "claude" ? data.tool : null;
    return {
      id: Number(row.id ?? 0),
      eventType: String(row.event_type ?? ""),
      taskId: String(row.task_id ?? data.taskId ?? ""),
      tool,
      failureCategory:
        typeof data.failureCategory === "string" ? data.failureCategory : null,
      resultPath: typeof data.resultPath === "string" ? data.resultPath : null,
      structuredResultPath:
        typeof data.structuredResultPath === "string"
          ? data.structuredResultPath
          : null,
      eventsPath: typeof data.eventsPath === "string" ? data.eventsPath : null,
    };
  });
}

function terminalName(
  eventType: string,
): GuidedPracticeRequirement["terminal"] | null {
  if (eventType === "cli.task.completed") return "completed";
  if (eventType === "cli.task.failed") return "failed";
  if (eventType === "cli.task.orphaned") return "orphaned";
  return null;
}

export function assessCliPractice(
  events: CliPracticeEvent[],
  requirements: GuidedPracticeRequirement[],
): CliPracticeAssessment {
  const used = new Set<number>();
  const missing: string[] = [];
  const evidence: string[] = [];
  const taskIds = [
    ...new Set(events.map(({ taskId }) => taskId).filter(Boolean)),
  ];

  for (const requirement of requirements) {
    const match = events.find((event) => {
      if (used.has(event.id)) return false;
      if (event.tool !== requirement.tool) return false;
      if (terminalName(event.eventType) !== requirement.terminal) return false;
      return (
        !requirement.failure_category ||
        event.failureCategory === requirement.failure_category
      );
    });
    const label = `${requirement.tool}:${requirement.terminal}${
      requirement.failure_category ? `:${requirement.failure_category}` : ""
    }`;
    if (!match) {
      missing.push(label);
      continue;
    }
    used.add(match.id);
    const lifecycle = new Set(
      events
        .filter(({ taskId }) => taskId === match.taskId)
        .map(({ eventType }) => eventType),
    );
    if (!lifecycle.has("cli.task.requested")) {
      missing.push(`${label}:requested`);
    }
    if (!lifecycle.has("cli.task.started")) {
      missing.push(`${label}:started`);
    }
    evidence.push(
      ...[
        match.resultPath,
        match.structuredResultPath,
        match.eventsPath,
      ].filter((value): value is string => Boolean(value)),
    );
  }

  return {
    passed: missing.length === 0,
    missing,
    taskIds,
    evidence: [...new Set(evidence)],
  };
}

function readSessionEvents(
  ctx: WorkflowContext,
  sessionId: string,
): CliPracticeEvent[] {
  const result = ctx.query.sql(
    `SELECT id, event_type, task_id, data
       FROM events
      WHERE session_id = ?
        AND event_type IN (
          'cli.task.requested',
          'cli.task.started',
          'cli.task.completed',
          'cli.task.failed',
          'cli.task.orphaned'
        )
      ORDER BY timestamp ASC, id ASC`,
    [sessionId],
    { limit: 100 },
  );
  return parseCliPracticeEvents(result.rows);
}

function allRequestedCallsFinished(events: CliPracticeEvent[]): boolean {
  const requested = events.filter(
    ({ eventType }) => eventType === "cli.task.requested",
  );
  if (!requested.length) return true;
  return requested.every(({ taskId }) =>
    events.some(
      (event) =>
        event.taskId === taskId && TERMINAL_EVENTS.has(event.eventType),
    ),
  );
}

async function observePractice(
  ctx: WorkflowContext,
  sessionId: string,
  practice: GuidedPracticeCase,
): Promise<{ events: CliPracticeEvent[]; assessment: CliPracticeAssessment }> {
  const deadline = Date.now() + practice.max_wait_ms;
  let events = readSessionEvents(ctx, sessionId);
  let assessment = assessCliPractice(events, practice.requirements);
  while (
    !assessment.passed &&
    !allRequestedCallsFinished(events) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    events = readSessionEvents(ctx, sessionId);
    assessment = assessCliPractice(events, practice.requirements);
  }
  return { events, assessment };
}

export function guidedPracticePrompt(
  unit: LearningUnitContext,
  practice: GuidedPracticeCase,
  prior: GuidedPracticeAttempt | null,
): string {
  const requirements = practice.requirements
    .map(
      (item) =>
        `${item.tool} must end ${item.terminal}${
          item.failure_category ? ` with ${item.failure_category}` : ""
        }`,
    )
    .join("; ");
  return [
    "This is guided practice, not a written knowledge test.",
    `Learning unit: ${unit.id} v${unit.version} — ${unit.title}`,
    `Objective: ${practice.objective}`,
    `Lesson: ${unit.lessonPath}`,
    `Practice guide: ${unit.practicePath}`,
    `Accepted sources: ${unit.sourcePaths.join(", ")}`,
    "Use run_cli_agent for every required live worker call. Do not simulate a call or replace it with your own answer.",
    "Use review or investigate mode only. Keep the work read-only and scoped to the named files.",
    "A task being accepted is only the start. Wait for its terminal lifecycle event, then inspect result.md, result.json, and events.jsonl before deciding.",
    "Treat each worker answer as advice. Resolve disagreement with cited primary evidence, not a vote.",
    "Use a fresh native context for an independent opinion. Resume only when continuing the same worker's unfinished line of work.",
    requirements
      ? `Required observed outcomes: ${requirements}`
      : "No live worker outcome is required for this simulation.",
    `Practice task:\n${practice.task}`,
    ...(prior
      ? [
          `Previous attempt missed: ${prior.lifecycle.missing.join(", ") || "reflection quality"}`,
          `Previous agent summary: ${prior.agentSummary ?? prior.agentStatus}`,
          "Try again using that evidence. Change the failed waiting, context, retry, or result-handling behavior instead of repeating it.",
        ]
      : []),
    "Finish with the task ids, terminal outcomes, artifact paths you inspected, what changed your judgment, and the next decision you own.",
  ].join("\n");
}

export async function runGuidedPractice(input: {
  ctx: WorkflowContext;
  agent: string;
  units: LearningUnitContext[];
}): Promise<GuidedPracticeResult> {
  const cases: GuidedPracticeCaseResult[] = [];
  for (const unit of input.units) {
    for (const practice of unit.guidedPracticeCases) {
      const attempts: GuidedPracticeAttempt[] = [];
      for (let attempt = 1; attempt <= 2; attempt++) {
        const prior = attempts.at(-1) ?? null;
        const result = await input.ctx.runAgent(
          input.agent,
          guidedPracticePrompt(unit, practice, prior),
          {
            schema: reflectionSchema,
            timeoutMs: practice.max_wait_ms + 120_000,
          },
        );
        const observed =
          practice.type === "live"
            ? await observePractice(input.ctx, result.sessionId, practice)
            : {
                events: [] as CliPracticeEvent[],
                assessment: {
                  passed:
                    result.status === "done" &&
                    Boolean(result.structuredResult),
                  missing:
                    result.status === "done" && result.structuredResult
                      ? []
                      : ["structured-reflection"],
                  taskIds: [],
                  evidence: [],
                },
              };
        attempts.push({
          attempt,
          sessionId: result.sessionId,
          agentStatus: result.status,
          agentSummary: result.lastAssistantText,
          reflection: result.structuredResult ?? null,
          lifecycle: observed.assessment,
          events: observed.events,
        });
        if (observed.assessment.passed && result.structuredResult) break;
      }
      cases.push({
        unit: unit.id,
        case: practice.id,
        type: practice.type,
        passed: Boolean(attempts.at(-1)?.lifecycle.passed),
        attempts,
      });
    }
  }
  return {
    schema_version: 1,
    agent: input.agent,
    passed: cases.every(({ passed }) => passed),
    units: input.units.map(({ id, version }) => ({ id, version })),
    cases,
    completed_at: new Date().toISOString(),
  };
}

export function readGuidedPracticeResult(
  path: string,
): GuidedPracticeResult | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as GuidedPracticeResult;
  } catch {
    return null;
  }
}
