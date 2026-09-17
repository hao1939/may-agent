import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

export type KnowledgeSnapshot = {
  /** Isolated project root supplied to the writer. */
  projectRoot: string;
  canonicalProjectRoot: string;
  repositoryRoot: string;
  candidateRoot: string;
  ref: string;
  head: string;
  files: Map<string, string>;
  canonicalDirty: Set<string>;
};

export type PublicationEvidence = {
  state: "committed" | "unchanged";
  commit: string;
  parent?: string;
  files: string[];
  outputs: string[];
};

export class KnowledgePublicationError extends Error {
  constructor(
    message: string,
    readonly candidateRoot: string,
    readonly candidateBase: string,
    readonly candidateRevision: string,
    readonly changedPaths: string[],
  ) {
    super(message);
    this.name = "KnowledgePublicationError";
  }
}

function git(
  cwd: string,
  args: string[],
  env?: Record<string, string>,
): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
  }).trim();
}
function gitBytes(cwd: string, args: string[]): Buffer {
  return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
}
function digestBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
function digest(path: string): string {
  return digestBytes(readFileSync(path));
}
function durableFiles(projectRoot: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const name of ["knowledge", "reports"]) {
    const root = resolve(projectRoot, name);
    if (!existsSync(root)) continue;
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) visit(path);
        else if (entry.isFile()) result.set(path, digest(path));
      }
    };
    visit(root);
  }
  return result;
}
function projectRelative(
  snapshot: KnowledgeSnapshot,
  absolute: string,
): string {
  const path = relative(snapshot.projectRoot, absolute).replaceAll("\\", "/");
  if (!path || path.startsWith("../") || path === "..")
    throw new Error(`Publication path escapes candidate: ${absolute}`);
  return path;
}
function repositoryPath(
  snapshot: KnowledgeSnapshot,
  projectPath: string,
): string {
  return relative(
    snapshot.repositoryRoot,
    resolve(snapshot.canonicalProjectRoot, projectPath),
  ).replaceAll("\\", "/");
}
function dirtyPaths(repositoryRoot: string, projectRoot: string): Set<string> {
  const roots = ["knowledge", "reports"].map((name) =>
    relative(repositoryRoot, resolve(projectRoot, name)).replaceAll("\\", "/"),
  );
  const staged = git(repositoryRoot, [
    "diff",
    "--cached",
    "--name-only",
    "--",
    ...roots,
  ]);
  const unstaged = git(repositoryRoot, ["diff", "--name-only", "--", ...roots]);
  const untracked = git(repositoryRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    ...roots,
  ]);
  return new Set(
    `${staged}\n${unstaged}\n${untracked}`.split("\n").filter(Boolean),
  );
}

/** Allocate an isolated detached worktree under retained workflow output. */
export function snapshotKnowledge(
  projectRoot: string,
  artifactRoot = tmpdir(),
): KnowledgeSnapshot {
  const canonicalProjectRoot = realpathSync(projectRoot);
  const repositoryRoot = realpathSync(
    git(canonicalProjectRoot, ["rev-parse", "--show-toplevel"]),
  );
  const head = git(repositoryRoot, ["rev-parse", "HEAD"]);
  const ref = git(repositoryRoot, ["symbolic-ref", "-q", "HEAD"]);
  if (!ref) throw new Error("Scout publication requires an attached branch");
  mkdirSync(artifactRoot, { recursive: true });
  const candidateRoot = mkdtempSync(
    join(artifactRoot, "scout-knowledge-candidate-"),
  );
  git(repositoryRoot, ["worktree", "add", "--detach", candidateRoot, head]);
  const relativeProject = relative(repositoryRoot, canonicalProjectRoot);
  const candidateProjectRoot = resolve(candidateRoot, relativeProject);
  return {
    projectRoot: candidateProjectRoot,
    canonicalProjectRoot,
    repositoryRoot,
    candidateRoot,
    ref,
    head,
    files: durableFiles(candidateProjectRoot),
    canonicalDirty: dirtyPaths(repositoryRoot, canonicalProjectRoot),
  };
}

export function changedKnowledgePaths(before: KnowledgeSnapshot): string[] {
  const after = durableFiles(before.projectRoot);
  return [...new Set([...before.files.keys(), ...after.keys()])]
    .filter((path) => before.files.get(path) !== after.get(path))
    .sort();
}

