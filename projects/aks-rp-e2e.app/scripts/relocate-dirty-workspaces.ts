import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  preserveDirtyWorkspace,
  requireExactPreservation,
} from "./lib/dirty-workspace-preservation.ts";
import {
  acquireCanonicalMutationLease,
  requiredMutationHolder,
} from "./lib/canonical-mutation-lease.ts";

type InventoryRow = {
  path: string;
  head: string;
  canonical: boolean;
  dirty: boolean | null;
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

function safePart(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "workspace"
  );
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
    join(appDir, "evidence/ops/task-workspace-dirty-relocation-20260721.json"),
);
const recoveryRoot = resolve(
  process.env.AKS_RECOVERY_WORKTREE_ROOT ||
    "/app/worktrees/aks-rp-e2e/recovery",
);
const preservationRoot = resolve(
  process.env.AKS_DIRTY_PRESERVATION_ROOT ||
    "/app/worktrees/aks-rp-e2e/preserved-dirty-bytes",
);
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as {
  rows: InventoryRow[];
};
const taskState = JSON.parse(
  readFileSync(join(appDir, ".state/tasks/state.json"), "utf8"),
);
if (taskState.project_lifecycle !== "paused")
  throw new Error("AKS project must remain paused during relocation");
mkdirSync(recoveryRoot, { recursive: true });

const candidates = inventory.rows
  .filter((row) => !row.canonical && row.dirty && existsSync(row.path))
  .sort((left, right) => right.path.length - left.path.length);
const results: Array<Record<string, unknown>> = [];
for (const row of candidates) {
  const hash = createHash("sha256").update(row.path).digest("hex").slice(0, 10);
  const destination = join(
    recoveryRoot,
    `${safePart(basename(row.path))}-${hash}`,
  );
  try {
    if (existsSync(destination))
      throw new Error(`destination already exists: ${destination}`);
    const head = git(row.path, ["rev-parse", "HEAD"]).stdout;
    if (head !== row.head)
      throw new Error(`HEAD changed from ${row.head} to ${head}`);
    const status = git(row.path, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).stdout;
    if (!status)
      throw new Error(
        "worktree is no longer dirty; rerun inventory before relocating it",
      );
    const snapshot = preserveDirtyWorkspace({
      workspacePath: row.path,
      artifactRoot: preservationRoot,
      snapshotId: `${safePart(basename(row.path))}-${hash}-${head.slice(0, 12)}-${Date.now()}`,
    });
    const preservationReceipt = requireExactPreservation(snapshot.snapshotDir);
    lease.mutate(`relocate dirty worktree ${row.path}`, () =>
      git(repoDir, ["worktree", "move", row.path, destination]),
    );
    results.push({
      oldPath: row.path,
      newPath: destination,
      head,
      status: "relocated",
      preservation: {
        snapshotDir: snapshot.snapshotDir,
        aggregateFingerprint: preservationReceipt.aggregateFingerprint,
        trackedPatchSha256: preservationReceipt.trackedPatch.sha256,
        exactPreservation: preservationReceipt.exactPreservation,
      },
    });
  } catch (error) {
    results.push({
      oldPath: row.path,
      newPath: destination,
      head: row.head,
      status: "retained-in-place",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      inventoryPath,
      recoveryRoot,
      preservationRoot,
      counts: {
        candidates: candidates.length,
        relocated: results.filter((row) => row.status === "relocated").length,
        retainedInPlace: results.filter(
          (row) => row.status === "retained-in-place",
        ).length,
      },
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(readFileSync(outputPath, "utf8").slice(0, 800));
