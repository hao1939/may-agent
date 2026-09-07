import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AgentEvent } from "../app/event-bus.js";
import { closeDb, getDb } from "./requests.js";
import { rewriteSessionMessages } from "./persistence.js";
import { createCheckpointDigest, createStartDigest, getLastDigest, upsertDigest } from "./session-digest.js";
import { createDigestWriter } from "./session-subscribers.js";

describe("session digest evidence", () => {
  let persistDir: string;
  const sessionId = "digest-session";

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-digest-evidence-"));
  });

  afterEach(() => {
    closeDb(persistDir);
    rmSync(persistDir, { recursive: true });
  });

  it("records start, checkpoint, and terminal evidence without replacing earlier observations", () => {
    const writer = createDigestWriter(persistDir);
    const start = {
      type: "session.start",
      source: "runtime",
      owner: "agent:worker",
      data: { sessionId, agent: "worker", task: "Verify the deployment" },
    } as AgentEvent;
    writer(start);
    writer(start);
    const initial = getLastDigest(persistDir, sessionId);
    expect(initial).toMatchObject({ step: 1, task: "Verify the deployment", outcome: "in_progress" });

    createCheckpointDigest(persistDir, sessionId, "worker", {
      summary: "Prepared the deployment",
      data: { next_steps: ["Run health check"], files_modified: ["deploy.json"] },
    });
    expect(getLastDigest(persistDir, sessionId)).toMatchObject({
      step: 2,
      what_happened: "Prepared the deployment",
      still_open: '["Run health check"]',
      files_modified: '["deploy.json"]',
    });

    writer({
      type: "session.end",
      source: "runtime",
      owner: "agent:worker",
      data: {
        sessionId,
        agent: "worker",
        status: "done",
        duration: "1s",
        finishParams: { status: "success", summary: "Health check passed", deliverables: [{ path: "health.json" }] },
      },
    } as AgentEvent);
    const terminal = getLastDigest(persistDir, sessionId);
    expect(terminal).toMatchObject({
      step: 3,
      trigger: "end",
      outcome: "success",
      what_happened: "Health check passed",
      files_modified: '["health.json"]',
      still_open: null,
      action: null,
    });
    expect(getDb(persistDir).prepare("SELECT * FROM session_digests WHERE id = ?").get(initial!.id)).toEqual(initial);
    closeDb(persistDir);
    expect(getLastDigest(persistDir, sessionId)).toEqual(terminal);
  });

  it("does not infer changes or outcomes from attempted commands in a transcript", async () => {
    createStartDigest(persistDir, sessionId, "worker", "Fix the deployment");
    rewriteSessionMessages(persistDir, sessionId, [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "write-attempt",
            name: "write",
            arguments: { path: "src/config.ts", content: "new" },
          },
          {
            type: "toolCall",
            id: "shell-attempt",
            name: "bash",
            arguments: { command: "false && echo new > src/output.ts" },
          },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "write-attempt",
        toolName: "write",
        isError: true,
        content: [{ type: "text", text: "Permission denied" }],
      },
      {
        role: "toolResult",
        toolCallId: "shell-attempt",
        toolName: "bash",
        isError: true,
        content: [{ type: "text", text: "Exit code 1" }],
      },
    ] as AgentMessage[]);

    const digest = await upsertDigest(persistDir, { sessionId, agent: "worker", trigger: "recovery_requeue" });
    expect(digest).toMatchObject({
      files_modified: null,
      what_happened: null,
      outcome: null,
      still_open: null,
      action: null,
    });
  });

  it("preserves explicit file claims, including an explicitly empty list", async () => {
    for (const files of [["README.md", "folder with spaces/data.custom"], []]) {
      const digest = await upsertDigest(persistDir, {
        sessionId,
        agent: "worker",
        trigger: "recovery_requeue",
        what_happened: "Reported by the handler",
        files_modified: files,
      });
      expect(digest?.files_modified).toBe(JSON.stringify(files));
      expect(digest?.what_happened).toBe("Reported by the handler");
    }
  });

  it("retains recovery annotations and their history across later observations and reconnects", async () => {
    const recovery = await upsertDigest(persistDir, {
      sessionId,
      agent: "worker",
      trigger: "timeout",
      outcome: "in_progress",
      what_happened: "Validation timed out",
      still_open: "Need validation evidence",
    });
    expect(recovery).toMatchObject({ action: "escalate", action_reason: "Timed out: Need validation evidence" });
    closeDb(persistDir);
    expect(getLastDigest(persistDir, sessionId)).toEqual(recovery);

    const next = await upsertDigest(persistDir, {
      sessionId,
      agent: "worker",
      trigger: "recovery_requeue",
      what_happened: "Recovery routed to the owning App",
      details: { attempt: 1 },
    });
    expect(next).toMatchObject({ step: 2, action: null, details: '{"attempt":1}' });
    expect(getDb(persistDir).prepare("SELECT * FROM session_digests WHERE id = ?").get(recovery!.id)).toEqual(recovery);
  });
});
