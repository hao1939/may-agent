import { describe, expect, it } from "bun:test";
import { createModelRegistry } from "./model-registry.js";

describe("model registry", () => {
  it("routes models through the configured endpoint with canonical model names", () => {
    const registry = createModelRegistry({
      MODEL_BASE_URL: "http://model-endpoint:4000",
      MODEL_API_KEY: "endpoint-key",
    });

    expect(registry.anthropicDirect).toBe(false);
    expect(registry.baseUrl).toBe("http://model-endpoint:4000");
    expect(registry.apiKey).toBe("endpoint-key");
    expect(registry.models["gpt-5.4"]?.baseUrl).toBe("http://model-endpoint:4000");
    expect(registry.models["gpt-5.4"]?.apiKey).toBe("endpoint-key");
    expect(registry.models["claude-opus-4-6"]?.id).toBe("claude-opus-4-6");
    expect(registry.models["claude-opus-4-6"]?.contextWindow).toBe(72_000);
    expect(registry.models["gpt-5.2"]?.contextWindow).toBe(400_000);
    expect(registry.models["gpt-5.4"]?.contextWindow).toBe(400_000);
    expect(registry.models["gpt-5.5"]?.contextWindow).toBe(400_000);
    expect(registry.models["claude-opus-4.7"]?.contextWindow).toBe(200_000);
    expect(registry.models["gemini-3.1-pro-preview"]?.contextWindow).toBe(200_000);
    expect(registry.models["claude-opus-4.7"]?.id).toBe("claude-opus-4.7");
    for (const [name, model] of Object.entries(registry.models)) expect(name).toBe(model.id);
  });

  it("accepts the legacy LiteLLM key variable during deployment migration", () => {
    const registry = createModelRegistry({ LITELLM_API_KEY: "legacy-key" });

    expect(registry.apiKey).toBe("legacy-key");
  });

  it("routes opus directly to Anthropic when an Anthropic key is configured", () => {
    const registry = createModelRegistry({
      MODEL_BASE_URL: "http://model-endpoint:4000",
      ANTHROPIC_API_KEY: "anthropic-key",
    });

    expect(registry.anthropicDirect).toBe(true);
    expect(registry.apiKey).toBe("anthropic-key");
    expect(registry.models["claude-opus-4-6"]?.baseUrl).toBe("https://api.anthropic.com");
    expect(registry.models["claude-opus-4-6"]?.apiKey).toBe("anthropic-key");
    expect(registry.models["claude-opus-4-6"]?.id).toBe("claude-opus-4-6");
    expect(registry.models["claude-opus-4-6"]?.contextWindow).toBe(200_000);
    expect(registry.models["gpt-5.5"]?.baseUrl).toBe("http://model-endpoint:4000");
  });
});
