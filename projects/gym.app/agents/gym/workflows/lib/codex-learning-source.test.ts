import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanCodexLearningSource } from "./codex-learning-source";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("uses canonical user history and joins preceding assistant context", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-learning-source-"));
  roots.push(root);
  const sessionId = "session-1";
  const sessionDir = join(root, "sessions", "2026", "07", "27");
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(
    join(root, "history.jsonl"),
    [
      {
        session_id: sessionId,
        ts: 1_785_000_000,
        text: "Prefer reject over not approve.",
      },
      { session_id: sessionId, ts: 1_785_000_001, text: "approve" },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n") + "\n",
  );
  const message = (role: string, text: string) => ({
    type: "response_item",
    payload: { type: "message", role, content: [{ type: "text", text }] },
  });
  writeFileSync(
    join(sessionDir, `rollout-${sessionId}.jsonl`),
    [
      message("user", "<environment_context>synthetic</environment_context>"),
      message("user", "Prefer reject over not approve."),
      message("assistant", "I propose the exact preference rule."),
      message("user", "approve"),
      '{"type":"response_item","payload":{"type":"message","role":"user"',
    ]
      .map((value) =>
        typeof value === "string" ? value : JSON.stringify(value),
      )
      .join("\n") + "\n",
  );

  const scan = await scanCodexLearningSource({ codexHome: root });
  expect(scan.turns).toHaveLength(2);
  expect(scan.turns[1]?.previousAssistant).toBe(
    "I propose the exact preference rule.",
  );
  expect(scan.turns[1]?.source.previousAssistantSha256).toHaveLength(64);
  expect(scan.malformedLines).toBe(1);
});

test("returns only source rows absent from the checkpoint", async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-learning-source-"));
  roots.push(root);
  mkdirSync(join(root, "sessions"), { recursive: true });
  writeFileSync(
    join(root, "history.jsonl"),
    `${JSON.stringify({ session_id: "s1", ts: 1_785_000_000, text: "One" })}\n`,
  );
  const first = await scanCodexLearningSource({ codexHome: root });
  const second = await scanCodexLearningSource({
    codexHome: root,
    processedSourceIds: first.turns.map((turn) => turn.source.sourceId),
  });
  expect(second.newHistoryRows).toBe(0);
  expect(second.turns).toEqual([]);
});
