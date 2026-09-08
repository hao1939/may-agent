import { afterEach, describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const script = fileURLToPath(new URL("ci-container-needed.sh", import.meta.url));
const exec = promisify(execFile);
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function needed(...paths: string[]): string {
  const result = Bun.spawnSync(["bash", script], {
    stdin: Buffer.from(paths.map((path) => `${path}\0`).join("")),
  });
  expect(result.exitCode).toBe(0);
  return result.stdout.toString().trim();
}

describe("container change selection", () => {
  for (const runtimeChange of [false, true]) {
    it(`compares the whole PR in a shallow merge after main advances (runtime=${runtimeChange})`, async () => {
      const root = mkdtempSync(join(tmpdir(), "may-ci-diff-"));
      roots.push(root);
      const repo = join(root, "repo");
      const git = async (cwd: string, ...args: string[]) =>
        (await exec("git", ["-C", cwd, ...args], { timeout: 10_000 })).stdout.trim();
      await git(root, "init", "-b", "main", repo);
      await git(repo, "config", "user.name", "Test");
      await git(repo, "config", "user.email", "test@example.com");
      for (const dir of ["scripts", "src", "docs"]) mkdirSync(join(repo, dir));
      writeFileSync(join(repo, "scripts/ci-container-needed.sh"), readFileSync(script));
      writeFileSync(join(repo, "src/removed.ts"), "original runtime\n");
      await git(repo, "add", ".");
      await git(repo, "commit", "-m", "original base");
      const eventBase = await git(repo, "rev-parse", "HEAD");
      await git(repo, "switch", "-c", "pr");
      if (runtimeChange) rmSync(join(repo, "src/removed.ts"));
      writeFileSync(join(repo, "docs/guide.md"), "PR documentation\n");
      await git(repo, "add", ".");
      await git(repo, "commit", "-m", "first PR change");
      writeFileSync(join(repo, "docs/guide.md"), "later documentation-only edit\n");
      await git(repo, "commit", "-am", "second PR change");
      await git(repo, "switch", "main");
      writeFileSync(join(repo, "src/upstream.ts"), "unrelated main change\n");
      await git(repo, "add", ".");
      await git(repo, "commit", "-m", "main advances");
      await git(repo, "merge", "--no-ff", "pr", "-m", "synthetic PR merge");
      const checkout = join(root, "checkout");
      await git(root, "clone", "--depth", "2", pathToFileURL(repo).href, checkout);
      await expect(git(checkout, "cat-file", "-e", eventBase)).rejects.toThrow();

      // Execute the actual workflow command, not a second implementation.
      const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
      expect(workflow).toContain("fetch-depth: 2");
      const selection = workflow.match(/needed=\$\((git diff .+)\)/)?.[1];
      expect(selection).toBeDefined();
      const result = await exec("bash", ["-e", "-o", "pipefail", "-c", selection!], {
        cwd: checkout, timeout: 10_000, env: { ...process.env, BASE_SHA: eventBase },
      });
      expect(result.stdout.trim()).toBe(String(runtimeChange));
    });
  }

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
