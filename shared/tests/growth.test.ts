import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { forkAgent, promoteAgent, discardAgent, listLabAgents, type GrowthConfig } from "../lib/growth.ts";

describe("growth", () => {
  let agentsRoot: string;
  let config: GrowthConfig;

  beforeEach(() => {
    agentsRoot = mkdtempSync(join(tmpdir(), "growth-test-"));
    config = { agentsRoot };
    // Create a sample agent
    const agentDir = join(agentsRoot, "test-agent");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "AGENTS.md"), "# Test Agent");
    writeFileSync(join(agentDir, "heartbeat.md"), "# HB");
  });

  afterEach(() => {
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  describe("forkAgent", () => {
    it("creates a fork in .lab directory", () => {
      const result = forkAgent(config, "test-agent", "my-fork");
      expect(result.forkName).toBe("my-fork");
      expect(result.copiedFrom).toBe("test-agent");
      expect(result.files).toContain("AGENTS.md");
      expect(existsSync(join(agentsRoot, ".lab", "my-fork", "AGENTS.md"))).toBe(true);
    });

    it("generates fork name if not provided", () => {
      const result = forkAgent(config, "test-agent");
      expect(result.forkName).toMatch(/^test-agent-fork-\d+$/);
    });

    it("throws for non-existent agent", () => {
      expect(() => forkAgent(config, "nonexistent")).toThrow("not found");
    });
  });

  describe("promoteAgent", () => {
    it("copies fork to target location", () => {
      forkAgent(config, "test-agent", "my-fork");
      const result = promoteAgent(config, "my-fork", "promoted-agent");
      expect(result.promoted).toContain("AGENTS.md");
      expect(existsSync(join(agentsRoot, "promoted-agent", "AGENTS.md"))).toBe(true);
    });

    it("throws for non-existent fork", () => {
      expect(() => promoteAgent(config, "nonexistent", "target")).toThrow("not found");
    });
  });

  describe("discardAgent", () => {
    it("removes fork from .lab", () => {
      forkAgent(config, "test-agent", "to-discard");
      expect(existsSync(join(agentsRoot, ".lab", "to-discard"))).toBe(true);
      discardAgent(config, "to-discard");
      expect(existsSync(join(agentsRoot, ".lab", "to-discard"))).toBe(false);
    });

    it("does nothing for non-existent fork", () => {
      expect(() => discardAgent(config, "nonexistent")).not.toThrow();
    });
  });

  describe("listLabAgents", () => {
    it("returns empty array when no .lab exists", () => {
      expect(listLabAgents(config)).toEqual([]);
    });

    it("lists agents with AGENTS.md or heartbeat.md", () => {
      forkAgent(config, "test-agent", "fork1");
      const list = listLabAgents(config);
      expect(list).toContain("fork1");
    });

    it("excludes directories without AGENTS.md or heartbeat.md", () => {
      mkdirSync(join(agentsRoot, ".lab", "empty-dir"), { recursive: true });
      forkAgent(config, "test-agent", "valid-fork");
      const list = listLabAgents(config);
      expect(list).toContain("valid-fork");
      expect(list).not.toContain("empty-dir");
    });
  });
});
