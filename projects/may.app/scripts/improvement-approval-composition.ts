/** Explicit cross-repository synthetic composition trial.
 * Run with HOST_CANDIDATE=/path/to/may-host bun this-file.ts.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { packetHash } from "../improvement-approval";
import { prepareImprovementApproval } from "../agents/may/workflows/prepare-improvement-approval";
import { applyImprovementFromTrustedEvent } from "./apply-improvement";

const host = resolve(process.env.HOST_CANDIDATE || "");
if (!process.env.HOST_CANDIDATE)
  throw new Error(
    "HOST_CANDIDATE is required; this trial never guesses an ignored Host checkout",
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
