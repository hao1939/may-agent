import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitAsync } from "./spec-live-reconciliation.js";

test("remote Git fetch leaves the host event loop responsive", async () => {
  const root = mkdtempSync(join(tmpdir(), "spec-live-async-fetch-"));
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const checkout = join(root, "checkout");
  const delayedUploadPack = join(root, "delayed-git-upload-pack");
  const run = (cwd: string, args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

  try {
    mkdirSync(seed);
    run(root, ["init", "--bare", remote]);
    run(seed, ["init"]);
    run(seed, ["config", "user.email", "test@example.com"]);
    run(seed, ["config", "user.name", "Test"]);
    writeFileSync(join(seed, "README.md"), "base\n");
    run(seed, ["add", "README.md"]);
    run(seed, ["commit", "-m", "base"]);
    run(seed, ["branch", "-M", "dev"]);
    run(seed, ["remote", "add", "origin", remote]);
    run(seed, ["push", "origin", "dev"]);
    run(root, ["clone", remote, checkout]);

    writeFileSync(
      delayedUploadPack,
      '#!/bin/sh\nsleep 0.2\nexec git-upload-pack "$@"\n',
    );
    chmodSync(delayedUploadPack, 0o755);

    let settled = false;
    let readinessTurns = 0;
    const readinessTimer = setInterval(() => {
      readinessTurns += 1;
    }, 5);
    const fetch = gitAsync(
      checkout,
      ["fetch", `--upload-pack=${delayedUploadPack}`, "origin", "dev"],
      true,
    ).finally(() => {
      settled = true;
      clearInterval(readinessTimer);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(settled).toBe(false);
    expect(readinessTurns).toBeGreaterThan(1);
    expect((await fetch).status).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
