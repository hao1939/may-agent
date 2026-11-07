import { describe, expect, test } from "bun:test";
import {
  createPublicTaskEvidenceProvider,
  type PublicCommand,
} from "../../evaluator/workflows/lib/public-task-evidence.js";
import { reviewTaskDispositionBatch } from "./task-disposition-review.js";

function fixture(count = 1) {
  const tasks = Array.from({ length: count }, (_, index) => ({
    id: `report/${String(index).padStart(4, "0")}`,
    status: "idle",
    generation: 1,
    resourceVersion: 3,
    outcome: "Review this exact immutable report",
    acceptance: ["Record a supported disposition"],
    summary: "No improvement warranted for this report",
    creator: { appId: "sample" },
    acceptedAttempt: { id: `accepted-${index}`, generation: 1 },
    currentObligations: {
      available: true,
      inputWaits: { items: [] as unknown[], truncated: false },
    },
    pendingEvents: { items: [] as unknown[], truncated: false },
    conditions: [] as unknown[],
  }));
  const human = tasks.map(({ id, status, generation, resourceVersion }) => ({
    taskId: id,
    status,
    generation,
    resourceVersion,
    recurring: false,
    terminal: false,
  }));
  const calls: Record<string, unknown>[] = [];
  const command: PublicCommand = async (input) => {
    calls.push(input);
    if (input.type === "app.tasks.list") {
      const start = input.cursor ? Number(String(input.cursor).slice(5)) : 0;
      const end = Math.min(tasks.length, start + Number(input.limit));
      return {
        command: input.type,
        appId: input.appId,
        tasks: {
          items: tasks
            .slice(start, end)
            .map(({ id, status, generation, resourceVersion }) => ({
              id,
              status,
              generation,
              resourceVersion,
            })),
          ...(end < tasks.length ? { nextCursor: `page:${end}` } : {}),
        },
      };
    }
    const index = tasks.findIndex(({ id }) => id === input.taskId);
    if (index < 0) throw new Error("Task not found");
    return {
      command: input.type,
      appId: input.appId,
      taskId: input.taskId,
      task:
        input.type === "app.task.get"
          ? structuredClone(tasks[index])
          : { ...human[index], appId: input.appId },
    };
  };
  return {
    tasks,
    human,
    calls,
    command,
    provider: createPublicTaskEvidenceProvider(command),
  };
}

