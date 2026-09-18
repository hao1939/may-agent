/** Explicit cross-repository synthetic composition trial.
 * Run with HOST_CANDIDATE=/path/to/may-host bun this-file.ts.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const app = resolve(
  process.env.APP_CANDIDATE || join(import.meta.dir, "../../.."),
);
const { packetHash } = await import(
  join(app, "projects/may.app/improvement-approval.ts")
);
const { prepareImprovementApproval } = await import(
  join(
    app,
    "projects/may.app/agents/may/workflows/prepare-improvement-approval.ts",
  )
);
const { applyImprovementFromTrustedEvent } = await import(
  join(app, "projects/may.app/scripts/apply-improvement.ts")
);
const { execute: activate } = await import(
  join(
    app,
    "projects/may.app/agents/may/workflows/improvement-activation-follow-up.ts",
  )
);
const { createServer } = await import("node:net");

const host = resolve(process.env.HOST_CANDIDATE || "");
if (!process.env.HOST_CANDIDATE)
  throw new Error(
    "HOST_CANDIDATE is required; this trial never guesses an ignored Host checkout",
  );
const { readAppTaskWaitPromptContext } = await import(
  join(host, "src/app/core/tasks/app-task-context.ts")
);
const { createRuntimeAppRead, readRuntimeTaskView } = await import(
  join(host, "src/app/core/reads/app-read.ts")
);
const { AppInboxHost } = await import(
  join(host, "src/app/core/inbox/app-inbox-host.ts")
);
const { appInputFeedbackEvent } = await import(
  join(host, "src/app/core/inbox/input-result.ts")
);
const { admitTaskAppDependencies } = await import(
  join(host, "src/app/core/tasks/dependency-admission.ts")
);
const { admitTaskInput } = await import(
  join(host, "src/app/core/state/inbox.ts")
);
const { readAppTaskAdmissionOutcome } = await import(
  join(host, "src/app/core/tasks/app-task-reconciler.ts")
);
const { createTestAppWorkflowContext } = await import(
  join(host, "packages/sdk/src/testing.ts")
);
const { default: evaluationApp, taskIntentForInput } = await import(
  join(app, "projects/evaluation.app/app.ts")
);
const { reviewTaskOutcome } = await import(
  join(
    app,
    "projects/evaluation.app/agents/evaluator/workflows/task-outcome-review.ts",
  )
);
const { sendPublicReadCommand, readSubjectTask } = await import(
  join(
    app,
    "projects/evaluation.app/agents/evaluator/workflows/lib/public-task-evidence.ts",
  )
);
const { createAppTaskEvents } = await import(
  join(host, "src/app/core/tasks/app-task-emitter.ts")
);
const { attachCommandRouter } = await import(
  join(host, "src/app/command-router.ts")
);
const { completeAppTask } = await import(
  join(host, "src/app/core/tasks/app-task-reconciler.ts")
);
const { EventBus } = await import(join(host, "src/app/core/events/bus.ts"));
const { createEventInterface } = await import(
  join(host, "src/app/core/events/interface.ts")
);
const { loadPersistedEvent } = await import(
  join(host, "src/app/core/events/persisted.ts")
);
const { AppTaskResourceStore } = await import(
  join(host, "src/app/core/state/app-task-resource-store.ts")
);
const { matchingAppTaskConditionTaskIds, trackAppTaskConditionEventForTasks } =
  await import(join(host, "src/app/core/tasks/app-task-condition-tracker.ts"));
const { claimObservedAppTask, deferAppTask, observeAppTaskIntent } =
  await import(join(host, "src/app/core/tasks/app-task-reconciler.ts"));
const { appTaskTestContext } = await import(
  join(host, "src/app/core/tasks/app-task-test-support.ts")
);
const { HumanTaskService } = await import(
  join(host, "src/app/human-task-service.ts")
);
const { attachTelegramBot } = await import(
  join(host, "src/app/transport/telegram.ts")
);
const { DbWriter } = await import(join(host, "src/lib/db-writer.ts"));
const { closeDb, getDb } = await import(join(host, "src/lib/requests.ts"));
const { openDatabase } = await import(join(host, "src/lib/db.ts"));
const { applyDbSchema } = await import(join(host, "src/lib/db/schema.ts"));

function equal(actual: unknown, expected: unknown, label = "values") {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `${label} differ: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
}
function expect(actual: any) {
  return {
    toBe(expected: any) {
      equal(actual, expected);
    },
    toBeDefined() {
      if (actual === undefined) throw new Error("expected defined value");
    },
    toBeUndefined() {
      if (actual !== undefined)
        throw new Error(`expected undefined, got ${String(actual)}`);
    },
    toMatchObject(expected: Record<string, unknown>) {
      for (const [key, value] of Object.entries(expected))
        equal(actual?.[key], value, key);
    },
    get rejects() {
      return {
        async toThrow(text: string) {
          try {
            await actual;
          } catch (error) {
            if (String(error).includes(text)) return;
            throw error;
          }
          throw new Error(`expected rejection containing ${text}`);
        },
      };
    },
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-composition-"));
  const repository = join(root, "repo");
  mkdirSync(repository);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  writeFileSync(join(repository, "behavior.txt"), "before\n");
  git("add", ".");
  git("commit", "-m", "baseline");
  const baselineCommit = git("rev-parse", "HEAD");
  git("checkout", "-b", "candidate");
  writeFileSync(join(repository, "behavior.txt"), "after\n");
  git("commit", "-am", "candidate");
  const candidateCommit = git("rev-parse", "HEAD");
  const candidateTreeHash = git("rev-parse", "HEAD^{tree}");
  git("checkout", "main");
  const diff = execFileSync("git", [
    "-C",
    repository,
    "diff",
    "--binary",
    "--no-ext-diff",
    "--no-renames",
    baselineCommit,
    candidateCommit,
  ]);
  const sha = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");
  const verification = '{"status":"passed","synthetic":true}\n';
  const comparison = '{"verdict":"candidate-supported","synthetic":true}\n';
  const body = {
    baselineCommit,
    candidateCommit,
    candidateTreeHash,
    diffSha256: sha(diff),
    verificationSha256: sha(verification),
    comparisonSha256: sha(comparison),
    activationScope: `git-fast-forward:${repository}`,
    activation: {
      appId: "may-agent",
      operation: "runtime.reload.requested",
      target: "installed-app-definitions",
    },
    rollbackCommit: baselineCommit,
  };
  const packet = { ...body, packetHash: packetHash(body) };
  const files = {
    repository,
    packet: join(root, "packet.json"),
    diff: join(root, "diff.patch"),
    verification: join(root, "verification.json"),
    comparison: join(root, "comparison.json"),
  };
  writeFileSync(files.packet, JSON.stringify(packet));
  writeFileSync(files.diff, diff);
  writeFileSync(files.verification, verification);
  writeFileSync(files.comparison, comparison);
  return { root, repository, git, packet, files };
}

const sourceIdentity = (root: string) => ({
  head: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  trackedDiffSha256: createHash("sha256")
    .update(execFileSync("git", ["-C", root, "diff", "HEAD"]))
    .digest("hex"),
});
const sourcesBefore = {
  apps: sourceIdentity(app),
  host: sourceIdentity(host),
  activationSha256: createHash("sha256")
    .update(
      readFileSync(
        join(
          app,
          "projects/may.app/agents/may/workflows/improvement-activation-follow-up.ts",
        ),
      ),
    )
    .digest("hex"),
};

async function main() {
  const f = fixture();
  const initialized = openDatabase(join(f.root, "may.db"));
  applyDbSchema(initialized);
  initialized.close();
  const db = getDb(f.root);
  const store = AppTaskResourceStore.fromDb(db, "may");
  const config = appTaskTestContext({
    appDir: f.root,
    appId: "may",
    agent: "may",
    maxConcurrent: 1,
    resourceStore: store,
    tree: {
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
  });
  const taskId = "goal/improvement-composition";
  observeAppTaskIntent(config, {
    appAgent: "may",
    intent: {
      id: taskId,
      parentId: "root",
      outcome: "Apply the exact reviewed synthetic improvement",
      acceptance: [
        "The trusted decision is recorded and the temporary candidate is applied",
      ],
      agent: "may",
    },
  });
  const claim = claimObservedAppTask(config, {
    taskId,
    appAgent: "may",
    handler: "agent",
  });
  if (claim.kind !== "claimed")
    throw new Error(`expected claimed Task, got ${claim.kind}`);
  const prepared = prepareImprovementApproval(
    {
      files: f.files,
      proposalPath: join(f.root, "proposal.json"),
      revision: 1,
      finding: {
        disposition: "improve",
        userImpact:
          "The fixture demonstrates a missing connected approval handoff.",
        recurrenceOrRisk:
          "An unbound decision could apply the wrong candidate.",
        evidenceAndConfidence:
          "This composition uses the production modules and a temporary repository.",
        doNothingOrSimplerAlternative:
          "Reuse the Host Condition and journal rather than add a controller.",
      },
      candidate: {
        disposition: "present-for-approval",
        verifiedBenefit:
          "The exact source-only candidate is guarded end to end.",
        regressionRisk: "Limited to this synthetic fixture repository.",
        implementationCost: "One bounded production-module composition test.",
        ongoingCost: "No service, network, or production mutation.",
        scopeAndLimitations:
          "Proves source application only, not activation or deployment.",
        simplerAlternative:
          "Existing Task, adapter, journal and Git guard are reused.",
        worthApplying: "Yes, in this temporary fixture only.",
      },
    },
    { appId: "may", taskId, generation: claim.generation },
  );
  deferAppTask(config, claim, {
    disposition: "waiting",
    summary: "Waiting for the exact synthetic human decision",
    conditions: [prepared.condition],
  });
  const registry = {
    snapshot: () => ({
      id: "synthetic:1",
      generation: 1,
      entries: [
        {
          appDir: f.root,
          definition: {
            id: "may",
            version: 1 as const,
            owner: "may",
            description: "synthetic",
            inputSchema: {} as never,
          },
        },
      ],
    }),
  };
  const humanTasks = new HumanTaskService(db, registry as never);
  const beforeView = humanTasks.getTask({ appId: "may", taskId })!;
  expect(beforeView.status).toBe("waiting");
  expect(beforeView.humanAction).toBeDefined();

  const priorFetch = globalThis.fetch;
  const priorToken = process.env.TELEGRAM_BOT_TOKEN;
  const priorChat = process.env.TELEGRAM_CHAT_ID;
  const priorApprover = process.env.TELEGRAM_APPROVER_ID;
  process.env.TELEGRAM_BOT_TOKEN = "synthetic-token";
  process.env.TELEGRAM_CHAT_ID = "123";
  process.env.TELEGRAM_APPROVER_ID = "7";
  const updates: unknown[] = [];
  let releasePoll: (() => void) | undefined;
  let nextMessageId = 900;
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const method = String(url).split("/").at(-1);
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (method === "getMe")
      return Response.json({ ok: true, result: { username: "synthetic_bot" } });
    if (method === "getUpdates") {
      while (
        updates.length &&
        (updates[0] as { update_id: number }).update_id <
          Number(body.offset ?? 0)
      )
        updates.shift();
      if (!updates.length)
        await new Promise<void>((resolve) => {
          releasePoll = resolve;
          init?.signal?.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
      releasePoll = undefined;
      return Response.json({ ok: true, result: [...updates] });
    }
    if (
      ["sendMessage", "editMessageReplyMarkup", "answerCallbackQuery"].includes(
        String(method),
      )
    )
      return Response.json({
        ok: true,
        result: { message_id: nextMessageId++ },
      });
    throw new Error(`synthetic fixture forbids provider operation ${method}`);
  }) as typeof fetch;

  const bus = new EventBus();
  const writer = new DbWriter(f.root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const conversationRoute = bus.subscribeDurableRoute(
    (event: { type: string }) =>
      event.type === "conversation.message.created"
        ? {
            accepted: true,
            by: "synthetic-conversation",
            route: "direct" as const,
          }
        : undefined,
  );
  const events = createEventInterface({
    bus,
    db,
    acceptsAppInput: () => true,
    hasApp: () => true,
    hasAgent: () => true,
    hasSession: () => false,
  });
  let approvalEventId = 0;
  const bot = attachTelegramBot({
    persistDir: f.root,
    bus,
    interfaceAgent: "may",
    humanTasks,
    publishEvent(input: {
      type: string;
      data?: Record<string, unknown>;
      target?: Record<string, unknown>;
    }) {
      const receipt = events.publish(input, { source: "telegram" });
      if (input.type === "project.approval.submitted") {
        approvalEventId = receipt.eventId!;
        const canonical = {
          ...input.data,
          type: input.type,
          source: "telegram",
          target: input.target,
          data: input.data,
          eventId: approvalEventId,
        };
        const taskIds = matchingAppTaskConditionTaskIds(config, canonical);
        trackAppTaskConditionEventForTasks(config, canonical, taskIds);
      }
      return receipt;
    },
  });
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 4_000;
    while (!predicate()) {
      if (Date.now() > deadline)
        throw new Error("synthetic composition timed out");
      await Bun.sleep(10);
    }
  };
  try {
    await until(() =>
      Boolean(
        db
          .prepare(
            "SELECT 1 FROM notification_messages WHERE event_type = 'task.human-action'",
          )
          .get(),
      ),
    );
    const card = db
      .prepare(
        "SELECT telegram_msg_id, data FROM notification_messages WHERE event_type = 'task.human-action' ORDER BY telegram_msg_id LIMIT 1",
      )
      .get() as { telegram_msg_id: number; data: string };
    expect(JSON.parse(card.data).approvalAnchor).toMatchObject({
      taskGeneration: 1,
      conditionId: prepared.condition.id,
    });

    const readTask = async () =>
      humanTasks.getTask({ appId: "may", taskId }) as unknown as Record<
        string,
        unknown
      >;
    const readEvent = async (eventId: number) => {
      const event = loadPersistedEvent(db, eventId, f.root);
      return event ? ({ ...event, id: eventId } as never) : undefined;
    };
    const baseline = f.git("rev-parse", "HEAD");
    const current = await readTask();
    for (const stale of [
      { ...current, status: "cancelled", terminal: true },
      { ...current, status: "done", terminal: true },
      { ...current, generation: 2 },
      {
        ...current,
        diagnostics: { ...(current.diagnostics as object), conditions: [] },
      },
    ]) {
      await expect(
        applyImprovementFromTrustedEvent(
          f.files,
          prepared.proposal,
          1,
          async () => undefined,
          async () => stale,
        ),
      ).rejects.toThrow("no longer the current human wait");
      expect(f.git("rev-parse", "HEAD")).toBe(baseline);
    }

    updates.push({
      update_id: 501,
      message: {
        message_id: 501,
        text: "approve",
        chat: { id: 123, type: "private" },
        from: { id: 7 },
        reply_to_message: {
          message_id: card.telegram_msg_id,
          text: prepared.proposal.text,
        },
      },
    });
    releasePoll?.();
    await until(() => approvalEventId > 0);
    const afterView = humanTasks.getTask({ appId: "may", taskId })!;
    expect(afterView.status).toBe("pending");
    expect(afterView.humanAction).toBeUndefined();
    expect(afterView.diagnostics?.conditions[0]?.condition?.status.state).toBe(
      "true",
    );

    const result = await applyImprovementFromTrustedEvent(
      f.files,
      prepared.proposal,
      approvalEventId,
      readEvent,
      readTask,
    );
    expect(result).toMatchObject({
      applied: true,
      appliedCommit: f.packet.candidateCommit,
    });
    if (!result.applied || !("appliedCommit" in result))
      throw new Error("synthetic application did not apply");
    expect(readFileSync(join(f.files.repository, "behavior.txt"), "utf8")).toBe(
      "after\n",
    );
    expect(f.git("status", "--porcelain")).toBe("");

    // Reviewer extension: actual Task transitions, Task event emitter, journal,
    // public read socket, and command router. Runtime reload callback is synthetic;
    // reviewer-pinned-activation-corrected.json separately exercises the real daemon.
    const receiptPath = join(f.root, "source-receipt.json");
    writeFileSync(
      receiptPath,
      JSON.stringify({
        stage: "source-application",
        ...result,
        authority: {
          kind: "trusted-journal-event",
          eventId: approvalEventId,
          packetHash: prepared.proposal.packetHash,
          proposalHash: prepared.proposal.proposalHash,
          conditionId: prepared.proposal.conditionId,
        },
      }),
    );
    const socketPath = join(f.root, "reviewer-control.sock");
    const oldSocket = process.env.MAY_CONTROL_SOCKET;
    const control = createServer((connection) => {
      let pending = "";
      connection.on("data", (bytes) => {
        pending += bytes.toString();
        if (!pending.includes("\n")) return;
        const command = JSON.parse(pending.split("\n")[0]);
        let response: any = { type: "ok", command: command.type };
        if (command.type === "event.get")
          response.event = events.get(command.eventId);
        else if (command.type === "task.get")
          response.task = humanTasks.getTask({
            appId: command.appId,
            taskId: command.taskId,
          });
        else if (command.type === "apps.list")
          response.apps = [
            { id: "scout", owner: "may" },
            { id: "may", owner: "may" },
            { id: "evaluation", owner: "evaluator" },
          ];
        else if (command.type === "app.task.get") {
          response.appId = command.appId;
          response.taskId = command.taskId;
          response.task = readRuntimeTaskView(
            {
              taskStateConfig: command.appId === "scout" ? scoutConfig : config,
            },
            command.taskId,
          );
        } else
          response = {
            type: "error",
            error: `Unexpected fixture control ${command.type}`,
          };
        connection.end(JSON.stringify(response) + "\n");
      });
    });
    await new Promise<void>((resolve, reject) => {
      control.once("error", reject);
      control.listen(socketPath, resolve);
    });
    process.env.MAY_CONTROL_SOCKET = socketPath;
    let releaseReload: () => void = () => {};
    const permitted = new Promise<void>((resolve) => (releaseReload = resolve));
    let reloads = 0;
    const router = attachCommandRouter({
      bus,
      manager: {} as any,
      projectRoot: f.repository,
      reload: async (options: any) => {
        reloads++;
        equal(
          options.expectedSourceCommit,
          f.packet.candidateCommit,
          "pinned source",
        );
        await permitted;
        if (process.env.SCENARIO === "unrelated-completion")
          return { ok: false, summary: "Synthetic actual operation failed" };
        if (process.env.SCENARIO === "inconclusive-activation")
          return {
            ok: true,
            summary: "Synthetic completion omitted source identity",
          };
        return {
          ok: true,
          summary: "Synthetic runtime callback; real daemon covered separately",
          sourceCommit: f.packet.candidateCommit,
        };
      },
      restart() {
        throw new Error("unexpected restart");
      },
      shutdown() {
        throw new Error("unexpected shutdown");
      },
    });
    const observed: any[] = [];
    const activationInput = {
      files: f.files,
      proposal: prepared.proposal,
      approvalEventId,
      sourceReceipt: receiptPath,
      newSubjectTask: {
        appId: "scout",
        taskId: "goal/new-subject",
        generation: 1,
      },
    };
    const ctxFor = (claimed: any, items: any[] = []) => {
      const emitter = createAppTaskEvents({
        bus,
        db,
        persistDir: f.root,
        appId: "may",
        claim: claimed,
      });
      return {
        input: activationInput,
        signal: new AbortController().signal,
        read: createRuntimeAppRead({
          getDb: () => db,
          taskStateConfig: config,
        }),
        reconciliation: {
          appId: "may",
          taskId,
          generation: claimed.generation,
          waits: readAppTaskWaitPromptContext(store, db, taskId),
          task: readRuntimeTaskView({ taskStateConfig: config }, taskId),
          events: { items, continuedInputs: [] },
        },
        events: {
          read: async (type: string, key: string) => emitter.read(type, key),
          emit: async (event: any) => {
            const { localKey, ...body } = event;
            emitter.publish(localKey, body);
          },
        },
        done: (summary: string, output: any) => ({
          status: "success",
          summary,
          output,
        }),
        blocked: (summary: string) => ({ status: "blocked", summary }),
      };
    };
    const scoutStore = AppTaskResourceStore.fromDb(db, "scout");
    const scoutConfig = appTaskTestContext({
      appDir: f.root,
      appId: "scout",
      agent: "may",
      maxConcurrent: 1,
      resourceStore: scoutStore,
      tree: {
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      },
    });
    const subjectId = activationInput.newSubjectTask.taskId;
    const scoutIntent = {
      id: subjectId,
      parentId: "root",
      agent: "may",
      outcome: "Fresh synthetic work after adoption",
      acceptance: ["Produce a concrete fixture outcome"],
    };
    const startSubject = () => {
      observeAppTaskIntent(scoutConfig, {
        appAgent: "may",
        intent: scoutIntent,
      });
      const sc = claimObservedAppTask(scoutConfig, {
        taskId: subjectId,
        appAgent: "may",
        handler: "agent",
      });
      equal(sc.kind, "claimed", "subject claim");
      bus.emit({
        type: "project.task.reconcile.started",
        source: "app-task:scout",
        owner: "agent:may",
        data: {
          project: "scout",
          taskId: subjectId,
          generation: sc.generation,
          attemptId: sc.attemptId,
        },
      } as any);
      return sc;
    };
    const finishSubject = (sc: any) => {
      completeAppTask(scoutConfig, sc, {
        summary: "Fresh synthetic accepted outcome",
        result: { synthetic: true },
        facts: ["synthetic subject outcome"],
      });
      bus.emit({
        type: "project.task.reconciled",
        source: "app-task:scout",
        owner: "agent:may",
        data: {
          project: "scout",
          taskId: subjectId,
          generation: sc.generation,
          attemptId: sc.attemptId,
          disposition: "converged",
          summary: "Fresh synthetic accepted outcome",
        },
      } as any);
    };
    const earlySubject = [
      "old-subject-touched",
      "started-before-activation",
    ].includes(process.env.SCENARIO || "")
      ? startSubject()
      : null;
    if (process.env.SCENARIO === "old-subject-touched")
      finishSubject(earlySubject);
    let success = false;
    try {
      const c1 = claimObservedAppTask(config, {
        taskId,
        appAgent: "may",
        handler: "agent",
      });
      equal(c1.kind, "claimed", "activation claim");
      const first = await activate(ctxFor(c1) as any);
      observed.push({ phase: "request", result: first });
      equal(first.output?.state, "waiting", "first activation output");
      deferAppTask(config, c1, {
        disposition: "waiting",
        summary: first.output.summary,
        result: first.output.result,
        facts: first.output.facts,
        conditions: first.output.conditions,
      });
      observed.push({
        phase: "accepted-wait",
        task: humanTasks.getTask({ appId: "may", taskId }),
      });
      if (process.env.SCENARIO === "unrelated-completion") {
        // A superficially matching success is not parented by our actual request.
        bus.emit({
          type: "runtime.reload.finished",
          source: "runtime",
          owner: "agent:may",
          data: {
            requestId: `improvement-activation:${f.packet.packetHash}`,
            ok: true,
            sourceCommit: f.packet.candidateCommit,
            summary: "Unrelated synthetic success without the request trace",
          },
        } as any);
      }
      releaseReload();
      await until(
        () =>
          Number(
            db
              .prepare(
                "SELECT count(*) AS n FROM events WHERE event_type='runtime.reload.finished'",
              )
              .get().n,
          ) >= (process.env.SCENARIO === "unrelated-completion" ? 2 : 1),
      );
      const finishedId = db
        .prepare(
          "SELECT id FROM events WHERE event_type='runtime.reload.finished' ORDER BY id DESC LIMIT 1",
        )
        .get().id;
      const finished = events.get(finishedId)!.event;
      const fact = { ...finished.data, ...finished, eventId: finishedId };
      trackAppTaskConditionEventForTasks(
        config,
        fact,
        matchingAppTaskConditionTaskIds(config, fact),
      );
      while (Date.now() <= finished.timestamp) await Bun.sleep(1);
      if (process.env.SCENARIO === "old-subject-touched") {
        // Selecting an executor updates Task presentation without executing it.
        observeAppTaskIntent(scoutConfig, {
          appAgent: "may",
          intent: {
            ...scoutIntent,
            workflow: "fixture-selected-after-activation",
          },
        });
      } else finishSubject(earlySubject ?? startSubject());
      observed.push({
        phase: "fresh-subject",
        task: humanTasks.getTask({ appId: "scout", taskId: subjectId }),
      });
      if (process.env.SCENARIO === "source-advanced-after-activation") {
        // Ordinary Scout work commits an archive result after definitions were
        // activated. This changes source HEAD without issuing another reload.
        writeFileSync(
          join(f.repository, "fresh-archive.txt"),
          "Synthetic fresh Scout archive result.\n",
        );
        f.git("add", "fresh-archive.txt");
        f.git("commit", "-qm", "Archive new subject result after activation");
        observed.push({
          phase: "ordinary-source-advance",
          head: f.git("rev-parse", "HEAD"),
          activatedSource: f.packet.candidateCommit,
        });
      }
      if (process.env.SCENARIO === "preparation-artifacts-unavailable") {
        unlinkSync(receiptPath);
        unlinkSync(f.files.packet);
        unlinkSync(f.files.verification);
        unlinkSync(f.files.comparison);
        observed.push({
          phase: "preparation-artifacts-removed-after-issuance",
        });
      }
      const c2 = claimObservedAppTask(config, {
        taskId,
        appAgent: "may",
        handler: "agent",
      });
      equal(c2.kind, "claimed", "after activation wake");
      const retainedForReview = await ctxFor(c2).events.read(
        "runtime.reload.requested",
        `improvement-activation:${f.packet.packetHash}`,
      );
      observed.push({
        phase: "request-read-comparison",
        retained: retainedForReview,
        publicView: retainedForReview
          ? events.get(retainedForReview.eventId)
          : null,
      });
      const second = await activate(
        ctxFor(c2, [{ eventId: finishedId, event: finished }]) as any,
      );
      observed.push({ phase: "follow-up", result: second });
      if (
        ["unrelated-completion", "inconclusive-activation"].includes(
          process.env.SCENARIO || "",
        )
      ) {
        equal(
          second.output?.state,
          "incomplete",
          "failed/inconclusive stays open",
        );
        equal(
          second.output?.result?.stage,
          process.env.SCENARIO === "unrelated-completion"
            ? "activation-failed"
            : "activation-inconclusive",
          "actual operation result",
        );
        equal(
          Boolean(second.output?.dependencies?.length),
          false,
          "no premature Evaluation dependency",
        );
      } else if (
        ["old-subject-touched", "started-before-activation"].includes(
          process.env.SCENARIO || "",
        )
      ) {
        equal(
          Boolean(second.output?.dependencies?.length),
          false,
          "old/pre-activation execution cannot authorize follow-up",
        );
        equal(
          second.output?.state === "converged",
          false,
          "cannot claim completed follow-up",
        );
      } else {
        equal(
          second.output?.result?.stage,
          "post-adoption-evaluation-requested",
          "follow-up stage",
        );
        const pinned = second.output?.dependencies?.[0]?.input?.data;
        equal(pinned?.appId, "scout", "cross-App subject app");
        equal(pinned?.taskId, subjectId, "cross-App subject task");
        equal(pinned?.subjectGeneration, 1, "pinned generation");
        equal(
          /^[a-f0-9]{64}$/.test(pinned?.evidenceHash),
          true,
          "pinned evidence",
        );
        if (
          [
            "full-follow-up",
            "subject-advances-after-review",
            "different-review-return",
            "subject-advances-before-review",
          ].includes(process.env.SCENARIO || "")
        ) {
          const evalStore = AppTaskResourceStore.fromDb(db, "evaluation");
          const evalConfig = appTaskTestContext({
            appDir: f.root,
            appId: "evaluation",
            agent: "evaluator",
            maxConcurrent: 1,
            resourceStore: evalStore,
            tree: {
              root_task_id: "evaluation-system",
              groups: {
                "evaluation-system": {
                  id: "evaluation-system",
                  parent_id: null,
                },
              },
            },
          });
          let otherEvidenceHash = "";
          if (process.env.SCENARIO === "different-review-return") {
            observeAppTaskIntent(scoutConfig, {
              appAgent: "may",
              intent: scoutIntent,
              trigger: {
                type: "app.task.requested",
                data: {
                  reason: "Another observation within the same requirement",
                },
                timestamp: Date.now(),
              },
            });
            const other = claimObservedAppTask(scoutConfig, {
              taskId: subjectId,
              appAgent: "may",
              handler: "agent",
            });
            equal(other.kind, "claimed", "new observation of same subject");
            equal(other.generation, 1, "same requirement generation");
            completeAppTask(scoutConfig, other, {
              summary: "Different synthetic accepted outcome",
              result: { synthetic: true, revision: 2 },
              facts: ["different synthetic subject outcome"],
            });
            const changed = await readSubjectTask(
              { appId: "scout", taskId: subjectId },
              sendPublicReadCommand,
            );
            otherEvidenceHash = changed.evidenceHash!;
            equal(changed.disposition, "eligible", "other outcome readable");
            equal(
              otherEvidenceHash === pinned.evidenceHash,
              false,
              "the other request reviews different accepted evidence",
            );
          }
          const returnedEvents: any[] = [];
          const inbox = new AppInboxHost({
            db,
            apps: [evaluationApp],
            attachTask: (input: any) => admitTaskInput(evalConfig, input),
            readDependency: async ({ dependency, admissionKey }: any) => {
              const accepted = readAppTaskAdmissionOutcome(
                evalConfig,
                dependency.id,
                admissionKey,
              );
              return accepted
                ? {
                    kind: "task",
                    id: dependency.id,
                    status: accepted.state === "converged" ? "done" : "waiting",
                    ...accepted,
                  }
                : null;
            },
            onRequestUpdated: (item: any, result: any, status: any) => {
              const update = appInputFeedbackEvent(item, result, status);
              if (update) {
                const event = bus.emit(update);
                returnedEvents.push(event);
                const fact = { ...event.data, ...event, eventId: event.id };
                trackAppTaskConditionEventForTasks(
                  config,
                  fact,
                  matchingAppTaskConditionTaskIds(config, fact),
                );
              }
            },
            onFailure: (failure: any) => {
              throw new Error(
                "Evaluation composition " + JSON.stringify(failure),
              );
            },
          });
          try {
            const descriptor = {
              id: "may",
              appDir: f.root,
              projectDir: f.root,
              agent: "may",
              app: { id: "may", agent: "may", tasks: { maxConcurrent: 1 } },
              resourceStore: store,
              reconciliationPaused: false,
            };
            const conditions = admitTaskAppDependencies({
              opts: {
                bus,
                persistDir: f.root,
                projectsRoot: f.root,
                projectRoot: f.root,
                appRegistrySnapshot: {
                  entries: [{ appDir: f.root, definition: evaluationApp }],
                },
              },
              descriptor,
              claim: c2,
              dependencies:
                process.env.SCENARIO === "different-review-return"
                  ? [
                      second.output.dependencies[0],
                      {
                        ...second.output.dependencies[0],
                        id: "unrelated-other-review",
                        input: {
                          kind: "review-task-outcome",
                          data: {
                            ...second.output.dependencies[0].input.data,
                            evidenceHash: otherEvidenceHash,
                          },
                        },
                      },
                    ]
                  : second.output.dependencies,
            } as any);
            deferAppTask(config, c2, {
              disposition: "waiting",
              summary: second.output.summary,
              result: second.output.result,
              facts: second.output.facts,
              conditions,
            });
            await inbox.recoverAdmissions();
            const requestId =
              conditions[
                process.env.SCENARIO === "different-review-return" ? 1 : 0
              ].subject.slice(3);
            const admitted = inbox.get(requestId);
            equal(
              admitted?.waitingOn?.kind,
              "task",
              "real Evaluation admission",
            );
            const evalTaskId = admitted!.waitingOn!.id;
            const ec = claimObservedAppTask(evalConfig, {
              taskId: evalTaskId,
              appAgent: "evaluator",
              handler: "workflow:task-outcome-review",
            });
            equal(ec.kind, "claimed", "Evaluation claim");
            const evalRead = createRuntimeAppRead({
              getDb: () => db,
              taskStateConfig: evalConfig,
            });
            const evalTask = await evalRead.tasks.get(evalTaskId);
            const evalEmitter = createAppTaskEvents({
              bus,
              db,
              persistDir: f.root,
              appId: "evaluation",
              claim: ec,
            });
            if (process.env.SCENARIO === "subject-advances-before-review")
              observeAppTaskIntent(scoutConfig, {
                appAgent: "may",
                intent: {
                  ...scoutIntent,
                  input: {
                    newRequirement:
                      "new work before selected outcome can be reviewed",
                  },
                },
              });
            const evaluation = await reviewTaskOutcome(
              createTestAppWorkflowContext({
                input: evalTask.input,
                reconciliation: {
                  appId: "evaluation",
                  taskId: evalTaskId,
                  generation: ec.generation,
                  resourceVersion: ec.resourceVersion,
                  attemptId: ec.attemptId,
                  agent: "evaluator",
                  mode: "achieve",
                  outcome: evalTask.outcome,
                  acceptance: evalTask.acceptance,
                  input: evalTask.input,
                  children: { live: [], completed: [] },
                  events: { items: ec.events },
                },
                read: evalRead,
                workspace: {
                  root: f.root,
                  appRoot: f.root,
                  projectRoot: f.root,
                  output: f.root,
                },
                callAgent: async () => ({
                  id: "fixture-judge",
                  kind: "agent",
                  status: "done",
                  summary: "Synthetic outcome judgment",
                  output: {
                    disposition: "assessed",
                    responsibility: "Scout owns fixture work",
                    summary: "Fixture outcome reviewed",
                    findings: [],
                    verification: ["Actual temporary Task read"],
                    delivery: "Fixture result retained",
                  },
                }),
                emit: async (event: any) => {
                  const { localKey, ...body } = event;
                  evalEmitter.publish(localKey, body);
                },
              }),
              sendPublicReadCommand,
              join(f.root, "reports"),
            );
            equal(
              evaluation.output?.state,
              "converged",
              "accepted Evaluation output",
            );
            completeAppTask(evalConfig, ec, {
              summary: evaluation.output.summary,
              result: evaluation.output.result,
              facts: evaluation.output.facts,
            });
            if (process.env.SCENARIO === "subject-advances-after-review")
              observeAppTaskIntent(scoutConfig, {
                appAgent: "may",
                intent: {
                  ...scoutIntent,
                  input: {
                    newRequirement: "new work after selected outcome reviewed",
                  },
                },
              });
            await inbox.refreshTaskResults("evaluation", evalTaskId);
            equal(
              inbox.get(requestId)?.status,
              "done",
              "exact Evaluation request completed",
            );
            observed.push({
              phase: "evaluation-request-result",
              requestId,
              result: inbox.get(requestId)?.result,
              events: returnedEvents,
            });
            const c3 = claimObservedAppTask(config, {
              taskId,
              appAgent: "may",
              handler: "agent",
            });
            equal(c3.kind, "claimed", "Evaluation return wake");
            const third = await activate(ctxFor(c3, c3.events) as any);
            observed.push({ phase: "follow-up-received", result: third });
            if (process.env.SCENARIO === "subject-advances-before-review") {
              equal(
                third.output?.state === "waiting",
                false,
                "a finished exact review refusal must not remain an external wait",
              );
              equal(
                third.output?.result?.evaluationDisposition,
                "insufficient-evidence",
                "surface exact independent evidence limitation for May's judgment",
              );
              equal(
                Boolean(third.output?.dependencies?.length),
                false,
                "do not silently select replacement evidence",
              );
            } else if (process.env.SCENARIO === "different-review-return") {
              equal(
                third.output?.result?.stage ===
                  "post-adoption-evaluation-complete",
                false,
                "a different selected evidence review must not close this handoff",
              );
              equal(
                third.output?.result?.newSubject?.evidenceHash,
                pinned.evidenceHash,
                "retain original selected evidence while waiting",
              );
              equal(
                Boolean(third.output?.dependencies?.length),
                false,
                "do not silently replace selected review",
              );
            } else {
              equal(
                third.output?.result?.stage,
                "post-adoption-evaluation-complete",
                "exact independent review received",
              );
              equal(
                Boolean(third.output?.dependencies?.length),
                false,
                "no replacement review for already received outcome",
              );
              equal(
                third.output?.facts?.includes(
                  `new-subject-evidence:${pinned.evidenceHash}`,
                ),
                true,
                "completion preserves exact selected evidence",
              );
            }
          } finally {
            inbox.close();
          }
        }
      }
      equal(reloads, 1, "one reload");
      success = true;
    } finally {
      releaseReload();
      router.close();
      await new Promise<void>((resolve) => control.close(() => resolve()));
      if (oldSocket === undefined) delete process.env.MAY_CONTROL_SOCKET;
      else process.env.MAY_CONTROL_SOCKET = oldSocket;
      const report = {
        sourcesBefore,
        sourcesAfter: {
          apps: sourceIdentity(app),
          host: sourceIdentity(host),
          activationSha256: createHash("sha256")
            .update(
              readFileSync(
                join(
                  app,
                  "projects/may.app/agents/may/workflows/improvement-activation-follow-up.ts",
                ),
              ),
            )
            .digest("hex"),
        },
        scenario: process.env.SCENARIO || "positive",
        pass: success,
        syntheticOnly: true,
        scope:
          "Real source approval + Task wait/wake + Task emitter + public views + command router + cross-App accepted subject; runtime callback synthetic, real daemon tested separately",
        reloads,
        observed,
      };
      writeFileSync(
        process.env.RESULT_PATH!,
        JSON.stringify(report, null, 2) + "\n",
      );
      console.log(
        JSON.stringify(
          {
            pass: success,
            reloads,
            phases: observed.map((x) => ({
              phase: x.phase,
              stage: x.result?.output?.result?.stage,
              status: x.result?.status,
              summary: x.result?.summary,
            })),
          },
          null,
          2,
        ),
      );
    }

    console.log(
      JSON.stringify(
        {
          pass: true,
          syntheticOnly: true,
          noExternalNetwork: true,
          realHostTask: `${beforeView.appId}/${beforeView.taskId}@${beforeView.generation}`,
          displayedCondition: prepared.condition.id,
          journalEventId: approvalEventId,
          ownerStateAfterDecision: afterView.status,
          conditionStateAfterDecision:
            afterView.diagnostics?.conditions[0]?.condition?.status.state,
          rejectedBeforeMutation: [
            "cancelled",
            "terminal",
            "new-generation",
            "superseded",
          ],
          appliedCommit: result.appliedCommit,
          target: "temporary-git-fixture",
        },
        null,
        2,
      ),
    );
  } finally {
    bot.close();
    conversationRoute();
    globalThis.fetch = priorFetch;
    if (priorToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = priorToken;
    if (priorChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
    else process.env.TELEGRAM_CHAT_ID = priorChat;
    if (priorApprover === undefined) delete process.env.TELEGRAM_APPROVER_ID;
    else process.env.TELEGRAM_APPROVER_ID = priorApprover;
    await new Promise((resolve) => setImmediate(resolve));
    closeDb(f.root);
    rmSync(f.root, { recursive: true, force: true });
  }
}

await main();
