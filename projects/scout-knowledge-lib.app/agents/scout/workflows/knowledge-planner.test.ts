import { describe, expect, it } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admitTaskReconcileResult, type WorkflowContext } from "@may-agent/sdk";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  admitExperienceReviewResult,
  execute,
  isExperienceReview,
} from "./knowledge-planner";

describe("Scout owner reconciliation boundary", () => {
  it.each([
    { status: "blocked", facts: undefined },
    {
      status: "done",
      facts: { status: "partial", next_steps: "Finish the review" },
    },
  ] as const)(
    "does not publish maintenance facts or actions from an incomplete call: %j",
    async (execution) => {
      const emitted: unknown[] = [];
      const result = await execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "library-maintenance",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Maintain the library",
            acceptance: ["One bounded decision is recorded"],
            input: {},
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: {
            appRoot: "/test/scout.app",
            projectRoot: "/test/scout",
            root: "/test/scout",
            output: "/test/output",
          },
          callAgent: (async () => ({
            id: "s_blocked",
            kind: "agent",
            ...execution,
            summary: "Review not finished",
            output: {
              state: "converged",
              summary: "Partial maintenance plan",
              facts: ["partial"],
              actions: [],
            },
          })) as WorkflowContext["agents"]["call"],
          emit: async (event) => {
            emitted.push(event);
          },
        }),
      );

      expect(result.status).toBe("blocked");
      expect(result.facts).toMatchObject({
        executionId: "s_blocked",
        ...(execution.status === "blocked"
          ? { status: "blocked" }
          : { finish: execution.facts }),
      });
      expect(emitted).toEqual([]);
    },
  );

  it("accepts one bounded Scout goal and rejects obsolete or unbounded creation", () => {
    const dependency = {
      id: "repair",
      appId: "scout-knowledge-lib",
      input: {
        kind: "goal",
        data: { outcome: "Repair navigation", acceptance: ["Links resolve"] },
      },
    };
    const result = {
      state: "waiting",
      summary: "Delegated repair",
      facts: ["broken link"],
      dependencies: [dependency],
    };
    expect(admitExperienceReviewResult(result)).toMatchObject({
      ok: true,
      result,
    });
    expect(
      admitExperienceReviewResult({
        ...result,
        dependencies: [dependency, { ...dependency, id: "second" }],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("at most one"),
    });
    expect(
      admitExperienceReviewResult({
        ...result,
        dependencies: [
          { ...dependency, input: { kind: "owner-review", data: {} } },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Scout goal input"),
    });
    expect(
      admitExperienceReviewResult({
        state: "converged",
        summary: "Old action",
        facts: ["fact"],
        actions: [
          {
            kind: "create-task",
            id: "old",
            outcome: "Repair",
            acceptance: ["links"],
          },
        ],
      }),
    ).toMatchObject({ ok: false });
  });

  it("returns typed task proposals for the generic reconciler", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    let prompt = "";
    let runOptions: Record<string, unknown> | undefined;
    const result = await execute(
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "library-maintenance",
          generation: 1,
          resourceVersion: 1,
          agent: "scout",
          outcome: "Maintain the library",
          acceptance: ["One bounded decision is recorded"],
          input: {},
          children: { live: [], completed: [] },
          events: { items: [], truncated: false },
        },
        workspace: {
          appRoot: "/app/projects/scout-knowledge-lib.app",
          projectRoot: "/app/projects/scout-knowledge-lib",
          root: "/app/projects/scout-knowledge-lib",
          output: "/app/projects/scout-knowledge-lib.app/.state/output",
        },
        callAgent: (async (
          _agent: string,
          value: string,
          options?: Record<string, unknown>,
        ) => {
          prompt = value;
          runOptions = options;
          return {
            id: "s_owner",
            kind: "agent",
            status: "done",
            summary: "proposed maintenance task",
            output: {
              state: "waiting",
              summary: "Proposed one bounded maintenance task.",
              facts: ["library packet identifies the gap"],
              dependencies: [
                {
                  id: "repair-navigation",
                  appId: "scout-knowledge-lib",
                  input: {
                    kind: "goal",
                    data: {
                      outcome: "Repair library navigation",
                      acceptance: ["The landing page links canonical notes"],
                    },
                  },
                },
              ],
            },
          };
        }) as WorkflowContext["agents"]["call"],
        emit: async (event) => {
          emitted.push(event as unknown as Record<string, unknown>);
        },
      }),
    );

    expect(prompt).toContain("Host is the sole task-state mutation authority");
    expect(prompt).toContain("supported\n  task reads");
    expect(prompt).toContain("not current health signals");
    expect(prompt).toContain("block independent library maintenance");
    expect(prompt).toContain(
      "today.md is a mutable accumulator, not an archive",
    );
    expect(prompt).toContain(
      "read the daily-digest Task and its retained snapshot",
    );
    expect(prompt).toContain(
      "not proof that the highlight must still be in today.md",
    );
    expect(prompt).toContain(
      "Do not re-add a highlight merely because handoff cleared it",
    );
    expect(prompt).toContain(
      "never\n  claim a retired artifact was regenerated",
    );
    expect(prompt).toContain(
      "inline relative link at the omission point to the exact retained heading",
    );
    expect(prompt).toContain(
      "file-level mention elsewhere is not a substitute",
    );
    expect(prompt).toContain(
      "every path previously returned in Task/workflow evidence",
    );
    expect(prompt).toContain("keeping the exact delivered path readable");
    const startList = prompt.slice(
      prompt.indexOf("Start by reading:"),
      prompt.indexOf("Valid durable outcomes:"),
    );
    expect(startList).toContain(
      "/app/projects/scout-knowledge-lib/knowledge/README.md",
    );
    expect(startList).toContain(
      "/app/projects/scout-knowledge-lib.app/tasks/README.md",
    );
    expect(startList).not.toContain(
      "- /app/projects/scout-knowledge-lib/knowledge/INDEX.md",
    );
    expect(prompt).toContain(
      "Open /app/projects/scout-knowledge-lib/knowledge/INDEX.md only when",
    );
    expect(prompt).toMatch(
      /Open\s+\/app\/projects\/scout-knowledge-lib\/knowledge\/xhs-topic-map\.md only when/u,
    );
    expect(runOptions?.schema).toBeDefined();
    expect(emitted.at(-1)).toMatchObject({
      type: "project.knowledge.maintained",
      localKey: expect.stringMatching(
        /^knowledge-maintained:fact-[a-f0-9]{16}$/,
      ),
      data: {
        proposedActions: [],
        proposedDependencies: [
          { id: "repair-navigation", appId: "scout-knowledge-lib" },
        ],
      },
    });
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "waiting",
        dependencies: [
          { id: "repair-navigation", appId: "scout-knowledge-lib" },
        ],
      },
    });
    const admitted = admitTaskReconcileResult(
      result.status === "done" ? result.output : undefined,
      { allowNeedsAgent: true },
    );
    expect(admitted.ok && admitted.result.dependencies?.[0]).toMatchObject({
      id: "repair-navigation",
      appId: "scout-knowledge-lib",
      input: { kind: "goal", data: { outcome: "Repair library navigation" } },
    });
  });

  it("keeps an already-published path readable during a controlled maintenance pass", async () => {
    const root = mkdtempSync(join(tmpdir(), "scout-published-path-"));
    const appRoot = join(root, "projects", "scout-knowledge-lib.app");
    const projectRoot = join(root, "projects", "scout-knowledge-lib");
    const published = join(
      projectRoot,
      "knowledge",
      "findings",
      "2026-09-16-source-assessment-59968e7b4159.md",
    );
    mkdirSync(join(appRoot, "agents", "scout", "workspace", "digest"), {
      recursive: true,
    });
    mkdirSync(join(projectRoot, "knowledge", "findings"), { recursive: true });
    writeFileSync(published, "# Old title\n\nSource-grounded assessment.\n");
    try {
      const result = await execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "library-maintenance",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Improve assessment discoverability",
            acceptance: ["Published references remain readable"],
            input: {},
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: {
            appRoot,
            projectRoot,
            root,
            output: join(root, "output"),
          },
          callAgent: (async (_agent, prompt) => {
            expect(prompt).toContain("Do not move or rename that file");
            writeFileSync(
              published,
              "# Descriptive title\n\nSource-grounded assessment.\n",
            );
            return {
              id: "s_maintenance",
              kind: "agent",
              status: "done",
              summary: "Improved title in place.",
              output: {
                state: "converged",
                summary: "Improved title in place.",
                facts: [`preserved:${published}`],
                actions: [],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(result.status).toBe("done");
      expect(readFileSync(published, "utf8")).toContain("# Descriptive title");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps repeated maintenance emissions byte-stable and gives changed facts distinct identities", async () => {
    const emitted: Array<Record<string, unknown>> = [];
    const baseResult = {
      state: "converged" as const,
      summary: "No navigation repair is needed.",
      facts: ["knowledge/README.md exists"],
      actions: [],
    };
    const run = (
      agentOutput: typeof baseResult,
      eventId = 9,
      resourceVersion = 1,
    ) =>
      execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "library-maintenance",
            generation: 1,
            resourceVersion,
            agent: "scout",
            outcome: "Maintain the library",
            acceptance: ["One bounded decision is recorded"],
            input: {},
            children: { live: [], completed: [] },
            events: { items: [], truncated: false, throughEventId: eventId },
          },
          workspace: {
            appRoot: "/app/projects/scout-knowledge-lib.app",
            projectRoot: "/app/projects/scout-knowledge-lib",
            root: "/app/projects/scout-knowledge-lib",
            output: "/app/projects/scout-knowledge-lib.app/.state/output",
          },
          callAgent: (async () => ({
            id: "s_owner",
            kind: "agent",
            status: "done",
            summary: agentOutput.summary,
            output: agentOutput,
          })) as WorkflowContext["agents"]["call"],
          emit: async (event) => {
            emitted.push(event as unknown as Record<string, unknown>);
          },
        }),
      );

    await run(baseResult);
    await run({ ...baseResult }, 9, 10);
    await run({
      ...baseResult,
      summary: "The landing page needs one canonical link.",
      facts: ["knowledge/README.md omits the canonical index"],
    });
    await run(baseResult, 10);

    expect(emitted).toHaveLength(4);
    expect(emitted[0]?.localKey).toBe(emitted[1]?.localKey);
    expect(JSON.stringify(emitted[0]?.data)).toBe(
      JSON.stringify(emitted[1]?.data),
    );
    expect(emitted[2]?.localKey).not.toBe(emitted[0]?.localKey);
    expect(String(emitted[0]?.localKey)).toStartWith(
      "event-9:knowledge-maintained:fact-",
    );
    expect(String(emitted[3]?.localKey)).toStartWith(
      "event-10:knowledge-maintained:fact-",
    );
    expect(emitted[3]?.localKey).not.toBe(emitted[0]?.localKey);
  });

  it("contains a deterministic emission conflict instead of throwing for retry", async () => {
    const result = await execute(
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "library-maintenance",
          generation: 1,
          resourceVersion: 10,
          agent: "scout",
          outcome: "Maintain the library",
          acceptance: ["One bounded decision is recorded"],
          input: {},
          children: { live: [], completed: [] },
          events: { items: [], truncated: false },
        },
        workspace: {
          appRoot: "/app/projects/scout-knowledge-lib.app",
          projectRoot: "/app/projects/scout-knowledge-lib",
          root: "/app/projects/scout-knowledge-lib",
          output: "/app/projects/scout-knowledge-lib.app/.state/output",
        },
        callAgent: (async () => ({
          id: "s_owner",
          kind: "agent",
          status: "done",
          summary: "No maintenance needed.",
          output: {
            state: "converged",
            summary: "No maintenance needed.",
            facts: ["bounded packet is unchanged"],
            actions: [],
          },
        })) as WorkflowContext["agents"]["call"],
        emit: async () => {
          throw new Error(
            "Idempotency key task:key was already used with different event input",
          );
        },
      }),
    );

    expect(result).toMatchObject({
      status: "blocked",
      summary: expect.stringContaining(
        "requires repair rather than immediate retry",
      ),
    });
  });

  it("recognizes wrapped experience-review intent anywhere in a mixed admitted batch", () => {
    const ctx = {
      reconciliation: {
        events: {
          items: [
            {
              observedAt: "2026-09-17T00:00:00.000Z",
              event: {
                type: "project.comment.created",
                data: { reason: "comment" },
              },
            },
            {
              observedAt: "2026-09-17T00:00:01.000Z",
              event: {
                type: "app.task.requested",
                data: {
                  request: {
                    input: {
                      kind: "owner-review",
                      data: { reason: "experience-review" },
                    },
                  },
                },
              },
            },
            {
              observedAt: "2026-09-17T00:00:02.000Z",
              event: {
                type: "project.comment.created",
                data: { reason: "later" },
              },
            },
          ],
        },
      },
    } as WorkflowContext;
    expect(isExperienceReview(ctx)).toBe(true);

    const arbitraryNestedReason = {
      reconciliation: {
        events: {
          items: [
            {
              observedAt: "2026-09-17T00:00:00.000Z",
              event: {
                type: "project.comment.created",
                data: { arbitrary: { reason: "experience-review" } },
              },
            },
          ],
        },
      },
    } as WorkflowContext;
    expect(isExperienceReview(arbitraryNestedReason)).toBe(false);
  });

  it("prepares bounded experience evidence before the owner generation", async () => {
    let prompt = "";
    const result = await execute(
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "library-maintenance",
          generation: 2,
          resourceVersion: 2,
          agent: "scout",
          outcome: "Review library experience",
          acceptance: ["One bounded decision is recorded"],
          input: {},
          children: { live: [], completed: [] },
          events: {
            items: [
              {
                observedAt: "2026-08-21T00:00:00.000Z",
                event: {
                  type: "project.owner.requested",
                  data: {
                    project: "scout-knowledge-lib",
                    reason: "experience-review",
                  },
                },
              },
            ],
            truncated: false,
          },
        },
        workspace: {
          appRoot: "/app/projects/scout-knowledge-lib.app",
          projectRoot: "/app/projects/scout-knowledge-lib",
          root: "/app/projects/scout-knowledge-lib",
          output: "/app/projects/scout-knowledge-lib.app/.state/output",
        },
        callAgent: (async (_agent: string, value: string) => {
          prompt = value;
          return {
            id: "s_review",
            kind: "agent",
            status: "done",
            summary: "No improvement justified.",
            output: {
              state: "converged",
              summary: "No improvement justified.",
              facts: ["experience window contained no reconciliations"],
              actions: [],
            },
          };
        }) as WorkflowContext["agents"]["call"],
      }),
    );

    expect(prompt).toContain("Bounded reconciliation history");
    expect(prompt).toContain("Canonical reconciliation context");
    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged", actions: [] },
    });
  });
});
