import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentDefinition } from "../../src/app/loader/agent-definition.js";
import { createAgentRun } from "../../src/lib/agent-runner.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import { readSessionMeta } from "../../src/lib/persistence.js";
import { fakeModel } from "../fixtures/model.js";
import concise from "../fixtures/concise-review-context.js";
import { getDb, closeDb } from "../../src/lib/db/connection.js";
import { contextUsageQuery, readContextUsage } from "../../src/app/adapters/reporting/context-usage.js";
import { usageReply } from "../fixtures/execution-usage.js";

test("configured preparation uses ordinary workflow execution across corrections and fresh managers", async () => {
  const root = mkdtempSync(join(tmpdir(), "context-workflow-"));
  const agentDir = join(root, "agents", "worker");
  mkdirSync(agentDir, { recursive: true });
  copyFileSync(
    fileURLToPath(new URL("../fixtures/concise-review-context.ts", import.meta.url)),
    join(agentDir, "context.ts"),
  );
  writeFileSync(
    join(root, "review.ts"),
    `
export const name = "review";
export const description = "Context component integration fixture";
export async function execute(ctx) {
  const result = await ctx.agents.call("worker", ctx.input, { tools: "readonly", timeoutMs: 5000 });
  return ctx.done(result.summary, result);
}
`,
  );
  const packets = [
    { revision: "one", requirement: "Review correctness", findings: ["missing test"] },
    { revision: "two", requirement: "Review correctness", findings: [] },
    {
      revision: "three",
      requirement: "Review correctness and performance",
      findings: ["reopened: missing test", "slow path"],
    },
    { revision: "four", requirement: "Review performance only", findings: ["slow path"] },
  ].map((current, index) => ({
    contract: "review-brief/v1",
    ...current,
    log: {
      ref: index === 3 ? "" : join(root, `evidence-${index}.txt`),
      content: "Verified historical log line.\n".repeat(100),
    },
  }));
  for (const packet of packets) if (packet.log.ref) writeFileSync(packet.log.ref, packet.log.content);
  const sessionIds = new Set<string>();
  try {
    for (const variant of ["full", "concise"]) {
      for (const packet of packets) {
        const original = JSON.stringify(packet);
        const definition = await buildAgentDefinition({
          config: {
            name: "worker",
            description: "Fixture",
            domain: "test",
            tools: [],
            model: "fixture",
            ...(variant === "concise" ? { contextPreparation: "./context.ts" } : {}),
          },
          source: { name: "worker", dir: agentDir, agentsRoot: dirname(agentDir), relativeDir: "agents/worker" },
          model: fakeModel(),
          tools: [],
          projectRoot: root,
          sharedRoot: join(root, "shared"),
          globalAgentsRoot: dirname(agentDir),
        });
        // Recreate the executor between attempts: the context adapter has no
        // hidden cross-attempt state and does not select an earlier result.
        const persistDir = join(root, "state", variant);
        let prompts = 0;
        const manager = new SubagentManager({
          projectRoot: root,
          persistDir,
          agentRunFactory: (config) =>
            createAgentRun({
              ...config,
              streamFn: (_model, context) => {
                prompts++;
                if (prompts === 2) {
                  const stream = createAssistantMessageEventStream();
                  stream.push({
                    type: "done",
                    reason: "toolUse",
                    message: usageReply({
                      stopReason: "toolUse",
                      content: [
                        {
                          type: "toolCall",
                          name: "finish",
                          id: "finish-corrective",
                          arguments: {
                            status: "success",
                            summary: `${packet.revision}: ${packet.findings.join(", ") || "clear"}`,
                            verification_facts: ["Read the supplied fixture."],
                          },
                        },
                      ],
                    }),
                  });
                  return stream;
                }
                const last = context.messages.at(-1)!;
                const text =
                  typeof last.content === "string"
                    ? last.content
                    : last.content.map((block: any) => block.text ?? "").join("");
                const supplied = JSON.parse(text);
                const expected = { ...packet, log: { ...packet.log } };
                if (variant === "concise" && packet.log.ref)
                  delete (expected.log as Partial<typeof expected.log>).content;
                expect(supplied).toEqual(expected);
                if (!supplied.log.content) expect(readFileSync(supplied.log.ref, "utf8")).toBe(packet.log.content);
                // The second model call returns the required finish. Metrics
                // must include this corrective work, not just the initial brief.
                const message = usageReply({ content: [{ type: "text", text: "Reviewed the current fixture." }] });
                const stream = createAssistantMessageEventStream();
                stream.push({ type: "done", reason: "stop", message });
                return stream;
              },
            }),
        });
        manager.register(definition);
        const runner = createWorkflowRunner({ manager, workflowDir: root, agentName: "worker" });
        const result = await runner.run("review", original);
        expect(result).toMatchObject({
          type: "done",
          summary: `${packet.revision}: ${packet.findings.join(", ") || "clear"}`,
        });
        expect(prompts).toBe(2);
        if (result.type !== "done") throw new Error("Expected a completed fixture workflow");
        const output = result.output as { id: string };
        expect(sessionIds.has(output.id)).toBe(false);
        sessionIds.add(output.id);
        expect(readSessionMeta(persistDir, output.id)?.task).toBe(original);
        const observations = readContextUsage(getDb(persistDir), contextUsageQuery(new URLSearchParams()));
        const observation = observations.runs.find((row) => row.sessionId === output.id)!;
        expect(observation).toMatchObject({
          outcome: "done",
          preparer: variant === "full" ? "full" : "context.ts",
          usage: { totals: { replies: 2, input: 20, cacheRead: 200, cacheWrite: 40, output: 10 }, toolCalls: 1 },
        });
        expect(observation.usage.preparation.taskBytes).toBe(Buffer.byteLength(original));
        if (variant === "concise") expect(observation.entryHash).toMatch(/^[a-f0-9]{64}$/);
      }
    }
    expect(sessionIds.size).toBe(8);
  } finally {
    closeDb(join(root, "state", "full"));
    closeDb(join(root, "state", "concise"));
    rmSync(root, { recursive: true, force: true });
  }
});

