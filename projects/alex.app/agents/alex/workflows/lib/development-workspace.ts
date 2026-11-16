import { lstat, readFile, realpath, stat, symlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { command } from "./repository.js";

type Mount = { path: string; source: string; created: boolean };

/** Restore the Apps repository's existing, ignored machine dependencies in a
 * linked Task worktree. Never install packages, replace a path or edit source. */
export async function prepareDevelopmentWorkspace(
  root: string,
  signal: AbortSignal,
): Promise<Mount[]> {
  let manifest: { dependencies?: Record<string, unknown> };
  try {
    manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const sdk = manifest.dependencies?.["@may-agent/sdk"];
  if (typeof sdk !== "string" || !/^file:(?:\.\/)?projects\/may-agent\//.test(sdk))
    return [];

  const requirements = [
    { path: "node_modules", marker: "typescript/bin/tsc" },
    { path: "projects/may-agent", marker: "packages/sdk/src/task-contract.ts" },
  ];
  const mounts: Mount[] = [];
  const pending: Mount[] = [];
  const common = resolve(await command(root,
    ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], signal));
  for (const requirement of requirements) {
    const target = join(root, requirement.path);
    try { await command(root, ["git", "check-ignore", "-q", "--", target], signal); }
    catch (error) {
      signal.throwIfAborted();
      throw new Error(`Development prerequisite path must be ignored before linking: ${target}`, { cause: error });
    }
    let present = false;
    try { await lstat(target); present = true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (present) {
      // Include dangling links in this branch: preserve them and report the
      // missing prerequisite instead of replacing existing machine state.
      try { await stat(join(target, requirement.marker)); }
      catch { throw new Error(`Development prerequisite unavailable: ${target}/${requirement.marker}; preserve the existing path and repair its setup before development`); }
      mounts.push({ path: target, source: await realpath(target), created: false });
      continue;
    }
    if (basename(common) !== ".git")
      throw new Error("Development prerequisites require existing ignored dependency paths; the shared Git directory does not identify a primary checkout");
    const source = join(dirname(common), requirement.path);
    try { await stat(join(source, requirement.marker)); }
    catch { throw new Error(`Development prerequisite unavailable: ${source}/${requirement.marker}; prepare the paired Runtime and installed dependencies before development`); }
    pending.push({ path: target, source: await realpath(source), created: true });
  }
  // Validate both prerequisites before making either link. The kernel-created
  // worktree already contains their tracked parent directories.
  for (const mount of pending) {
    signal.throwIfAborted();
    try { await symlink(mount.source, mount.path, "dir"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" ||
          await realpath(mount.path) !== mount.source) throw error;
      mount.created = false;
    }
    mounts.push(mount);
  }
  return mounts;
}
