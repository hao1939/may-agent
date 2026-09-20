import { afterAll, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
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
import {
  createTestAppRead,
  createTestAppWorkflowContext,
} from "@may-agent/sdk/testing";
import { publicationTestFixture } from "./lib/publication-test-fixture";
import {
  admitExperienceReviewResult,
  execute,
  isExperienceReview,
} from "./knowledge-planner";

const defaultFixture = publicationTestFixture();
afterAll(() =>
  rmSync(defaultFixture.repositoryRoot, { recursive: true, force: true }),
);

describe("Scout owner reconciliation boundary", () => {
  it("hands recovery procedure and exact retained failure to Scout without replacing Task authority", async () => {
    const fixture = publicationTestFixture();
    const taskId = "goal/recovery-context";
    const archiveRef = "refs/archive/scout-publication/recovery-context";
    const revision = fixture.git("rev-parse", "HEAD");
    const changedPath = "projects/scout-knowledge-lib/knowledge/README.md";
    const procedure =
      "Use a linked writable addendum if the protected original cannot be replaced.";
    const failure =
      "EBUSY: rename temporary publication file to protected canonical destination";
    fixture.git("update-ref", archiveRef, revision);
    let prompt = "";
    try {
      const result = await execute(
        createTestAppWorkflowContext({
          input: { instructions: procedure },
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId,
            generation: 1,
            resourceVersion: 2,
            agent: "scout",
            outcome: "Deliver the accepted candidate",
            acceptance: [
              "The accepted bytes are delivered or honestly waiting",
            ],
            input: {
              kind: "goal",
              data: {
                outcome: "Deliver the accepted candidate",
                acceptance: [
                  "The accepted bytes are delivered or honestly waiting",
                ],
                context: {
                  reason: "accepted-publication-recovery",
                  candidateRef: archiveRef,
                  candidateRevision: revision,
                  changedPaths: [changedPath],
                },
              },
            },
            previousAttempt: {
              attemptId: "attempt-before-recovery",
              generation: 1,
              state: "failed",
              summary: "Publication failed",
              failureReason: "handler-blocked",
              sessionId: "session-before-recovery",
            },
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          read: createTestAppRead({
            tasks: {
              get: async (requestedId: string) => {
                expect(requestedId).toBe(taskId);
                return {
                  id: taskId,
                  status: "pending",
                  generation: 1,
                  summary: "Accepted candidate remains unpublished",
                  facts: [failure],
                  conditions: [],
                } as never;
              },
            } as never,
          }),
          callAgent: (async (_agent, value) => {
            prompt = value;
            return {
              id: "s_recovery_context",
              kind: "agent",
              status: "done",
              summary: "Canonical HEAD already contains the accepted bytes.",
              output: {
                state: "converged",
                summary: "Canonical HEAD already contains the accepted bytes.",
                facts: ["verified archived bytes at canonical HEAD"],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );

      expect(result.status).toBe("done");
      expect(prompt).toContain("Caller procedure context (advisory)");
      expect(prompt).toContain(procedure);
      expect(prompt.indexOf(procedure)).toBeLessThan(
        prompt.indexOf(
          "Canonical reconciliation context (authoritative requirement)",
        ),
      );
      expect(prompt).toContain("Accepted-publication recovery evidence");
      expect(prompt).toContain(failure);
      expect(prompt).toContain("attempt-before-recovery");
      expect(prompt).toContain("session-before-recovery");
      expect(prompt).toContain(
        "Candidate editability does not prove that\n" +
          "the publisher can replace the corresponding canonical destination",
      );
      expect(prompt).toContain(
        "Do not retry an unchanged protected destination merely because archive restoration succeeds",
      );
      expect(result.output?.facts).toEqual(
        expect.arrayContaining([
          `accepted-publication:delivered:${revision}`,
          `published-candidate-path:${changedPath}`,
        ]),
      );
    } finally {
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

  it("preserves plain-string caller procedure input", async () => {
    const fixture = publicationTestFixture();
    const procedure = "Use the reviewed writable destination.";
    let prompt = "";
    try {
      await execute(
        createTestAppWorkflowContext<unknown>({
          input: procedure,
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "goal/string-procedure",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Review library maintenance",
            acceptance: ["Record a bounded decision"],
            input: {
              kind: "goal",
              data: { outcome: "Review library maintenance" },
            },
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          callAgent: (async (_agent, value) => {
            prompt = value;
            return {
              id: "s_string_procedure",
              kind: "agent",
              status: "done",
              summary: "No maintenance required.",
              output: {
                state: "converged",
                summary: "No maintenance required.",
                facts: ["reviewed current library"],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(prompt).toContain("Caller procedure context (advisory)");
      expect(prompt).toContain(procedure);
    } finally {
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

  it("preserves array caller procedure input", async () => {
    const fixture = publicationTestFixture();
    const procedure = [
      "Use the reviewed writable destination.",
      { preserve: "archive and caller identity" },
    ];
    let prompt = "";
    try {
      await execute(
        createTestAppWorkflowContext<unknown>({
          input: procedure,
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "goal/array-procedure",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Review library maintenance",
            acceptance: ["Record a bounded decision"],
            input: {
              kind: "goal",
              data: { outcome: "Review library maintenance" },
            },
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          callAgent: (async (_agent, value) => {
            prompt = value;
            return {
              id: "s_array_procedure",
              kind: "agent",
              status: "done",
              summary: "No maintenance required.",
              output: {
                state: "converged",
                summary: "No maintenance required.",
                facts: ["reviewed current library"],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(prompt).toContain("Caller procedure context (advisory)");
      expect(prompt).toContain("Use the reviewed writable destination.");
      expect(prompt).toContain('"preserve": "archive and caller identity"');
    } finally {
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

  it("makes an unavailable exact recovery read explicit without scanning Tasks", async () => {
    const fixture = publicationTestFixture();
    const revision = fixture.git("rev-parse", "HEAD");
    const archiveRef = "refs/archive/scout-publication/unavailable-context";
    fixture.git("update-ref", archiveRef, revision);
    let prompt = "";
    try {
      await execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "goal/unavailable-recovery-context",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Deliver accepted content",
            acceptance: ["Verify delivery"],
            input: {
              kind: "goal",
              data: {
                context: {
                  reason: "accepted-publication-recovery",
                  candidateRef: archiveRef,
                  candidateRevision: revision,
                  changedPaths: [
                    "projects/scout-knowledge-lib/knowledge/README.md",
                  ],
                },
              },
            },
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          read: createTestAppRead({
            tasks: {
              get: async () => {
                throw new Error("task reporting unavailable");
              },
            } as never,
          }),
          callAgent: (async (_agent, value) => {
            prompt = value;
            return {
              id: "s_unavailable_context",
              kind: "agent",
              status: "done",
              summary: "Verified existing delivery.",
              output: {
                state: "converged",
                summary: "Verified existing delivery.",
                facts: ["verified archived bytes at canonical HEAD"],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(prompt).toContain("unavailable: task reporting unavailable");
      expect(prompt).toContain(
        "Previous attempt link from the reconciliation packet",
      );
    } finally {
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

  it.each(["direct-write", "deleted-reuse"])(
    "does not claim completion for an uncommitted or missing output: %s",
    async (scenario) => {
      const fixture = publicationTestFixture();
      const originalHead = fixture.git("rev-parse", "HEAD");
      try {
        const result = await execute(
          createTestAppWorkflowContext({
            input: {},
            reconciliation: {
              appId: "scout-knowledge-lib",
              taskId: "goal/publication-review",
              generation: 1,
              resourceVersion: 1,
              agent: "scout",
              outcome: "Save a result",
              acceptance: ["Committed readable output"],
              input: {},
              children: { live: [], completed: [] },
              events: { items: [], truncated: false },
            },
            workspace: fixture.workspace,
            callAgent: (async (_agent, prompt) => {
              let output: string;
              if (scenario === "direct-write") {
                output = join(
                  fixture.workspace.projectRoot,
                  "knowledge/direct.md",
                );
                writeFileSync(output, "Uncommitted draft\n");
              } else {
                const candidate = prompt.match(/- Domain workspace: (.+)/)?.[1];
                expect(candidate).toBeDefined();
                output = join(candidate!, "knowledge/README.md");
                rmSync(
                  join(fixture.workspace.projectRoot, "knowledge/README.md"),
                );
              }
              return {
                id: "s_review",
                kind: "agent",
                status: "done",
                summary: "Result prepared",
                output: {
                  state: "converged",
                  summary: "Result prepared",
                  facts: [`output:${output}`],
                  actions: [],
                },
              };
            }) as WorkflowContext["agents"]["call"],
          }),
        );
        expect(result.status).toBe("blocked");
        expect(fixture.git("rev-parse", "HEAD")).toBe(originalHead);
        expect(result).not.toHaveProperty("output.state", "converged");
        if (scenario === "direct-write")
          expect(
            readFileSync(
              join(fixture.workspace.projectRoot, "knowledge/direct.md"),
              "utf8",
            ),
          ).toBe("Uncommitted draft\n");
      } finally {
        rmSync(fixture.repositoryRoot, { recursive: true, force: true });
      }
    },
  );

  it("retains accepted publication through a disjoint in-library workflow advance", async () => {
    const fixture = publicationTestFixture();
    const lock = join(fixture.repositoryRoot, ".git/index.lock");
    try {
      const result = await execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "goal/disjoint-publication",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Save accepted knowledge",
            acceptance: ["Accepted knowledge has durable ownership"],
            input: {},
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          callAgent: (async (_agent, prompt) => {
            const candidate = prompt.match(/- Domain workspace: (.+)/)?.[1];
            expect(candidate).toBeDefined();
            const output = join(candidate!, "knowledge/pending.md");
            writeFileSync(output, "Accepted finding\n");
            const independent = join(
              fixture.workspace.projectRoot,
              "knowledge/independent.md",
            );
            writeFileSync(independent, "Independent publication\n");
            fixture.git(
              "add",
              "projects/scout-knowledge-lib/knowledge/independent.md",
            );
            fixture.git("commit", "-m", "independent publication");
            writeFileSync(lock, "other writer\n");
            return {
              id: "s_disjoint",
              kind: "agent",
              status: "done",
              summary: "Accepted finding",
              output: {
                state: "converged",
                summary: "Accepted finding",
                facts: [`output:${output}`],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(result).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          dependencies: [
            {
              appId: "scout-knowledge-lib",
              input: {
                kind: "goal",
                data: {
                  context: {
                    reason: "accepted-publication-recovery",
                    changedPaths: [
                      "projects/scout-knowledge-lib/knowledge/pending.md",
                    ],
                  },
                },
              },
            },
          ],
        },
      });
      const recovery = result.output?.dependencies?.[0];
      expect(recovery?.input.data.context.candidateRef).toStartWith(
        "refs/archive/scout-publication/",
      );
      expect(
        fixture.git(
          "diff-tree",
          "--no-commit-id",
          "--name-only",
          "-r",
          recovery!.input.data.context.candidateRevision,
        ),
      ).toBe("projects/scout-knowledge-lib/knowledge/pending.md");
    } finally {
      rmSync(lock, { force: true });
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

  it("does not promote an incomplete draft after publication fails", async () => {
    const fixture = publicationTestFixture();
    const lock = join(fixture.repositoryRoot, ".git/index.lock");
    try {
      const result = await execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "goal/incomplete-publication",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Review a draft",
            acceptance: ["Only accepted content gains publication ownership"],
            input: {},
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          callAgent: (async (_agent, prompt) => {
            const candidate = prompt.match(/- Domain workspace: (.+)/)?.[1];
            const output = join(candidate!, "knowledge/incomplete.md");
            writeFileSync(output, "Unfinished draft\n");
            writeFileSync(lock, "other writer\n");
            return {
              id: "s_incomplete",
              kind: "agent",
              status: "done",
              summary: "Draft needs more work",
              output: {
                state: "incomplete",
                report: true,
                summary: "Draft needs more work",
                facts: ["not-yet-accepted", `output:${output}`],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(result.status).toBe("blocked");
      expect(result).not.toHaveProperty("output.dependencies");
      expect(result).not.toHaveProperty("output.state", "waiting");
    } finally {
      rmSync(lock, { force: true });
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

  it("preserves independent waiting work when durable archive creation fails", async () => {
    const fixture = publicationTestFixture();
    const lock = join(fixture.repositoryRoot, ".git/index.lock");
    fixture.git("update-ref", "refs/archive/scout-publication", "HEAD");
    const independent = {
      id: "independent-research",
      appId: "scout-knowledge-lib",
      input: {
        kind: "goal",
        data: {
          outcome: "Continue independent research",
          acceptance: ["Return source evidence"],
        },
      },
    };
    try {
      const result = await execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "goal/archive-failure",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Save accepted knowledge and keep independent work",
            acceptance: ["Independent waits survive publication failure"],
            input: {},
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          callAgent: (async (_agent, prompt) => {
            const candidate = prompt.match(/- Domain workspace: (.+)/)?.[1];
            const output = join(candidate!, "knowledge/pending.md");
            writeFileSync(output, "Accepted pending content\n");
            writeFileSync(lock, "other writer\n");
            return {
              id: "s_archive_failure",
              kind: "agent",
              status: "done",
              summary: "Accepted content with independent work",
              output: {
                state: "waiting",
                summary: "Accepted content with independent work",
                facts: ["source:accepted", `output:${output}`],
                dependencies: [independent],
                result: { retained: "evidence" },
                report: true,
                continue: true,
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(result).toMatchObject({
        status: "done",
        output: {
          state: "waiting",
          dependencies: [independent],
          result: { retained: "evidence" },
          report: true,
          continue: true,
          facts: expect.arrayContaining([
            "source:accepted",
            "accepted-publication:archive-unavailable",
          ]),
        },
      });
      expect(result.output?.dependencies).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("candidate-ref:");
    } finally {
      rmSync(lock, { force: true });
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

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
          workspace: { ...defaultFixture.workspace },
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

  it("keeps publication accepted when optional research delivery is malformed", async () => {
    const fixture = publicationTestFixture();
    const emitted: Array<Record<string, unknown>> = [];
    const published = join(
      fixture.workspace.projectRoot,
      "knowledge/findings/qualified.md",
    );
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
            outcome: "Maintain the library",
            acceptance: ["Publish one bounded result"],
            input: {},
            children: { live: [], completed: [] },
            events: { items: [], truncated: false },
          },
          workspace: fixture.workspace,
          callAgent: (async (_agent, prompt) => {
            const candidate = prompt.match(/- Domain workspace: (.+)/)?.[1];
            const output = join(candidate!, "knowledge/findings/qualified.md");
            mkdirSync(join(candidate!, "knowledge/findings"), {
              recursive: true,
            });
            writeFileSync(output, "# Qualified finding\n");
            return {
              id: "s_qualified",
              kind: "agent",
              status: "done",
              summary: "Published source record.",
              output: {
                state: "converged",
                summary: "Published source record.",
                facts: [`output:${output}`],
                actions: [],
                result: {
                  researchRecommendation: {
                    sourceUrl: "https://example.test/paper",
                    // sourceRevision is intentionally missing.
                    artifact: published,
                  },
                },
              },
            };
          }) as WorkflowContext["agents"]["call"],
          emit: async (event) => {
            emitted.push(event as unknown as Record<string, unknown>);
          },
        }),
      );
      expect(result.status).toBe("done");
      expect(readFileSync(published, "utf8")).toBe("# Qualified finding\n");
      expect(result.output).toMatchObject({
        state: "converged",
        facts: expect.arrayContaining([
          expect.stringContaining(
            "research-handoff:deferred:Qualified research handoff requires sourceRevision",
          ),
        ]),
      });
      expect(emitted.map((event) => event.type)).toEqual([
        "project.knowledge.maintained",
      ]);
    } finally {
      rmSync(fixture.repositoryRoot, { recursive: true, force: true });
    }
  });

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
        workspace: { ...defaultFixture.workspace },
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
    expect(startList).toMatch(
      /scout-knowledge-candidate-[^/]+\/projects\/scout-knowledge-lib\/knowledge\/README\.md/,
    );
    expect(startList).toContain(
      `${defaultFixture.workspace.appRoot}/tasks/README.md`,
    );
    expect(startList).not.toContain(
      "- /app/projects/scout-knowledge-lib/knowledge/INDEX.md",
    );
    expect(prompt).toMatch(
      /Open .*scout-knowledge-candidate-[^/]+\/projects\/scout-knowledge-lib\/knowledge\/INDEX\.md only when/,
    );
    expect(prompt).toMatch(
      /Open\s+.*scout-knowledge-candidate-[^/]+\/projects\/scout-knowledge-lib\/knowledge\/xhs-topic-map\.md only when/u,
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
    execFileSync("git", ["init", "-b", "main"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.invalid"], {
      cwd: root,
    });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture"], { cwd: root });
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
            output: appRoot,
          },
          callAgent: (async (_agent, prompt) => {
            expect(prompt).toContain("Do not move or rename that file");
            const candidateRoot = prompt.match(/- Domain workspace: (.+)/)?.[1];
            expect(candidateRoot).toBeDefined();
            writeFileSync(
              join(candidateRoot!, published.slice(projectRoot.length + 1)),
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
                facts: [
                  `preserved:${published}`,
                  `output:  ${join(candidateRoot!, published.slice(projectRoot.length + 1))}  `,
                ],
                actions: [],
              },
            };
          }) as WorkflowContext["agents"]["call"],
        }),
      );
      expect(result.status).toBe("done");
      expect(readFileSync(published, "utf8")).toContain("# Descriptive title");
      const commit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      expect(result.output).toMatchObject({
        facts: expect.arrayContaining([
          `publication:commit:${commit}`,
          `published-output:${published}`,
        ]),
      });
      expect(
        execFileSync(
          "git",
          ["status", "--porcelain", "--", "scout/knowledge"],
          { cwd: root, encoding: "utf8" },
        ).trim(),
      ).toBe("");
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
          workspace: { ...defaultFixture.workspace },
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
        workspace: { ...defaultFixture.workspace },
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
        workspace: { ...defaultFixture.workspace },
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
