import { describe, expect, it } from "bun:test";
import { streamSimple } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { createModelRegistry } from "./model-registry.js";

describe("model registry", () => {
  it("routes models through the configured endpoint with canonical model names", () => {
    const registry = createModelRegistry({
      MODEL_BASE_URL: "http://model-endpoint:4000",
      MODEL_API_KEY: "endpoint-key",
    });

    expect(registry["gpt-5.6-sol"]?.baseUrl).toBe("http://model-endpoint:4000");
    expect(registry["gpt-5.6-sol"]?.apiKey).toBe("endpoint-key");
    expect(registry["claude-opus-5"]?.id).toBe("claude-opus-5");
    expect(registry["claude-opus-5"]?.contextWindow).toBe(200_000);
    expect(registry["gpt-5.2"]).toBeUndefined();
    expect(registry["kimi-k2.5"]).toBeUndefined();
    expect(registry["gpt-5.4"]?.contextWindow).toBe(400_000);
    expect(registry["gpt-5.5"]?.contextWindow).toBe(400_000);
    expect(registry["gpt-5.6-sol"]?.contextWindow).toBe(400_000);
    expect(registry["claude-opus-4.7"]?.contextWindow).toBe(200_000);
    expect(registry["gemini-3.1-pro-preview"]).toMatchObject({
      id: "gemini-3.1-pro-preview",
      api: "openai-completions",
      provider: "github-copilot",
      baseUrl: "http://model-endpoint:4000",
      apiKey: "endpoint-key",
      contextWindow: 200_000,
      maxTokens: 64_000,
      reasoning: true,
      input: ["text", "image"],
      compat: { supportsStore: false, supportsDeveloperRole: false, supportsReasoningEffort: false },
    });
    expect(registry["claude-opus-4.7"]?.id).toBe("claude-opus-4.7");
    for (const [name, model] of Object.entries(registry)) expect(name).toBe(model.id);
  });

  it("uses local no-auth endpoint defaults", () => {
    const registry = createModelRegistry({});

    expect(registry["gpt-5.6-sol"]?.baseUrl).toBe("http://localhost:4000");
    expect(registry["claude-opus-5"]?.apiKey).toBe("not-needed");
  });

  it("preserves optional tool fields in configured Responses requests", async () => {
    const registry = createModelRegistry({ MODEL_BASE_URL: "http://127.0.0.1:9" });
    const parameters = Type.Object({
      result: Type.Union([
        Type.Object({
          decision: Type.Literal("prepared"),
          spec: Type.String(),
          native: Type.Optional(Type.Literal(true)),
          retry: Type.Optional(Type.Object({ afterRunId: Type.Integer({ minimum: 1 }) })),
        }),
        Type.Object({ decision: Type.Literal("blocked"), reason: Type.String() }),
      ]),
    });
    for (const name of ["gpt-5.4", "gpt-5.5", "gpt-5.6-sol"]) {
      let payload: unknown;
      const model = registry[name]!;
      const response = streamSimple(
        model,
        {
          messages: [{ role: "user", content: "Return one selection with no native route or retry.", timestamp: 0 }],
          tools: [{ name: "finish", description: "Return the step result.", parameters }],
        },
        {
          apiKey: "synthetic-unused",
          onPayload(value) {
            payload = value;
            // Exercise the real provider serialization without a model, network
            // request, credentials or simulated successful model result.
            throw new Error("payload-captured-no-network");
          },
        },
      );
      const result = await response.result();
      expect(result.stopReason).toBe("error");
      expect(result.errorMessage).toContain("payload-captured-no-network");
      expect(payload).toMatchObject({
        tools: [{ type: "function", name: "finish", strict: false, parameters }],
      });
    }
  });
});
