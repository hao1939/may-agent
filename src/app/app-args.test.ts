import { describe, expect, it } from "bun:test";
import { parseAppArgs } from "./app-args.js";

describe("app args", () => {
  it.each([["--agent", "selected"], ["--agent=selected"]])("captures the full binding with CLI precedence: %j", (...flags) => {
    const args = parseAppArgs(["may-agent", ...flags], {
      AGENT: "unused", DAEMON_AGENT: "legacy", CONVERSATION_APP: "support", CONVERSATION_ID: "retained-room",
    });
    expect(args.humanInterface).toEqual({ agent: "selected", appId: "support", conversationId: "retained-room" });
    expect(() => parseAppArgs(["may-agent", ...flags], { CONVERSATION_ID: "orphan" }))
      .toThrow("requires CONVERSATION_APP");
  });

  it.each([["--agent"], ["--agent", "--web"], ["--agent="], ["--agent", " "]])("rejects missing agent values: %j", (...flags) => {
    expect(() => parseAppArgs(["may-agent", ...flags], {})).toThrow("--agent requires an agent name");
  });

  it("uses DAEMON_AGENT as the interface agent when AGENT is unset", () => {
    const args = parseAppArgs(["may-agent", "--socket", "--web"], { DAEMON_AGENT: "aks-explorer" });

    expect(args.humanInterface.agent).toBe("aks-explorer");
  });

  it("parses the private one-attempt worker payload", () => {
    const payload = JSON.stringify({ appId: "sample", taskId: "work/one" });
    const args = parseAppArgs(["may-agent", "--task-worker-once", payload], {});

    expect(args.taskWorkerRequest).toBe(payload);
    expect(args.taskRecoveryWorker).toBe(false);
  });

  it("rejects a private worker invocation without its payload", () => {
    expect(() => parseAppArgs(["may-agent", "--task-worker-once"], {})).toThrow(
      "--task-worker-once requires one request payload",
    );
  });

  it("parses the private one-shot recovery worker", () => {
    expect(parseAppArgs(["may-agent", "--task-recovery-once"], {}).taskRecoveryWorker).toBe(true);
    const payload = JSON.stringify({ appDirectories: ["sample.app"] });
    expect(
      parseAppArgs(["may-agent", "--task-recovery-once", "--task-worker-source", payload], {}).taskWorkerSource,
    ).toBe(payload);
    expect(parseAppArgs(["may-agent", "--task-recovery-once", "--cron"], {}).taskWorkerSource).toBeUndefined();
    expect(() => parseAppArgs(["may-agent", "--task-worker-source"], {})).toThrow("requires one source payload");
  });

  it("parses the private persistent Task admission worker", () => {
    expect(parseAppArgs(["bun", "may.ts", "--task-admission-worker"], {}).taskAdmissionWorker).toBeTrue();
  });

  it.each([
    [["--web"], "Standalone --web has been retired"],
    [["--chat"], "--chat has been retired; run may-console"],
    [["--console", "--socket"], "--console has been retired; run may-console"],
    [["--chat=true", "--web"], "--chat has been retired; run may-console"],
    [["--console=true"], "--console has been retired; run may-console"],
    [["--run-workflow", "probe", "--dry-run", "--cron"], "--run-workflow has been retired"],
    [["--run-workflow=probe", "--cron"], "--run-workflow has been retired"],
    [["--socket", "--oneshot", "--task", "work"], "--oneshot has been retired"],
    [["--web", "--task", "work"], "--task has been retired"],
    [["--cron", "--task-file", "/tmp/work.txt"], "--task-file has been retired"],
    [["--socket", "--send", "may", "--message", "hi"], "--send has been retired"],
  ] as const)("rejects retired CLI flags before background startup: %j", (flags, expectedMessage) => {
    expect(() => parseAppArgs(["bun", "may", ...flags], {})).toThrow(expectedMessage);
  });
});
