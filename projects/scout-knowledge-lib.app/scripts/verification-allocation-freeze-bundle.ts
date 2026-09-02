import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  type FreezeVerificationResult,
  verifyExecutionFreezeManifest,
} from "./verification-allocation-freeze";

const MANIFEST_NAME = "freeze-manifest.json";

function failed(errors: string[]): FreezeVerificationResult {
  return {
    ok: false,
    errors,
    artifactCount: 0,
    modelCount: 0,
    seedCount: 0,
    episodeCount: 0,
    providerCallsAuthorized: false,
  };
}

function staysWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

function safeArtifactName(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.includes("\\") || value.includes("\0") || isAbsolute(value)) {
    return false;
  }
  const segments = value.split("/");
  return (
    value !== MANIFEST_NAME &&
    segments.every(
      (segment) => segment !== "" && segment !== "." && segment !== "..",
    )
  );
}

function declaredArtifactNames(manifest: unknown): unknown[] {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return [];
  }
  const artifacts = (manifest as Record<string, unknown>).artifacts;
  if (!Array.isArray(artifacts)) return [];
  return artifacts.map((artifact) =>
    artifact && typeof artifact === "object" && !Array.isArray(artifact)
      ? (artifact as Record<string, unknown>).name
      : undefined,
  );
}

async function collectFiles(
  root: string,
  directory: string,
  errors: string[],
  files: Map<string, Uint8Array>,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    const name = relative(root, path).split(sep).join("/");
    if (entry.isSymbolicLink()) {
      errors.push(`symbolic links are not allowed in a freeze bundle: ${name}`);
      continue;
    }
    if (entry.isDirectory()) {
      await collectFiles(root, path, errors, files);
      continue;
    }
    if (!entry.isFile()) {
      errors.push(`non-regular bundle entry is not allowed: ${name}`);
      continue;
    }
    const canonical = await realpath(path);
    if (!staysWithin(root, canonical)) {
      errors.push(`bundle entry escapes its root: ${name}`);
      continue;
    }
    if (name !== MANIFEST_NAME) files.set(name, await readFile(canonical));
  }
}

/**
 * Read and validate an explicit offline freeze directory without network or
 * provider calls. The caller remains responsible for supplying a goal-owned
 * path. This adapter rejects relative roots, symlinks, traversal-shaped
 * artifact names, non-regular entries, and undeclared files before delegating
 * byte and schedule validation to the freeze-manifest gate.
 */
export async function verifyExecutionFreezeBundle(
  bundleRoot: string,
): Promise<FreezeVerificationResult> {
  if (!isAbsolute(bundleRoot)) {
    return failed(["bundle root must be an explicit absolute path"]);
  }

  let root: string;
  try {
    const rootStatus = await lstat(bundleRoot);
    if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
      return failed(["bundle root must be a real directory, not a symlink"]);
    }
    root = await realpath(bundleRoot);
  } catch (error) {
    return failed([`bundle root is not readable: ${String(error)}`]);
  }

  const manifestPath = resolve(root, MANIFEST_NAME);
  let manifest: unknown;
  try {
    const manifestStatus = await lstat(manifestPath);
    if (manifestStatus.isSymbolicLink() || !manifestStatus.isFile()) {
      return failed(["freeze-manifest.json must be a regular file"]);
    }
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  } catch (error) {
    return failed([
      `freeze-manifest.json is not readable JSON: ${String(error)}`,
    ]);
  }

  const unsafeNames = declaredArtifactNames(manifest).filter(
    (name) => !safeArtifactName(name),
  );
  if (unsafeNames.length > 0) {
    return failed(
      unsafeNames.map(
        (name) =>
          `artifact name is not a canonical relative path: ${String(name)}`,
      ),
    );
  }

  const errors: string[] = [];
  const files = new Map<string, Uint8Array>();
  try {
    await collectFiles(root, root, errors, files);
  } catch (error) {
    errors.push(`freeze bundle could not be inventoried: ${String(error)}`);
  }
  if (errors.length > 0) return failed(errors);

  return verifyExecutionFreezeManifest(manifest, Object.fromEntries(files));
}
