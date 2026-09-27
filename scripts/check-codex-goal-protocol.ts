import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexGoalAppServerClient } from "../src/app/adapters/executors/codex/codex-goal-client.js";

// Exercise May's client against the installed CLI, with disposable state and
// no inherited credentials. A paused goal never starts a model turn. The local
// provider address also keeps an accidental request away from a real provider.
const root = mkdtempSync(join(tmpdir(), "may-codex-protocol-"));
const codexState = join(root, "codex");
mkdirSync(codexState);
writeFileSync(
  join(codexState, "config.toml"),
  [
    "check_for_update_on_startup = false",
    'cli_auth_credentials_store = "file"',
    'model_provider = "compatibility"',
    "[model_providers.compatibility]",
    'name = "Compatibility check"',
    'base_url = "http://127.0.0.1:1/v1"',
    'wire_api = "responses"',
    "requires_openai_auth = false",
    "",
  ].join("\n"),
);
const spawnClient = () =>
  CodexGoalAppServerClient.spawn({
    cwd: root,
    command: process.argv[2] ?? "codex",
    env: { PATH: process.env.PATH, CODEX_HOME: codexState },
    requestTimeoutMs: 5_000,
  });
let client: CodexGoalAppServerClient | undefined;
try {
  client = spawnClient();
  await client.initialize();
  const thread = await client.startThread({ cwd: root });
  assert.ok(thread.threadId);
  assert.equal(thread.cwd, root);
  const objective = "Verify the May client without starting model work";
  await client.setGoal({ threadId: thread.threadId, objective, status: "paused", tokenBudget: 1_000 });
  const observed = await client.waitForGoal(thread.threadId, ({ goal }) => goal.status === "paused", 5_000);
  assert.equal(observed.goal.objective, objective);
  assert.equal(observed.goal.tokenBudget, 1_000);

  // A new client/process must recover the same thread and saved goal.
  await client.stop();
  client = spawnClient();
  await client.initialize();
  assert.deepEqual(await client.resumeThread({ threadId: thread.threadId, cwd: root }), thread);
  const { goal } = (await client.getGoal(thread.threadId)) as { goal: typeof observed.goal };
  assert.equal(goal.threadId, thread.threadId);
  assert.equal(goal.objective, objective);
  assert.equal(goal.status, "paused");
  assert.equal(goal.tokenBudget, 1_000);
  assert.equal(goal.tokensUsed, 0);
  const read = (await client.readThread(thread.threadId)) as { thread: { id: string; turns: unknown[] } };
  assert.equal(read.thread.id, thread.threadId);
  assert.deepEqual(read.thread.turns, []);
  process.stdout.write(
    "Codex compatibility passed: initialize, paused goal notification, restart, resume and reads.\n",
  );
} finally {
  try {
    await client?.stop();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
