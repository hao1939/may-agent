/**
 * Tests for orphaned child session reconciliation after process restart.
 *
 * Bug: When a process restart creates a NEW chat session for the agent,
 * children of the OLD session (parentSessionId → old session) were invisible
 * because reconciliation only matched `parentSessionId === targetSessionId`.
 *
 * Fix: Build a set of ALL session IDs belonging to the target agent, and
 * match children whose parentSessionId belongs to any of those sessions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import {
  ensureSessionDir,
  writeSessionMeta,
  readSessionMeta,
  appendSessionMessage,
  type PersistedSession,
} from "./persistence.js";
import { SubagentManager } from "./manager.js";

// ── Mock the Agent class so resumeAgent() doesn't hit any LLM ──────────

// Capture the resume message sent via agent.prompt()
let capturedResumeMessage: AgentMessage | null = null;

vi.mock("@mariozechner/pi-agent-core", async () => {
  const actual = await vi.importActual<typeof import("@mariozechner/pi-agent-core")>("@mariozechner/pi-agent-core");
  return {
    ...actual,
    Agent: class MockAgent {
      state: {
        systemPrompt: string;
        model: any;
        thinkingLevel: string;
        tools: any[];
        messages: AgentMessage[];
        isStreaming: boolean;
        streamMessage: null;
        pendingToolCalls: Set<string>;
        error?: string;
      };

      constructor(opts: any) {
        this.state = {
          systemPrompt: opts?.initialState?.systemPrompt ?? "",
          model: opts?.initialState?.model ?? {},
          thinkingLevel: "off",
          tools: opts?.initialState?.tools ?? [],
          messages: opts?.initialState?.messages ? [...opts.initialState.messages] : [],
          isStreaming: false,
          streamMessage: null,
          pendingToolCalls: new Set(),
        };
      }

      subscribe(_cb: any) { return () => {}; }

      prompt(msg: AgentMessage | AgentMessage[] | string) {
        capturedResumeMessage = typeof msg === "string" ? null : Array.isArray(msg) ? msg[0] : msg;
        return Promise.resolve();
      }

      continue() {
        return Promise.resolve();
      }

      followUp(msg: AgentMessage) {
        this.state.messages.push(msg);
      }

      replaceMessages(msgs: AgentMessage[]) {
        this.state.messages = [...msgs];
      }

      getMessages() {
        return this.state.messages;
      }

      abort() {}
    },
  };
});

// ── Helpers ─────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  const dir = join(tmpdir(), `orphan-reconcile-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeUserMessage(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: ts,
  } as AgentMessage;
}

function makeAssistantMessage(text: string, ts = Date.now()): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: ts,
    stopReason: "stop",
  } as AgentMessage;
}

/** Extract text from the captured resume AgentMessage. */
function getResumeText(): string {
  if (!capturedResumeMessage) return "";
  const content = (capturedResumeMessage as any).content;
  if (Array.isArray(content)) {
    return content.map((c: any) => c.text ?? "").join("");
  }
  return "";
}

/** Minimal model stub that satisfies the type requirement. */
const stubModel = { id: "stub" } as any;

// ── Tests ───────────────────────────────────────────────────────────────

