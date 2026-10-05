import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  EvidenceStore,
  readPinnedArtifact,
} from "../../../../../../shared/tools/task-evidence.js";
import { readSubjectTask, type PublicCommand } from "./public-task-evidence.js";
import { readPinnedTaskEvidence } from "./pinned-task-evidence.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function archive() {
  const root = await mkdtemp(join(tmpdir(), "evaluation-pinned-"));
  roots.push(root);
  return new EvidenceStore(root);
}
function publicReader(
  result: unknown,
  helperResult: unknown = {},
): PublicCommand {
  return async (command) => {
    if (command.type === "apps.list")
      return { command: "apps.list", apps: [{ id: "may" }] };
    const id = String(command.taskId);
    if (command.type === "app.task.get")
      return {
        command: "app.task.get",
        appId: command.appId,
        taskId: id,
        task: {
          id,
          creator: { appId: "may" },
          generation: 1,
          result: id === "goal/one" ? result : helperResult,
        },
      };
    return {
      command: "task.get",
      task: {
        appId: command.appId,
        taskId: id,
        generation: 1,
        ...(command.acceptedEvidence
          ? { acceptedEvidence: { page: { items: [] } } }
          : {}),
      },
    };
  };
}

describe("pinned Task evidence read-back", () => {
  test("reads development evidence, helper report and raw verification receipt; deduplicates repeated refs", async () => {
    const store = await archive();
    const helper = await store.record(
      {
        executionId: "s_helper",
        command: ["bun", "test"],
        exitCode: 0,
        tests: 7,
      },
      "Helper verified seven cases, not live adoption.",
    );
    const evidence = await store.put(
      JSON.stringify({ reports: [{ stage: "verification", ...helper }] }),
      "json",
    );
    const result = {
      development: { version: 2, evidence, report: helper.report },
      helper: { appId: "may", taskId: "helper/one" },
    };
    const subject = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      publicReader(result, { output: helper.report }),
    );
    const bundle = subject.task!.readBack as Awaited<
      ReturnType<typeof readPinnedTaskEvidence>
    >;
    expect(bundle.artifacts).toHaveLength(3);
    expect(
      bundle.artifacts.every((entry) => entry.status === "read"),
    ).toBeTrue();
    expect(
      bundle.artifacts.find(
        (entry) => entry.reference.path === helper.record.path,
      )?.content,
    ).toContain('"tests": 7');
    expect(bundle.links).toHaveLength(1);
    expect(bundle.links[0]).toMatchObject({
      appId: "may",
      taskId: "helper/one",
      status: "read",
    });
    expect(bundle.gaps).toEqual([]);
  });

  test("attaches current checkpoint validity to the exact linked Task", async () => {
    const reviewAt = Date.now() + 86400000;
    const bundle = await readPinnedTaskEvidence(
      "may",
      "root",
      {
        appTask: { dependsOn: ["child"] },
        detail: {},
      },
      {
        getAppTask: async () => ({
          id: "child",
          conditions: [
            {
              id: "approval",
              observation: { state: "unknown", reviewAt },
            },
          ],
        }),
        getTask: async () => ({ acceptedEvidence: { page: { items: [] } } }),
      },
    );
    expect(bundle.links).toEqual([
      expect.objectContaining({
        appId: "may",
        taskId: "child",
        status: "read",
        validity: {
          phase: "before-due",
          dueAt: reviewAt,
          boundaries: [
            { conditionId: "approval", dueAt: reviewAt, phase: "before-due" },
          ],
        },
      }),
    ]);
  });

  test("pages old accepted attempts to reach pinned artifacts without making history current", async () => {
    const store = await archive();
    const ref = await store.put("old accepted evidence", "md");
    const cursors: string[] = [];
    const bundle = await readPinnedTaskEvidence(
      "may",
      "goal/one",
      { appTask: { id: "goal/one", result: { current: true } }, detail: {} },
      {
        getAppTask: async () => ({ id: "goal/one" }),
        getTask: async (_appId, _taskId, acceptedEvidence) => {
          const cursor = acceptedEvidence?.cursor ?? "";
          cursors.push(cursor);
          return {
            acceptedEvidence: {
              page: cursor
                ? {
                    items: [
                      {
                        appId: "may",
                        taskId: "goal/one",
                        taskGeneration: 1,
                        attemptId: "old-artifact",
                        acceptedResult: { result: { artifacts: [ref] } },
                      },
                    ],
                  }
                : {
                    items: Array.from({ length: 8 }, (_, index) => ({
                      appId: "may",
                      taskId: "goal/one",
                      taskGeneration: 1,
                      attemptId: `later-wait-${index}`,
                      acceptedResult: {
                        state: "waiting",
                        summary: "budget",
                        facts: [],
                      },
                    })),
                    nextCursor: "older",
                  },
            },
          };
        },
      },
    );
    expect(cursors).toEqual(["", "older"]);
    expect(bundle.artifacts).toHaveLength(1);
    expect(bundle.artifacts[0]).toMatchObject({
      status: "read",
      content: "old accepted evidence",
    });
  });

  test("existence is not read-back, and missing-to-readable evidence changes review identity", async () => {
    const store = await archive();
    const ref = await store.put("verified bytes", "md");
    const command = publicReader({ evidence: ref });
    const first = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    await writeFile(ref.path, "claimed recovery");
    const corrupt = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(corrupt.evidenceHash).not.toBe(first.evidenceHash);
    expect((corrupt.task!.readBack as any).artifacts[0]).toMatchObject({
      status: "mismatched",
    });
    expect(
      (corrupt.task!.readBack as any).artifacts[0].content,
    ).toBeUndefined();
    await rm(ref.path);
    const missing = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect((missing.task!.readBack as any).artifacts[0].status).toBe("missing");
    await writeFile(ref.path, "verified bytes");
    const recoveredBytes = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(recoveredBytes.evidenceHash).toBe(first.evidenceHash);
    expect(recoveredBytes.evidenceHash).not.toBe(missing.evidenceHash);
    expect(recoveredBytes).not.toHaveProperty("recovered");
  });

  test("bounds artifact bytes/count and linked reads; records public truncation and unpinned paths", async () => {
    const store = await archive();
    const refs = await Promise.all(
      Array.from({ length: 13 }, (_, index) =>
        store.put(`report ${index}`, "md"),
      ),
    );
    const large = await store.put("x".repeat(32_769), "md");
    const calls: string[] = [];
    const bundle = await readPinnedTaskEvidence(
      "may",
      "goal/one",
      {
        appTask: {
          id: "goal/one",
          dependsOn: ["a", "b", "c", "d", "e"],
          result: { large, refs, unpinned: { path: refs[0]!.path } },
        },
        detail: { historyTruncated: true },
      },
      {
        getAppTask: async (_app, id) => {
          calls.push(id);
          throw new Error("missing");
        },
        getTask: async () => {
          throw new Error("unreachable");
        },
      },
    );
    expect(calls).toEqual(["a", "b", "c", "d"]);
    expect(bundle.artifacts).toHaveLength(12);
    expect(bundle.artifacts[0]).toMatchObject({
      status: "truncated",
      bytes: 32_769,
    });
    expect(bundle.artifacts[0].content).toBeUndefined();
    expect(bundle.gaps.join("\n")).toContain("artifact limit");
    expect(bundle.gaps.join("\n")).toContain("linked-task limit");
    expect(bundle.gaps.join("\n")).toContain(
      "public Task navigation truncated",
    );
    expect(bundle.gaps.join("\n")).toContain("unpinned path not read");
  });

  test("total bytes are bounded and unsafe file kinds are not read", async () => {
    const store = await archive();
    const refs = await Promise.all(
      ["a", "b", "c"].map((char) => store.put(char.repeat(30_000), "md")),
    );
    const bundle = await readPinnedTaskEvidence(
      "may",
      "goal/one",
      { appTask: { result: refs }, detail: {} },
      {
        getAppTask: async () => {
          throw new Error("unexpected");
        },
        getTask: async () => {
          throw new Error("unexpected");
        },
      },
    );
    expect(bundle.artifacts.map((entry) => entry.status)).toEqual([
      "read",
      "read",
      "truncated",
    ]);
    const link = join(store.directory, "link.md");
    await symlink(refs[0]!.path, link);
    expect((await readPinnedArtifact({ ...refs[0]!, path: link })).status).toBe(
      "unavailable",
    );
    expect(
      (
        await readPinnedArtifact({
          path: store.directory,
          sha256: "a".repeat(64),
        })
      ).status,
    ).toBe("unavailable");
    expect(
      (
        await readPinnedArtifact({
          path: "relative.md",
          sha256: "a".repeat(64),
        })
      ).status,
    ).toBe("unavailable");
  });

  test("helper drift changes identity while helper presentation metadata does not", async () => {
    let helperFact = "tests:7";
    let resourceVersion = 1;
    const base = publicReader({
      helper: { appId: "may", taskId: "helper/one" },
    });
    const command: PublicCommand = async (request) => {
      const response = await base(request);
      if (request.taskId === "helper/one") {
        const task = response.task as Record<string, unknown>;
        if (request.type === "app.task.get") task.facts = [helperFact];
        else {
          task.resourceVersion = resourceVersion;
          task.history = [{ eventId: resourceVersion, timestamp: resourceVersion,
            eventType: "project.task.reconcile.skipped" }];
        }
      }
      return response;
    };
    const one = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    resourceVersion++;
    const presentation = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(presentation.evidenceHash).toBe(one.evidenceHash);
    helperFact = "tests:failed";
    const changed = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(changed.evidenceHash).not.toBe(one.evidenceHash);
  });

  test("retains creator navigation without hashing unrelated creator traffic", async () => {
    let creatorFact = "conversation:one";
    const base = publicReader({ complete: true });
    const command: PublicCommand = async (request) => {
      const response = await base(request);
      const task = response.task as Record<string, unknown>;
      if (request.taskId === "goal/one" && request.type === "app.task.get")
        task.creator = { appId: "may", taskId: "conversation/one" };
      if (
        request.taskId === "conversation/one" &&
        request.type === "app.task.get"
      )
        task.facts = [creatorFact];
      return response;
    };
    const first = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    creatorFact = "conversation:unrelated-report-consumed";
    const second = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(second.evidenceHash).toBe(first.evidenceHash);
    expect((second.task!.appTask as any).creator).toEqual({
      appId: "may",
      taskId: "conversation/one",
    });
    expect((second.task!.readBack as any).links).toEqual([]);
  });

  test("an explicit helper reference still follows the same creator Task as evidence", async () => {
    let helperFact = "helper:passed";
    const base = publicReader({
      helper: { appId: "may", taskId: "conversation/one" },
    });
    const command: PublicCommand = async (request) => {
      const response = await base(request);
      const task = response.task as Record<string, unknown>;
      if (request.taskId === "goal/one" && request.type === "app.task.get")
        task.creator = { appId: "may", taskId: "conversation/one" };
      if (
        request.taskId === "conversation/one" &&
        request.type === "app.task.get"
      )
        task.facts = [helperFact];
      return response;
    };
    const first = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect((first.task!.readBack as any).links[0]).toMatchObject({
      appId: "may",
      taskId: "conversation/one",
      status: "read",
      appTask: { facts: [helperFact] },
    });
    helperFact = "helper:failed";
    const changed = await readSubjectTask(
      { appId: "may", taskId: "goal/one" },
      command,
    );
    expect(changed.evidenceHash).not.toBe(first.evidenceHash);
  });

  test("excludes Evaluation links and records exhausted reference navigation", async () => {
    let calls = 0;
    const bundle = await readPinnedTaskEvidence(
      "may",
      "goal/one",
      {
        appTask: {
          result: {
            reviewer: { appId: "evaluation", taskId: "review/one" },
            entries: Array.from({ length: 2_001 }, () => ({})),
          },
        },
        detail: {},
      },
      {
        getAppTask: async () => {
          calls++;
          return {};
        },
        getTask: async () => ({}),
      },
    );
    expect(calls).toBe(0);
    expect(bundle.gaps.join("\n")).toContain("Evaluation-owned link excluded");
    expect(bundle.gaps.join("\n")).toContain("reference scan limit");
  });

  test("exact byte hashes include Unicode and empty artifacts", async () => {
    const store = await archive();
    for (const body of ["", "研究来源\n"]) {
      const ref = await store.put(body, "md");
      expect(await readPinnedArtifact(ref)).toMatchObject({
        status: "read",
        content: body,
        bytes: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex"),
      });
    }
  });
});
