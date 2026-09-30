import { describe, expect, test } from "bun:test";
import {
  readTaskProcessEvidence,
  type SessionRead,
} from "./task-process-evidence.js";
import {
  readSubjectTask,
  taskEvidenceHash,
  type PublicCommand,
} from "./public-task-evidence.js";

function fixture(summaries = ["direct success"]) {
  const history = summaries.map((summary, index) => ({
    eventId: 10 + index,
    eventType: "project.task.reconciled",
    attemptId: `attempt-${index}`,
    generation: 2,
    summary,
  }));
  const events = history.map((ref, index) => ({
    id: ref.eventId,
    type: ref.eventType,
    data: {
      project: "may",
      taskId: "goal/one",
      generation: 2,
      attemptId: ref.attemptId,
      workflowRunId: `s_${index}`,
    },
  }));
  const sessions = summaries.map((_, index) => ({
    sessionId: `s_${index}`,
    app_id: "may",
    task_id: "goal/one",
    task_generation: 2,
    attempt_id: `attempt-${index}`,
    agent: "may",
    status: "done",
    endedAt: 100,
  }));
  const transcripts = summaries.map((summary, index) => ({
    sessionId: `s_${index}`,
    source: `.state/sessions/s_${index}/session.jsonl`,
    messageCount: 2,
    messages: [
      {
        role: "assistant",
        rawLine: 1,
        rawSource: `.state/sessions/s_${index}/session.jsonl`,
        toolCalls: [{ id: "call", tool: "bash", args: { command: summary } }],
      },
      {
        role: "tool_result",
        rawLine: 2,
        rawSource: `.state/sessions/s_${index}/session.jsonl`,
        toolCallId: "call",
        content: summary,
        isError: false,
      },
    ],
  }));
  const reads: string[] = [];
  const read: SessionRead = async (id, transcript) => {
    reads.push(`${id}:${transcript}`);
    const index = Number(id.slice(2));
    return transcript ? transcripts[index] : { session: sessions[index] };
  };
  const attempts = summaries.map((_, index) => ({
    version: 1,
    available: true,
    appId: "may",
    taskId: "goal/one",
    attemptId: `attempt-${index}`,
    generation: 2,
    sessionId: `s_${index}`,
  }));
  const provider = {
    readAttempts: async (input: Record<string, unknown>) =>
      attempts.find((a) => a.attemptId === input.attemptId)!,
    getEvent: async (id: string | number) => events.find((e) => e.id === id)!,
  };
  const detail = { status: "waiting", generation: 2, history };
  const run = () =>
    readTaskProcessEvidence("may", "goal/one", detail, provider, read);
  return {
    history,
    attempts,
    events,
    sessions,
    transcripts,
    reads,
    read,
    provider,
    detail,
    run,
  };
}

