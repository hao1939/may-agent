import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

export type LegacyBranchInventoryRow = {
  branch: string;
  head: string;
  family: string;
  commits: string[];
  files: string[];
};

type GitResult = { status: number; stdout: string; stderr: string };

function git(repoDir: string, args: string[], allowFailure = false): GitResult {
  const result = spawnSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = {
    status: result.status ?? 1,
    stdout: result.stdout?.trim() ?? "",
    stderr: (result.stderr || result.error?.message || "").trim(),
  };
  if (!allowFailure && output.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${repoDir}: ${output.stderr || output.stdout}`,
    );
  }
  return output;
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function familyForFiles(files: string[]): string {
  const features = new Set(
    files.flatMap((file) => {
      const match = file.match(/^features\/([^/]+)\//);
      return match ? [match[1]] : [];
    }),
  );
  if (features.size === 1) return [...features][0];
  if (features.size > 1) {
    const signature = [...features].sort();
    const digest = createHash("sha256")
      .update(signature.join("\n"))
      .digest("hex")
      .slice(0, 8);
    return `cross-${signature.slice(0, 2).join("-")}-${digest}`;
  }
  const topLevels = new Set(
    files.map((file) => file.split("/")[0]).filter(Boolean),
  );
  if (topLevels.size === 1) return `repo-${[...topLevels][0]}`;
  const signature = [...topLevels].sort();
  const digest = createHash("sha256")
    .update(signature.join("\n"))
    .digest("hex")
    .slice(0, 8);
  return `repo-${signature.slice(0, 2).join("-")}-${digest}`;
}

export function legacyBranchInventory(
  repoDir: string,
  baseRef = "origin/dev",
): LegacyBranchInventoryRow[] {
  const attached = new Set(
    lines(git(repoDir, ["worktree", "list", "--porcelain"]).stdout)
      .filter((line) => line.startsWith("branch refs/heads/"))
      .map((line) => line.slice("branch refs/heads/".length)),
  );
  const branches = lines(
    git(repoDir, [
      "branch",
      "--format=%(refname:short)",
      "--no-merged",
      baseRef,
    ]).stdout,
  ).filter(
    (branch) =>
      !attached.has(branch) &&
      branch !== "dev" &&
      branch !== "main" &&
      branch !== "master",
  );

  return branches.flatMap((branch) => {
    const cherry = lines(git(repoDir, ["cherry", baseRef, branch]).stdout);
    const commits = cherry
      .filter((entry) => entry.startsWith("+ "))
      .map((entry) => entry.slice(2).trim());
    if (!commits.length) return [];
    const files = lines(
      git(repoDir, ["show", "--format=", "--name-only", ...commits]).stdout,
    ).sort();
    return [
      {
        branch,
        head: git(repoDir, ["rev-parse", branch]).stdout,
        family: familyForFiles(files),
        commits,
        files: [...new Set(files)],
      },
    ];
  });
}

export function legacyBranchWorkRevision(
  rows: LegacyBranchInventoryRow[],
): string {
  return createHash("sha256")
    .update(
      rows
        .map((row) => `${row.branch}@${row.head}`)
        .sort()
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 10);
}

export function safeLegacyBranchFamily(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "repo"
  );
}
