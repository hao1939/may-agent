import { describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseAppArgs } from "../app-args.js";
import { runsBackgroundWork } from "./background-startup.js";

describe("background startup", () => {
  it.each(["resolve", "reject"])(
    "keeps startup available while Task recovery is pending (%s)",
    async (mode) => {
      const { fileURLToPath } = await import("node:url");
      const fixture = fileURLToPath(new URL("../../../test/fixtures/background-startup.ts", import.meta.url));
      const { stdout } = await promisify(execFile)(process.execPath, [fixture, mode], { timeout: 5_000 });
      expect(stdout).toContain("background-startup-contract-ok");
    },
    10_000,
  );

  it.each([
    [["--socket"], false, true],
    [["--telegram"], false, true],
    [["--console"], true, true],
    [["--console"], false, false],
    [["--cron"], false, true],
    [["--task", "fixture"], false, false],
    [["--web"], false, false],
    [["--socket", "--oneshot", "--cron"], false, false],
    [["--status", "--cron"], false, false],
    [["--task-recovery-once", "--cron"], false, false],
    [["--task-worker-once", "{}", "--cron"], false, false],
    [["--task-admission-worker", "--cron"], false, false],
    [["--run-workflow", "probe", "--cron"], false, false],
  ] as const)("selects background work from process role: %j", (flags, tty, expected) => {
    expect(runsBackgroundWork(parseAppArgs(["bun", "may", ...flags], {}), tty)).toBe(expected);
  });
});
