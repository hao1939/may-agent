import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

function executableAksSurfaces(): string[] {
  const files = [join(root, "app.ts"), join(root, "task-loops.ts")];
  for (const directory of [join(root, "agents"), join(root, "scripts")]) {
    const visit = (current: string) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "workspace") visit(path);
          continue;
        }
        if (
          entry.isFile() &&
          path.endsWith(".ts") &&
          !path.endsWith(".test.ts")
        ) {
          files.push(path);
        }
      }
    };
    visit(directory);
  }
  return files;
}

describe("May Host authority boundary", () => {
  test("keeps the owner contract explicit about cross-App dependency routing", () => {
    const agents = readFileSync(join(root, "agents/app-ops/AGENTS.md"), "utf8");
    const design = readFileSync(join(root, "design/README.md"), "utf8");

    expect(agents).toContain(
      "An AKS task does not authorize a May Host deployment.",
    );
    expect(agents).toContain(
      "route a May Runtime source change or deployment to the\n    `may-agent` App",
    );
    expect(agents).toContain(
      "Never install `/usr/local/bin/may-agent`, invoke the May\n    deploy script with an AKS task",
    );
    expect(design).toContain(
      "AKS owns neither May Runtime source nor its deployment.",
    );
    expect(design).toContain(
      "A Runtime\nchange is a request to the `may-agent` App",
    );
  });

  test("keeps executable AKS callers free of direct May Runtime deployment primitives", () => {
    const prohibited = [
      ["scripts/", "deploy.sh"].join(""),
      ["may-agent-", "restarter"].join(""),
      ["/usr/local/bin/", "may-agent"].join(""),
      ["MAY_AGENT_", "DEPLOY_CORRELATION"].join(""),
    ];
    const violations = executableAksSurfaces().flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return prohibited
        .filter((token) => source.includes(token))
        .map((token) => `${relative(root, path)}:${token}`);
    });

    expect(violations).toEqual([]);
  });
});
