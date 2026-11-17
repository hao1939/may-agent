import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test.each(["cancel", "leader-exit", "nested-cancel"] as const)(
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
    const script = `
      process.on('SIGTERM', () => {});
      const child = require('node:child_process').spawn(
        ${JSON.stringify(process.execPath)},
        ["-e", ${JSON.stringify(childScript)}],
        { stdio: ['ignore', 'inherit', 'inherit'] });
      require('node:fs').writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ parent: process.pid, child: child.pid }));
      console.log('retained verification output');
      ${mode === "leader-exit" ? "process.exit(0)" : "setTimeout(() => process.exit(72), 8000)"};
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
      const argv = [process.execPath, "-e", script];
      if (mode === "nested-cancel") {
        const child = {
          name: "command-child",
          description: "Owns a command through the workflow cancellation signal",
          async execute(ctx: WorkflowContext) {
            command = runCommand(root, argv, ctx.signal);
            await command;
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

test("command receipts retain literal argv and nonzero status", async () => {
  const argv = [process.execPath, "-e", "console.log(process.argv[1]); console.error('diagnostic'); process.exit(7)", "$(not-a-shell-command)"];
  const receipt = await runCommand(tmpdir(), argv, new AbortController().signal);
  expect(receipt.argv).toEqual(argv);
  expect(receipt.exitCode).toBe(7);
  expect(receipt.stdout.trim()).toBe("$(not-a-shell-command)");
  expect(receipt.stderr.trim()).toBe("diagnostic");
  expect(receipt.error).toBeDefined();
});

test("overflow stops a TERM-ignoring writer without external cancellation", async () => {
  const root = mkdtempSync(join(tmpdir(), "sdk-command-overflow-"));
  const guarded = join(root, "guarded");
  const controller = new AbortController();
  const script = `
    process.on('SIGTERM', () => {});
    process.stdout.on('error', () => {});
    setTimeout(() => {
      require('node:fs').writeFileSync(${JSON.stringify(guarded)}, 'guarded');
      process.exit(72);
    }, 2000);
    process.stdout.write('x'.repeat(3 * 1024 * 1024));
  `;
  const execution = runCommand(root, [process.execPath, "-e", script], controller.signal);
  try {
    const receipt = await execution;
    expect(existsSync(guarded)).toBe(false);
    expect(controller.signal.aborted).toBe(false);
    expect(receipt.error).toContain("maxBuffer");
    expect(receipt.stdout.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  } finally {
    controller.abort();
    await execution.catch(() => undefined);
    rmSync(root, { recursive: true, force: true });
  }
});

test("receipt argv describes the launched command despite caller mutation", async () => {
  const argv = [process.execPath, "-e", "console.log(process.argv[1])", "original"];
  const expected = [...argv];
  const execution = runCommand(tmpdir(), argv, new AbortController().signal);
  argv[3] = "mutated";
  argv.push("never launched");
  const receipt = await execution;
  expect(receipt.exitCode).toBe(0);
  expect(receipt.stdout.trim()).toBe("original");
  expect(receipt.argv).toEqual(expected);
});

test("commands reading stdin receive EOF without cancellation", async () => {
  const controller = new AbortController();
  const guard = setTimeout(() => controller.abort(new Error("EOF guard elapsed")), 2_000);
  const execution = runCommand(tmpdir(), [process.execPath, "-e", `
    process.stdin.on('end', () => console.log('stdin EOF'));
    process.stdin.resume();
  `], controller.signal);
  try {
    const receipt = await execution;
    expect(controller.signal.aborted).toBe(false);
    expect(receipt.exitCode).toBe(0);
    expect(receipt.error).toBeUndefined();
    expect(receipt.stdout.trim()).toBe("stdin EOF");
  } finally {
    clearTimeout(guard);
    controller.abort();
    await execution.catch(() => undefined);
  }
});
