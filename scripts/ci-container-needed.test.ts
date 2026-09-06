import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("ci-container-needed.sh", import.meta.url));

function needed(...paths: string[]): string {
  const result = Bun.spawnSync(["bash", script], {
    stdin: Buffer.from(paths.map((path) => `${path}\0`).join("")),
  });
  expect(result.exitCode).toBe(0);
  return result.stdout.toString().trim();
}

describe("container change selection", () => {
  it("skips documentation and portable-test-only changes", () => {
    expect(needed("README.md", "docs/guide.md", "src/app/path-roots.test.ts", "test/integration/example.ts"))
      .toBe("false");
  });

  it("builds for every runtime, dependency, image, or CI input", () => {
    for (const path of [
      "src/app/may.ts", "packages/sdk/src/index.ts", "packages/webui/static/index.html",
      "package.json", "bun.lock", ".bun-version", "tsconfig.json", ".dockerignore",
      "container/Dockerfile", "container/entrypoint.sh", "scripts/build-runtime-binary.ts",
      "scripts/ci-container-needed.sh", "scripts/ci-container-smoke.sh", ".github/workflows/ci.yml",
      "test/e2e/fixtures/agents/test/agent.json", "src/prompts/instructions.md", "new-build-input",
    ]) {
      expect(needed("README.md", path)).toBe("true");
    }
  });

  it("handles deleted/renamed inputs and whitespace without losing a build trigger", () => {
    // --no-renames supplies both old and new names, including deleted inputs.
    expect(needed("src/removed.ts", "docs/moved.md")).toBe("true");
    expect(needed("src/line\nbreak.ts", "docs/has spaces.md")).toBe("true");
    expect(needed("docs/has spaces.md")).toBe("false");
    expect(needed()).toBe("false");
  });
});
