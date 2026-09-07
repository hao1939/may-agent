import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseAppArgs } from "./app-args.js";

describe("app args", () => {
  it("parses agent selection and task-file content", () => {
    const root = mkdtempSync(join(tmpdir(), "app-args-"));
    try {
      const taskFile = join(root, "task.txt");
      writeFileSync(taskFile, "do the work\n");

      const args = parseAppArgs(["may-agent", "--agent", "scout", "--task-file", taskFile], {});

      expect(args.interfaceAgent).toBe("scout");
      expect(args.initialTask).toBe("do the work");
      expect(args.webOnlyMode).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses conventional env defaults and detects web-only mode", () => {
    const args = parseAppArgs(["may-agent", "--web"], { AGENT: "may" });

    expect(args.interfaceAgent).toBe("may");
    expect(args.webEnabled).toBe(true);
    expect(args.webOnlyMode).toBe(true);
  });

  it("treats --chat as a quiet console alias without creating a chat runtime mode", () => {
    const args = parseAppArgs(["may-agent", "--chat"], {});

    expect(args.consoleEnabled).toBe(true);
    expect(args.quietConsole).toBe(true);
    expect(args).not.toHaveProperty("chatMode");
  });

  it("does not classify web plus console as web-only", () => {
    const args = parseAppArgs(["may-agent", "--web", "--console"], {});

    expect(args.consoleEnabled).toBe(true);
    expect(args.webOnlyMode).toBe(false);
  });

  it("uses DAEMON_AGENT as the interface agent when AGENT is unset", () => {
    const args = parseAppArgs(["may-agent", "--web"], { DAEMON_AGENT: "aks-explorer" });

    expect(args.interfaceAgent).toBe("aks-explorer");
  });

  it("throws a clear error when task-file is missing", () => {
    expect(() => parseAppArgs(["may-agent", "--task-file", "/tmp/no-such-task-file"], {})).toThrow(
      "Task file not found: /tmp/no-such-task-file",
    );
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
  });

  it("parses the private persistent Task admission worker", () => {
    expect(parseAppArgs(["bun", "may.ts", "--task-admission-worker"], {}).taskAdmissionWorker).toBeTrue();
  });
});
