import { expect, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { once } from "node:events";
import { fixtureGit, fixtureRead, fixtureReload, fixtureWrite } from "./conversation-adoption-tools.js";
import { requireDecidedTurn } from "./conversation-adoption.js";
import { pollUntil } from "../../test/e2e/lib/live-daemon.js";

test("only decided turns can continue the experiment; truthful domain failure is still a decision", () => {
  for (const disposition of ["fulfilled", "unfulfilled"]) {
    expect(() =>
      requireDecidedTurn({
        status: "done",
        handling: JSON.stringify({ phase: "decided", decision: { requestUpdates: [{ disposition }] } }),
      }),
    ).not.toThrow();
  }
  for (const handling of [
    undefined,
    "null",
    "not JSON",
    ...["failed", "stopped", "executing"].map((phase) => JSON.stringify({ phase })),
  ]) {
    expect(() => requireDecidedTurn({ status: "done", handling })).toThrow();
  }
  expect(() => requireDecidedTurn({ status: "timeout" })).toThrow();
});

test("the portable daemon preflight activates source and cleans up even when interrupted", async () => {
  for (const interrupt of [false, true]) {
    let root: string | undefined;
    let stdout = "";
    const trial = promisify(execFile)("bun", [join(import.meta.dir, "conversation-adoption.ts")], {
      // Linux CI: give this test an exact group containing both harness and daemon.
      detached: true,
      // Outer bound covers startup (30s), up to 20 Git commands (10s each),
      // two reload observations (35s each including admission), and shutdown.
      timeout: 330_000,
    });
    // Capture the root even when execFile rejects on timeout/non-zero exit.
    trial.child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      root ??= stdout.match(/(?:^|\n)Experiment artifacts: ([^\r\n]+)\r?\n/)?.[1];
      if (interrupt && root) trial.child.kill("SIGTERM");
    });
    try {
      if (interrupt) {
        // Kill only the harness after it has spawned the daemon, reproducing the
        // outer timeout's signal path without waiting for the full failure bound.
        await expect(trial).rejects.toMatchObject({ signal: "SIGTERM" });
      } else {
        const result = await trial;
        expect(result.stdout).toContain("Completed isolated trial");
        const setup = JSON.parse(readFileSync(join(root!, "setup.json"), "utf8"));
        expect(setup.live).toBe(false);
        expect(setup.fixtureCommit).toMatch(/^[0-9a-f]{40}$/);
        expect(setup.catalogSize).toBe(6);
        expect(setup.initialReload.state).toBe("succeeded");
        expect(setup.initialReload.requestId).toStartWith("fixture-reload:");
        expect(setup.sourcePreflight.activated).toBe(false);
        expect(setup.sourcePreflight.sourceCommit).toBe(setup.fixtureCommit);
        const failure = JSON.parse(readFileSync(join(root!, "preflight-failure.json"), "utf8"));
        expect(failure.state).toBe("failed");
        expect(failure.requestId).not.toBe(setup.initialReload.requestId);
        expect(failure.eventId).not.toBe(setup.initialReload.eventId);
      }
    } finally {
      try {
        if (trial.child.pid) process.kill(-trial.child.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      } finally {
        if (root?.startsWith(join(tmpdir(), "may-e2e-"))) rmSync(root, { recursive: true, force: true });
      }
    }
    expect(root?.startsWith(join(tmpdir(), "may-e2e-"))).toBe(true);
    expect(existsSync(root!)).toBe(false);
    // Orphaned zombies may await the OS reaper, but no executable process in
    // this test's group may survive. Do not depend on PID-reaping timing.
    await pollUntil(
      async () => {
        const { stdout: processes } = await promisify(execFile)("ps", ["-eo", "pgid=,stat="], { timeout: 1_000 });
        return processes.split("\n").every((line) => {
          const [group, state] = line.trim().split(/\s+/);
          return Number(group) !== trial.child.pid || state?.startsWith("Z");
        });
      },
      { timeoutMs: 5_000, description: "preflight group stopped" },
    );
  }
}, 680_000);

test("fixture Git forwards cancellation to a waiting subprocess", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-teaching-git-"));
  const controller = new AbortController();
  // hash-object waits for stdin; abort must stop it before the 10-second Git bound.
  const timer = setTimeout(() => controller.abort(), 50);
  try {
    await expect(fixtureGit(root, ["hash-object", "--stdin"], controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  } finally {
    clearTimeout(timer);
    rmSync(root, { recursive: true, force: true });
  }
}, 5_000);

test("fixture reload aborts inside its polling delay without making another observation", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-reload-abort-"));
  const controller = new AbortController();
  let observations = 0;
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\n")) return;
      const command = JSON.parse(buffer.trim());
      const reply =
        command.type === "publish"
          ? { eventId: 1, eventType: "runtime.reload.requested", delivery: "accepted" }
          : { event: { links: ++observations === 1 ? [] : [{ kind: "operation", state: "succeeded" }] } };
      socket.end(JSON.stringify({ type: "ok", command: command.type, ...reply }) + "\n");
    });
  });
  // Only the abortable delay subscribes to this signal. Abort just after it
  // registers, instead of guessing a sleep duration or mocking shared modules.
  const subscribe = controller.signal.addEventListener.bind(controller.signal);
  const listener = spyOn(controller.signal, "addEventListener").mockImplementation((...args) => {
    subscribe(...args);
    if (args[0] === "abort") queueMicrotask(() => controller.abort());
  });
  try {
    mkdirSync(join(root, "instances/adoption"), { recursive: true });
    server.listen(join(root, "instances/adoption/may.sock"));
    await once(server, "listening");
    await expect(fixtureReload(root, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(listener).toHaveBeenCalled();
    expect(observations).toBe(1);
  } finally {
    controller.abort();
    listener.mockRestore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
}, 5_000);

test("the teaching trial tools confine writes to guidance, and reads to synthetic evidence/source", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-teaching-scope-"));
  const outside = mkdtempSync(join(tmpdir(), "may-teaching-outside-"));
  try {
    mkdirSync(join(root, "agents/may"), { recursive: true });
    mkdirSync(join(root, "evidence"), { recursive: true });
    writeFileSync(join(outside, "private.md"), "not available");
    const read = fixtureRead({ projectRoot: root });
    const write = fixtureWrite({ projectRoot: root });
    await write.execute("write", { path: "agents/may/AGENTS.md", content: "A sample-project preference.\n" });
    expect(readFileSync(join(root, "agents/may/AGENTS.md"), "utf8")).toBe("A sample-project preference.\n");
    await write.execute("skill", { path: "agents/may/skills/review-change/SKILL.md", content: "Scoped method.\n" });
    const observed = await read.execute("read", { path: "agents/may/skills/review-change/SKILL.md" });
    expect(observed.content).toEqual([{ type: "text", text: "Scoped method.\n" }]);
    for (const path of ["agents/may/agent.json", "agents/may/tools/unsafe.ts", ".state/active.md", "../private.md"]) {
      await expect(write.execute("deny", { path, content: "must not write" })).rejects.toThrow("scope");
    }
    symlinkSync(outside, join(root, "agents/may/skills/escape"));
    await expect(
      write.execute("deny-link", { path: "agents/may/skills/escape/SKILL.md", content: "must not write" }),
    ).rejects.toThrow("scope");
    symlinkSync(join(outside, "private.md"), join(root, "evidence/linked.md"));
    await expect(read.execute("deny-read", { path: "evidence/linked.md" })).rejects.toThrow("scope");
    expect(readFileSync(join(outside, "private.md"), "utf8")).toBe("not available");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
