import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildAgentDefinition,
  createCodingTools,
  createFinishTool,
  run,
  type AgentConfig,
  type ModelWithApiKey,
  type SubagentDefinition,
} from "@may-agent/sdk/runtime";
import { closeDb } from "../../src/lib/db/connection.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";

type ProviderRequest = {
  messages: Array<{ role: string; content?: unknown; tool_call_id?: string }>;
  tools: Array<{ type: string; function: { name: string; parameters: unknown } }>;
};

test("readonly helpers share real tools, prepared context and corrective finish feedback", async () => {
  const root = mkdtempSync(join(tmpdir(), "helper-model-parity-"));
  const persistDir = join(root, "host-state");
  const requests: Record<string, ProviderRequest[]> = { host: [], standalone: [] };
  const providerErrors: string[] = [];
  const server = createServer(async (request, response) => {
    try {
      const lane = request.url!.split("/")[1]!;
      if (!(lane in requests)) throw new Error("Unexpected provider path");
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      const payload = JSON.parse(body) as ProviderRequest;
      requests[lane]!.push(payload);
      const turn = requests[lane]!.length;
      if (turn > 3) throw new Error("Unexpected extra model request");
      const name = turn === 1 ? "read" : "finish";
      const args =
        turn === 1
          ? { path: "evidence.txt" }
          : { status: "done", summary: "Reviewed current evidence", output: { verdict: turn === 2 ? 42 : "accept" } };
      const chunk = (delta: unknown, finish: string | null) =>
        `data: ${JSON.stringify({
          id: `${lane}-${turn}`,
          object: "chat.completion.chunk",
          created: 0,
          model: "fixture",
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`;
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(
        chunk(
          {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: `call-${turn}`,
                type: "function",
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          },
          null,
        ) +
          chunk({}, "tool_calls") +
          "data: [DONE]\n\n",
      );
    } catch (error) {
      providerErrors.push(String(error));
      response.writeHead(400);
      response.end("Fixture protocol failure");
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const appDir = join(root, "projects", "sample.app");
    const agentsRoot = join(appDir, "agents");
    const sharedRoot = join(root, "shared");
    mkdirSync(sharedRoot, { recursive: true });
    writeFileSync(join(sharedRoot, "common-sense.md"), "Inspect evidence before returning a verdict.");
    writeFileSync(join(root, "evidence.txt"), "Current evidence: change-123 is ready for review.");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "app.ts"), 'export default { id: "sample" };');
    const model = (lane: string): ModelWithApiKey => ({
      id: "fixture",
      name: "Fixture",
      provider: "openai",
      api: "openai-completions",
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/${lane}`,
      apiKey: "fixture-only",
      reasoning: false,
      input: ["text"],
      contextWindow: 8192,
      maxTokens: 1024,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    });
    const definitions = new Map<string, SubagentDefinition>();
    for (const name of ["owner", "reviewer"]) {
      const agentDir = join(agentsRoot, name);
      mkdirSync(join(agentDir, "workflows"), { recursive: true });
      const config: AgentConfig = {
        name,
        description: "Review fixture",
        domain: "test",
        model: "fixture",
        tools: ["coding", "finish"],
        contextPreparation: "./context.ts",
      };
      writeFileSync(join(agentDir, "agent.json"), JSON.stringify(config));
      writeFileSync(join(agentDir, "AGENTS.md"), "Review only the supplied change. Correct rejected results.");
      writeFileSync(
        join(agentDir, "context.ts"),
        'export default ({ task }) => "Prepared review assignment:\\n" + task;',
      );
      definitions.set(
        `sample/${name}`,
        await buildAgentDefinition({
          config,
          source: {
            name,
            dir: agentDir,
            agentsRoot,
            projectId: "sample",
            relativeDir: `projects/sample.app/agents/${name}`,
          },
          model: model("host"),
          tools: [...createCodingTools(root), createFinishTool({ projectRoot: root })],
          projectRoot: root,
          sharedRoot,
          globalAgentsRoot: join(root, "agents"),
        }),
      );
    }
    const workflowDir = join(agentsRoot, "owner", "workflows");
    writeFileSync(
      join(workflowDir, "review.ts"),
      `
export const name = "review";
export const description = "Inspect a helper's real model boundary";
export const readonly = true;
export async function execute(ctx) {
  const child = await ctx.call("sample/reviewer", ctx.input, {
    timeoutMs: 10000,
    schema: { type: "object", properties: { verdict: { const: "accept" } }, required: ["verdict"], additionalProperties: false },
  });
  return ctx.done("Review returned", { status: child.status, output: child.output });
}
`,
    );
    const input = { prompt: "Inspect change-123", data: { ref: "change-123" } };
    const manager = new SubagentManager({ projectRoot: root, persistDir });
    for (const definition of definitions.values()) manager.register(definition);
    const hosted = await createWorkflowRunner({
      manager,
      agentDefinitions: definitions,
      projectId: "sample",
      agentName: "owner",
      workflowDir,
      workflowInput: input,
    }).run("review", input.prompt);
    const standalone = await run("sample/review", input, {
      projectRoot: root,
      cwd: root,
      models: { fixture: model("standalone") },
    });

    expect(providerErrors).toEqual([]);
    expect(hosted).toMatchObject({ type: "done", output: { status: "done", output: { verdict: "accept" } } });
    expect(standalone).toMatchObject({ status: "done", output: hosted.output });
    expect(requests.host).toHaveLength(3);
    expect(requests.standalone).toHaveLength(3);
    const [hostFirst, , hostCorrective] = requests.host;
    const [directFirst, , directCorrective] = requests.standalone;
    expect(hostFirst!.tools).toEqual(directFirst!.tools);
    expect(hostFirst!.tools.map((tool) => tool.function.name)).toEqual(["read", "finish"]);
    expect(hostFirst!.messages.filter((message) => message.role === "user")).toEqual(
      directFirst!.messages.filter((message) => message.role === "user"),
    );
    expect(JSON.stringify(hostFirst!.messages)).toContain("Prepared review assignment:");
    const instructions = (request: ProviderRequest) => {
      const content = request.messages.find((message) => message.role === "system")?.content;
      expect(typeof content).toBe("string");
      const sections = [
        ...String(content).matchAll(/<(system_instructions|execution_instructions|completion)>[\s\S]*?<\/\1>/g),
      ];
      expect(sections).toHaveLength(3);
      return sections.map((section) =>
        section[0].replace(/Environment captured at: [^\n]+/, "Environment captured at: <time>"),
      );
    };
    expect(instructions(hostFirst!)).toEqual(instructions(directFirst!));
    expect(JSON.stringify(hostFirst!.messages)).toContain("Original assignment and caller links:");
    for (const messages of [hostCorrective!.messages, directCorrective!.messages]) {
      expect(messages.filter((message) => message.role === "tool" && message.tool_call_id === "call-1")).toHaveLength(
        1,
      );
      expect(JSON.stringify(messages.find((message) => message.tool_call_id === "call-1"))).toContain(
        "Current evidence: change-123 is ready for review.",
      );
    }
    const rejection = (request: ProviderRequest) =>
      request.messages.find((message) => message.tool_call_id === "call-2");
    expect(rejection(hostCorrective!)).toEqual(rejection(directCorrective!));
    expect(JSON.stringify(rejection(hostCorrective!))).toContain("supplied schema");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
