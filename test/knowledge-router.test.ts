import { describe, it, expect, beforeEach } from "vitest";
import {
  matchKnowledge,
  formatKnowledgeInjection,
  type KnowledgeEntry,
  type KnowledgeMatch,
} from "../src/lib/knowledge-router.js";

// ── Test fixtures ──────────────────────────────────────────────

const ENTRIES: KnowledgeEntry[] = [
  {
    id: "KE-002",
    file: "entries/KE-002.md",
    oneliner: "Text rules have 0% success for judgment failures",
    keywords: ["text rule", "judgment", "SOUL.md", "skill", "behavioral", "intervention", "fix behavior"],
    agents: ["*"],
  },
  {
    id: "KE-003",
    file: "entries/KE-003.md",
    oneliner: "Rich delegation context reduces wasted ops by 47%",
    keywords: ["delegation", "delegate", "coder", "call agent", "agents.call"],
    agents: ["tech-lead", "optimizer", "may"],
  },
  {
    id: "KE-007",
    file: "entries/KE-007.md",
    oneliner: "Workflow enforcement is the ONLY reliable behavioral intervention",
    keywords: ["workflow", "intervention", "behavioral", "enforcement"],
    agents: ["*"],
  },
  {
    id: "KE-010",
    file: "entries/KE-010.md",
    oneliner: "Most gym scenarios hit ceiling — agents pass at baseline",
    keywords: ["gym", "scenario", "baseline", "ceiling", "benchmark"],
    agents: ["coach", "tech-lead"],
  },
  {
    id: "KE-013",
    file: "entries/KE-013.md",
    oneliner: "Task boundedness is the primary driver of delegated session quality",
    keywords: ["delegation", "task", "bounded", "quality", "delegated"],
    agents: ["*"],
  },
  {
    id: "KE-015",
    file: "entries/KE-015.md",
    oneliner: "Decision topology R predicts workflow effectiveness",
    keywords: ["workflow", "decision topology", "R value", "effectiveness"],
    agents: ["*"],
  },
];

// ── matchKnowledge ─────────────────────────────────────────────

describe("matchKnowledge", () => {
  it("matches keywords in task text", () => {
    const results = matchKnowledge("Build a new workflow for code review", "tech-lead", ENTRIES);
    const ids = results.map((m) => m.entry.id);
    expect(ids).toContain("KE-007"); // "workflow" keyword
    expect(ids).toContain("KE-015"); // "workflow" keyword
  });

  it("scores by number of matching keywords", () => {
    // "delegation" + "delegated" matches more keywords in KE-013
    const results = matchKnowledge(
      "Improve delegation quality for delegated coder tasks",
      "tech-lead",
      ENTRIES,
    );
    // KE-013 has keywords: delegation, task, delegated → 3 matches
    // KE-003 has keywords: delegation, coder → 2 matches
    expect(results[0].entry.id).toBe("KE-013");
    expect(results[0].score).toBeGreaterThanOrEqual(2);
  });

  it("filters by agent name", () => {
    const results = matchKnowledge("Run gym scenario baseline", "optimizer", ENTRIES);
    // KE-010 is for coach, tech-lead only — optimizer should NOT see it
    const ids = results.map((m) => m.entry.id);
    expect(ids).not.toContain("KE-010");
  });

  it("includes wildcard entries for any agent", () => {
    const results = matchKnowledge("Design a new workflow", "scout", ENTRIES);
    // KE-007 and KE-015 have agents: ["*"]
    const ids = results.map((m) => m.entry.id);
    expect(ids).toContain("KE-007");
    expect(ids).toContain("KE-015");
  });

  it("respects maxResults limit", () => {
    const results = matchKnowledge(
      "behavioral intervention workflow judgment skill fix behavior",
      "tech-lead",
      ENTRIES,
      2,
    );
    expect(results).toHaveLength(2);
  });

  it("returns empty for no matches", () => {
    const results = matchKnowledge("Deploy the application to kubernetes", "tech-lead", ENTRIES);
    expect(results).toHaveLength(0);
  });

  it("returns empty for empty task", () => {
    expect(matchKnowledge("", "tech-lead", ENTRIES)).toHaveLength(0);
  });

  it("returns empty for empty entries", () => {
    expect(matchKnowledge("Run gym scenarios", "tech-lead", [])).toHaveLength(0);
  });

  it("handles case-insensitive matching", () => {
    const results = matchKnowledge("WORKFLOW enforcement for BEHAVIORAL change", "tech-lead", ENTRIES);
    const ids = results.map((m) => m.entry.id);
    expect(ids).toContain("KE-007");
  });

  it("tracks which keywords matched", () => {
    const results = matchKnowledge("Build a workflow intervention", "tech-lead", ENTRIES);
    const ke007 = results.find((m) => m.entry.id === "KE-007");
    expect(ke007).toBeDefined();
    expect(ke007!.matchedKeywords).toContain("workflow");
    expect(ke007!.matchedKeywords).toContain("intervention");
  });
});

