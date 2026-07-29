import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { reconciliationPacket, safeKey, triggerDetails } from "./lib/trigger";

export const name = "telegram-field-review";
export const description =
  "Review completed May Telegram turns for strong positive, negative, and contrastive learning evidence.";
export const workspace = "shared";

const DEFAULT_BATCH_SIZE = 40;
const MAX_BATCH_SIZE = 100;
const MIN_CONFIDENCE = 0.9;
const INITIAL_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const UNFINISHED_GRACE_MS = 30 * 60_000;

type ResponsibleLayer =
  | "may-judgment"
  | "may-knowledge"
  | "telegram-routing"
  | "owner-workflow"
  | "evaluator"
  | "runtime"
  | "non-actionable";

export interface TelegramFieldInteraction {
  sourceId: string;
  rootEventId: number;
  traceId: string;
  timestamp: number;
  sessionIds: string[];
  humanMessage: string;
  replyContext: Record<string, unknown> | null;
  mayResponses: string[];
  sessionEvidence: Array<Record<string, unknown>>;
  actionEvents: Array<Record<string, unknown>>;
  terminalEvents: Array<Record<string, unknown>>;
  nextHumanMessage: string | null;
}

interface SourceScan {
  interactions: TelegramFieldInteraction[];
  scanned: number;
  skippedStale: number;
  nextEventId: number;
  waitingForCompletion: boolean;
}

interface Checkpoint {
  schema_version: 1;
  source: "may-telegram";
  updated_at: string;
  last_root_event_id: number;
}

interface FieldSignal {
  sourceIds: string[];
  polarity: "positive" | "negative" | "contrastive";
  fulfillment: "fulfilled" | "partial" | "missed" | "unclear";
  responsibleLayer: ResponsibleLayer;
  intent: string;
  handling: string;
  outcomeEvidence: string;
  reusableRule: string;
  recommendedUse:
    | "preserve-behavior"
    | "lesson-example"
    | "benchmark-seed"
    | "fix-routing"
    | "fix-workflow"
    | "investigate-runtime"
    | "discard";
  strong: true;
  confidence: number;
}

const reviewSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: 1_200 }),
    signals: Type.Array(
      Type.Object(
        {
          sourceIds: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 4,
          }),
          polarity: Type.Union([
            Type.Literal("positive"),
            Type.Literal("negative"),
            Type.Literal("contrastive"),
          ]),
          fulfillment: Type.Union([
            Type.Literal("fulfilled"),
            Type.Literal("partial"),
            Type.Literal("missed"),
            Type.Literal("unclear"),
          ]),
          responsibleLayer: Type.Union([
            Type.Literal("may-judgment"),
            Type.Literal("may-knowledge"),
            Type.Literal("telegram-routing"),
            Type.Literal("owner-workflow"),
            Type.Literal("evaluator"),
            Type.Literal("runtime"),
            Type.Literal("non-actionable"),
          ]),
          intent: Type.String({ minLength: 1, maxLength: 800 }),
          handling: Type.String({ minLength: 1, maxLength: 1_200 }),
          outcomeEvidence: Type.String({ minLength: 1, maxLength: 1_200 }),
          reusableRule: Type.String({ minLength: 1, maxLength: 800 }),
          recommendedUse: Type.Union([
            Type.Literal("preserve-behavior"),
            Type.Literal("lesson-example"),
            Type.Literal("benchmark-seed"),
            Type.Literal("fix-routing"),
            Type.Literal("fix-workflow"),
            Type.Literal("investigate-runtime"),
            Type.Literal("discard"),
          ]),
          strong: Type.Boolean(),
          confidence: Type.Number({ minimum: 0, maximum: 1 }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 40 },
    ),
  },
  { additionalProperties: false },
);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bounded(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

function integer(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_BATCH_SIZE)
    : fallback;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

function workflowInput(ctx: WorkflowContext): Record<string, unknown> {
  const packet = reconciliationPacket(ctx.task);
  return record(packet?.input ?? triggerDetails(ctx.task));
}

function reviewPrompt(inputPath: string): string {
  return [
    "Review May's completed Telegram conversations as field evidence.",
    `Input: ${inputPath}`,
    "Read every interaction. Judge the end-to-end result, not whether May's final words sound polished.",
    "First infer what Hao meant. Then assess May's interpretation, action or answer, delivery, and Hao's later correction, approval, rejection, repetition, or continuation.",
    "The primary question is whether May fulfilled Hao's intended outcome. A polished reply, acknowledgement, plan, or promise is not fulfillment by itself.",
    "Use fulfilled when the answer or requested work is evidenced as complete; partial when May made useful progress but left a material part open; missed when May misunderstood, stopped, or claimed completion without evidence; unclear when the packet cannot prove the outcome.",
    "For investigation or change requests, look for diagnosis, action, verification, or a clear owner handoff in sessionEvidence and actionEvents. For a question or decision request, a correct useful answer may itself fulfill the intent.",
    "Quality is more important than quantity. Returning zero signals is a successful review.",
    "Keep only strong reusable evidence: an explicit Hao correction or dissatisfaction, repeated misunderstanding, unsafe or consequential wrong action, clear success followed by approval or productive continuation, or a useful success/failure contrast.",
    "A next message is outcome evidence only when it clearly reacts to the reviewed turn. Discard unrelated continuation, politeness, retries caused by missing output, and weak inference.",
    "Assign the responsible layer: may-judgment, may-knowledge, telegram-routing, owner-workflow, evaluator, runtime, or non-actionable.",
    "May is Hao's deputy. Judge whether May understood the high-level intent and drove the right next move. Do not demand unnecessary step-by-step detail.",
    "Use short, plain language. Use only exact sourceIds from the input.",
    `Set strong=false or confidence below ${MIN_CONFIDENCE} when meaning, cause, or reusability is uncertain; those signals will be discarded.`,
  ].join("\n");
}

function validSignals(value: unknown, allowed: Set<string>): FieldSignal[] {
  const rows = Array.isArray(record(value).signals)
    ? (record(value).signals as unknown[])
    : [];
  return rows.flatMap((candidate) => {
    const row = record(candidate);
    const sourceIds = Array.isArray(row.sourceIds)
      ? [...new Set(row.sourceIds.map(String))]
      : [];
    const confidence = Number(row.confidence);
    if (
      row.strong !== true ||
      confidence < MIN_CONFIDENCE ||
      !sourceIds.length ||
      sourceIds.some((id) => !allowed.has(id)) ||
      row.responsibleLayer === "non-actionable" ||
      row.recommendedUse === "discard"
    ) {
      return [];
    }
    return [
      {
        sourceIds,
        polarity: String(row.polarity) as FieldSignal["polarity"],
        fulfillment: String(row.fulfillment) as FieldSignal["fulfillment"],
        responsibleLayer: String(row.responsibleLayer) as ResponsibleLayer,
        intent: text(row.intent),
        handling: text(row.handling),
        outcomeEvidence: text(row.outcomeEvidence),
        reusableRule: text(row.reusableRule),
        recommendedUse: String(
          row.recommendedUse,
        ) as FieldSignal["recommendedUse"],
        strong: true,
        confidence,
      },
    ];
  });
}

function signalId(signal: FieldSignal): string {
  return `telegram-field-${createHash("sha256")
    .update(
      `${[...signal.sourceIds].sort().join("\0")}\0${signal.polarity}\0${signal.responsibleLayer}`,
    )
    .digest("hex")
    .slice(0, 20)}`;
}

function responseText(value: unknown): string {
  const data = parseJson(value);
  return bounded(text(data.text) || text(data.summary), 4_000);
}

export function scanTelegramFieldInteractions(
  ctx: WorkflowContext,
  afterEventId: number,
  limit: number,
): SourceScan {
  const roots = ctx.query.sql(
    `SELECT root.id AS rootEventId, root.timestamp, root.data AS rootData,
            trace.trace_id AS traceId,
            EXISTS (
              SELECT 1 FROM event_traces terminalTrace
              JOIN events terminal ON terminal.id = terminalTrace.event_id
              WHERE terminalTrace.trace_id = trace.trace_id
                AND terminal.event_type IN ('session.idle', 'session.end')
            ) AS hasTerminal,
            EXISTS (
              SELECT 1 FROM event_traces deliveryTrace
              JOIN events delivery ON delivery.id = deliveryTrace.event_id
              WHERE deliveryTrace.trace_id = trace.trace_id
                AND delivery.event_type IN ('channel.delivery.completed', 'channel.delivery.failed')
            ) AS hasDelivery
       FROM events root
       JOIN event_traces trace ON trace.event_id = root.id
       WHERE root.event_type = 'human.input.received'
         AND root.source = 'telegram'
         AND root.id > ?
         AND EXISTS (
           SELECT 1 FROM event_traces intentTrace
           JOIN events intent ON intent.id = intentTrace.event_id
           WHERE intentTrace.trace_id = trace.trace_id
             AND intent.event_type IN ('chat.start.requested', 'session.steer.requested')
         )
       ORDER BY root.id ASC`,
    [afterEventId],
    { limit },
  ).rows;

  const interactions: TelegramFieldInteraction[] = [];
  let nextEventId = afterEventId;
  let skippedStale = 0;
  let waitingForCompletion = false;
  for (const root of roots) {
    const rootEventId = Number(root.rootEventId);
    const traceId = String(root.traceId);
    const timestamp = Number(root.timestamp);
    const rootData = parseJson(root.rootData);
    const events = ctx.query.sql(
      `SELECT e.id, e.event_type AS eventType, e.data, e.session_id AS sessionId,
              e.timestamp
         FROM events e
         JOIN event_traces trace ON trace.event_id = e.id
         WHERE trace.trace_id = ?
         ORDER BY e.id ASC`,
      [traceId],
      { limit: 200 },
    ).rows;
    const targetSessionId = text(record(rootData.target).sessionId);
    const sessionIds = [
      ...new Set(
        [
          targetSessionId,
          ...events.map((event) => text(event.sessionId)),
        ].filter(Boolean),
      ),
    ];
    const nextHuman = ctx.query.sql(
      `SELECT data, timestamp
         FROM events
         WHERE event_type = 'human.input.received'
           AND source = 'telegram'
           AND id > ?
         ORDER BY id ASC`,
      [rootEventId],
      { limit: 1 },
    ).rows[0];
    const nextTimestamp = Number(nextHuman?.timestamp ?? 0);
    const notificationRows = sessionIds.flatMap(
      (sessionId) =>
        ctx.query.sql(
          `SELECT data, sent_at AS sentAt
           FROM notification_messages
           WHERE session_id = ? AND sent_at >= ?
             AND (? = 0 OR sent_at < ?)
           ORDER BY sent_at ASC`,
          [sessionId, timestamp, nextTimestamp, nextTimestamp],
          { limit: 20 },
        ).rows,
    );
    const mayResponses = [
      ...new Set(
        notificationRows.map((row) => responseText(row.data)).filter(Boolean),
      ),
    ];
    const sessionEvidence = sessionIds.flatMap(
      (sessionId) =>
        ctx.query.sql(
          `SELECT sessionId, agent, status, task, outcome, error,
                  opCount, result_ref AS resultRef
             FROM sessions
             WHERE sessionId = ?`,
          [sessionId],
          { limit: 1 },
        ).rows,
    );
    const actionEvents = events
      .filter((event) =>
        /^(project\.|workflow\.|cli\.|message\.|approval\.|escalation\.|evaluation\.|handler\.|channel\.delivery\.)/.test(
          String(event.eventType),
        ),
      )
      .map((event) => ({
        eventType: event.eventType,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        data: parseJson(event.data),
      }));
    const structurallyComplete = Boolean(root.hasTerminal && root.hasDelivery);
    if (!structurallyComplete && mayResponses.length === 0) {
      if (timestamp < Date.now() - UNFINISHED_GRACE_MS) {
        skippedStale += 1;
        nextEventId = rootEventId;
        continue;
      }
      waitingForCompletion = true;
      break;
    }
    const nextData = parseJson(nextHuman?.data);
    const context = record(rootData.context);
    interactions.push({
      sourceId: `telegram-event-${rootEventId}`,
      rootEventId,
      traceId,
      timestamp,
      sessionIds,
      humanMessage: bounded(text(rootData.text), 6_000),
      replyContext: Object.keys(context).length ? context : null,
      mayResponses,
      sessionEvidence,
      actionEvents,
      terminalEvents: events
        .filter((event) =>
          ["session.idle", "session.end", "channel.delivery.failed"].includes(
            String(event.eventType),
          ),
        )
        .map((event) => ({
          eventType: event.eventType,
          sessionId: event.sessionId,
          data: parseJson(event.data),
        })),
      nextHumanMessage: text(nextData.text) || null,
    });
    nextEventId = rootEventId;
  }
  return {
    interactions,
    scanned: roots.length,
    skippedStale,
    nextEventId,
    waitingForCompletion,
  };
}

function initialTelegramCursor(ctx: WorkflowContext): number {
  const row = ctx.query.sql(
    `SELECT COALESCE(MAX(id), 0) AS eventId
       FROM events
       WHERE event_type = 'human.input.received'
         AND source = 'telegram'
         AND timestamp < ?`,
    [Date.now() - INITIAL_LOOKBACK_MS],
    { limit: 1 },
  ).rows[0];
  return Number(row?.eventId ?? 0);
}

export async function runTelegramFieldReview(
  ctx: WorkflowContext,
  options: { scan?: (afterEventId: number, limit: number) => SourceScan } = {},
): Promise<WorkflowResult> {
  const input = workflowInput(ctx);
  const batchSize = integer(input.batchSize, DEFAULT_BATCH_SIZE);
  const stateDir = join(
    ctx.projectsRoot,
    "gym.app",
    ".state",
    "learning",
    "telegram",
  );
  const evidenceDir = join(stateDir, "evidence");
  const runsDir = join(stateDir, "runs");
  const checkpointPath = join(stateDir, "checkpoint.json");
  const journalPath = join(stateDir, "evidence.jsonl");
  const checkpoint = readJson<Checkpoint>(checkpointPath);
  const afterEventId =
    checkpoint && checkpoint.last_root_event_id > 0
      ? checkpoint.last_root_event_id
      : options.scan
        ? 0
        : initialTelegramCursor(ctx);
  const scan = options.scan
    ? options.scan(afterEventId, batchSize)
    : scanTelegramFieldInteractions(ctx, afterEventId, batchSize);
  const now = new Date().toISOString();
  const runId = `telegram-field-${now.replace(/[-:.]/g, "")}`;
  const runPath = join(runsDir, `${safeKey(runId, "telegram-field")}.json`);

  if (!scan.interactions.length) {
    writeJson(checkpointPath, {
      schema_version: 1,
      source: "may-telegram",
      updated_at: now,
      last_root_event_id: scan.nextEventId,
    } satisfies Checkpoint);
    const summary = scan.waitingForCompletion
      ? "Telegram field review is waiting for the next May turn to finish."
      : "Telegram field review found no new completed May conversations.";
    writeJson(runPath, {
      schema_version: 1,
      run_id: runId,
      reviewed_interactions: 0,
      strong_signals: 0,
      waiting_for_completion: scan.waitingForCompletion,
      skipped_stale_unfinished: scan.skippedStale,
      summary,
      completed_at: now,
    });
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [runPath, checkpointPath],
      actions: [],
    });
  }

  const scratchDir = join(stateDir, "scratch", safeKey(runId, "run"));
  const inputPath = join(scratchDir, "interactions.json");
  writeJson(inputPath, scan.interactions);
  try {
    const result = await ctx.runAgent("gym", reviewPrompt(inputPath), {
      schema: reviewSchema,
      timeoutMs: 900_000,
    });
    if (
      result.status === "error" ||
      result.status === "interrupted" ||
      !result.structuredResult
    ) {
      return ctx.done("Telegram field review failed; no checkpoint advanced.", {
        state: "needs-owner",
        summary: "Telegram field review failed; no checkpoint advanced.",
        evidence: [result.sessionId],
      });
    }
    const sourceById = new Map(
      scan.interactions.map((interaction) => [
        interaction.sourceId,
        interaction,
      ]),
    );
    const signals = validSignals(
      result.structuredResult,
      new Set(sourceById.keys()),
    );
    mkdirSync(evidenceDir, { recursive: true });
    const evidencePaths: string[] = [];
    for (const signal of signals) {
      const id = signalId(signal);
      const path = join(evidenceDir, `${id}.json`);
      const sources = signal.sourceIds.map((sourceId) => {
        const source = sourceById.get(sourceId)!;
        return {
          source_id: sourceId,
          root_event_id: source.rootEventId,
          trace_id: source.traceId,
          session_ids: source.sessionIds,
          timestamp: source.timestamp,
        };
      });
      const row = {
        schema_version: 1,
        evidence_id: id,
        source: "may-telegram-field-review",
        captured_at: now,
        status: "candidate",
        ...signal,
        sourceIds: undefined,
        sources,
      };
      if (!existsSync(path)) {
        writeJson(path, row);
        appendFileSync(journalPath, `${JSON.stringify(row)}\n`);
      }
      evidencePaths.push(path);
      if (
        signal.polarity !== "positive" &&
        signal.responsibleLayer !== "non-actionable"
      ) {
        ctx.emit({
          type: "gym.incident.detected",
          project: "gym",
          incidentId: id,
          reason: "strong-telegram-field-signal",
          fieldReviewPath: path,
          classification: signal.responsibleLayer,
        });
      }
    }
    writeJson(checkpointPath, {
      schema_version: 1,
      source: "may-telegram",
      updated_at: now,
      last_root_event_id: scan.nextEventId,
    } satisfies Checkpoint);
    const summary = signals.length
      ? `Telegram field review kept ${signals.length} strong signals from ${scan.interactions.length} completed conversations.`
      : `Telegram field review checked ${scan.interactions.length} completed conversations and kept no strong signals.`;
    writeJson(runPath, {
      schema_version: 1,
      run_id: runId,
      reviewed_interactions: scan.interactions.length,
      strong_signals: signals.length,
      positive_signals: signals.filter(
        (signal) => signal.polarity === "positive",
      ).length,
      actionable_signals: signals.filter(
        (signal) => signal.polarity !== "positive",
      ).length,
      waiting_for_completion: scan.waitingForCompletion,
      skipped_stale_unfinished: scan.skippedStale,
      summary,
      evidence_ids: signals.map(signalId),
      completed_at: now,
    });
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [runPath, checkpointPath, ...evidencePaths],
      actions: [],
    });
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return runTelegramFieldReview(ctx);
}
