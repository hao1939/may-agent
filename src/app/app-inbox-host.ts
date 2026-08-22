import { randomUUID } from "node:crypto";
import {
  matchesEventSelector,
  type AppDependencyObservation,
  type AppConversationResource,
  type AppDefinition,
  type AppEvent,
  type AppInput,
  type AppInputSource,
  type AppRequest,
  type AppResult,
  type AppTaskAttachment,
} from "@may-agent/sdk";
import { Check, Errors } from "typebox/value";
import type { SqliteDb } from "../lib/db.js";
import { assertValidAppDefinition } from "./app-definition-validation.js";
import {
  claimNextAppInboxItem,
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  readAppConversationResource,
  listAppInboxTaskDependencyKeys,
  releaseAppInboxClaim,
  renewAppInboxClaim,
  waitAppInboxClaim,
  wakeAppInboxItemsWaitingOn,
  wakeAppInboxItemsWaitingOnApp,
  type AppInboxClaim,
  type AppInboxItem,
  type AppInboxWaitKind,
  type AppInboxTaskDependencyKey,
} from "./app-inbox-store.js";

export type AppDependencyReader = (input: {
  appId: string;
  dependency: { kind: "task"; id: string };
}) => Promise<AppDependencyObservation | null>;

/**
 * The task engine must treat idempotencyKey as stable admission identity.
 * This keeps a retry from creating duplicate durable task work.
 */
export type AppTaskAttacher = (input: {
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
  request: Readonly<AppRequest>;
}) => Promise<{
  taskId: string;
  /**
   * Checked only after the durable wait link exists. This closes the race where
   * task convergence happens immediately before or while the link is written.
   */
  isComplete?: () => Promise<boolean>;
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

export type AppInboxReconcileResult = {
  claimed: number;
  admitted: number;
  released: number;
  errors: string[];
  /** Conversations whose visible messages or active-work projection changed. */
  conversationIds?: string[];
};

export type AppInboxTaskRecoveryResult = {
  linked: number;
  woken: number;
  wokenAppIds: string[];
  errors: string[];
};

export type AppInboxHostOptions = {
  db: SqliteDb;
  apps: AppDefinition[];
  readDependency?: AppDependencyReader;
  attachTask?: AppTaskAttacher;
  workerId?: string;
  leaseMs?: number;
  retryAfterMs?: number;
  now?: () => number;
  /** Wake-only notification after a visible Conversation projection change. */
  onConversationChanged?: (appId: string, conversationId: string) => void;
  /** Durable semantic completion notification; transport delivery is separate. */
  onRequestCompleted?: (item: AppInboxItem, result: AppResult) => void;
};

type RegisteredApp = AppDefinition;

const REVIEWABLE_TASK_DEPENDENCY_STATUSES = new Set<AppDependencyObservation["status"]>([
  "attention",
  "done",
  "error",
  "interrupted",
  "unknown",
]);

export const APP_REQUEST_CONVERSATION_MAX_BYTES = 12 * 1_024;
const APP_REQUEST_MESSAGE_BYTES = 7_500;
const APP_REQUEST_MESSAGE_TEXT_BYTES = 2_000;

function encodedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function boundedUtf8Text(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const characters: string[] = [];
  let bytes = 0;
  const suffixBytes = Buffer.byteLength("…", "utf8");
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes + suffixBytes > maxBytes) break;
    characters.push(character);
    bytes += characterBytes;
  }
  return `${characters.join("").trimEnd()}…`;
}

/** Keep ordinary May context proportional to the current turn, not Conversation history. */
export function boundedAppRequestConversation(
  conversation: AppConversationResource,
  currentRequestId: string,
): AppConversationResource {
  const messages: AppConversationResource["messages"] = [];
  for (const item of [...conversation.messages]
    .filter((candidate) => candidate.metadata?.requestId !== currentRequestId)
    .reverse()) {
    const projected = {
      ...item,
      text: boundedUtf8Text(item.text, APP_REQUEST_MESSAGE_TEXT_BYTES),
    };
    const candidate = [projected, ...messages];
    if (encodedBytes(candidate) > APP_REQUEST_MESSAGE_BYTES) continue;
    messages.unshift(projected);
  }

  const result: AppConversationResource = {
    ...conversation,
    messages,
  };
  if (encodedBytes(result) > APP_REQUEST_CONVERSATION_MAX_BYTES) {
    throw new Error("Bounded Conversation context exceeded its byte contract");
  }
  return result;
}

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

