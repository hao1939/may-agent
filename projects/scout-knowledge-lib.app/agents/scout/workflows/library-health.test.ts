import { afterEach, describe, expect, it } from "bun:test";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  acceptedSourceOutputsMetricDefinition,
  buildLibraryHealthPacket,
  execute,
  KNOWLEDGE_PREAMBLE_COVERAGE_METRIC_ID,
  knowledgePreambleCoverage,
  type LibraryHealthPacket,
} from "./library-health";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture(): { appDir: string; projectDir: string } {
  const root = mkdtempSync(join(tmpdir(), "scout-library-health-"));
  roots.push(root);
  const appDir = join(root, "scout.app");
  const projectDir = join(root, "scout");
  mkdirSync(join(appDir, "agents", "scout", "workspace", "digest"), {
    recursive: true,
  });
  mkdirSync(join(projectDir, "knowledge"), { recursive: true });
  mkdirSync(join(projectDir, "reports"), { recursive: true });
  writeFileSync(join(projectDir, "knowledge", "README.md"), "# Knowledge\n");
  writeFileSync(join(projectDir, "knowledge", "INDEX.md"), "# Index\n");
  writeFileSync(
    join(appDir, "agents", "scout", "workspace", "digest", "today.md"),
    "# Today\n",
  );
  return { appDir, projectDir };
}

