import { createHash, randomUUID } from "node:crypto";
import {
  appRequestAgentResultSchema,
  matchesEventSelector,
  type AppDependencyObservation,
  type AppConversationResource,
  type AppDefinition,
  type AppEvent,
  type AppInput,
  type AppInputSource,
  type AppRequest,
  type AppRequestDecision,
  type AppRequestDependencyObservation,
  type AppRequestFollowUp,
  type AppRequestOpenRequest,
  type AppRequestTaskControl,
  type AppResult,
  type AppTaskAttachment,
  type EventSelector,
} from "@may-agent/sdk";
import { Check, Errors } from "typebox/value";
import type { SqliteDb } from "../lib/db.js";
import { assertValidAppDefinition } from "./app-definition-validation.js";
import {
  associateAppInboxClaimTopic,
  claimNextAppInboxItem,
  completeAppInboxClaim,
  createConversationTopic,
  createAppInboxItem,
  getAppInboxItem,
  linkConversationTopicTask,
  listAppInboxChildren,
  listOpenConversationTopicRequests,
  listAppInboxTaskDependencyKeys,
  readAppConversationResource,
  readConversationMessageTopicId,
  readConversationTopic,
  releaseAppInboxClaim,
  renewAppInboxClaim,
  waitAppInboxClaim,
  wakeAppInboxItem,
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

export type AppRequestResolver = (input: {
  app: Readonly<AppDefinition>;
  request: Readonly<AppRequest>;
}) => Promise<AppRequestDecision>;

export type AppRequestTaskController = (input: { requestId: string; control: AppRequestTaskControl }) => Promise<void>;

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
  resolveRequest?: AppRequestResolver;
  controlTask?: AppRequestTaskController;
  workerId?: string;
  leaseMs?: number;
  retryAfterMs?: number;
  now?: () => number;
  /** Wake-only notification after a visible Conversation projection change. */
  onConversationChanged?: (appId: string, conversationId: string) => void;
  /** Durable semantic completion notification; transport delivery is separate. */
  onRequestCompleted?: (item: AppInboxItem, result: AppResult) => void;
  /** Notification after one request is durably attached to its exact Task. */
  onRequestTaskAttached?: (item: AppInboxItem, taskId: string) => void;
  /** Wake-only hint after a direct request durably delegates to another App. */
  onRequestDelegated?: (item: AppInboxItem) => void;
  /** Immediate conversational text emitted once while delegated work continues. */
  onRequestMessage?: (item: AppInboxItem, text: string, topicId: string) => void;
  /** Durable handoff from one bounded conversational turn to App-owned follow-up work. */
  onRequestFollowUp?: (item: AppInboxItem, followUp: AppRequestFollowUp, topicId: string) => void;
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
  "done",
  "error",
  "interrupted",
  "unknown",
]);

export const APP_REQUEST_CONVERSATION_MAX_BYTES = 12 * 1_024;
const APP_REQUEST_MESSAGE_BYTES = 7_500;
const APP_REQUEST_MESSAGE_TEXT_BYTES = 2_000;
const APP_REQUEST_REFERENCED_TASK_MAX = 8;
const APP_REQUEST_OPEN_REQUEST_MAX_BYTES = 8_000;
const APP_REQUEST_RECONSIDERATION_MAX = 2;

function encodedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function focusedTaskIdentity(input: AppInput): { appId: string; taskId: string } | null {
  if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) return null;
  const context = (input.data as Record<string, unknown>).context;
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const focusedTask = (context as Record<string, unknown>).focusedTask;
  if (!focusedTask || typeof focusedTask !== "object" || Array.isArray(focusedTask)) return null;
  const value = focusedTask as Record<string, unknown>;
  const appId = typeof value.appId === "string" ? value.appId.trim().replace(/\.app$/, "") : "";
  const taskId = typeof value.taskId === "string" ? value.taskId.trim() : "";
  return appId && taskId ? { appId, taskId } : null;
}

