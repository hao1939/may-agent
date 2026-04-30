import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runMasterWorker, type MasterWorkerConfig, type RunResult } from "../workflows/master-worker-unified.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock retry-wrapper to avoid real delays
vi.mock("../workflows/retry-wrapper.ts", () => ({
  createRetryWrapper: (config: any) => {
    return async (fn: () => Promise<any>) => {
      const result = await fn();
      return { result, attempts: 1, totalMs: 0 };
    };
  },
  createInitialCircuitState: () => ({ state: "closed", failures: 0, lastFailure: 0 }),
  getEffectiveCircuitState: (s: any) => s,
}));

describe("master-worker-unified", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mw-unified-"));
    writeFileSync(join(tmpDir, "project.md"), "# Test Project\n\nStatus: active\n\nSome content here for testing purposes.");
    writeFileSync(join(tmpDir, "journal.md"), "# Journal\n");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("basic operation (no optional features)", () => {
    it("runs dispatch for maxIterations when no stop signal", async () => {
      const dispatch = vi.fn().mockResolvedValue("continue working");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 3,
        dispatch,
      });
      expect(result.iterations).toBe(3);
      expect(dispatch).toHaveBeenCalledTimes(3);
    });

    it("defaults maxIterations to 50", async () => {
      let callCount = 0;
      const dispatch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount >= 5) throw new Error("stop");
        return "ok";
      });
      const result = await runMasterWorker({ projectDir: tmpDir, dispatch });
      expect(result.stopReason).toContain("dispatch-error");
    });

    it("stops on dispatch error", async () => {
      const dispatch = vi.fn()
        .mockResolvedValueOnce("ok")
        .mockRejectedValueOnce(new Error("network timeout"));
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 5,
        dispatch,
      });
      expect(result.stopped).toBe(true);
      expect(result.stopReason).toContain("network timeout");
      expect(result.iterations).toBe(2);
    });

    it("passes iteration number to dispatch", async () => {
      const dispatch = vi.fn().mockResolvedValue("ok");
      await runMasterWorker({ projectDir: tmpDir, maxIterations: 3, dispatch });
      expect(dispatch).toHaveBeenCalledWith(expect.any(String), 1);
      expect(dispatch).toHaveBeenCalledWith(expect.any(String), 2);
      expect(dispatch).toHaveBeenCalledWith(expect.any(String), 3);
    });
  });

  describe("with cache enabled", () => {
    it("returns cache report when caching is enabled", async () => {
      const dispatch = vi.fn().mockResolvedValue("done");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 2,
        cache: { enabled: true, ttlMs: 5000 },
        dispatch,
      });
      expect(result.cacheReport).toBeDefined();
      expect(result.cacheReport).toHaveProperty("hits");
      expect(result.cacheReport).toHaveProperty("misses");
    });

    it("provides formatted context from cache", async () => {
      const dispatch = vi.fn().mockResolvedValue("continue");
      await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 1,
        cache: { enabled: true },
        dispatch,
      });
      const contextArg = dispatch.mock.calls[0][0];
      expect(contextArg.length).toBeGreaterThan(10);
    });
  });

  describe("with health check enabled", () => {
    it("skips execution when project.md is missing", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "mw-empty-"));
      const dispatch = vi.fn().mockResolvedValue("ok");
      const result = await runMasterWorker({
        projectDir: emptyDir,
        healthCheck: { enabled: true },
        dispatch,
      });
      expect(result.stopped).toBe(true);
      expect(result.stopReason).toContain("not found");
      expect(dispatch).not.toHaveBeenCalled();
      rmSync(emptyDir, { recursive: true, force: true });
    });

    it("proceeds when project.md exists and is fresh", async () => {
      const dispatch = vi.fn().mockResolvedValue("ok");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 1,
        healthCheck: { enabled: true },
        dispatch,
      });
      expect(result.healthCheckResult?.proceed).toBe(true);
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it("allows missing project when skipOnMissing=false", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "mw-nomiss-"));
      const dispatch = vi.fn().mockResolvedValue("ok");
      const result = await runMasterWorker({
        projectDir: emptyDir,
        maxIterations: 1,
        healthCheck: { enabled: true, skipOnMissing: false },
        dispatch,
      });
      expect(result.healthCheckResult?.proceed).toBe(true);
      rmSync(emptyDir, { recursive: true, force: true });
    });

    it("includes health check result in output", async () => {
      const dispatch = vi.fn().mockResolvedValue("ok");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 1,
        healthCheck: { enabled: true },
        dispatch,
      });
      expect(result.healthCheckResult).toEqual({ proceed: true, reason: "healthy" });
    });
  });

  describe("with resilience enabled", () => {
    it("wraps dispatch in retry wrapper", async () => {
      const dispatch = vi.fn().mockResolvedValue("resilient response");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 2,
        resilience: { enabled: true, maxRetries: 5 },
        dispatch,
      });
      expect(result.iterations).toBe(2);
      expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it("uses default resilience config values", async () => {
      const dispatch = vi.fn().mockResolvedValue("ok");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 1,
        resilience: { enabled: true },
        dispatch,
      });
      expect(result.iterations).toBe(1);
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe("combined features", () => {
    it("runs with all features enabled", async () => {
      const dispatch = vi.fn().mockResolvedValue("all features");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 2,
        cache: { enabled: true },
        resilience: { enabled: true },
        healthCheck: { enabled: true },
        dispatch,
      });
      expect(result.iterations).toBe(2);
      expect(result.cacheReport).toBeDefined();
      expect(result.healthCheckResult?.proceed).toBe(true);
    });

    it("health check failure short-circuits everything", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "mw-short-"));
      const dispatch = vi.fn().mockResolvedValue("ok");
      const result = await runMasterWorker({
        projectDir: emptyDir,
        maxIterations: 10,
        cache: { enabled: true },
        resilience: { enabled: true },
        healthCheck: { enabled: true },
        dispatch,
      });
      expect(result.stopped).toBe(true);
      expect(result.iterations).toBe(0);
      expect(result.cacheReport).toBeUndefined();
      rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe("stop signal detection", () => {
    it("stops when worker signals completion via cache path", async () => {
      const dispatch = vi.fn()
        .mockResolvedValueOnce("working on it")
        .mockResolvedValueOnce("DECISION: STOP");
      const result = await runMasterWorker({
        projectDir: tmpDir,
        maxIterations: 10,
        cache: { enabled: true },
        dispatch,
      });
      expect(result.stopped).toBe(true);
      expect(result.stopReason).toBe("worker-signaled-stop");
      expect(result.iterations).toBe(2);
    });
  });
});
