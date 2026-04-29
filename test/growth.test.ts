import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  forkAgent,
  promoteAgent,
  discardAgent,
  listLabAgents,
  type GrowthConfig,
} from "../shared/lib/growth.js";

const TMP = join(__dirname, "__tmp_growth__");

function makeConfig(): GrowthConfig {
  return { agentsRoot: TMP };
}

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("forkAgent", () => {
  it("copies agent dir into .lab/<forkName>", () => {
    const agentDir = join(TMP, "alice");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "SOUL.md"), "soul");
    writeFileSync(join(agentDir, "handler.ts"), "code");

    const result = forkAgent(makeConfig(), "alice", "alice-experiment");
    expect(result.forkName).toBe("alice-experiment");
    expect(result.copiedFrom).toBe("alice");
    expect(result.files).toContain("SOUL.md");
    expect(result.files).toContain("handler.ts");
    expect(existsSync(join(TMP, ".lab", "alice-experiment", "SOUL.md"))).toBe(true);
  });

  it("auto-generates fork name when not provided", () => {
    const agentDir = join(TMP, "bob");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "SOUL.md"), "soul");

    const result = forkAgent(makeConfig(), "bob");
    expect(result.forkName).toMatch(/^bob-fork-\d+$/);
  });

  it("throws if source agent doesn't exist", () => {
    expect(() => forkAgent(makeConfig(), "nonexistent")).toThrow('Agent "nonexistent" not found');
  });
});

describe("promoteAgent", () => {
  it("copies fork to target location", () => {
    const labDir = join(TMP, ".lab", "my-fork");
    mkdirSync(labDir, { recursive: true });
    writeFileSync(join(labDir, "SOUL.md"), "promoted soul");

    const result = promoteAgent(makeConfig(), "my-fork", "production-agent");
    expect(result.promoted).toContain("SOUL.md");
    expect(existsSync(join(TMP, "production-agent", "SOUL.md"))).toBe(true);
  });

  it("throws if fork doesn't exist", () => {
    expect(() => promoteAgent(makeConfig(), "ghost", "target")).toThrow('Fork "ghost" not found');
  });
});

describe("discardAgent", () => {
  it("removes the fork directory", () => {
    const labDir = join(TMP, ".lab", "temp-fork");
    mkdirSync(labDir, { recursive: true });
    writeFileSync(join(labDir, "file.txt"), "data");

    discardAgent(makeConfig(), "temp-fork");
    expect(existsSync(labDir)).toBe(false);
  });

  it("does nothing if fork doesn't exist", () => {
    expect(() => discardAgent(makeConfig(), "nonexistent")).not.toThrow();
  });
});

describe("listLabAgents", () => {
  it("returns empty array when .lab doesn't exist", () => {
    expect(listLabAgents(makeConfig())).toEqual([]);
  });

  it("returns agents that have SOUL.md", () => {
    const lab = join(TMP, ".lab");
    mkdirSync(join(lab, "agent-a"), { recursive: true });
    writeFileSync(join(lab, "agent-a", "SOUL.md"), "soul");
    mkdirSync(join(lab, "agent-b"), { recursive: true });
    writeFileSync(join(lab, "agent-b", "heartbeat.md"), "hb");
    mkdirSync(join(lab, "no-soul"), { recursive: true });
    writeFileSync(join(lab, "no-soul", "random.txt"), "x");

    const result = listLabAgents(makeConfig());
    expect(result).toContain("agent-a");
    expect(result).toContain("agent-b");
    expect(result).not.toContain("no-soul");
  });
});