describe("bounded Task disposition review", () => {
  test("traverses 528 existing assignments in bounded resumable pages without creating or closing work", async () => {
    const f = fixture(528);
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const before = f.calls.length;
      const result = await reviewTaskDispositionBatch(f.provider, {
        appId: "sample",
        limit: 10,
        cursor,
      });
      expect(f.calls.length - before).toBeLessThanOrEqual(21);
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(30_000);
      expect(result.items.every(({ route }) => route === "owner-review")).toBe(
        true,
      );
      expect(result.retryTaskIds).toEqual([]);
      seen.push(...result.items.map(({ taskId }) => taskId));
      cursor = result.nextCursor ?? undefined;
      pages++;
    } while (cursor);
    expect(pages).toBe(53);
    expect(seen).toEqual(f.tasks.map(({ id }) => id));
    expect(new Set(seen).size).toBe(528);
    expect(new Set(f.calls.map(({ type }) => type))).toEqual(
      new Set(["app.tasks.list", "app.task.get", "task.get"]),
    );
    expect(f.tasks.every(({ status }) => status === "idle")).toBe(true);
  });

  test("keeps standing work, current obligations, and historical cancellation distinct from owner review", async () => {
    const f = fixture(6);
    f.human[0].recurring = true;
    f.tasks[1].conditions.push({ id: "human-authority", owner: "human" });
    f.tasks[2].status = f.human[2].status = "waiting";
    f.tasks[3].status = f.human[3].status = "cancelled";
    f.human[3].terminal = true;
    f.tasks[4].currentObligations.inputWaits.items.push({
      key: "original-request",
      pending: true,
    });
    const result = await reviewTaskDispositionBatch(f.provider, {
      appId: "sample",
    });
    expect(result.items.map(({ route }) => route)).toEqual([
      "retain-standing",
      "retain-work",
      "retain-work",
      "ended-history",
      "retain-work",
      "owner-review",
    ]);
    expect(result.items[5]).toMatchObject({
      authorityRoute: "app-or-operator",
      acceptedAttemptId: "accepted-5",
    });
  });

  test("does not mistake legacy open done for terminal history", async () => {
    const f = fixture();
    f.tasks[0].status = "done";
    f.human[0].status = "up-to-date";
    const result = await reviewTaskDispositionBatch(f.provider, {
      appId: "sample",
    });
    expect(result.items[0]).toMatchObject({
      route: "owner-review",
      status: "idle",
    });
  });

  test("retains explicit retries for changed, failed and incomplete reads while advancing discovery", async () => {
    const f = fixture(5);
    f.human[0].resourceVersion++;
    f.tasks[2].currentObligations.inputWaits.truncated = true;
    f.tasks[3].pendingEvents.truncated = true;
    const provider = createPublicTaskEvidenceProvider(async (input) => {
      if (input.type === "app.task.get" && input.taskId === f.tasks[1].id)
        throw new Error("Read unavailable");
      return f.command(input);
    });
    const result = await reviewTaskDispositionBatch(provider, {
      appId: "sample",
      limit: 4,
    });
    expect(result.nextCursor).toBe("page:4");
    expect(result.pageReadComplete).toBe(false);
    expect(result.retryTaskIds).toEqual(
      f.tasks.slice(0, 4).map(({ id }) => id),
    );
    const retry = await reviewTaskDispositionBatch(f.provider, {
      appId: "sample",
      taskIds: [f.tasks[1].id],
    });
    expect(retry.items[0]?.route).toBe("owner-review");
    expect(retry.nextCursor).toBeNull();
  });

  test("rejects invalid batches and cancellation before making reads", async () => {
    const f = fixture();
    for (const limit of [0, -1, 11, 1.5, Infinity])
      await expect(
        reviewTaskDispositionBatch(f.provider, { appId: "sample", limit }),
      ).rejects.toThrow("limit");
    await expect(
      reviewTaskDispositionBatch(f.provider, {
        appId: "sample",
        taskIds: ["same", "same"],
      }),
    ).rejects.toThrow("unique");
    await expect(
      reviewTaskDispositionBatch(f.provider, {
        appId: "sample",
        cursor: "page:1",
        taskIds: ["one"],
      }),
    ).rejects.toThrow("cursor");
    await expect(
      reviewTaskDispositionBatch(
        f.provider,
        { appId: "sample" },
        AbortSignal.abort(),
      ),
    ).rejects.toThrow();
    expect(f.calls).toEqual([]);
  });

  test("requires current accepted evidence and complete obligations before offering owner review", async () => {
    const f = fixture(3);
    f.tasks[0].acceptedAttempt.generation = 0;
    f.tasks[1].currentObligations.available = false;
    f.tasks[2].acceptedAttempt.id = "";
    const result = await reviewTaskDispositionBatch(f.provider, {
      appId: "sample",
    });
    expect(result.items.every(({ route }) => route === "needs-evidence")).toBe(
      true,
    );
    expect(result.retryTaskIds).toEqual(f.tasks.map(({ id }) => id));
  });

  test("honors cancellation during the final read instead of returning a completed page", async () => {
    const f = fixture();
    const controller = new AbortController();
    const provider = createPublicTaskEvidenceProvider(async (input) => {
      const response = await f.command(input);
      if (input.type === "task.get") controller.abort();
      return response;
    });
    await expect(
      reviewTaskDispositionBatch(
        provider,
        { appId: "sample" },
        controller.signal,
      ),
    ).rejects.toThrow();
  });

  test("rejects duplicate discovery identities instead of counting them as coverage", async () => {
    const f = fixture();
    const provider = createPublicTaskEvidenceProvider(async (input) => {
      if (input.type === "app.tasks.list")
        return {
          command: input.type,
          appId: input.appId,
          tasks: { items: [{ id: "same" }, { id: "same" }] },
        };
      return f.command(input);
    });
    await expect(
      reviewTaskDispositionBatch(provider, { appId: "sample" }),
    ).rejects.toThrow("duplicate");
    expect(f.calls).toEqual([]);
  });

  test("caps large previews and makes no fulfillment claim from accepted wording", async () => {
    const f = fixture(10);
    for (const task of f.tasks) {
      task.outcome = "fulfilled ".repeat(10_000);
      task.acceptance = Array(30).fill(
        "Must verify actual delivery ".repeat(1_000),
      );
      task.summary = "Complete ".repeat(10_000);
    }
    const result = await reviewTaskDispositionBatch(f.provider, {
      appId: "sample",
    });
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(30_000);
    expect(
      result.items.every(
        ({ route, previewsOnly }) => route === "owner-review" && previewsOnly,
      ),
    ).toBe(true);
  });
});
