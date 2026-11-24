import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runDelegationRecoveryEpisode, workerProgram } from "./lib/delegation-recovery.js";

// Script only model decisions; daemon, tools, processes, durable state and
// service effects remain real. The App experiment reuses this driver with models.
test("delegated publication survives lost acknowledgment while caller accepts independent work", async () => {
  const requests: Array<{ appId: string; attemptId: string }> = [];
  const provider = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 120,
    async fetch(request) {
      try {
        const payload = (await request.json()) as any;
        const texts = payload.messages.flatMap((m: any) =>
          typeof m.content === "string" ? [m.content] : (m.content ?? []).map((b: any) => b.text ?? ""),
        );
        const text = texts.find((t: string) => t.startsWith("Task decision brief (source data)."));
        assert(text, "Common Task decision brief required");
        const preview = JSON.parse(text.slice(text.indexOf('\n{"binding":') + 1));
        const brief = JSON.parse(readFileSync(preview.coverage.detail, "utf8"));
        const events = brief.events.attemptInput;
        requests.push(brief.binding);
        assert(requests.length <= 14, "Unexpected model loop");
        const inputs = (events.inputs ?? []).map((input: any) => input.key);
        const hasToolResult = payload.messages.some((m: any) => m.role === "tool");
        let name = "finish",
          args: any;
        let result: any;
        if (brief.binding.appId === "repair") {
          if (!hasToolResult) {
            name = "bash";
            args = { command: "node -e '" + workerProgram.replaceAll("'", "'\\''") + "'" };
          } else {
            const workspace = brief.environment.paths.workspaceDir;
            const receipt = JSON.parse(readFileSync(workspace + "/publication.json", "utf8"));
            result = {
              state: "converged",
              summary: "Verified exact committed preview publication",
              inputKeys: inputs,
              facts: ["original checker passed", "receipt read back"],
              result: { receipt },
            };
          }
        } else if (inputs.includes("task:note")) {
          if (!hasToolResult) {
            name = "bash";
            args = { command: "printf 'Approved companion note.\\n' > notes.txt" };
          } else
            result = {
              state: "converged",
              summary: "Approved note written; original repair remains pending",
              inputKeys: ["task:note"],
              facts: ["independent approved note completed"],
            };
        } else {
          const returned = events.items.find(
            (item: any) => item.event.type === "app.dependency.updated" && item.event.data.status === "done",
          );
          if (returned) {
            const receipt = returned.event.data.result.receipt;
            assert.equal(receipt.id, "preview-receipt-1");
            if (!hasToolResult) {
              name = "bash";
              args = {
                command:
                  'node -e \'const fs=require("node:fs");const {service}=JSON.parse(fs.readFileSync("request.json","utf8"));fetch(service+"/receipt?reader=owner").then(r=>r.json()).then(console.log)\'',
              };
            } else
              result = {
                state: "converged",
                summary: "Verified delegated preview and returned original outcome",
                inputKeys: inputs,
                facts: ["exact dependency result returned"],
                result: { receipt },
              };
          } else
            result = {
              state: "waiting",
              summary: "Await delegated preview publication",
              facts: [],
              requests: [
                {
                  id: "repair",
                  appId: "repair",
                  input: {
                    kind: "repair",
                    data: {
                      message:
                        "Complete the preview requirement in request.json; publication is authorized and must happen once.",
                    },
                  },
                },
              ],
              conditions: [{ requestId: "repair" }],
            };
        }
        args ??= { status: "done", summary: result.summary, output: result };
        const chunk = (delta: any, finish_reason: string | null) =>
          `data: ${JSON.stringify({ id: "fixture-reply", object: "chat.completion.chunk", created: 0, model: "test", choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
        return new Response(
          chunk(
            {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `call-${requests.length}`,
                  type: "function",
                  function: { name, arguments: JSON.stringify(args) },
                },
              ],
            },
            null,
          ) +
            chunk({}, "tool_calls") +
            "data: [DONE]\n\n",
          { headers: { "content-type": "text/event-stream" } },
        );
      } catch (error) {
        console.error(error);
        return new Response(String(error), { status: 500 });
      }
    },
  });
  try {
    const report = await runDelegationRecoveryEpisode({
      env: { MODEL_BASE_URL: `http://127.0.0.1:${provider.port}`, MODEL_API_KEY: "fixture-key" },
      timeoutMs: 45_000,
      maxSessions: 6,
      evidenceDir: process.env.MAY_TEST_EPISODE_OUTPUT,
    });
    expect(report.passed).toBe(true);
    expect(report.publicationAttempts).toBe(1);
    expect(report.finalOwner.task.metadata.generation).toBe(1);
    expect(report.finalWorker.task.metadata.generation).toBe(1);
    expect(report.sessions).toHaveLength(5);
    expect(report.milestones.map((m: any) => m.kind)).toEqual([
      "publication-committed-ack-held",
      "approved-note-accepted-original-wait-retained",
      "fixture-crashed",
      "original-caller-accepted-verified-return",
    ]);
  } finally {
    provider.stop(true);
  }
}, 60_000);