function allCandidateChanges(snapshot: KnowledgeSnapshot): string[] {
  const committed = git(snapshot.candidateRoot, [
    "diff",
    "--name-only",
    snapshot.head,
    "HEAD",
  ]);
  const tracked = git(snapshot.candidateRoot, ["diff", "--name-only", "HEAD"]);
  const untracked = git(snapshot.candidateRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
  ]);
  return [
    ...new Set(
      `${committed}\n${tracked}\n${untracked}`.split("\n").filter(Boolean),
    ),
  ].sort();
}

export function retainedCandidateFacts(snapshot: KnowledgeSnapshot): string[] {
  return [
    `candidate-root:${snapshot.candidateRoot}`,
    `candidate-base:${snapshot.head}`,
    `candidate-revision:${git(snapshot.candidateRoot, ["rev-parse", "HEAD"])}`,
    ...allCandidateChanges(snapshot).map((path) => `candidate-change:${path}`),
  ];
}

function assertSafeFile(snapshot: KnowledgeSnapshot, path: string): void {
  const roots = [
    resolve(snapshot.projectRoot, "knowledge"),
    resolve(snapshot.projectRoot, "reports"),
  ];
  const resolved = resolve(path);
  if (!roots.some((root) => resolved.startsWith(`${root}${sep}`)))
    throw new Error(`Publication is outside Scout durable roots: ${path}`);
  if (existsSync(resolved)) {
    const stat = lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(
        `Publication requires a regular non-symlink file: ${path}`,
      );
    const parent = realpathSync(dirname(resolved));
    if (
      !roots.some(
        (root) => parent === root || parent.startsWith(`${root}${sep}`),
      )
    )
      throw new Error(
        `Publication parent escapes Scout durable roots: ${path}`,
      );
  }
}
function assertCanonicalFile(
  snapshot: KnowledgeSnapshot,
  projectPath: string,
): void {
  const root = resolve(snapshot.canonicalProjectRoot);
  const parts = projectPath.split("/").filter(Boolean);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    if (!current.startsWith(`${root}${sep}`))
      throw new Error(
        `Canonical publication path escapes Scout project: ${projectPath}`,
      );
    if (!existsSync(current)) break;
    const stat = lstatSync(current);
    if (stat.isSymbolicLink())
      throw new Error(
        `Canonical publication path contains a symlink: ${projectPath}`,
      );
    const target = index === parts.length - 1;
    if ((!target && !stat.isDirectory()) || (target && !stat.isFile()))
      throw new Error(
        `Canonical publication path has an unsafe file type: ${projectPath}`,
      );
  }
}

function retainFailure(snapshot: KnowledgeSnapshot, error: unknown): never {
  const changes = allCandidateChanges(snapshot);
  const revision = git(snapshot.candidateRoot, ["rev-parse", "HEAD"]);
  throw new KnowledgePublicationError(
    `${error instanceof Error ? error.message : String(error)}; isolated candidate retained at ${snapshot.candidateRoot}; candidate base: ${snapshot.head}; candidate revision: ${revision}; candidate changes: ${changes.join(", ") || "none"}`,
    snapshot.candidateRoot,
    snapshot.head,
    revision,
    changes,
  );
}
function cleanup(snapshot: KnowledgeSnapshot): void {
  git(snapshot.repositoryRoot, [
    "worktree",
    "remove",
    "--force",
    snapshot.candidateRoot,
  ]);
}
function modeAt(cwd: string, revision: string, path: string): number {
  const mode = git(cwd, ["ls-tree", revision, "--", path]).split(/\s/, 1)[0];
  return mode === "100755" ? 0o755 : 0o644;
}

