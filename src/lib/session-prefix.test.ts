import { describe, it, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { SubagentManager } from "./manager.js";
import { fakeModel } from "../../test/fixtures/model.js";

describe("session ID prefix", () => {
  it("uses default 's' prefix when sessionIdPrefix is not set", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "default-agent",
      description: "Agent with default prefix",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
    });

    const sessionId = manager.run("default-agent", "do something");
    expect(sessionId).toMatch(/^s_\d+_[0-9a-f-]{36}$/);
  });

  it("uses custom prefix when sessionIdPrefix is set", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "custom-agent",
      description: "Agent with custom prefix",
      domain: "test",
      systemPrompt: "You are a test agent.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      sessionIdPrefix: "custom",
    });

    const sessionId = manager.run("custom-agent", "do something");
    expect(sessionId).toMatch(/^custom_\d+_[0-9a-f-]{36}$/);
  });

  it("different agents can have different prefixes", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    manager.register({
      name: "coder",
      description: "Coder agent",
      domain: "dev",
      systemPrompt: "You code.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      sessionIdPrefix: "coder",
    });
    manager.register({
      name: "reviewer",
      description: "Reviewer agent",
      domain: "dev",
      systemPrompt: "You review.",
      model: fakeModel(),
      tools: [],
      apiKey: "fake-key",
      sessionIdPrefix: "rev",
    });

    const coderId = manager.run("coder", "write code");
    const reviewerId = manager.run("reviewer", "review code");

    expect(coderId).toMatch(/^coder_\d+_[0-9a-f-]{36}$/);
    expect(reviewerId).toMatch(/^rev_\d+_[0-9a-f-]{36}$/);
  });
});
