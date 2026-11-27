/**
 * Tool output offloading for large structured/text tool results.
 *
 * Adapted from `packages/eve/src/tools/offload-content.ts` in `vercel/eve`
 * under the Apache License, Version 2.0.
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DEFAULT_OFFLOAD_MAX_BYTES = 20_000;
const MAX_SAVED_BYTES = 10 * 1024 * 1024;
const MAX_DIRECTORY_BYTES = 100 * 1024 * 1024;
const MAX_DIRECTORY_FILES = 100;
const SHAPE_LIMIT = 400;
const NESTED_KEYS_LIMIT = 120;
const TEXT_PREVIEW_LINES = 20;
const TEXT_PREVIEW_LINE_LIMIT = 200;
const FILE_STEM_LIMIT = 64;

// Built-in coding and completion tools already manage pagination, truncation, or turn termination.
const EXEMPT_TOOL_NAMES = new Set(["read", "write", "edit", "bash", "finish", "reconcile"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fnv1aHex(value: string): string {
  let result = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    result = Math.imul(result ^ value.charCodeAt(i), 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

function boundedStem(value: string): string {
  const safe = (value || "item").replace(/[^A-Za-z0-9._-]/g, "_");
  if (safe.length <= FILE_STEM_LIMIT) return safe;
  return `${safe.slice(0, FILE_STEM_LIMIT - 9)}-${fnv1aHex(value)}`;
}

function entryList(total: number, entryAt: (index: number) => string, limit: number): string {
  if (total === 0) return "none";
  const listed: string[] = [];
  let length = 0;
  for (let i = 0; i < total; i++) {
    const entry = entryAt(i);
    const room = limit - length;
    if (listed.length === 0) {
      listed.push(entry.length > room ? `${entry.slice(0, Math.max(room, 0))}...` : entry);
      length += Math.min(entry.length, room) + 2;
      continue;
    }
    if (entry.length + 2 > room) break;
    listed.push(entry);
    length += entry.length + 2;
  }
  return listed.length === total ? listed.join(", ") : `${listed.join(", ")}, ... (${total} total)`;
}

function describeScalar(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

function arrayShape(items: readonly unknown[], budget: number): string {
  const count = items.length.toLocaleString("en-US");
  const first = items[0];
  if (isPlainObject(first)) {
    const keys = Object.keys(first);
    return `array of ${count} ${items.length === 1 ? "object" : "objects"} with keys: ${entryList(keys.length, (i) => keys[i]!, Math.min(NESTED_KEYS_LIMIT, budget))}`;
  }
  const noun = items.length === 1 ? "item" : "items";
  return first === undefined ? `array of ${count} ${noun}` : `array of ${count} ${noun}, first is ${describeScalar(first)}`;
}

export function describeJsonShape(value: unknown, budget = SHAPE_LIMIT): string {
  if (Array.isArray(value)) return `JSON ${arrayShape(value, budget)}.`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    const describe = (index: number): string => {
      const key = keys[index]!;
      const entry = value[key];
      return Array.isArray(entry) ? `${key} (${arrayShape(entry, budget)})` : key;
    };
    return `JSON object with keys: ${entryList(keys.length, describe, Math.min(SHAPE_LIMIT, budget))}.`;
  }
  return `JSON ${describeScalar(value)}.`;
}

export function describeTextPreview(text: string, budget = 1_200): string {
  const lines = text.split(/\r?\n/);
  const shown: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (shown.length >= TEXT_PREVIEW_LINES) break;
    const room = Math.max(budget - used, 0);
    if (room === 0 && shown.length > 0) break;
    const limit = Math.min(TEXT_PREVIEW_LINE_LIMIT, room || TEXT_PREVIEW_LINE_LIMIT);
    shown.push(line.length > limit ? `${line.slice(0, limit)}...` : line);
    used += Math.min(line.length, limit) + 1;
  }
  const total = lines.length;
  const count = `${total.toLocaleString("en-US")} ${total === 1 ? "line" : "lines"}`;
  const lead = shown.length === total ? "Preview:" : `First ${shown.length} ${shown.length === 1 ? "line" : "lines"}:`;
  return `Text (${count}). ${lead}\n${shown.join("\n")}`;
}

async function evictOldestResults(dir: string, keepPath: string): Promise<void> {
  const names = await readdir(dir);
  const entries: Array<{ path: string; bytes: number; mtimeMs: number }> = [];
  let totalBytes = 0;
  for (const name of names) {
    const full = join(dir, name);
    try {
      const st = await stat(full);
      if (!st.isFile()) continue;
      entries.push({ path: full, bytes: st.size, mtimeMs: st.mtimeMs });
      totalBytes += st.size;
    } catch {
      /* Ignore concurrently deleted entries. */
    }
  }
  if (totalBytes <= MAX_DIRECTORY_BYTES && entries.length <= MAX_DIRECTORY_FILES) return;
  const candidates = entries
    .filter((entry) => entry.path !== keepPath)
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.path.localeCompare(b.path));
  let files = entries.length;
  for (const candidate of candidates) {
    if (totalBytes <= MAX_DIRECTORY_BYTES && files <= MAX_DIRECTORY_FILES) return;
    try {
      await unlink(candidate.path);
      totalBytes -= candidate.bytes;
      files -= 1;
    } catch {
      /* Ignore races. */
    }
  }
}

