# Task cleanup through existing controls

Use this only for an authorized, exact Task closure. Reviewing Tasks is not
permission to close them. Preserve standing, running, waiting, or uncertain
work; an accepted `done` result alone does not prove a Task should end.
Conversation execution Tasks and their deterministic successors are standing
work: exclude them from routine hygiene unless current canonical evidence records
an explicit human or owning-App withdrawal of the whole Conversation. Quietness,
a completed Turn, a fulfilled Request, and an accepted child result are not that
evidence. Likewise, do not close recurring schedules merely because their latest
cycle is up to date, and do not replace a cancelled Conversation with an
operator-invented identity; supported recovery begins with fresh human input.

1. Discover open work with `tasks({ action: "list", limit: 100 })`;
   follow `nextCursor` and select records whose `closed` is not true. Inspect each candidate with `get` and its
   accepted evidence. A one-off authorized cleanup can run inside the current
   Conversation; periodic reviews need one continuing Task, not one per cycle.
2. Read the exact control view using the existing public socket client:

   ```ts
   import { sendSocketCommand } from "/app/projects/may-agent/packages/control/src/client.ts";
   const response = await sendSocketCommand(socketPath, {
     type: "task.get",
     ref,
   });
   ```

   Use the running installation's socket path and the candidate's exact `ref`.
   Check for an `ok` response and read `response.task`: it includes `appId`,
   `taskId`, `generation`, `resourceVersion`, and `cancellable`. This avoids
   treating private SQLite tables as a control API. Stop if the current view
   contradicts the closure decision or refuses cancellation.

3. Use the installed `may-agent` binary to submit the control. Verify its
   version if the checkout and deployment differ; do not execute a guessed
   source entry point, import private writers, or assume Docker is available
   inside the container. Substitute the exact freshly read values below:

   ```sh
   may-agent --emit app.task.cancel.requested '{"target":{"appId":"example","taskId":"goal/example"},"data":{"expectedGeneration":1,"expectedResourceVersion":4,"reason":"Owner-authorized closure: finite work complete"},"idempotencyKey":"app-task-cancel:example:goal/example:1:4"}'
   ```

   `target` must be outside `data`; payload `appId`/`taskId` alone do not route
   a control. The CLI builds the wire envelope; do not invent source/owner
   routing fields. Keep the same key and payload after an uncertain transport
   result. A stale-fence rejection requires a fresh read and renewed judgment,
   not blindly copying newer version numbers into the same operation.

4. Verify the returned event with `event.get` and reread the exact Task.
   Acceptance proves control delivery; `tasks.get` showing `closed: true`
   proves closure. The control view calls this `cancelled`; accepted achievement
   remains in its history. Report what was closed, what remains, and current
   counts. Do not delete Task history or rewrite prior receipts.

For a recurring review, return the current cycle's evidence and an exact wait
with `reviewAfterMs` through the supplied result schema. Runtime stores and
schedules the next check. Do not add a sleeping shell, private cron, or detached
loop. A timestamp in prose alone does not schedule work.
