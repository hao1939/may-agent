import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fixtureGit, fixtureRead, fixtureWrite } from "./conversation-adoption-tools.js";

test("the portable daemon preflight activates committed source without a model call", async () => {
  let root: string | undefined;
  try {
    const result = await promisify(execFile)("bun", [join(import.meta.dir, "conversation-adoption.ts")], {
      // Outer bound covers startup (30s), up to 20 Git commands (10s each),
      // two reload observations (35s each including admission), and shutdown.
      timeout: 330_000,
    });
    root = result.stdout.match(/Experiment artifacts: (.+)/)?.[1];
    expect(root?.startsWith(join(tmpdir(), "may-e2e-"))).toBe(true);
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
  } finally {
    if (root?.startsWith(join(tmpdir(), "may-e2e-"))) rmSync(root, { recursive: true, force: true });
  }
}, 340_000);

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
