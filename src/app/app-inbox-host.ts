import { randomUUID } from "node:crypto";
import {
  type AppDependencyObservation,
  type AppDefinition,
  type AppDisposition,
  type AppInput,
  type AppInputSource,
  type AppRequest,
  type AppTaskAttachment,
} from "@may-agent/sdk";
import { Check, Errors } from "typebox/value";
import type { SqliteDb } from "../lib/db.js";
import {
  associateAppInboxClaimSession,
  claimNextAppInboxItem,
  claimNextAppInboxDelivery,
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  markAppInboxSendingDeliveriesUncertain,
  recordAppInboxDeliveryReceipt,
  releaseAppInboxClaim,
  restorePendingAppInboxDelivery,
  renewAppInboxClaim,
  stageAppInboxClaimDelivery,
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
  dependency: { kind: "task" | "session"; id: string };
}) => Promise<AppDependencyObservation | null>;

/**
 * The task engine must treat idempotencyKey as stable admission identity.
 * This keeps a retry from creating duplicate durable task work.
 */
export type AppTaskAttacher = (input: {
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
}) => Promise<{
  taskId: string;
  /**
   * Checked only after the durable wait link exists. This closes the race where
   * task convergence happens immediately before or while the link is written.
   */
  isComplete?: () => Promise<boolean>;
}>;

export type AdmitAppInput = {
  id?: string;
  appId: string;
  parentId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  source: AppInputSource;
  input: AppInput;
  idempotencyKey?: string;
};

export type AppInboxReconcileResult = {
  claimed: number;
  admitted: number;
  released: number;
  errors: string[];
};

export type AppInboxHostOptions = {
  db: SqliteDb;
  apps: AppDefinition[];
  invokeOwner: AppOwnerInvoker;
  readDependency?: AppDependencyReader;
  attachTask?: AppTaskAttacher;
  workerId?: string;
  leaseMs?: number;
  retryAfterMs?: number;
  maxBatchSize?: number;
  now?: () => number;
};

type RegisteredApp = AppDefinition;