/** Commit exact isolated bytes, reconcile only those paths, then CAS the branch. */
export function publishKnowledgeChanges(
  before: KnowledgeSnapshot,
  options: {
    executionId: string;
    summary: string;
    allowDeletions?: boolean;
    reportedOutputs?: string[];
  },
): PublicationEvidence {
  try {
    const reportedOutputs = canonicalOutputPaths(
      before,
      options.reportedOutputs ?? [],
    );
    const reportedHashes = new Map(
      reportedOutputs.map((output) => [
        output,
        digest(
          resolve(
            before.projectRoot,
            relative(before.canonicalProjectRoot, output),
          ),
        ),
      ]),
    );
    const changedAbsolute = changedKnowledgePaths(before);
    const allowedRepoPaths = changedAbsolute.map((path) =>
      repositoryPath(before, projectRelative(before, path)),
    );
    const outside = allCandidateChanges(before).filter(
      (path) => !allowedRepoPaths.includes(path),
    );
    if (outside.length)
      throw new Error(
        `Candidate changed paths outside Scout durable roots: ${outside.join(", ")}`,
      );
    for (const path of changedAbsolute) {
      assertSafeFile(before, path);
      assertCanonicalFile(before, projectRelative(before, path));
    }
    const introducedCanonicalChanges = [
      ...dirtyPaths(before.repositoryRoot, before.canonicalProjectRoot),
    ].filter((path) => !before.canonicalDirty.has(path));
    if (introducedCanonicalChanges.length)
      throw new Error(
        `Canonical Scout paths changed outside the isolated candidate: ${introducedCanonicalChanges.join(", ")}`,
      );
    if (changedAbsolute.length === 0) {
      const commit = git(before.repositoryRoot, ["rev-parse", before.ref]);
      verifyReportedRevision(before, commit, reportedHashes);
      verifyCanonicalOutputPaths(before, commit, reportedOutputs);
      cleanup(before);
      return {
        state: "unchanged",
        commit,
        files: [],
        outputs: reportedOutputs,
      };
    }
    const projectPaths = changedAbsolute.map((path) =>
      projectRelative(before, path),
    );
    const repoPaths = projectPaths.map((path) => repositoryPath(before, path));
    const preexisting = repoPaths.filter((path) =>
      before.canonicalDirty.has(path),
    );
    if (preexisting.length)
      throw new Error(
        `Intended Scout paths were already dirty: ${preexisting.join(", ")}`,
      );
    const after = durableFiles(before.projectRoot);
    const deleted = changedAbsolute.filter((path) => !after.has(path));
    if (deleted.length && !options.allowDeletions)
      throw new Error(
        `Scout publication requires explicit deletion review: ${deleted.join(", ")}`,
      );

    const desired = new Map(
      projectPaths.map((path) => {
        const candidate = resolve(before.projectRoot, path);
        return [
          path,
          existsSync(candidate) ? readFileSync(candidate) : null,
        ] as const;
      }),
    );
    const current = git(before.repositoryRoot, ["rev-parse", before.ref]);
    if (current !== before.head) {
      try {
        git(before.repositoryRoot, [
          "diff",
          "--quiet",
          before.head,
          current,
          "--",
          ...repoPaths,
        ]);
      } catch {
        throw new Error(
          `HEAD changed on intended Scout paths (${before.head} -> ${current})`,
        );
      }
      git(before.candidateRoot, ["reset", "--hard", current]);
      for (const [path, bytes] of desired) {
        const candidate = resolve(before.projectRoot, path);
        if (bytes === null) rmSync(candidate, { force: true });
        else {
          mkdirSync(dirname(candidate), { recursive: true });
          writeFileSync(candidate, bytes);
        }
      }
    }
    for (const [index, projectPath] of projectPaths.entries()) {
      const canonical = resolve(before.canonicalProjectRoot, projectPath);
      const original = before.files.get(
        resolve(before.projectRoot, projectPath),
      );
      const currentHash = existsSync(canonical) ? digest(canonical) : undefined;
      if (currentHash !== original)
        throw new Error(
          `Canonical Scout path changed concurrently: ${repoPaths[index]}`,
        );
    }

    const candidateRevision = git(before.candidateRoot, ["rev-parse", "HEAD"]);
    const reusable =
      candidateRevision !== current &&
      git(before.candidateRoot, ["rev-parse", `${candidateRevision}^`]) ===
        current;
    if (!reusable) {
      git(before.candidateRoot, ["add", "--", ...repoPaths]);
      git(before.candidateRoot, [
        "-c",
        "user.name=Scout Publisher",
        "-c",
        "user.email=scout@local",
        "commit",
        "-m",
        `scout: publish ${options.summary.slice(0, 120)}`,
        "-m",
        `Execution: ${options.executionId}`,
      ]);
    }
    const commit = git(before.candidateRoot, ["rev-parse", "HEAD"]);
    const parent = git(before.candidateRoot, ["rev-parse", `${commit}^`]);
    const committed = git(before.candidateRoot, [
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      commit,
    ])
      .split("\n")
      .filter(Boolean)
      .sort();
    if (
      parent !== current ||
      JSON.stringify(committed) !== JSON.stringify([...repoPaths].sort())
    )
      throw new Error(
        `Commit ${commit} read-back did not match intended Scout paths`,
      );
    for (const [index, path] of repoPaths.entries()) {
      if (deleted.includes(changedAbsolute[index])) continue;
      if (
        digestBytes(
          gitBytes(before.candidateRoot, ["show", `${commit}:${path}`]),
        ) !== digestBytes(desired.get(projectPaths[index])!)
      )
        throw new Error(`Commit ${commit} byte read-back failed for ${path}`);
    }
    // A reused output is part of the result too. Validate its reviewed bytes
    // before integrating any changes, including after a disjoint branch advance.
    verifyReportedRevision(before, commit, reportedHashes);

    // Reserve the canonical index before touching canonical files. We build a
    // complete replacement index separately, preserving every unrelated entry.
    const indexPathValue = git(before.repositoryRoot, [
      "rev-parse",
      "--git-path",
      "index",
    ]);
    const indexPath = resolve(before.repositoryRoot, indexPathValue);
    const indexLock = `${indexPath}.lock`;
    const replacementIndex = join(
      dirname(before.candidateRoot),
      `.scout-index-${randomUUID()}`,
    );
    const originalIndex = join(
      dirname(before.candidateRoot),
      `.scout-index-original-${randomUUID()}`,
    );
    let ownsIndexLock = false;
    const preparedFiles: string[] = [];
    const createdDirectories: string[] = [];
    const appliedIndexes: number[] = [];
    const originals = projectPaths.map((projectPath) => {
      const canonical = resolve(before.canonicalProjectRoot, projectPath);
      return existsSync(canonical)
        ? {
            canonical,
            existed: true as const,
            bytes: readFileSync(canonical),
            mode: statSync(canonical).mode & 0o777,
          }
        : { canonical, existed: false as const };
    });
    const rollback = (): string[] => {
      const failures: string[] = [];
      for (const index of [...appliedIndexes].reverse()) {
        const original = originals[index];
        const temporary = `${original.canonical}.${randomUUID()}.rollback`;
        try {
          if (!original.existed) rmSync(original.canonical, { force: true });
          else {
            writeFileSync(temporary, original.bytes, { flag: "wx" });
            chmodSync(temporary, original.mode);
            renameSync(temporary, original.canonical);
          }
        } catch (error) {
          failures.push(
            `file rollback failed (${original.canonical}): ${String(error)}`,
          );
        } finally {
          try {
            rmSync(temporary, { force: true });
          } catch (error) {
            failures.push(
              `rollback temporary cleanup failed (${temporary}): ${String(error)}`,
            );
          }
        }
      }
      try {
        if (existsSync(originalIndex)) copyFileSync(originalIndex, indexPath);
      } catch (error) {
        failures.push(`index rollback failed (${indexPath}): ${String(error)}`);
      }
      // Missing directories were collected leaf-first; remove children first.
      for (const directory of createdDirectories) {
        try {
          rmdirSync(directory);
        } catch {
          // A non-empty/pre-existing parent is not ours to remove.
        }
      }
      return failures;
    };
    try {
      closeSync(openSync(indexLock, "wx"));
      ownsIndexLock = true;

      if (git(before.repositoryRoot, ["rev-parse", before.ref]) !== current)
        throw new Error(
          "Branch changed while publication acquired the index lock",
        );
      for (const path of projectPaths) assertCanonicalFile(before, path);
      const newlyDirty = repoPaths.filter((path) =>
        dirtyPaths(before.repositoryRoot, before.canonicalProjectRoot).has(
          path,
        ),
      );
      if (newlyDirty.length)
        throw new Error(
          `Intended Scout paths became dirty before publication: ${newlyDirty.join(", ")}`,
        );
      for (const [index, projectPath] of projectPaths.entries()) {
        const canonical = resolve(before.canonicalProjectRoot, projectPath);
        const original = before.files.get(
          resolve(before.projectRoot, projectPath),
        );
        const currentHash = existsSync(canonical)
          ? digest(canonical)
          : undefined;
        if (currentHash !== original)
          throw new Error(
            `Canonical Scout path changed concurrently: ${repoPaths[index]}`,
          );
      }

      copyFileSync(indexPath, originalIndex);
      copyFileSync(indexPath, replacementIndex);
      for (const [index, path] of repoPaths.entries()) {
        if (deleted.includes(changedAbsolute[index])) {
          git(
            before.repositoryRoot,
            ["update-index", "--force-remove", "--", path],
            { GIT_INDEX_FILE: replacementIndex },
          );
          continue;
        }
        const entry = git(before.candidateRoot, [
          "ls-tree",
          commit,
          "--",
          path,
        ]);
        const match = /^(\d+)\s+blob\s+([0-9a-f]+)\t/.exec(entry);
        if (!match) throw new Error(`Commit ${commit} has no blob for ${path}`);
        git(
          before.repositoryRoot,
          ["update-index", "--add", "--cacheinfo", match[1], match[2], path],
          { GIT_INDEX_FILE: replacementIndex },
        );
      }

      for (const [index, projectPath] of projectPaths.entries()) {
        if (deleted.includes(changedAbsolute[index])) continue;
        const canonical = resolve(before.canonicalProjectRoot, projectPath);
        const missing: string[] = [];
        for (
          let directory = dirname(canonical);
          !existsSync(directory) &&
          directory.startsWith(before.canonicalProjectRoot);
          directory = dirname(directory)
        )
          missing.push(directory);
        mkdirSync(dirname(canonical), { recursive: true });
        createdDirectories.push(...missing);
        const temporary = `${canonical}.${randomUUID()}.publish`;
        writeFileSync(
          temporary,
          gitBytes(before.candidateRoot, [
            "show",
            `${commit}:${repoPaths[index]}`,
          ]),
          { flag: "wx" },
        );
        chmodSync(
          temporary,
          modeAt(before.candidateRoot, commit, repoPaths[index]),
        );
        preparedFiles[index] = temporary;
      }

      for (const [index, original] of originals.entries()) {
        if (deleted.includes(changedAbsolute[index]))
          rmSync(original.canonical, { force: true });
        else renameSync(preparedFiles[index], original.canonical);
        appliedIndexes.push(index);
      }
      // Installing the prepared index can no longer fail due to another Git
      // writer: this process owns index.lock. Keep that lock through ref CAS.
      renameSync(replacementIndex, indexPath);
      try {
        git(before.repositoryRoot, ["update-ref", before.ref, commit, current]);
      } catch (error) {
        // update-ref may have succeeded before its caller observed an error.
        if (git(before.repositoryRoot, ["rev-parse", before.ref]) !== commit)
          throw error;
      }

      if (git(before.repositoryRoot, ["rev-parse", before.ref]) !== commit)
        throw new Error(`Branch did not advance to verified commit ${commit}`);
      for (const [index, path] of repoPaths.entries()) {
        if (deleted.includes(changedAbsolute[index])) continue;
        if (
          digestBytes(
            gitBytes(before.repositoryRoot, ["show", `${commit}:${path}`]),
          ) !==
          digest(resolve(before.canonicalProjectRoot, projectPaths[index]))
        )
          throw new Error(
            `Commit ${commit} canonical byte read-back failed for ${path}`,
          );
      }
    } catch (error) {
      const failures: string[] = [];
      try {
        const observed = git(before.repositoryRoot, ["rev-parse", before.ref]);
        if (observed === commit) {
          git(before.repositoryRoot, [
            "update-ref",
            before.ref,
            current,
            commit,
          ]);
        }
      } catch (rollbackError) {
        failures.push(`branch rollback failed: ${String(rollbackError)}`);
      }
      failures.push(...rollback());
      if (failures.length) {
        throw new Error(`${String(error)}; ${failures.join("; ")}`);
      }
      throw error;
    } finally {
      for (const temporary of preparedFiles)
        if (temporary) rmSync(temporary, { force: true });
      rmSync(replacementIndex, { force: true });
      rmSync(originalIndex, { force: true });
      if (ownsIndexLock) rmSync(indexLock, { force: true });
    }
    const changedOutputs = projectPaths
      .filter((_, index) => !deleted.includes(changedAbsolute[index]))
      .map((path) => resolve(before.canonicalProjectRoot, path));
    const outputs = [...new Set([...reportedOutputs, ...changedOutputs])];
    verifyCanonicalOutputPaths(before, commit, outputs);
    cleanup(before);
    return {
      state: "committed",
      commit,
      parent,
      files: committed,
      outputs,
    };
  } catch (error) {
    retainFailure(before, error);
  }
}