function referencedTaskIdentities(
  conversation: AppConversationResource,
): Array<{ appId: string; taskId: string; ref?: string }> {
  const seen = new Set<string>();
  const result: Array<{ appId: string; taskId: string; ref?: string }> = [];
  for (const message of [...conversation.messages].reverse()) {
    for (const task of message.metadata?.taskRefs ?? []) {
      const key = `${task.appId}\0${task.taskId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(task);
      if (result.length >= APP_REQUEST_REFERENCED_TASK_MAX) return result;
    }
  }
  return result;
}

function requestTaskIdentityKeys(request: Readonly<AppRequest>): Set<string> {
  const identities = new Set<string>();
  if (request.focusedTask) {
    identities.add(`${request.focusedTask.appId}\0${request.focusedTask.task.id}`);
  }
  for (const referenced of request.referencedTasks ?? []) {
    identities.add(`${referenced.appId}\0${referenced.task.id}`);
  }
  const currentTopicId = request.conversation?.current?.topicId;
  const currentTopic = request.conversation?.topics?.find((topic) => topic.id === currentTopicId);
  for (const task of currentTopic?.taskRefs ?? []) {
    identities.add(`${task.appId}\0${task.taskId}`);
  }
  for (const dependency of request.dependencies ?? []) {
    if (dependency.taskId) identities.add(`${dependency.appId}\0${dependency.taskId}`);
  }
  for (const open of request.openRequests ?? []) {
    for (const dependency of open.dependencies) {
      if (dependency.taskId) identities.add(`${dependency.appId}\0${dependency.taskId}`);
    }
  }
  return identities;
}

function openRequestFingerprint(request: Readonly<AppRequest>, topicId: string): string {
  return JSON.stringify(
    (request.openRequests ?? [])
      .filter((open) => open.topicId === topicId)
      .map((open) => ({
        requestId: open.requestId,
        dependencies: open.dependencies.map((dependency) => ({
          requestId: dependency.requestId,
          appId: dependency.appId,
          taskId: dependency.taskId,
        })),
      }))
      .sort((left, right) => left.requestId.localeCompare(right.requestId)),
  );
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
  const available = conversation.messages.filter((candidate) => candidate.metadata?.requestId !== currentRequestId);
  const currentTopicId = conversation.current?.topicId;
  const repliedMessageId = conversation.current?.replyTo;
  const priority = available.filter(
    (candidate) =>
      candidate.id === repliedMessageId || (currentTopicId !== undefined && candidate.metadata?.topicId === currentTopicId),
  );
  const remaining = available.filter((candidate) => !priority.includes(candidate));
  for (const item of [...priority].reverse().concat([...remaining].reverse())) {
    const projected = {
      ...item,
      text: boundedUtf8Text(item.text, APP_REQUEST_MESSAGE_TEXT_BYTES),
    };
    const candidate = [...messages, projected];
    if (encodedBytes(candidate) > APP_REQUEST_MESSAGE_BYTES) continue;
    messages.push(projected);
  }
  messages.sort(
    (left, right) =>
      left.createdAt - right.createdAt || left.sequence - right.sequence || left.id.localeCompare(right.id),
  );

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

function stableId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24)}`;
}

export function stableTopicId(appId: string, conversationId: string, originMessageId: string): string {
  return stableId("topic", appId, conversationId, originMessageId);
}

export function stableChildRequestId(parentRequestId: string, dependencyId: string): string {
  return stableId("appreq", parentRequestId, dependencyId);
}

export function appRequestChildrenWaitId(requestId: string): string {
  return `children:${requiredText(requestId, "App request id")}`;
}

export class AppInboxHost {
  readonly #db: SqliteDb;
  #apps: Map<string, RegisteredApp>;
  #subscriptionsByEventType: Map<string, RegisteredSubscription[]>;
  readonly #readDependency?: AppDependencyReader;
  readonly #attachTask?: AppTaskAttacher;
  readonly #resolveRequest?: AppRequestResolver;
  readonly #controlTask?: AppRequestTaskController;
  readonly #workerId: string;
  readonly #leaseMs: number;
  readonly #retryAfterMs: number;
  readonly #now: () => number;
  readonly #onConversationChanged?: (appId: string, conversationId: string) => void;
  readonly #onRequestCompleted?: (item: AppInboxItem, result: AppResult) => void;
  readonly #onRequestTaskAttached?: (item: AppInboxItem, taskId: string) => void;
  readonly #onRequestDelegated?: (item: AppInboxItem) => void;
  readonly #onRequestMessage?: (item: AppInboxItem, text: string, topicId: string) => void;
  readonly #onRequestFollowUp?: (item: AppInboxItem, followUp: AppRequestFollowUp, topicId: string) => void;
  #taskDependencyRecoveryCursor?: AppInboxTaskDependencyKey;

  constructor(options: AppInboxHostOptions) {
    this.#db = options.db;
    this.#readDependency = options.readDependency;
    this.#attachTask = options.attachTask;
    this.#resolveRequest = options.resolveRequest;
    this.#controlTask = options.controlTask;
    this.#workerId = options.workerId?.trim() || `app-host:${process.pid}:${randomUUID()}`;
    this.#leaseMs = options.leaseMs ?? 60_000;
    this.#retryAfterMs = options.retryAfterMs ?? 1_000;
    this.#now = options.now ?? Date.now;
    this.#onConversationChanged = options.onConversationChanged;
    this.#onRequestCompleted = options.onRequestCompleted;
    this.#onRequestTaskAttached = options.onRequestTaskAttached;
    this.#onRequestDelegated = options.onRequestDelegated;
    this.#onRequestMessage = options.onRequestMessage;
    this.#onRequestFollowUp = options.onRequestFollowUp;
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
    return createAppInboxItem(this.#db, {
      ...input,
      ...(useDefaultConversation
        ? { conversationId: defaultConversationId, conversationSequence: input.originEventId }
        : {}),
      now: this.#now(),
    });
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
          if (!REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(observed.status)) {
            const app = this.#requiredApp(appId);
            const rows = this.#db
              .prepare(
                `SELECT id FROM app_inbox_items
                 WHERE app_id = ? AND status = 'handling' AND lease_owner IS NULL
                   AND waiting_on_kind = 'task' AND waiting_on_id = ?
                 ORDER BY created_at, id`,
              )
              .all(appId, taskId) as Array<{ id?: unknown }>;
            for (const row of rows) {
              if (typeof row.id !== "string") continue;
              const item = getAppInboxItem(this.#db, row.id);
              if (!item || !this.#replacementTaskAttachment(app, item, taskId)) continue;
              if (wakeAppInboxItem(this.#db, item.id, this.#now())) {
                outcome.linked += 1;
                outcome.woken += 1;
                wokenApps.add(appId);
              }
            }
            continue;
          }
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
        const directRequest =
          app.requests &&
          (app.requests.inputKinds === undefined || app.requests.inputKinds.includes(claim.item.input.kind));
        const changedConversation = directRequest
          ? await this.#resolveDirectRequest(app, claim, request)
          : terminalTaskDependency
            ? this.#completeRequest(claim, {
                summary:
                  terminalTaskDependency.summary ??
                  (terminalTaskDependency.status === "done"
                    ? `${request.input.kind} completed`
                    : `Task ${terminalTaskDependency.id} requires owner review (${terminalTaskDependency.status})`),
                response: terminalTaskDependency.response,
                result: terminalTaskDependency.result,
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
          if (claim.item.conversationId) {
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
    const parent = item.parentId ? getAppInboxItem(this.#db, item.parentId) : null;
    const request: AppRequest = {
      id: item.id,
      source: item.source,
      ...(item.source.kind === "human" || parent?.source.kind === "human" ? { humanRequested: true } : {}),
      parentId: item.parentId,
      input: item.input,
    };
    const focusedTask = focusedTaskIdentity(item.input);
    if (focusedTask) {
      let observation: AppDependencyObservation | null = null;
      if (this.#readDependency) {
        try {
          observation = await this.#readDependency({
            appId: focusedTask.appId,
            dependency: { kind: "task", id: focusedTask.taskId },
          });
        } catch {
          // Focus is bounded context, not an admission or execution gate.
        }
      }
      request.focusedTask = {
        appId: focusedTask.appId,
        task: observation ?? { kind: "task", id: focusedTask.taskId, status: "unknown" },
      };
    }
    if (item.conversationId) {
      const contextTopicId =
        item.topicId ??
        (item.replyToSourceId
          ? readConversationMessageTopicId(this.#db, item.appId, item.conversationId, item.replyToSourceId) ?? undefined
          : undefined);
      const conversation = readAppConversationResource(this.#db, item.appId, item.conversationId, {
        limit: 40,
        ...(contextTopicId ? { topicId: contextTopicId } : {}),
      });
      const boundedConversation = boundedAppRequestConversation(
        {
          ...conversation,
          current: {
            messageId: item.source.id,
            ...(item.replyToSourceId ? { replyTo: item.replyToSourceId } : {}),
            ...(contextTopicId ? { topicId: contextTopicId } : {}),
          },
        },
        item.id,
      );
      request.conversation = boundedConversation;
      const openRequests = listOpenConversationTopicRequests(
        this.#db,
        item.appId,
        item.conversationId,
        boundedConversation.topics?.map((topic) => topic.id) ?? [],
        item.id,
      );
      if (openRequests.length > 0) {
        const observed: AppRequestOpenRequest[] = [];
        for (const open of openRequests) {
          const full: AppRequestOpenRequest = {
            requestId: open.id,
            topicId: open.topicId!,
            dependencies: await Promise.all(
              listAppInboxChildren(this.#db, open.id).map((child) => this.#requestDependencyObservation(child)),
            ),
          };
          const candidate =
            encodedBytes([...observed, full]) <= APP_REQUEST_OPEN_REQUEST_MAX_BYTES
              ? full
              : {
                  ...full,
                  dependencies: full.dependencies.map(({ input: _input, ...dependency }) => dependency),
                };
          if (encodedBytes([...observed, candidate]) > APP_REQUEST_OPEN_REQUEST_MAX_BYTES) continue;
          observed.push(candidate);
        }
        if (observed.length > 0) request.openRequests = observed;
      }
      const referencedTasks = referencedTaskIdentities(boundedConversation);
      if (referencedTasks.length > 0) {
        request.referencedTasks = await Promise.all(
          referencedTasks.map(async (identity) => {
            let observation: AppDependencyObservation | null = null;
            try {
              observation = await this.#observeDependency(identity.appId, {
                kind: "task",
                id: identity.taskId,
              });
            } catch {
              // A rendered reference remains useful identity even when its App is no longer readable.
            }
            return {
              appId: identity.appId,
              ...(identity.ref ? { ref: identity.ref } : {}),
              task: observation ?? { kind: "task" as const, id: identity.taskId, status: "unknown" as const },
            };
          }),
        );
      }
    }
    const childRequests = listAppInboxChildren(this.#db, item.id);
    if (childRequests.length > 0) {
      request.dependencies = await Promise.all(childRequests.map((child) => this.#requestDependencyObservation(child)));
    }
    const waitingOn = item.waitingOn;
    if (!waitingOn) return deepFreeze(request);

    if (waitingOn.kind === "app" && waitingOn.id === appRequestChildrenWaitId(item.id)) {
      return deepFreeze(request);
    }

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
            result: child.result?.result,
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

  async #requestDependencyObservation(child: AppInboxItem): Promise<AppRequestDependencyObservation> {
    if (child.waitingOn?.kind === "task") {
      const observed = (await this.#observeDependency(child.appId, {
        kind: "task",
        id: child.waitingOn.id,
      })) ?? { kind: "task" as const, id: child.waitingOn.id, status: "unknown" as const };
      return {
        ...observed,
        requestId: child.id,
        appId: child.appId,
        taskId: child.waitingOn.id,
        input: child.input,
      };
    }
    return {
      kind: "app",
      id: child.id,
      requestId: child.id,
      appId: child.appId,
      ...(child.targetTaskId ? { taskId: child.targetTaskId } : {}),
      status:
        child.status === "done" ? "done" : child.status === "pending" ? "pending" : child.lease ? "running" : "waiting",
      summary: child.result?.summary,
      response: child.result?.response,
      result: child.result?.result,
      evidence: child.result?.evidence,
      input: child.input,
    };
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
    let completed = false;
    withTransaction(this.#db, () => {
      const rowCompleted = completeAppInboxClaim(this.#db, claim, result, this.#now());
      if (!rowCompleted) throw new Error("claim is stale");
      completed = true;
      wakeAppInboxItemsWaitingOn(this.#db, { kind: "app", id: claim.item.id }, this.#now());
      if (claim.item.parentId) {
        wakeAppInboxItemsWaitingOn(
          this.#db,
          { kind: "app", id: appRequestChildrenWaitId(claim.item.parentId) },
          this.#now(),
        );
      }
    });
    if (completed && this.#onRequestCompleted) {
      try {
        this.#onRequestCompleted(claim.item, result);
      } catch {
        // The accepted result is authoritative. Consumers can recover it by
        // exact request identity; a wake notification cannot undo completion.
      }
    }
    return claim.item.conversationId;
  }

  async #resolveDirectRequest(
    app: RegisteredApp,
    claim: AppInboxClaim,
    request: Readonly<AppRequest>,
    reconsiderations = 0,
  ): Promise<string | undefined> {
    if (!this.#resolveRequest) throw new Error("Direct App request resolution is not configured");
    const decision = await this.#resolveRequest({ app, request });
    if (!Check(appRequestAgentResultSchema, decision)) {
      const first = [...Errors(appRequestAgentResultSchema, decision)][0];
      throw new Error(`App ${app.id} returned an invalid request decision: ${first?.message ?? "schema mismatch"}`);
    }
    const dependencies = decision.dependencies ?? [];
    const taskControls = decision.taskControls ?? [];
    const followUp = decision.followUp;
    if (followUp && (dependencies.length > 0 || taskControls.length > 0)) {
      throw new Error(`App ${app.id} request decision cannot combine follow-up with direct Task effects`);
    }
    if (taskControls.length > 0 && dependencies.length > 0) {
      throw new Error(`App ${app.id} request decision cannot control and delegate at the same time`);
    }
    if (!decision.response && !followUp && dependencies.length === 0 && taskControls.length === 0) {
      throw new Error(`App ${app.id} request decision must answer or delegate exact App work`);
    }
    if (followUp && !decision.response) {
      throw new Error(`App ${app.id} request decision must explain its durable follow-up to the human`);
    }
    if (taskControls.length > 0 && !decision.response) {
      throw new Error(`App ${app.id} request decision must explain an applied Task control to the human`);
    }
    if (taskControls.length > 0 && request.source.kind !== "human") {
      throw new Error(`App ${app.id} request decision cannot control Tasks without a direct human turn`);
    }
    const availableTaskIdentities = requestTaskIdentityKeys(request);
    if (decision.topic.kind === "existing") {
      const conversation = request.conversation;
      const topic = conversation
        ? readConversationTopic(this.#db, app.id, conversation.id, decision.topic.id)
        : null;
      if (!topic) throw new Error(`App ${app.id} selected unavailable Topic ${decision.topic.id}`);
      for (const task of topic.taskRefs) availableTaskIdentities.add(`${task.appId}\0${task.taskId}`);
    }
    const controlledTaskIdentities = new Set<string>();
    for (const control of taskControls) {
      const appId = control.appId.trim().replace(/\.app$/, "");
      const taskId = control.taskId.trim();
      const identity = `${appId}\0${taskId}`;
      if (!availableTaskIdentities.has(identity)) {
        throw new Error(`App ${app.id} request decision cannot control unavailable Task ${appId}/${taskId}`);
      }
      if (controlledTaskIdentities.has(identity)) {
        throw new Error(`App ${app.id} request decision repeats Task control ${appId}/${taskId}`);
      }
      controlledTaskIdentities.add(identity);
    }
    if (followUp?.task) {
      const appId = followUp.task.appId.trim().replace(/\.app$/, "");
      const taskId = followUp.task.taskId.trim();
      if (!availableTaskIdentities.has(`${appId}\0${taskId}`)) {
        throw new Error(`App ${app.id} request decision cannot follow unavailable Task ${appId}/${taskId}`);
      }
    }
    if (followUp) {
      const target = this.#requiredApp(followUp.appId);
      if (!target.task || !target.tasks) {
        throw new Error(`App follow-up targets non-Task App ${target.id}`);
      }
      validateInput(target, followUp.input);
      if (followUp.task && followUp.task.appId.trim().replace(/\.app$/, "") !== target.id) {
        throw new Error(`App follow-up Task owner must match target App ${target.id}`);
      }
    }
    const dependencyIds = new Set<string>();
    const reviewedCompletedChildren = new Set(
      (request.dependencies ?? [])
        .filter((dependency) => dependency.status === "done")
        .map((dependency) => dependency.requestId),
    );
    for (const dependency of dependencies) {
      if (dependencyIds.has(dependency.id)) {
        throw new Error(`App ${app.id} request decision repeats dependency ${dependency.id}`);
      }
      dependencyIds.add(dependency.id);
      const target = this.#requiredApp(dependency.appId);
      if (!target.task || !target.tasks) {
        throw new Error(`App request dependency ${dependency.id} targets non-Task App ${target.id}`);
      }
      validateInput(target, dependency.input);
      if (dependency.taskId) {
        const taskId = dependency.taskId.trim();
        const identity = `${target.id}\0${taskId}`;
        if (!availableTaskIdentities.has(identity)) {
          throw new Error(`App ${app.id} request decision cannot continue unavailable Task ${target.id}/${taskId}`);
        }
      }
      if (target.id === app.id) {
        throw new Error(`Direct App request ${request.id} cannot delegate back to ${app.id}`);
      }
    }

    const existingTopicId = claim.item.topicId ?? (decision.topic.kind === "existing" ? decision.topic.id : undefined);
    if (existingTopicId && dependencies.some((dependency) => !dependency.taskId)) {
      const freshRequest = await this.#authorRequest(claim.item);
      if (openRequestFingerprint(freshRequest, existingTopicId) !== openRequestFingerprint(request, existingTopicId)) {
        if (reconsiderations >= APP_REQUEST_RECONSIDERATION_MAX) {
          throw new Error(
            `Conversation work changed repeatedly while App ${app.id} was deciding; retry with fresh context`,
          );
        }
        return this.#resolveDirectRequest(app, claim, freshRequest, reconsiderations + 1);
      }
    }
    const topicId = this.#applyTopicDecision(app, claim, request, decision);
    if ((dependencies.length > 0 || followUp) && !topicId) {
      throw new Error(`Delegated App request ${request.id} requires a Topic`);
    }
    if (taskControls.length > 0) {
      if (!this.#controlTask) throw new Error("Human Task control is not configured");
      for (const control of taskControls) {
        await this.#controlTask({ requestId: request.id, control });
      }
    }
    if (followUp) {
      if (!this.#onRequestFollowUp) throw new Error("App follow-up event publication is not configured");
      this.#onRequestFollowUp(claim.item, followUp, topicId!);
      return this.#completeRequest(claim, {
        summary: decision.summary,
        response: decision.response,
        evidence: decision.evidence,
      });
    }
    if (dependencies.length === 0) {
      return this.#completeRequest(claim, {
        summary: decision.summary,
        response: decision.response,
        evidence: decision.evidence,
      });
    }

    if (decision.response && topicId && this.#onRequestMessage) {
      try {
        this.#onRequestMessage(claim.item, decision.response, topicId);
      } catch {
        // Durable work remains authoritative. The idempotent Conversation
        // message can be recovered independently without duplicating work.
      }
    }

    for (const dependency of dependencies) {
      const childId = stableChildRequestId(request.id, dependency.id);
      const delegated = createAppInboxItem(this.#db, {
        id: childId,
        appId: dependency.appId,
        parentId: request.id,
        targetTaskId: dependency.taskId,
        topicId,
        source: { kind: "app", id: app.id },
        input: dependency.input,
        idempotencyKey: `delegate:${request.id}:${dependency.id}`,
        now: this.#now(),
      });
      if (delegated.item.status !== "done" && this.#onRequestDelegated) {
        try {
          this.#onRequestDelegated(delegated.item);
        } catch {
          // The durable child request is authoritative; the normal ready scan
          // recovers a missed wake without duplicating work.
        }
      }
    }
    if (
      !waitAppInboxClaim(
        this.#db,
        claim,
        { kind: "app", id: appRequestChildrenWaitId(request.id) },
        { now: this.#now() },
      )
    ) {
      throw new Error("claim is stale");
    }
    const unreviewedCompletedChildExists = listAppInboxChildren(this.#db, request.id).some(
      (child) => child.status === "done" && !reviewedCompletedChildren.has(child.id),
    );
    if (unreviewedCompletedChildExists) {
      wakeAppInboxItemsWaitingOn(this.#db, { kind: "app", id: appRequestChildrenWaitId(request.id) }, this.#now());
    }
    return claim.item.conversationId;
  }

  #applyTopicDecision(
    app: RegisteredApp,
    claim: AppInboxClaim,
    request: Readonly<AppRequest>,
    decision: AppRequestDecision,
  ): string | undefined {
    const conversation = request.conversation;
    if (claim.item.topicId) {
      if (!conversation || !readConversationTopic(this.#db, app.id, conversation.id, claim.item.topicId)) {
        throw new Error(`App ${app.id} request ${request.id} has unavailable Topic ${claim.item.topicId}`);
      }
      if (!associateAppInboxClaimTopic(this.#db, claim, claim.item.topicId, this.#now())) {
        throw new Error("claim is stale");
      }
      return claim.item.topicId;
    }
    if (decision.topic.kind === "none") return undefined;
    if (!conversation) throw new Error(`App ${app.id} cannot assign a Topic without a Conversation`);
    let topicId: string;
    if (decision.topic.kind === "existing") {
      const selectedTopicId = decision.topic.id;
      const topic = readConversationTopic(this.#db, app.id, conversation.id, selectedTopicId);
      if (!topic) throw new Error(`App ${app.id} selected unavailable Topic ${selectedTopicId}`);
      topicId = topic.id;
    } else {
      topicId = stableTopicId(app.id, conversation.id, request.source.id);
      createConversationTopic(this.#db, {
        id: topicId,
        appId: app.id,
        conversationId: conversation.id,
        title: decision.topic.title,
        openedBy: request.source.kind,
        originMessageId: conversation.current?.messageId ?? request.source.id,
        now: this.#now(),
      });
    }
    if (!associateAppInboxClaimTopic(this.#db, claim, topicId, this.#now())) {
      throw new Error("claim is stale");
    }
    return topicId;
  }

  async #attachRequestTask(
    app: RegisteredApp,
    claim: AppInboxClaim,
    request: Readonly<AppRequest>,
  ): Promise<string | undefined> {
    if (!app.tasks) throw new Error(`App ${app.id} does not declare Task reconciliation`);
    if (!app.task) throw new Error(`App ${app.id} does not resolve admitted input to a Task`);
    if (!this.#attachTask) throw new Error("App task attachment is not configured");

    if (claim.item.targetTaskId && this.#readDependency) {
      const target: AppDependencyObservation = (await this.#observeDependency(app.id, {
        kind: "task",
        id: claim.item.targetTaskId,
      })) ?? { kind: "task", id: claim.item.targetTaskId, status: "unknown" };
      if (TERMINAL_TASK_INPUT_STATUSES.has(target.status)) {
        return this.#completeRequest(claim, {
          summary: `Task ${target.id} is already ${target.status}; the new input was not applied and must be reconsidered as distinct follow-up work if it still matters.`,
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
    if (claim.item.topicId) {
      linkConversationTopicTask(this.#db, claim.item.topicId, app.id, taskId, this.#now());
    }
    if (this.#onRequestTaskAttached) {
      try {
        this.#onRequestTaskAttached(claim.item, taskId);
      } catch {
        // The durable Task attachment is authoritative. A failed optional
        // presentation hint must never undo or delay the work.
      }
    }
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
    return claim.item.conversationId;
  }
}
