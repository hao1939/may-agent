import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseAppArgs } from "../src/app/app-args.js";

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

  it("throws a clear error when task-file is missing", () => {
    expect(() => parseAppArgs(["may-agent", "--task-file", "/tmp/no-such-task-file"], {}))
      .toThrow("Task file not found: /tmp/no-such-task-file");
  });
});
