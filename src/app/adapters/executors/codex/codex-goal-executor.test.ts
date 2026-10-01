import { MAX_CODEX_GOAL_OBJECTIVE_CHARS, renderCodexGoalTaskAttempt } from "./codex-goal-packet.js";
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { taskAgentResultSchema, type AppEvent, type TaskAttempt } from "@may-agent/sdk";
import {
  codexGoalExecutorInternals,
  createCodexGoalExecutor,
  migrateCodexGoalBindingFile,
  type CodexGoalClient,
} from "./codex-goal-executor.js";
import type { AppServerNotification, CodexGoalObservation, CodexTurnCompletion } from "./codex-goal-client.js";

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

describe("Codex goal binding migration", () => {
  it("moves the trial filename to the stable name", () => {
    const root = fixtureRoot();
    const legacyPath = join(root, "codex-goal-poc-bindings.json");
    const currentPath = join(root, "codex-goal-bindings.json");
    writeFileSync(legacyPath, `${JSON.stringify({ version: 1, bindings: {} })}\n`);

    expect(migrateCodexGoalBindingFile({ legacyPath, currentPath })).toEqual({ migrated: true, bindings: 0 });
    expect(existsSync(legacyPath)).toBe(false);
    expect(JSON.parse(readFileSync(currentPath, "utf8"))).toEqual({ version: 1, bindings: {} });
  });

  it("merges disjoint current and trial bindings before removing the trial file", () => {
    const root = fixtureRoot();
    const legacyPath = join(root, "codex-goal-poc-bindings.json");
    const currentPath = join(root, "codex-goal-bindings.json");
    const currentBinding = { threadId: "thread-current", cwd: root, generation: 1, updatedAt: "now" };
    const legacyBinding = { threadId: "thread-legacy", cwd: root, generation: 2, updatedAt: "later" };
    writeFileSync(currentPath, `${JSON.stringify({ version: 1, bindings: { current: currentBinding } })}\n`);
    writeFileSync(legacyPath, `${JSON.stringify({ version: 1, bindings: { legacy: legacyBinding } })}\n`);

    expect(migrateCodexGoalBindingFile({ legacyPath, currentPath })).toEqual({ migrated: true, bindings: 2 });
    expect(existsSync(legacyPath)).toBe(false);
    expect(JSON.parse(readFileSync(currentPath, "utf8"))).toEqual({
      version: 1,
      bindings: { current: currentBinding, legacy: legacyBinding },
    });
  });

  it("fails closed without deleting either file when the same binding conflicts", () => {
    const root = fixtureRoot();
    const legacyPath = join(root, "codex-goal-poc-bindings.json");
    const currentPath = join(root, "codex-goal-bindings.json");
    writeFileSync(currentPath, `${JSON.stringify({ version: 1, bindings: { same: { threadId: "current" } } })}\n`);
    writeFileSync(legacyPath, `${JSON.stringify({ version: 1, bindings: { same: { threadId: "legacy" } } })}\n`);

    expect(() => migrateCodexGoalBindingFile({ legacyPath, currentPath })).toThrow("Conflicting Codex goal binding");
    expect(existsSync(currentPath)).toBe(true);
    expect(existsSync(legacyPath)).toBe(true);
  });
});

