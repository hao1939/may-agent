import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "../../test/fixtures/model.js";
import { SubagentManager } from "./manager.js";
import { closeDb } from "./requests.js";

describe("manager agent registry", () => {
  let root: string;
  let manager: SubagentManager;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "manager-registry-"));
    manager = new SubagentManager({ persistDir: root });
  });
  afterEach(() => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
  const definition = (name: string) => ({
    name,
    description: name,
    domain: "test",
    systemPrompt: "Test",
    model: fakeModel(),
    tools: [],
  });

  it("counts and finds registered agents without duplicating replacements", () => {
    expect(manager.agentCount()).toBe(0);
    expect(manager.hasAgent("alpha")).toBe(false);
    for (const [index, name] of ["alpha", "beta", "gamma"].entries()) {
      manager.register(definition(name));
      expect(manager.hasAgent(name)).toBe(true);
      expect(manager.agentCount()).toBe(index + 1);
    }
    manager.register({ ...definition("alpha"), description: "Updated" });
    expect(manager.agentCount()).toBe(3);
    expect(manager.hasAgent("alpha")).toBe(true);
    expect(manager.hasAgent("missing")).toBe(false);
    expect(manager.listAgents().find((agent) => agent.name === "alpha")?.description).toBe("Updated");
  });

  it("returns knowledge paths only when the registered definition has one", () => {
    expect(manager.getKnowledgePath("alpha")).toBeUndefined();
    manager.register({ ...definition("alpha"), knowledgeDir: join(root, "knowledge") });
    expect(manager.getKnowledgePath("alpha")).toBe(join(root, "knowledge"));
    manager.register(definition("alpha"));
    expect(manager.getKnowledgePath("alpha")).toBeUndefined();
  });
});
