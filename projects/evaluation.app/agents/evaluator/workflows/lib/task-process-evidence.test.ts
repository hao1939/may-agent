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
