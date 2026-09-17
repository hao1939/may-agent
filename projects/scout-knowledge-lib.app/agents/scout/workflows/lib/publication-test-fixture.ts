import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Small, real repositories keep workflow tests independent of the live library. */
export function publicationTestFixture() {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "scout-workflow-git-"));
  const projectRoot = join(repositoryRoot, "projects/scout-knowledge-lib");
  const appRoot = join(repositoryRoot, "projects/scout-knowledge-lib.app");
  mkdirSync(join(projectRoot, "knowledge"), { recursive: true });
  mkdirSync(join(appRoot, "agents/scout/workspace"), { recursive: true });
  writeFileSync(join(projectRoot, "knowledge/README.md"), "# Knowledge\n");
  writeFileSync(
    join(repositoryRoot, ".gitignore"),
    "artifacts/\n**/agents/scout/workspace/\n",
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Workflow test");
  git("config", "user.email", "test@example.invalid");
  git("add", ".");
  git("commit", "-m", "fixture");
  return {
    repositoryRoot,
    git,
    workspace: {
      root: projectRoot,
      projectRoot,
      appRoot,
      output: join(repositoryRoot, "artifacts"),
    },
  };
}
