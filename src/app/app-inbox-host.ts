import { randomUUID } from "node:crypto";
import {
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
  completeAppInboxClaim,
  createAppInboxItem,
  getAppInboxItem,
  releaseAppInboxClaim,
  renewAppInboxClaim,
  waitAppInboxClaim,
  wakeAppInboxItemsWaitingOn,
  type AppInboxClaim,
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
  onSessionStarted(sessionId: string): void;
}) => Promise<AppOwnerDispositionResult[]>;

/**
 * The task engine must treat idempotencyKey as stable admission identity.
 * This keeps a retry from creating duplicate durable task work.
 */
export type AppTaskAttacher = (input: {
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
}) => Promise<{ taskId: string }>;

export type AdmitAppInput = {
  id?: string;
  appId: string;
  parentId?: string;
  conversationId?: string;
  conversationSequence?: number;
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
  attachTask?: AppTaskAttacher;
  workerId?: string;
  leaseMs?: number;
  retryAfterMs?: number;
  maxBatchSize?: number;
  now?: () => number;
};

type RegisteredApp = AppDefinition;

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

function authorRequest(item: AppInboxItem): AppRequest {
  return {
    id: item.id,
    source: item.source,
    parentId: item.parentId,
    input: item.input,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class AppInboxHost {
  readonly #db: SqliteDb;
  readonly #apps: Map<string, RegisteredApp>;
  readonly #invokeOwner: AppOwnerInvoker;
  readonly #attachTask?: AppTaskAttacher;
  readonly #workerId: string;
  readonly #leaseMs: number;
  readonly #retryAfterMs: number;
  readonly #maxBatchSize: number;
  readonly #now: () => number;

  constructor(options: AppInboxHostOptions) {
    this.#db = options.db;
    this.#invokeOwner = options.invokeOwner;
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

  async reconcileOnce(appId: string): Promise<AppInboxReconcileResult> {
    const app = this.#requiredApp(appId);
    const claims = this.#claimBatch(app);
    if (claims.length === 0) return { claimed: 0, admitted: 0, released: 0, errors: [] };

    const stopRenewing = this.#renewClaims(claims);
    let results: AppOwnerDispositionResult[];
    try {
      results = await this.#invokeOwner({
        app,
        requests: claims.map((claim) => authorRequest(claim.item)),
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
        withTransaction(this.#db, () => {
          const completed = completeAppInboxClaim(
            this.#db,
            claim,
            {
              summary: disposition.summary,
              response: disposition.response,
              evidence: disposition.evidence,
            },
            this.#now(),
          );
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
        return;
      }
      default:
        throw new Error(`Unknown App disposition: ${String((disposition as { type?: unknown }).type)}`);
    }
  }
}
