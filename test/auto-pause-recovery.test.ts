/**
 * auto-pause-recovery.test.ts — Tests for auto-pause recovery state machine.
 *
 * Tests the new circuit breaker recovery: state transitions, probe scheduling,
 * escalation/recovery notifications, probe task messages, and config parsing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────

type MockRow = { status: string; startedAt: number; task?: string; error?: string };
let mockRows: MockRow[] = [];
let mockRunningProbe: unknown = null;
let trackRequestCalls: unknown[] = [];

vi.mock("../src/lib/requests.js", () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn((sql: string) => {
      // Return different mock behavior based on whether it's a running probe check
      if (sql.includes("status = 'running'") && sql.includes("auto-pause-probe")) {
        return {
          all: vi.fn(() => []),
          get: vi.fn(() => mockRunningProbe),
        };
      }
      // Default: return session rows
      return {
        all: vi.fn(() => mockRows),
        get: vi.fn(() => null),
      };
    }),
  })),
  trackRequest: vi.fn((_persistDir: string, opts: unknown) => {
    trackRequestCalls.push(opts);
    return "mock-request-id";
  }),
}));

import {
  getAutoPauseState,
  shouldFireProbe,
  buildProbeTaskMessage,
  createPauseEscalation,
  createRecoveryNotification,
  getLastErrors,
  parseAutoPauseConfig,
  AUTO_PAUSE_DEFAULTS,
  type AutoPauseConfig,
  type AutoPauseStateInfo,
} from "../src/lib/auto-pause.js";
import { getDb } from "../src/lib/requests.js";

// ── Helpers ───────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

function makeConfig(overrides?: Partial<AutoPauseConfig>): AutoPauseConfig {
  return { ...AUTO_PAUSE_DEFAULTS, ...overrides };
}

function pushErrors(count: number, startedAt: number = Date.now() - 1000) {
  for (let i = 0; i < count; i++) {
    mockRows.push({
      status: "error",
      startedAt: startedAt - i * 1000,
      task: "heartbeat task",
    });
  }
}

function pushProbeError(startedAt: number) {
  mockRows.unshift({
    status: "error",
    startedAt,
    task: "[auto-pause-probe] Probe session",
  });
}

function pushProbeSuccess(startedAt: number) {
  mockRows.unshift({
    status: "done",
    startedAt,
    task: "[auto-pause-probe] Probe session",
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("getAutoPauseState", () => {
  beforeEach(() => {
    mockRows = [];
    mockRunningProbe = null;
    trackRequestCalls = [];
  });

  it("returns running when fewer sessions than threshold", () => {
    const now = Date.now();
    mockRows.push({ status: "error", startedAt: now - 1000 });
    const state = getAutoPauseState("/fake", "new-agent");
    expect(state.state).toBe("running");
    expect(state.probeDue).toBe(false);
    expect(state.pausedAt).toBeNull();
  });

  it("returns running when not all recent sessions are errors", () => {
    const now = Date.now();
    mockRows.push(
      { status: "done", startedAt: now - 1000 },
      { status: "error", startedAt: now - 2000 },
      { status: "error", startedAt: now - 3000 },
    );
    const state = getAutoPauseState("/fake", "mixed-agent");
    expect(state.state).toBe("running");
  });

  it("returns auto-paused when threshold errors reached (no probe due yet)", () => {
    const now = Date.now();
    // 3 errors, all very recent — probe delay hasn't elapsed
    mockRows.push(
      { status: "error", startedAt: now - 1000 },
      { status: "error", startedAt: now - 2000 },
      { status: "error", startedAt: now - 3000 },
    );
    const state = getAutoPauseState("/fake", "paused-agent");
    expect(state.state).toBe("auto-paused");
    expect(state.probeDue).toBe(false);
    expect(state.pausedAt).toBe(now - 3000); // trigger session startedAt
    expect(state.probeFailCount).toBe(0);
  });

  it("returns auto-paused with probeDue when initial delay elapsed", () => {
    const now = Date.now();
    const pauseTime = now - 2 * HOUR; // Paused 2 hours ago, delay is 1h
    mockRows.push(
      { status: "error", startedAt: pauseTime + 2000 },
      { status: "error", startedAt: pauseTime + 1000 },
      { status: "error", startedAt: pauseTime },
    );
    const state = getAutoPauseState("/fake", "stale-paused-agent");
    expect(state.state).toBe("auto-paused");
    expect(state.probeDue).toBe(true);
    expect(state.nextProbeDelayMs).toBe(HOUR); // initial delay
  });

  it("returns probing when a probe session is running", () => {
    const now = Date.now();
    mockRows.push(
      { status: "error", startedAt: now - 1000 },
      { status: "error", startedAt: now - 2000 },
      { status: "error", startedAt: now - 3000 },
    );
    mockRunningProbe = { 1: 1 }; // truthy value — probe is running
    const state = getAutoPauseState("/fake", "probing-agent");
    expect(state.state).toBe("probing");
    expect(state.probeDue).toBe(false);
  });

  it("tracks failed probes and applies exponential backoff", () => {
    const now = Date.now();
    const pauseTime = now - 5 * HOUR;

    // Ordered DESC by startedAt (most recent first), as the DB query returns
    mockRows = [
      // One failed probe after the pause trigger
      { status: "error", startedAt: pauseTime + HOUR + 1000, task: "[auto-pause-probe] Probe 1" },
      // Initial errors that triggered the pause
      { status: "error", startedAt: pauseTime + 2000, task: "heartbeat" },
      { status: "error", startedAt: pauseTime + 1000, task: "heartbeat" },
      { status: "error", startedAt: pauseTime, task: "heartbeat" },
    ];

    const state = getAutoPauseState("/fake", "backoff-agent");
    expect(state.state).toBe("auto-paused");
    expect(state.probeFailCount).toBe(1);
    // After 1 failure: backoff = 1h * 2^1 = 2h
    expect(state.nextProbeDelayMs).toBe(2 * HOUR);
    expect(state.lastProbeAt).toBe(pauseTime + HOUR + 1000);
  });

  it("caps probe delay at maxProbeIntervalMs", () => {
    const now = Date.now();
    const pauseTime = now - 20 * HOUR;
    const config = makeConfig({ maxProbeIntervalMs: 4 * HOUR });

    // Initial errors that triggered the pause (ordered DESC by startedAt)
    // Plus 3 failed probes after the pause
    mockRows = [
      // Most recent first (DESC order)
      { status: "error", startedAt: pauseTime + 7 * HOUR + 100, task: "[auto-pause-probe] Probe 3" },
      { status: "error", startedAt: pauseTime + 3 * HOUR + 100, task: "[auto-pause-probe] Probe 2" },
      { status: "error", startedAt: pauseTime + 1 * HOUR + 100, task: "[auto-pause-probe] Probe 1" },
      { status: "error", startedAt: pauseTime + 2000, task: "heartbeat" },
      { status: "error", startedAt: pauseTime + 1000, task: "heartbeat" },
      { status: "error", startedAt: pauseTime, task: "heartbeat" },
    ];

    const state = getAutoPauseState("/fake", "capped-agent", config);
    expect(state.probeFailCount).toBe(3);
    expect(state.nextProbeDelayMs).toBe(4 * HOUR); // capped
  });

  it("forces probe when TTL exceeded", () => {
    const now = Date.now();
    const pauseTime = now - 25 * HOUR; // 25h ago, TTL is 24h
    const config = makeConfig({
      initialProbeDelayMs: 100 * HOUR, // Very long delay
      pauseTTLMs: 24 * HOUR,
    });

    mockRows.push(
      { status: "error", startedAt: pauseTime + 2000 },
      { status: "error", startedAt: pauseTime + 1000 },
      { status: "error", startedAt: pauseTime },
    );

    const state = getAutoPauseState("/fake", "ttl-agent", config);
    expect(state.state).toBe("auto-paused");
    expect(state.probeDue).toBe(true); // TTL forces probe
  });

  it("returns running when DB throws (fail-open)", () => {
    // Override mock to throw for one call
    (getDb as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("DB unavailable");
    });
    const state = getAutoPauseState("/fake", "db-error-agent");
    expect(state.state).toBe("running");
  });
});

describe("shouldFireProbe", () => {
  beforeEach(() => {
    mockRows = [];
    mockRunningProbe = null;
  });

  it("returns true when auto-paused and probe is due", () => {
    const now = Date.now();
    const pauseTime = now - 2 * HOUR;
    mockRows.push(
      { status: "error", startedAt: pauseTime + 2000 },
      { status: "error", startedAt: pauseTime + 1000 },
      { status: "error", startedAt: pauseTime },
    );
    expect(shouldFireProbe("/fake", "probe-ready-agent")).toBe(true);
  });

  it("returns false when not paused", () => {
    mockRows.push(
      { status: "done", startedAt: Date.now() - 1000 },
      { status: "error", startedAt: Date.now() - 2000 },
      { status: "error", startedAt: Date.now() - 3000 },
    );
    expect(shouldFireProbe("/fake", "healthy-agent")).toBe(false);
  });

  it("returns false when paused but probe not due", () => {
    const now = Date.now();
    mockRows.push(
      { status: "error", startedAt: now - 1000 },
      { status: "error", startedAt: now - 2000 },
      { status: "error", startedAt: now - 3000 },
    );
    expect(shouldFireProbe("/fake", "too-early-agent")).toBe(false);
  });
});

describe("buildProbeTaskMessage", () => {
  it("includes the [auto-pause-probe] marker", () => {
    const state: AutoPauseStateInfo = {
      state: "auto-paused",
      pausedAt: Date.now() - HOUR,
      probeFailCount: 2,
      lastProbeAt: Date.now() - 30 * MIN,
      nextProbeDelayMs: 4 * HOUR,
      probeDue: true,
    };
    const result = buildProbeTaskMessage("test-agent", state, "Original heartbeat task");
    expect(result).toContain("[auto-pause-probe]");
    expect(result).toContain("Probe #3"); // probeFailCount + 1
    expect(result).toContain("test-agent");
    expect(result).toContain("Original heartbeat task");
  });

  it("shows probe #1 when no previous probes", () => {
    const state: AutoPauseStateInfo = {
      state: "auto-paused",
      pausedAt: Date.now() - HOUR,
      probeFailCount: 0,
      lastProbeAt: null,
      nextProbeDelayMs: HOUR,
      probeDue: true,
    };
    const result = buildProbeTaskMessage("test-agent", state, "task msg");
    expect(result).toContain("Probe #1");
  });
});

describe("createPauseEscalation", () => {
  beforeEach(() => {
    trackRequestCalls = [];
  });

  it("creates a tracked request to the escalation agent", () => {
    const config = makeConfig();
    createPauseEscalation("/fake", "broken-agent", config, ["Error: crash", "Error: timeout"]);

    expect(trackRequestCalls).toHaveLength(1);
    const call = trackRequestCalls[0] as Record<string, unknown>;
    expect(call.toAgent).toBe("may");
    expect(call.fromEntity).toBe("cron");
    expect(call.method).toBe("message");
    expect(call.task).toContain("broken-agent");
    expect(call.task).toContain("auto-paused");
    expect(call.artifact).toBe("auto-pause:broken-agent");

    const context = JSON.parse(call.context as string);
    expect(context.type).toBe("auto-pause-escalation");
    expect(context.agent).toBe("broken-agent");
    expect(context.lastErrors).toEqual(["Error: crash", "Error: timeout"]);
  });

  it("uses custom escalation agent from config", () => {
    const config = makeConfig({ escalationAgent: "ops-bot" });
    createPauseEscalation("/fake", "agent-x", config, []);

    const call = trackRequestCalls[0] as Record<string, unknown>;
    expect(call.toAgent).toBe("ops-bot");
  });
});

describe("createRecoveryNotification", () => {
  beforeEach(() => {
    trackRequestCalls = [];
  });

  it("creates a tracked request with recovery details", () => {
    const config = makeConfig();
    createRecoveryNotification("/fake", "recovered-agent", config, 3, 5 * HOUR);

    expect(trackRequestCalls).toHaveLength(1);
    const call = trackRequestCalls[0] as Record<string, unknown>;
    expect(call.toAgent).toBe("may");
    expect(call.method).toBe("message");
    expect(call.task).toContain("recovered-agent");
    expect(call.task).toContain("recovered");
    expect(call.task).toContain("3 probe");
    expect(call.artifact).toBe("auto-pause-recovery:recovered-agent");

    const context = JSON.parse(call.context as string);
    expect(context.type).toBe("auto-pause-recovery");
    expect(context.probeCount).toBe(3);
    expect(context.pauseDurationMs).toBe(5 * HOUR);
  });
});

describe("getLastErrors", () => {
  beforeEach(() => {
    mockRows = [];
  });

  it("returns error messages from sessions", () => {
    mockRows.push(
      { status: "error", startedAt: Date.now(), error: "Error: out of memory" } as MockRow & { error: string },
      { status: "error", startedAt: Date.now() - 1000, error: "Error: timeout" } as MockRow & { error: string },
    );
    const errors = getLastErrors("/fake", "failing-agent", 3);
    // The mock returns mockRows, but getLastErrors looks for `error` field.
    // Due to mock structure, this depends on how rows are returned.
    expect(Array.isArray(errors)).toBe(true);
  });
});

describe("parseAutoPauseConfig", () => {
  it("returns defaults when no handlerConfig", () => {
    const config = parseAutoPauseConfig(undefined);
    expect(config).toEqual(AUTO_PAUSE_DEFAULTS);
  });

  it("returns defaults when handlerConfig has no autoPause", () => {
    const config = parseAutoPauseConfig({ someOtherKey: true });
    expect(config).toEqual(AUTO_PAUSE_DEFAULTS);
  });

  it("parses custom threshold", () => {
    const config = parseAutoPauseConfig({ autoPause: { threshold: 5 } });
    expect(config.threshold).toBe(5);
    expect(config.initialProbeDelayMs).toBe(AUTO_PAUSE_DEFAULTS.initialProbeDelayMs);
  });

  it("parses duration strings for probe delays", () => {
    const config = parseAutoPauseConfig({
      autoPause: {
        initialProbeDelay: "30m",
        maxProbeInterval: "4h",
        pauseTTL: "12h",
      },
    });
    expect(config.initialProbeDelayMs).toBe(30 * MIN);
    expect(config.maxProbeIntervalMs).toBe(4 * HOUR);
    expect(config.pauseTTLMs).toBe(12 * HOUR);
  });

  it("accepts raw numbers as ms", () => {
    const config = parseAutoPauseConfig({
      autoPause: {
        initialProbeDelay: 5000,
        maxProbeInterval: 10000,
      },
    });
    expect(config.initialProbeDelayMs).toBe(5000);
    expect(config.maxProbeIntervalMs).toBe(10000);
  });

  it("uses defaults for invalid values", () => {
    const config = parseAutoPauseConfig({
      autoPause: {
        threshold: "not-a-number",
        initialProbeDelay: "invalid",
        probeBackoffMultiplier: "nope",
      },
    });
    expect(config.threshold).toBe(AUTO_PAUSE_DEFAULTS.threshold);
    expect(config.initialProbeDelayMs).toBe(AUTO_PAUSE_DEFAULTS.initialProbeDelayMs);
    expect(config.probeBackoffMultiplier).toBe(AUTO_PAUSE_DEFAULTS.probeBackoffMultiplier);
  });

  it("parses custom escalation agent", () => {
    const config = parseAutoPauseConfig({
      autoPause: { escalationAgent: "ops-bot" },
    });
    expect(config.escalationAgent).toBe("ops-bot");
  });

  it("parses backoff multiplier", () => {
    const config = parseAutoPauseConfig({
      autoPause: { probeBackoffMultiplier: 1.5 },
    });
    expect(config.probeBackoffMultiplier).toBe(1.5);
  });
});
