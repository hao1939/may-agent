import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const allowedTopLevelProjects = new Set([
  "_archive",
  "aks-rp-e2e",
  "aks-rp-e2e.app",
  "may-agent",
  "may-agent.app",
  "scout-knowledge-lib",
  "scout-knowledge-lib.app",
]);

describe("/app/projects layout", () => {
  it("does not contain ambiguous top-level project folders", () => {
    const projectsRoot = join(process.cwd(), "projects");
    const actual = readdirSync(projectsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const unexpected = actual.filter((name) => !allowedTopLevelProjects.has(name));

    expect(unexpected).toEqual([]);
  });
});
