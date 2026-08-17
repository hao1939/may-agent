import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppAnalysisCapability } from "./app-analysis-capability.js";
import { EventBus, type AgentEvent } from "./event-bus.js";

describe("App analysis capability", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("creates one deterministic May analysis request and reads terminal evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-analysis-capability-"));
    roots.push(root);
    const persistDir = join(root, ".state");
    mkdirSync(persistDir, { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const capability = createAppAnalysisCapability({ bus, persistDir, projectRoot: root });
    const request = {
      id: "human-1",
      source: { kind: "human" as const, id: "telegram:42" },
      input: { kind: "message", data: { message: "review" } },
    };
    const input = {
      appId: "may" as const,
      analysis: { tool: "codex" as const, question: "Review docs", timeoutMs: 10_000 },
      idempotencyKey: "analysis:human-1:root:abc",
      request,
    };

    const first = await capability.attach(input);
    const acceptedRecordPath = join(persistDir, "cli-tasks", first.analysisId, "task.json");
    writeFileSync(acceptedRecordPath, `${JSON.stringify({ taskId: first.analysisId, status: "requested" })}\n`);
    const second = await capability.attach(input);
    expect(second.analysisId).toBe(first.analysisId);
    expect(events.filter((event) => event.type === "cli.task.requested")).toHaveLength(1);
    const emitted = events.find((event) => event.type === "cli.task.requested") as any;
    expect(emitted.data).toMatchObject({
      taskId: first.analysisId,
      purpose: "may-analysis",
      sandbox: "read-only",
      sourceOwner: "agent:may",
    });
    expect(readFileSync(emitted.data.promptPath, "utf8")).toBe("Review docs");

    writeFileSync(
      acceptedRecordPath,
      `${JSON.stringify({
        taskId: first.analysisId,
        status: "completed",
        summary: "Reviewed",
        resultPath: emitted.data.resultPath,
        structuredResultPath: emitted.data.structuredResultPath,
        eventsPath: emitted.data.eventsPath,
      })}\n`,
    );
    writeFileSync(emitted.data.resultPath, "Reviewed");
    expect(await first.isComplete?.()).toBe(true);
    expect(capability.read(first.analysisId)).toEqual({
      kind: "analysis",
      id: first.analysisId,
      status: "done",
      summary: "Reviewed",
      evidence: [emitted.data.resultPath],
    });
  });

  it("rejects cwd and file paths outside the project", async () => {
    const root = mkdtempSync(join(tmpdir(), "may-analysis-paths-"));
    roots.push(root);
    const capability = createAppAnalysisCapability({
      bus: new EventBus(),
      persistDir: join(root, ".state"),
      projectRoot: root,
    });
    await expect(
      capability.attach({
        appId: "may",
        analysis: { tool: "claude", question: "Review", cwd: "..", timeoutMs: 1_000 },
        idempotencyKey: "outside",
        request: { id: "r", source: { kind: "human", id: "h" }, input: { kind: "message", data: {} } },
      }),
    ).rejects.toThrow("outside project root");
  });
});
