import { describe, expect, test } from "bun:test";
import {
  configuredControlSocket,
  createPublicTaskEvidenceProvider,
  readSubjectTask,
  type PublicCommand,
} from "./public-task-evidence.ts";

const appTask = {
  id: "goal/one",
  status: "up-to-date",
  generation: 1,
  outcome: "Deliver a verified result",
  summary: "Delivered",
  creator: { appId: "sample" },
  parentId: "sample",
  acceptance: ["Read back the artifact"],
  input: {
    kind: "goal",
    data: {
      outcome: "Deliver a verified result",
      acceptance: ["Read back the artifact"],
      constraints: ["Preserve the original request"],
    },
  },
  agent: "worker",
  owner: "sample",
  priority: "P1",
  conditions: [],
};

const taskDetail = {
  appId: "sample",
  taskId: "goal/one",
  ref: "abc12345",
  status: "up-to-date",
  generation: 1,
  resourceVersion: 3,
  outcome: "Deliver a verified result",
  acceptance: ["Read back the artifact"],
  statusDetail: "Current",
  summary: "Delivered",
  facts: ["output:/tmp/result"],
  updatedAt: 1,
  terminal: true,
  cancellable: false,
  history: [],
  historyTruncated: false,
  diagnostics: { owner: "sample", attemptCount: 1 },
};

function fixture(
  appView: Record<string, unknown> = appTask,
  detailView: Record<string, unknown> = taskDetail,
  apps: Record<string, unknown>[] = [{ id: "sample", owner: "worker" }],
): PublicCommand {
  return async (command) => {
    if (command.type === "apps.list")
      return { type: "ok", command: "apps.list", apps };
    if (command.type === "app.tasks.list")
      return {
        type: "ok",
        command: "app.tasks.list",
        appId: command.appId,
        tasks: [{ id: command.taskId ?? detailView.taskId }],
      };
    if (command.type === "app.task.get")
      return {
        type: "ok",
        command: "app.task.get",
        appId: command.appId,
        taskId: command.taskId,
        task: appView,
      };
    return { type: "ok", command: "task.get", task: detailView };
  };
}

