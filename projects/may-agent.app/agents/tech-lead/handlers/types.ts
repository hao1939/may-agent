/** Host-private contract for scheduled maintenance handlers.
 *
 * These capabilities are supplied by the Runtime scheduler. They are not part
 * of the public Agent App SDK and must not leak into App-owned workflows.
 */

export type EventEnvelope = {
  type: string;
  source: string;
  owner: string;
  timestamp?: number;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  visibility?: "default" | "detail";
  target?: Record<string, unknown>;
  data: Record<string, unknown>;
};

export type CronEntry = {
  name?: string;
  enabled?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
  handlerConfig?: Record<string, unknown>;
};

type HostQuery = {
  sql(
    sql: string,
    params?: unknown[],
    options?: { limit?: number },
  ): { rows: Record<string, unknown>[] };
  eventDeliveryHealth(options?: Record<string, unknown>): {
    now: number;
    since: number;
    unhandledEvents: Record<string, unknown>[];
    overduePendingEvents: Record<string, unknown>[];
    orphanPairs: Record<string, unknown>[];
    overdueOpenPairs: Record<string, unknown>[];
  };
};

type HostSdk = {
  emit(
    type: string,
    data?: Record<string, unknown>,
    envelope?: Record<string, unknown>,
  ): void;
  getDb(): {
    run(sql: string, ...params: unknown[]): unknown;
    exec(sql: string): unknown;
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): unknown;
    };
  };
  log(level: "info" | "warn" | "error", message: string): void;
  message(target: string, content: string): void;
  query: HostQuery;
  paths: {
    persist: string;
    root: string;
    agents: string;
    shared?: string;
    projects?: string;
  };
};

export type HandlerContext = {
  sdk: HostSdk;
  agentName: string;
  classifyError(error: string | undefined | null): string;
  getLastDigest(sessionId: string): { action?: string } | null;
  upsertDigest(input: Record<string, unknown>): Promise<unknown>;
};

export type HandlerModule = {
  create(
    ctx: HandlerContext,
    entry: CronEntry,
  ): (event?: EventEnvelope) => Promise<void>;
};
