import { stateTransaction as withTransaction } from "../../../lib/db/transaction.js";
import { readInputContext, freezeInputContext, observeTaskDependency, type AppDependencyReader } from "./input-context.js";
import { completeInboxInput } from "../state/inbox.js";
import { randomUUID } from "node:crypto";
import {
  matchesEventSelector,
  type AppDependencyObservation,
  type AppDefinition,
  type AppEvent,
  type AppInput,
  type AppInputSource,
  type AppInputContext,
  type AppResult,
  type AppTaskAttachment,
  type EventSelector,
} from "@may-agent/sdk";
import { Check, Errors } from "typebox/value";
import type { SqliteDb } from "../../../lib/db.js";
import { assertValidAppDefinition } from "../apps/definition-validation.js";
import {
  assertAppInboxClaim,
  claimNextAppInboxItem,
  createAppInboxItem,
  excludeExecutingConversations,
  getAppInboxItem,
  listAppInboxTaskDependencyKeys,
  releaseAppInboxClaim,
  type AppTurnTarget,
  renewAppInboxClaim,
  wakeAppInboxItem,
  wakeAppInboxItemsWaitingOn,
  wakeAppInboxItemsWaitingOnApp,
  type AppInboxClaim,
  type AppInboxItem,
  type AppInboxWaitKind,
  type AppInboxTaskDependencyKey,
  type CreateAppInboxItem,
} from "../state/app-inbox-store.js";

/**
 * The task engine must treat idempotencyKey as stable admission identity.
 * This keeps a retry from creating duplicate durable task work.
 */
export type AppTaskAttacher = (input: {
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
  request: Readonly<AppInputContext>;
  /** Inbox attachment commits its wait and Topic too; direct follow-up admission has no claim. */
  claim?: AppInboxClaim;
  now?: number;
  /** Revalidate the originating turn inside the Task admission transaction. */
  authorize?: () => void;
  topicId?: string;
  requestLink?: { appId: string; conversationId: string; id: string; revision: number };
}) => Promise<{
  taskId: string;
}>;

