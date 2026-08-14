import { describe, expect, it } from "bun:test";

import {
  buildEventIngressFrame,
  buildProjectAppAdmissionCommand,
  sendAppInputWithRetry,
  sendDaemonFrameWithRetry,
  sendProjectActionWithRetry,
} from "./server.js";

describe("HTTP event ingress acknowledgement recovery", () => {
  it("persists top-level event contract fields inside canonical data", () => {
    expect(
      buildEventIngressFrame(
        {
          type: "project.approval.submitted",
          approvalId: "approval-52",
          taskId: "improve/may",
          taskGeneration: 52,
          artifactFingerprint: "sha256:artifact",
          decision: "approve",
          data: { projectId: "gym", projectPath: "/app/projects/gym.app/project.json" },
        },
        "gym",
      ),
    ).toEqual({
      type: "project.approval.submitted",
      source: "web-ui",
      owner: "agent:gym",
      data: {
        projectId: "gym",
        projectPath: "/app/projects/gym.app/project.json",
        approvalId: "approval-52",
        taskId: "improve/may",
        taskGeneration: 52,
        artifactFingerprint: "sha256:artifact",
        decision: "approve",
      },
    });
  });

  it("retries an unknown timeout with the same idempotency key", async () => {
    const frames: Record<string, unknown>[] = [];
    const timeouts: number[] = [];
    const send = async (_socketPath: unknown, frame: Record<string, unknown>, options?: { timeoutMs?: number }) => {
      frames.push(structuredClone(frame));
      timeouts.push(Number(options?.timeoutMs));
      if (frames.length === 1) throw new Error("Socket timeout");
      return { type: "ok" as const, eventId: 42 };
    };

    const result = await sendDaemonFrameWithRetry(
      "/tmp/may.sock",
      { type: "gym.review.requested", data: { project: "gym" } },
      send,
    );

    expect(result).toEqual({ ok: true, eventId: 42 });
    expect(timeouts).toEqual([2_000, 5_000]);
    expect((frames[0].data as Record<string, unknown>).idempotencyKey).toMatch(/^web-/);
    expect((frames[1].data as Record<string, unknown>).idempotencyKey).toBe(
      (frames[0].data as Record<string, unknown>).idempotencyKey,
    );
  });

  it("preserves a caller key and does not retry a definite delivery error", async () => {
    const frames: Record<string, unknown>[] = [];
    const send = async (_socketPath: unknown, frame: Record<string, unknown>) => {
      frames.push(structuredClone(frame));
      throw new Error("connect ENOENT");
    };

    const result = await sendDaemonFrameWithRetry(
      "/tmp/missing.sock",
      {
        type: "project.task.tick",
        data: { project: "gym", idempotencyKey: "existing-key" },
      },
      send,
    );

    expect(result).toEqual({
      ok: false,
      error: "daemon socket delivery failed at /tmp/missing.sock: connect ENOENT",
    });
    expect(frames).toHaveLength(1);
    expect((frames[0].data as Record<string, unknown>).idempotencyKey).toBe("existing-key");
  });

  it("returns the durable event when both transport acknowledgements time out", async () => {
    const keys: string[] = [];
    const send = async () => {
      throw new Error("Socket timeout");
    };

    const result = await sendDaemonFrameWithRetry(
      "/tmp/may.sock",
      { type: "aks.finite-holder-migration.requested", data: { project: "aks-rp-e2e" } },
      send,
      (idempotencyKey) => {
        keys.push(idempotencyKey);
        return 4936896;
      },
    );

    expect(result).toEqual({ ok: true, eventId: 4936896 });
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^web-/);
  });
});

