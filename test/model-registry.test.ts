import { describe, expect, it } from "vitest";
import { createModelRegistry } from "../src/app/model-registry.js";

describe("model registry", () => {
  it("routes proxy models through the configured LiteLLM endpoint", () => {
    const registry = createModelRegistry({
      MODEL_BASE_URL: "http://litellm:4000",
      LITELLM_API_KEY: "proxy-key",
    });

    expect(registry.anthropicDirect).toBe(false);
    expect(registry.modelBaseUrl).toBe("http://litellm:4000");
    expect(registry.apiKey).toBe("proxy-key");
    expect(registry.models["gpt-5.4"]?.baseUrl).toBe("http://litellm:4000");
    expect(registry.models["gpt-5.4"]?.apiKey).toBe("proxy-key");
    expect(registry.models["opus-4.7"]?.id).toBe("claude-opus-4.7");
  });

  it("routes opus directly to Anthropic when an Anthropic key is configured", () => {
    const registry = createModelRegistry({
      MODEL_BASE_URL: "http://litellm:4000",
      ANTHROPIC_API_KEY: "anthropic-key",
    });

    expect(registry.anthropicDirect).toBe(true);
    expect(registry.apiKey).toBe("anthropic-key");
    expect(registry.models.opus?.baseUrl).toBe("https://api.anthropic.com");
    expect(registry.models.opus?.apiKey).toBe("anthropic-key");
    expect(registry.models.opus?.contextWindow).toBe(200000);
    expect(registry.models["gpt-5.5"]?.baseUrl).toBe("http://litellm:4000");
  });
});
