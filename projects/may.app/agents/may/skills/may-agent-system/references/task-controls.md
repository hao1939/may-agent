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
2. Read the exact control view and submit guarded completion through the existing
   public socket client. Use the running installation's socket path and the
   candidate's exact `ref`; do not import private writers or guess a source entry
   point.

   ```ts
   import { sendSocketCommand } from "/app/projects/may-agent/packages/control/src/client.ts";

   const read = await sendSocketCommand(socketPath, { type: "task.get", ref });
   if (read.type !== "ok" || !read.task) throw new Error("Task read failed");
   const task = read.task as {
     appId: string;
     taskId: string;
     generation: number;
     resourceVersion: number;
     acceptedAttempt?: { id: string };
   };
   if (!task.acceptedAttempt?.id) throw new Error("No exact accepted result to consume");

   const closed = await sendSocketCommand(socketPath, {
     type: "task.close",
     appId: task.appId,
     taskId: task.taskId,
     expectedGeneration: task.generation,
     expectedResourceVersion: task.resourceVersion,
     afterResult: task.acceptedAttempt.id,
     reason: "Owner consumed this completed finite result",
   });
   if (closed.type !== "ok") throw new Error(`Task completion rejected: ${closed.message}`);
   ```

   The fresh read exposes the exact accepted attempt and current fences. The
   runtime rejects omission or an empty `afterResult`, mismatched result or
   fences, a non-converged stored phase, a current attempt, or a pending trigger.
   Rejection must leave every Task fact and link intact. These mechanical checks
   do not decide that the responsibility should end: inspect the full current
   context and exercise owner judgment. Independent structural children can
   continue. Do not interpret `cancellable`, an empty Conditions list, a quiet
   Task, or an accepted old result as completion.

3. If `task.close` is unavailable or rejects, preserve the Task and report the
   exact limitation or current obligation. Do not fall back to
   `app.task.cancel.requested` merely to reduce open counts. Reread after a stale
   fence, then reconsider whether completion is still justified; do not blindly
   substitute newer fence values.

   Intentional withdrawal is a separate authorized decision. Only when the
   assigning owner or human has actually withdrawn the remaining responsibility,
   use the supported `task.cancel` control with an explicit reason. It may stop
   active work and clear outstanding links by design; never describe an agent or
   system-originated cancellation as a human decision.

4. Verify the returned event with `event.get` and reread the exact Task.
   Acceptance proves control delivery; `tasks.get` showing `closed: true`
   proves closure. The accepted achievement remains in history. Report what was
   closed, what remains, and current counts. Do not delete Task history or
   rewrite prior receipts.

For a recurring review, return the current cycle's evidence and an exact wait
with `reviewAfterMs` through the supplied result schema. Runtime stores and
schedules the next check. Do not add a sleeping shell, private cron, or detached
loop. A timestamp in prose alone does not schedule work.
