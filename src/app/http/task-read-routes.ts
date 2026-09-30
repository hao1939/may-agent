/** HTTP read adapters; canonical Task and Conversation projections stay in the daemon. */
export function createTaskReadHandlers(options: {
  daemonRead: (frame: Record<string, unknown>) => Promise<Record<string, unknown>>;
  json: (data: unknown, status?: number) => Response;
}) {
  const { daemonRead, json } = options;

  async function handleConversationRead(url: URL): Promise<Response> {
    const appId = url.searchParams.get("appId")?.trim();
    const conversationId = url.searchParams.get("conversationId")?.trim();
    if (!appId || !conversationId) return json({ error: "appId and conversationId required" }, 400);
    try {
      const response = await daemonRead({ type: "app.conversation.get", appId, conversationId, limit: 30 });
      // This endpoint already validates its input and supplies bounded options.
      // A daemon error also covers unavailable/failed storage reads, not just
      // validation; do not misclassify an internal read failure as HTTP 400.
      if (response.type === "error") return json({ error: response.message }, 503);
      if (response.type !== "ok" || !response.conversation) throw new Error("Invalid Conversation response");
      return json(response.conversation);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
  }

  function taskEvidenceQuery(url: URL): Record<string, unknown> {
    const acceptedEvidence = url.searchParams.get("acceptedEvidence");
    if (acceptedEvidence !== null && acceptedEvidence !== "true" && acceptedEvidence !== "false")
      throw new Error("acceptedEvidence must be true or false");
    if (acceptedEvidence !== "true") {
      if (url.searchParams.has("evidenceLimit") || url.searchParams.has("evidenceCursor"))
        throw new Error("acceptedEvidence=true is required for evidence pagination");
      return {};
    }
    return {
      acceptedEvidence: true,
      ...(url.searchParams.has("evidenceLimit")
        ? { evidenceLimit: Number(url.searchParams.get("evidenceLimit")) }
        : {}),
      ...(url.searchParams.has("evidenceCursor") ? { evidenceCursor: url.searchParams.get("evidenceCursor") } : {}),
    };
  }

  async function handleHumanTaskRead(url: URL): Promise<Response> {
    const appId = url.searchParams.get("appId")?.trim();
    const detail = url.pathname === "/api/task";
    if (!appId && (detail || url.searchParams.get("allApps") !== "true"))
      return json({ error: "appId required (or allApps=true for a list)" }, 400);
    const taskId = url.searchParams.get("taskId")?.trim();
    if (detail && !taskId) return json({ error: "taskId required" }, 400);
    const includeDone = url.searchParams.get("includeDone");
    if (includeDone !== null && includeDone !== "true" && includeDone !== "false") {
      return json({ error: "includeDone must be true or false" }, 400);
    }
    let evidenceOptions: Record<string, unknown>;
    try {
      evidenceOptions = taskEvidenceQuery(url);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
    try {
      const response = await daemonRead(
        detail
          ? { type: "task.get", appId, taskId, ...evidenceOptions }
          : {
              type: "tasks.list",
              ...(appId ? { appId } : {}),
              includeDone: includeDone === "true",
              ...(url.searchParams.has("status") ? { status: url.searchParams.getAll("status") } : {}),
              ...(url.searchParams.has("limit") ? { limit: Number(url.searchParams.get("limit")) } : {}),
              ...(url.searchParams.has("cursor") ? { cursor: url.searchParams.get("cursor") } : {}),
            },
      );
      if (response.type === "error") return json({ error: response.message ?? "Task read failed" }, 400);
      if (response.type !== "ok" || (!detail && !response.tasks) || (detail && !("task" in response))) {
        throw new Error("Invalid daemon Task response");
      }
      if (detail) return response.task ? json(response.task) : json({ error: "Task not found" }, 404);
      return json(response.tasks);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
  }

  async function handleAppTasks(url: URL, appId: string): Promise<Response> {
    if (!appId) return json({ error: "appId required" }, 400);
    const status = url.searchParams.getAll("status").filter(Boolean);
    const limitText = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor")?.trim();
    try {
      const response = await daemonRead({
        type: "app.tasks.list",
        appId,
        ...(status.length > 0 ? { status } : {}),
        ...(limitText === null ? {} : { limit: Number(limitText) }),
        ...(cursor ? { cursor } : {}),
      });
      if (response.type === "error") return json({ error: response.message ?? "Task read failed" }, 400);
      return json(response.tasks ?? { items: [] });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
  }

  async function handleAppTask(url: URL, appId: string, taskId: string): Promise<Response> {
    if (!appId) return json({ error: "appId required" }, 400);
    if (!taskId) return json({ error: "taskId required" }, 400);
    let evidenceOptions: Record<string, unknown>;
    try {
      evidenceOptions = taskEvidenceQuery(url);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
    try {
      const response = await daemonRead({
        type: "app.task.get",
        appId,
        taskId,
        ...evidenceOptions,
        ...(url.searchParams.has("inputKey") ? { inputKeys: url.searchParams.getAll("inputKey") } : {}),
      });
      if (response.type === "error") return json({ error: response.message ?? "Task read failed" }, 400);
      return response.task ? json(response.task) : json({ error: "Task not found" }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
  }

  return { handleConversationRead, handleHumanTaskRead, handleAppTasks, handleAppTask };
}
