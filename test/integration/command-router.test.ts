import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachCommandRouter } from "../../src/app/command-router.js";
import { EventBus, type AgentEvent } from "../../src/app/event-bus.js";
import type { SubagentManager } from "../../src/lib/index.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function harness(overrides: Partial<SubagentManager> = {}) {
  const projectRoot = mkdtempSync(join(tmpdir(), "router-integration-"));
  roots.push(projectRoot);
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
  const router = attachCommandRouter({
    bus,
    manager,
    clearCancelLatch: () => {},
    projectRoot,
    acceptsAppInput: (appId) => appId === "may",
    reload: () => ({ ok: true, summary: "[reload] No changes" }),
    restart: () => {},
    shutdown: () => {},
  });
  return { projectRoot, bus, emitted, router };
}

describe("command router integration", () => {
  it("normalizes human, console, and May fork ingress to the conversation App", () => {
    const h = harness();
    h.router.handleInput("from console", "console");
    h.bus.emit({ type: "fork", agent: "may", task: "from socket", opts: { source: "socket" } });

    const inputs = h.emitted.filter((event) => event.type === "app.input.requested");
    expect(inputs).toHaveLength(2);
    expect(inputs.map((event) => (event as any).data.input.data.message)).toEqual(["from console", "from socket"]);
    h.router.close();
  });

  it("resumes cold sessions only through an explicit steer event", () => {
    const resumed: unknown[] = [];
    const h = harness({
      resumeSession: (sessionId: string, message: string, options?: unknown) => {
        resumed.push({ sessionId, message, options });
        return sessionId;
      },
    } as Partial<SubagentManager>);

    h.bus.emit({ type: "steer", sessionId: "s_cold", message: "follow up", source: "telegram" });
    expect(resumed).toEqual([
      {
        sessionId: "s_cold",
        message: "follow up",
        options: expect.objectContaining({ source: "telegram", suppressBenignRaceEvent: true }),
      },
    ]);
    h.router.close();
  });

  it("runs a directly addressed non-App agent as a bounded chat", () => {
    const runs: unknown[] = [];
    const h = harness({
      run: (agent: string, task: string, options?: unknown) => {
        runs.push({ agent, task, options });
        return "s_dev";
      },
    } as Partial<SubagentManager>);

    h.bus.emit({
      type: "chat.start.requested",
      source: "cli",
      owner: "agent:dev",
      data: { agent: "dev", message: "investigate", channel: "cli", requestId: "r1" },
    });
    expect(runs).toEqual([
      {
        agent: "dev",
        task: "investigate",
        options: expect.objectContaining({ kind: "chat", autoClose: "never", source: "cli", requestId: "r1" }),
      },
    ]);
    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        owner: "agent:dev",
        data: expect.objectContaining({ to: "dev", content: "investigate" }),
      }),
    );
    h.router.close();
  });

  it("applies legacy project comments at the filesystem adapter", () => {
    const h = harness();
    const projectPath = "projects/demo";
    const projectDir = join(h.projectRoot, projectPath);
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "project.md"),
      ["---", "id: demo", "owner: tech-lead", "status: waiting", "---", "", "# Demo"].join("\n"),
    );

    h.bus.emit({
      type: "project.comment.created",
      source: "test",
      owner: "agent:tech-lead",
      data: { projectPath, comment: "please continue", author: "hao" },
    });
    expect(readFileSync(join(projectDir, "discussion.md"), "utf8")).toContain("please continue");
    expect(readFileSync(join(projectDir, "project.md"), "utf8")).toContain("status: active");
    h.router.close();
  });

  it("projects exact approval replies before App admission", () => {
    const h = harness();
    const appDir = join(h.projectRoot, "projects/aks-rp-e2e.app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "project.json"), JSON.stringify({ owner: "app-ops" }));

    h.bus.emit({
      type: "human.input.received",
      source: "telegram",
      owner: "agent:may",
      data: {
        text: "approve",
        target: { projectPath: "projects/aks-rp-e2e.app" },
        context: {
          telegramReply: {
            conversationId: "approval:123",
            originalIssue: {
              eventType: "project.approval.requested",
              approvalId: "approval-123",
              expectedResponse: { target: { project: "aks-rp-e2e" } },
            },
            expectedClosure: ["project.approval.submitted"],
          },
        },
      },
    } as any);

    expect(h.emitted).toContainEqual(
      expect.objectContaining({
        type: "project.approval.submitted",
        owner: "agent:app-ops",
        target: { project: "aks-rp-e2e" },
        data: expect.objectContaining({ approvalId: "approval-123", decision: "approve" }),
      }),
    );
    h.router.close();
  });
});