export function canonicalOutputPaths(
  snapshot: KnowledgeSnapshot,
  outputs: string[],
): string[] {
  return [
    ...new Set(
      outputs.map((output) => {
        const resolved = resolve(output);
        let projectPath: string;
        const candidateRelative = relative(snapshot.projectRoot, resolved);
        if (
          candidateRelative &&
          candidateRelative !== ".." &&
          !candidateRelative.startsWith(`..${sep}`)
        ) {
          assertSafeFile(snapshot, resolved);
          projectPath = candidateRelative;
        } else {
          const canonicalRelative = relative(
            snapshot.canonicalProjectRoot,
            resolved,
          );
          if (
            !canonicalRelative ||
            canonicalRelative === ".." ||
            canonicalRelative.startsWith(`..${sep}`)
          )
            throw new Error(
              `Reported output is outside Scout durable roots: ${output}`,
            );
          assertCanonicalFile(snapshot, canonicalRelative);
          projectPath = canonicalRelative;
        }
        const root = projectPath.split(sep)[0];
        if (root !== "knowledge" && root !== "reports")
          throw new Error(
            `Reported output is outside Scout durable roots: ${output}`,
          );
        const repoPath = repositoryPath(snapshot, projectPath);
        if (snapshot.canonicalDirty.has(repoPath))
          throw new Error(`Reported output was already dirty: ${repoPath}`);
        const candidate = resolve(snapshot.projectRoot, projectPath);
        assertSafeFile(snapshot, candidate);
        if (!existsSync(candidate))
          throw new Error(
            `Reported output is absent from the candidate: ${output}`,
          );
        return resolve(snapshot.canonicalProjectRoot, projectPath);
      }),
    ),
  ];
}

