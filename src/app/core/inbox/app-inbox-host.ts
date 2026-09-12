import { readInputContext, observeTaskDependency, type AppDependencyReader } from "./input-context.js";
import { completeTaskInput, recoverTaskInputAdmissionKey } from "../state/inbox.js";
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
  createAppInboxItem,
  getAppInboxItem,
  listAppInboxItemsWaitingOnTask,
  listAppInboxTaskDependencyKeys,
  type AppTurnTarget,
  type AppInboxItem,
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
  /** Persist the input-to-Task link in the Task admission transaction. */
  inboxInputId?: string;
  now?: number;
  /** Revalidate the originating turn inside the Task admission transaction. */
  authorize?: () => void;
  topicId?: string;
  requestLink?: { appId: string; conversationId: string; id: string; revision: number };
}) => { taskId: string };

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
  appId?: string;
  taskId?: string;
  stage: string;
  error: string;
  disposition: string;
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
  now?: () => number;
  /** Wake-only notification after a visible Conversation projection change. */
  onConversationChanged?: (appId: string, conversationId: string) => void;
  /** Notification of saved caller feedback; a blocker does not complete input. */
  onRequestUpdated?: (item: AppInboxItem, result: AppResult, status: "done" | "blocked") => void;
  onFailure?: (failure: AppInboxFailure) => void;
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
  readonly #admitConversation?: AppInboxHostOptions["admitConversation"];
  readonly #stopConversationTurn?: AppInboxHostOptions["stopConversationTurn"];
  readonly #now: () => number;
  readonly #onConversationChanged?: (appId: string, conversationId: string) => void;
  readonly #onRequestUpdated?: AppInboxHostOptions["onRequestUpdated"];
  readonly #onFailure?: AppInboxHostOptions["onFailure"];
  #closed = false;
  #admissionCursor?: string;
  #resultCursor?: AppInboxTaskDependencyKey;

  constructor(options: AppInboxHostOptions) {
    this.#admitConversation = options.admitConversation;
    this.#stopConversationTurn = options.stopConversationTurn;
    this.#db = options.db;
    this.#readDependency = options.readDependency;
    this.#attachTask = options.attachTask;
    this.#now = options.now ?? Date.now;
    this.#onConversationChanged = options.onConversationChanged;
    this.#onRequestUpdated = options.onRequestUpdated;
    this.#onFailure = options.onFailure;
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
    if (this.#closed) throw new Error("App input admission is closed");
    const app = this.#requiredApp(input.appId);
    validateInput(app, input.input);
    const conversationInput = Boolean(
      app.requests && (!app.requests.inputKinds || app.requests.inputKinds.includes(input.input.kind)),
    );
    const defaultConversationId = app.requests?.conversationId?.trim();
    const useDefaultConversation =
      conversationInput &&
      input.conversationId === undefined &&
      defaultConversationId !== undefined &&
      input.originEventId !== undefined;
    const prepared = {
      ...input,
      ...(useDefaultConversation
        ? { conversationId: defaultConversationId, conversationSequence: input.originEventId }
        : {}),
      now: this.#now(),
    };
    if (conversationInput) {
      if (!this.#admitConversation) throw new Error("Conversation Task admission is not configured");
      return this.#admitConversation({
        ...prepared,
        conversationId: prepared.conversationId ?? defaultConversationId ?? `${app.id}:primary`,
      });
    }
    // Keep the receipt if App mapping or Task storage is temporarily unavailable.
    // Only Task admission and its exact return link need an atomic commit.
    const admitted = createAppInboxItem(this.#db, prepared);
    this.#admitTask(admitted.item);
    return { ...admitted, item: this.get(admitted.item.id)! };
  }

  get(id: string): AppInboxItem | null {
    return getAppInboxItem(this.#db, id);
  }

  stopTurn(target: AppTurnTarget): void {
    this.#requiredApp(target.appId);
    if (!this.#stopConversationTurn) throw new Error("Conversation Task control is not configured");
    this.#stopConversationTurn(target);
  }

  close(): void {
    this.#closed = true;
  }

  #requiredApp(appId: string): RegisteredApp {
    const normalized = requiredText(appId, "App id");
    const app = this.#apps.get(normalized);
    if (!app) throw new Error(`Unknown App: ${normalized}`);
    return app;
  }

  #failure(item: AppInboxItem, stage: string, error: unknown): void {
    try {
      this.#onFailure?.({
        appId: item.appId,
        requestId: item.id,
        conversationId: item.conversationId,
        agent: this.#apps.get(item.appId)?.agent ?? this.#apps.get(item.appId)?.owner,
        stage,
        error: errorMessage(error),
        disposition: "recovery-pending",
      });
    } catch {
      // Diagnostics cannot discard durable input or change its accepted result.
    }
  }

  #admitTask(item: AppInboxItem): void {
    if (item.status === "done" || item.executionTaskId) return;
    if (item.lease && item.lease.expiresAt > this.#now()) return;
    try {
      const app = this.#requiredApp(item.appId);
      if (app.requests && (!app.requests.inputKinds || app.requests.inputKinds.includes(item.input.kind)))
        throw new Error("Conversation input requires offline cutover to its Task execution owner");
      if (item.waitingOn?.kind === "task") {
        // An old Host may have stopped while projecting an already attached
        // input. Fence only that expired, ordinary input claim; never remap it.
        if (item.lease)
          this.#db
            .prepare(
              `UPDATE app_inbox_items SET lease_owner = NULL, lease_expires_at = NULL
          WHERE id = ? AND lease_owner = ? AND lease_generation = ? AND lease_expires_at <= ?`,
            )
            .run(item.id, item.lease.owner, item.lease.generation, this.#now());
        return;
      }
      if (!app.tasks || !app.task) throw new Error(`App ${app.id} does not resolve input to Task work`);
      if (!this.#attachTask) throw new Error("App task admission is not configured");
      validateInput(app, item.input);
      const request = readInputContext(this.#db, item);
      const attachment = item.targetTaskId
        ? { kind: "existing" as const, taskId: item.targetTaskId }
        : app.task(request);
      if (!attachment || typeof attachment !== "object")
        throw new Error(`App ${app.id} task resolver returned no Task attachment`);
      this.#attachTask({
        appId: app.id,
        attachment,
        request,
        inboxInputId: item.id,
        idempotencyKey: `task:${item.id}`,
        now: this.#now(),
        topicId: item.topicId,
      });
    } catch (error) {
      // Recovery has a fixed cadence; new unrelated inputs do not retry this row.
      this.#failure(item, "input-admission", error);
    }
  }

  /** Retry one bounded page of unadmitted inputs. No execution claims or capacity. */
  async recoverAdmissions(): Promise<void> {
    if (this.#closed) return;
    const readPage = () =>
      this.#db
        .prepare(
          `SELECT id FROM app_inbox_items
      WHERE status != 'done' AND execution_task_id IS NULL
        AND (waiting_on_kind IS NULL OR waiting_on_kind != 'task' OR lease_owner IS NOT NULL)
        AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
        ${this.#admissionCursor ? "AND id > ?" : ""}
      ORDER BY id LIMIT 64`,
        )
        .all(this.#now(), ...(this.#admissionCursor ? [this.#admissionCursor] : []));
    let rows = readPage();
    if (!rows.length && this.#admissionCursor) {
      this.#admissionCursor = undefined;
      rows = readPage();
    }
    this.#admissionCursor = rows.length === 64 ? String(rows.at(-1)!.id) : undefined;
    for (const row of rows) {
      if (this.#closed) return;
      const item = this.get(String(row.id));
      if (item && this.#apps.has(item.appId)) this.#admitTask(item);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  /** Project exact accepted outcomes; Task failure/retry is not input completion. */
  async refreshTaskResults(appId: string, taskId: string): Promise<void> {
    if (this.#closed) return;
    for (const item of listAppInboxItemsWaitingOnTask(this.#db, appId, taskId)) await this.#projectTaskResult(item);
  }

  async #projectTaskResult(item: AppInboxItem): Promise<void> {
    if (this.#closed || !this.#readDependency || item.status === "done" || item.waitingOn?.kind !== "task") return;
    try {
      const admissionKey = recoverTaskInputAdmissionKey(this.#db, item);
      if (!admissionKey)
        throw new Error("Input has no unambiguous Task admission; repair its saved link before returning a result");
      const observed = await observeTaskDependency(
        this.#readDependency,
        item.appId,
        { kind: "task", id: item.waitingOn.id },
        admissionKey,
      );
      if (this.#closed || !observed) return;
      if (!REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(observed.status)) {
        if (observed.report) this.#onRequestUpdated?.(item, observed.report, "blocked");
        return;
      }
      const result: AppResult = {
        summary: observed.summary ?? `Task ${observed.id} requires owner review (${observed.status})`,
        response: observed.response,
        result: observed.result,
        evidence: observed.evidence,
      };
      if (!completeTaskInput(this.#db, { ...item, taskAdmissionKey: admissionKey }, result, this.#now())) return;
      try {
        this.#onRequestUpdated?.(item, result, "done");
        if (item.conversationId) this.#onConversationChanged?.(item.appId, item.conversationId);
      } catch {
        // The accepted result remains readable even if its notification fails.
      }
    } catch (error) {
      this.#failure(item, "input-result", error);
    }
  }

  /** Repair missed result notifications with a bounded, yielding scan. */
  async recoverTaskResults(): Promise<void> {
    if (this.#closed) return;
    let page = listAppInboxTaskDependencyKeys(this.#db, { after: this.#resultCursor });
    if (page.items.length === 0 && this.#resultCursor) {
      this.#resultCursor = undefined;
      page = listAppInboxTaskDependencyKeys(this.#db);
    }
    this.#resultCursor = page.nextCursor;
    for (const { inputId } of page.items) {
      if (this.#closed) return;
      const item = this.get(inputId);
      if (item && this.#apps.has(item.appId)) await this.#projectTaskResult(item);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
}
