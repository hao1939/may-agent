import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attachCommandRouter } from "../../src/app/command-router.js";
import { EventBus, type AgentEvent } from "../../src/app/event-bus.js";
import type { ChatSession } from "../../src/app/chat-session.js";
import type { SubagentManager } from "../../src/lib/index.js";

function createHarness(overrides: Partial<SubagentManager> = {}, projectRoot = mkdtempSync(join(tmpdir(), "router-"))) {
  const bus = new EventBus();
  const emitted: AgentEvent[] = [];
  bus.subscribe((event) => emitted.push(event));

  const manager = {
    status: () => [],
    cancel: () => {},
    send: () => {},
    resumeSession: () => "resumed",
    run: () => "new-session",
    ...overrides,
  } as unknown as SubagentManager;

  let chatSession: ChatSession | undefined;
  const router = attachCommandRouter({
    bus,
    manager,
    getChatSession: () => chatSession,
    clearCancelLatch: () => {},
    projectRoot,
    reload: () => {},
    restart: () => {},
    shutdown: () => {},
  });

  return {
    bus,
    emitted,
    router,
    projectRoot,
    setChatSession: (session: ChatSession | undefined) => {
      chatSession = session;
    },
  };
}

describe("command router", () => {
  it("routes natural-language status through the human chat contract", () => {
    const h = createHarness();

    h.router.handleInput("status", "test");

    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "chat.start.requested",
        source: "test",
        data: expect.objectContaining({ message: "status" }),
      }),
    );
    expect(h.emitted).not.toContainEqual({ type: "info", message: "[status] No active sessions" });
    h.router.close();
  });

  it("routes fork messages to May through the active chat session", () => {
    const handled: Array<{ message: string; source?: string }> = [];
    const h = createHarness();
    h.setChatSession({
      handleInput: (message: string, source?: string) => handled.push({ message, source }),
    } as unknown as ChatSession);

    h.bus.emit({ type: "fork", agent: "may", task: "please review", opts: { source: "socket" } });

    expect(handled).toEqual([{ message: "please review", source: "socket" }]);
    expect(h.emitted).toContainEqual({
      type: "message.created",
      source: "socket",
      owner: "agent:may",
      urgency: "immediate",
      data: {
        from: "socket",
        to: "may",
        content: "please review",
        intent: "fork",
        priority: "P0",
      },
    });
    h.router.close();
  });

  it("resumes cold sessions for steer events", () => {
    const resumed: Array<{
      sessionId: string;
      message: string;
      source?: string;
      suppressBenignRaceEvent?: boolean;
    }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (
        sessionId: string,
        message: string,
        opts?: { source?: string; suppressBenignRaceEvent?: boolean },
      ) => {
        resumed.push({
          sessionId,
          message,
          source: opts?.source,
          suppressBenignRaceEvent: opts?.suppressBenignRaceEvent,
        });
        return sessionId;
      },
    } as Partial<SubagentManager>);

    h.bus.emit({ type: "steer", sessionId: "s_cold", message: "follow up", source: "telegram" });

    expect(resumed).toEqual([
      { sessionId: "s_cold", message: "follow up", source: "telegram", suppressBenignRaceEvent: true },
    ]);
    h.router.close();
  });

  it("resumes cold sessions for canonical session.steer.requested events", () => {
    const resumed: Array<{
      sessionId: string;
      message: string;
      source?: string;
      suppressBenignRaceEvent?: boolean;
    }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (
        sessionId: string,
        message: string,
        opts?: { source?: string; suppressBenignRaceEvent?: boolean },
      ) => {
        resumed.push({
          sessionId,
          message,
          source: opts?.source,
          suppressBenignRaceEvent: opts?.suppressBenignRaceEvent,
        });
        return sessionId;
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "session.steer.requested",
      source: "web-ui",
      owner: "agent:may",
      data: { sessionId: "s_cold", message: "follow up" },
    });

    expect(resumed).toEqual([
      { sessionId: "s_cold", message: "follow up", source: "web-ui", suppressBenignRaceEvent: true },
    ]);
    h.router.close();
  });

  it("routes canonical chat.start.requested for May through the active chat session", () => {
    const handled: Array<{ message: string; source?: string }> = [];
    const h = createHarness();
    h.setChatSession({
      handleInput: (message: string, source?: string) => handled.push({ message, source }),
    } as unknown as ChatSession);

    h.bus.emit({
      type: "chat.start.requested",
      source: "may-console",
      owner: "agent:may",
      data: { agent: "may", message: "please review", channel: "may-console" },
    });

    expect(handled).toEqual([{ message: "please review", source: "may-console" }]);
    h.router.close();
  });

  it("starts a persistent chat session for canonical chat.start.requested when no chat session is bound", () => {
    const runs: Array<{
      agent: string;
      task: string;
      kind?: string;
      autoClose?: string;
      source?: string;
      requestId?: string;
    }> = [];
    const h = createHarness({
      run: (
        agent: string,
        task: string,
        opts?: { kind?: string; autoClose?: string; source?: string; requestId?: string },
      ) => {
        runs.push({
          agent,
          task,
          kind: opts?.kind,
          autoClose: opts?.autoClose,
          source: opts?.source,
          requestId: opts?.requestId,
        });
        return "s_new";
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "chat.start.requested",
      source: "cli",
      owner: "agent:dev",
      data: { agent: "dev", message: "investigate", channel: "cli", requestId: "r1" },
    });

    expect(runs).toEqual([
      { agent: "dev", task: "investigate", kind: "chat", autoClose: "never", source: "cli", requestId: "r1" },
    ]);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        source: "cli",
        owner: "agent:dev",
        data: expect.objectContaining({ to: "dev", content: "investigate", intent: "chat.start" }),
      }),
    );
    h.router.close();
  });

  it("normalizes human.input.received into chat.start.requested", () => {
    const handled: Array<{ message: string; source?: string }> = [];
    const runs: Array<{ agent: string; message: string; source?: string }> = [];
    const h = createHarness({
      run: (agent: string, message: string, opts?: { source?: string }) => {
        runs.push({ agent, message, source: opts?.source });
        return "s_telegram";
      },
    } as Partial<SubagentManager>);
    h.setChatSession({
      handleInput: (message: string, source?: string) => handled.push({ message, source }),
    } as unknown as ChatSession);

    h.bus.emit({
      type: "human.input.received",
      source: "telegram",
      owner: "agent:may",
      data: {
        actor: "human:hao",
        text: "please review",
        conversation: { channel: "telegram", channelThreadId: "123", channelMessageId: 701 },
        target: { agent: "may" },
      },
    } as any);

    expect(handled).toEqual([]);
    expect(runs).toEqual([{ agent: "may", message: "please review", source: "telegram" }]);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "chat.start.requested",
        source: "telegram",
        owner: "agent:may",
        data: expect.objectContaining({
          message: "please review",
          channel: "telegram",
          channelThreadId: "123",
          channelMessageId: 701,
          forceNew: true,
        }),
      }),
    );
    h.router.close();
  });

  it("normalizes targeted human.input.received into session.steer.requested", () => {
    const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
        resumed.push({ sessionId, message, source: opts?.source });
        return sessionId;
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "human.input.received",
      source: "web-ui",
      owner: "agent:may",
      data: {
        text: "follow up",
        conversation: { channel: "web-ui" },
        target: { sessionId: "s_cold" },
      },
    } as any);

    expect(resumed).toEqual([{ sessionId: "s_cold", message: "follow up", source: "web-ui" }]);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "session.steer.requested",
        source: "web-ui",
        data: { sessionId: "s_cold", message: "follow up" },
      }),
    );
    h.router.close();
  });

  it("projects approval replies into project.approval.submitted before session steering or project comments", () => {
    const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
    const projectRoot = mkdtempSync(join(tmpdir(), "router-approval-owner-"));
    const appDir = join(projectRoot, "projects/alpha-project.app");
    mkdirp(appDir);
    writeFileSync(join(appDir, "project.json"), JSON.stringify({ id: "alpha-project.app", owner: "app-ops" }), "utf-8");
    const h = createHarness(
      {
        status: () => [],
        resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
          resumed.push({ sessionId, message, source: opts?.source });
          return sessionId;
        },
      } as Partial<SubagentManager>,
      projectRoot,
    );

    h.bus.emit({
      type: "human.input.received",
      source: "telegram",
      owner: "agent:may",
      data: {
        actor: "human",
        text: "approve",
        conversation: { id: "approval:approval-123", channel: "telegram", channelMessageId: 1201 },
        target: {
          sessionId: "s_original_request",
          projectPath: "projects/alpha-project.app",
        },
        context: {
          telegramReply: {
            conversationId: "approval:approval-123",
            projectId: "projects/alpha-project.app",
            originalIssue: {
              eventType: "project.approval.requested",
              approvalKind: "approval-packet-dispatch",
              approvalId: "approval-123",
              waitId: "wait-123",
              pathId: "path.network.example",
              packetPath: "evidence/archive/example-approval.md",
              requestedAction: "Approve one bounded replay",
              reason: "Need exact owner decision",
              expectedResponse: {
                type: "project.approval.submitted",
                target: { project: "alpha-project" },
              },
            },
            expectedClosure: ["project.approval.submitted"],
          },
        },
      },
    } as any);

    expect(resumed).toEqual([]);
    expect(h.emitted.some((event) => event.type === "session.steer.requested")).toBe(false);
    expect(h.emitted.some((event) => event.type === "project.comment.created")).toBe(false);
    expect(h.emitted.some((event) => event.type === "chat.start.requested")).toBe(false);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "project.approval.submitted",
        source: "telegram",
        owner: "agent:app-ops",
        target: { project: "alpha-project" },
        data: expect.objectContaining({
          approvalKind: "approval-packet-dispatch",
          approvalId: "approval-123",
          waitId: "wait-123",
          pathId: "path.network.example",
          packetPath: "evidence/archive/example-approval.md",
          projectPath: "projects/alpha-project.app",
          projectId: "projects/alpha-project.app",
          decision: "approve",
          message: "approve",
          conversationId: "approval:approval-123",
        }),
      }),
    );
    h.router.close();
  });

  it("routes an approval question to May without submitting a decision", () => {
    const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
    const runs: Array<{ agent: string; task: string; source?: string; requestId?: string }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
        resumed.push({ sessionId, message, source: opts?.source });
        return sessionId;
      },
      run: (agent: string, task: string, opts?: { source?: string; requestId?: string }) => {
        runs.push({ agent, task, source: opts?.source, requestId: opts?.requestId });
        return "s_may_reply";
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "human.input.received",
      source: "telegram",
      owner: "agent:may",
      data: {
        inputId: "telegram:1202",
        actor: "human",
        text: "What's it about? What's your suggestion?",
        conversation: { id: "approval:approval-123", channel: "telegram", channelMessageId: 1202 },
        target: {
          sessionId: "s_original_request",
          projectPath: "projects/alpha-project.app",
        },
        context: {
          telegramReply: {
            conversationId: "approval:approval-123",
            projectId: "projects/alpha-project.app",
            originalIssue: {
              eventType: "project.approval.requested",
              approvalKind: "approval-packet-dispatch",
              approvalId: "approval-123",
              waitId: "wait-123",
              pathId: "path.network.example",
              packetPath: "evidence/archive/example-approval.md",
              requestedAction: "Approve one bounded cleanup",
              reason: "Five stale generated files remain after the real change was committed.",
            },
            expectedClosure: ["project.approval.submitted"],
          },
        },
      },
    } as any);

    expect(resumed).toEqual([]);
    expect(h.emitted.some((event) => event.type === "project.approval.submitted")).toBe(false);
    expect(h.emitted.some((event) => event.type === "session.steer.requested")).toBe(false);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "chat.start.requested",
        source: "telegram",
        owner: "agent:may",
        data: expect.objectContaining({
          agent: "may",
          requestId: "telegram:1202",
          message: expect.stringContaining("First understand the human's intention"),
        }),
      }),
    );
    expect(runs).toEqual([
      expect.objectContaining({
        agent: "may",
        source: "telegram",
        requestId: "telegram:1202",
        task: expect.stringContaining("What's it about? What's your suggestion?"),
      }),
    ]);
    h.router.close();
  });

  it("normalizes project-targeted human.input.received into project.comment.created", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "router-project-human-input-"));
    const projectPath = "projects/demo-human-input";
    const projectDir = join(projectRoot, projectPath);
    mkdirp(projectDir);
    writeFileSync(
      join(projectDir, "project.md"),
      ["---", "id: demo-human-input", "owner: tech-lead", "status: active", "---", "", "# Demo", ""].join("\n"),
      "utf-8",
    );
    const h = createHarness({}, projectRoot);

    h.bus.emit({
      type: "human.input.received",
      source: "telegram",
      owner: "agent:tech-lead",
      data: {
        actor: "hao",
        text: "please add the golang extraction task",
        conversation: { channel: "telegram" },
        target: { projectPath },
      },
    } as any);

    expect(readFileSync(join(projectDir, "discussion.md"), "utf-8")).toContain("please add the golang extraction task");
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "project.comment.created",
        source: "telegram",
        owner: "agent:tech-lead",
        data: { projectPath, comment: "please add the golang extraction task", author: "hao" },
      }),
    );
    h.router.close();
  });

  it("routes escalation human.input.received to May even when session and project targets are present", () => {
    const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
    const runs: Array<{ agent: string; task: string; source?: string; requestId?: string }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
        resumed.push({ sessionId, message, source: opts?.source });
        return sessionId;
      },
      run: (agent: string, task: string, opts?: { source?: string; requestId?: string }) => {
        runs.push({ agent, task, source: opts?.source, requestId: opts?.requestId });
        return "s_may_reply";
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "human.input.received",
      source: "telegram",
      owner: "agent:may",
      data: {
        inputId: "telegram:1201",
        actor: "human",
        text: "approve retry",
        conversation: { id: "escalation:esc_1", channel: "telegram", channelMessageId: 1201 },
        target: {
          sessionId: "s_escalation_source",
          projectPath: "projects/alpha-project.app",
        },
        context: {
          telegramReply: {
            conversationId: "escalation:esc_1",
            originalIssue: {
              eventType: "escalation.created",
              escalationId: "esc_1",
              sourceSessionId: "s_escalation_source",
              projectPath: "projects/alpha-project.app",
              reason: "Approval return path is not visibly closing.",
              requestedAction: "Approve retry or dismiss the escalation.",
            },
            expectedClosure: ["escalation.resolved", "escalation.dismissed"],
          },
        },
      },
    } as any);

    expect(resumed).toEqual([]);
    expect(h.emitted.some((event) => event.type === "project.comment.created")).toBe(false);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "chat.start.requested",
        source: "telegram",
        owner: "agent:may",
        data: expect.objectContaining({
          agent: "may",
          requestId: "telegram:1201",
          message: expect.stringContaining("May reply-handling work item"),
        }),
      }),
    );
    expect(runs).toEqual([
      expect.objectContaining({
        agent: "may",
        source: "telegram",
        requestId: "telegram:1201",
        task: expect.stringContaining("emit one structured result event"),
      }),
    ]);
    h.router.close();
  });

  it("ignores input and steer commands that do not use the canonical message field", () => {
    const handled: Array<{ message: string; source?: string }> = [];
    const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
        resumed.push({ sessionId, message, source: opts?.source });
        return sessionId;
      },
    } as Partial<SubagentManager>);
    h.setChatSession({
      handleInput: (message: string, source?: string) => handled.push({ message, source }),
    } as unknown as ChatSession);

    h.bus.emit({ type: "input", text: "legacy input", source: "test" } as any);
    h.bus.emit({ type: "steer", sessionId: "s_cold", text: "legacy steer", source: "test" } as any);

    expect(handled).toEqual([]);
    expect(resumed).toEqual([]);
    h.router.close();
  });

  it("does not translate legacy message commands into message.created events", () => {
    const h = createHarness();

    h.bus.emit({ type: "message", from: "may", to: "dev", task: "hello", priority: "P2" } as any);

    expect(h.emitted.some((event) => event.type === "message.created")).toBe(false);
    h.router.close();
  });

  it("applies project.comment.created and nudges the project", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "router-project-"));
    const projectPath = "projects/demo";
    const projectDir = join(projectRoot, projectPath);
    mkdirp(projectDir);
    writeFileSync(
      join(projectDir, "project.md"),
      ["---", "id: demo", "owner: tech-lead", "status: active", "---", "", "# Demo", ""].join("\n"),
      "utf-8",
    );
    const h = createHarness({}, projectRoot);

    h.bus.emit({
      type: "project.comment.created",
      source: "test",
      owner: "agent:tech-lead",
      data: { projectPath, comment: "please continue", author: "hao" },
    });

    expect(readFileSync(join(projectDir, "discussion.md"), "utf-8")).toContain("please continue");
    expect(readFileSync(join(projectDir, "project.md"), "utf-8")).toContain("status: active");
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "project.nudge",
        source: "test",
        owner: "agent:tech-lead",
        data: { projectPath, comment: true, commentText: "please continue" },
      }),
    );
    h.router.close();
  });

  it("routes a project ownership gap to the platform owner instead of May", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "router-owner-gap-"));
    const projectPath = "projects/orphan";
    mkdirp(join(projectRoot, projectPath));
    mkdirp(join(projectRoot, "projects/may-agent.app"));
    writeFileSync(
      join(projectRoot, projectPath, "project.md"),
      ["---", "id: orphan", "status: active", "---", "", "# Orphan", ""].join("\n"),
      "utf-8",
    );
    writeFileSync(
      join(projectRoot, "projects/may-agent.app/project.json"),
      JSON.stringify({ id: "may-agent.app", owner: "tech-lead" }),
      "utf-8",
    );
    const h = createHarness({}, projectRoot);

    h.bus.emit({
      type: "project.comment.created",
      source: "test",
      owner: "agent:may",
      data: { projectPath, comment: "find the accountable owner", author: "hao" },
    });

    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "project.nudge",
        owner: "agent:tech-lead",
      }),
    );
    h.router.close();
  });

  it("flips YAML frontmatter status -> active on comment", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "router-project-yaml-"));
    const projectPath = "projects/demo-yaml";
    const projectDir = join(projectRoot, projectPath);
    mkdirp(projectDir);
    writeFileSync(
      join(projectDir, "project.md"),
      ["---", "id: demo-yaml", "owner: tech-lead", "status: waiting", "---", "", "# Demo", ""].join("\n"),
      "utf-8",
    );
    const h = createHarness({}, projectRoot);

    h.bus.emit({
      type: "project.comment.created",
      source: "test",
      owner: "agent:tech-lead",
      data: { projectPath, comment: "wake up", author: "hao" },
    });

    const projContent = readFileSync(join(projectDir, "project.md"), "utf-8");
    expect(projContent).toContain("status: active");
    expect(projContent).not.toContain("status: waiting");
    expect(readFileSync(join(projectDir, "discussion.md"), "utf-8")).toContain("wake up");
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "project.nudge",
        source: "test",
        owner: "agent:tech-lead",
        data: { projectPath, comment: true, commentText: "wake up" },
      }),
    );
    h.router.close();
  });

  it("handles session.cancel.requested", () => {
    const cancelled: string[] = [];
    const h = createHarness({
      cancel: (sessionId: string) => {
        cancelled.push(sessionId);
      },
    } as Partial<SubagentManager>);

    h.bus.emit({ type: "session.cancel.requested", sessionId: "s_1", source: "web-ui" });

    expect(cancelled).toEqual(["s_1"]);
    h.router.close();
  });

  it("handles canonical session.cancel.requested and session.cancel_all.requested", () => {
    const cancelled: string[] = [];
    const h = createHarness({
      status: () => [
        { sessionId: "s_1", agent: "dev", status: "running", task: "", runtime: "codex" },
        { sessionId: "s_2", agent: "dev", status: "idle", task: "", runtime: "codex" },
      ],
      cancel: (sessionId: string) => {
        cancelled.push(sessionId);
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "session.cancel.requested",
      source: "web-ui",
      owner: "agent:may",
      urgency: "high",
      data: { sessionId: "s_0" },
    });
    h.bus.emit({
      type: "session.cancel_all.requested",
      source: "web-ui",
      owner: "agent:may",
      urgency: "high",
      data: { reason: "test" },
    });

    expect(cancelled).toEqual(["s_0", "s_1"]);
    h.router.close();
  });
});

function mkdirp(path: string): void {
  mkdirSync(path, { recursive: true });
}
