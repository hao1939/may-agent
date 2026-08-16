import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  acquireCanonicalMutationLease,
  requiredMutationHolder,
} from "./lib/canonical-mutation-lease.ts";

type InventoryRow = {
  path: string;
  head: string;
  branch: string | null;
  dirty: boolean | null;
  reachableFromBase: boolean;
  remoteBranches: string[];
  proposedDisposition: string;
};

function git(
  cwd: string,
  args: string[],
  allowFailure = false,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
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

if (process.argv[2] === "--compact-receipt") {
  const path = resolve(
    process.argv[3] ||
      join(
        import.meta.dir,
        "../evidence/ops/task-workspace-migration-cleanup-20260721.json",
      ),
  );
  const receipt = JSON.parse(readFileSync(path, "utf8"));
  receipt.results = (receipt.results ?? []).map(
    (row: Record<string, unknown>) => {
      const remoteBranches = Array.isArray(row.remoteBranches)
        ? row.remoteBranches
        : [];
      const { remoteBranches: _omitted, ...bounded } = row;
      return {
        ...bounded,
        ...(remoteBranches.length
          ? {
              remoteBranchCount: remoteBranches.length,
              remoteBranchSample: remoteBranches.slice(0, 3),
            }
          : {}),
      };
    },
  );
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(path);
  process.exit(0);
}

const appDir = resolve(import.meta.dir, "..");
const repoDir = resolve(appDir, "../aks-rp-e2e");
const lease = acquireCanonicalMutationLease({
  projectId: "aks-rp-e2e",
  canonicalPath: repoDir,
  holder: requiredMutationHolder(),
  checkpointPath: join(appDir, ".state/checkpoints/canonical-mutations.jsonl"),
  fingerprint: () => ({
    head: git(repoDir, ["rev-parse", "HEAD"], true).stdout,
    status: git(
      repoDir,
      ["status", "--porcelain=v1", "--untracked-files=all"],
      true,
    ).stdout,
  }),
});
process.on("exit", () => lease.release());
const inventoryPath = resolve(
  process.argv[2] ||
    join(
      appDir,
      "evidence/ops/task-workspace-migration-inventory-20260721.json",
    ),
);
const outputPath = resolve(
  process.argv[3] ||
    join(appDir, "evidence/ops/task-workspace-migration-cleanup-20260721.json"),
);
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as {
  baseRef: string;
  baseCommit: string;
  rows: InventoryRow[];
};
const taskState = JSON.parse(
  readFileSync(join(appDir, ".state/tasks/state.json"), "utf8"),
);
if (taskState.project_lifecycle !== "paused") {
  throw new Error("AKS project must remain paused during workspace cleanup");
}
const currentBase = git(repoDir, ["rev-parse", inventory.baseRef]).stdout;
if (currentBase !== inventory.baseCommit) {
  throw new Error(
    `Inventory base moved from ${inventory.baseCommit} to ${currentBase}; rerun the audit`,
  );
}
const activeWorkspacePaths = new Set(
  Object.values(taskState.attempts ?? {}).flatMap((value: unknown) => {
    const attempt = value as {
      state?: unknown;
      workspace?: { path?: unknown };
    };
    return attempt.state === "running" &&
      typeof attempt.workspace?.path === "string"
      ? [resolve(attempt.workspace.path)]
      : [];
  }),
);
const safeDispositions = new Set([
  "remove-reachable-detached",
  "remove-merged-attached",
  "remove-worktree-retain-branch",
]);
const candidates = inventory.rows
  .filter((row) => safeDispositions.has(row.proposedDisposition))
  .sort((left, right) => right.path.length - left.path.length);
const results: Array<Record<string, unknown>> = [];

for (const row of candidates) {
  try {
    if (activeWorkspacePaths.has(resolve(row.path)))
      throw new Error("path belongs to an active structured task attempt");
    if (!existsSync(row.path)) {
      results.push({ path: row.path, status: "already-missing" });
      continue;
    }
    const currentHead = git(row.path, ["rev-parse", "HEAD"]).stdout;
    if (currentHead !== row.head)
      throw new Error(`HEAD changed from ${row.head} to ${currentHead}`);
    const status = git(row.path, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (status) throw new Error("worktree became dirty after inventory");

    let rescueBranch: string | null = null;
    if (
      !row.branch &&
      !row.reachableFromBase &&
      row.remoteBranches.length === 0
    ) {
      rescueBranch = `migration/rescue-${row.head.slice(0, 12)}`;
      const exists =
        git(
          repoDir,
          ["show-ref", "--verify", "--quiet", `refs/heads/${rescueBranch}`],
          true,
        ).status === 0;
      if (!exists)
        lease.mutate(`create rescue branch for ${row.path}`, () =>
          git(repoDir, ["branch", rescueBranch!, row.head]),
        );
    }
    lease.mutate(`remove worktree ${row.path}`, () =>
      git(repoDir, ["worktree", "remove", row.path]),
    );
    results.push({
      path: row.path,
      status: "removed",
      branch: row.branch,
      head: row.head,
      rescueBranch,
      remoteBranchCount: row.remoteBranches.length,
      remoteBranchSample: row.remoteBranches.slice(0, 3),
    });
  } catch (error) {
    results.push({
      path: row.path,
      status: "retained",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

lease.mutate("prune shared worktree metadata", () =>
  git(repoDir, ["worktree", "prune"]),
);
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      inventoryPath,
      baseRef: inventory.baseRef,
      baseCommit: inventory.baseCommit,
      counts: {
        candidates: candidates.length,
        removed: results.filter(
          (row) => row.status === "removed" || row.status === "already-missing",
        ).length,
        retained: results.filter((row) => row.status === "retained").length,
        rescueBranches: results.filter((row) => row.rescueBranch).length,
      },
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(readFileSync(outputPath, "utf8").slice(0, 800));