function saveHistory(appDir: string, packet: LibraryHealthPacket): void {
  const stateDir = join(appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  appendFileSync(
    join(stateDir, "library-health-packets.jsonl"),
    `${JSON.stringify(packet)}\n`,
  );
}

function oversizedNote(projectDir: string, lines: number): void {
  writeFileSync(
    join(projectDir, "knowledge", "large.md"),
    Array.from({ length: lines }, () => "line").join("\n"),
  );
}

describe("Scout library-health observer", () => {
  it("keeps signals due when event publication fails", async () => {
    const paths = fixture();
    oversizedNote(paths.projectDir, 801);
    const ctx = createTestAppWorkflowContext({
      input: {},
      workspace: {
        appRoot: paths.appDir,
        projectRoot: paths.projectDir,
        root: paths.projectDir,
        output: join(paths.appDir, ".state", "output"),
      },
    });
    ctx.events.emit = async () => {
      throw new Error("publication unavailable");
    };
    await expect(execute(ctx)).rejects.toThrow("publication unavailable");
    const due = buildLibraryHealthPacket(paths);
    expect(due.wake_signals).toContainEqual(
      expect.objectContaining({
        key: "oversized-canonical-note:knowledge/large.md",
      }),
    );

    const published: Parameters<typeof ctx.events.emit>[0][] = [];
    ctx.events.emit = async (event) => {
      published.push(event);
    };
    expect((await execute(ctx)).status).toBe("done");
    expect(published).toHaveLength(1);
    expect(published[0].data?.wakeSignals).toContainEqual(
      expect.objectContaining({
        key: "oversized-canonical-note:knowledge/large.md",
      }),
    );
    expect(buildLibraryHealthPacket(paths).wake_signals).toEqual([]);
  });

  it("replays one admitted tick with byte-stable publication and history identity", async () => {
    const paths = fixture();
    oversizedNote(paths.projectDir, 801);
    const emitted: Parameters<
      ReturnType<typeof createTestAppWorkflowContext>["events"]["emit"]
    >[0][] = [];
    const publications = new Map<
      string,
      Parameters<
        ReturnType<typeof createTestAppWorkflowContext>["events"]["emit"]
      >[0]
    >();
    const run = (eventId: number, observedAt: string) =>
      execute(
        createTestAppWorkflowContext({
          input: {},
          reconciliation: {
            appId: "scout-knowledge-lib",
            taskId: "runtime/library-health-observer",
            generation: 1,
            resourceVersion: 1,
            agent: "scout",
            outcome: "Observe library health",
            acceptance: ["Publish one bounded observation"],
            input: {},
            children: { live: [], completed: [] },
            events: {
              throughEventId: eventId,
              truncated: false,
              items: [
                {
                  eventId,
                  observedAt,
                  event: { type: "project.library_health.tick", data: {} },
                },
              ],
            },
          },
          workspace: {
            appRoot: paths.appDir,
            projectRoot: paths.projectDir,
            root: paths.projectDir,
            output: join(paths.appDir, ".state", "output"),
          },
          emit: async (event) => {
            const key = `${event.type}:${event.localKey}`;
            const prior = publications.get(key);
            if (
              prior &&
              JSON.stringify(prior.data) !== JSON.stringify(event.data)
            )
              throw new Error("same key with different data");
            publications.set(key, event);
            emitted.push(event);
          },
          readEvent: async (type, localKey) => {
            const event = publications.get(`${type}:${localKey}`);
            return event ? { eventId: 1, data: event.data ?? {} } : null;
          },
        }),
      );

    await run(41, "2026-07-20T00:00:00.000Z");
    // Change the observed filesystem before retrying the same admitted input.
    writeFileSync(join(paths.projectDir, "knowledge", "README.md"), "");
    await run(41, "2026-07-20T00:00:00.000Z");
    expect(emitted).toHaveLength(1);
    const historyPath = join(
      paths.appDir,
      ".state",
      "library-health-packets.jsonl",
    );
    expect(readFileSync(historyPath, "utf8").trim().split("\n")).toHaveLength(
      1,
    );

    await run(42, "2026-07-20T06:00:00.000Z");
    expect(emitted[1]?.localKey).not.toBe(emitted[0]?.localKey);
    expect(emitted[1]?.data?.wakeCount).toBe(0);
    expect(readFileSync(historyPath, "utf8").trim().split("\n")).toHaveLength(
      2,
    );
  });

  it("recovers a retained publication after its acknowledgement was lost", async () => {
    const paths = fixture();
    oversizedNote(paths.projectDir, 801);
    let retained: Record<string, unknown> | undefined;
    let loseAcknowledgement = true;
    const makeContext = () =>
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "runtime/library-health-observer",
          generation: 1,
          resourceVersion: 1,
          agent: "scout",
          outcome: "Observe library health",
          acceptance: ["Publish one bounded observation"],
          input: {},
          children: { live: [], completed: [] },
          events: {
            throughEventId: 51,
            truncated: false,
            items: [
              {
                eventId: 51,
                observedAt: "2026-07-20T00:00:00.000Z",
                event: { type: "project.library_health.tick", data: {} },
              },
            ],
          },
        },
        workspace: {
          appRoot: paths.appDir,
          projectRoot: paths.projectDir,
          root: paths.projectDir,
          output: join(paths.appDir, ".state", "output"),
        },
        emit: async (event) => {
          retained = event.data ?? {};
          if (loseAcknowledgement) {
            loseAcknowledgement = false;
            throw new Error("lost acknowledgement");
          }
        },
        readEvent: async () =>
          retained ? { eventId: 1, data: retained } : null,
      });

    await expect(execute(makeContext())).rejects.toThrow(
      "lost acknowledgement",
    );
    writeFileSync(join(paths.projectDir, "knowledge", "README.md"), "");
    expect((await execute(makeContext())).status).toBe("done");
    const lines = readFileSync(
      join(paths.appDir, ".state", "library-health-packets.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).wake_signals).toContainEqual(
      expect.objectContaining({
        key: "oversized-canonical-note:knowledge/large.md",
      }),
    );
  });

  it("uses the publication key as history identity for wrapped inputs without numeric event ids", async () => {
    const paths = fixture();
    const publications = new Map<string, Record<string, unknown>>();
    const makeContext = () =>
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "runtime/library-health-observer",
          generation: 1,
          resourceVersion: 1,
          agent: "scout",
          outcome: "Observe library health",
          acceptance: ["Publish one bounded observation"],
          input: {},
          children: { live: [], completed: [] },
          events: {
            truncated: false,
            items: [
              {
                observedAt: "2026-07-20T00:00:00.000Z",
                event: {
                  type: "app.task.requested",
                  data: {
                    request: { input: { kind: "library-health", data: {} } },
                  },
                },
              },
            ],
          },
        },
        workspace: {
          appRoot: paths.appDir,
          projectRoot: paths.projectDir,
          root: paths.projectDir,
          output: join(paths.appDir, ".state", "output"),
        },
        emit: async (event) => {
          publications.set(`${event.type}:${event.localKey}`, event.data ?? {});
        },
        readEvent: async (type, localKey) => {
          const data = publications.get(`${type}:${localKey}`);
          return data ? { eventId: 1, data } : null;
        },
      });

    await execute(makeContext());
    await execute(makeContext());
    expect(
      readFileSync(
        join(paths.appDir, ".state", "library-health-packets.jsonl"),
        "utf8",
      )
        .trim()
        .split("\n"),
    ).toHaveLength(1);
  });

  it("does not invent history for a retained legacy publication", async () => {
    const paths = fixture();
    const result = await execute(
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "runtime/library-health-observer",
          generation: 1,
          resourceVersion: 1,
          agent: "scout",
          outcome: "Observe library health",
          acceptance: ["Publish one bounded observation"],
          input: {},
          children: { live: [], completed: [] },
          events: { throughEventId: 61, items: [], truncated: false },
        },
        workspace: {
          appRoot: paths.appDir,
          projectRoot: paths.projectDir,
          root: paths.projectDir,
          output: join(paths.appDir, ".state", "output"),
        },
        readEvent: async () => ({
          eventId: 1,
          data: {
            project: "scout-knowledge-lib",
            packetPath: "/old/path.jsonl",
            factCount: 1,
            wakeCount: 1,
            wakeSignals: [
              { key: "human-navigation-missing:knowledge/README.md" },
            ],
          },
        }),
      }),
    );
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        facts: expect.arrayContaining([
          "history:legacy-publication-packet-unavailable",
        ]),
      },
    });
    expect(
      existsSync(join(paths.appDir, ".state", "library-health-packets.jsonl")),
    ).toBe(false);
  });

  it("retires the obsolete JSON output metric when the observer runs", async () => {
    const paths = fixture();
    const ctx = createTestAppWorkflowContext({
      input: {},
      workspace: {
        appRoot: paths.appDir,
        projectRoot: paths.projectDir,
        root: paths.projectDir,
        output: join(paths.appDir, ".state", "output"),
      },
    });
    const definitions: Parameters<typeof ctx.metrics.define>[0][] = [];
    ctx.metrics.define = (definition) => {
      definitions.push(definition);
    };

    const result = await execute(ctx);
    const definition = acceptedSourceOutputsMetricDefinition();

    expect(result.status).toBe("done");
    expect(definitions).toContainEqual(definition);
    expect(definition.status).toBe("retired");
    expect(definition).not.toHaveProperty("sourceCommand");
    expect(definition).not.toHaveProperty("threshold");
    expect(definitions).toContainEqual(
      expect.objectContaining({
        id: KNOWLEDGE_PREAMBLE_COVERAGE_METRIC_ID,
        status: "active",
      }),
    );
  });

  it("owns and records canonical knowledge preamble coverage", async () => {
    const paths = fixture();
    writeFileSync(
      join(paths.projectDir, "knowledge", "README.md"),
      "<ai_context>\nsummary: navigation\n</ai_context>\n",
    );
    expect(knowledgePreambleCoverage(paths.projectDir)).toEqual({
      value: 0.5,
      sampleSize: 2,
    });
    const records: Array<{
      id: string;
      value: number;
      options?: { sampleSize?: number; measuredBy?: string };
    }> = [];
    await execute(
      createTestAppWorkflowContext({
        input: {},
        workspace: {
          appRoot: paths.appDir,
          projectRoot: paths.projectDir,
          root: paths.projectDir,
          output: join(paths.appDir, ".state", "output"),
        },
        recordMetric: async (id, value, options) => {
          records.push({
            id,
            value,
            options: options as (typeof records)[number]["options"],
          });
        },
      }),
    );
    expect(records).toContainEqual({
      id: KNOWLEDGE_PREAMBLE_COVERAGE_METRIC_ID,
      value: 0.5,
      options: {
        sampleSize: 2,
        measuredBy: "workflow:library-health",
      },
    });
  });

  it("wakes for a new fact but not for the same fact in the next packet", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    oversizedNote(paths.projectDir, 801);

    const first = buildLibraryHealthPacket({ ...paths, now });
    expect(first.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: true,
      reason: "new",
    });

    saveHistory(paths.appDir, first);
    const second = buildLibraryHealthPacket({
      ...paths,
      now: now + 6 * 60 * 60_000,
    });
    expect(second.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: false,
      reason: "unchanged",
    });
  });

  it("wakes when a numeric fact becomes materially worse", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    oversizedNote(paths.projectDir, 801);
    saveHistory(paths.appDir, buildLibraryHealthPacket({ ...paths, now }));

    oversizedNote(paths.projectDir, 901);
    const packet = buildLibraryHealthPacket({
      ...paths,
      now: now + 6 * 60 * 60_000,
    });

    expect(packet.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: true,
      reason: "worse",
    });
  });

  it("wakes for a fact that remains present when its review interval expires", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    oversizedNote(paths.projectDir, 801);
    saveHistory(paths.appDir, buildLibraryHealthPacket({ ...paths, now }));

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: now + 7 * 24 * 60 * 60_000,
    });

    expect(packet.wake_decisions).toContainEqual({
      key: "oversized-canonical-note:knowledge/large.md",
      wake: true,
      reason: "review-due",
    });
  });

  it("ignores future dates in runtime task history", () => {
    const paths = fixture();
    mkdirSync(join(paths.appDir, ".state", "tasks"), { recursive: true });
    writeFileSync(
      join(paths.appDir, ".state", "tasks", "tree.json"),
      JSON.stringify({ summary: "forecast for 2099-01-01" }),
    );

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-20T00:00:00.000Z"),
    });

    expect(
      packet.facts.some((fact) => fact.kind === "future-dated-library-truth"),
    ).toBe(false);
  });

  it("reports an explicit future truth field in canonical knowledge", () => {
    const paths = fixture();
    writeFileSync(
      join(paths.projectDir, "knowledge", "topic.md"),
      "<ai_context>\nlast_updated: 2026-07-21\n</ai_context>\n",
    );

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-20T00:00:00.000Z"),
    });

    expect(packet.facts).toContainEqual(
      expect.objectContaining({
        key: "future-dated-library-truth:knowledge/topic.md:last_updated",
        observedValue: "2026-07-21",
      }),
    );
  });

  it("wakes when an existing future truth date moves farther forward", () => {
    const paths = fixture();
    const now = Date.parse("2026-07-20T00:00:00.000Z");
    const path = join(paths.projectDir, "knowledge", "topic.md");
    writeFileSync(path, "last_updated: 2026-07-21\n");
    saveHistory(paths.appDir, buildLibraryHealthPacket({ ...paths, now }));

    writeFileSync(path, "last_updated: 2026-07-22\n");
    const packet = buildLibraryHealthPacket({
      ...paths,
      now: now + 6 * 60 * 60_000,
    });

    expect(packet.wake_decisions).toContainEqual({
      key: "future-dated-library-truth:knowledge/topic.md:last_updated",
      wake: true,
      reason: "worse",
    });
  });

  it("reports one exact artifact identity mapped to distinct titles", () => {
    const paths = fixture();
    const findingsDir = join(paths.projectDir, "knowledge", "findings");
    mkdirSync(findingsDir, { recursive: true });
    writeFileSync(
      join(findingsDir, "github-536.md"),
      [
        "---",
        'title: "GitHub Scan #536 — Agent Memory Encryption"',
        "source: github",
        "date: 2026-07-20",
        "---",
      ].join("\n"),
    );
    writeFileSync(
      join(paths.appDir, "agents", "scout", "workspace", "digest", "today.md"),
      [
        "# Today",
        "## GitHub Scan #536 — Agent Memory Encryption (2026-07-20)",
        "## GitHub Scan #536 — Exo-Agent Control (2026-07-20)",
      ].join("\n"),
    );

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-20T00:00:00.000Z"),
    });

    expect(packet.facts).toContainEqual(
      expect.objectContaining({
        key: "artifact-identity-collision:github:2026-07-20:536",
        observedValue: 2,
        evidence: expect.objectContaining({
          findingPaths: ["knowledge/findings/github-536.md"],
          titles: [
            "GitHub Scan #536 — Agent Memory Encryption",
            "GitHub Scan #536 — Exo-Agent Control",
          ],
        }),
      }),
    );
  });

  it("publishes one actionable observation for a new identity collision", async () => {
    const paths = fixture();
    writeFileSync(
      join(paths.appDir, "agents", "scout", "workspace", "digest", "today.md"),
      [
        "## GitHub Scan #536 — First title (2026-07-20)",
        "## GitHub Scan #536 — Second title (2026-07-20)",
      ].join("\n"),
    );
    const emitted: Record<string, unknown>[] = [];

    const result = await execute(
      createTestAppWorkflowContext({
        input: {},
        reconciliation: {
          appId: "scout-knowledge-lib",
          taskId: "runtime/library-health-observer",
          generation: 1,
          resourceVersion: 27,
          agent: "scout",
          outcome: "Observe library health",
          acceptance: ["Publish one bounded observation"],
          input: {},
          children: { live: [], completed: [] },
          events: { throughEventId: 5925532, items: [] },
        },
        workspace: {
          appRoot: paths.appDir,
          projectRoot: paths.projectDir,
          root: paths.projectDir,
          output: join(paths.appDir, ".state", "output"),
        },
        emit: async (event) => {
          emitted.push(event as unknown as Record<string, unknown>);
        },
      }),
    );

    expect(emitted).toHaveLength(1);
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: "project.library_health.observed",
        localKey: "event-5925532:library-health-observed",
        data: expect.objectContaining({
          wakeCount: 2,
          wakeSignals: expect.arrayContaining([
            expect.objectContaining({
              key: "artifact-identity-collision:github:2026-07-20:536",
            }),
          ]),
        }),
      }),
    );
    expect(emitted).not.toContainEqual(
      expect.objectContaining({ type: "project.owner.requested" }),
    );
    expect(result).toMatchObject({
      status: "done",
      output: { state: "converged" },
    });
  });

  it("checks the most recent archived digest across rollover", () => {
    const paths = fixture();
    const digestDir = join(
      paths.appDir,
      "agents",
      "scout",
      "workspace",
      "digest",
    );
    writeFileSync(
      join(digestDir, "today.md"),
      "## HN Scan #3 — Current title (2026-07-20)\n",
    );
    writeFileSync(
      join(digestDir, "2026-07-19.md"),
      "## HN Scan #2 — Older archive (2026-07-19)\n",
    );
    writeFileSync(
      join(digestDir, "2026-07-20.md"),
      "## HN Scan #3 — Replaced title (2026-07-20)\n",
    );

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-21T00:00:00.000Z"),
    });

    expect(packet.facts).toContainEqual(
      expect.objectContaining({
        key: "artifact-identity-collision:hn:2026-07-20:3",
        observedValue: 2,
      }),
    );
  });

  it("checks the latest content-addressed snapshot by time, not hash order", () => {
    const paths = fixture();
    const digestDir = join(
      paths.appDir,
      "agents",
      "scout",
      "workspace",
      "digest",
    );
    writeFileSync(
      join(digestDir, "today.md"),
      "## HN Scan #3 — Current title (2026-07-20)\n",
    );
    for (const [name, content, time] of [
      ["2026-07-19.md", "Older dated archive", 1],
      [`digest-${"f".repeat(64)}.md`, "Older content snapshot", 2],
      [
        `digest-${"a".repeat(64)}.md`,
        "## HN Scan #3 — Replaced title (2026-07-20)\n",
        3,
      ],
    ] as const) {
      const path = join(digestDir, name);
      writeFileSync(path, content);
      utimesSync(path, time, time);
    }

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-21T00:00:00.000Z"),
    });

    expect(packet.facts).toContainEqual(
      expect.objectContaining({
        key: "artifact-identity-collision:hn:2026-07-20:3",
        observedValue: 2,
      }),
    );
  });

  it("allows the same explicit identity and title to appear more than once", () => {
    const paths = fixture();
    const digestDir = join(
      paths.appDir,
      "agents",
      "scout",
      "workspace",
      "digest",
    );
    const heading = "## GitHub Scan #536 — Same title (2026-07-20)\n";
    writeFileSync(join(digestDir, "today.md"), heading);
    writeFileSync(join(digestDir, "2026-07-20.md"), heading);

    const packet = buildLibraryHealthPacket({
      ...paths,
      now: Date.parse("2026-07-21T00:00:00.000Z"),
    });

    expect(
      packet.facts.some((fact) => fact.kind === "artifact-identity-collision"),
    ).toBe(false);
  });

  it("bounds owner signals without delaying the omitted facts' first wake", () => {
    const paths = fixture();
    for (let index = 0; index < 60; index += 1) {
      writeFileSync(
        join(
          paths.projectDir,
          "knowledge",
          `2099-01-${String((index % 28) + 1).padStart(2, "0")}-${index}.md`,
        ),
        "# Future\n",
      );
    }

    const now = Date.parse("2026-07-20T00:00:00.000Z");
    let packet = buildLibraryHealthPacket({ ...paths, now });

    expect(packet.facts.length).toBeLessThanOrEqual(50);
    expect(packet.facts.length).toBeGreaterThan(16);
    expect(packet.wake_signals.length).toBe(16);
    expect(packet.truncated).toBe(true);

    const facts = packet.facts;
    const selected = new Set(packet.wake_signals.map((fact) => fact.key));
    for (let scan = 1; scan <= Math.ceil(facts.length / 16); scan += 1) {
      saveHistory(paths.appDir, packet);
      packet = buildLibraryHealthPacket({
        ...paths,
        now: now + scan * 6 * 60 * 60_000,
      });
      const expected = facts
        .filter((fact) => !selected.has(fact.key))
        .slice(0, 16);
      expect(packet.wake_signals).toEqual(expected);
      for (const fact of packet.wake_signals) selected.add(fact.key);
    }
    expect(selected.size).toBe(facts.length);
    expect(packet.wake_signals).toEqual([]);
  });
});
