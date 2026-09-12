/** Real daemon activation, extracted from the retired teaching experiment. No model calls. */
import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { getEvent, publishEvent } from "../../packages/control/src/client.js";
import { DefinitionSourceReleaseStore } from "../../src/app/app-source-release.js";
import { pollUntil } from "./lib/live-daemon.js";
import { buildSandbox } from "./lib/sandbox.js";

test("daemon correlates source activation and rejects an invalid candidate without replacing active source", async () => {
  const sb = await buildSandbox({ fixtureAgents: ["may"], daemonArgs: ["--socket"] });
  const git = async (...args: string[]) =>
    (await promisify(execFile)("git", args, { cwd: sb.root, timeout: 10_000 })).stdout.trim();
  try {
    await sb.daemonReady;
    await git("init", "-q");
    await git("config", "user.name", "Fixture Author");
    await git("config", "user.email", "fixture@example.invalid");
    writeFileSync(join(sb.projectsRoot, ".keep"), "");
    mkdirSync(join(sb.root, "shared/skills"), { recursive: true });
    writeFileSync(join(sb.root, "shared/skills/.keep"), "");
    await git("add", "agents", "shared", "projects/.keep");
    await git("commit", "-qm", "Synthetic definition source");
    const validCommit = await git("rev-parse", "HEAD");
    const store = new DefinitionSourceReleaseStore(sb.root, sb.stateDir);
    const reload = async () => {
      const requestId = `test-reload:${randomUUID()}`;
      const receipt = await publishEvent(sb.socketPath, {
        type: "runtime.reload.requested",
        idempotencyKey: requestId,
        data: { requestId },
      });
      const operation = await pollUntil(
        async () => {
          // This view contains only operation completions parented by the exact event.
          const view = await getEvent(sb.socketPath, receipt.eventId);
          return view.links.find(
            (link) => link.kind === "operation" && ["succeeded", "failed"].includes(link.state ?? ""),
          );
        },
        { timeoutMs: 15_000, description: `completion of reload ${requestId}` },
      );
      return { requestId, eventId: receipt.eventId, operation };
    };

    const accepted = await reload();
    expect(accepted.operation.state, JSON.stringify(accepted) + "\n" + sb.getLogs()).toBe("succeeded");
    expect(store.current()?.sourceCommit).toBe(validCommit);
    const configPath = join(sb.agentsRoot, "may", "agent.json");
    const validConfig = JSON.parse(readFileSync(configPath, "utf8"));
    writeFileSync(configPath, JSON.stringify({ ...validConfig, model: "unavailable-fixture-model" }));
    await git("add", "agents/may/agent.json");
    await git("commit", "-qm", "Invalid model candidate");
    const invalidCommit = await git("rev-parse", "HEAD");
    expect(invalidCommit).not.toBe(validCommit);
    // A saved commit is not an activation.
    expect(store.current()?.sourceCommit).toBe(validCommit);

    const rejected = await reload();
    expect(rejected.eventId).not.toBe(accepted.eventId);
    expect(rejected.requestId).not.toBe(accepted.requestId);
    expect(rejected.operation.state).toBe("failed");
    expect(store.current()?.sourceCommit).toBe(validCommit);
    expect(JSON.parse(readFileSync(join(store.current()!.agentsRoot, "may", "agent.json"), "utf8"))).toEqual(
      validConfig,
    );
    // The later failure must not be attributed to the earlier successful request.
    const previous = await getEvent(sb.socketPath, accepted.eventId);
    expect(previous.links.filter((link) => link.kind === "operation").map((link) => link.state)).toEqual(["succeeded"]);
  } finally {
    await sb.close();
  }
}, 120_000);
