import { createHash, randomUUID } from "node:crypto";
import {
  matchesEventSelector,
  type AppDependencyObservation,
  type AppDefinition,
  type AppAnalysisRequest,
  type AppDisposition,
  type AppEvent,
  type AppInput,
  type AppInputSource,
  type AppRequest,
  type AppTaskAttachment,
  type AppWorkDisposition,
} from "@may-agent/sdk";
import { Check, Errors } from "typebox/value";
import type { SqliteDb } from "../lib/db.js";
import { assertValidAppDefinition } from "./app-definition-validation.js";
import {
  associateAppInboxClaimSession,
  claimNextAppInboxItem,
  claimNextAppInboxDelivery,
  claimReferencedAppInboxWork,
  completeAppInboxContinuation,
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  listAppInboxHealth,
  listAppInboxAssociatedSessionClaims,
  readAppConversationResource,
  listAppInboxDependencyWaits,
  listUnlinkedAppDelegations,
  listAppInboxSessionWaits,
  markAppInboxSendingDeliveriesUncertain,
  recordAppInboxDeliveryReceipt,
  releaseAppInboxClaim,
  restoreReplayableAppInboxDeliveries,
  restorePendingAppInboxDelivery,
  renewAppInboxClaim,
  stageAppInboxClaimDelivery,
  stageAppInboxProgressDelivery,
  waitAppInboxClaim,
  wakeAppInboxItemsWaitingOn,
  type AppInboxClaim,
  type AppInboxDeliveryDispatch,
  type AppInboxDeliveryReceipt,
  type AppInboxItem,
  type AppInboxWaitKind,
} from "./app-inbox-store.js";

export type AppOwnerDispositionResult = {
  requestId: string;
  disposition: AppDisposition;
};

export type AppOwnerInvoker = (input: {
  app: AppDefinition;
  requests: AppRequest[];
  transport?: {
    channel: string;
    channelThreadId?: string;
    channelMessageId?: number;
    conversationId?: string;
  };
  onSessionStarted(sessionId: string): void;
}) => Promise<AppOwnerDispositionResult[]>;

export type AppDependencyReader = (input: {
  appId: string;
  dependency: { kind: "task" | "session" | "analysis"; id: string };
}) => Promise<AppDependencyObservation | null>;

/** Host-private admission boundary for one May-owned analysis attempt. */
export type AppAnalysisAttacher = (input: {
  appId: "may";
  analysis: AppAnalysisRequest;
  idempotencyKey: string;
  request: Readonly<AppRequest>;
}) => Promise<{
  analysisId: string;
  /** Closes completion-before-link races after the exact wait is durable. */
  isComplete?: () => Promise<boolean>;
}>;

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

export type AppInboxSessionRecoveryResult = {
  linked: number;
  woken: number;
  wokenAppIds: string[];
  errors: string[];
};

export type AppDelegationIntent = {
  appId: string;
  parentId: string;
  source: AppInputSource;
  input: AppInput;
  idempotencyKey: string;
};

export const APP_INBOX_RECOVERY_OWNER = "app-inbox";

export type AppInboxHostOptions = {
  db: SqliteDb;
  apps: AppDefinition[];
  invokeOwner: AppOwnerInvoker;
  readDependency?: AppDependencyReader;
  attachTask?: AppTaskAttacher;
  attachAnalysis?: AppAnalysisAttacher;
  workerId?: string;
  leaseMs?: number;
  retryAfterMs?: number;
  maxBatchSize?: number;
  now?: () => number;
  /** Wake-only notification after a visible Conversation projection change. */
  onConversationChanged?: (appId: string, conversationId: string) => void;
};

type RegisteredApp = AppDefinition;

const TERMINAL_SESSION_DEPENDENCY_STATUSES = new Set<AppDependencyObservation["status"]>([
  "done",
  "error",
  "interrupted",
]);