function withTransaction<T>(db: SqliteDb, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export class AppInboxHost {
  readonly #db: SqliteDb;
  readonly #apps: Map<string, RegisteredApp>;
  readonly #readDependency?: AppDependencyReader;
  readonly #attachTask?: AppTaskAttacher;
  readonly #workerId: string;
  readonly #leaseMs: number;
  readonly #retryAfterMs: number;
  readonly #now: () => number;
  readonly #onConversationChanged?: (appId: string, conversationId: string) => void;
  readonly #onRequestCompleted?: (item: AppInboxItem, result: AppResult) => void;
  #taskDependencyRecoveryCursor?: AppInboxTaskDependencyKey;

  constructor(options: AppInboxHostOptions) {
    this.#db = options.db;
    this.#readDependency = options.readDependency;
    this.#attachTask = options.attachTask;
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
    for (const definition of definitions) {
      const app = validateAppDefinition(definition);
      if (next.has(app.id)) throw new Error(`Duplicate App id: ${app.id}`);
      next.set(app.id, app);
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
        throw new Error(`Cannot remove App ${appId} while it owns pending event admission commands`);
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
    this.#apps.clear();
    for (const [id, app] of next) this.#apps.set(id, app);
  }

  acceptsInput(appId: string, input: AppInput): boolean {
    const app = this.#apps.get(appId.trim());
    return Boolean(app && Check(app.inputSchema, input));
  }

  matchingAppIds(owner: string, input: AppInput): string[] {
    const normalizedOwner = requiredText(owner, "App owner").replace(/^agent:/, "");
    return [...this.#apps.values()]
      .filter((app) => app.owner.trim().replace(/^agent:/, "") === normalizedOwner && Check(app.inputSchema, input))
      .map((app) => app.id)
      .sort();
  }

  subscriptionInputs(event: AppEvent<Record<string, unknown>>): Array<{
    appId: string;
    subscriptionId: string;
    input: AppInput;
  }> {
    const matches: Array<{ appId: string; subscriptionId: string; input: AppInput }> = [];
    for (const app of this.#apps.values()) {
      for (const subscription of app.subscriptions ?? []) {
        if (!matchesEventSelector(subscription.event, event)) continue;
        const input = subscription.toInput(event);
        if (input === null) continue;
        validateInput(app, input);
        matches.push({ appId: app.id, subscriptionId: subscription.id, input });
      }
    }
    return matches;
  }

  isOwnedApp(appId: string, owner: string): boolean {
    const app = this.#apps.get(appId.trim());
    const normalizedOwner = owner.trim().replace(/^(?:agent|app):/, "");
    return Boolean(
      app &&
      (app.id.trim().replace(/^app:/, "") === normalizedOwner ||
        app.owner.trim().replace(/^agent:/, "") === normalizedOwner),
    );
  }

  admit(input: AdmitAppInput): { item: AppInboxItem; created: boolean } {
    const app = this.#requiredApp(input.appId);
    validateInput(app, input.input);
    return createAppInboxItem(this.#db, { ...input, now: this.#now() });
  }

  get(id: string): AppInboxItem | null {
    return getAppInboxItem(this.#db, id);
  }

  readyCount(appId: string): number {
    const app = this.#requiredApp(appId);
    const now = this.#now();
    const row = this.#db
      .prepare(
        `SELECT 1 AS ready FROM (
           SELECT app_id FROM app_inbox_items INDEXED BY idx_app_inbox_available
             WHERE app_id = ? AND status != 'done' AND lease_owner IS NULL
               AND available_at IS NOT NULL AND available_at <= ?
           UNION ALL
           SELECT app_id FROM app_inbox_items INDEXED BY idx_app_inbox_expired
             WHERE app_id = ? AND status != 'done'
               AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
         ) LIMIT 1`,
      )
      .get(app.id, now, app.id, now);
    return row ? 1 : 0;
  }

  /** Apps with claimable inbox work, derived only from ready/expired indexes. */
  readyAppIds(): string[] {
    const now = this.#now();
    const loaded = this.#apps;
    const rows = this.#db
      .prepare(
        `SELECT DISTINCT app_id FROM (
           SELECT app_id FROM app_inbox_items INDEXED BY idx_app_inbox_available
             WHERE status != 'done' AND lease_owner IS NULL
               AND available_at IS NOT NULL AND available_at <= ?
           UNION ALL
           SELECT app_id FROM app_inbox_items INDEXED BY idx_app_inbox_expired
             WHERE status != 'done'
               AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
         ) ORDER BY app_id`,
      )
      .all(now, now) as Array<{ app_id?: unknown }>;
    return rows.flatMap((row) => (typeof row.app_id === "string" && loaded.has(row.app_id) ? [row.app_id] : []));
  }

  maxConcurrent(appId: string): number {
    return this.#requiredApp(appId).inbox?.maxConcurrent ?? 1;
  }

  wake(waitingOn: { kind: AppInboxWaitKind; id: string }): number {
    return wakeAppInboxItemsWaitingOn(this.#db, waitingOn, this.#now());
  }

  /** Wake one exact dependency and return only the Apps that gained ready work. */
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
             AND (available_at IS NULL OR available_at > ? OR review_at IS NOT NULL)
           ORDER BY app_id`,
        )
        .all(waitingOn.kind, requiredText(waitingOn.id, "waitingOn.id"), ...(scope ? [scope] : []), now) as Array<{
        app_id?: unknown;
      }>;
      if (rows.length === 0) return;
      const woken = scope
        ? wakeAppInboxItemsWaitingOnApp(this.#db, scope, waitingOn, now)
        : wakeAppInboxItemsWaitingOn(this.#db, waitingOn, now);
      if (woken === 0) return;
      for (const row of rows) {
        if (typeof row.app_id === "string" && row.app_id.trim()) appIds.push(row.app_id.trim());
      }
    });
    return appIds;
  }

  /** Re-observe task waits so attention or missing tasks cannot wait forever. */
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
    const taskIdsByApp = new Map<string, string[]>();
    for (const dependency of page.items) {
      const taskIds = taskIdsByApp.get(dependency.appId) ?? [];
      taskIds.push(dependency.taskId);
      taskIdsByApp.set(dependency.appId, taskIds);
    }
    for (const [appId, taskIds] of taskIdsByApp) {
      for (const taskId of taskIds) {
        const taskDependency = { kind: "task", id: taskId } as const;
        try {
          const observed = (await this.#observeDependency(appId, taskDependency)) ?? {
            ...taskDependency,
            status: "unknown" as const,
          };
          if (!REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(observed.status)) continue;
          const woken = wakeAppInboxItemsWaitingOnApp(this.#db, appId, taskDependency, this.#now());
          if (woken > 0) {
            outcome.woken += woken;
            wokenApps.add(appId);
          }
        } catch (error) {
          outcome.errors.push(`App ${appId} task ${taskDependency.id}: ${errorMessage(error)}`);
        }
      }
      // Each App may own a multi-megabyte canonical Task resource. Let HTTP,
      // event admission, and other Apps run between bounded per-App reads.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    outcome.wokenAppIds = [...wokenApps].sort();
    return outcome;
  }

  async reconcileOnce(appId: string): Promise<AppInboxReconcileResult> {
    const app = this.#requiredApp(appId);
    const claim = claimNextAppInboxItem(this.#db, app.id, this.#workerId, this.#leaseMs, this.#now());
    if (!claim) return { claimed: 0, admitted: 0, released: 0, errors: [] };
    this.#notifyConversationChanges([claim.item]);

    const stopRenewing = this.#renewClaim(claim);
    const outcome: AppInboxReconcileResult = { claimed: 1, admitted: 0, released: 0, errors: [] };
    const conversationIds = new Set<string>();
    try {
      try {
        const request = await this.#authorRequest(claim.item);
        const terminalTaskDependency =
          request.dependency?.kind === "task" && REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(request.dependency.status)
            ? request.dependency
            : undefined;
        const changedConversation = terminalTaskDependency
          ? this.#completeRequest(claim, {
              summary:
                terminalTaskDependency.summary ??
                (terminalTaskDependency.status === "done"
                  ? `${request.input.kind} completed`
                  : `Task ${terminalTaskDependency.id} requires owner review (${terminalTaskDependency.status})`),
              response: terminalTaskDependency.response,
              evidence: terminalTaskDependency.evidence,
            })
          : await this.#attachRequestTask(app, claim, request);
        if (changedConversation) conversationIds.add(changedConversation);
        outcome.admitted = 1;
      } catch (error) {
        outcome.errors.push(`Request ${claim.item.id}: ${errorMessage(error)}`);
        if (
          releaseAppInboxClaim(this.#db, claim, {
            retryAfterMs: this.#retryAfterMs,
            now: this.#now(),
          })
        ) {
          outcome.released = 1;
          if (claim.item.source.kind === "human" && claim.item.conversationId) {
            conversationIds.add(claim.item.conversationId);
          }
        }
      }
    } finally {
      stopRenewing();
    }
    if (conversationIds.size > 0) outcome.conversationIds = [...conversationIds].sort();
    return outcome;
  }

  #requiredApp(appId: string): RegisteredApp {
    const normalized = requiredText(appId, "App id");
    const app = this.#apps.get(normalized);
    if (!app) throw new Error(`Unknown App: ${normalized}`);
    return app;
  }

  async #authorRequest(item: AppInboxItem): Promise<AppRequest> {
    const request: AppRequest = {
      id: item.id,
      source: item.source,
      parentId: item.parentId,
      input: item.input,
    };
    if (item.conversationId) {
      const conversation = readAppConversationResource(this.#db, item.appId, item.conversationId, { limit: 40 });
      request.conversation = boundedAppRequestConversation(
        {
          ...conversation,
          current: {
            messageId: item.source.id,
            ...(item.replyToSourceId ? { replyTo: item.replyToSourceId } : {}),
          },
        },
        item.id,
      );
    }
    const waitingOn = item.waitingOn;
    if (!waitingOn) return deepFreeze(request);

    if (waitingOn.kind === "app") {
      const child = getAppInboxItem(this.#db, waitingOn.id);
      request.dependency = child
        ? {
            kind: "app",
            id: child.id,
            status:
              child.status === "done"
                ? "done"
                : child.status === "pending"
                  ? "pending"
                  : child.lease
                    ? "running"
                    : "waiting",
            summary: child.result?.summary,
            response: child.result?.response,
            evidence: child.result?.evidence,
          }
        : { kind: "app", id: waitingOn.id, status: "unknown" };
      return deepFreeze(request);
    }

    // Legacy session/analysis waits are not part of the Task-only contract.
    // If an old terminal Event wakes one, reclaim the request as fresh Task work.
    if (waitingOn.kind !== "task") return deepFreeze(request);
    const dependency = { kind: "task", id: waitingOn.id } as const;

    const observed = await this.#observeDependency(item.appId, dependency);
    request.dependency = observed ?? { ...dependency, status: "unknown" };
    return deepFreeze(request);
  }

  async #observeDependency(
    appId: string,
    dependency: { kind: "task"; id: string },
  ): Promise<AppDependencyObservation | null> {
    const observed = await this.#readDependency?.({ appId, dependency });
    if (observed && (observed.kind !== dependency.kind || observed.id !== dependency.id)) {
      throw new Error(`Dependency reader returned a mismatched observation for ${dependency.kind}:${dependency.id}`);
    }
    return observed ?? null;
  }

  #renewClaim(claim: AppInboxClaim): () => void {
    const intervalMs = Math.max(10, Math.floor(this.#leaseMs / 3));
    const timer = setInterval(() => {
      renewAppInboxClaim(this.#db, claim, this.#leaseMs, this.#now());
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  #notifyConversationChanges(items: AppInboxItem[]): void {
    if (!this.#onConversationChanged) return;
    const conversations = new Map<string, string>();
    for (const item of items) {
      if (item.source.kind === "human" && item.conversationId) conversations.set(item.conversationId, item.appId);
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
    let completed = false;
    withTransaction(this.#db, () => {
      const rowCompleted = completeAppInboxClaim(this.#db, claim, result, this.#now());
      if (!rowCompleted) throw new Error("claim is stale");
      completed = true;
      wakeAppInboxItemsWaitingOn(this.#db, { kind: "app", id: claim.item.id }, this.#now());
    });
    if (completed && this.#onRequestCompleted) {
      try {
        this.#onRequestCompleted(claim.item, result);
      } catch {
        // The accepted result is authoritative. Consumers can recover it by
        // exact request identity; a wake notification cannot undo completion.
      }
    }
    return claim.item.source.kind === "human" ? claim.item.conversationId : undefined;
  }

  async #attachRequestTask(
    app: RegisteredApp,
    claim: AppInboxClaim,
    request: Readonly<AppRequest>,
  ): Promise<string | undefined> {
    if (!app.tasks) throw new Error(`App ${app.id} does not declare Task reconciliation`);
    if (!app.task) throw new Error(`App ${app.id} does not resolve admitted input to a Task`);
    if (!this.#attachTask) throw new Error("App task attachment is not configured");

    const attachment =
      request.dependency?.kind === "task"
        ? ({ kind: "existing", taskId: request.dependency.id } as const)
        : app.task({ id: request.id, source: request.source, input: request.input });
    if (!attachment || typeof attachment !== "object") {
      throw new Error(`App ${app.id} task resolver returned no Task attachment`);
    }
    const attachmentIdentity =
      attachment.kind === "existing"
        ? `existing:${requiredText(attachment.taskId, "Existing task id")}`
        : `desired:${requiredText(attachment.intent.id, "Desired task intent id")}`;
    const attached = await this.#attachTask({
      appId: app.id,
      attachment,
      idempotencyKey: `task:${claim.item.id}:${attachmentIdentity}`,
      request,
    });
    const taskId = requiredText(attached.taskId, "Attached task id");
    const waiting = waitAppInboxClaim(this.#db, claim, { kind: "task", id: taskId }, { now: this.#now() });
    if (!waiting) throw new Error("claim is stale");
    if (attached.isComplete) {
      try {
        if (await attached.isComplete()) {
          wakeAppInboxItemsWaitingOnApp(this.#db, claim.item.appId, { kind: "task", id: taskId }, this.#now());
        }
      } catch {
        // The durable completion Event remains authoritative. A failed
        // completion-before-link check must not undo the exact Task wait.
      }
    }
    return claim.item.source.kind === "human" ? claim.item.conversationId : undefined;
  }
}