// ── formatKnowledgeInjection ───────────────────────────────────

describe("formatKnowledgeInjection", () => {
  it("formats matches as one-liner list", () => {
    const matches: KnowledgeMatch[] = [
      { entry: ENTRIES[0], score: 2, matchedKeywords: ["judgment", "skill"] },
      { entry: ENTRIES[2], score: 1, matchedKeywords: ["workflow"] },
    ];
    const result = formatKnowledgeInjection(matches);
    expect(result).toContain("## Relevant Knowledge");
    expect(result).toContain("**KE-002**");
    expect(result).toContain("**KE-007**");
    expect(result).toContain("→ knowledge/entries/KE-002.md");
    expect(result).toContain("→ knowledge/entries/KE-007.md");
  });

  it("returns empty string for no matches", () => {
    expect(formatKnowledgeInjection([])).toBe("");
  });
});

// ── Heartbeat-only gating (integration logic) ─────────────────

describe("heartbeat detection", () => {
  // This tests the gating logic used in manager.ts buildSessionContext().
  // Knowledge injection should ONLY fire for heartbeat sessions.
  const isHeartbeat = (taskText: string | undefined) =>
    taskText?.startsWith("[heartbeat]") ?? false;

  it("detects standard heartbeat prefix", () => {
    expect(isHeartbeat("[heartbeat] Read agents/tech-lead/heartbeat.md and work through each section")).toBe(true);
  });

  it("detects heartbeat with injected tasks", () => {
    expect(isHeartbeat("[heartbeat] Read agents/bob/heartbeat.md and work through it.\n\n---\nInjected: pending tasks\n...")).toBe(true);
  });

  it("rejects delegated task", () => {
    expect(isHeartbeat("Fix the bug in src/lib/manager.ts where sessions are not cleaned up")).toBe(false);
  });

  it("rejects cron job messages", () => {
    expect(isHeartbeat("[cron:watchdog] Check for stale sessions.")).toBe(false);
  });

  it("rejects undefined task", () => {
    expect(isHeartbeat(undefined)).toBe(false);
  });

  it("rejects empty task", () => {
    expect(isHeartbeat("")).toBe(false);
  });

  it("heartbeat task gets knowledge matches while delegated task would too (router itself is task-agnostic)", () => {
    // The router matches keywords regardless of heartbeat prefix.
    // The gating is done in manager.ts, not in the router.
    const heartbeatTask = "[heartbeat] Read agents/tech-lead/heartbeat.md and work through it. --- Build a new workflow for delegation.";
    const delegatedTask = "Build a new workflow for delegation.";

    const heartbeatMatches = matchKnowledge(heartbeatTask, "tech-lead", ENTRIES);
    const delegatedMatches = matchKnowledge(delegatedTask, "tech-lead", ENTRIES);

    // Both should match workflow-related entries (router is keyword-based)
    expect(heartbeatMatches.length).toBeGreaterThan(0);
    expect(delegatedMatches.length).toBeGreaterThan(0);

    // But only the heartbeat one passes the gate
    expect(isHeartbeat(heartbeatTask)).toBe(true);
    expect(isHeartbeat(delegatedTask)).toBe(false);
  });
});