const REVIEWABLE_TASK_DEPENDENCY_STATUSES = new Set<AppDependencyObservation["status"]>([
  "attention",
  "done",
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

function validateCompleteDisposition(disposition: Extract<AppDisposition, { type: "complete" }>): void {
  requiredText(disposition.summary, "Complete disposition summary");
  if (disposition.response !== undefined && typeof disposition.response !== "string") {
    throw new Error("Complete disposition response must be a string");
  }
  if (
    disposition.evidence !== undefined &&
    (!Array.isArray(disposition.evidence) || disposition.evidence.some((entry) => typeof entry !== "string"))
  ) {
    throw new Error("Complete disposition evidence must be an array of strings");
  }
}

function analysisIdentity(analysis: AppAnalysisRequest): string {
  return createHash("sha256").update(JSON.stringify(analysis)).digest("hex").slice(0, 16);
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
  readonly #invokeOwner: AppOwnerInvoker;
  readonly #readDependency?: AppDependencyReader;
  readonly #attachTask?: AppTaskAttacher;
  readonly #attachAnalysis?: AppAnalysisAttacher;
  readonly #workerId: string;
  readonly #leaseMs: number;
  readonly #retryAfterMs: number;
  readonly #maxBatchSize: number;
  readonly #now: () => number;
  readonly #onConversationChanged?: (appId: string, conversationId: string) => void;

  constructor(options: AppInboxHostOptions) {
    this.#db = options.db;
    this.#invokeOwner = options.invokeOwner;
    this.#readDependency = options.readDependency;
    this.#attachTask = options.attachTask;
    this.#attachAnalysis = options.attachAnalysis;
    this.#workerId = options.workerId?.trim() || `app-host:${process.pid}:${randomUUID()}`;
    this.#leaseMs = options.leaseMs ?? 60_000;
    this.#retryAfterMs = options.retryAfterMs ?? 1_000;
    this.#maxBatchSize = options.maxBatchSize ?? 8;
    this.#now = options.now ?? Date.now;
    this.#onConversationChanged = options.onConversationChanged;
    if (!Number.isFinite(this.#leaseMs) || this.#leaseMs <= 0) throw new Error("App host leaseMs must be positive");
    if (!Number.isFinite(this.#retryAfterMs) || this.#retryAfterMs < 0) {
      throw new Error("App host retryAfterMs must be finite and non-negative");
    }
    if (!Number.isSafeInteger(this.#maxBatchSize) || this.#maxBatchSize <= 0) {
      throw new Error("App host maxBatchSize must be a positive safe integer");
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

  actionInput(appId: string, actionId: string, params: unknown): AppInput {
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
    return listAppInboxHealth(this.#db, { appId: app.id, now: this.#now() })[0]?.ready ?? 0;
  }

  pendingDelegations(): AppDelegationIntent[] {
    return listUnlinkedAppDelegations(this.#db).map((item) => ({
      appId: item.appId,
      parentId: requiredText(item.parentId, "Delegation parent id"),
      source: item.source,
      input: item.input,
      idempotencyKey: requiredText(item.idempotencyKey, "Delegation idempotency key"),
    }));
  }

  maxConcurrent(appId: string): number {
    return this.#requiredApp(appId).inbox?.maxConcurrent ?? 1;
  }

  wake(waitingOn: { kind: AppInboxWaitKind; id: string }): number {
    return wakeAppInboxItemsWaitingOn(this.#db, waitingOn, this.#now());
  }

  claimDelivery(): AppInboxDeliveryDispatch | null {
    return claimNextAppInboxDelivery(this.#db, this.#now());
  }

  restoreDelivery(operationId: string): boolean {
    return restorePendingAppInboxDelivery(this.#db, operationId, this.#now());
  }

  recoverDeliveries(): number {
    const now = this.#now();
    return restoreReplayableAppInboxDeliveries(this.#db, now) + markAppInboxSendingDeliveriesUncertain(this.#db, now);
  }

  /**
   * Recover the runtime execution behind an App owner claim after restart.
   *
   * Session waits are intentionally absent from AppDisposition: sessions are
   * Runtime execution details, not App-authored desired work. On startup only,
   * a previously associated claim can be converted to an exact fenced wait.
   * Every scan then observes stored waits so completion while offline cannot
   * strand an item indefinitely.
   */
  async recoverSessionDependencies(
    options: { includeAssociatedClaims?: boolean } = {},
  ): Promise<AppInboxSessionRecoveryResult> {
    const outcome: AppInboxSessionRecoveryResult = {
      linked: 0,
      woken: 0,
      wokenAppIds: [],
      errors: [],
    };
    if (!this.#readDependency) return outcome;

    if (options.includeAssociatedClaims) {
      for (const associated of listAppInboxAssociatedSessionClaims(this.#db)) {
        const dependency = { kind: "session", id: associated.sessionId } as const;
        try {
          const observed = await this.#observeDependency(associated.claim.item.appId, dependency);
          // An unknown execution cannot be made an unbounded wait. Leave its
          // claim reclaimable through the ordinary lease-expiry path.
          if (!observed || observed.status === "unknown") continue;
          if (waitAppInboxClaim(this.#db, associated.claim, dependency, { now: this.#now() })) {
            outcome.linked += 1;
          }
        } catch (error) {
          outcome.errors.push(
            `Claim ${associated.claim.item.id} session ${associated.sessionId}: ${errorMessage(error)}`,
          );
        }
      }
    }

    // This second observation pass deliberately includes claims linked above.
    // It closes the startup race where session.end is persisted between the
    // first observation and the durable wait write.
    const wokenApps = new Set<string>();
    for (const item of listAppInboxSessionWaits(this.#db)) {
      const dependency = item.waitingOn;
      if (!dependency || dependency.kind !== "session") continue;
      const sessionDependency = { kind: "session", id: dependency.id } as const;
      try {
        const observed = await this.#observeDependency(item.appId, sessionDependency);
        if (!observed || !TERMINAL_SESSION_DEPENDENCY_STATUSES.has(observed.status)) continue;
        const woken = wakeAppInboxItemsWaitingOn(this.#db, sessionDependency, this.#now());
        if (woken > 0) {
          outcome.woken += woken;
          wokenApps.add(item.appId);
        }
      } catch (error) {
        outcome.errors.push(`Wait ${item.id} session ${sessionDependency.id}: ${errorMessage(error)}`);
      }
    }
    outcome.wokenAppIds = [...wokenApps].sort();
    return outcome;
  }

  /** Re-observe exact analysis waits because terminal events can occur offline. */
  async recoverAnalysisDependencies(): Promise<AppInboxSessionRecoveryResult> {
    const outcome: AppInboxSessionRecoveryResult = {
      linked: 0,
      woken: 0,
      wokenAppIds: [],
      errors: [],
    };
    if (!this.#readDependency) return outcome;
    const wokenApps = new Set<string>();
    for (const item of listAppInboxDependencyWaits(this.#db, "analysis")) {
      const dependency = item.waitingOn;
      if (!dependency || dependency.kind !== "analysis") continue;
      const analysisDependency = { kind: "analysis", id: dependency.id } as const;
      try {
        const observed = await this.#observeDependency(item.appId, analysisDependency);
        if (!observed || !TERMINAL_SESSION_DEPENDENCY_STATUSES.has(observed.status)) continue;
        const woken = wakeAppInboxItemsWaitingOn(this.#db, analysisDependency, this.#now());
        if (woken > 0) {
          outcome.woken += woken;
          wokenApps.add(item.appId);
        }
      } catch (error) {
        outcome.errors.push(`Wait ${item.id} analysis ${analysisDependency.id}: ${errorMessage(error)}`);
      }
    }
    outcome.wokenAppIds = [...wokenApps].sort();
    return outcome;
  }

  /** Re-observe task waits so attention or missing tasks cannot wait forever. */
  async recoverTaskDependencies(): Promise<AppInboxSessionRecoveryResult> {
    const outcome: AppInboxSessionRecoveryResult = {
      linked: 0,
      woken: 0,
      wokenAppIds: [],
      errors: [],
    };
    if (!this.#readDependency) return outcome;
    const wokenApps = new Set<string>();
    for (const item of listAppInboxDependencyWaits(this.#db, "task")) {
      const dependency = item.waitingOn;
      if (!dependency || dependency.kind !== "task") continue;
      const taskDependency = { kind: "task", id: dependency.id } as const;
      try {
        const observed = (await this.#observeDependency(item.appId, taskDependency)) ?? {
          ...taskDependency,
          status: "unknown" as const,
        };
        if (!REVIEWABLE_TASK_DEPENDENCY_STATUSES.has(observed.status)) continue;
        const woken = wakeAppInboxItemsWaitingOn(this.#db, taskDependency, this.#now());
        if (woken > 0) {
          outcome.woken += woken;
          wokenApps.add(item.appId);
        }
      } catch (error) {
        outcome.errors.push(`Wait ${item.id} task ${taskDependency.id}: ${errorMessage(error)}`);
      }
    }
    outcome.wokenAppIds = [...wokenApps].sort();
    return outcome;
  }

  recordDelivery(receipt: AppInboxDeliveryReceipt): {
    matched: boolean;
    completed: boolean;
    status?: AppInboxDeliveryReceipt["status"] | "sending" | "pending";
  } {
    return withTransaction(this.#db, () => {
      const outcome = recordAppInboxDeliveryReceipt(this.#db, receipt, this.#now());
      if (outcome.completed) {
        wakeAppInboxItemsWaitingOn(this.#db, { kind: "app", id: receipt.itemId }, this.#now());
      }
      return outcome;
    });
  }

  async reconcileOnce(appId: string): Promise<AppInboxReconcileResult> {
    const app = this.#requiredApp(appId);
    const claims = this.#claimBatch(app);
    if (claims.length === 0) return { claimed: 0, admitted: 0, released: 0, errors: [] };
    this.#notifyConversationChanges(claims.map((claim) => claim.item));

    const stopRenewing = this.#renewClaims(claims);
    const routed: AppOwnerDispositionResult[] = [];
    const unresolvedClaims: AppInboxClaim[] = [];
    const unresolvedRequests: AppRequest[] = [];
    const requestsById = new Map<string, Readonly<AppRequest>>();
    try {
      const requests = await Promise.all(claims.map((claim) => this.#authorRequest(claim.item)));
      for (const [index, request] of requests.entries()) {
        requestsById.set(request.id, request);
        const disposition = app.route ? app.route(request) : null;
        if (disposition === null) {
          unresolvedClaims.push(claims[index]!);
          unresolvedRequests.push(request);
          continue;
        }
        if (!disposition || typeof disposition !== "object") {
          throw new Error(`App ${app.id} route must return a disposition or null`);
        }
        routed.push({ requestId: request.id, disposition });
      }
    } catch (error) {
      stopRenewing();
      return this.#releaseBatch(claims, `App routing failed: ${errorMessage(error)}`);
    }

    let ownerResults: AppOwnerDispositionResult[];
    try {
      ownerResults =
        unresolvedClaims.length === 0
          ? []
          : await this.#invokeOwner({
              app,
              requests: unresolvedRequests,
              ...(unresolvedClaims.length === 1 &&
              unresolvedClaims[0]!.item.source.kind === "human" &&
              unresolvedClaims[0]!.item.channel
                ? {
                    transport: {
                      channel: unresolvedClaims[0]!.item.channel,
                      channelThreadId: unresolvedClaims[0]!.item.channelThreadId,
                      channelMessageId: unresolvedClaims[0]!.item.channelMessageId,
                      conversationId: unresolvedClaims[0]!.item.conversationId,
                    },
                  }
                : {}),
              onSessionStarted: (sessionId) => {
                const normalized = requiredText(sessionId, "App owner session id");
                withTransaction(this.#db, () => {
                  for (const claim of unresolvedClaims) {
                    if (!associateAppInboxClaimSession(this.#db, claim, normalized, this.#now())) {
                      throw new Error(`Cannot associate stale request ${claim.item.id} with session ${normalized}`);
                    }
                  }
                });
                this.#notifyConversationChanges(unresolvedClaims.map((claim) => claim.item));
              },
            });
    } catch (error) {
      stopRenewing();
      return this.#releaseBatch(claims, `Owner invocation failed: ${errorMessage(error)}`);
    }

    const ownerError = this.#validateBatchResult(unresolvedClaims, ownerResults);
    if (ownerError) {
      stopRenewing();
      return this.#releaseBatch(claims, ownerError);
    }

    const results = [...routed, ...ownerResults];
    const batchError = this.#validateBatchResult(claims, results);
    if (batchError) {
      stopRenewing();
      return this.#releaseBatch(claims, batchError);
    }

    const byRequest = new Map(results.map((entry) => [entry.requestId, entry.disposition]));
    const outcome: AppInboxReconcileResult = { claimed: claims.length, admitted: 0, released: 0, errors: [] };
    const conversationIds = new Set<string>();
    try {
      for (const claim of claims) {
        try {
          const changedConversation = await this.#admitDisposition(
            app,
            claim,
            requestsById.get(claim.item.id)!,
            byRequest.get(claim.item.id)!,
          );
          if (changedConversation) conversationIds.add(changedConversation);
          outcome.admitted += 1;
        } catch (error) {
          const message = `Request ${claim.item.id}: ${errorMessage(error)}`;
          outcome.errors.push(message);
          if (
            releaseAppInboxClaim(this.#db, claim, {
              retryAfterMs: this.#retryAfterMs,
              now: this.#now(),
            })
          ) {
            outcome.released += 1;
            if (claim.item.source.kind === "human" && claim.item.conversationId) {
              conversationIds.add(claim.item.conversationId);
            }
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
      request.conversation = {
        ...conversation,
        current: {
          messageId: item.source.id,
          ...(item.replyToSourceId ? { replyTo: item.replyToSourceId } : {}),
        },
        work: (conversation.work ?? []).filter((work) => work.requestId !== item.id),
        messages: conversation.messages.filter((message) => message.metadata?.requestId !== item.id),
      };
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

    if (waitingOn.kind !== "task" && waitingOn.kind !== "session" && waitingOn.kind !== "analysis") {
      return deepFreeze(request);
    }
    const dependency = { kind: waitingOn.kind, id: waitingOn.id } as const;

    const observed = await this.#observeDependency(item.appId, dependency);
    request.dependency = observed ?? { ...dependency, status: "unknown" };
    return deepFreeze(request);
  }

  async #observeDependency(
    appId: string,
    dependency: { kind: "task" | "session" | "analysis"; id: string },
  ): Promise<AppDependencyObservation | null> {
    const observed = await this.#readDependency?.({ appId, dependency });
    if (observed && (observed.kind !== dependency.kind || observed.id !== dependency.id)) {
      throw new Error(`Dependency reader returned a mismatched observation for ${dependency.kind}:${dependency.id}`);
    }
    return observed ?? null;
  }

  #claimBatch(app: RegisteredApp): AppInboxClaim[] {
    const limit = app.inbox?.batch === "coalesce-compatible" ? this.#maxBatchSize : 1;
    const claims: AppInboxClaim[] = [];
    for (let index = 0; index < limit; index += 1) {
      const claim = claimNextAppInboxItem(this.#db, app.id, this.#workerId, this.#leaseMs, this.#now());
      if (!claim) break;
      claims.push(claim);
    }
    return claims;
  }

  #renewClaims(claims: AppInboxClaim[]): () => void {
    const intervalMs = Math.max(10, Math.floor(this.#leaseMs / 3));
    const timer = setInterval(() => {
      const now = this.#now();
      for (const claim of claims) renewAppInboxClaim(this.#db, claim, this.#leaseMs, now);
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  #validateBatchResult(claims: AppInboxClaim[], results: AppOwnerDispositionResult[]): string | null {
    if (!Array.isArray(results)) return "Owner returned no disposition array";
    if (results.length !== claims.length) {
      return `Owner returned ${results.length} disposition(s) for ${claims.length} request(s)`;
    }
    const expected = new Set(claims.map((claim) => claim.item.id));
    const seen = new Set<string>();
    for (const entry of results) {
      if (!entry || typeof entry !== "object" || typeof entry.requestId !== "string") {
        return "Owner returned a disposition without a requestId";
      }
      if (!expected.has(entry.requestId)) return `Owner returned an unknown requestId: ${entry.requestId}`;
      if (seen.has(entry.requestId)) return `Owner returned duplicate requestId: ${entry.requestId}`;
      if (!entry.disposition || typeof entry.disposition !== "object") {
        return `Owner returned no disposition for request ${entry.requestId}`;
      }
      seen.add(entry.requestId);
    }
    return null;
  }

  #releaseBatch(claims: AppInboxClaim[], message: string): AppInboxReconcileResult {
    let released = 0;
    const conversationIds = new Set<string>();
    for (const claim of claims) {
      if (
        releaseAppInboxClaim(this.#db, claim, {
          retryAfterMs: this.#retryAfterMs,
          now: this.#now(),
        })
      ) {
        released += 1;
        if (claim.item.source.kind === "human" && claim.item.conversationId) {
          conversationIds.add(claim.item.conversationId);
        }
      }
    }
    return {
      claimed: claims.length,
      admitted: 0,
      released,
      errors: [message],
      ...(conversationIds.size > 0 ? { conversationIds: [...conversationIds].sort() } : {}),
    };
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

  async #admitDisposition(
    app: RegisteredApp,
    claim: AppInboxClaim,
    request: Readonly<AppRequest>,
    disposition: AppDisposition,
  ): Promise<string | undefined> {
    switch (disposition.type) {
      case "continue":
        return this.#continueConversationWork(app, claim, request, disposition);
      case "complete": {
        validateCompleteDisposition(disposition);
        const result = {
          summary: disposition.summary,
          response: disposition.response,
          evidence: disposition.evidence,
        };
        withTransaction(this.#db, () => {
          // The Conversation is the human-facing authority. Persisting its
          // result completes the work; adapters observe conversation.updated
          // and render it independently, without a per-surface delivery gate.
          if (claim.item.source.kind === "human" && claim.item.conversationId) {
            const completed = completeAppInboxClaim(this.#db, claim, result, this.#now());
            if (!completed) throw new Error("claim is stale");
            wakeAppInboxItemsWaitingOn(this.#db, { kind: "app", id: claim.item.id }, this.#now());
            return;
          }
          const responseChannel = claim.item.channel;
          if (responseChannel && (claim.item.source.kind === "human" || responseChannel.startsWith("agent:"))) {
            const current = getAppInboxItem(this.#db, claim.item.id);
            if (!current?.sessionId) throw new Error("deliverable completion has no correlated owner session");
            stageAppInboxClaimDelivery(
              this.#db,
              claim,
              {
                channel: responseChannel,
                sessionId: current.sessionId,
                requestId:
                  claim.item.source.kind === "human"
                    ? appInboxHumanRequestId(claim.item.id)
                    : `app-inbox-agent:${claim.item.id}`,
                result,
              },
              this.#now(),
            );
            return;
          }
          const completed = completeAppInboxClaim(this.#db, claim, result, this.#now());
          if (!completed) throw new Error("claim is stale");
          wakeAppInboxItemsWaitingOn(this.#db, { kind: "app", id: claim.item.id }, this.#now());
        });
        return claim.item.source.kind === "human" ? claim.item.conversationId : undefined;
      }
      case "delegate": {
        const target = this.#requiredApp(disposition.appId);
        validateInput(target, disposition.input);
        if (
          disposition.reviewAfterMs !== undefined &&
          (!Number.isFinite(disposition.reviewAfterMs) || disposition.reviewAfterMs < 0)
        ) {
          throw new Error("Delegate reviewAfterMs must be finite and non-negative");
        }
        withTransaction(this.#db, () => {
          const child = createAppInboxItem(this.#db, {
            appId: target.id,
            parentId: claim.item.id,
            source: { kind: "app", id: app.id },
            input: disposition.input,
            idempotencyKey: `delegate:${claim.item.id}:${claim.generation}`,
            now: this.#now(),
          }).item;
          const waiting = waitAppInboxClaim(
            this.#db,
            claim,
            { kind: "app", id: child.id },
            { reviewAfterMs: disposition.reviewAfterMs, now: this.#now() },
          );
          if (!waiting) throw new Error("claim is stale");
        });
        return claim.item.source.kind === "human" ? claim.item.conversationId : undefined;
      }
      case "task": {
        if (app.tasks?.attach !== true) {
          throw new Error(`App ${app.id} does not allow task attachment`);
        }
        if (!this.#attachTask) throw new Error("App task attachment is not configured");
        const attachmentIdentity =
          disposition.task.kind === "existing"
            ? `existing:${requiredText(disposition.task.taskId, "Existing task id")}`
            : `desired:${requiredText(disposition.task.intent.id, "Desired task intent id")}`;
        const attached = await this.#attachTask({
          appId: app.id,
          attachment: disposition.task,
          idempotencyKey: `task:${claim.item.id}:${attachmentIdentity}`,
          request,
        });
        const taskId = requiredText(attached.taskId, "Attached task id");
        const waiting = waitAppInboxClaim(this.#db, claim, { kind: "task", id: taskId }, { now: this.#now() });
        if (!waiting) throw new Error("claim is stale");
        if (attached.isComplete) {
          try {
            if (await attached.isComplete()) {
              wakeAppInboxItemsWaitingOn(this.#db, { kind: "task", id: taskId }, this.#now());
            }
          } catch {
            // The durable completion event remains the authoritative wake path.
            // A failed post-link race check must not undo a valid wait link.
          }
        }
        return claim.item.source.kind === "human" ? claim.item.conversationId : undefined;
      }
      case "analyze": {
        if (app.id !== "may") throw new Error("Only the canonical May App may request bounded analysis");
        if (!this.#attachAnalysis) throw new Error("May analysis attachment is not configured");
        const question = requiredText(disposition.analysis.question, "Analysis question");
        if (
          !Number.isFinite(disposition.analysis.timeoutMs) ||
          disposition.analysis.timeoutMs <= 0 ||
          disposition.analysis.timeoutMs > 1_800_000
        ) {
          throw new Error("Analysis timeoutMs must be between 1 and 1800000");
        }
        const analysis = { ...disposition.analysis, question };
        const prior = request.dependency?.id ?? "root";
        const attached = await this.#attachAnalysis({
          appId: "may",
          analysis,
          idempotencyKey: `analysis:${claim.item.id}:${prior}:${analysisIdentity(analysis)}`,
          request,
        });
        const analysisId = requiredText(attached.analysisId, "Attached analysis id");
        const acknowledgement =
          disposition.acknowledgement === undefined
            ? undefined
            : requiredText(disposition.acknowledgement, "Analysis acknowledgement");
        withTransaction(this.#db, () => {
          const current = getAppInboxItem(this.#db, claim.item.id);
          const waiting = waitAppInboxClaim(
            this.#db,
            claim,
            { kind: "analysis", id: analysisId },
            { now: this.#now() },
          );
          if (!waiting) throw new Error("claim is stale");
          if (acknowledgement && current?.sessionId && claim.item.source.kind === "human" && claim.item.channel) {
            stageAppInboxProgressDelivery(
              this.#db,
              {
                itemId: claim.item.id,
                operationId: `app-progress:${claim.item.id}:${analysisId}`,
                channel: claim.item.channel,
                sessionId: current.sessionId,
                requestId: appInboxHumanRequestId(claim.item.id),
                text: acknowledgement,
              },
              this.#now(),
            );
          }
        });
        if (attached.isComplete) {
          try {
            if (await attached.isComplete()) {
              wakeAppInboxItemsWaitingOn(this.#db, { kind: "analysis", id: analysisId }, this.#now());
            }
          } catch {
            // Terminal CLI evidence remains the authoritative wake path.
          }
        }
        return claim.item.source.kind === "human" ? claim.item.conversationId : undefined;
      }
      default:
        throw new Error(`Unknown App disposition: ${String((disposition as { type?: unknown }).type)}`);
    }
  }

  async #continueConversationWork(
    app: RegisteredApp,
    currentClaim: AppInboxClaim,
    currentRequest: Readonly<AppRequest>,
    continuation: Extract<AppDisposition, { type: "continue" }>,
  ): Promise<string | undefined> {
    if (app.id !== "may") throw new Error("Only the canonical May App may continue conversation work");
    if (currentClaim.item.source.kind !== "human" || !currentClaim.item.conversationId) {
      throw new Error("Only a human Conversation turn may continue work");
    }
    const targetId = requiredText(continuation.requestId, "Continued request id");
    const represented = currentRequest.conversation?.work?.some((work) => work.requestId === targetId) === true;
    if (!represented) {
      throw new Error(`Continued request ${targetId} is not represented as active work in this Conversation`);
    }

    const target = getAppInboxItem(this.#db, targetId);
    if (
      !target ||
      target.appId !== app.id ||
      (target.conversationId !== undefined && target.conversationId !== currentClaim.item.conversationId) ||
      target.source.kind !== "human" ||
      target.status === "done" ||
      target.result ||
      target.continuesRequestId
    ) {
      throw new Error(`Continued request ${targetId} is not unfinished May work in this Conversation`);
    }

    // Author the target while its old dependency is still linked so May's
    // chosen replacement is reviewed against the exact current observation.
    const targetRequest = await this.#authorRequest(target);
    const targetClaim = claimReferencedAppInboxWork(this.#db, currentClaim, targetId, this.#leaseMs, this.#now());
    if (!targetClaim) throw new Error(`Continued request ${targetId} changed before it could be fenced`);

    try {
      await this.#admitDisposition(app, targetClaim, targetRequest, continuation.disposition as AppWorkDisposition);
      if (!completeAppInboxContinuation(this.#db, currentClaim, targetId, continuation.response, this.#now())) {
        throw new Error("feedback turn claim is stale");
      }
      return currentClaim.item.conversationId;
    } catch (error) {
      releaseAppInboxClaim(this.#db, targetClaim, {
        retryAfterMs: this.#retryAfterMs,
        now: this.#now(),
      });
      throw error;
    }
  }
}