export type AppActionDescription = {
  id: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type AdmitAppInput = {
  id?: string;
  appId: string;
  parentId?: string;
  /** Attach this request to one exact existing Task in the target App. */
  targetTaskId?: string;
  /** Existing Conversation Topic that this admitted work belongs to. */
  topicId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelTargetId?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyToSourceId?: string;
  source: AppInputSource;
  input: AppInput;
  originEventId?: number;
  idempotencyKey?: string;
};

export type AppInboxFailure = {
  agent?: string;
  requestId?: string;
  conversationId?: string;
  claimRevision?: number;
  appId?: string;
  taskId?: string;
  stage: string;
  error: string;
  disposition: string;
};

export type AppInboxReconcileResult = {
  claimed: number;
  admitted: number;
  released: number;
  errors: string[];
  failures?: AppInboxFailure[];
  /** Conversations whose visible messages or active-work projection changed. */
  conversationIds?: string[];
};

export type AppInboxTaskRecoveryResult = {
  linked: number;
  woken: number;
  wokenAppIds: string[];
  errors: string[];
  failures?: AppInboxFailure[];
};

export type AppInboxHostOptions = {
  db: SqliteDb;
  apps: AppDefinition[];
  readDependency?: AppDependencyReader;
  attachTask?: AppTaskAttacher;
  admitConversation?: (input: CreateAppInboxItem & { conversationId: string }) => {
    item: AppInboxItem;
    created: boolean;
  };
  stopConversationTurn?: (target: AppTurnTarget) => unknown;
  /** Optional context enrichment; Task-only operation does not require it. */
  prepareInput?: (item: AppInboxItem, input: Readonly<AppInputContext>) => Promise<AppInputContext>;
  workerId?: string;
  leaseMs?: number;
  retryAfterMs?: number;
  now?: () => number;
  /** Wake-only notification after a visible Conversation projection change. */
  onConversationChanged?: (appId: string, conversationId: string) => void;
  /** Durable semantic completion notification; transport delivery is separate. */
  onRequestCompleted?: (item: AppInboxItem, result: AppResult) => void;
  /** Notification after one request is durably attached to its exact Task. */

};

type RegisteredApp = AppDefinition;
type RegisteredSubscription = {
  app: RegisteredApp;
  subscription: NonNullable<AppDefinition["subscriptions"]>[number];
};

function eventSelectorType(selector: EventSelector): string {
  return typeof selector === "string" ? selector : selector.type;
}

const REVIEWABLE_TASK_DEPENDENCY_STATUSES = new Set<AppDependencyObservation["status"]>([
  "attention",
  "done",
  "error",
  "interrupted",
  "unknown",
]);
const TERMINAL_TASK_INPUT_STATUSES = new Set<AppDependencyObservation["status"]>([
  "error",
  "interrupted",
  "unknown",
]);

export function appInboxHumanRequestId(itemId: string): string {
  return `app-inbox-human:${requiredText(itemId, "App inbox item id")}`;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function validateAppDefinition(app: AppDefinition): RegisteredApp {
  assertValidAppDefinition(app);
  return app;
}

function validateInput(app: RegisteredApp, input: AppInput): void {
  if (!Check(app.inputSchema, input)) {
    const first = [...Errors(app.inputSchema, input)][0];
    throw new Error(`Invalid input for App ${app.id}: ${first?.message ?? "schema mismatch"}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class AppInboxHost {
  readonly #db: SqliteDb;
  #apps: Map<string, RegisteredApp>;
  #subscriptionsByEventType: Map<string, RegisteredSubscription[]>;
  readonly #readDependency?: AppDependencyReader;
  readonly #attachTask?: AppTaskAttacher;
  readonly #prepareInput?: AppInboxHostOptions["prepareInput"];
  readonly #admitConversation?: AppInboxHostOptions["admitConversation"];
  readonly #stopConversationTurn?: AppInboxHostOptions["stopConversationTurn"];
  readonly #workerId: string;
  readonly #leaseMs: number;
  readonly #retryAfterMs: number;
  readonly #now: () => number;
  readonly #onConversationChanged?: (appId: string, conversationId: string) => void;
  readonly #onRequestCompleted?: (item: AppInboxItem, result: AppResult) => void;
  readonly #executions = new Map<string, { claim: AppInboxClaim; controller: AbortController }>();
  #taskDependencyRecoveryCursor?: AppInboxTaskDependencyKey;

  constructor(options: AppInboxHostOptions) {
    this.#admitConversation = options.admitConversation;
    this.#stopConversationTurn = options.stopConversationTurn;
    this.#db = options.db;
    this.#readDependency = options.readDependency;
    this.#attachTask = options.attachTask;
    this.#prepareInput = options.prepareInput;
    this.#workerId = options.workerId?.trim() || `app-host:${process.pid}:${randomUUID()}`;
    this.#leaseMs = options.leaseMs ?? 60_000;
    this.#retryAfterMs = options.retryAfterMs ?? 1_000;
    this.#now = options.now ?? Date.now;
    this.#onConversationChanged = options.onConversationChanged;
    this.#onRequestCompleted = options.onRequestCompleted;
    if (!Number.isFinite(this.#leaseMs) || this.#leaseMs <= 0) throw new Error("App host leaseMs must be positive");
    if (!Number.isFinite(this.#retryAfterMs) || this.#retryAfterMs < 0) {
      throw new Error("App host retryAfterMs must be finite and non-negative");
    }
    this.#apps = new Map();
    this.#subscriptionsByEventType = new Map();
    this.replaceApps(options.apps);
  }

  appIds(): string[] {
    return [...this.#apps.keys()].sort();
  }

  hasApp(appId: string): boolean {
    return this.#apps.has(appId.trim().replace(/\.app$/, ""));
  }

  describeActions(appId: string): AppActionDescription[] {
    const normalized = appId.trim().replace(/\.app$/, "");
    const app = this.#apps.get(normalized);
    if (!app) throw new Error(`App ${appId} is not loaded`);
    return Object.entries(app.actions ?? {}).map(([id, action]) => ({
      id,
      description: action.description,
      inputSchema: structuredClone(action.inputSchema) as Record<string, unknown>,
    }));
  }

  invokeAction(appId: string, actionId: string, params: unknown): AppInput {
    const normalized = appId.trim().replace(/\.app$/, "");
    const app = this.#apps.get(normalized);
    if (!app) throw new Error(`App ${appId} is not loaded`);
    const action = app.actions?.[actionId];
    if (!action) throw new Error(`App ${normalized} has no action ${actionId}`);
    if (!Check(action.inputSchema, params)) {
      const first = [...Errors(action.inputSchema, params)][0];
      throw new Error(`Invalid input for ${normalized}.${actionId}: ${first?.message ?? "schema mismatch"}`);
    }
    const input = action.toInput(params as never);
    validateInput(app, input);
    return input;
  }

  /** Atomically replace the live App definitions after a validated reload. */
  replaceApps(definitions: AppDefinition[]): void {
    const next = new Map<string, RegisteredApp>();
    const nextSubscriptions = new Map<string, RegisteredSubscription[]>();
    for (const definition of definitions) {
      const app = validateAppDefinition(definition);
      if (next.has(app.id)) throw new Error(`Duplicate App id: ${app.id}`);
      next.set(app.id, app);
      for (const subscription of app.subscriptions ?? []) {
        const eventType = eventSelectorType(subscription.event);
        const routes = nextSubscriptions.get(eventType) ?? [];
        routes.push({ app, subscription });
        nextSubscriptions.set(eventType, routes);
      }
    }
    const pendingAdmissions = this.#db
      .prepare(
        `SELECT app_id, route_kind, payload
         FROM app_event_admission_commands
         WHERE status = 'pending'
         ORDER BY event_id, app_id`,
      )
      .all();
    for (const command of pendingAdmissions) {
      const appId = requiredText(command.app_id, "Pending App event admission app id");
      const routeKind = requiredText(command.route_kind, "Pending App event admission route kind");
      const app = next.get(appId);
      if (!app) {
        if (this.#apps.has(appId)) {
          throw new Error(`Cannot remove App ${appId} while it owns pending event admission commands`);
        }
        // An App absent at startup may be disabled. Retain its commands without loading it.
        continue;
      }
      if ((routeKind === "task" || routeKind === "exact-task") && !app.tasks) {
        throw new Error(
          `Cannot remove task capability from App ${appId} while it owns pending event admission commands`,
        );
      }
      if (routeKind === "inbox") {
        let input: unknown;
        let conditionTaskIds: unknown;
        try {
          const payload = JSON.parse(String(command.payload)) as {
            input?: unknown;
            conditionTaskIds?: unknown;
          };
          input = payload.input;
          conditionTaskIds = payload.conditionTaskIds;
        } catch {
          throw new Error(`Pending App event admission for ${appId} has invalid inbox payload JSON`);
        }
        if (!Check(app.inputSchema, input)) {
          throw new Error(
            `Cannot install an input schema incompatible with pending event admission commands for App ${appId}`,
          );
        }
        if (Array.isArray(conditionTaskIds) && conditionTaskIds.length > 0 && !app.tasks) {
          throw new Error(
            `Cannot remove task capability from App ${appId} while its pending inbox admission includes Condition wakes`,
          );
        }
      }
    }
    for (const id of this.#apps.keys()) {
      if (next.has(id)) continue;
      const unfinished = this.#db
        .prepare("SELECT 1 AS found FROM app_inbox_items WHERE app_id = ? AND status != 'done' LIMIT 1")
        .get(id);
      if (unfinished) throw new Error(`Cannot remove App ${id} while it owns unfinished inbox items`);
    }
    this.#apps = next;
    this.#subscriptionsByEventType = nextSubscriptions;
  }

  acceptsInput(appId: string, input: AppInput): boolean {
    const app = this.#apps.get(appId.trim());
    return Boolean(app && Check(app.inputSchema, input));
  }

  matchingAppIds(owner: string, input: AppInput): string[] {
    const normalizedOwner = requiredText(owner, "App owner").replace(/^agent:/, "");
    return [...this.#apps.values()]
      .filter(
        (app) =>
          (app.agent ?? app.owner ?? "").trim().replace(/^agent:/, "") === normalizedOwner &&
          Check(app.inputSchema, input),
      )
      .map((app) => app.id)
      .sort();
  }

  subscriptionInputs(event: AppEvent<Record<string, unknown>>): Array<{
    appId: string;
    subscriptionId: string;
    input: AppInput;
  }> {
    const matches: Array<{ appId: string; subscriptionId: string; input: AppInput }> = [];
    for (const { app, subscription } of this.#subscriptionsByEventType.get(event.type) ?? []) {
      if (!matchesEventSelector(subscription.event, event)) continue;
      const input = subscription.toInput(event);
      if (input === null) continue;
      validateInput(app, input);
      matches.push({ appId: app.id, subscriptionId: subscription.id, input });
    }
    return matches;
  }

  isOwnedApp(appId: string, owner: string): boolean {
    const app = this.#apps.get(appId.trim());
    const normalizedOwner = owner.trim().replace(/^(?:agent|app):/, "");
    return Boolean(
      app &&
      (app.id.trim().replace(/^app:/, "") === normalizedOwner ||
        (app.agent ?? app.owner ?? "").trim().replace(/^agent:/, "") === normalizedOwner),
    );
  }

  admit(input: AdmitAppInput): { item: AppInboxItem; created: boolean } {
    const app = this.#requiredApp(input.appId);
    validateInput(app, input.input);
    const defaultConversationId = app.requests?.conversationId?.trim();
    const useDefaultConversation =
      input.conversationId === undefined && defaultConversationId !== undefined && input.originEventId !== undefined;
    const prepared = {
      ...input,
      ...(useDefaultConversation
        ? { conversationId: defaultConversationId, conversationSequence: input.originEventId }
        : {}),
      now: this.#now(),
    };
    if (
      app.requests &&
      (!app.requests.inputKinds || app.requests.inputKinds.includes(input.input.kind))
    ) {
      if (!this.#admitConversation) throw new Error("Conversation Task admission is not configured");
      return this.#admitConversation({
        ...prepared,
        conversationId: prepared.conversationId ?? defaultConversationId ?? `${app.id}:primary`,
      });
    }
    return createAppInboxItem(this.#db, prepared);
  }

  get(id: string): AppInboxItem | null {
    return getAppInboxItem(this.#db, id);
  }

  stopTurn(target: AppTurnTarget): void {
    this.#requiredApp(target.appId);
    if (!this.#stopConversationTurn) throw new Error("Conversation Task control is not configured");
    this.#stopConversationTurn(target);
  }

  readyCount(appId: string): number {
    const app = this.#requiredApp(appId);
    const now = this.#now();
    const executingIds = [...this.#executions.keys()];
    const row = this.#db
      .prepare(
        `SELECT 1 AS ready FROM (
           SELECT candidate.app_id
             FROM app_inbox_items candidate INDEXED BY idx_app_inbox_available
             WHERE candidate.app_id = ? AND candidate.status != 'done' AND candidate.lease_owner IS NULL
               ${excludeExecutingConversations(executingIds)}
               AND candidate.available_at IS NOT NULL AND candidate.available_at <= ?
               AND (candidate.conversation_id IS NULL OR NOT EXISTS (
                 SELECT 1 FROM app_inbox_items active
                 WHERE active.app_id = candidate.app_id
                   AND active.conversation_id = candidate.conversation_id
                   AND active.id != candidate.id
                   AND active.lease_owner IS NOT NULL
                   AND active.lease_expires_at > ?
               ))
           UNION ALL
           SELECT candidate.app_id
             FROM app_inbox_items candidate INDEXED BY idx_app_inbox_expired
             WHERE candidate.app_id = ? AND candidate.status != 'done'
               ${excludeExecutingConversations(executingIds)}
               AND candidate.lease_expires_at IS NOT NULL AND candidate.lease_expires_at <= ?
               AND (candidate.conversation_id IS NULL OR NOT EXISTS (
                 SELECT 1 FROM app_inbox_items active
                 WHERE active.app_id = candidate.app_id
                   AND active.conversation_id = candidate.conversation_id
                   AND active.id != candidate.id
                   AND active.lease_owner IS NOT NULL
                   AND active.lease_expires_at > ?
               ))
         ) LIMIT 1`,
      )
      .get(app.id, ...executingIds, now, now, app.id, ...executingIds, now, now);
    return row ? 1 : 0;
  }

  /** Apps with claimable inbox work, derived only from ready/expired indexes. */
  readyAppIds(): string[] {
    const now = this.#now();
    const loaded = this.#apps;
    const rows = this.#db
      .prepare(
        `SELECT DISTINCT app_id FROM (
           SELECT candidate.app_id
             FROM app_inbox_items candidate INDEXED BY idx_app_inbox_available
             WHERE candidate.status != 'done' AND candidate.lease_owner IS NULL
               AND candidate.available_at IS NOT NULL AND candidate.available_at <= ?
               AND (candidate.conversation_id IS NULL OR NOT EXISTS (
                 SELECT 1 FROM app_inbox_items active
                 WHERE active.app_id = candidate.app_id
                   AND active.conversation_id = candidate.conversation_id
                   AND active.id != candidate.id
                   AND active.lease_owner IS NOT NULL
                   AND active.lease_expires_at > ?
               ))
           UNION ALL
           SELECT candidate.app_id
             FROM app_inbox_items candidate INDEXED BY idx_app_inbox_expired
             WHERE candidate.status != 'done'
               AND candidate.lease_expires_at IS NOT NULL AND candidate.lease_expires_at <= ?
               AND (candidate.conversation_id IS NULL OR NOT EXISTS (
                 SELECT 1 FROM app_inbox_items active
                 WHERE active.app_id = candidate.app_id
                   AND active.conversation_id = candidate.conversation_id
                   AND active.id != candidate.id
                   AND active.lease_owner IS NOT NULL
                   AND active.lease_expires_at > ?
               ))
         ) ORDER BY app_id`,
      )
      .all(now, now, now, now) as Array<{ app_id?: unknown }>;
    return rows.flatMap((row) =>
      typeof row.app_id === "string" &&
      loaded.has(row.app_id) &&
      (this.#executions.size === 0 || this.readyCount(row.app_id))
        ? [row.app_id]
        : [],
    );
  }

  wake(waitingOn: { kind: AppInboxWaitKind; id: string }): number {
    return wakeAppInboxItemsWaitingOn(this.#db, waitingOn, this.#now());
  }

  /** Wake an exact dependency, including work already made ready by its state commit. */
  wakeAppIds(waitingOn: { kind: AppInboxWaitKind; id: string }, appId?: string): string[] {
    const appIds: string[] = [];
    const now = this.#now();
    const scope = appId === undefined ? undefined : requiredText(appId, "appId");
    withTransaction(this.#db, () => {
      const rows = this.#db
        .prepare(
          `SELECT DISTINCT app_id
           FROM app_inbox_items
           WHERE status = 'handling'
             AND lease_owner IS NULL
             AND waiting_on_kind = ?
             AND waiting_on_id = ?
             ${scope ? "AND app_id = ?" : ""}
           ORDER BY app_id`,
        )
        .all(waitingOn.kind, requiredText(waitingOn.id, "waitingOn.id"), ...(scope ? [scope] : [])) as Array<{
        app_id?: unknown;
      }>;
      if (rows.length === 0) return;
      if (scope) wakeAppInboxItemsWaitingOnApp(this.#db, scope, waitingOn, now);
      else wakeAppInboxItemsWaitingOn(this.#db, waitingOn, now);
      for (const row of rows) {
        if (typeof row.app_id === "string" && row.app_id.trim()) appIds.push(row.app_id.trim());
      }
    });
    return appIds;
  }

  #replacementTaskAttachment(
    app: Readonly<AppDefinition>,
    item: Readonly<AppInboxItem>,
    currentTaskId: string,
  ): AppTaskAttachment | null {
    if (item.targetTaskId || !app.task) return null;
    const resolved = app.task({ id: item.id, source: item.source, input: item.input });
    if (resolved?.kind !== "desired" || resolved.intent.mode !== "achieve" || resolved.intent.id === currentTaskId) {
      return null;
    }
    return resolved;
  }

  /** Re-observe task waits so attention, missing tasks, or repaired App policy cannot wait forever. */
  async recoverTaskDependencies(): Promise<AppInboxTaskRecoveryResult> {
    const outcome: AppInboxTaskRecoveryResult = {
      linked: 0,
      woken: 0,
      wokenAppIds: [],
      errors: [],
    };
    if (!this.#readDependency) return outcome;
    const wokenApps = new Set<string>();
    let page = listAppInboxTaskDependencyKeys(this.#db, { after: this.#taskDependencyRecoveryCursor });
    if (page.items.length === 0 && this.#taskDependencyRecoveryCursor) {
      this.#taskDependencyRecoveryCursor = undefined;
      page = listAppInboxTaskDependencyKeys(this.#db);
    }
    this.#taskDependencyRecoveryCursor = page.nextCursor;
    for (const { appId, taskId, inputId, admissionKey } of page.items) {
      const taskDependency = { kind: "task", id: taskId } as const;
      const app = this.#apps.get(appId);
      const agent = app?.agent ?? app?.owner;
      try {
        const observed = (await observeTaskDependency(this.#readDependency, appId, taskDependency, admissionKey)) ?? {
          ...taskDependency,
          status: "unknown" as const,
        };
        const item = getAppInboxItem(this.#db, inputId);
        if (!item || item.status !== "handling" || item.lease || item.waitingOn?.id !== taskId) continue;
        const replacement = !REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(observed.status) &&
          this.#replacementTaskAttachment(this.#requiredApp(appId), item, taskId);
        if (!replacement && !REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(observed.status)) continue;
        if (wakeAppInboxItem(this.#db, inputId, this.#now())) {
          if (replacement) outcome.linked += 1;
          outcome.woken += 1;
          wokenApps.add(appId);
        }
      } catch (error) {
        outcome.errors.push(`App ${appId} task ${taskId}: ${errorMessage(error)}`);
        (outcome.failures ??= []).push({
          appId, agent, taskId, stage: "dependency-recovery",
          error: errorMessage(error), disposition: "recovery-pending",
        });
      } finally {
        // Yield between bounded input-link reads so recovery does not monopolize I/O.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    outcome.wokenAppIds = [...wokenApps].sort();
    return outcome;
  }

  async reconcileOnce(appId: string): Promise<AppInboxReconcileResult> {
    const app = this.#requiredApp(appId);
    const claim = claimNextAppInboxItem(this.#db, app.id, this.#workerId, this.#leaseMs, this.#now(), [
      ...this.#executions.keys(),
    ]);
    if (!claim) return { claimed: 0, admitted: 0, released: 0, errors: [] };
    this.#notifyConversationChanges([claim.item]);

    const controller = new AbortController();
    this.#executions.set(claim.item.id, { claim, controller });
    const stopRenewing = this.#renewClaim(claim, controller);
    const outcome: AppInboxReconcileResult = { claimed: 1, admitted: 0, released: 0, errors: [] };
    const conversationIds = new Set<string>();
    try {
      const request = await this.#authorRequest(claim.item);
      const changedConversation = await this.#handleRequest(app, claim, request);
      if (changedConversation) conversationIds.add(changedConversation);
      outcome.admitted = 1;
    } catch (error) {
      outcome.errors.push(`Request ${claim.item.id}: ${errorMessage(error)}`);
      const failure: AppInboxFailure = {
        agent: app.agent ?? app.owner,
        requestId: claim.item.id,
        conversationId: claim.item.conversationId,
        claimRevision: claim.generation,
        stage: "input-handling",
        error: errorMessage(error),
        disposition: "ownership-lost",
      };
      outcome.failures = [failure];
      try {
        if (
          releaseAppInboxClaim(this.#db, claim, {
            retryAfterMs: this.#retryAfterMs,
            now: this.#now(),
          })
        ) {
          outcome.released = 1;
          failure.disposition = "retry-scheduled";
          if (claim.item.conversationId) {
            conversationIds.add(claim.item.conversationId);
          }
        }
      } catch (cleanupError) {
        failure.disposition = "recovery-pending";
        outcome.errors.push(`Request ${claim.item.id} cleanup: ${errorMessage(cleanupError)}`);
        outcome.failures.push({ ...failure, stage: "input-cleanup", error: errorMessage(cleanupError) });
      }
    } finally {
      stopRenewing();
      this.#executions.delete(claim.item.id);
    }
    if (conversationIds.size > 0) outcome.conversationIds = [...conversationIds].sort();
    return outcome;
  }

  async #handleRequest(
    app: RegisteredApp,
    claim: AppInboxClaim,
    request: Readonly<AppInputContext>,
  ): Promise<string | undefined> {
    if (
      app.requests &&
      (app.requests.inputKinds === undefined || app.requests.inputKinds.includes(claim.item.input.kind))
    ) {
      throw new Error("Conversation input requires offline cutover to its Task execution owner");
    }

    const dependency = request.dependency;
    if (dependency?.kind === "task" && REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(dependency.status)) {
      return this.#completeRequest(claim, {
        summary:
          dependency.summary ??
          (dependency.status === "done"
            ? `${request.input.kind} completed`
            : `Task ${dependency.id} requires owner review (${dependency.status})`),
        response: dependency.response,
        result: dependency.result,
        evidence: dependency.evidence,
      });
    }

    return this.#attachRequestTask(app, claim, request);
  }

  #requiredApp(appId: string): RegisteredApp {
    const normalized = requiredText(appId, "App id");
    const app = this.#apps.get(normalized);
    if (!app) throw new Error(`Unknown App: ${normalized}`);
    return app;
  }

  async #authorRequest(item: AppInboxItem): Promise<AppInputContext> {
    const input = await readInputContext(this.#db, item, this.#readDependency);
    return freezeInputContext(this.#prepareInput ? await this.#prepareInput(item, input) : input);
  }

  #assertOwned(claim: AppInboxClaim): void {
    this.#executions.get(claim.item.id)?.controller.signal.throwIfAborted();
    assertAppInboxClaim(this.#db, claim, this.#now());
  }

  #renewClaim(claim: AppInboxClaim, controller: AbortController): () => void {
    const intervalMs = Math.max(10, Math.floor(this.#leaseMs / 3));
    const timer = setInterval(() => {
      try {
        this.#assertOwned(claim);
        if (!renewAppInboxClaim(this.#db, claim, this.#leaseMs, this.#now())) throw new Error("claim is stale");
      } catch (error) {
        clearInterval(timer);
        // Invalidate authority before cancellation/reporting, even if SQLite
        // cannot record the failure. Do not release capacity until it settles.
        controller.abort(error);
        console.error(
          `[app-inbox:${claim.item.appId}:${claim.item.id}:${claim.generation}] ownership lost: ${errorMessage(error)}`,
        );
      }
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  #notifyConversationChanges(items: AppInboxItem[]): void {
    if (!this.#onConversationChanged) return;
    const conversations = new Map<string, string>();
    for (const item of items) {
      if (item.conversationId) conversations.set(item.conversationId, item.appId);
    }
    for (const [conversationId, appId] of conversations) {
      try {
        this.#onConversationChanged(appId, conversationId);
      } catch {
        // Conversation updates are coalescible wakes. A failed observer must
        // never strand the authoritative request claim.
      }
    }
  }

  #completeRequest(claim: AppInboxClaim, result: AppResult): string | undefined {
    completeInboxInput(this.#db, {
      claim,
      result,
      authorize: () => this.#assertOwned(claim),
      now: this.#now(),
    });
    if (this.#onRequestCompleted) {
      try {
        this.#onRequestCompleted(claim.item, result);
      } catch {
        // The accepted result is authoritative. Consumers can recover it by
        // exact request identity; a wake notification cannot undo completion.
      }
    }
    return claim.item.conversationId;
  }

  async #attachRequestTask(
    app: RegisteredApp,
    claim: AppInboxClaim,
    request: Readonly<AppInputContext>,
  ): Promise<string | undefined> {
    if (!app.tasks) throw new Error(`App ${app.id} does not declare Task reconciliation`);
    if (!app.task) throw new Error(`App ${app.id} does not resolve admitted input to a Task`);
    if (!this.#attachTask) throw new Error("App task attachment is not configured");

    if (claim.item.targetTaskId && this.#readDependency) {
      const target: AppDependencyObservation = (await observeTaskDependency(this.#readDependency, app.id, {
        kind: "task",
        id: claim.item.targetTaskId,
      })) ?? { kind: "task", id: claim.item.targetTaskId, status: "unknown" };
      if (target.closed || TERMINAL_TASK_INPUT_STATUSES.has(target.status)) {
        return this.#completeRequest(claim, {
          summary: `Task ${target.id} is already ${target.closed ? "closed" : target.status}; the new input was not applied and must be reconsidered as distinct follow-up work if it still matters.`,
          ...(target.evidence ? { evidence: target.evidence } : {}),
        });
      }
    }

    const currentTaskId = request.dependency?.kind === "task" ? request.dependency.id : undefined;
    const repairedAttachment = currentTaskId ? this.#replacementTaskAttachment(app, claim.item, currentTaskId) : null;
    const attachment = claim.item.targetTaskId
      ? ({ kind: "existing", taskId: claim.item.targetTaskId } as const)
      : (repairedAttachment ??
        (currentTaskId
          ? ({ kind: "existing", taskId: currentTaskId } as const)
          : app.task({ id: request.id, source: request.source, input: request.input })));
    if (!attachment || typeof attachment !== "object") {
      throw new Error(`App ${app.id} task resolver returned no Task attachment`);
    }
    const attached = await this.#attachTask({
      appId: app.id,
      attachment,
      idempotencyKey: repairedAttachment
        ? `task:${claim.item.id}:replace:${claim.generation}`
        : `task:${claim.item.id}`,
      request,
      claim,
      now: this.#now(),
    });
    requiredText(attached.taskId, "Attached task id");
    return claim.item.conversationId;
  }
}