describe("HTTP project comment App ingress", () => {
  const command = buildProjectAppAdmissionCommand({
    projectPath: "projects/aks-rp-e2e.app",
    projectId: "aks-rp-e2e",
    comment: "Review the current normalization gap.",
    idempotencyKey: "project-comment-17",
  });

  it("addresses Web UI project comments through explicit App admission", () => {
    expect(command).toEqual({
      type: "app.input.admit",
      appId: "aks-rp-e2e",
      input: {
        kind: "message",
        data: {
          message: "Review the current normalization gap.",
          context: {
            intent: "project-comment",
            projectId: "aks-rp-e2e",
            projectPath: "projects/aks-rp-e2e.app",
          },
        },
      },
      source: { kind: "human", id: "web-ui:project-comment-17" },
      conversationId: "web-ui:project:aks-rp-e2e",
      channel: "web-ui",
      idempotencyKey: "project-comment-17",
    });
  });

  it("retries an unknown admission outcome with the same App input identity", async () => {
    const calls: Array<{ command: Record<string, unknown>; timeoutMs?: number }> = [];
    const response = await sendAppInputWithRetry("/tmp/may.sock", command, async (_endpoint, sent, options) => {
      calls.push({ command: structuredClone(sent), timeoutMs: options?.timeoutMs });
      if (calls.length === 1) throw new Error("Socket timeout");
      return { type: "ok", command: "app.input.admit", eventId: 101, eventType: "app.input.requested" };
    });

    expect(response).toMatchObject({ eventId: 101, eventType: "app.input.requested" });
    expect(calls.map((call) => call.timeoutMs)).toEqual([2_000, 10_000]);
    expect(calls[0]?.command).toEqual(calls[1]?.command);
    expect(calls[1]?.command.idempotencyKey).toBe("project-comment-17");
  });

  it("does not retry a definitive App schema rejection", async () => {
    let calls = 0;
    await expect(
      sendAppInputWithRetry("/tmp/may.sock", command, async () => {
        calls += 1;
        const error = new Error("App evaluation-canary does not accept this input") as Error & { kind: string };
        error.kind = "definitive";
        throw error;
      }),
    ).rejects.toThrow("does not accept this input");
    expect(calls).toBe(1);
  });

  it("recovers a durable App-input receipt after both acknowledgements are lost", async () => {
    const keys: string[] = [];
    const response = await sendAppInputWithRetry(
      "/tmp/may.sock",
      command,
      async () => {
        throw Object.assign(new Error("Socket closed; outcome unknown"), { kind: "post-send-unknown" });
      },
      (idempotencyKey) => {
        keys.push(idempotencyKey);
        return { eventId: 102, eventType: "app.input.requested" };
      },
    );

    expect(keys).toEqual(["project-comment-17"]);
    expect(response).toMatchObject({
      type: "ok",
      command: "app.input.admit",
      eventId: 102,
      eventType: "app.input.requested",
    });
  });
});

describe("HTTP project action acknowledgement recovery", () => {
  const command = {
    type: "project.action.invoke" as const,
    projectId: "evaluation",
    actionId: "app-inbox-canary",
    params: { prompt: "probe" },
    idempotencyKey: "canary-1",
  };

  it("retries an unknown outcome with the same command identity", async () => {
    const calls: Array<{ command: Record<string, unknown>; timeoutMs?: number }> = [];
    const send = async (_endpoint: unknown, sent: Record<string, unknown>, options?: { timeoutMs?: number }) => {
      calls.push({ command: structuredClone(sent), timeoutMs: options?.timeoutMs });
      if (calls.length === 1) throw new Error("Socket timeout");
      return {
        type: "ok" as const,
        command: "project.action.invoke",
        eventId: 73,
        eventType: "app.input.requested",
      };
    };

    const result = await sendProjectActionWithRetry("/tmp/may.sock", command, send);

    expect(result).toMatchObject({ eventId: 73, eventType: "app.input.requested" });
    expect(calls.map((call) => call.timeoutMs)).toEqual([2_000, 10_000]);
    expect(calls[0].command).toEqual(calls[1].command);
    expect(calls[1].command.idempotencyKey).toBe("canary-1");
  });

  it("recovers a durable event after both acknowledgements time out", async () => {
    const keys: string[] = [];
    const result = await sendProjectActionWithRetry(
      "/tmp/may.sock",
      command,
      async () => {
        throw new Error("Socket timeout");
      },
      (key) => {
        keys.push(key);
        return { eventId: 81, eventType: "app.input.requested" };
      },
    );

    expect(result).toMatchObject({ eventId: 81, eventType: "app.input.requested" });
    expect(keys).toEqual(["canary-1"]);
  });

  it("does not retry a definitive command error", async () => {
    let calls = 0;
    await expect(
      sendProjectActionWithRetry("/tmp/may.sock", command, async () => {
        calls += 1;
        throw new Error("Invalid input for evaluation.app-inbox-canary");
      }),
    ).rejects.toThrow("Invalid input");
    expect(calls).toBe(1);
  });
});
