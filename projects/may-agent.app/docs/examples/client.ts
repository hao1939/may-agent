// This workspace client uses Host source. Installed clients can use the equivalent
// @may-agent/control/client and @may-agent/control/events package exports.
// App execution uses @may-agent/sdk instead of this operator control connection.
import { getEvent, publishEvent, sendSocketCommand } from "../../../may-agent/packages/control/src/client.js";
import type { EventInput } from "../../../may-agent/packages/control/src/events.js";

export const reviewInput = {
  type: "app.input.requested",
  target: { appId: "sample" },
  data: {
    input: {
      kind: "review",
      data: {
        subject: "the sample App README against its implementation",
        references: [
          "projects/sample.app/README.md",
          "projects/sample.app/app.ts",
          "projects/sample.app/agents/reviewer/AGENTS.md",
        ],
      },
    },
  },
} satisfies EventInput;

// Importing the example for validation never connects to a Host.
if (import.meta.main) {
  const [command, socketPath, id, key, message] = process.argv.slice(2);
  if (!socketPath || !["apps", "submit", "event", "task", "message", "reload"].includes(command ?? "")) {
    throw new Error([
      "Usage: bun client.ts <command> <socket-path> [arguments]",
      "  apps",
      "  submit <request-key>",
      "  event <event-id>",
      "  task <task-id>",
      '  message <task-id> <request-key> "message"',
      "  reload <expected-source-commit>",
    ].join("\n"));
  }
  let result: unknown;
  if (command === "apps") {
    result = await sendSocketCommand(socketPath, { type: "apps.list" });
  } else if (command === "submit") {
    if (!id?.trim()) throw new Error("A request key is required; reuse it when retrying this submission");
    result = await publishEvent(socketPath, { ...reviewInput, idempotencyKey: id });
  } else if (command === "event") {
    const eventId = Number(id);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new Error("A positive event ID is required");
    result = await getEvent(socketPath, eventId);
  } else if (command === "message") {
    if (!id?.trim() || !key?.trim() || !message?.trim()) throw new Error("A Task ID, request key and quoted message are required");
    result = await publishEvent(socketPath, {
      type: "app.input.requested",
      target: { appId: "sample", taskId: id },
      data: { input: { kind: "message", data: { message } } },
      idempotencyKey: key,
    });
  } else if (command === "reload") {
    if (!id || !/^[a-f0-9]{40}$/.test(id)) throw new Error("A full source commit from the definition checkout is required");
    result = await publishEvent(socketPath, {
      type: "runtime.reload.requested",
      data: { reason: "SDK quickstart definition activation", expectedSourceCommit: id },
      idempotencyKey: `sdk-quickstart-reload:${id}`,
    });
  } else {
    if (!id?.trim()) throw new Error("A Task ID is required");
    const response = await sendSocketCommand(socketPath, {
      type: "app.task.get", appId: "sample", taskId: id,
      acceptedEvidence: true, evidenceLimit: 4,
    });
    result = response.task;
  }
  console.log(JSON.stringify(result, null, 2));
}
