import { describe, it, expect } from "vitest";
import {
  resilientConfigToUnified,
} from "../workflows/master-worker-migration-adapter.ts";

describe("master-worker-migration-adapter", () => {
  describe("resilientConfigToUnified", () => {
    it("converts minimal resilient config to unified options", () => {
      const config = { projectDir: "/tmp/test", maxIterations: 5 } as any;
      const provider = { dispatch: async () => "response" };
      const result = resilientConfigToUnified(config, provider);

      expect(result.projectDir).toBe("/tmp/test");
      expect(result.maxIterations).toBe(5);
      expect(result.resilience?.enabled).toBe(true);
      expect(result.cache?.enabled).toBe(true);
      expect(result.healthCheck?.enabled).toBe(false);
    });

    it("maps retry config fields", () => {
      const config = {
        projectDir: "/tmp/test",
        retryConfig: { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 60000 },
      } as any;
      const provider = { dispatch: async () => "response" };
      const result = resilientConfigToUnified(config, provider);

      expect(result.resilience?.maxRetries).toBe(5);
      expect(result.resilience?.baseDelayMs).toBe(2000);
      expect(result.resilience?.maxDelayMs).toBe(60000);
    });

    it("uses defaults when retry config is absent", () => {
      const config = { projectDir: "/tmp/test" } as any;
      const provider = { dispatch: async () => "response" };
      const result = resilientConfigToUnified(config, provider);

      expect(result.maxIterations).toBe(10);
      expect(result.resilience?.maxRetries).toBe(3);
      expect(result.resilience?.baseDelayMs).toBe(1000);
      expect(result.resilience?.maxDelayMs).toBe(30000);
    });

    it("passes provider dispatch function through", () => {
      const dispatch = async () => "test-response";
      const config = { projectDir: "/tmp/test" } as any;
      const result = resilientConfigToUnified(config, { dispatch });

      expect(result.provider?.dispatch).toBe(dispatch);
    });

    it("enables circuit breaker by default", () => {
      const config = { projectDir: "/tmp/test" } as any;
      const provider = { dispatch: async () => "" };
      const result = resilientConfigToUnified(config, provider);

      expect(result.resilience?.circuitBreaker).toBe(true);
    });
  });
});
