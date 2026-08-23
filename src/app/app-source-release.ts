import { execFileSync, spawnSync } from "node:child_process";
import {
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type AppSourceRelease = Readonly<{
  id: string;
  root: string;
  projectsRoot: string;
  sourceCommit?: string;
}>;

type ReleaseManifest = {
  version: 1;
  id: string;
  sourceCommit?: string;
};

const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const NON_SOURCE_DIRECTORIES = new Set([
  ".state",
  "archive",
  "artifacts",
  "evidence",
  "generated",
  "node_modules",
  "outputs",
  "reports",
  "workspace",
]);

function isNonSourcePath(path: string): boolean {
  return path
    .split("/")
    .some(
      (part) =>
        NON_SOURCE_DIRECTORIES.has(part) || part === ".last-eval-state.json" || part.startsWith("ui.root-stale-"),
    );
}

function appDirectoryNames(projectsRoot: string): string[] {
  if (!existsSync(projectsRoot)) return [];
  return readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => entry.name)
    .sort();
}

function validateRelease(root: string): AppSourceRelease {
  const manifestPath = join(root, "release.json");
  if (!existsSync(manifestPath)) throw new Error(`App source release has no manifest: ${root}`);
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as ReleaseManifest;
  if (parsed.version !== 1 || typeof parsed.id !== "string" || !parsed.id.trim()) {
    throw new Error(`Invalid App source release manifest: ${manifestPath}`);
  }
  if (basename(root) !== parsed.id) throw new Error(`App source release identity mismatch: ${root}`);
  if (parsed.sourceCommit !== undefined && !COMMIT_PATTERN.test(parsed.sourceCommit)) {
    throw new Error(`Invalid App source commit in ${manifestPath}`);
  }
  const projectsRoot = join(root, "projects");
  if (appDirectoryNames(projectsRoot).length === 0) {
    throw new Error(`App source release contains no Apps: ${projectsRoot}`);
  }
  return Object.freeze({
    id: parsed.id,
    root,
    projectsRoot,
    ...(parsed.sourceCommit ? { sourceCommit: parsed.sourceCommit } : {}),
  });
}

function gitCommit(projectRoot: string): string | null {
  try {
    const commit = execFileSync("git", ["-C", projectRoot, "rev-parse", "--verify", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return COMMIT_PATTERN.test(commit) ? commit : null;
  } catch {
    return null;
  }
}

function assertCommittedAppSource(projectRoot: string, commit: string): void {
  const trackedNames = execFileSync("git", ["-C", projectRoot, "ls-tree", "-d", "--name-only", `${commit}:projects`], {
    encoding: "utf8",
  })
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.endsWith(".app"))
    .sort();
  const paths = trackedNames.map((name) => `projects/${name}`);
  if (paths.length === 0) throw new Error(`Commit ${commit} contains no App directories`);

  const status = execFileSync(
    "git",
    ["-C", projectRoot, "status", "--porcelain=v1", "--untracked-files=no", "--", ...paths],
    { encoding: "utf8" },
  ).trim();
  if (status) {
    throw new Error(`App source has uncommitted tracked changes; commit them before reload:\n${status}`);
  }

  const untracked = execFileSync(
    "git",
    ["-C", projectRoot, "ls-files", "--others", "--exclude-standard", "--", ...paths],
    { encoding: "utf8" },
  )
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => {
      if (isNonSourcePath(path)) return false;
      return /\.(?:cjs|js|json|jsx|mjs|ts|tsx)$/.test(path);
    });
  if (untracked.length > 0) {
    throw new Error(
      `App source has untracked executable/config files; commit or remove them before reload:\n${untracked.join("\n")}`,
    );
  }
}

