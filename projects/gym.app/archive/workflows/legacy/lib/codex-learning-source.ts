import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

export interface CodexSourceReference {
  sourceId: string;
  sessionId: string;
  timestamp: string;
  historyPath: string;
  historyLine: number;
  userSha256: string;
  rolloutPath: string | null;
  previousAssistantSha256: string | null;
}

export interface CodexLearningTurn {
  source: CodexSourceReference;
  userText: string;
  previousAssistant: string | null;
}

export interface CodexSourceScan {
  turns: CodexLearningTurn[];
  totalHistoryRows: number;
  newHistoryRows: number;
  rolloutFilesRead: number;
  malformedLines: number;
}

interface HistoryRow {
  sessionId: string;
  text: string;
  timestamp: string;
  historyLine: number;
  sourceId: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp(value: unknown): string {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1_000;
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.valueOf())
    ? new Date(0).toISOString()
    : date.toISOString();
}

function messageText(payload: Record<string, unknown>): string {
  if (!Array.isArray(payload.content)) return "";
  return payload.content
    .flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const value = item as Record<string, unknown>;
      for (const key of ["text", "input_text", "output_text"]) {
        if (typeof value[key] === "string") return [value[key]];
      }
      return [];
    })
    .join("\n")
    .trim();
}

async function jsonLines(
  path: string,
  visit: (value: Record<string, unknown>, line: number) => void,
  rawFilter?: (raw: string) => boolean,
): Promise<number> {
  let malformed = 0;
  let line = 0;
  const input = createReadStream(path);
  const reader = createInterface({ input, crlfDelay: Infinity });
  for await (const raw of reader) {
    line += 1;
    if (!raw.trim()) continue;
    if (rawFilter && !rawFilter(raw)) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        visit(parsed as Record<string, unknown>, line);
      } else malformed += 1;
    } catch {
      malformed += 1;
    }
  }
  return malformed;
}

async function filesBelow(path: string): Promise<string[]> {
  if (!existsSync(path)) return [];
  const result: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await filesBelow(child)));
    else if (entry.isFile() && entry.name.endsWith(".jsonl"))
      result.push(child);
  }
  return result.sort();
}

function sourceId(input: {
  sessionId: string;
  text: string;
  timestamp: string;
  historyLine: number;
}): string {
  return `codex-${sha256(
    [input.sessionId, input.timestamp, input.historyLine, input.text].join(
      "\0",
    ),
  ).slice(0, 24)}`;
}

export async function scanCodexLearningSource(input: {
  codexHome: string;
  processedSourceIds?: Iterable<string>;
}): Promise<CodexSourceScan> {
  const historyPath = join(input.codexHome, "history.jsonl");
  if (!existsSync(historyPath)) {
    throw new Error(`Codex history is missing: ${historyPath}`);
  }
  const processed = new Set(input.processedSourceIds ?? []);
  const history: HistoryRow[] = [];
  let malformedLines = await jsonLines(historyPath, (value, historyLine) => {
    const sessionId = String(value.session_id ?? "").trim();
    const text = String(value.text ?? "").trim();
    if (!sessionId || !text) return;
    const at = timestamp(value.ts);
    history.push({
      sessionId,
      text,
      timestamp: at,
      historyLine,
      sourceId: sourceId({ sessionId, text, timestamp: at, historyLine }),
    });
  });

  const newRows = history.filter((row) => !processed.has(row.sourceId));
  if (!newRows.length) {
    return {
      turns: [],
      totalHistoryRows: history.length,
      newHistoryRows: 0,
      rolloutFilesRead: 0,
      malformedLines,
    };
  }

  const neededSessions = new Set(newRows.map((row) => row.sessionId));
  const rolloutFiles = (
    await filesBelow(join(input.codexHome, "sessions"))
  ).filter((path) =>
    [...neededSessions].some((sessionId) => path.includes(sessionId)),
  );
  const rolloutBySession = new Map<string, string>();
  for (const path of rolloutFiles) {
    for (const sessionId of neededSessions) {
      if (path.includes(sessionId)) rolloutBySession.set(sessionId, path);
    }
  }

  const contextBySource = new Map<
    string,
    { previousAssistant: string | null; rolloutPath: string }
  >();
  for (const sessionId of neededSessions) {
    const rolloutPath = rolloutBySession.get(sessionId);
    if (!rolloutPath) continue;
    const queues = new Map<string, HistoryRow[]>();
    for (const row of history.filter(
      (candidate) => candidate.sessionId === sessionId,
    )) {
      const queue = queues.get(row.text) ?? [];
      queue.push(row);
      queues.set(row.text, queue);
    }
    let previousAssistant: string | null = null;
    malformedLines += await jsonLines(
      rolloutPath,
      (value) => {
        if (value.type !== "response_item") return;
        const payload =
          value.payload &&
          typeof value.payload === "object" &&
          !Array.isArray(value.payload)
            ? (value.payload as Record<string, unknown>)
            : {};
        if (payload.type !== "message") return;
        const text = messageText(payload);
        if (!text) return;
        if (payload.role === "assistant") {
          previousAssistant = text;
          return;
        }
        if (payload.role !== "user") return;
        const queue = queues.get(text);
        const row = queue?.shift();
        if (!row) return;
        contextBySource.set(row.sourceId, { previousAssistant, rolloutPath });
      },
      (raw) =>
        raw.includes('"response_item"') &&
        raw.includes('"type":"message"') &&
        (raw.includes('"role":"user"') || raw.includes('"role":"assistant"')),
    );
  }

  return {
    turns: newRows.map((row) => {
      const context = contextBySource.get(row.sourceId);
      return {
        source: {
          sourceId: row.sourceId,
          sessionId: row.sessionId,
          timestamp: row.timestamp,
          historyPath,
          historyLine: row.historyLine,
          userSha256: sha256(row.text),
          rolloutPath: context?.rolloutPath ?? null,
          previousAssistantSha256: context?.previousAssistant
            ? sha256(context.previousAssistant)
            : null,
        },
        userText: row.text,
        previousAssistant: context?.previousAssistant ?? null,
      };
    }),
    totalHistoryRows: history.length,
    newHistoryRows: newRows.length,
    rolloutFilesRead: rolloutBySession.size,
    malformedLines,
  };
}
