import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
  });
  const output = {
    status: result.status ?? 1,
    stdout: result.stdout?.trim() ?? "",
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!allowFailure && output.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd}: ${output.stderr || output.stdout}`,
    );
  }
  return output;
}

const appDir = resolve(import.meta.dir, "..");
const repoDir = resolve(appDir, "../aks-rp-e2e");
const recoveryRoot = resolve("/app/worktrees/aks-rp-e2e/recovery");
const quarantinePath = join(recoveryRoot, "canonical-root-quarantine-20260721");
const scratchPath = join(
  recoveryRoot,
  ".canonical-root-workspace-moving-20260721",
);
const outputPath = join(
  appDir,
  "evidence/ops/task-workspace-canonical-restoration-20260721.json",
);
const taskState = JSON.parse(
  readFileSync(join(appDir, ".state/tasks/state.json"), "utf8"),
);
if (taskState.project_lifecycle !== "paused")
  throw new Error("AKS project must remain paused during restoration");
if (existsSync(quarantinePath) || existsSync(scratchPath)) {
  throw new Error(
    `Quarantine destination already exists: ${existsSync(quarantinePath) ? quarantinePath : scratchPath}`,
  );
}

const sourceBranch = git(repoDir, ["branch", "--show-current"]).stdout;
const sourceHead = git(repoDir, ["rev-parse", "HEAD"]).stdout;
const baseCommit = git(repoDir, ["rev-parse", "origin/dev"]).stdout;
const beforeStatus = git(repoDir, [
  "status",
  "--porcelain=v1",
  "--untracked-files=all",
]).stdout;
if (!sourceBranch || sourceBranch === "dev")
  throw new Error(
    `Expected quarantined task branch, found ${sourceBranch || "detached"}`,
  );
if (!beforeStatus)
  throw new Error(
    "Canonical checkout is already clean; no quarantine migration is needed",
  );

const workspacePath = join(repoDir, "workspace");
if (existsSync(workspacePath)) renameSync(workspacePath, scratchPath);

git(repoDir, [
  "stash",
  "push",
  "--include-untracked",
  "-m",
  "task-workspace-root-quarantine-20260721",
]);
const stashCommit = git(repoDir, ["rev-parse", "refs/stash"]).stdout;
if (
  git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout
) {
  throw new Error(
    `Root remained dirty after creating recovery stash ${stashCommit}`,
  );
}

git(repoDir, ["switch", "dev"]);
git(repoDir, ["merge", "--ff-only", "origin/dev"]);
git(repoDir, ["worktree", "add", quarantinePath, sourceBranch]);
git(quarantinePath, ["stash", "apply", stashCommit]);
const quarantineStatus = git(quarantinePath, [
  "status",
  "--porcelain=v1",
  "--untracked-files=all",
]).stdout;
if (quarantineStatus !== beforeStatus) {
  throw new Error(
    `Quarantine status does not match the original root; recovery stash ${stashCommit} was retained`,
  );
}
if (existsSync(scratchPath))
  renameSync(scratchPath, join(quarantinePath, "workspace"));
if (git(repoDir, ["rev-parse", "refs/stash"]).stdout !== stashCommit) {
  throw new Error(
    `Another stash replaced ${stashCommit}; leaving it intact for recovery`,
  );
}
git(repoDir, ["stash", "drop", "stash@{0}"]);

const finalBranch = git(repoDir, ["branch", "--show-current"]).stdout;
const finalHead = git(repoDir, ["rev-parse", "HEAD"]).stdout;
const finalStatus = git(repoDir, [
  "status",
  "--porcelain=v1",
  "--untracked-files=all",
]).stdout;
if (finalBranch !== "dev" || finalHead !== baseCommit || finalStatus) {
  throw new Error(
    `Canonical verification failed: branch=${finalBranch}, head=${finalHead}, dirty=${Boolean(finalStatus)}`,
  );
}

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      canonical: {
        path: repoDir,
        branch: finalBranch,
        head: finalHead,
        clean: true,
      },
      quarantine: {
        path: quarantinePath,
        branch: sourceBranch,
        head: sourceHead,
        statusEntries: quarantineStatus.split("\n").filter(Boolean).length,
        scratchWorkspaceMoved: existsSync(join(quarantinePath, "workspace")),
      },
      recoveryStash: { commit: stashCommit, droppedAfterReadback: true },
    },
    null,
    2,
  )}\n`,
);
console.log(readFileSync(outputPath, "utf8"));