test("new invocations keep their own usage across reused sessions and preparation failures are visible", async () => {
  const root = mkdtempSync(join(tmpdir(), "context-usage-manager-"));
  try {
    const makeManager = () =>
      new SubagentManager({
        projectRoot: root,
        persistDir: root,
        agentRunFactory: (config) =>
          createAgentRun({
            ...config,
            streamFn: () => {
              const stream = createAssistantMessageEventStream();
              stream.push({
                type: "done",
                reason: "stop",
                message: usageReply({ content: [{ type: "text", text: "done" }] }),
              });
              return stream;
            },
          }),
      });
    const definition = {
      name: "worker",
      description: "Fixture",
      domain: "test",
      tools: [],
      model: fakeModel(),
      systemPrompt: "Fixture",
    };
    for (let i = 0; i < 2; i++) {
      const manager = makeManager();
      manager.register(definition);
      const id = manager.run("worker", "Continue", {
        sessionId: "reused",
        resumeMessages: [
          usageReply({
            usage: { ...usageReply().usage, input: 999999 },
            content: [{ type: "text", text: "Past work" }],
          }),
        ],
      });
      expect((await manager.waitFor(id)).status).toBe("done");
      // Reading a completed result performs no new execution or accounting.
      expect((await manager.waitFor(id)).status).toBe("done");
    }
    const manager = makeManager();
    manager.register({
      ...definition,
      contextPreparation: () => {
        throw new Error("bad preparation");
      },
    });
    expect(() => manager.run("worker", "New work")).toThrow("bad preparation");
    const result = readContextUsage(getDb(root), contextUsageQuery(new URLSearchParams()));
    expect(result.invocations).toBe(3);
    expect(result.groups.find((group) => group.outcome === "done")).toMatchObject({
      invocations: 2,
      input: 20,
      measuredReplies: 2,
      cacheRead: 200,
      meanInput: 10,
    });
    expect(result.groups.find((group) => group.outcome === "preparation-error")).toMatchObject({
      invocations: 1,
      preparer: "unidentified",
      replies: 0,
      meanInput: null,
      meanPromptBytes: null,
    });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("the sample policy preserves unknown input and a full brief without evidence access", () => {
  for (const task of [
    "plain instructions",
    "null",
    JSON.stringify({ contract: "next-version", log: { ref: "x", content: "keep" } }),
    JSON.stringify({ contract: "review-brief/v1", log: { content: "only copy of evidence" } }),
  ]) {
    expect(concise({ task })).toBe(task);
  }
});
