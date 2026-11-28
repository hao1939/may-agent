#!/usr/bin/env node
// A protocol peer, not the Codex CLI/model. The real Host executor communicates
// with this separate process over its production JSON-RPC stdin/stdout client.
import { createInterface } from "node:readline";
const service = process.env.MAY_TEST_FEEDBACK_SERVICE;
if (!service?.startsWith("http://127.0.0.1:")) throw new Error("A loopback fixture service is required");
const threadId = "fixture-feedback-thread";
const turnId = "fixture-feedback-turn";
const send = (message) => process.stdout.write(JSON.stringify(message) + "\n");
const notify = (method, params) => send({ method, params });
let goal = { threadId, objective: "fixture", status: "paused" };
let packet;
let completion;
let finishing = false;
async function record(kind, data) {
  const response = await fetch(`${service}/${kind}`, { method: "POST", body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`Fixture service rejected ${kind}: ${response.status}`);
  return response;
}
async function finish(permission) {
  if (finishing) return;
  finishing = true;
  const release = await fetch(`${service}/finish`);
  if (!release.ok) return;
  // The fake external effect occurs only after the native peer observes the
  // admitted permission, never from test-side injection into the worker.
  await record("publish", { inputKey: permission.data.idempotencyKey, pid: process.pid });
  const keys = ["task:start", permission.data.idempotencyKey];
  completion = {
    state: "converged",
    summary: "Published the permitted fixture change",
    facts: ["fixture-publication-verified"],
    inputKeys: keys,
  };
  goal = { ...goal, status: "complete" };
  notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  notify("thread/goal/updated", { threadId, turnId, goal });
}
createInterface({ input: process.stdin }).on("line", async (line) => {
  try {
    const request = JSON.parse(line);
    if (request.id === undefined) return;
    const params = request.params ?? {};
    let result = {};
    if (request.method === "initialize") result = { userAgent: "fixture-protocol-peer" };
    else if (request.method === "thread/start") {
      packet = JSON.parse(params.developerInstructions.split("## Canonical May Task Attempt\n")[1]);
      result = { thread: { id: threadId }, cwd: params.cwd };
    } else if (request.method === "thread/resume") result = { thread: { id: threadId }, cwd: params.cwd };
    else if (request.method === "thread/goal/set") {
      goal = { ...goal, ...params };
      result = { goal };
    } else if (request.method === "thread/goal/get") result = { goal };
    else if (request.method === "turn/steer") {
      const message = params.input.map((item) => item.text ?? "").join("\n");
      const event = JSON.parse(message.split("\n").at(-1));
      await record("observed", { event, nativePid: process.pid, parentPid: process.ppid, packet, threadId, turnId });
      result = { turnId };
      send({ id: request.id, result });
      if (event.type === "app.task.requested" && event.data.idempotencyKey === "task:permission")
        void finish(event).catch((error) => {
          console.error(error);
          process.exit(1);
        });
      return;
    } else if (request.method === "thread/items/list")
      result = {
        data: completion
          ? [{ turnId, item: { type: "agentMessage", phase: "final_answer", text: JSON.stringify(completion) } }]
          : [],
        nextCursor: null,
      };
    send({ id: request.id, result });
    if (request.method === "thread/goal/set") {
      notify("thread/goal/updated", { threadId, turnId, goal });
      if (goal.status === "active") {
        notify("turn/started", { threadId, turn: { id: turnId, status: "inProgress" } });
        await record("ready", { packet, nativePid: process.pid, parentPid: process.ppid, threadId, turnId });
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
