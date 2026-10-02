import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { CodexGoalAppServerClient } from "../src/app/adapters/executors/codex/codex-goal-client.js";

// Exercise May's production client against the installed CLI and a loopback
// Responses fixture. No credentials or external model calls are used.
const root = mkdtempSync(join(tmpdir(), "may-codex-protocol-"));
const codexState = join(root, "codex");
mkdirSync(codexState);
const captures: unknown[] = [];
const retainedAnswerChars = 525_000;
let releaseResponses!: () => void;
const responseGate = new Promise<void>((resolve) => {
  releaseResponses = resolve;
});
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  captures.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  const sequence = captures.length;
  await responseGate;
  const fixtureAnswer = sequence > 2 ? `retained-output:${"x".repeat(retainedAnswerChars)}` : "Fixture response.";
  const item = {
    id: `msg_${sequence}`,
    type: "message",
    role: "assistant",
    phase: "final_answer",
    status: "completed",
    content: [{ type: "output_text", text: fixtureAnswer, annotations: [] }],
  };
  const completed = {
    id: `resp_${sequence}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1_000),
    status: "completed",
    output: [item],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  };
  const events = [
    { type: "response.created", response: { ...completed, status: "in_progress", output: [] } },
    { type: "response.output_item.added", output_index: 0, item: { ...item, status: "in_progress", content: [] } },
    { type: "response.content_part.added", item_id: item.id, output_index: 0, content_index: 0, part: item.content[0] },
    { type: "response.output_text.delta", item_id: item.id, output_index: 0, content_index: 0, delta: fixtureAnswer },
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response: completed },
  ];
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  response.writeHead(200, { "content-type": "text/event-stream", "content-length": Buffer.byteLength(payload) });
  response.end(payload);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("Loopback fixture did not bind a TCP port");
writeFileSync(
  join(codexState, "config.toml"),
  [
    "check_for_update_on_startup = false",
    'cli_auth_credentials_store = "file"',
    'model_provider = "compatibility"',
    'model = "fixture-model"',
    "[model_providers.compatibility]",
    'name = "Compatibility check"',
    `base_url = "http://127.0.0.1:${address.port}/v1"`,
    'wire_api = "responses"',
    "requires_openai_auth = false",
    "",
  ].join("\n"),
);
const args = process.argv.slice(2);
const checkExecution = args.includes("--check-execution");
const command = args.find((argument) => argument !== "--check-execution") ?? "codex";
const executionFixtureText = "may-codex-installation-execution-ok\n";
const spawnClient = () =>
  CodexGoalAppServerClient.spawn({
    cwd: root,
    command,
    env: { PATH: process.env.PATH, CODEX_HOME: codexState },
    requestTimeoutMs: 5_000,
  });
async function waitForCaptures(count: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (captures.length < count && Date.now() < deadline) await Bun.sleep(10);
  assert.ok(captures.length >= count, `Expected ${count} outgoing model request(s), received ${captures.length}`);
}
const firstPacket = JSON.stringify({ attemptId: "attempt-alpha", resourceVersion: 7, inputKeys: ["input:alpha"] });
const freshPacket = JSON.stringify({
  attemptId: "attempt-beta",
  resourceVersion: 8,
  inputKeys: ["input:beta"],
  previousRejection: "Condition is required for waiting",
});
let client: CodexGoalAppServerClient | undefined;
try {
  if (checkExecution) {
    const invocationCwd = process.cwd();
    const executionFixture = join(root, "execution-fixture.txt");
    writeFileSync(executionFixture, executionFixtureText);
    const executionClient = CodexGoalAppServerClient.spawn({
      cwd: invocationCwd,
      command,
      env: process.env,
      requestTimeoutMs: 5_000,
    });
    try {
      await executionClient.initialize();
      const execution = await executionClient.execCommand({
        command: ["/usr/bin/cat", executionFixture],
        cwd: invocationCwd,
        timeoutMs: 5_000,
        outputBytesCap: 4_096,
      });
      assert.equal(
        execution.exitCode,
        0,
        `Installed CLI configured execution check failed: ${JSON.stringify(execution)}`,
      );
      assert.equal(execution.stdout, executionFixtureText, "Installed CLI did not read the synthetic fixture exactly");
      assert.equal(execution.stderr, "", `Installed CLI execution check wrote stderr: ${execution.stderr}`);
    } finally {
      await executionClient.stop();
    }
  }
  client = spawnClient();
  await client.initialize();
  const thread = await client.startThread({ cwd: root, developerInstructions: firstPacket });
  assert.equal(thread.cwd, root);
  const originalObjective = "Verify the old assignment";
  await client.setGoal({ threadId: thread.threadId, objective: originalObjective, status: "active", tokenBudget: 1_000 });
  const firstTurn = await client.waitForActiveTurn(thread.threadId, 5_000);
  await waitForCaptures(1);
  assert.match(JSON.stringify(captures[0]), /attempt-alpha/);

  // Stopping with an active persisted goal models an interrupted executor. The
  // replacement process must pause that unloaded goal before thread/resume,
  // because this CLI otherwise starts an old-context turn during resume.
  await client.stop();
  client = spawnClient();
  await client.initialize();
  const freshObjective = "Verify the refreshed assignment";
  await client.setGoal({ threadId: thread.threadId, objective: freshObjective, status: "paused" });
  const observed = await client.waitForGoal(thread.threadId, ({ goal }) => goal.status === "paused", 5_000);
  assert.equal(observed.goal.objective, freshObjective);
  assert.equal(observed.goal.tokenBudget, 1_000);
  assert.equal(observed.goal.tokensUsed, 0);
  assert.deepEqual(
    await client.resumeThread({ threadId: thread.threadId, cwd: root, developerInstructions: freshPacket }),
    thread,
  );
  await Bun.sleep(100);
  assert.equal(captures.length, 1, "resume must not activate the old persisted goal");
  const { goal } = (await client.getGoal(thread.threadId)) as { goal: typeof observed.goal };
  assert.equal(goal.status, "paused");
  assert.equal(goal.tokenBudget, 1_000);
  await client.injectDeveloperContext({ threadId: thread.threadId, text: freshPacket });
  await client.setGoal({ threadId: thread.threadId, objective: freshObjective, status: "active" });
  const secondTurn = await client.waitForActiveTurn(thread.threadId, 5_000);
  await waitForCaptures(2);
  await assert.rejects(
    client.steer({ threadId: thread.threadId, turnId: firstTurn, message: "This stale turn must be fenced." }),
  );
  releaseResponses();
  await client.waitForTurn(secondTurn, 5_000);

  const resumedRequest = JSON.stringify(captures[1]);
  assert.match(resumedRequest, /attempt-beta/);
  assert.match(resumedRequest, /resourceVersion\\?\"?:8/);
  assert.match(resumedRequest, /input:beta/);
  assert.match(resumedRequest, /Condition is required for waiting/);
  assert.doesNotMatch(resumedRequest, /This stale turn must be fenced/);

  await client.setGoal({ threadId: thread.threadId, objective: freshObjective, status: "paused" });
  const exactItems = await client.listThreadItems({
    threadId: thread.threadId,
    turnId: secondTurn,
    limit: 1,
    sortDirection: "desc",
  });
  assert.equal(exactItems.data.length, 1);
  assert.equal(exactItems.data[0]?.turnId, secondTurn);
  assert.equal((exactItems.data[0]?.item as { text?: string }).text, "Fixture response.");
  assert.equal((exactItems.data[0]?.item as { phase?: string }).phase, "final_answer");

  process.stdout.write(
    `${JSON.stringify({ installedCliBoundedRead: true, exactFinalAnswer: true, diagnostics: client.diagnostics() })}\n`,
  );
  process.stdout.write(
    `Codex compatibility passed: active-goal pause/resume, fresh request packet, prior rejection, old-turn fence, and bounded exact-turn retrieval${checkExecution ? ", plus installed-policy execution acceptance" : ""}.\n`,
  );
} finally {
  releaseResponses();
  try {
    await client?.stop();
  } finally {
    server.close();
    await once(server, "close");
    rmSync(root, { recursive: true, force: true });
  }
}
