import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgentLocalTools } from "./agent-local-tools.ts";

describe("agent local tool loader", () => {
  it("imports runtime tool factories but ignores tests, specs, and declarations", async () => {
    const root = join(tmpdir(), `agent-local-tools-${Date.now()}-${crypto.randomUUID()}`);
    const agentDir = join(root, "agents", "scout");
    const toolsDir = join(agentDir, "tools");
    mkdirSync(toolsDir, { recursive: true });

    try {
      writeFileSync(join(toolsDir, "alpha.js"), 'export default () => ({ name: "alpha" });');
      writeFileSync(join(toolsDir, "beta.ts"), 'export default () => ({ name: "beta" });');
      writeFileSync(join(toolsDir, "alpha.test.ts"), 'throw new Error("loaded test module");');
      writeFileSync(join(toolsDir, "beta.spec.js"), 'throw new Error("loaded spec module");');
      writeFileSync(join(toolsDir, "types.d.ts"), "export type Example = string;");

      const notices: string[] = [];
      const loaded: string[] = [];
      const tools = await loadAgentLocalTools("scout", agentDir, {
        projectRoot: root,
        persistDir: join(root, ".state"),
        onNotice: (notice) => notices.push(notice),
        onLoaded: (name) => loaded.push(name),
      });

      expect(tools.map((tool) => tool.name)).toEqual(["alpha", "beta"]);
      expect(loaded).toEqual(["alpha", "beta"]);
      expect(notices).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