function verifyReportedRevision(
  snapshot: KnowledgeSnapshot,
  revision: string,
  expected: Map<string, string>,
): void {
  for (const [output, hash] of expected) {
    const path = repositoryPath(
      snapshot,
      relative(snapshot.canonicalProjectRoot, output),
    );
    const bytes = gitBytes(snapshot.repositoryRoot, [
      "show",
      `${revision}:${path}`,
    ]);
    if (digestBytes(bytes) !== hash)
      throw new Error(
        `Reviewed output changed in publication revision ${revision}: ${path}`,
      );
  }
}

export function verifyCanonicalOutputPaths(
  snapshot: KnowledgeSnapshot,
  revision: string,
  outputs: string[],
): void {
  for (const output of outputs) {
    const projectPath = relative(snapshot.canonicalProjectRoot, output);
    assertCanonicalFile(snapshot, projectPath);
    const repoPath = repositoryPath(snapshot, projectPath);
    let committed: Buffer;
    try {
      committed = gitBytes(snapshot.repositoryRoot, [
        "show",
        `${revision}:${repoPath}`,
      ]);
    } catch {
      throw new Error(
        `Reported output is absent from publication revision ${revision}: ${repoPath}`,
      );
    }
    if (digestBytes(committed) !== digest(output))
      throw new Error(
        `Reported output does not match publication revision ${revision}: ${repoPath}`,
      );
  }
}

export function publicationFacts(evidence: PublicationEvidence): string[] {
  return evidence.state === "unchanged"
    ? ["publication:no-change", `publication-head:${evidence.commit}`]
    : [
        `publication:commit:${evidence.commit}`,
        `publication-parent:${evidence.parent}`,
        ...evidence.files.map((path) => `publication-file:${path}`),
        ...evidence.outputs.map((path) => `published-output:${path}`),
      ];
}
