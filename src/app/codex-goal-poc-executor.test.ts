import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppEvent, TaskAttempt } from "@may-agent/sdk";
import { codexGoalPocInternals, createCodexGoalPocExecutor, type CodexGoalClient } from "./codex-goal-poc-executor.js";
import type {
  AppServerNotification,
  CodexGoalObservation,
  CodexTurnCompletion,
} from "../../scripts/poc/codex-goal-client.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixtureRoot(): string {
  const root = join(tmpdir(), `codex-goal-executor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(root, { recursive: true });
  return root;
}

function attempt(overrides: Partial<TaskAttempt> = {}): TaskAttempt {
  let listener: ((event: AppEvent<Record<string, unknown>>) => void) | undefined;
  return {
    appId: "evaluation",
    attemptId: "r_1_test",
    resourceVersion: 4,
    task: {
      id: "runtime/codex-goal-trial/may-agent.app/example",
      parentId: "project-app-audit",
      generation: 1,
      status: "running",
      outcome: "Review the Task mental model",
      acceptance: ["Cite exact current evidence"],
      mode: "achieve",
      agent: "evaluator",
      executor: "codex-goal-poc",
      input: { targetProject: "may-agent.app", readOnly: true },
      conditions: [],
    },
    cwd: "/app/projects/evaluation.app",
    declaredOutputPaths: [],
    children: { live: [], completed: [] },
    events: { items: [], truncated: false },
    async publish() {
      return { eventId: 1 };
    },
    onEvent(next) {
      listener = next;
      return () => {
        if (listener === next) listener = undefined;
      };
    },
    ...overrides,
  };
}

class FakeClient implements CodexGoalClient {
  readonly calls: string[] = [];
  readonly threadId: string;
  private listener?: (notification: AppServerNotification) => void;

  constructor(threadId: string) {
    this.threadId = threadId;
  }

  async initialize() {
    this.calls.push("initialize");
  }
  async startThread(input: { cwd: string; developerInstructions?: string }) {
    this.calls.push(`start:${input.cwd}`);
    expect(input.developerInstructions).toContain("## Canonical May Task Attempt");
    expect(input.developerInstructions).toContain("Progress commentary may become a durable Task event");
    return { threadId: this.threadId, cwd: input.cwd };
  }
  async resumeThread(input: { threadId: string; cwd: string; developerInstructions?: string }) {
    this.calls.push(`resume:${input.threadId}`);
    expect(input.developerInstructions).toContain('"resourceVersion":');
    return { threadId: input.threadId, cwd: input.cwd };
  }
  async setGoal(input: { threadId: string; objective: string }) {
    this.calls.push(`goal:${input.threadId}`);
    expect(input.objective).toContain("Task mental model");
  }
  async waitForActiveTurn() {
    this.calls.push("active");
    return "turn-1";
  }
  async waitForGoal(): Promise<CodexGoalObservation> {
    this.calls.push("terminal-goal");
    return {
      threadId: this.threadId,
      turnId: "turn-1",
      goal: { threadId: this.threadId, objective: "review", status: "complete" },
    };
  }
  async waitForTurn(): Promise<CodexTurnCompletion> {
    this.calls.push("terminal-turn");
    return { threadId: this.threadId, turn: { id: "turn-1", status: "completed" } };
  }
  async readThread() {
    this.calls.push("read");
    return {
      thread: {
        turns: [
          {
            id: "turn-1",
            items: [
              {
                type: "agentMessage",
                phase: "final_answer",
                text: JSON.stringify({
                  state: "converged",
                  summary: "The model matches the cited runtime boundary.",
                  response: "The review found no material mismatch.",
                  evidence: ["projects/may-agent/src/app/app-task-runtime.ts:2025"],
                }),
              },
            ],
          },
        ],
      },
    };
  }
  async steer(_input: { threadId: string; turnId: string; message: string }) {
    this.calls.push("steer");
    return "turn-1";
  }
  async interrupt() {
    this.calls.push("interrupt");
  }
  emit(notification: AppServerNotification) {
    this.listener?.(notification);
  }
  onNotification(listener: (notification: AppServerNotification) => void) {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = undefined;
    };
  }
  async stop() {
    this.calls.push("stop");
  }
}

describe("codex-goal-poc Task executor", () => {
  it("loads the selected App agent role and real Task observations into the packet", () => {
    const root = fixtureRoot();
    const agentDir = join(root, "agents", "evaluator");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "AGENTS.md"), "Judge from exact evidence.\n");
    const packet = codexGoalPocInternals.packetFor(
      attempt({
        cwd: root,
        declaredOutputPaths: ["reports/review.md"],
        children: {
          live: [],
          completed: [
            {
              taskId: "collect-facts",
              parentId: "project-app-audit",
              generation: 1,
              outcome: "Collect facts",
              agent: "evaluator",
              input: {},
              conditions: [],
              hasLiveChildren: false,
              status: "done",
              evidence: ["facts.json"],
              completedAt: "2026-08-24T00:00:00.000Z",
            },
          ],
        },
      }),
    );
    expect(packet.role.instructions).toContain("Judge from exact evidence.");
    expect(packet.workspace.declaredOutputPaths).toEqual(["reports/review.md"]);
    expect(packet.observations.children.completed[0]?.taskId).toBe("collect-facts");
  });

  it("persists one Task binding, admits exact-turn JSON, and resumes it across generations", async () => {
    const root = fixtureRoot();
    const stateFile = join(root, "bindings.json");
    const clients = [new FakeClient("thread-1"), new FakeClient("unused")];
    const executor = createCodexGoalPocExecutor({
      stateFile,
      createClient: () => clients.shift()!,
      checkIntervalMs: 1,
      softStaleAfterMs: 1_000,
      hardStaleAfterMs: 2_000,
    });

    const first = await executor(attempt());
    expect(first).toMatchObject({
      state: "converged",
      response: "The review found no material mismatch.",
      evidence: ["projects/may-agent/src/app/app-task-runtime.ts:2025", "codex-thread:thread-1"],
    });
    expect(JSON.parse(readFileSync(stateFile, "utf8"))).toMatchObject({
      version: 1,
      bindings: {
        [codexGoalPocInternals.bindingKey(attempt())]: {
          appId: "evaluation",
          generation: 1,
          threadId: "thread-1",
          attempts: 1,
        },
      },
    });

    await executor(
      attempt({
        attemptId: "r_2_retry",
        resourceVersion: 7,
        task: { ...attempt().task, generation: 2, outcome: "Review the revised Task mental model" },
      }),
    );
    expect(clients).toHaveLength(0);
    expect(
      JSON.parse(readFileSync(stateFile, "utf8")).bindings[codexGoalPocInternals.bindingKey(attempt())],
    ).toMatchObject({
      threadId: "thread-1",
      generation: 2,
      attempts: 2,
    });
  });

  it("never admits a final answer from an older turn", async () => {
    const root = fixtureRoot();
    const client = new FakeClient("thread-stale-answer");
    let turn = 0;
    client.waitForActiveTurn = async () => `turn-${++turn}`;
    client.waitForGoal = async () => ({
      threadId: client.threadId,
      turnId: `turn-${turn}`,
      goal: { threadId: client.threadId, objective: "review", status: "complete" },
    });
    client.waitForTurn = async () => ({
      threadId: client.threadId,
      turn: { id: `turn-${turn}`, status: "completed" },
    });
    client.readThread = async () => ({
      thread: {
        turns: [
          {
            id: "turn-old",
            items: [
              {
                type: "agentMessage",
                phase: "final_answer",
                text: JSON.stringify({
                  state: "converged",
                  summary: "Stale answer",
                  evidence: ["stale"],
                }),
              },
            ],
          },
          {
            id: `turn-${turn}`,
            items:
              turn === 1
                ? []
                : [
                    {
                      type: "agentMessage",
                      phase: "final_answer",
                      text: JSON.stringify({
                        state: "converged",
                        summary: "Current-turn evidence was admitted.",
                        evidence: ["current-turn"],
                      }),
                    },
                  ],
          },
        ],
      },
    });
    const executor = createCodexGoalPocExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
      checkIntervalMs: 1,
      softStaleAfterMs: 1_000,
      hardStaleAfterMs: 2_000,
    });

    await expect(executor(attempt())).resolves.toMatchObject({
      state: "converged",
      evidence: ["current-turn", "codex-thread:thread-stale-answer"],
    });
    expect(client.calls.filter((call) => call === "goal:thread-stale-answer")).toHaveLength(2);
  });

  it("corrects invalid output in the same Task attempt and Codex thread", async () => {
    const root = fixtureRoot();
    const client = new FakeClient("thread-invalid");
    let turn = 0;
    const corrections: string[] = [];
    client.waitForActiveTurn = async () => `turn-${++turn}`;
    client.waitForGoal = async () => ({
      threadId: client.threadId,
      turnId: `turn-${turn}`,
      goal: { threadId: client.threadId, objective: "review", status: "complete" },
    });
    client.waitForTurn = async () => ({
      threadId: client.threadId,
      turn: { id: `turn-${turn}`, status: "completed" },
    });
    client.steer = async (input) => {
      corrections.push(input.message);
      return input.turnId;
    };
    client.readThread = async () => ({
      thread: {
        turns: [
          {
            id: `turn-${turn}`,
            items: [
              {
                type: "agentMessage",
                phase: "final_answer",
                text:
                  turn === 1
                    ? "not json"
                    : JSON.stringify({
                        state: "converged",
                        summary: "Corrected output satisfies the Task contract.",
                        evidence: ["same-thread-correction"],
                      }),
              },
            ],
          },
        ],
      },
    });
    const executor = createCodexGoalPocExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
      checkIntervalMs: 1,
      softStaleAfterMs: 1_000,
      hardStaleAfterMs: 2_000,
    });
    await expect(executor(attempt())).resolves.toMatchObject({
      state: "converged",
      evidence: ["same-thread-correction", "codex-thread:thread-invalid"],
    });
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toContain("not exact JSON");
    expect(client.calls.filter((call) => call === "goal:thread-invalid")).toHaveLength(2);
    expect(client.calls.at(-1)).toBe("stop");
  });

  it("bridges authoritative Codex progress to passive Task-owned events", async () => {
    const root = fixtureRoot();
    const client = new FakeClient("thread-progress");
    const published: Array<{ localKey: string; event: AppEvent<Record<string, unknown>> }> = [];
    client.waitForGoal = async () => {
      client.emit({
        method: "turn/started",
        params: { threadId: "thread-progress", turn: { id: "turn-1", status: "inProgress" } },
      });
      client.emit({
        method: "item/completed",
        params: {
          threadId: "thread-progress",
          turnId: "turn-1",
          item: { id: "message-1", type: "agentMessage", phase: "commentary", text: "Reviewing current evidence." },
        },
      });
      client.emit({
        method: "item/completed",
        params: {
          threadId: "thread-progress",
          turnId: "turn-1",
          item: { id: "final-1", type: "agentMessage", phase: "final_answer", text: "must not be duplicated" },
        },
      });
      client.emit({
        method: "turn/completed",
        params: { threadId: "thread-progress", turn: { id: "turn-1", status: "completed" } },
      });
      return {
        threadId: "thread-progress",
        turnId: "turn-1",
        goal: { threadId: "thread-progress", objective: "review", status: "complete" },
      };
    };
    const executor = createCodexGoalPocExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
      checkIntervalMs: 1,
      softStaleAfterMs: 1_000,
      hardStaleAfterMs: 2_000,
    });

    await executor(
      attempt({
        async publish(localKey, event) {
          published.push({ localKey, event });
          return { eventId: published.length };
        },
      }),
    );

    expect(published.map(({ event }) => event.data.stage)).toEqual(["turn-started", "intermediate", "turn-completed"]);
    expect(published.every(({ localKey }) => localKey.endsWith(":attempt:r_1_test"))).toBe(true);
    expect(JSON.stringify(published)).not.toContain("must not be duplicated");
    expect(published.every(({ event }) => event.target === undefined)).toBe(true);
  });

  it("does not lose a completed Task result when progress observation is degraded", async () => {
    const root = fixtureRoot();
    const client = new FakeClient("thread-degraded");
    client.waitForGoal = async () => {
      client.emit({
        method: "turn/started",
        params: { threadId: "thread-degraded", turn: { id: "turn-1", status: "inProgress" } },
      });
      return {
        threadId: "thread-degraded",
        turnId: "turn-1",
        goal: { threadId: "thread-degraded", objective: "review", status: "complete" },
      };
    };
    const executor = createCodexGoalPocExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
      checkIntervalMs: 1,
      softStaleAfterMs: 1_000,
      hardStaleAfterMs: 2_000,
    });

    const result = await executor(
      attempt({
        async publish() {
          throw new Error("event store unavailable");
        },
      }),
    );

    expect(result.state).toBe("converged");
    expect(result.evidence).toContain("codex-progress-events:degraded failed=1 last=event store unavailable");
  });

  it("steers queued events into the authoritative next automatic turn", async () => {
    const root = fixtureRoot();
    const client = new FakeClient("thread-turn-transition");
    let taskEvent: ((event: AppEvent<Record<string, unknown>>, accept: () => void) => void) | undefined;
    let accepted = false;
    const steered: Array<{ turnId: string; message: string }> = [];
    client.steer = async (input) => {
      steered.push({ turnId: input.turnId, message: input.message });
      return input.turnId;
    };
    client.waitForGoal = async () => {
      client.emit({
        method: "turn/completed",
        params: { threadId: client.threadId, turn: { id: "turn-1", status: "completed" } },
      });
      taskEvent?.({ type: "project.comment.created", data: { comment: "LIVE-STEER-TEST" } }, () => {
        accepted = true;
      });
      client.emit({
        method: "turn/started",
        params: { threadId: client.threadId, turn: { id: "turn-2", status: "inProgress" } },
      });
      return {
        threadId: client.threadId,
        turnId: "turn-2",
        goal: { threadId: client.threadId, objective: "review", status: "complete" },
      };
    };
    client.waitForTurn = async () => ({
      threadId: client.threadId,
      turn: { id: "turn-2", status: "completed" },
    });
    client.readThread = async () => ({
      thread: {
        turns: [
          {
            id: "turn-2",
            items: [
              {
                type: "agentMessage",
                phase: "final_answer",
                text: JSON.stringify({
                  state: "converged",
                  summary: "The live event was considered.",
                  evidence: ["event:LIVE-STEER-TEST"],
                }),
              },
            ],
          },
        ],
      },
    });
    const executor = createCodexGoalPocExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
      checkIntervalMs: 1,
      softStaleAfterMs: 1_000,
      hardStaleAfterMs: 2_000,
    });

    await executor(
      attempt({
        onEvent(next) {
          taskEvent = next;
          return () => {
            if (taskEvent === next) taskEvent = undefined;
          };
        },
      }),
    );

    expect(steered).toHaveLength(1);
    expect(steered[0]).toMatchObject({ turnId: "turn-2" });
    expect(steered[0]?.message).toContain("LIVE-STEER-TEST");
    expect(accepted).toBeTrue();
  });
});