export function wrapToolsWithOffload(
  tools: readonly AgentTool[],
  sessionId: string,
  options: { maxBytes?: number; baseDir?: string } = {},
): AgentTool[] {
  const hasInspector = tools.some((t) => t.name === "read" || t.name === "bash");
  if (!hasInspector) return [...tools];
  const maxBytes = options.maxBytes ?? DEFAULT_OFFLOAD_MAX_BYTES;
  const resultsDir = join(options.baseDir ?? tmpdir(), "may-agent-tool-results", boundedStem(sessionId));

  return tools.map((tool) => {
    if (EXEMPT_TOOL_NAMES.has(tool.name)) return tool;
    const execute = tool.execute.bind(tool);
    return {
      ...tool,
      execute: async (callId, params, signal, onUpdate) => {
        const result = await execute(callId, params, signal, onUpdate);
        if ((result as { isError?: boolean }).isError) return result;
        if (!Array.isArray(result.content) || result.content.length === 0) return result;
        if (result.content.some((part) => !part || part.type !== "text" || typeof part.text !== "string")) {
          return result;
        }
        const combined = result.content.map((part) => (part as { text: string }).text).join("\n");
        const bytes = Buffer.byteLength(combined, "utf8");
        if (bytes <= maxBytes || bytes > MAX_SAVED_BYTES) return result;

        let parsedJson: unknown;
        let isJson = false;
        const trimmed = combined.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            parsedJson = JSON.parse(trimmed);
            isJson = true;
          } catch {
            isJson = false;
          }
        }
        const ext = isJson ? "json" : "txt";
        const filePath = join(resultsDir, `${boundedStem(tool.name)}-${boundedStem(callId)}.${ext}`);
        const budget = Math.max(240, Math.floor(maxBytes / 4));
        const shape = isJson ? describeJsonShape(parsedJson, budget) : describeTextPreview(combined, budget);
        try {
          await mkdir(resultsDir, { recursive: true });
          await writeFile(filePath, combined, "utf8");
          await evictOldestResults(resultsDir, filePath);
          const note = [
            `Output of ${tool.name} (${bytes.toLocaleString("en-US")} bytes) was saved to ${filePath}.`,
            shape,
            "Inspect targeted slices with read (offset/limit) or bash (jq/rg) instead of loading the entire file.",
          ].join("\n");
          return {
            ...result,
            content: [{ type: "text" as const, text: note }],
          };
        } catch {
          return result;
        }
      },
    } as AgentTool;
  });
}
