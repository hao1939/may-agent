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
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveSkillRoots } from "../lib/skill-paths.js";

export type DefinitionSourceRelease = Readonly<{
  id: string;
  root: string;
  agentsRoot: string;
  projectsRoot: string;
  sharedRoot: string;
  sourceCommit?: string;
}>;

type ReleaseManifest = {
  version: 1 | 2 | 3;
  id: string;
  sourceCommit?: string;
};

const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const DEFAULT_MAX_RETAINED_RELEASES = 5;
const STALE_STAGE_MAX_AGE_MS = 60 * 60_000;
const NON_SOURCE_DIRECTORIES = new Set([
  ".state",
  "archive",
  "artifacts",
  "evidence", // Retained runtime directories stay outside source releases.
  "facts",
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
        NON_SOURCE_DIRECTORIES.has(part) ||
        part === ".disabled" ||
        part === ".last-eval-state.json" ||
        part.startsWith("ui.root-stale-"),
    );
}

function stripCapturedNonSourceEntries(root: string): void {
  let stat;
  try {
    stat = lstatSync(root);
  } catch {
    return;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = join(root, entry.name);
    if (isNonSourcePath(entry.name)) {
      rmSync(child, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      stripCapturedNonSourceEntries(child);
    }
  }
}

function appDirectoryNames(projectsRoot: string): string[] {
  if (!existsSync(projectsRoot)) return [];
  return readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => entry.name)
    .sort();
}

function agentSkillRoots(agentsRoot: string): string[] {
  if (!existsSync(agentsRoot)) return [];
  return readdirSync(agentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(agentsRoot, entry.name, "skills"));
}

