import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, type SubagentDefinition } from "@may-agent/sdk/runtime";
import type { SubagentManager } from "./manager.js";
import { createWorkflowRunner } from "./workflow-tool.js";
import { fakeModel } from "../../test/fixtures/model.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each([undefined, null, false, 0, { ref: "change-123", note: "First line\n第二行", enabled: false }])(
  "Host and standalone prepare the same prompt-helper assignment for data %j",
  async (data: unknown) => {
    const root = mkdtempSync(join(tmpdir(), "workflow-input-parity-"));
    roots.push(root);
    const appDir = join(root, "projects", "sample.app");
    const definitions = new Map<string, SubagentDefinition>();
    for (const name of ["owner", "reviewer"]) {
      const agentDir = join(appDir, "agents", name);
      mkdirSync(join(agentDir, "workflows"), { recursive: true });
      writeFileSync(
        join(agentDir, "agent.json"),
        JSON.stringify({
          name,
          description: `${name} fixture`,
          domain: "test",
          model: "test",
          tools: ["finish"],
        }),
      );
      writeFileSync(join(agentDir, "AGENTS.md"), "Inspect the supplied assignment.\n");
      definitions.set(`sample/${name}`, {
        name,
        description: `${name} fixture`,
        domain: "test",
        model: fakeModel(),
        tools: [],
        agentDir,
        appLocal: true,
        projectId: "sample",
      });
    }
    writeFileSync(join(appDir, "app.ts"), 'export default { id: "sample" };\n');
    const workflowDir = join(appDir, "agents", "owner", "workflows");
    writeFileSync(
      join(workflowDir, "review.ts"),
      `
export const name = "review";
export const description = "Review one supplied assignment";
export const readonly = true;
const schema = {
  type: "object", properties: { receivedPrompt: { type: "string" } },
  required: ["receivedPrompt"], additionalProperties: false,
};
export async function execute(ctx) {
  const targets = ctx.list().map(target => target.name);
  const review = await ctx.call("sample/reviewer", ctx.input, { schema, timeoutMs: 1000 });
  return ctx.done("Review contribution returned", { targets, status: review.status, review: review.output });
}
`,
    );
    const input = { prompt: "Inspect the supplied change.\nKeep its scope.", ...(data === undefined ? {} : { data }) };
    let hostedPrompt: string | undefined;
    let hostedControl:
      | { outputSchema?: unknown; timeout?: number; deadlineAt?: number; signal?: AbortSignal; toolPolicy?: string }
      | undefined;
    const manager = {
      callAgentDefinition: async (
        _definition: SubagentDefinition,
        prompt: string,
        options: NonNullable<typeof hostedControl>,
      ) => {
        hostedPrompt = prompt;
        hostedControl = options;
        return {
          sessionId: "hosted-child",
          status: "done",
          messages: [],
          finishResult: { status: "done", summary: "Reviewed", output: { receivedPrompt: prompt } },
        };
      },
    } as unknown as SubagentManager;
    const hosted = await createWorkflowRunner({
      manager,
      agentDefinitions: definitions,
      agentName: "owner",
      projectId: "sample",
      workflowDir,
      workflowInput: input,
    }).run("review", input.prompt);

    let standalonePrompt: string | undefined;
    let standaloneSchema: unknown;
    let standaloneTimeout: number | undefined;
    let standaloneReadonly: string | undefined;
    const standalone = await run("sample/review", input, {
      projectRoot: root,
      cwd: root,
      models: {},
      agentFixtures: {
        "sample/reviewer": (call) => {
          standalonePrompt = call.task;
          standaloneSchema = call.options?.schema;
          standaloneTimeout = call.timeoutMs;
          // The fixture receives inherited kernel controls alongside its public fields.
          standaloneReadonly = (call as typeof call & { tools?: string }).tools;
          expect(call.signal.aborted).toBe(false);
          return {
            id: "standalone-child",
            kind: "agent",
            status: "done",
            summary: "Reviewed",
            output: { receivedPrompt: call.task },
            cleanupConfirmed: true,
          };
        },
      },
    });

    expect(hosted.type).toBe("done");
    expect(standalone.status).toBe("done");
    expect(hostedPrompt).toBe(standalonePrompt);
    expect(hosted.output).toEqual(standalone.output);
    expect(hostedControl?.outputSchema).toEqual(standaloneSchema);
    expect(hostedControl?.toolPolicy).toBe("readonly");
    expect(standaloneReadonly).toBe("readonly");
    expect(hostedControl?.timeout).toBeGreaterThan(0);
    expect(hostedControl?.timeout).toBeLessThanOrEqual(1000);
    expect(standaloneTimeout).toBeGreaterThan(0);
    expect(standaloneTimeout).toBeLessThanOrEqual(1000);
  },
);