describe("Orphaned child session reconciliation", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = makeTmpDir();
    capturedResumeMessage = null;
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  function createManager() {
    const manager = new SubagentManager({ persistDir, projectRoot: persistDir });
    manager.register({
      name: "may",
      description: "Test agent",
      domain: "test",
      systemPrompt: "You are a test agent.",
      tools: [],
      model: stubModel,
    });
    return manager;
  }

  /**
   * Scenario: May's current session is s_new (running). An old archived
   * session s_old also belongs to May. A child "coach" session has
   * parentSessionId: s_old.  Before the fix, this child was invisible.
   */
  it("finds completed children whose parentSessionId points to an old session of the same agent", async () => {
    const oldMaySession = "s_old_may_session";
    const newMaySession = "s_new_may_session";
    const coachSession = "s_coach_child";

    // Old May session — done/archived
    ensureSessionDir(persistDir, oldMaySession);
    writeSessionMeta(persistDir, oldMaySession, {
      agent: "may",
      task: "Old chat session",
      status: "done",
      startedAt: 1000,
      endedAt: 2000,
    });

    // Current May session — running (will be resumed)
    ensureSessionDir(persistDir, newMaySession);
    writeSessionMeta(persistDir, newMaySession, {
      agent: "may",
      task: "Current chat session",
      status: "running",
      startedAt: 3000,
    });
    // Write minimal conversation so resume works
    appendSessionMessage(persistDir, newMaySession, makeUserMessage("hello"));
    appendSessionMessage(persistDir, newMaySession, makeAssistantMessage("hi there"));

    // Coach child session — done, parented to the OLD May session
    ensureSessionDir(persistDir, coachSession);
    writeSessionMeta(persistDir, coachSession, {
      agent: "coach",
      task: "Review code quality",
      status: "done",
      startedAt: 1500,
      endedAt: 1800,
      parentSessionId: oldMaySession, // Points to old session!
    });

    const manager = createManager();
    const result = manager.resumeAgent("may");

    // Wait for async handleCompletion
    await new Promise((r) => setTimeout(r, 50));

    expect(result.resumed.sessionId).toBe(newMaySession);

    // The resume prompt should mention the coach child session
    const resumeText = getResumeText();
    expect(resumeText).toContain("coach");
    expect(resumeText).toContain(coachSession);
    expect(resumeText).toContain("Review code quality");
  });

  it("finds stale-running children whose parentSessionId points to an old session of the same agent", async () => {
    const oldMaySession = "s_old_may_2";
    const newMaySession = "s_new_may_2";
    const staleChild = "s_stale_child";

    // Old May session — interrupted
    ensureSessionDir(persistDir, oldMaySession);
    writeSessionMeta(persistDir, oldMaySession, {
      agent: "may",
      task: "Previous chat",
      status: "interrupted",
      startedAt: 1000,
      endedAt: 2000,
    });

    // Current May session — running
    ensureSessionDir(persistDir, newMaySession);
    writeSessionMeta(persistDir, newMaySession, {
      agent: "may",
      task: "Current chat",
      status: "running",
      startedAt: 3000,
    });
    appendSessionMessage(persistDir, newMaySession, makeUserMessage("hello"));
    appendSessionMessage(persistDir, newMaySession, makeAssistantMessage("hi"));

    // Stale child — registry says "running" but no ActiveSession exists
    ensureSessionDir(persistDir, staleChild);
    writeSessionMeta(persistDir, staleChild, {
      agent: "bob",
      task: "Fix the bug",
      status: "running",
      startedAt: 1500,
      parentSessionId: oldMaySession, // Points to old session!
    });

    const manager = createManager();
    const result = manager.resumeAgent("may");

    // Wait for async completion
    await new Promise((r) => setTimeout(r, 50));

    // Stale child should be marked interrupted
    const staleMeta = readSessionMeta(persistDir, staleChild);
    expect(staleMeta).not.toBeNull();
    expect(staleMeta!.status).toBe("interrupted");

    // Resume message should mention the stale child
    const resumeText = getResumeText();
    expect(resumeText).toContain("bob");
    expect(resumeText).toContain(staleChild);
    expect(resumeText).toContain("Fix the bug");
    expect(resumeText).toContain("stale");
  });

  it("still finds children whose parentSessionId matches the current (target) session", async () => {
    const currentSession = "s_current_may";
    const childSession = "s_child_direct";

    // Current May session — running
    ensureSessionDir(persistDir, currentSession);
    writeSessionMeta(persistDir, currentSession, {
      agent: "may",
      task: "Active chat",
      status: "running",
      startedAt: 1000,
    });
    appendSessionMessage(persistDir, currentSession, makeUserMessage("yo"));
    appendSessionMessage(persistDir, currentSession, makeAssistantMessage("hey"));

    // Child pointing to current session (the original working case)
    ensureSessionDir(persistDir, childSession);
    writeSessionMeta(persistDir, childSession, {
      agent: "reviewer",
      task: "Review PR #42",
      status: "done",
      startedAt: 1100,
      endedAt: 1200,
      parentSessionId: currentSession,
    });

    const manager = createManager();
    const result = manager.resumeAgent("may");

    await new Promise((r) => setTimeout(r, 50));

    // Child should still be found
    const resumeText = getResumeText();
    expect(resumeText).toContain("reviewer");
    expect(resumeText).toContain(childSession);
    expect(resumeText).toContain("Review PR #42");
  });

  it("does not duplicate children already in the interrupted array", async () => {
    const currentSession = "s_current_may_3";
    const interruptedChild = "s_interrupted_child";

    // Current May session — running
    ensureSessionDir(persistDir, currentSession);
    writeSessionMeta(persistDir, currentSession, {
      agent: "may",
      task: "Active chat",
      status: "running",
      startedAt: 1000,
    });
    appendSessionMessage(persistDir, currentSession, makeUserMessage("yo"));
    appendSessionMessage(persistDir, currentSession, makeAssistantMessage("hey"));

    // Another session that's also "running" but belongs to a different agent.
    // This will go into the `interrupted` array during resume (otherRunning).
    ensureSessionDir(persistDir, interruptedChild);
    writeSessionMeta(persistDir, interruptedChild, {
      agent: "bob",
      task: "Interrupted work",
      status: "running",
      startedAt: 1050,
      parentSessionId: currentSession,
    });

    const manager = createManager();
    // Register bob so the interrupted session lookup works properly
    manager.register({
      name: "bob",
      description: "Helper",
      domain: "test",
      systemPrompt: "helper",
      tools: [],
      model: stubModel,
    });

    const result = manager.resumeAgent("may");

    await new Promise((r) => setTimeout(r, 50));

    // The interruptedChild should appear in the interrupted list
    expect(result.interrupted.some((s) => s.sessionId === interruptedChild)).toBe(true);

    // The resume text should mention the interrupted child in the "Interrupted" section
    // but NOT in the "Completed/stale" children section
    const resumeText = getResumeText();
    const childSectionMatch = resumeText.split("Completed/stale child sessions");
    // If childSection exists, it should not contain the interrupted child
    if (childSectionMatch.length > 1) {
      expect(childSectionMatch[1]).not.toContain(interruptedChild);
    }
  });

  it("handles mixed scenario: children from old AND current sessions", async () => {
    const oldSession = "s_old_mixed";
    const currentSession = "s_current_mixed";
    const oldChild = "s_old_child";
    const currentChild = "s_current_child";
    const staleChild = "s_stale_mixed";

    // Old May session
    ensureSessionDir(persistDir, oldSession);
    writeSessionMeta(persistDir, oldSession, {
      agent: "may",
      task: "Old session",
      status: "done",
      startedAt: 1000,
      endedAt: 2000,
    });

    // Current May session
    ensureSessionDir(persistDir, currentSession);
    writeSessionMeta(persistDir, currentSession, {
      agent: "may",
      task: "Current session",
      status: "running",
      startedAt: 3000,
    });
    appendSessionMessage(persistDir, currentSession, makeUserMessage("hello"));
    appendSessionMessage(persistDir, currentSession, makeAssistantMessage("hi"));

    // Completed child of old session
    ensureSessionDir(persistDir, oldChild);
    writeSessionMeta(persistDir, oldChild, {
      agent: "alice",
      task: "Old task from alice",
      status: "done",
      startedAt: 1100,
      endedAt: 1200,
      parentSessionId: oldSession,
    });

    // Completed child of current session
    ensureSessionDir(persistDir, currentChild);
    writeSessionMeta(persistDir, currentChild, {
      agent: "bob",
      task: "Current task from bob",
      status: "error",
      startedAt: 3100,
      endedAt: 3200,
      error: "Something failed",
      parentSessionId: currentSession,
    });

    // Stale running child of old session
    ensureSessionDir(persistDir, staleChild);
    writeSessionMeta(persistDir, staleChild, {
      agent: "carol",
      task: "Stale work from carol",
      status: "running",
      startedAt: 1300,
      parentSessionId: oldSession,
    });

    const manager = createManager();
    const result = manager.resumeAgent("may");

    await new Promise((r) => setTimeout(r, 50));

    const resumeText = getResumeText();

    // All three children should appear in the resume message
    expect(resumeText).toContain("alice");
    expect(resumeText).toContain(oldChild);
    expect(resumeText).toContain("Old task from alice");

    expect(resumeText).toContain("bob");
    expect(resumeText).toContain(currentChild);
    expect(resumeText).toContain("Current task from bob");

    expect(resumeText).toContain("carol");
    expect(resumeText).toContain(staleChild);
    expect(resumeText).toContain("Stale work from carol");

    // Stale child should be marked interrupted
    const staleMeta = readSessionMeta(persistDir, staleChild);
    expect(staleMeta!.status).toBe("interrupted");
  });

  it("does not include children of a different agent's sessions", async () => {
    const maySession = "s_may_isolation";
    const otherAgentSession = "s_other_agent";
    const otherChild = "s_other_child";

    // May's running session
    ensureSessionDir(persistDir, maySession);
    writeSessionMeta(persistDir, maySession, {
      agent: "may",
      task: "May chat",
      status: "running",
      startedAt: 1000,
    });
    appendSessionMessage(persistDir, maySession, makeUserMessage("hi"));
    appendSessionMessage(persistDir, maySession, makeAssistantMessage("hey"));

    // Some other agent's old session
    ensureSessionDir(persistDir, otherAgentSession);
    writeSessionMeta(persistDir, otherAgentSession, {
      agent: "zara",
      task: "Zara work",
      status: "done",
      startedAt: 500,
      endedAt: 600,
    });

    // Child of Zara's session — should NOT appear in May's resume
    ensureSessionDir(persistDir, otherChild);
    writeSessionMeta(persistDir, otherChild, {
      agent: "helper",
      task: "Zara's helper task",
      status: "done",
      startedAt: 550,
      endedAt: 580,
      parentSessionId: otherAgentSession,
    });

    const manager = createManager();
    const result = manager.resumeAgent("may");

    await new Promise((r) => setTimeout(r, 50));

    const resumeText = getResumeText();
    expect(resumeText).not.toContain("Zara's helper task");
    expect(resumeText).not.toContain(otherChild);
  });
});
