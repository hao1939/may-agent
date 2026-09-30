// Run from this source workspace. Installed clients can use the equivalent
// @may-agent/control/client and @may-agent/control/events package exports.
import { getEvent, publishEvent, sendSocketCommand } from "../../../may-agent/packages/control/src/client.js";
import type { EventInput } from "../../../may-agent/packages/control/src/events.js";

export const reviewInput = {
  type: "app.input.requested",
  target: { appId: "sample" },
  data: { input: { kind: "review", data: { subject: "the sample App README against its implementation", references: ["projects/sample.app/README.md", "projects/sample.app/app.ts"] } } },
  idempotencyKey: "sample-release-notes-review-1",
} satisfies EventInput;

// Importing the example for validation never connects to a Host.
if (import.meta.main) {
  const [command, socketPath, id] = process.argv.slice(2);
  if (!socketPath || !["submit", "event", "task"].includes(command ?? "")) {
    throw new Error("Usage: bun client.ts <submit|event|task> <socket-path> [event-id|task-id]");
  }
  if (command === "submit") {
    console.log(JSON.stringify(await publishEvent(socketPath, reviewInput), null, 2));
  } else if (command === "event") {
    const eventId = Number(id);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new Error("A positive event ID is required");
    console.log(JSON.stringify(await getEvent(socketPath, eventId), null, 2));
  } else {
    if (!id) throw new Error("A Task ID is required");
    const response = await sendSocketCommand(socketPath, {
      type: "app.task.get", appId: "sample", taskId: id,
    });
    console.log(JSON.stringify(response.task, null, 2));
  }
}