function validateCapturedSkillRoots(root: string): void {
  const diagnostics: string[] = [];
  const canonicalRoot = realpathSync(root);
  const visited = new Set<string>();
  const validatePath = (path: string): void => {
    let target: string;
    try {
      target = realpathSync(path);
    } catch (error) {
      diagnostics.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    if (target !== canonicalRoot && !target.startsWith(`${canonicalRoot}${sep}`)) {
      diagnostics.push(`${path}: ${target} escapes captured App source`);
      return;
    }
    if (visited.has(target)) return;
    visited.add(target);
    // Supporting files and directory links must be as immutable as SKILL.md.
    // Resolve before walking, and visit canonical directories once for cycles.
    if (lstatSync(target).isDirectory()) {
      for (const name of readdirSync(target)) validatePath(join(target, name));
    }
  };
  const skillRoots = [
    join(root, "shared", "skills"),
    ...agentSkillRoots(join(root, "agents")),
    ...appDirectoryNames(join(root, "projects")).flatMap((name) =>
      agentSkillRoots(join(root, "projects", name, "agents")),
    ),
  ];
  for (const skillRoot of skillRoots) {
    const pathsFile = join(skillRoot, "paths.json");
    const targets = resolveSkillRoots(skillRoot, diagnostics);
    if (existsSync(pathsFile)) targets.push(realpathSync(pathsFile));
    for (const target of targets) validatePath(target);
  }
  if (diagnostics.length) {
    throw new Error(
      `Invalid skill discovery paths in captured App source. Keep configured directories inside captured agents/, shared/skills/, shared/tools/ or projects/*.app/:\n${diagnostics.join("\n")}`,
    );
  }
}

function validateRelease(root: string): DefinitionSourceRelease {
  const manifestPath = join(root, "release.json");
  if (!existsSync(manifestPath)) throw new Error(`App source release has no manifest: ${root}`);
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as ReleaseManifest;
  if (![1, 2, 3].includes(parsed.version) || typeof parsed.id !== "string" || !parsed.id.trim()) {
    throw new Error(`Invalid App source release manifest: ${manifestPath}`);
  }
  if (basename(root) !== parsed.id) throw new Error(`App source release identity mismatch: ${root}`);
  if (parsed.sourceCommit !== undefined && !COMMIT_PATTERN.test(parsed.sourceCommit)) {
    throw new Error(`Invalid App source commit in ${manifestPath}`);
  }
  const projectsRoot = join(root, "projects");
  if (!existsSync(projectsRoot)) {
    throw new Error(`Definition source release contains no projects root: ${projectsRoot}`);
  }
  const agentsRoot = join(root, "agents");
  if (parsed.version >= 2 && !existsSync(agentsRoot)) {
    throw new Error(`Definition source release contains no global agents: ${agentsRoot}`);
  }
  const sharedRoot = join(root, "shared");
  if (
    parsed.version >= 3 &&
    (!existsSync(join(sharedRoot, "common-sense.md")) || !existsSync(join(sharedRoot, "skills")))
  ) {
    throw new Error(`Definition source release contains no shared prompt/skills source: ${sharedRoot}`);
  }
  validateCapturedSkillRoots(root);
  return Object.freeze({
    id: parsed.id,
    root,
    agentsRoot,
    projectsRoot,
    sharedRoot,
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

function assertCommittedDefinitionSource(projectRoot: string, commit: string, requireCleanWorktree: boolean): void {
  const trackedNames = execFileSync("git", ["-C", projectRoot, "ls-tree", "-d", "--name-only", `${commit}:projects`], {
    encoding: "utf8",
  })
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.endsWith(".app"))
    .sort();
  const paths = [
    "agents",
    "shared/common-sense.md",
    "shared/file-write-policy.json",
    "shared/skills",
    "shared/tools",
    ...trackedNames.map((name) => `projects/${name}`),
  ];
  try {
    execFileSync("git", ["-C", projectRoot, "cat-file", "-e", `${commit}:shared/common-sense.md`], {
      stdio: "ignore",
    });
    execFileSync("git", ["-C", projectRoot, "cat-file", "-e", `${commit}:shared/skills`], { stdio: "ignore" });
  } catch {
    throw new Error(`Commit ${commit} is missing shared definition source`);
  }

  // An explicit commit pin makes the immutable Git tree the complete source
  // authority. Mutable worktree files cannot affect the archived release.
  if (!requireCleanWorktree) return;

  const status = execFileSync(
    "git",
    ["-C", projectRoot, "status", "--porcelain=v1", "--untracked-files=no", "--", ...paths],
    { encoding: "utf8" },
  ).trim();
  if (status) {
    throw new Error(`App source has uncommitted tracked changes; commit them before reload:\n${status}`);
  }

  // Manuals and their supporting files are definition source regardless of
  // extension. Use the same directory configuration as skill discovery.
  const diagnostics: string[] = [];
  const skillRoots = [
    join(projectRoot, "shared", "skills"),
    ...agentSkillRoots(join(projectRoot, "agents")),
    ...trackedNames.flatMap((name) => agentSkillRoots(join(projectRoot, "projects", name, "agents"))),
  ].flatMap((root) => resolveSkillRoots(root, diagnostics));
  if (diagnostics.length) throw new Error(`Invalid skill discovery paths before reload:\n${diagnostics.join("\n")}`);
  const canonicalProjectRoot = realpathSync(projectRoot);

  const untracked = execFileSync(
    "git",
    ["-C", projectRoot, "ls-files", "-z", "--others", "--exclude-standard", "--", ...paths],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)
    .filter((path) => {
      if (isNonSourcePath(path)) return false;
      if (
        path.startsWith("agents/") ||
        path.startsWith("shared/skills/") ||
        path.startsWith("shared/tools/") ||
        path === "shared/common-sense.md" ||
        path === "shared/file-write-policy.json" ||
        skillRoots.some((root) => resolve(canonicalProjectRoot, path).startsWith(`${root}${sep}`))
      ) {
        return true;
      }
      return /\.(?:cjs|js|json|jsx|mjs|ts|tsx)$/.test(path);
    });
  if (untracked.length > 0) {
    throw new Error(
      `App source has untracked executable/config files; commit or remove them before reload:\n${untracked.join("\n")}`,
    );
  }
}

function extractCommittedDefinitions(projectRoot: string, commit: string, stageRoot: string): void {
  // Optional authored helpers: agents can import these, but minimal Apps need none.
  const sharedTools = execFileSync("git", ["-C", projectRoot, "ls-tree", "--name-only", commit, "--", "shared/tools"], {
    encoding: "utf8",
  }).trim();
  const trackedNames = execFileSync("git", ["-C", projectRoot, "ls-tree", "-d", "--name-only", `${commit}:projects`], {
    encoding: "utf8",
  })
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name.endsWith(".app"))
    .sort();
  const sharedPolicy = execFileSync("git", ["-C", projectRoot, "ls-tree", "--name-only", commit, "--", "shared/file-write-policy.json"], { encoding: "utf8" }).trim();
  const globalAgents = execFileSync("git", ["-C", projectRoot, "ls-tree", "--name-only", commit, "--", "agents"], { encoding: "utf8" }).trim();
  const archivePath = join(stageRoot, ".apps.tar");
  const archiveFd = openSync(archivePath, "w");
  let archived;
  try {
    archived = spawnSync(
      "git",
      [
        "-C",
        projectRoot,
        "archive",
        "--format=tar",
        commit,
        "--",
        ...(globalAgents ? [globalAgents] : []),
        "shared/common-sense.md",
        "shared/skills",
        ...(sharedTools ? [sharedTools] : []),
        ...(sharedPolicy ? [sharedPolicy] : []),
        ...trackedNames.map((name) => `projects/${name}`),
      ],
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
  mkdirSync(join(stageRoot, "projects"), { recursive: true });
  mkdirSync(join(stageRoot, "agents"), { recursive: true });
  rmSync(archivePath, { force: true });
  stripCapturedNonSourceEntries(join(stageRoot, "projects"));
  stripCapturedNonSourceEntries(join(stageRoot, "agents"));
  stripCapturedNonSourceEntries(join(stageRoot, "shared"));
}

function copyFilesystemDefinitions(projectRoot: string, stageRoot: string): void {
  const sourceProjectsRoot = join(projectRoot, "projects");
  const names = appDirectoryNames(sourceProjectsRoot);
  const targetProjectsRoot = join(stageRoot, "projects");
  mkdirSync(targetProjectsRoot, { recursive: true });
  for (const name of names) {
    const source = join(sourceProjectsRoot, name);
    cpSync(source, join(targetProjectsRoot, name), {
      recursive: true,
      verbatimSymlinks: true,
      filter: (path) => {
        const rel = relative(source, path);
        return !isNonSourcePath(rel.replace(/\\/g, "/"));
      },
    });
  }
  const sourceAgentsRoot = join(projectRoot, "agents");
  mkdirSync(join(stageRoot, "agents"), { recursive: true });
  if (existsSync(sourceAgentsRoot)) cpSync(sourceAgentsRoot, join(stageRoot, "agents"), {
    recursive: true,
    verbatimSymlinks: true,
    filter: (path) => {
      const rel = relative(sourceAgentsRoot, path);
      return !isNonSourcePath(rel.replace(/\\/g, "/"));
    },
  });
  const sourceSharedRoot = join(projectRoot, "shared");
  const targetSharedRoot = join(stageRoot, "shared");
  const commonSense = join(sourceSharedRoot, "common-sense.md");
  mkdirSync(targetSharedRoot, { recursive: true });
  if (existsSync(commonSense)) cpSync(commonSense, join(targetSharedRoot, "common-sense.md"));
  else writeFileSync(join(targetSharedRoot, "common-sense.md"), "", "utf8");
  const policy = join(sourceSharedRoot, "file-write-policy.json");
  if (existsSync(policy)) cpSync(policy, join(targetSharedRoot, "file-write-policy.json"));
  for (const directory of ["skills", "tools"]) {
    const source = join(sourceSharedRoot, directory);
    if (existsSync(source)) {
      cpSync(source, join(targetSharedRoot, directory), {
        recursive: true,
        verbatimSymlinks: true,
        filter: (path) => !isNonSourcePath(relative(source, path).replace(/\\/g, "/")),
      });
    } else if (directory === "skills") {
      mkdirSync(join(targetSharedRoot, directory), { recursive: true });
    }
  }
}

/**
 * Durable source boundary for App and agent definition code.
 *
 * Releases contain executable definitions only. Mutable state and execution
 * workspaces continue to resolve through the canonical tree.
 */
export class DefinitionSourceReleaseStore {
  private readonly releasesRoot: string;
  private readonly currentLink: string;
  private readonly heldCounts = new Map<string, number>();
  private readonly onNotice?: (message: string) => void;
  private readonly activePaths?: () => readonly string[];

  constructor(
    private readonly projectRoot: string,
    persistDir: string,
    options: {
      onNotice?: (message: string) => void;
      activePaths?: () => readonly string[];
    } = {},
  ) {
    this.releasesRoot = join(persistDir, "releases", "app-definitions");
    this.currentLink = join(this.releasesRoot, "current");
    this.onNotice = options.onNotice;
    this.activePaths = options.activePaths;
  }

  releaseIdForPath(path: string | undefined): string | undefined {
    const raw = path?.trim();
    if (!raw) return undefined;
    const rel = relative(resolve(this.releasesRoot), resolve(raw));
    if (!rel || rel.startsWith("..") || rel.includes("..")) return undefined;
    const [first] = rel.split(sep);
    return first && first !== "current" && !first.startsWith("current.next-") && !first.startsWith(".next-")
      ? first
      : undefined;
  }

  private currentReleaseRoot(): string | null {
    if (!existsSync(this.currentLink)) return null;
    if (!lstatSync(this.currentLink).isSymbolicLink()) {
      throw new Error(`App source current path is not a symlink: ${this.currentLink}`);
    }
    const target = readlinkSync(this.currentLink);
    const root = resolve(this.releasesRoot, target);
    if (resolve(root, "..") !== resolve(this.releasesRoot)) {
      throw new Error(`Unsafe App source release link: ${this.currentLink} -> ${target}`);
    }
    return root;
  }

  private currentIdFast(): string | undefined {
    try {
      const root = this.currentReleaseRoot();
      return root ? basename(root) : undefined;
    } catch {
      return undefined;
    }
  }

  retain(releaseId: string | undefined): () => void {
    const id = releaseId?.trim();
    if (!id) return () => {};
    this.heldCounts.set(id, (this.heldCounts.get(id) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = (this.heldCounts.get(id) ?? 1) - 1;
      if (next > 0) this.heldCounts.set(id, next);
      else this.heldCounts.delete(id);
    };
  }

  heldIds(): string[] {
    return [...this.heldCounts.keys()];
  }

  current(): DefinitionSourceRelease | null {
    const root = this.currentReleaseRoot();
    return root ? validateRelease(root) : null;
  }

  ensureCurrent(): DefinitionSourceRelease {
    const active = this.current();
    if (active && existsSync(active.agentsRoot) && existsSync(join(active.sharedRoot, "common-sense.md"))) {
      this.prune();
      return active;
    }
    const candidate = this.stage();
    this.activate(candidate, active ? [active.id] : []);
    return candidate;
  }

  stage(expectedSourceCommit?: string): DefinitionSourceRelease {
    const commit = gitCommit(this.projectRoot);
    if (expectedSourceCommit && commit !== expectedSourceCommit) {
      throw new Error(
        `App source commit changed before reload: expected ${expectedSourceCommit}, found ${commit ?? "no Git HEAD"}`,
      );
    }
    mkdirSync(this.releasesRoot, { recursive: true });
    if (commit) assertCommittedDefinitionSource(this.projectRoot, commit, !expectedSourceCommit);
    // v6 strips non-source directories (archive/, generated/, reports/, etc.) from Git snapshots too.
    const id = commit ? `${commit}-definitions-v6` : `filesystem-${Date.now()}-${randomUUID()}-definitions-v6`;
    const releaseRoot = join(this.releasesRoot, id);
    if (existsSync(releaseRoot)) return validateRelease(releaseRoot);

    const stageRoot = join(this.releasesRoot, `.next-${id}-${process.pid}-${randomUUID()}`);
    mkdirSync(stageRoot, { recursive: true });
    try {
      if (commit) extractCommittedDefinitions(this.projectRoot, commit, stageRoot);
      else copyFilesystemDefinitions(this.projectRoot, stageRoot);
      // Check the actual snapshot, never mutable source for a pinned release.
      // Reject before caching; validation also covers reuse and activation.
      validateCapturedSkillRoots(stageRoot);
      // Shared tools and file policy change snapshot contents, not the manifest schema. Keep
      // active snapshots readable when rolling back to the previous Host.
      const manifest: ReleaseManifest = { version: 3, id, ...(commit ? { sourceCommit: commit } : {}) };
      writeFileSync(join(stageRoot, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      renameSync(stageRoot, releaseRoot);
    } catch (error) {
      rmSync(stageRoot, { recursive: true, force: true });
      throw error;
    }
    return validateRelease(releaseRoot);
  }

  activate(release: DefinitionSourceRelease, preserveIds: readonly string[] = []): void {
    const validated = validateRelease(release.root);
    const relativeTarget = relative(this.releasesRoot, validated.root);
    if (!relativeTarget || relativeTarget.startsWith("..")) {
      throw new Error(`App source release is outside ${this.releasesRoot}: ${validated.root}`);
    }
    const previousId = this.currentIdFast();
    const nextLink = `${this.currentLink}.next-${process.pid}-${randomUUID()}`;
    symlinkSync(relativeTarget, nextLink);
    renameSync(nextLink, this.currentLink);
    this.prune([...preserveIds, ...(previousId ? [previousId] : [])]);
  }

  prune(preserveIds: readonly string[] = [], maxRetained = DEFAULT_MAX_RETAINED_RELEASES): string[] {
    if (!existsSync(this.releasesRoot)) return [];
    const activeId = this.currentIdFast();
    const sessionProtectedIds = (this.activePaths?.() ?? [])
      .map((path) => this.releaseIdForPath(path))
      .filter((id): id is string => Boolean(id));
    const protectedIds = new Set<string>([
      ...this.heldCounts.keys(),
      ...sessionProtectedIds,
      ...preserveIds.filter(Boolean),
    ]);
    if (activeId) protectedIds.add(activeId);
    const now = Date.now();
    const candidates: Array<{ id: string; path: string; mtimeMs: number }> = [];
    const removed: string[] = [];

    let entries;
    try {
      entries = readdirSync(this.releasesRoot, { withFileTypes: true });
    } catch {
      return [];
    }

    for (const entry of entries) {
      if (entry.name === "current" || entry.name.startsWith("current.next-")) continue;
      const entryPath = join(this.releasesRoot, entry.name);
      if (entry.name.startsWith(".next-")) {
        try {
          if (now - statSync(entryPath).mtimeMs >= STALE_STAGE_MAX_AGE_MS) {
            rmSync(entryPath, { recursive: true, force: true });
            removed.push(entry.name);
          }
        } catch (error) {
          this.onNotice?.(
            `[apps] Ignored stale stage cleanup error for ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        continue;
      }
      if (!entry.isDirectory() || entry.isSymbolicLink() || !existsSync(join(entryPath, "release.json"))) continue;
      try {
        candidates.push({ id: entry.name, path: entryPath, mtimeMs: statSync(entryPath).mtimeMs });
      } catch {
        // Concurrent removal.
      }
    }

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs || right.id.localeCompare(left.id));
    const protectedCount = candidates.filter((candidate) => protectedIds.has(candidate.id)).length;
    const unprotectedBudget = Math.max(0, Math.max(1, maxRetained) - protectedCount);
    let keptUnprotected = 0;

    for (const candidate of candidates) {
      if (protectedIds.has(candidate.id)) continue;
      if (keptUnprotected < unprotectedBudget) {
        keptUnprotected += 1;
        continue;
      }
      try {
        rmSync(candidate.path, { recursive: true, force: true });
        removed.push(candidate.id);
      } catch (error) {
        this.onNotice?.(
          `[apps] Failed to prune obsolete release ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return removed;
  }
}
