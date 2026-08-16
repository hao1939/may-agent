import { describe, expect, test } from "bun:test";
import type { ObserverContext } from "@may-agent/sdk";
import { aksObserverPath, aksObservers } from "./observers.js";

const context = {
  read: {},
  log: {},
  workspace: {
    appRoot: "/apps/aks-rp-e2e.app",
    projectRoot: "/projects/aks-rp-e2e",
  },
} as unknown as ObserverContext;

describe("canonical AKS observer adapters", () => {
  test("preserves the five collector cadences without check events", () => {
    expect(
      aksObservers.map(({ id, intervalMs }) => ({ id, intervalMs })),
    ).toEqual([
      { id: "pipeline", intervalMs: 60_000 },
      { id: "pull-request", intervalMs: 300_000 },
      { id: "workspace-integrity", intervalMs: 3_600_000 },
      { id: "scenario-test-inventory", intervalMs: 1_800_000 },
      { id: "repo-ref", intervalMs: 600_000 },
    ]);
  });

  test("maps only the configured App and project roots", () => {
    expect(aksObserverPath(context, ".state/watchers/repo-ref.json")).toBe(
      "/apps/aks-rp-e2e.app/.state/watchers/repo-ref.json",
    );
    expect(aksObserverPath(context, "../aks-rp-e2e")).toBe(
      "/projects/aks-rp-e2e",
    );
    expect(aksObserverPath(context, "../aks-rp-e2e/runs/test-results")).toBe(
      "/projects/aks-rp-e2e/runs/test-results",
    );
  });

  test("fails closed when the host does not provide scoped roots", () => {
    expect(() =>
      aksObserverPath({ read: {}, log: {} } as ObserverContext, "."),
    ).toThrow("scoped App and project workspace roots");
  });
});
