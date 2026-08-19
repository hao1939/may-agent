import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOwnedCommand } from "./owned-command";

function currentProcessGroup(): number {
  const stat = readFileSync(`/proc/${process.pid}/stat`, "utf8");
  return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
}

test("runs outside the daemon process group and removes its owner marker", async () => {
  const root = await mkdtemp(join(tmpdir(), "owned-command-group-"));
  const ownerFile = join(root, "owner.json");
  try {
    const result = await runOwnedCommand({
      command: "/bin/sh",
      args: ["-c", "ps -o pgid= -p $$"],
      cwd: root,
      ownerFile,
      timeoutMs: 5_000,
      maxOutputChars: 4_096,
    });
    expect(result.status).toBe(0);
    expect(Number(result.stdout.trim())).not.toBe(currentProcessGroup());
    expect(existsSync(ownerFile)).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("drains the previous exact owner before starting its replacement", async () => {
  const root = await mkdtemp(join(tmpdir(), "owned-command-replace-"));
  const ownerFile = join(root, "owner.json");
  const firstStarted = join(root, "first-started");
  const firstFinished = join(root, "first-finished");
  const secondFinished = join(root, "second-finished");
  const first = runOwnedCommand({
    command: "/bin/sh",
    args: ["-c", `touch ${firstStarted}; sleep 30; touch ${firstFinished}`],
    cwd: root,
    ownerFile,
    timeoutMs: 60_000,
    maxOutputChars: 4_096,
  });
  try {
    const deadline = Date.now() + 5_000;
    while (!existsSync(firstStarted) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(existsSync(firstStarted)).toBe(true);

    const second = await runOwnedCommand({
      command: "/bin/sh",
      args: ["-c", `touch ${secondFinished}`],
      cwd: root,
      ownerFile,
      timeoutMs: 5_000,
      maxOutputChars: 4_096,
    });
    const firstResult = await first;
    expect(second.status).toBe(0);
    expect(firstResult.status).not.toBe(0);
    expect(existsSync(firstFinished)).toBe(false);
    expect(existsSync(secondFinished)).toBe(true);
    expect(existsSync(ownerFile)).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("times out and drains the command's descendants", async () => {
  const root = await mkdtemp(join(tmpdir(), "owned-command-timeout-"));
  const ownerFile = join(root, "owner.json");
  try {
    const startedAt = Date.now();
    const result = await runOwnedCommand({
      command: "/bin/sh",
      args: ["-c", "sleep 30 & wait"],
      cwd: root,
      ownerFile,
      timeoutMs: 50,
      maxOutputChars: 4_096,
    });
    expect(result.timedOut).toBe(true);
    expect(result.status).not.toBe(0);
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(existsSync(ownerFile)).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