function extractCommittedApps(projectRoot: string, commit: string, stageRoot: string): void {
  const trackedNames = execFileSync("git", ["-C", projectRoot, "ls-tree", "-d", "--name-only", `${commit}:projects`], {
    encoding: "utf8",
  })
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.endsWith(".app"))
    .sort();
  if (trackedNames.length === 0) throw new Error(`Commit ${commit} contains no App directories`);

  const archivePath = join(stageRoot, ".apps.tar");
  const archiveFd = openSync(archivePath, "w");
  let archived;
  try {
    archived = spawnSync(
      "git",
      ["-C", projectRoot, "archive", "--format=tar", commit, "--", ...trackedNames.map((name) => `projects/${name}`)],
      { stdio: ["ignore", archiveFd, "pipe"] },
    );
  } finally {
    closeSync(archiveFd);
  }
  if (archived.status !== 0) {
    throw new Error(
      `Cannot archive App source at ${commit}: ${Buffer.from(archived.stderr ?? "")
        .toString("utf8")
        .trim()}`,
    );
  }
  execFileSync("tar", ["-xf", archivePath, "-C", stageRoot], { stdio: ["ignore", "ignore", "pipe"] });
  rmSync(archivePath, { force: true });
}

function copyFilesystemApps(projectRoot: string, stageRoot: string): void {
  const sourceProjectsRoot = join(projectRoot, "projects");
  const names = appDirectoryNames(sourceProjectsRoot);
  if (names.length === 0) throw new Error(`No App directories found under ${sourceProjectsRoot}`);
  const targetProjectsRoot = join(stageRoot, "projects");
  mkdirSync(targetProjectsRoot, { recursive: true });
  for (const name of names) {
    const source = join(sourceProjectsRoot, name);
    cpSync(source, join(targetProjectsRoot, name), {
      recursive: true,
      filter: (path) => {
        const rel = relative(source, path);
        return !isNonSourcePath(rel.replace(/\\/g, "/"));
      },
    });
  }
}

/**
 * Durable source boundary for App definition code.
 *
 * Releases contain executable App source only. Mutable state and execution
 * workspaces continue to resolve through the canonical /projects tree.
 */
export class AppSourceReleaseStore {
  private readonly releasesRoot: string;
  private readonly currentLink: string;

  constructor(
    private readonly projectRoot: string,
    persistDir: string,
  ) {
    this.releasesRoot = join(persistDir, "releases", "app-definitions");
    this.currentLink = join(this.releasesRoot, "current");
  }

  current(): AppSourceRelease | null {
    if (!existsSync(this.currentLink)) return null;
    if (!lstatSync(this.currentLink).isSymbolicLink()) {
      throw new Error(`App source current path is not a symlink: ${this.currentLink}`);
    }
    const target = readlinkSync(this.currentLink);
    const root = resolve(this.releasesRoot, target);
    if (resolve(root, "..") !== resolve(this.releasesRoot)) {
      throw new Error(`Unsafe App source release link: ${this.currentLink} -> ${target}`);
    }
    return validateRelease(root);
  }

  ensureCurrent(): AppSourceRelease {
    const active = this.current();
    if (active) return active;
    const candidate = this.stage();
    this.activate(candidate);
    return candidate;
  }

  stage(): AppSourceRelease {
    mkdirSync(this.releasesRoot, { recursive: true });
    const commit = gitCommit(this.projectRoot);
    if (commit) assertCommittedAppSource(this.projectRoot, commit);
    const id = commit ?? `filesystem-${Date.now()}-${randomUUID()}`;
    const releaseRoot = join(this.releasesRoot, id);
    if (existsSync(releaseRoot)) return validateRelease(releaseRoot);

    const stageRoot = join(this.releasesRoot, `.next-${id}-${process.pid}-${randomUUID()}`);
    mkdirSync(stageRoot, { recursive: true });
    try {
      if (commit) extractCommittedApps(this.projectRoot, commit, stageRoot);
      else copyFilesystemApps(this.projectRoot, stageRoot);
      const manifest: ReleaseManifest = { version: 1, id, ...(commit ? { sourceCommit: commit } : {}) };
      writeFileSync(join(stageRoot, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      renameSync(stageRoot, releaseRoot);
    } catch (error) {
      rmSync(stageRoot, { recursive: true, force: true });
      throw error;
    }
    return validateRelease(releaseRoot);
  }

  activate(release: AppSourceRelease): void {
    const validated = validateRelease(release.root);
    const relativeTarget = relative(this.releasesRoot, validated.root);
    if (!relativeTarget || relativeTarget.startsWith("..")) {
      throw new Error(`App source release is outside ${this.releasesRoot}: ${validated.root}`);
    }
    const nextLink = `${this.currentLink}.next-${process.pid}-${randomUUID()}`;
    symlinkSync(relativeTarget, nextLink);
    renameSync(nextLink, this.currentLink);
  }
}