describe("Task-bound process evidence", () => {
  test("retains partial error output and the clipped diagnostic through an exact raw read", async () => {
    const f = fixture();
    let full =
      "useful partial matches\n" +
      "x".repeat(4000) +
      "\nCommand timed out after 120 seconds";
    f.transcripts[0].messages[1].content = full.slice(0, 2000);
    f.transcripts[0].messages[1].isError = true;
    let rawReads = 0;
    const read: SessionRead = async (id, part) => {
      if (typeof part !== "number") return f.read(id, part);
      rawReads++;
      expect(id).toBe("s_0");
      expect(part).toBe(2);
      return {
        sessionId: id,
        source: ".state/sessions/s_0/session.jsonl",
        line: part,
        parsed: {
          role: "toolResult",
          toolCallId: "call",
          isError: true,
          content: [{ type: "text", text: full }],
        },
      };
    };
    const result = await readTaskProcessEvidence(
      "may",
      "goal/one",
      f.detail,
      f.provider,
      read,
    );
    const msg = (result.attempts[0].messages as any[])[1];
    expect(rawReads).toBe(1);
    expect(msg.text).toHaveLength(800);
    expect(msg.text).toStartWith("useful partial matches");
    expect(msg.text).toContain("[...middle omitted...]");
    expect(msg.text).toEndWith("Command timed out after 120 seconds");
    expect(msg).toMatchObject({
      rawLine: 2,
      isError: true,
      rawSource: ".state/sessions/s_0/session.jsonl",
    });
    expect(msg.rawResultSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.attempts[0].status).toBe("truncated");
    expect(result).not.toHaveProperty("verdict");
    // A change outside both excerpts still changes the retained evidence identity.
    full = full.slice(0, 2500) + "y" + full.slice(2501);
    const changed = await readTaskProcessEvidence(
      "may",
      "goal/one",
      f.detail,
      f.provider,
      read,
    );
    const changedMessage = (changed.attempts[0].messages as any[])[1];
    expect(changedMessage.text).toBe(msg.text);
    expect(changedMessage.rawResultSha256).not.toBe(msg.rawResultSha256);
  });
  test.each(["unavailable", "wrong-call", "wrong-source", "changed-content"])(
    "keeps projected evidence when exact error read is %s",
    async (reason) => {
      const f = fixture(["partial output".repeat(100)]);
      f.transcripts[0].messages[1].isError = true;
      const read: SessionRead = async (id, part) => {
        if (typeof part !== "number") return f.read(id, part);
        if (reason === "unavailable") throw new Error("HTTP 503");
        return {
          sessionId: id,
          source:
            reason === "wrong-source"
              ? "other"
              : ".state/sessions/s_0/session.jsonl",
          line: part,
          parsed: {
            role: "toolResult",
            toolCallId: reason === "wrong-call" ? "other" : "call",
            isError: true,
            content:
              reason === "changed-content"
                ? "changed"
                : f.transcripts[0].messages[1].content,
          },
        };
      };
      const result = await readTaskProcessEvidence(
        "may",
        "goal/one",
        f.detail,
        f.provider,
        read,
      );
      const msg = (result.attempts[0].messages as any[])[1];
      expect(result.coverage?.readable).toBe(1);
      expect(msg.isError).toBe(true);
      expect(msg.text).toBe(
        f.transcripts[0].messages[1].content!.slice(0, 800),
      );
      expect(msg).not.toHaveProperty("rawResultSha256");
      expect(result.gaps.join()).toContain("projected result retained");
    },
  );
  test("bounds raw error reads without losing later error flags or short/successful results", async () => {
    const f = fixture();
    f.transcripts[0].messages = Array.from({ length: 12 }, (_, i) => ({
      ...f.transcripts[0].messages[1],
      rawLine: i + 1,
      content: i === 0 ? "short error" : "long output".repeat(100),
      isError: i !== 1,
    }));
    f.transcripts[0].messageCount = 12;
    let reads = 0;
    const read: SessionRead = async (id, part) => {
      if (typeof part !== "number") return f.read(id, part);
      reads++;
      throw new Error("unavailable");
    };
    const result = await readTaskProcessEvidence(
      "may",
      "goal/one",
      f.detail,
      f.provider,
      read,
    );
    expect(reads).toBe(8);
    expect(result.attempts[0].messages as any[]).toHaveLength(12);
    expect((result.attempts[0].messages as any[])[11].isError).toBe(true);
    expect(result.gaps.join()).toContain("raw error read limit reached");
  });
  test("waiting plus completed waste remains visible behind a later no-op, without a coded verdict", async () => {
    const f = fixture([
      "repeat identical failed discovery without new evidence",
      "duplicate tick: no mutation",
    ]);
    const result = await f.run();
    expect(result.attempts.map((a) => a.attemptId)).toEqual([
      "attempt-1",
      "attempt-0",
    ]);
    expect(JSON.stringify(result)).toContain(
      "repeat identical failed discovery",
    );
    expect(f.detail.status).toBe("waiting");
    expect(result).not.toHaveProperty("verdict");
    expect(result.attempts[1]).toMatchObject({
      session: { status: "done" },
      status: "read",
    });
  });
  test.each([
    "one direct successful check",
    "necessary exploration found unknown contract; provider failed once; retry succeeded",
  ])(
    "preserves efficient/recovery control without labeling it waste: %s",
    async (work) => {
      const result = await fixture([work]).run();
      expect(JSON.stringify(result)).toContain(work);
      expect(result.attempts[0]).toMatchObject({ status: "read" });
      expect(result).not.toHaveProperty("findings");
    },
  );
  test.each([
    "app_id",
    "task_id",
    "task_generation",
    "attempt_id",
    "sessionId",
  ])("rejects session %s mismatch before transcript read", async (key) => {
    const f = fixture();
    (f.sessions[0] as any)[key] = "wrong";
    expect((await f.run()).gaps.join()).toContain("correlation mismatch");
    expect(f.reads).toEqual(["s_0:false"]);
  });
  test.each(["project", "taskId", "generation", "attemptId"])(
    "rejects event %s mismatch before session reads",
    async (key) => {
      const f = fixture();
      (f.events[0].data as any)[key] = "wrong";
      expect((await f.run()).gaps.join()).toContain("correlation mismatch");
      expect(f.reads).toEqual([]);
    },
  );
  test("excludes Evaluation ownership and worker process, irrelevant event execution IDs, active sessions", async () => {
    const f = fixture();
    expect(
      (
        await readTaskProcessEvidence(
          "evaluation",
          "goal/one",
          f.detail,
          f.provider,
          f.read,
        )
      ).gaps.join(),
    ).toContain("excluded");
    expect(f.reads).toEqual([]);
    f.sessions[0].agent = "evaluator-deepseek";
    expect((await f.run()).gaps.join()).toContain("excluded");
    f.sessions[0].agent = "may";
    f.sessions[0].status = "running";
    expect((await f.run()).gaps.join()).toContain("not terminal");
    f.events[0].data.workflowRunId = "wr_not-a-session";
    f.sessions[0].status = "done";
    expect((await f.run()).attempts[0].status).toBe("read");
    delete (f.events[0].data as any).workflowRunId;
    expect((await f.run()).attempts[0].status).toBe("read");
  });
  test("missing evidence is coverage, not a failed wait; no guessed result session", async () => {
    const f = fixture();
    const result = await readTaskProcessEvidence(
      "may",
      "goal/one",
      f.detail,
      f.provider,
      async () => {
        throw new Error("missing");
      },
    );
    expect(result.attempts[0].status).toBe("unavailable");
    expect(f.detail.status).toBe("waiting");
    const absent = await readTaskProcessEvidence(
      "may",
      "goal/one",
      { result: { sessionId: "s_guess" } },
      f.provider,
      f.read,
    );
    expect(absent.gaps.join()).toContain("No exact");
    expect(f.reads).toEqual([]);
  });
  test("retains deterministic bounds, gaps and byte identity", async () => {
    const f = fixture(["a", "b", "c", "d"]);
    f.transcripts[3].messages[1].content = "x".repeat(20000);
    const result = await f.run();
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0].status).toBe("truncated");
    expect(result.gaps.join()).toContain("older execution unassessed");
    expect(result.gaps.join()).toContain("truncated");
    const hash = taskEvidenceHash("may", "goal/one", {
      readBack: { process: result },
    });
    expect(
      taskEvidenceHash("may", "goal/one", {
        readBack: { process: await f.run() },
      }),
    ).toBe(hash);
    f.transcripts[3].messages[1].content += "y";
    expect(
      taskEvidenceHash("may", "goal/one", {
        readBack: { process: await f.run() },
      }),
    ).not.toBe(hash);
  });
  test("rejects transcript source mismatch and changed binding", async () => {
    const f = fixture();
    f.transcripts[0].messages[0].rawSource = "other";
    expect((await f.run()).gaps.join()).toContain("source mismatch");
    f.transcripts[0].messages[0].rawSource =
      ".state/sessions/s_0/session.jsonl";
    let reads = 0;
    const changed = await readTaskProcessEvidence(
      "may",
      "goal/one",
      f.detail,
      f.provider,
      async (id, transcript) => {
        if (!transcript && ++reads === 2) f.sessions[0].endedAt++;
        return f.read(id, transcript);
      },
    );
    expect(changed.gaps.join()).toContain("changed during read");
  });
  test("subject snapshot binds process and preserves unavailable relative artifacts", async () => {
    const f = fixture();
    const command: PublicCommand = async (cmd) => {
      if (cmd.type === "task.attempts.read")
        return f.provider.readAttempts(cmd);
      if (cmd.type === "apps.list")
        return { command: cmd.type, apps: [{ id: "may" }] };
      if (cmd.type === "event.get")
        return {
          command: cmd.type,
          event: await f.provider.getEvent(Number(cmd.eventId)),
        };
      if (cmd.type === "app.task.get")
        return {
          command: cmd.type,
          appId: "may",
          taskId: "goal/one",
          task: {
            id: "goal/one",
            generation: 2,
            creator: { appId: "may" },
            result: {
              artifact: {
                path: ".state/hygiene/saved.json",
                sha256: "a".repeat(64),
              },
            },
          },
        };
      return {
        command: cmd.type,
        task: {
          ...f.detail,
          appId: "may",
          taskId: "goal/one",
          acceptedEvidence: { page: { items: [] } },
        },
      };
    };
    const subject = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
      f.read,
    );
    expect(subject.disposition).toBe("eligible");
    expect((subject.task!.readBack as any).process.attempts).toHaveLength(1);
    expect((subject.task!.readBack as any).artifacts[0].status).toBe(
      "unavailable",
    );
    expect((subject.task!.readBack as any).gaps.join()).toContain(
      ".state/hygiene/saved.json",
    );
  });
});