function attempt(overrides: Partial<TaskAttempt> = {}): TaskAttempt {
  let listener: ((event: AppEvent<Record<string, unknown>>) => void) | undefined;
  return {
    appId: "evaluation",
    attemptId: "r_1_test",
    signal: new AbortController().signal,
    resourceVersion: 4,
    role: {
      agent: "evaluator",
      instructions: "Judge from exact facts.",
    },
    task: {
      id: "runtime/codex-goal-trial/may-agent.app/example",
      parentId: "project-app-audit",
      generation: 1,
      status: "running",
      outcome: "Review the Task mental model",
      acceptance: ["Cite exact current facts"],
      agent: "evaluator",
      executor: "codex-goal",
      input: { targetProject: "may-agent.app", readOnly: true },
      conditions: [],
      acceptedEvidence: { available: false, maxPageSize: 8 },
    },
    cwd: "/tmp/evaluation.app",
    read: { tasks: { get: async () => { throw new Error("Initial context must not depend on optional reads"); }, list: async () => ({ items: [] }) } },
    reviseTask: async () => { throw new Error("No revisions in this fixture"); },
    declaredOutputPaths: [],
    children: { live: [], completed: [] },
    waits: { open: [], note: "No accepted waits." },
    events: { items: [], truncated: false },
    resultSchema: structuredClone(taskAgentResultSchema) as unknown as Record<string, unknown>,
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

function contextAttempt(root: string, version: string): TaskAttempt {
  const base = attempt({ cwd: root });
  return {
    ...base,
    task: {
      ...base.task, resourceVersion: 4,
      summary: `Draft ${version}`, result: { version }, facts: ["Cedar verified"],
      acceptedAttempt: { id: `accepted-${version}`, generation: 1, startedAt: "2026-08-23T08:00:00.000Z" },
      input: { background: "old weather report ".repeat(6000), document: "docs/design.md" },
      conditions: [{ id: "approval", type: "approval.observed", subject: "draft:v3", expected: true,
        observation: { generation: 1, resourceVersion: 4, observedGeneration: 1, state: "unknown", facts: ["approval-record"] } }],
      currentObligations: { available: true, inputWaits: { maxItems: 100, truncated: false,
        items: [{ key: "input:publish", conditionCount: 1,
          correlation: { input: { available: true, id: "publish", kind: "message", status: "handling" }, admission: { available: false } } }] } },
      acceptedEvidence: { available: true, maxPageSize: 8 },
      pendingEvents: { items: [{ eventId: 42, observedAt: "2026-08-23T08:01:00.000Z",
        event: { type: "task.steering", data: { message: "Thursday replaces Wednesday" } } }], truncated: false, throughEventId: 42 },
    },
    events: { items: [{ eventId: 41, observedAt: "2026-08-23T08:00:00.000Z",
      event: { type: "task.steering", data: { message: "Keep Cedar and the approval" } } }], truncated: false, throughEventId: 41 },
  };
}

// Exercise the real Task projection: a hand-reduced packet hid missing fields before.
describe("Codex goal Task context", () => {
  it("keeps the goal stable on replay, preserves generation and bounds only the objective", () => {
    const root = fixtureRoot();
    const first = contextAttempt(root, "v3");
    const render = (value: TaskAttempt) => renderCodexGoalTaskAttempt(codexGoalExecutorInternals.packetFor(value), root);
    const replay = { ...first, attemptId: "retry", resourceVersion: 8, events: first.task.pendingEvents! };
    expect(render(replay).goalObjective).toBe(render(first).goalObjective);
    expect(render(replay).developerInstructions).not.toBe(render(first).developerInstructions);
    const large = { ...first, task: { ...first.task, outcome: "x".repeat(8000) } };
    expect(render(large).goalObjective.length).toBe(MAX_CODEX_GOAL_OBJECTIVE_CHARS);
    expect(render({ ...large, task: { ...large.task, generation: 2 } }).goalObjective).not.toBe(render(large).goalObjective);
  });

  it("starts no provider when omitted detail cannot be saved; small snapshots need no detail file", async () => {
    const root = fixtureRoot();
    writeFileSync(join(root, "task-context"), "not a directory");
    let created = false;
    const executor = createCodexGoalExecutor({ stateFile: join(root, "bindings.json"),
      createClient: () => { created = true; return new FakeClient("unexpected"); } });
    await expect(executor(contextAttempt(root, "v3"))).rejects.toThrow();
    expect(created).toBe(false);
    const small = renderCodexGoalTaskAttempt(codexGoalExecutorInternals.packetFor(attempt()), root);
    const packet = JSON.parse(small.developerInstructions.split("## Canonical May Task Attempt\n")[1]!);
    expect(packet.coverage.detail).toBeUndefined();
    expect(packet.assignment.outcome).toBe(attempt().task.outcome);
  });
});

class FakeClient implements CodexGoalClient {
  readonly calls: string[] = [];
  readonly instructions: string[] = [];
  readonly preflights: Array<{
    command: string[];
    cwd: string;
    sandboxPolicy: { type: "readOnly"; networkAccess: false };
    timeoutMs: number;
    outputBytesCap: number;
  }> = [];
  readonly threadId: string;
  private listener?: (notification: AppServerNotification) => void;

  constructor(threadId: string) {
    this.threadId = threadId;
  }

  async initialize() {
    this.calls.push("initialize");
  }
  async execCommand(input: {
    command: string[];
    cwd: string;
    sandboxPolicy: { type: "readOnly"; networkAccess: false };
    timeoutMs: number;
    outputBytesCap: number;
  }) {
    this.calls.push(`preflight:${input.command.join(" ")}`);
    this.preflights.push(input);
    return { exitCode: 0, stdout: "", stderr: "" };
  }
  async startThread(input: { cwd: string; developerInstructions?: string }) {
    this.calls.push(`start:${input.cwd}`);
    this.instructions.push(input.developerInstructions!);
    expect(input.developerInstructions).toContain("## Canonical May Task Attempt");
    expect(input.developerInstructions).toContain("Progress commentary may become a durable Task event");
    return { threadId: this.threadId, cwd: input.cwd };
  }
  async resumeThread(input: { threadId: string; cwd: string; developerInstructions?: string }) {
    this.calls.push(`resume:${input.threadId}`);
    this.instructions.push(input.developerInstructions!);
    expect(input.developerInstructions).toContain('"resourceVersion":');
    return { threadId: input.threadId, cwd: input.cwd };
  }
  async injectDeveloperContext(input: { threadId: string; text: string }) {
    this.calls.push(`inject:${input.threadId}`);
    this.instructions.push(input.text);
    expect(input.text).toContain("## Canonical May Task Attempt");
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
                  facts: ["projects/may-agent/src/app/core/tasks/app-task-runtime.ts:2025"],
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

describe("codex-goal Task executor", () => {
  it("interrupts the exact active Codex turn when its Task attempt is cancelled", async () => {
    const root = fixtureRoot();
    const controller = new AbortController();
    const client = new FakeClient("thread-cancel");
    let rejectGoal = (_error: unknown) => {};
    client.waitForGoal = async () => {
      client.calls.push("terminal-goal");
      return await new Promise<CodexGoalObservation>((_resolve, reject) => {
        rejectGoal = reject;
      });
    };
    client.stop = async () => {
      client.calls.push("stop");
      rejectGoal(new Error("Codex app-server client stopped"));
    };
    const executor = createCodexGoalExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
    });

    const running = executor(attempt({ cwd: root, signal: controller.signal }));
    while (!client.calls.includes("terminal-goal")) await Bun.sleep(1);
    controller.abort(new Error("Task was cancelled"));

    await expect(running).rejects.toThrow("stopped");
    expect(client.calls).toContain("interrupt");
    expect(client.calls).toContain("stop");
  });

  it("uses the Runtime-resolved role and observations without rediscovering workspace instructions", () => {
    const root = fixtureRoot();
    const agentDir = join(root, "agents", "evaluator");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "AGENTS.md"), "Conflicting workspace role must be ignored.\n");
    const packet = codexGoalExecutorInternals.packetFor(
      attempt({
        cwd: root,
        role: { agent: "evaluator", instructions: "Use the immutable Runtime role." },
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
              facts: ["facts.json"],
              completedAt: "2026-08-24T00:00:00.000Z",
            },
          ],
        },
      }),
    );
    expect(packet.role.instructions).toBe("Use the immutable Runtime role.");
    expect(packet.role.instructions).not.toContain("Conflicting workspace role");
    expect(packet.workspace.declaredOutputPaths).toEqual(["reports/review.md"]);
    expect(packet.related.childrenAtAttemptStart.completed[0]?.taskId).toBe("collect-facts");
  });

  it("persists one Task binding, admits exact-turn JSON, and resumes it across generations", async () => {
    const root = fixtureRoot();
    const stateFile = join(root, "bindings.json");
    const firstClient = new FakeClient("thread-1"), resumedClient = new FakeClient("unused");
    const clients = [firstClient, resumedClient];
    const initial = contextAttempt(root, "v3");
    const executor = createCodexGoalExecutor({
      stateFile,
      createClient: () => clients.shift()!,
    });

    const first = await executor(initial);
    expect(first).toMatchObject({
      state: "converged",
      response: "The review found no material mismatch.",
      facts: ["projects/may-agent/src/app/core/tasks/app-task-runtime.ts:2025", "codex-thread:thread-1"],
    });
    expect(JSON.parse(readFileSync(stateFile, "utf8"))).toMatchObject({
      version: 1,
      bindings: {
        [codexGoalExecutorInternals.bindingKey(attempt())]: {
          appId: "evaluation",
          generation: 1,
          threadId: "thread-1",
          attempts: 1,
        },
      },
    });

    await executor(
      { ...contextAttempt(root, "v4"), attemptId: "r_2_retry", resourceVersion: 7,
        task: { ...contextAttempt(root, "v4").task, generation: 2, resourceVersion: 7 } },
    );
    expect(clients).toHaveLength(0);
    expect(firstClient.calls.slice(0, 3)).toEqual([
      "initialize",
      "preflight:/usr/bin/true",
      `start:${root}`,
    ]);
    expect(resumedClient.calls.slice(0, 3)).toEqual([
      "initialize",
      "preflight:/usr/bin/true",
      "resume:thread-1",
    ]);
    expect(firstClient.calls).not.toContain("inject:thread-1");
    expect(firstClient.calls.indexOf("goal:thread-1")).toBeGreaterThan(firstClient.calls.indexOf(`start:${root}`));
    expect(resumedClient.calls.indexOf("inject:thread-1")).toBeGreaterThan(resumedClient.calls.indexOf("resume:thread-1"));
    expect(resumedClient.calls.indexOf("goal:thread-1")).toBeGreaterThan(resumedClient.calls.indexOf("inject:thread-1"));
    for (const [client, version] of [[firstClient, "v3"], [resumedClient, "v4"]] as const) {
      expect(client.preflights).toEqual([
        {
          command: ["/usr/bin/true"],
          cwd: root,
          sandboxPolicy: { type: "readOnly", networkAccess: false },
          timeoutMs: 5_000,
          outputBytesCap: 4_096,
        },
      ]);
      const input = client.instructions[0]!;
      const context = JSON.parse(input.split("## Canonical May Task Attempt\n")[1]!);
      expect(context.current).toMatchObject({ summary: `Draft ${version}`, result: { version }, facts: ["Cedar verified"] });
      expect(context.conditions[0]).toMatchObject({ id: "approval", observation: { state: "unknown", facts: ["approval-record"] } });
      expect(context.obligations.inputWaits.items[0].key).toBe("input:publish");
      expect(context.events.attemptInput.items[0].eventId).toBe(41);
      expect(context.events.pendingInput.items[0].eventId).toBe(42);
      expect(context.evidence.available).toBe(true);
      // The fixed output schema is not background context and must remain intact.
      const { contract, role, ...decision } = context;
      expect(contract.resultSchema).toEqual(initial.resultSchema);
      expect(role).toEqual(initial.role);
      expect(Buffer.byteLength(JSON.stringify(decision))).toBeLessThan(8_000);
      const detail = JSON.parse(readFileSync(context.coverage.detail, "utf8"));
      expect(detail.current.result.version).toBe(version);
      expect(detail.input.background).toBe(initial.task.input.background);
      expect(detail.input.document).toBe("docs/design.md");
      expect(context.input.pointer).toBe("/input");
    }
    expect(
      JSON.parse(readFileSync(stateFile, "utf8")).bindings[codexGoalExecutorInternals.bindingKey(attempt())],
    ).toMatchObject({
      threadId: "thread-1",
      generation: 2,
      attempts: 2,
    });
  });

  it("fails before starting a thread when the bounded sandbox preflight exits nonzero", async () => {
    const root = fixtureRoot();
    const stateFile = join(root, "bindings.json");
    const client = new FakeClient("thread-must-not-start");
    client.execCommand = async (input) => {
      client.calls.push(`preflight:${input.command.join(" ")}`);
      client.preflights.push(input);
      return { exitCode: 1, stdout: "ignored", stderr: "sandbox unavailable" };
    };
    const executor = createCodexGoalExecutor({ stateFile, createClient: () => client });

    await expect(executor(attempt({ cwd: root }))).rejects.toThrow(
      "Codex executor preflight failed with exit code 1",
    );
    expect(client.calls).toEqual(["initialize", "preflight:/usr/bin/true", "stop"]);
    expect(client.instructions).toEqual([]);
    expect(existsSync(stateFile)).toBe(false);
  });

  it("fails before resuming a thread when the sandbox preflight transport fails", async () => {
    const root = fixtureRoot();
    const stateFile = join(root, "bindings.json");
    writeFileSync(
      stateFile,
      `${JSON.stringify({
        version: 1,
        bindings: {
          [codexGoalExecutorInternals.bindingKey(attempt())]: {
            appId: "evaluation",
            taskId: attempt().task.id,
            generation: 1,
            threadId: "thread-existing",
            cwd: root,
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
            attempts: 1,
            staleInterrupts: 0,
          },
        },
      })}\n`,
    );
    const client = new FakeClient("thread-must-not-resume");
    client.execCommand = async (input) => {
      client.calls.push(`preflight:${input.command.join(" ")}`);
      throw new Error("command/exec transport unavailable");
    };
    const executor = createCodexGoalExecutor({ stateFile, createClient: () => client });

    await expect(executor(attempt({ cwd: root }))).rejects.toThrow("command/exec transport unavailable");
    expect(client.calls).toEqual(["initialize", "preflight:/usr/bin/true", "stop"]);
    expect(client.instructions).toEqual([]);
    expect(
      JSON.parse(readFileSync(stateFile, "utf8")).bindings[codexGoalExecutorInternals.bindingKey(attempt())],
    ).toMatchObject({ threadId: "thread-existing", attempts: 1 });
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
                  facts: ["stale"],
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
                        summary: "Current-turn facts were admitted.",
                        facts: ["current-turn"],
                      }),
                    },
                  ],
          },
        ],
      },
    });
    const executor = createCodexGoalExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
    });

    await expect(executor(attempt())).resolves.toMatchObject({
      state: "converged",
      facts: ["current-turn", "codex-thread:thread-stale-answer"],
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
                        facts: ["same-thread-correction"],
                      }),
              },
            ],
          },
        ],
      },
    });
    const executor = createCodexGoalExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
    });
    await expect(executor(attempt())).resolves.toMatchObject({
      state: "converged",
      facts: ["same-thread-correction", "codex-thread:thread-invalid"],
    });
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toContain("not exact JSON");
    expect(client.calls.filter((call) => call === "goal:thread-invalid")).toHaveLength(2);
    expect(client.calls.at(-1)).toBe("stop");
  });

  for (const limitStatus of ["usageLimited", "budgetLimited"] as const) {
    it(`treats ${limitStatus} as an execution failure and retries the same Task and thread`, async () => {
      const root = fixtureRoot();
      const stateFile = join(root, "bindings.json");
      const limited = new FakeClient(`thread-${limitStatus}`);
      limited.waitForGoal = async () => ({
        threadId: limited.threadId,
        turnId: "turn-1",
        goal: { threadId: limited.threadId, objective: "review", status: limitStatus },
      });
      const resumed = new FakeClient("unused");
      const clients = [limited, resumed];
      const executor = createCodexGoalExecutor({
        stateFile,
        createClient: () => clients.shift()!,
      });

      await expect(executor(attempt())).rejects.toThrow(`Codex stopped the current turn because it is ${limitStatus}`);
      expect(limited.calls).toContain("terminal-turn");
      expect(limited.calls).not.toContain("read");

      await expect(executor(attempt({ attemptId: "r_2_retry" }))).resolves.toMatchObject({
        state: "converged",
        facts: ["projects/may-agent/src/app/core/tasks/app-task-runtime.ts:2025", `codex-thread:thread-${limitStatus}`],
      });
      expect(resumed.calls).toContain(`resume:thread-${limitStatus}`);
      expect(JSON.parse(readFileSync(stateFile, "utf8"))).toMatchObject({
        bindings: {
          [codexGoalExecutorInternals.bindingKey(attempt())]: {
            threadId: `thread-${limitStatus}`,
            attempts: 2,
          },
        },
      });
    });
  }

  it("lets quiet useful work finish without steering", async () => {
    const client = new FakeClient("thread-quiet");
    const original = client.waitForGoal.bind(client);
    client.waitForGoal = async () => {
      await Bun.sleep(40);
      return original();
    };
    const executor = createCodexGoalExecutor({
      stateFile: join(fixtureRoot(), "bindings.json"),
      createClient: () => client,
      turnTimeoutMs: 500,
    });
    await expect(executor(attempt())).resolves.toMatchObject({ state: "converged" });
    expect(client.calls).not.toContain("steer");
    expect(client.calls).not.toContain("interrupt");
  });

  it.each(["quiet", "active", "startup"])("ends %s work at the whole execution budget", async (mode) => {
    const client = new FakeClient("thread-budget");
    const pending = Promise.withResolvers<never>();
    if (mode === "startup") client.initialize = () => pending.promise;
    else client.waitForGoal = () => pending.promise;
    client.stop = async () => {
      client.calls.push("stop");
      pending.reject(new Error("client stopped"));
    };
    const updates =
      mode === "active"
        ? setInterval(() => client.emit({ method: "turn/started", params: { turn: { id: "turn-1" } } }), 5)
        : undefined;
    try {
      await expect(
        createCodexGoalExecutor({
          stateFile: join(fixtureRoot(), "bindings.json"),
          createClient: () => client,
          turnTimeoutMs: 40,
        })(attempt()),
      ).rejects.toThrow("execution timed out after 40ms");
      expect(client.calls).toContain("stop");
      expect(client.calls).not.toContain("steer");
    } finally {
      clearInterval(updates);
    }
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
          item: { id: "message-1", type: "agentMessage", phase: "commentary", text: "Reviewing current facts." },
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
    const executor = createCodexGoalExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
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
    const executor = createCodexGoalExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
    });

    const result = await executor(
      attempt({
        async publish() {
          throw new Error("event store unavailable");
        },
      }),
    );

    expect(result.state).toBe("converged");
    expect(result.facts).toContain("codex-progress-events:degraded failed=1 last=event store unavailable");
  });

  it("delivers queued steering without treating transport success as incorporated Task input", async () => {
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
                  summary: "Prepared the original draft.",
                  facts: ["draft:original"],
                }),
              },
            ],
          },
        ],
      },
    });
    const executor = createCodexGoalExecutor({
      stateFile: join(root, "bindings.json"),
      createClient: () => client,
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
    expect(accepted).toBeFalse();
  });
});
