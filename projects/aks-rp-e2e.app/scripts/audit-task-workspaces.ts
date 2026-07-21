import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type WorktreeEntry = {
  path: string;
  head: string;
  branch: string | null;
  prunable: boolean;
};

type InventoryRow = WorktreeEntry & {
  canonical: boolean;
  present: boolean;
  dirty: boolean | null;
  status: string[];
  reachableFromBase: boolean;
  remoteBranches: string[];
  liveTaskIds: string[];
  attemptIds: string[];
  activeAttemptIds: string[];
  receiptIds: string[];
  proposedDisposition:
    | "keep-canonical"
    | "prune-registration"
    | "remove-reachable-detached"
    | "remove-merged-attached"
    | "remove-worktree-retain-branch"
    | "manual-recovery";
};

function run(
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

function worktrees(repoDir: string): WorktreeEntry[] {
  const raw = run(repoDir, ["worktree", "list", "--porcelain"]).stdout;
  return raw.split(/\n\n+/).flatMap((block) => {
    const lines = block.split("\n");
    const path = lines.find((line) => line.startsWith("worktree "))?.slice(9);
    const head = lines.find((line) => line.startsWith("HEAD "))?.slice(5);
    if (!path || !head) return [];
    const branch =
      lines
        .find((line) => line.startsWith("branch "))
        ?.slice(7)
        .replace(/^refs\/heads\//, "") ?? null;
    return [
      {
        path: resolve(path),
        head,
        branch,
        prunable: lines.some((line) => line.startsWith("prunable")),
      },
    ];
  });
}

function taskLinkage(
  state: Record<string, Record<string, unknown>>,
  entry: WorktreeEntry,
): Pick<
  InventoryRow,
  "liveTaskIds" | "attemptIds" | "activeAttemptIds" | "receiptIds"
> {
  const needles = [entry.path, entry.branch].filter((value): value is string =>
    Boolean(value),
  );
  const matches = (value: unknown): boolean => {
    const text = JSON.stringify(value);
    return needles.some((needle) => text.includes(needle));
  };
  const attemptEntries = Object.entries(state.attempts ?? {});
  return {
    liveTaskIds: Object.entries(state.resources ?? {}).flatMap(([id, value]) =>
      matches(value) ? [id] : [],
    ),
    attemptIds: attemptEntries.flatMap(([id, value]) =>
      matches(value) ? [id] : [],
    ),
    activeAttemptIds: attemptEntries.flatMap(([id, value]) => {
      const attempt = value as {
        state?: unknown;
        workspace?: { path?: unknown; branch?: unknown };
      };
      return attempt.state === "running" &&
        (attempt.workspace?.path === entry.path ||
          (entry.branch && attempt.workspace?.branch === entry.branch))
        ? [id]
        : [];
    }),
    receiptIds: Object.entries(state.receipts ?? {}).flatMap(([id, value]) =>
      matches(value) ? [id] : [],
    ),
  };
}

function inventoryRow(
  repoDir: string,
  state: Record<string, Record<string, unknown>>,
  baseRef: string,
  entry: WorktreeEntry,
): InventoryRow {
  const canonical = resolve(entry.path) === resolve(repoDir);
  const present = existsSync(entry.path);
  const status = present
    ? run(
        entry.path,
        ["status", "--porcelain=v1", "--untracked-files=all"],
        true,
      )
        .stdout.split("\n")
        .filter(Boolean)
    : [];
  const dirty = present ? status.length > 0 : null;
  const reachableFromBase =
    run(repoDir, ["merge-base", "--is-ancestor", entry.head, baseRef], true)
      .status === 0;
  const remoteBranches = run(
    repoDir,
    ["branch", "-r", "--contains", entry.head],
    true,
  )
    .stdout.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const linkage = taskLinkage(state, entry);
  const live = linkage.activeAttemptIds.length > 0;
  const proposedDisposition: InventoryRow["proposedDisposition"] = canonical
    ? "keep-canonical"
    : !present || entry.prunable
      ? "prune-registration"
      : dirty
        ? "manual-recovery"
        : live
          ? "manual-recovery"
          : !entry.branch && reachableFromBase
            ? "remove-reachable-detached"
            : entry.branch && reachableFromBase
              ? "remove-merged-attached"
              : "remove-worktree-retain-branch";
  return {
    ...entry,
    canonical,
    present,
    dirty,
    status,
    reachableFromBase,
    remoteBranches,
    ...linkage,
    proposedDisposition,
  };
}

const appDir = resolve(import.meta.dir, "..");
const repoDir = resolve(appDir, "../aks-rp-e2e");
const baseRef = process.env.AKS_WORKSPACE_BASE_REF || "origin/dev";
const outputPath = resolve(
  process.argv[2] ||
    join(
      appDir,
      "evidence/ops/task-workspace-migration-inventory-20260721.json",
    ),
);
const baseCommit = run(repoDir, ["rev-parse", baseRef]).stdout;
const state = JSON.parse(
  readFileSync(join(appDir, ".state/tasks/state.json"), "utf8"),
);
const rows = worktrees(repoDir).map((entry) =>
  inventoryRow(repoDir, state, baseRef, entry),
);
const counts = {
  total: rows.length,
  present: rows.filter((row) => row.present).length,
  dirty: rows.filter((row) => row.dirty).length,
  linked: rows.filter((row) => row.liveTaskIds.length || row.attemptIds.length)
    .length,
  activeAttemptLinked: rows.filter((row) => row.activeAttemptIds.length).length,
  dispositions: Object.fromEntries(
    [...new Set(rows.map((row) => row.proposedDisposition))].map((kind) => [
      kind,
      rows.filter((row) => row.proposedDisposition === kind).length,
    ]),
  ),
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      repoDir,
      baseRef,
      baseCommit,
      counts,
      rows,
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify({ outputPath, baseCommit, counts }, null, 2));