export function appInboxHumanRequestId(itemId: string): string {
  return `app-inbox-human:${requiredText(itemId, "App inbox item id")}`;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function validateAppDefinition(app: AppDefinition): RegisteredApp {
  requiredText(app.id, "App id");
  requiredText(app.owner, `App ${app.id} owner`);
  if (app.version !== 1) throw new Error(`App ${app.id} has unsupported version ${String(app.version)}`);
  if (app.inbox?.batch && app.inbox.batch !== "single" && app.inbox.batch !== "coalesce-compatible") {
    throw new Error(`App ${app.id} has unsupported inbox batch mode ${String(app.inbox.batch)}`);
  }
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

export class AppInboxHost {
  readonly #db: SqliteDb;
  readonly #apps: Map<string, RegisteredApp>;
  readonly #invokeOwner: AppOwnerInvoker;
  readonly #readDependency?: AppDependencyReader;
  readonly #attachTask?: AppTaskAttacher;
  readonly #workerId: string;
  readonly #leaseMs: number;
  readonly #retryAfterMs: number;
  readonly #maxBatchSize: number;
  readonly #now: () => number;

  constructor(options: AppInboxHostOptions) {
    this.#db = options.db;
    this.#invokeOwner = options.invokeOwner;
    this.#readDependency = options.readDependency;
    this.#attachTask = options.attachTask;
    this.#workerId = options.workerId?.trim() || `app-host:${process.pid}:${randomUUID()}`;
    this.#leaseMs = options.leaseMs ?? 60_000;
    this.#retryAfterMs = options.retryAfterMs ?? 1_000;
    this.#maxBatchSize = options.maxBatchSize ?? 8;
    this.#now = options.now ?? Date.now;
    if (!Number.isFinite(this.#leaseMs) || this.#leaseMs <= 0) throw new Error("App host leaseMs must be positive");
    if (!Number.isFinite(this.#retryAfterMs) || this.#retryAfterMs < 0) {
      throw new Error("App host retryAfterMs must be finite and non-negative");
    }
    if (!Number.isSafeInteger(this.#maxBatchSize) || this.#maxBatchSize <= 0) {
      throw new Error("App host maxBatchSize must be a positive safe integer");
    }

    this.#apps = new Map();
    for (const definition of options.apps) {
      const app = validateAppDefinition(definition);
      if (this.#apps.has(app.id)) throw new Error(`Duplicate App id: ${app.id}`);
      this.#apps.set(app.id, app);
    }
  }

  appIds(): string[] {
    return [...this.#apps.keys()].sort();
  }

  admit(input: AdmitAppInput): { item: AppInboxItem; created: boolean } {
    const app = this.#requiredApp(input.appId);
    validateInput(app, input.input);
    return createAppInboxItem(this.#db, { ...input, now: this.#now() });
  }

  get(id: string): AppInboxItem | null {
    return getAppInboxItem(this.#db, id);
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
    return markAppInboxSendingDeliveriesUncertain(this.#db, this.#now());
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

    const stopRenewing = this.#renewClaims(claims);
    let results: AppOwnerDispositionResult[];
    try {
      const requests = await Promise.all(claims.map((claim) => this.#authorRequest(claim.item)));
      results = await this.#invokeOwner({
        app,
        requests,
        ...(claims.length === 1 && claims[0]!.item.source.kind === "human" && claims[0]!.item.channel
          ? {
              transport: {
                channel: claims[0]!.item.channel,
                channelThreadId: claims[0]!.item.channelThreadId,
                channelMessageId: claims[0]!.item.channelMessageId,
                conversationId: claims[0]!.item.conversationId,
              },
            }
          : {}),
        onSessionStarted: (sessionId) => {
          const normalized = requiredText(sessionId, "App owner session id");
          withTransaction(this.#db, () => {
            for (const claim of claims) {
              if (!associateAppInboxClaimSession(this.#db, claim, normalized, this.#now())) {
                throw new Error(`Cannot associate stale request ${claim.item.id} with session ${normalized}`);
              }
            }
          });
        },
      });
    } catch (error) {
      stopRenewing();
      return this.#releaseBatch(claims, `Owner invocation failed: ${errorMessage(error)}`);
    }

    const batchError = this.#validateBatchResult(claims, results);
    if (batchError) {
      stopRenewing();
      return this.#releaseBatch(claims, batchError);
    }

    const byRequest = new Map(results.map((entry) => [entry.requestId, entry.disposition]));
    const outcome: AppInboxReconcileResult = { claimed: claims.length, admitted: 0, released: 0, errors: [] };
    try {
      for (const claim of claims) {
        try {
          await this.#admitDisposition(app, claim, byRequest.get(claim.item.id)!);
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
          }
        }
      }
    } finally {
      stopRenewing();
    }
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
    const waitingOn = item.waitingOn;
    if (!waitingOn) return request;

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
      return request;
    }

    if (waitingOn.kind !== "task" && waitingOn.kind !== "session") return request;
    const dependency = { kind: waitingOn.kind, id: waitingOn.id } as const;

    const observed = await this.#readDependency?.({ appId: item.appId, dependency });
    if (observed && (observed.kind !== dependency.kind || observed.id !== dependency.id)) {
      throw new Error(`Dependency reader returned a mismatched observation for ${dependency.kind}:${dependency.id}`);
    }
    request.dependency = observed ?? { ...dependency, status: "unknown" };
    return request;
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
    for (const claim of claims) {
      if (
        releaseAppInboxClaim(this.#db, claim, {
          retryAfterMs: this.#retryAfterMs,
          now: this.#now(),
        })
      ) {
        released += 1;
      }
    }
    return { claimed: claims.length, admitted: 0, released, errors: [message] };
  }

  async #admitDisposition(app: RegisteredApp, claim: AppInboxClaim, disposition: AppDisposition): Promise<void> {
    switch (disposition.type) {
      case "complete": {
        validateCompleteDisposition(disposition);
        const result = {
          summary: disposition.summary,
          response: disposition.response,
          evidence: disposition.evidence,
        };
        withTransaction(this.#db, () => {
          if (claim.item.source.kind === "human" && claim.item.channel) {
            const current = getAppInboxItem(this.#db, claim.item.id);
            if (!current?.sessionId) throw new Error("human completion has no correlated owner session");
            stageAppInboxClaimDelivery(
              this.#db,
              claim,
              {
                channel: claim.item.channel,
                sessionId: current.sessionId,
                requestId: appInboxHumanRequestId(claim.item.id),
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
        return;
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
        return;
      }
      case "task": {
        if (!this.#attachTask) throw new Error("App task attachment is not configured");
        const attachmentIdentity =
          disposition.task.kind === "existing"
            ? `existing:${requiredText(disposition.task.taskId, "Existing task id")}`
            : `desired:${requiredText(disposition.task.intent.id, "Desired task intent id")}`;
        const attached = await this.#attachTask({
          appId: app.id,
          attachment: disposition.task,
          idempotencyKey: `task:${claim.item.id}:${attachmentIdentity}`,
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
        return;
      }
      default:
        throw new Error(`Unknown App disposition: ${String((disposition as { type?: unknown }).type)}`);
    }
  }
}
