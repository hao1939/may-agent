import { constants } from "node:fs";
import {
  type FileHandle,
  lstat,
  open,
  readdir,
  realpath,
} from "node:fs/promises";
import { isAbsolute } from "node:path";
import {
  descriptorPath,
  readRegularChildNoFollow,
} from "./descriptor-safe-local-evidence";
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
  directory: FileHandle,
  prefix: string,
  errors: string[],
  files: Map<string, Uint8Array>,
): Promise<void> {
  const entries = await readdir(descriptorPath(directory), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      errors.push(`symbolic links are not allowed in a freeze bundle: ${name}`);
      continue;
    }
    if (entry.isDirectory()) {
      let child: FileHandle | undefined;
      try {
        child = await open(
          descriptorPath(directory, entry.name),
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
        const status = await child.stat();
        if (!status.isDirectory()) throw new Error("entry is not a directory");
        await collectFiles(child, name, errors, files);
      } catch (error) {
        errors.push(
          `bundle directory could not be opened without following symbolic links: ${name}: ${String(error)}`,
        );
      } finally {
        await child?.close();
      }
      continue;
    }
    if (!entry.isFile()) {
      errors.push(`non-regular bundle entry is not allowed: ${name}`);
      continue;
    }
    if (name !== MANIFEST_NAME) {
      try {
        files.set(name, await readRegularChildNoFollow(directory, entry.name));
      } catch (error) {
        errors.push(
          `bundle entry could not be opened without following symbolic links: ${name}: ${String(error)}`,
        );
      }
    }
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

  let rootHandle: FileHandle | undefined;
  try {
    const rootStatus = await lstat(bundleRoot);
    if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
      return failed(["bundle root must be a real directory, not a symlink"]);
    }
    const root = await realpath(bundleRoot);
    rootHandle = await open(
      root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const openedStatus = await rootHandle.stat();
    if (
      openedStatus.dev !== rootStatus.dev ||
      openedStatus.ino !== rootStatus.ino
    ) {
      await rootHandle.close();
      rootHandle = undefined;
      return failed(["bundle root changed while it was being opened"]);
    }
  } catch (error) {
    await rootHandle?.close();
    return failed([`bundle root is not readable: ${String(error)}`]);
  }

  try {
    let manifest: unknown;
    try {
      manifest = JSON.parse(
        new TextDecoder().decode(
          await readRegularChildNoFollow(rootHandle, MANIFEST_NAME),
        ),
      ) as unknown;
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
      await collectFiles(rootHandle, "", errors, files);
    } catch (error) {
      errors.push(`freeze bundle could not be inventoried: ${String(error)}`);
    }
    if (errors.length > 0) return failed(errors);

    return verifyExecutionFreezeManifest(manifest, Object.fromEntries(files));
  } finally {
    await rootHandle.close();
  }
}
