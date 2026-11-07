import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverAgentSkills, formatBoundedSkillCatalog, invokeCatalogSkill } from "./skills.js";
import { createModelRegistry } from "../app/model-registry.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("retains retired endpoint model identities and their protocol metadata", () => {
  const models = createModelRegistry({
    MODEL_BASE_URL: "https://gateway.example.test",
    MODEL_API_KEY: "synthetic-key",
  });
  for (const id of ["gpt-5.4", "gpt-5.5", "claude-opus-4.7"]) {
    expect(models[id]).toMatchObject({
      id,
      provider: "github-copilot",
      api: id.startsWith("gpt") ? "openai-responses" : "anthropic-messages",
      input: ["text", "image"],
      maxTokens: id.startsWith("gpt") ? 128_000 : 32_000,
      baseUrl: "https://gateway.example.test",
      apiKey: "synthetic-key",
    });
  }
  expect(models["gpt-5.4"]?.compat).toMatchObject({ supportsStrictMode: true });
  expect(models["claude-opus-4.7"]?.compat).toMatchObject({ forceAdaptiveThinking: true, supportsTemperature: false });
});

it("keeps explicit-only skill bodies available without exposing them in the catalog", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-pi-skills-"));
  roots.push(root);
  const dir = join(root, "skills", "manual-review");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    "\uFEFF---\nname: manual-review\ndescription: >\n  Review on explicit request.\ndisable-model-invocation: true\n---\n\nPrivate method body.\n",
  );
  const catalog = await discoverAgentSkills({ agentDir: root });
  expect(catalog.diagnostics).toEqual([]);
  expect(formatBoundedSkillCatalog(catalog).text).not.toContain("manual-review");
  const { prompt } = invokeCatalogSkill(catalog, "manual-review", "Inspect this change.");
  expect(prompt).toContain("Private method body.");
  expect(prompt).toContain("Inspect this change.");
  expect(prompt).not.toContain("disable-model-invocation:");
});
