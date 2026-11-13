export type TaskInputCommand = Record<string, unknown> & {
  type: "app.input.admit";
  idempotencyKey: string;
  source: { kind: "human"; id: string };
};

export function taskInputIdempotencyKey(appId: string, taskId: string, key: string): string {
  return `web-task:${appId.length}:${appId}:${taskId.length}:${taskId}:${key}`;
}

/** Human feedback enters the existing App/Task admission path; it never controls a native thread directly. */
export function createTaskInputHandler(options: {
  daemonRead: (frame: Record<string, unknown>) => Promise<Record<string, unknown>>;
  admit: (frame: TaskInputCommand) => Promise<Record<string, unknown>>;
  confirm?: (frame: TaskInputCommand) => { eventId: number } | undefined;
  json: (body: unknown, status?: number) => Response;
}) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) return options.json({ error: "Same-origin input required" }, 403);
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return options.json({ error: "application/json required" }, 415);
    let body: Record<string, unknown>;
    let admitting = false;
    try {
      const reader = req.body?.getReader();
      if (!reader) throw new Error("Missing body");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 32_768) {
          await reader.cancel();
          return options.json({ error: "Input body exceeds 32 KiB" }, 413);
        }
        chunks.push(part.value);
      }
      const parsed: unknown = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks, size)));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Object required");
      body = parsed as Record<string, unknown>;
    } catch {
      return options.json({ error: "Valid JSON object required" }, 400);
    }
    const appId = typeof body.appId === "string" ? body.appId.trim() : "";
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const kind = body.inputKind === undefined ? "message" : body.inputKind;
    if (!appId || !taskId || appId.length > 256 || taskId.length > 1_024 || /[\u0000-\u001f]/.test(appId + taskId))
      return options.json({ error: "Exact appId and taskId required" }, 400);
    if (!message || message.length > 16_000)
      return options.json({ error: "Message must contain 1–16000 characters" }, 400);
    if (!/^[a-zA-Z0-9._:-]{1,160}$/.test(key))
      return options.json({ error: "A valid idempotencyKey is required" }, 400);
    if (typeof kind !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(kind))
      return options.json({ error: "Invalid App input kind" }, 400);
    if (!Number.isSafeInteger(body.expectedGeneration) || Number(body.expectedGeneration) < 1)
      return options.json({ error: "expectedGeneration must be a positive integer" }, 400);
    const frame: TaskInputCommand = {
      type: "app.input.admit",
      appId,
      targetTaskId: taskId,
      input: {
        kind,
        data: {
          message,
          context: { intent: "task-feedback", taskId, expectedGeneration: body.expectedGeneration },
        },
      },
      source: { kind: "human", id: `web-task:${key}` },
      channel: "web-ui",
      idempotencyKey: taskInputIdempotencyKey(appId, taskId, key),
    };
    try {
      const recorded = options.confirm?.(frame);
      if (recorded)
        return options.json(
          {
            accepted: true,
            appId,
            taskId,
            generation: body.expectedGeneration,
            eventId: recorded.eventId,
            replayed: true,
          },
          202,
        );
      const read = await options.daemonRead({ type: "task.get", appId, taskId });
      if (read.type !== "ok") return options.json({ error: "Task read unavailable" }, 503);
      const task = read.task as Record<string, unknown> | null;
      if (!task) return options.json({ error: "Task not found" }, 404);
      if (task.appId !== appId || task.taskId !== taskId) return options.json({ error: "Task identity mismatch" }, 409);
      if (task.generation !== body.expectedGeneration)
        return options.json(
          { error: "Task scope changed. Refresh and review it before sending.", generation: task.generation },
          409,
        );
      if (task.terminal || task.status === "closed" || task.status === "cancelled")
        return options.json({ error: "Task is closed; input cannot reopen it" }, 409);
      admitting = true;
      const result = await options.admit(frame);
      if (result.type !== "ok") return options.json({ error: String(result.message || "Task input rejected") }, 409);
      if (result.delivery !== undefined && result.delivery !== "accepted")
        return options.json(
          {
            error: "Task input admission was not confirmed. Retry with the same message key.",
            delivery: String(result.delivery),
            ...(typeof result.eventId === "number" ? { eventId: result.eventId } : {}),
          },
          503,
        );
      return options.json(
        {
          accepted: true,
          appId,
          taskId,
          generation: task.generation,
          ...(typeof result.eventId === "number" ? { eventId: result.eventId } : {}),
          ...(typeof result.inboxId === "string" ? { inboxId: result.inboxId } : {}),
          ...(typeof result.requestId === "string" ? { inboxId: result.requestId } : {}),
          ...(typeof result.created === "boolean" ? { replayed: !result.created } : {}),
        },
        202,
      );
    } catch (error) {
      if (error && typeof error === "object" && "kind" in error && error.kind === "definitive")
        return options.json(
          { error: error instanceof Error ? error.message : "Task input rejected", delivery: "rejected" },
          409,
        );
      // An absent acknowledgement can follow durable admission. The browser
      // retains this operation's key so an explicit retry cannot duplicate it.
      return options.json(
        {
          error: admitting
            ? "Task input acknowledgement unavailable. Retry with the same message key."
            : "Task read unavailable",
          delivery: admitting ? "unknown" : "not-sent",
        },
        503,
      );
    }
  };
}
