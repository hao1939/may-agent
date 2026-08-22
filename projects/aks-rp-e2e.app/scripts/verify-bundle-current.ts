#!/usr/bin/env bun
/**
 * Fail when the deployed workflow bundle is older than its TypeScript sources.
 *
 * The runtime executes `.state/bundle/**`, not the `.ts` files. `bun run check`
 * validates sources, so a change can pass every check, be committed, and still
 * never reach the running controller. That happened to the feature-compact
 * stranded-holder fix: the source landed at 11:14 and the bundle on disk was
 * still the 06:27 build, so three loop pulses reconciled against old code and
 * looked like a silent no-op.
 *
 * `.state/` is gitignored, so the bundle is deploy state rather than a build
 * artifact under review. This check makes the staleness loud instead of
 * invisible; `bun run bundle` is the fix it points at.
 */
import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const appDir = resolve(import.meta.dir, "..");
const bundleDir = join(appDir, ".state", "bundle");

/** Source trees whose changes must be re-bundled before the runtime sees them. */
const SOURCE_ROOTS = [
  "agents/app-ops/workflows",
  "agents/owner/workflows",
  "watchers",
];
const SOURCE_FILES = ["app.ts", "task-loops.ts"];

function newestSourceMtimeMs(): { path: string; mtimeMs: number } {
  let newest = { path: "", mtimeMs: 0 };

  const consider = (path: string): void => {
    if (!existsSync(path)) return;
    const stats = lstatSync(path);
    // Agent workspace directories may contain dependency symlinks (including
    // links back into another workspace). They are not bundle source and must
    // never be followed while checking source freshness.
    if (stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path)) consider(join(path, entry));
      return;
    }
    if (!path.endsWith(".ts") || path.endsWith(".test.ts")) return;
    if (stats.mtimeMs > newest.mtimeMs)
      newest = { path, mtimeMs: stats.mtimeMs };
  };

  for (const file of SOURCE_FILES) consider(join(appDir, file));
  for (const root of SOURCE_ROOTS) consider(join(appDir, root));
  return newest;
}

function oldestBundleMtimeMs(): { path: string; mtimeMs: number } | null {
  if (!existsSync(bundleDir)) return null;
  let oldest: { path: string; mtimeMs: number } | null = null;

  const consider = (path: string): void => {
    const stats = statSync(path);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(path)) consider(join(path, entry));
      return;
    }
    if (!path.endsWith(".js")) return;
    if (!oldest || stats.mtimeMs < oldest.mtimeMs)
      oldest = { path, mtimeMs: stats.mtimeMs };
  };

  consider(bundleDir);
  return oldest;
}

const source = newestSourceMtimeMs();
const bundle = oldestBundleMtimeMs();

if (!bundle) {
  console.error(
    `[bundle:verify] No bundle found at ${bundleDir}.\n` +
      `The runtime executes the bundle, not the TypeScript sources. Run: bun run bundle`,
  );
  process.exit(1);
}

if (source.mtimeMs > bundle.mtimeMs) {
  const relativeSource = source.path.replace(`${appDir}/`, "");
  const relativeBundle = bundle.path.replace(`${appDir}/`, "");
  console.error(
    `[bundle:verify] Deployed bundle is stale.\n` +
      `  newest source: ${relativeSource} (${new Date(source.mtimeMs).toISOString()})\n` +
      `  oldest bundle: ${relativeBundle} (${new Date(bundle.mtimeMs).toISOString()})\n` +
      `The runtime executes the bundle, so this change would not reach the live controller.\n` +
      `Run: bun run bundle`,
  );
  process.exit(1);
}

console.log(
  `[bundle:verify] Bundle is current (built ${new Date(bundle.mtimeMs).toISOString()}).`,
);
