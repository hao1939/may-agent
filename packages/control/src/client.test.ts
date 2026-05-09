import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findDaemonSocket } from "./client.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

function makeSocketLikeFifo(path: string): void {
  execFileSync("mkfifo", [path]);
}

describe("findDaemonSocket", () => {
  it("prefers daemon instance sockets over stale job sockets when identity is not running", async () => {
    const root = mkdtempSync(join(tmpdir(), "control-client-"));
    roots.push(root);
    const instances = join(root, "instances");
    const jobDir = join(instances, "job-cron_old");
    const daemonDir = join(instances, "background");
    mkdirSync(jobDir, { recursive: true });
    mkdirSync(daemonDir, { recursive: true });

    const jobSocket = join(jobDir, "bob.sock");
    const daemonSocket = join(daemonDir, "may.sock");
    makeSocketLikeFifo(jobSocket);
    makeSocketLikeFifo(daemonSocket);
    writeFileSync(join(jobDir, "identity.json"), JSON.stringify({ status: "running" }), "utf-8");
    writeFileSync(join(daemonDir, "identity.json"), JSON.stringify({ status: "done" }), "utf-8");

    expect(findDaemonSocket(root, { agent: "*" })).toBe(daemonSocket);
  });

  it("still prefers a confirmed running daemon when available", async () => {
    const root = mkdtempSync(join(tmpdir(), "control-client-"));
    roots.push(root);
    const instances = join(root, "instances");
    const defaultDir = join(instances, "default");
    const backgroundDir = join(instances, "background");
    mkdirSync(defaultDir, { recursive: true });
    mkdirSync(backgroundDir, { recursive: true });

    const oldSocket = join(defaultDir, "may.sock");
    const runningSocket = join(backgroundDir, "may.sock");
    makeSocketLikeFifo(oldSocket);
    makeSocketLikeFifo(runningSocket);
    writeFileSync(join(defaultDir, "identity.json"), JSON.stringify({ status: "done" }), "utf-8");
    writeFileSync(join(backgroundDir, "identity.json"), JSON.stringify({ status: "running" }), "utf-8");

    expect(findDaemonSocket(root, { agent: "*" })).toBe(runningSocket);
  });

  it("does not return job sockets for daemon wildcard discovery", async () => {
    const root = mkdtempSync(join(tmpdir(), "control-client-"));
    roots.push(root);
    const jobDir = join(root, "instances", "job-cron_old");
    mkdirSync(jobDir, { recursive: true });
    const jobSocket = join(jobDir, "bob.sock");
    makeSocketLikeFifo(jobSocket);
    writeFileSync(join(jobDir, "identity.json"), JSON.stringify({ status: "running" }), "utf-8");

    expect(findDaemonSocket(root, { agent: "*" })).toBeNull();
    expect(findDaemonSocket(root, { agent: "bob" })).toBe(jobSocket);
  });
});
