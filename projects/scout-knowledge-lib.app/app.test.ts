import { describe, expect, it } from "bun:test";
import { Check } from "typebox/value";
import { matchesEventSelector } from "@may-agent/sdk";
import app, {
  evaluationOwnerRequestedInput,
  libraryHealthObservedInput,
  resolveScoutTask,
  taskForScoutInput,
} from "./app";

describe("Scout task reconciliation", () => {
  it("assigns bounded goals through typed input with stable admission identity", () => {
    const input = {
      id: "request-repair",
      appId: "scout-knowledge-lib",
      source: { kind: "app" as const, id: "scout" },
      input: {
        kind: "goal",
        data: {
          outcome: "Repair library navigation",
          acceptance: ["Links resolve"],
          context: "Keep unrelated notes intact",
        },
      },
    };
    const first = taskForScoutInput(input);
    expect(first).toEqual(taskForScoutInput(input));
    expect(first).toMatchObject({
      kind: "desired",
      intent: {
        id: "goal/request-repair",
        workflow: "knowledge-planner",
        outcome: "Repair library navigation",
        acceptance: ["Links resolve"],
        input: input.input,
      },
    });
    expect(taskForScoutInput({ ...input, id: "another-request" })).not.toEqual(
      first,
    );
    expect(() =>
      taskForScoutInput({
        ...input,
        input: { kind: "goal", data: { outcome: "Repair", acceptance: [] } },
      }),
    ).toThrow("outcome and acceptance");
  });
  it("rejects incomplete goals and malformed scans at admission and mapping", () => {
    for (const data of [
      {},
      { source: "unknown" },
      { source: "arxiv", url: "https://example.org/paper" },
    ]) {
      expect(Check(app.inputSchema, { kind: "explore", data })).toBe(false);
    }
    for (const data of [
      {},
      { outcome: "Read", acceptance: [] },
      { outcome: "  ", acceptance: ["Saved"] },
    ]) {
      expect(Check(app.inputSchema, { kind: "goal", data })).toBe(false);
    }
    for (const data of [{}, { source: "unknown" }]) {
      expect(() =>
        taskForScoutInput({
          id: "bad-scan",
          source: { kind: "app", id: "may" },
          input: { kind: "explore", data },
        }),
      ).toThrow("Scout explore requires source");
    }
    expect(Check(app.inputSchema, { kind: "digest", data: {} })).toBe(true);
    expect(app.actions?.["explore-now"]?.toInput({})).toEqual({
      kind: "explore",
      data: { source: "arxiv" },
    });
    const input = {
      kind: "goal",
      data: {
        outcome: "Assess the exact source and save the result",
        acceptance: ["Read source and return the verified assessment path"],
        constraints: ["Archive even when no new knowledge"],
        context: [
          {
            required: true,
            purpose: "Source",
            url: "https://example.org/paper",
            version: "v2",
          },
        ],
      },
    };
    expect(Check(app.inputSchema, input)).toBe(true);
    expect(
      taskForScoutInput({
        id: "paper",
        source: { kind: "app", id: "may" },
        input,
      }),
    ).toMatchObject({
      kind: "desired",
      intent: {
        workflow: "knowledge-planner",
        input,
        outcome: input.data.outcome,
        acceptance: input.data.acceptance,
      },
    });
  });

  it("preserves addressed owner review without turning unknown facts into work", () => {
    const input = {
      kind: "owner-review",
      data: {
        reason: "new-library-concern",
        message: "Assess the duplicate source records",
      },
    };
    expect(Check(app.inputSchema, input)).toBe(true);
    expect(
      taskForScoutInput({
        id: "review",
        source: { kind: "app", id: "may" },
        input,
      }),
    ).toMatchObject({
      kind: "desired",
      intent: { id: "input/review", workflow: "knowledge-planner", input },
    });
    expect(
      resolveScoutTask({ type: "project.owner.requested", data: input.data }),
    ).toBeNull();
  });

  it("makes source guidance discoverable from Scout's active instructions", async () => {
    const agentRoot = new URL("./agents/scout/", import.meta.url);
    const identity = await Bun.file(new URL("AGENTS.md", agentRoot)).text();
    const context = await Bun.file(new URL("context.md", agentRoot)).text();
    const config = await Bun.file(new URL("agent.json", agentRoot)).json();

    expect(identity).toContain("[context.md](context.md)");
    expect(context).toContain("## Source Access");
    expect(context).toContain("`python3`");
    expect(config).not.toHaveProperty("context_files");
  });

  it("keeps digest-link preservation in Scout's active instructions", async () => {
    const identity = await Bun.file(
      new URL("./agents/scout/AGENTS.md", import.meta.url),
    ).text();

    expect(identity).toContain("Before moving or renaming a file or section");
    expect(identity).toContain("working digest, and retained digest snapshots");
    expect(identity).toContain("research content in one place");
    expect(identity).toContain(
      "Link each new digest highlight to its research note",
    );
    expect(identity).toContain("use a file link when no stable section");
  });

  it("maps each source to an independent standing maintain task", () => {
    for (const source of ["arxiv", "hn", "xhs", "github", "reddit"]) {
      expect(
        resolveScoutTask({
          type: "scout.explore",
          project: "scout-knowledge-lib",
          source,
        }),
      ).toMatchObject({
        id: `explore-${source}`,
        parentId: "ongoing-research",
        workflow: "scout-explore",
        input: { source },
        outputs: [
          "/app/projects/scout-knowledge-lib/knowledge",
          "/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md",
        ],
      });
    }
  });

  it("exposes every supported source through manual exploration", () => {
    const action = app.actions?.["explore-now"];
    expect(action?.description).toContain("reddit");
    expect(JSON.stringify(action?.inputSchema)).toContain('"const":"reddit"');
    expect(action?.toInput({ source: "reddit" })).toEqual({
      kind: "explore",
      data: { source: "reddit" },
    });
  });

  it("keeps the domain research source when the Host stamps a producer source", () => {
    expect(
      resolveScoutTask({
        type: "scout.explore",
        source: "app:scout-knowledge-lib:schedule:scout-explore-hn",
        data: { project: "scout-knowledge-lib", source: "hn" },
      }),
    ).toMatchObject({
      id: "explore-hn",
      workflow: "scout-explore",
      input: { source: "hn" },
    });
  });

  it("rejects malformed source exploration instead of creating a task", () => {
    expect(
      resolveScoutTask({ type: "scout.explore", source: "unknown" }),
    ).toBeNull();
  });

  it("binds recurring responsibilities to stable task identities", () => {
    expect(resolveScoutTask({ type: "scout.digest" })).toMatchObject({
      id: "daily-digest",
      workflow: "scout-daily-digest",
    });
    expect(
      resolveScoutTask({ type: "project.library_health.tick" }),
    ).toMatchObject({
      id: "runtime/library-health-observer",
      parentId: "library-operations",
      workflow: "library-health",
    });
    expect(
      resolveScoutTask({ type: "scout.digest", eventId: 1 })?.input,
    ).toBeUndefined();
    expect(
      resolveScoutTask({ type: "scout.digest", eventId: 2 })?.input,
    ).toBeUndefined();
  });

  it("uses the same digest Task for an explicit request and the schedule", () => {
    const input = app.actions?.["digest-now"]?.toInput({});
    expect(input).toEqual({ kind: "digest", data: {} });
    const admitted = { id: "manual-digest", input } as Parameters<
      typeof taskForScoutInput
    >[0];
    expect(taskForScoutInput(admitted)).toEqual({
      kind: "desired",
      intent: resolveScoutTask({ type: "scout.digest" }),
    });
  });

  it("routes explicit owner requests to the accountable owner workflow", () => {
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        reason: "manual-library-review",
      }),
    ).toMatchObject({
      id: "library-maintenance",
      parentId: "library-operations",
      outputs: [
        "/app/projects/scout-knowledge-lib/knowledge",
        "/app/projects/scout-knowledge-lib/reports",
        "/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md",
      ],
    });
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        reason: "manual-library-review",
      })?.workflow,
    ).toBe("knowledge-planner");
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        project: "scout-knowledge-lib",
        reason: "owner-message",
        inputEventId: 9001,
        inputEventType: "message.created",
      }),
    ).toMatchObject({
      id: "library-maintenance",
      workflow: "knowledge-planner",
    });
  });

  it("replays evaluator owner-request 5815704 through the supported Scout binding", () => {
    const subscription = app.subscriptions?.find(
      ({ id }) => id === "project-owner-request",
    );
    const emitted = {
      type: "project.owner.requested",
      source: "agent:evaluator",
      owner: "project:scout-knowledge-lib",
      data: {
        project: "scout-knowledge-lib",
        reason: "evaluation-session-finding",
        sourceSessionId: "s_1787206167374_411",
        evaluationVerdict: "acceptable",
        finding: {
          targetAppId: "scout-knowledge-lib",
          severity: "concern",
          summary:
            "One removed XHS finding basename remains in the Scout digest.",
          message:
            "Update agents/scout/workspace/digest/today.md:310 to the canonical xhs-coverage-gap-unverified-assessment.md path.",
          evidence: [
            "session s_1787206167374_411 result.json verification claim",
            "/app/projects/scout-knowledge-lib/agents/scout/workspace/digest/today.md:310",
          ],
          dedupeKey: "scout-provenance-repair-stale-cross-reference",
          requestedHumanAction: "none",
        },
      },
    };

    const admitted = evaluationOwnerRequestedInput(emitted);
    expect(subscription?.toInput(emitted)).toEqual(admitted);
    expect(admitted).toMatchObject({
      kind: "owner-review",
      data: {
        reason: "evaluation-session-finding",
        sourceSessionId: "s_1787206167374_411",
        finding: {
          targetAppId: "scout-knowledge-lib",
          dedupeKey: "scout-provenance-repair-stale-cross-reference",
          requestedHumanAction: "none",
        },
      },
    });
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        ...admitted?.data,
      }),
    ).toMatchObject({
      id: "library-maintenance",
      workflow: "knowledge-planner",
    });
  });

  it("leaves malformed, unrelated, and unauthorized evaluator requests visible", () => {
    const valid = {
      type: "project.owner.requested",
      source: "agent:evaluator",
      data: {
        project: "scout-knowledge-lib",
        reason: "evaluation-session-finding",
        sourceSessionId: "s_source",
        finding: {
          targetAppId: "scout-knowledge-lib",
          message: "bounded correction",
          evidence: ["primary proof"],
          dedupeKey: "bounded-correction",
          requestedHumanAction: "none",
        },
      },
    };
    expect(
      evaluationOwnerRequestedInput({ ...valid, source: "agent:other" }),
    ).toBeNull();
    expect(
      evaluationOwnerRequestedInput({
        ...valid,
        data: { ...valid.data, project: "unrelated" },
      }),
    ).toBeNull();
    expect(
      evaluationOwnerRequestedInput({
        ...valid,
        data: {
          ...valid.data,
          finding: { ...valid.data.finding, dedupeKey: "" },
        },
      }),
    ).toBeNull();
    for (const evidence of [[], [""], ["   "], ["primary proof", 42]]) {
      expect(
        evaluationOwnerRequestedInput({
          ...valid,
          data: {
            ...valid.data,
            finding: { ...valid.data.finding, evidence },
          },
        }),
      ).toBeNull();
    }
    expect(app.observations).not.toContain("project.owner.requested");
  });

  it("routes only schema-valid actionable Scout library-health packets", () => {
    const subscription = app.subscriptions?.find(
      ({ id }) => id === "library-health-observed-actionable",
    );
    expect(subscription?.event).toEqual({
      type: "project.library_health.observed",
      project: "scout-knowledge-lib",
      source: "app-task:scout-knowledge-lib",
    });
    const actionable = {
      type: "project.library_health.observed",
      source: "app-task:scout-knowledge-lib",
      owner: "agent:scout",
      data: {
        project: "scout-knowledge-lib",
        packetPath:
          "/app/projects/scout-knowledge-lib.app/.state/library-health-packets.jsonl",
        wakeCount: 1,
        wakeSignals: [{ key: "future:path", fingerprint: "abc123" }],
      },
    };
    expect(subscription).toBeDefined();
    expect(matchesEventSelector(subscription!.event, actionable)).toBe(true);
    for (const source of ["agent:scout", "app-task:other", "external"]) {
      expect(
        matchesEventSelector(subscription!.event, { ...actionable, source }),
      ).toBe(false);
    }
    expect(
      matchesEventSelector(subscription!.event, {
        ...actionable,
        data: { ...actionable.data, project: "other" },
      }),
    ).toBe(false);
    expect(libraryHealthObservedInput(actionable)).toEqual({
      kind: "owner-review",
      data: {
        reason: "library-health-signal",
        packetPath:
          "/app/projects/scout-knowledge-lib.app/.state/library-health-packets.jsonl",
        signalCount: 1,
        signals: [{ key: "future:path", fingerprint: "abc123" }],
        observedEventType: "project.library_health.observed",
      },
    });
    expect(subscription?.toInput(actionable)).toEqual(
      libraryHealthObservedInput(actionable),
    );
  });

  it("keeps non-actionable and malformed library-health facts visible", () => {
    const base = {
      type: "project.library_health.observed",
      source: "app-task:scout-knowledge-lib",
      data: {
        project: "scout-knowledge-lib",
        packetPath: "/tmp/packet.jsonl",
        wakeCount: 0,
        wakeSignals: [],
      },
    };
    expect(libraryHealthObservedInput(base)).toBeNull();
    expect(
      libraryHealthObservedInput({
        ...base,
        data: { ...base.data, wakeCount: 1 },
      }),
    ).toBeNull();
    expect(
      libraryHealthObservedInput({
        ...base,
        data: {
          ...base.data,
          wakeCount: 1,
          wakeSignals: [{ key: "missing-fingerprint" }],
        },
      }),
    ).toBeNull();
    expect(app.observations).not.toContain("project.library_health.observed");
  });

  it("does not broaden the consumer to unknown sources, projects, or signals", () => {
    const subscription = app.subscriptions?.find(
      ({ id }) => id === "library-health-observed-actionable",
    );
    expect(subscription?.event).toMatchObject({
      source: "app-task:scout-knowledge-lib",
      project: "scout-knowledge-lib",
    });
    expect(
      app.subscriptions?.some(
        ({ event }) =>
          typeof event !== "string" &&
          event.type === "project.library_health.observed" &&
          (!event.source || !event.project),
      ),
    ).toBe(false);
    expect(
      app.subscriptions?.some(({ event }) =>
        typeof event === "string"
          ? event === "unrelated.signal"
          : event.type === "unrelated.signal",
      ),
    ).toBe(false);
  });

  it("keeps credential observations with the waiting source Task", () => {
    expect(
      app.subscriptions?.some(
        ({ id, event }) =>
          id === "xhs-credential-attention" ||
          (typeof event !== "string" && event.type === "credential.state"),
      ),
    ).toBe(false);
    expect(app.observers).toContainEqual(
      expect.objectContaining({ id: "xhs-credential", intervalMs: 300_000 }),
    );
    // scout-explore records the first unavailable result and waits on the
    // credential.state Condition. The observer publishes transitions/recovery;
    // maintenance no longer receives every fresh-observer unavailable event.
  });

  it("translates Scout metric breaches into one addressed owner input", () => {
    const subscription = app.subscriptions?.find(
      ({ id }) => id === "scout-metric-breach",
    );
    expect(
      subscription?.toInput({
        type: "metric.breach",
        owner: "agent:scout",
        data: { metricId: "scout.knowledge-practice-loaded", current: 0 },
      }),
    ).toMatchObject({
      kind: "owner-review",
      data: {
        reason: "library-health-signal",
        metric: { metricId: "scout.knowledge-practice-loaded", current: 0 },
      },
    });
    expect(
      subscription?.toInput({
        type: "metric.breach",
        owner: "agent:other",
        data: { metricId: "other.health" },
      }),
    ).toBeNull();
  });

  it("rejects infrastructure and unknown owner wakes", () => {
    for (const reason of [
      "workflow-blocked",
      "handler-unavailable",
      "task-recovery",
      "unknown-owner-reason",
    ]) {
      expect(
        resolveScoutTask({
          type: "project.owner.requested",
          project: "scout-knowledge-lib",
          reason,
        }),
      ).toBeNull();
    }
  });

  it("declares one scoped resolver and relies on workflow discovery", () => {
    expect(app.tasks?.subscriptions).toEqual([
      { type: "scout.explore", project: "scout-knowledge-lib" },
      { type: "scout.digest", project: "scout-knowledge-lib" },
      {
        type: "project.library_health.tick",
        project: "scout-knowledge-lib",
      },
    ]);
    expect(app.tasks?.resolve).toBe(resolveScoutTask);
    expect(app.agent).toBe("scout");
    expect(app.observers).toContainEqual(
      expect.objectContaining({ id: "xhs-credential", intervalMs: 300_000 }),
    );
    expect(app.observations).toEqual(["project.knowledge.maintained"]);
    expect(app).not.toHaveProperty("events");
    expect(app).not.toHaveProperty("onEvent");
    expect(app).not.toHaveProperty("ownerEntry");
    expect(app).not.toHaveProperty("taskWorkflows");
    expect(app).not.toHaveProperty("taskRoutes");
    expect(app).not.toHaveProperty("eventGraph");
  });

  it("keeps routine source demand within the planning envelope", () => {
    const intervals = Object.fromEntries(
      app.schedules.map((schedule) => [schedule.id, schedule.intervalMs]),
    );

    expect(intervals["scout-explore-arxiv"]).toBe(14_400_000);
    expect(intervals["scout-explore-hn"]).toBe(7_200_000);
    expect(intervals["scout-explore-xhs"]).toBe(14_400_000);
    expect(intervals["scout-explore-github"]).toBe(7_200_000);
    expect(intervals["scout-explore-reddit"]).toBe(14_400_000);
    expect(app.tasks?.maxConcurrent).toBe(1);
  });

  it("uses one daily combined owner review", () => {
    const ownerSchedules = app.schedules.filter(
      (schedule) => schedule.id === "owner-review",
    );

    expect(ownerSchedules).toHaveLength(1);
    expect(ownerSchedules[0]).toMatchObject({
      enabled: true,
      intervalMs: 86_400_000,
      event: {
        type: "project.owner.requested",
        target: {
          appId: "scout-knowledge-lib",
          project: "scout-knowledge-lib",
        },
        data: expect.objectContaining({
          project: "scout-knowledge-lib",
          reason: "experience-review",
        }),
      },
    });
    expect(
      app.schedules.some((schedule) => schedule.id === "owner-heartbeat"),
    ).toBe(false);
    expect(
      resolveScoutTask({
        type: "project.owner.requested",
        project: "scout-knowledge-lib",
        reason: "experience-review",
      }),
    ).toMatchObject({
      id: "library-maintenance",
      workflow: "knowledge-planner",
    });
  });
});
