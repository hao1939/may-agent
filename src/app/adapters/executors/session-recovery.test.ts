import { afterEach, expect, it } from "bun:test";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "../../../lib/manager.js";
import { appendSessionMessage, readSessionMeta, writeSessionMeta } from "../../../lib/persistence.js";
import { closeDb } from "../../../lib/requests.js";
import { createContextUpdater, createLastSessionWriter } from "../../../lib/session-subscribers.js";
import { EventBus, type AgentEvent } from "../../core/events/bus.js";
import { createTaskSessionRecovery } from "./session-recovery.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

it.each(["success", "failure", "blocked", "partial"])(
  "retains structured session evidence with finish status %s exactly once",
  (finishStatus) => {
    const root = mkdtempSync(join(tmpdir(), "may-recovered-judgment-"));
    roots.push(root);
    const sessionId = "judge-session";
    const judgment = { state: "stopped", summary: "Further recovery exceeds the authorized budget." };
    writeSessionMeta(root, sessionId, {
      agent: "judge",
      task: "Decide whether recovery is worthwhile",
      status: "running",
      startedAt: 1,
      kind: "call",
      outputSchema: Type.Object({ state: Type.Literal("stopped"), summary: Type.String() }),
    });
    appendSessionMessage(root, sessionId, {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "finish-call",
          name: "finish",
          arguments: {
            status: finishStatus,
            summary: judgment.summary,
            result: judgment,
          },
        },
      ],
    } as AgentMessage);
    appendSessionMessage(root, sessionId, {
      role: "toolResult",
      toolCallId: "finish-call",
      toolName: "finish",
      content: [{ type: "text", text: "Recorded" }],
      isError: false,
      timestamp: 2,
    });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const options = { persistDir: root, manager: new SubagentManager({ persistDir: root }), bus };
    const recovery = createTaskSessionRecovery(options);

    recovery.interrupt(sessionId, "Previous process exited");
    expect(readSessionMeta(root, sessionId)?.status).toBe("done");
    expect(
      JSON.parse(readFileSync(join(root, "sessions", sessionId, "result.json"), "utf8")).finishParams.result,
    ).toEqual(judgment);
    expect(events.filter((event) => event.type === "session.end")).toMatchObject([
      { data: { status: "done", finishParams: { status: finishStatus, result: judgment } } },
    ]);

    closeDb(root);
    const reopened = createTaskSessionRecovery({ ...options, manager: new SubagentManager({ persistDir: root }) });
    expect(
      JSON.parse(readFileSync(join(root, "sessions", sessionId, "result.json"), "utf8")).finishParams.result,
    ).toEqual(judgment);
    reopened.interrupt(sessionId, "Repeated recovery");
    expect(events.filter((event) => event.type === "session.end")).toHaveLength(1);
  },
);

it.each(["interrupted", "done", "error"] as const)(
  "writes recovered %s completion to the persisted owner after disabling its App",
  (status) => {
    const root = mkdtempSync(join(tmpdir(), "may-recovered-owner-"));
    roots.push(root);
    const relativeDir = "projects/sample.app/agents/actual-folder";
    const localDir = join(root, relativeDir);
    const globalDir = join(root, "agents/arc");
    for (const dir of [localDir, globalDir]) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "agent.json"), JSON.stringify({ name: "arc" }));
    }
    writeFileSync(join(root, "projects/sample.app/app.js"), "export default {};");
    for (const file of ["last-session.md", "context.md"]) writeFileSync(join(globalDir, file), "Global history\n");
    const sessionId = "recovered-session";
    writeSessionMeta(root, sessionId, {
      agent: "arc",
      agentRelativeDir: relativeDir,
      task: "Produce checked evidence",
      status: "running",
      startedAt: 1,
      kind: "call",
    });
    if (status !== "interrupted") {
      const finish = {
        status: status === "done" ? "success" : "failure",
        summary: "Retained decision",
        context_updates: [{ action: "add", content: "Retained owner evidence" }],
      };
      appendSessionMessage(root, sessionId, {
        role: "assistant",
        content: [{ type: "toolCall", id: "finish-call", name: "finish", arguments: finish }],
      } as AgentMessage);
      appendSessionMessage(root, sessionId, {
        role: "toolResult",
        toolCallId: "finish-call",
        toolName: "finish",
        content: [{ type: "text", text: "Recorded" }],
        isError: false,
        timestamp: 2,
      });
    }
    writeFileSync(join(root, "projects/sample.app/.disabled"), "");
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    bus.subscribe(createLastSessionWriter(root));
    bus.subscribe(createContextUpdater(root));
    // A fresh manager has no live owner; recovery uses only the durable record.
    const recovery = createTaskSessionRecovery({
      persistDir: root,
      manager: new SubagentManager({ persistDir: root }),
      bus,
    });
    recovery.interrupt(sessionId, "Previous worker exited");
    expect(events.filter((event) => event.type === "session.end")).toMatchObject([
      { data: { sessionId, agentRelativeDir: relativeDir, status } },
    ]);
    expect(readSessionMeta(root, sessionId)).toMatchObject({ status, agentRelativeDir: relativeDir });
    expect(readFileSync(join(localDir, "last-session.md"), "utf8")).toContain(sessionId);
    if (status === "interrupted") expect(existsSync(join(localDir, "context.md"))).toBe(false);
    else expect(readFileSync(join(localDir, "context.md"), "utf8")).toContain("Retained owner evidence");
    for (const file of ["last-session.md", "context.md"])
      expect(readFileSync(join(globalDir, file), "utf8")).toBe("Global history\n");
    recovery.interrupt(sessionId, "Repeated recovery");
    expect(events.filter((event) => event.type === "session.end")).toHaveLength(1);
  },
);
