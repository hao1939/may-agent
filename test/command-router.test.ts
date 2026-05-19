import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attachCommandRouter } from "../src/app/command-router.js";
import { EventBus, type AgentEvent } from "../src/app/event-bus.js";
import type { ChatSession } from "../src/app/chat-session.js";
import type { SubagentManager } from "../src/lib/index.js";

function createHarness(overrides: Partial<SubagentManager> = {}, projectRoot = mkdtempSync(join(tmpdir(), "router-"))) {
  const bus = new EventBus();
  const emitted: AgentEvent[] = [];
  bus.subscribe((event) => emitted.push(event));

  const manager = {
    status: () => [],
    cancel: () => {},
    input: () => Promise.resolve({} as any),
    steer: () => {},
    resumeSession: () => "resumed",
    resumeInterrupted: () => false,
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
  it("handles built-in status when no chat session is active", () => {
    const h = createHarness();

    h.router.handleInput("status", "test");

    expect(h.emitted).toContainEqual({ type: "info", message: "[status] No active sessions" });
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
    const resumed: Array<{ sessionId: string; message: string; source?: string }> = [];
    const h = createHarness({
      status: () => [],
      resumeSession: (sessionId: string, message: string, opts?: { source?: string }) => {
        resumed.push({ sessionId, message, source: opts?.source });
        return sessionId;
      },
    } as Partial<SubagentManager>);

    h.bus.emit({ type: "steer", sessionId: "s_cold", message: "follow up", source: "telegram" });

    expect(resumed).toEqual([{ sessionId: "s_cold", message: "follow up", source: "telegram" }]);
    h.router.close();
  });

  it("applies project.comment.created and nudges the project", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "router-project-"));
    const projectPath = "projects/demo";
    const projectDir = join(projectRoot, projectPath);
    mkdirp(projectDir);
    writeFileSync(
      join(projectDir, "project.md"),
      [
        "---",
        "id: demo",
        "owner: tech-lead",
        "status: active",
        "---",
        "",
        "# Demo",
        "",
      ].join("\n"),
      "utf-8",
    );
    const h = createHarness({}, projectRoot);

    h.bus.emit({
      type: "project.comment.created",
      source: "test",
      owner: "agent:tech-lead",
      data: { projectPath, comment: "please continue", author: "hao" },
    } as any);

    expect(readFileSync(join(projectDir, "discussion.md"), "utf-8")).toContain("please continue");
    expect(readFileSync(join(projectDir, "project.md"), "utf-8")).toContain("status: active");
    expect(h.emitted).toContainEqual(expect.objectContaining({
      type: "project.nudge",
      source: "test",
      owner: "agent:tech-lead",
      data: { projectPath, comment: true, commentText: "please continue" },
    }));
    h.router.close();
  });

  it("flips YAML frontmatter status -> active on comment", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "router-project-yaml-"));
    const projectPath = "projects/demo-yaml";
    const projectDir = join(projectRoot, projectPath);
    mkdirp(projectDir);
    writeFileSync(
      join(projectDir, "project.md"),
      [
        "---",
        "id: demo-yaml",
        "owner: tech-lead",
        "status: waiting",
        "---",
        "",
        "# Demo",
        "",
      ].join("\n"),
      "utf-8",
    );
    const h = createHarness({}, projectRoot);

    h.bus.emit({ type: "project.comment.created", projectPath, comment: "wake up", source: "test", author: "hao" });

    const projContent = readFileSync(join(projectDir, "project.md"), "utf-8");
    expect(projContent).toContain("status: active");
    expect(projContent).not.toContain("status: waiting");
    expect(readFileSync(join(projectDir, "discussion.md"), "utf-8")).toContain("wake up");
    expect(h.emitted).toContainEqual(expect.objectContaining({
      type: "project.nudge",
      source: "test",
      owner: "agent:tech-lead",
      data: { projectPath, comment: true, commentText: "wake up" },
    }));
    h.router.close();
  });

  it("handles session.cancel.requested", () => {
    const cancelled: string[] = [];
    const h = createHarness({ cancel: (sessionId: string) => { cancelled.push(sessionId); } } as Partial<SubagentManager>);

    h.bus.emit({ type: "session.cancel.requested", sessionId: "s_1", source: "web-ui" });

    expect(cancelled).toEqual(["s_1"]);
    h.router.close();
  });
});

function mkdirp(path: string): void {
  mkdirSync(path, { recursive: true });
}