describe("public Task evidence", () => {
  test("uses explicit endpoint configuration with bounded defaults", () => {
    expect(
      configuredControlSocket({ MAY_CONTROL_SOCKET: "/tmp/test.sock" }),
    ).toBe("/tmp/test.sock");
    expect(
      configuredControlSocket({
        MAY_PERSIST_DIR: "/state",
        MAY_INSTANCE: "canary",
        MAY_INTERFACE_AGENT: "may",
      }),
    ).toBe("/state/instances/canary/may.sock");
  });

  test("reads paginated live task and nested event envelopes", async () => {
    const seen: unknown[] = [];
    const provider = createPublicTaskEvidenceProvider(async (command) => {
      seen.push(command.cursor);
      if (command.type === "app.tasks.list")
        return {
          type: "ok",
          command: "app.tasks.list",
          appId: "sample",
          tasks: command.cursor
            ? { items: [{ id: "two" }], nextCursor: null }
            : { items: [{ id: "one" }], nextCursor: "page-2" },
        };
      return {
        type: "ok",
        command: "event.get",
        event: { event: { id: 42, type: "sample" }, delivery: {}, links: {} },
      };
    });
    expect(await provider.listTasks("sample", 2)).toEqual([
      { id: "one" },
      { id: "two" },
    ]);
    expect(seen).toEqual([undefined, "page-2"]);
    expect(await provider.getEvent(42)).toEqual({ id: 42, type: "sample" });
  });

  test("reads the public recent-Task envelope without inventing a top-level App identity", async () => {
    const seen: Record<string, unknown>[] = [];
    const provider = createPublicTaskEvidenceProvider(async (command) => {
      seen.push(command);
      return {
        type: "ok",
        command: "tasks.list",
        tasks: {
          items: [
            {
              appId: "sample",
              taskId: "goal/recent",
              status: "done",
              updatedAt: 42,
            },
          ],
          nextCursor: "next-page",
        },
      };
    });
    expect(await provider.listRecentTaskPage("sample", 20)).toEqual({
      items: [
        {
          appId: "sample",
          taskId: "goal/recent",
          status: "done",
          updatedAt: 42,
        },
      ],
      nextCursor: "next-page",
      issues: [],
    });
    expect(seen).toEqual([
      {
        type: "tasks.list",
        appId: "sample",
        includeDone: true,
        limit: 20,
      },
    ]);
  });

  test("rejects malformed list envelopes instead of reporting zero coverage", async () => {
    const provider = createPublicTaskEvidenceProvider(async () => ({
      type: "ok",
      command: "apps.list",
      apps: {},
    }));
    expect(provider.listApps()).rejects.toThrow("no items array");

    const recent = createPublicTaskEvidenceProvider(async () => ({
      type: "ok",
      command: "tasks.list",
      tasks: {
        items: [{ appId: "other", taskId: "goal/one", updatedAt: 1 }],
      },
    }));
    expect(await recent.listRecentTaskPage("sample")).toEqual({
      items: [],
      nextCursor: "",
      issues: ["tasks.list item appId identity mismatch"],
    });
  });

  test("combines real public envelopes without losing creator or original input", async () => {
    const subject = await readSubjectTask(
      { appId: "sample", taskId: "goal/one" },
      fixture(),
    );
    expect(subject).toMatchObject({
      disposition: "eligible",
      appId: "sample",
      taskId: "goal/one",
      task: {
        appTask: {
          id: "goal/one",
          creator: { appId: "sample" },
          input: {
            data: { constraints: ["Preserve the original request"] },
          },
        },
        detail: {
          appId: "sample",
          taskId: "goal/one",
          resourceVersion: 3,
          facts: ["output:/tmp/result"],
        },
      },
    });
    expect(subject.evidenceHash).toHaveLength(64);
  });

  test("binds exact identity and accepted evidence from both views", async () => {
    const first = await readSubjectTask(
      { appId: "sample", taskId: "goal/one" },
      fixture(),
    );
    const changed = await readSubjectTask(
      { appId: "sample", taskId: "goal/one" },
      fixture(appTask, {
        ...taskDetail,
        facts: [...taskDetail.facts, "publication:commit:abc"],
      }),
    );
    expect(changed.evidenceHash).not.toBe(first.evidenceHash);

    const generationMismatch = await readSubjectTask(
      { appId: "sample", taskId: "goal/one" },
      fixture(appTask, { ...taskDetail, generation: 2 }),
    );
    expect(generationMismatch).toMatchObject({
      disposition: "insufficient-evidence",
      reason: "public Task generation mismatch",
    });
  });

  test("ignores only public detail presentation metadata without altering evidence read-back", async () => {
    const subject = { appId: "sample", taskId: "goal/one" };
    const first = await readSubjectTask(subject, fixture());
    const refreshed = {
      ...taskDetail,
      ref: "abc12345-expanded",
      resourceVersion: 99,
      updatedAt: 200,
      progress: { stage: "presentation refresh", updatedAt: 200 },
    };
    const second = await readSubjectTask(subject, fixture(appTask, refreshed));
    expect(first.disposition).toBe("eligible");
    expect(second.evidenceHash).toBe(first.evidenceHash);
    expect(second.task?.detail).toEqual(refreshed);
  });

  for (const key of ["ref", "progress", "updatedAt", "resourceVersion"]) {
    for (const view of ["appTask", "detail"]) {
      for (const field of ["input", "result"]) {
        test(`preserves ${view}.${field} nested ${key} as meaningful evidence`, async () => {
          const read = (value: string) => {
            const domain = { [field]: { outputs: [{ [key]: value }] } };
            return readSubjectTask(
              { appId: "sample", taskId: "goal/one" },
              fixture(
                view === "appTask" ? { ...appTask, ...domain } : appTask,
                view === "detail" ? { ...taskDetail, ...domain } : taskDetail,
              ),
            );
          };
          const before = await read("original");
          const after = await read("replacement");
          expect(before.disposition).toBe("eligible");
          expect(after.disposition).toBe("eligible");
          expect(after.evidenceHash).not.toBe(before.evidenceHash);
        });
      }
    }
  }

  test("excludes Evaluation and Evaluation-created external work before judgment", async () => {
    let calls = 0;
    const excluded = await readSubjectTask(
      { appId: "evaluation", taskId: "goal/self" },
      async () => {
        calls += 1;
        return {};
      },
    );
    expect(excluded.disposition).toBe("excluded");
    expect(calls).toBe(0);

    const delegated = await readSubjectTask(
      { appId: "sample", taskId: "goal/one" },
      fixture({
        ...appTask,
        creator: { appId: "evaluation", taskId: "review/delegated" },
      }),
    );
    expect(delegated).toMatchObject({
      disposition: "insufficient-evidence",
      reason: expect.stringContaining("does not distinguish"),
      task: {
        appTask: { creator: { appId: "evaluation" } },
        detail: { appId: "sample", taskId: "goal/one" },
      },
    });
  });

  test("excludes canonically recorded Evaluation worker execution under an external owner", async () => {
    for (const worker of ["evaluator", "evaluator-deepseek", "judge"]) {
      const delegated = await readSubjectTask(
        { appId: "sample", taskId: "goal/one" },
        fixture({
          ...appTask,
          agent: worker,
          creator: { appId: "external-owner" },
        }),
      );
      expect(delegated).toMatchObject({
        disposition: "insufficient-evidence",
        reason: expect.stringContaining("Evaluation worker execution"),
        task: {
          appTask: { agent: worker, creator: { appId: "external-owner" } },
        },
      });
      expect(delegated.evidenceHash).toBeUndefined();
    }
  });

  test("retains verified Scout ownership without inventing optional creator provenance", async () => {
    const { creator, ...withoutCreator } = appTask;
    const view = {
      ...withoutCreator,
      id: "explore-github",
      parentId: "scout",
      owner: "scout",
    };
    const detail = { ...taskDetail, appId: "scout", taskId: view.id };
    const subject = await readSubjectTask(
      { appId: "scout", taskId: view.id },
      fixture(view, detail, [{ id: "scout" }]),
    );
    expect(subject).toMatchObject({
      disposition: "eligible",
      appId: "scout",
      taskId: "explore-github",
      task: { appTask: view, detail },
    });
    expect(subject.task!.appTask).not.toHaveProperty("creator");
    expect(subject.task!.readBack).toMatchObject({
      gaps: expect.arrayContaining([
        expect.stringContaining(
          "Optional creator/delegation provenance is unavailable",
        ),
        expect.stringContaining("accepted-attempt history unavailable"),
      ]),
    });
    expect(subject.evidenceHash).toHaveLength(64);
    const withCreator = await readSubjectTask(
      { appId: "scout", taskId: view.id },
      fixture({ ...view, creator: { appId: "scout" } }, detail, [
        { id: "scout" },
      ]),
    );
    expect(withCreator.evidenceHash).not.toBe(subject.evidenceHash);
  });

  test("does not infer ownership from a creator when the public App envelope mismatches", async () => {
    const base = fixture();
    const subject = await readSubjectTask(
      { appId: "sample", taskId: "goal/one" },
      async (request) => {
        const response = await base(request);
        return request.type === "app.task.get"
          ? { ...response, appId: "other" }
          : response;
      },
    );
    expect(subject).toMatchObject({
      disposition: "insufficient-evidence",
      reason: "app.task.get appId identity mismatch",
    });
  });

  for (const creator of [undefined, { source: { appId: "Evaluation.app" } }]) {
    test(`preserves self-work exclusion with creator ${JSON.stringify(creator)}`, async () => {
      let calls = 0;
      const excluded = await readSubjectTask(
        { appId: "Evaluation.app", taskId: "goal/self" },
        async () => {
          calls++;
          return {};
        },
      );
      expect(excluded.disposition).toBe("excluded");
      expect(calls).toBe(0);
      if (creator) {
        const delegated = await readSubjectTask(
          { appId: "sample", taskId: "goal/one" },
          fixture({ ...appTask, creator }),
        );
        expect(delegated.disposition).toBe("insufficient-evidence");
        expect(delegated.evidenceHash).toBeUndefined();
      }
    });
  }

  test("keeps catalog gaps, read failures, and identity mismatches neutral", async () => {
    expect(
      (
        await readSubjectTask(
          { appId: "missing", taskId: "goal/one" },
          fixture(appTask, taskDetail, []),
        )
      ).disposition,
    ).toBe("insufficient-evidence");
    expect(
      (
        await readSubjectTask(
          { appId: "sample", taskId: "goal/one" },
          async () => {
            throw new Error("offline");
          },
        )
      ).disposition,
    ).toBe("insufficient-evidence");
    const mismatch = await readSubjectTask(
      { appId: "sample", taskId: "goal/one" },
      fixture(appTask, { ...taskDetail, appId: "other" }),
    );
    expect(mismatch).toMatchObject({
      disposition: "insufficient-evidence",
      reason: expect.stringContaining("identity mismatch"),
    });
  });
});
