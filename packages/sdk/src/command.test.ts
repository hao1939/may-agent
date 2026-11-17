import { expect, test } from "bun:test";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { runCommand } from "./command.js";
import { type WorkflowContext } from "./index.js";
import { runTargetTest } from "./testing.js";

function alive(pid: number): boolean {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0] !== "Z";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function untilReady(path: string) {
  const deadline = Date.now() + 5_000;
  while (!existsSync(path) && Date.now() < deadline) await Bun.sleep(10);
  expect(existsSync(path)).toBe(true);
}

test.each(["cancel", "leader-exit", "nested-cancel", "caught-escape"] as const)(
  "command cleanup: %s joins owned descendants and preserves another command",
  async (mode) => {
    const root = mkdtempSync(join(tmpdir(), "sdk-command-cancellation-"));
    const ready = join(root, "ready.json");
    const childReady = join(root, "child-ready");
    const controller = new AbortController();
    const neighbor = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30_000)"], { detached: true });
    const neighborExit = new Promise((resolve) => neighbor.once("close", resolve));
    const childScript = `
      process.on('SIGTERM', () => {});
      require('node:fs').writeFileSync(${JSON.stringify(childReady)}, 'ready');
      setTimeout(() => process.exit(72), 8000);
    `;
    const childArgv = [process.execPath, "-e", childScript];
    const script = `
      process.on('SIGTERM', () => {});
      const child = require('node:child_process').spawn(
        ${JSON.stringify(mode === "caught-escape" ? "/usr/bin/setsid" : process.execPath)},
        ${JSON.stringify(mode === "caught-escape" ? ["--", ...childArgv] : childArgv.slice(1))},
        { stdio: ['ignore', 'inherit', 'inherit'] });
      require('node:fs').writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ parent: process.pid, child: child.pid }));
      console.log('retained verification output');
      ${mode === "leader-exit" || mode === "caught-escape" ? "process.exit(0)" : "setTimeout(() => process.exit(72), 8000)"};
    `;
    let pids: { parent: number; child: number } | undefined;
    const killFixtures = () => {
      if (!pids && existsSync(ready)) pids = JSON.parse(readFileSync(ready, "utf8"));
      for (const pid of [pids?.child, pids?.parent]) {
        if (pid) try { process.kill(pid, "SIGKILL"); } catch { /* Already stopped. */ }
      }
    };
    let watchdogFired = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let execution: Promise<unknown> | undefined;
    let command: ReturnType<typeof runCommand> | undefined;
    try {
      let executeCommand = runCommand;
      if (mode === "nested-cancel" || mode === "caught-escape") {
        // Model the deployed boundary: compiled Host and separately loaded SDK
        // must share ownership even with distinct instances of this module.
        const bundle = join(root, "command.js");
        await promisify(execFile)(process.execPath, ["build", join(import.meta.dir, "command.ts"), "--target=bun", "--outfile", bundle], { timeout: 10_000, killSignal: "SIGKILL" });
        executeCommand = (await import(pathToFileURL(bundle).href)).runCommand;
      }
      const argv = [process.execPath, "-e", script];
      if (mode === "nested-cancel" || mode === "caught-escape") {
        const child = {
          name: "command-child",
          description: "Owns a command through the workflow cancellation signal",
          async execute(ctx: WorkflowContext) {
            command = executeCommand(root, argv, ctx.signal);
            // Deliberately detached from the authored promise in the cancel
            // case: the kernel still owns its cleanup through ctx.signal.
            if (mode === "caught-escape") await command.catch(() => undefined);
            else {
              void command.catch(() => undefined);
              await new Promise<void>((resolve) => ctx.signal.addEventListener("abort", () => resolve(), { once: true }));
            }
            return ctx.done("child body returned");
          },
        };
        execution = runTargetTest({
          name: "command-parent",
          description: "Propagates cancellation and cleanup through a nested workflow",
          async execute(ctx: WorkflowContext) {
            await ctx.call("command-child", {});
            return ctx.done("parent body returned");
          },
        }, { input: {}, signal: controller.signal, timeoutMs: 15_000, mocks: { "command-child": child } });
      } else {
        command = runCommand(root, argv, controller.signal);
        execution = command;
      }
      await untilReady(ready);
      pids = JSON.parse(readFileSync(ready, "utf8"));
      watchdog = setTimeout(() => { watchdogFired = true; killFixtures(); }, 6_000);
      if (mode === "cancel" || mode === "nested-cancel") {
        await untilReady(childReady);
        controller.abort(new Error("Workflow timed out"));
      }
      const outcome = await execution;
      expect(watchdogFired).toBe(false);
      expect(alive(pids!.parent)).toBe(false);
      expect(alive(neighbor.pid!)).toBe(true);
      if (mode === "caught-escape") {
        const run = outcome as Awaited<ReturnType<typeof runTargetTest>>;
        expect(run.ok).toBe(false);
        expect(run.report.cleanup.confirmed).toBe(false);
        expect(String(run.error)).toContain("Command output closure is unconfirmed");
        expect(alive(pids!.child)).toBe(true);
      } else {
        expect(alive(pids!.child)).toBe(false);
        const receipt = await command!;
        expect(receipt.stdout).toContain("retained verification output");
        if (mode === "cancel" || mode === "nested-cancel") {
          expect(receipt.exitCode).toBeNull();
          expect(receipt.error).toBeDefined();
        } else {
          expect(receipt.exitCode).toBe(0);
          expect(receipt.error).toBeUndefined();
        }
        if (mode === "nested-cancel") {
          const run = outcome as Awaited<ReturnType<typeof runTargetTest>>;
          expect(run.ok).toBe(false);
          expect(run.report.cleanup).toEqual({ confirmed: true });
        }
      }
    } finally {
      clearTimeout(watchdog);
      killFixtures();
      if (neighbor.pid) try { process.kill(neighbor.pid, "SIGKILL"); } catch { /* Already stopped. */ }
      controller.abort();
      await command?.catch(() => undefined);
      await execution?.catch(() => undefined);
      await neighborExit;
      rmSync(root, { recursive: true, force: true });
    }
  },
  12_000,
);

test("command receipts retain literal argv, nonzero status, and bounded output failures", async () => {
  const argv = [process.execPath, "-e", "console.log(process.argv[1]); console.error('diagnostic'); process.exit(7)", "$(not-a-shell-command)"];
  const receipt = await runCommand(tmpdir(), argv, new AbortController().signal);
  expect(receipt.argv).toEqual(argv);
  expect(receipt.exitCode).toBe(7);
  expect(receipt.stdout.trim()).toBe("$(not-a-shell-command)");
  expect(receipt.stderr.trim()).toBe("diagnostic");
  expect(receipt.error).toBeDefined();
  const overflow = await runCommand(tmpdir(), [process.execPath, "-e", "process.stdout.write('x'.repeat(3 * 1024 * 1024)); setInterval(() => {}, 1000)"], new AbortController().signal);
  expect(overflow.error).toBeDefined();
  expect(overflow.stdout.length).toBeLessThanOrEqual(2 * 1024 * 1024);
});
