import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const MANIFEST_FILE = "manifest.json";
const PATCH_FILE = "tracked.patch";
const BASE_BUNDLE_FILE = "base.bundle";

export type PreservedPath = {
  path: string;
  kind: "tracked" | "untracked";
  state: "present" | "deleted";
  blobSha256: string | null;
  byteLength: number;
  fileType: "file" | "symlink" | "deleted";
  executable: boolean;
};

export type DirtyWorkspacePreservationReceipt = {
  schemaVersion: 1;
  integrity: "complete";
  exactPreservation: true;
  workspacePath: string;
  head: string;
  createdAt: string;
  baseBundle: {
    artifact: typeof BASE_BUNDLE_FILE;
    sha256: string;
    byteLength: number;
  };
  trackedPatch: {
    artifact: typeof PATCH_FILE;
    sha256: string;
    byteLength: number;
  };
  paths: PreservedPath[];
  aggregateFingerprint: string;
  verification: {
    reconstructedTrackedPatchSha256: string;
    verifiedAt: string;
  };
};

type GitResult = { status: number; stdout: Buffer; stderr: string };

function git(cwd: string, args: string[], input?: Buffer): GitResult {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    input,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 120_000,
  });
  const output = {
    status: result.status ?? 1,
    stdout: Buffer.from(result.stdout ?? []),
    stderr: Buffer.from(result.stderr ?? result.error?.message ?? [])
      .toString()
      .trim(),
  };
  if (output.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd}: ${output.stderr || output.stdout.toString()}`,
    );
  }
  return output;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function nulPaths(bytes: Buffer): string[] {
  return bytes.toString().split("\0").filter(Boolean);
}

function trackedPatch(workspacePath: string): Buffer {
  return git(workspacePath, [
    "diff",
    "--binary",
    "--full-index",
    "--no-ext-diff",
    "--no-textconv",
    "HEAD",
    "--",
  ]).stdout;
}

function assertSafeGitPath(path: string): void {
  if (
    !path ||
    isAbsolute(path) ||
    path === ".." ||
    path.startsWith(`..${sep}`) ||
    path.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`unsafe Git path in preservation manifest: ${path}`);
  }
}

function pathBytes(absolutePath: string): {
  bytes: Buffer;
  fileType: "file" | "symlink";
  executable: boolean;
} {
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    return {
      bytes: Buffer.from(readlinkSync(absolutePath)),
      fileType: "symlink",
      executable: false,
    };
  }
  if (!stat.isFile()) {
    throw new Error(
      `cannot exactly preserve non-file workspace path: ${absolutePath}`,
    );
  }
  return {
    bytes: readFileSync(absolutePath),
    fileType: "file",
    executable: Boolean(stat.mode & 0o100),
  };
}

function writeBlob(snapshotDir: string, bytes: Buffer): string {
  const digest = sha256(bytes);
  const path = join(snapshotDir, "blobs", digest);
  if (!existsSync(path)) writeFileSync(path, bytes, { flag: "wx" });
  return digest;
}

function canonicalFingerprint(
  patchSha256: string,
  paths: PreservedPath[],
): string {
  return sha256(
    JSON.stringify({
      trackedPatchSha256: patchSha256,
      paths: [...paths].sort((left, right) =>
        `${left.kind}:${left.path}`.localeCompare(
          `${right.kind}:${right.path}`,
        ),
      ),
    }),
  );
}

function readReceipt(snapshotDir: string): DirtyWorkspacePreservationReceipt {
  const manifestPath = join(snapshotDir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    throw new Error(
      "integrity-incomplete: preservation manifest is missing; checksum/path inventory is not exact preservation",
    );
  }
  const receipt = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as Partial<DirtyWorkspacePreservationReceipt>;
  if (
    receipt.schemaVersion !== 1 ||
    receipt.integrity !== "complete" ||
    receipt.exactPreservation !== true ||
    !receipt.baseBundle ||
    !receipt.trackedPatch ||
    !Array.isArray(receipt.paths) ||
    !receipt.verification
  ) {
    throw new Error(
      "integrity-incomplete: receipt does not attest a verified recoverable byte artifact",
    );
  }
  return receipt as DirtyWorkspacePreservationReceipt;
}

function validateArtifactBytes(
  snapshotDir: string,
  receipt: DirtyWorkspacePreservationReceipt,
): Buffer {
  const bundlePath = join(snapshotDir, receipt.baseBundle.artifact);
  if (!existsSync(bundlePath)) {
    throw new Error(
      "integrity-incomplete: base Git bundle artifact is missing",
    );
  }
  const bundle = readFileSync(bundlePath);
  if (
    bundle.byteLength !== receipt.baseBundle.byteLength ||
    sha256(bundle) !== receipt.baseBundle.sha256
  ) {
    throw new Error("integrity-incomplete: base Git bundle checksum mismatch");
  }
  const patchPath = join(snapshotDir, receipt.trackedPatch.artifact);
  if (!existsSync(patchPath)) {
    throw new Error("integrity-incomplete: tracked patch artifact is missing");
  }
  const patch = readFileSync(patchPath);
  if (
    patch.byteLength !== receipt.trackedPatch.byteLength ||
    sha256(patch) !== receipt.trackedPatch.sha256
  ) {
    throw new Error("integrity-incomplete: tracked patch checksum mismatch");
  }
  for (const row of receipt.paths) {
    assertSafeGitPath(row.path);
    if (row.state === "deleted") continue;
    if (!row.blobSha256) {
      throw new Error(
        `integrity-incomplete: ${row.path} has no recoverable blob`,
      );
    }
    const blobPath = join(snapshotDir, "blobs", row.blobSha256);
    if (!existsSync(blobPath)) {
      throw new Error(
        `integrity-incomplete: blob artifact is missing for ${row.path}`,
      );
    }
    const bytes = readFileSync(blobPath);
    if (
      bytes.byteLength !== row.byteLength ||
      sha256(bytes) !== row.blobSha256
    ) {
      throw new Error(
        `integrity-incomplete: blob checksum mismatch for ${row.path}`,
      );
    }
  }
  if (
    canonicalFingerprint(receipt.trackedPatch.sha256, receipt.paths) !==
    receipt.aggregateFingerprint
  ) {
    throw new Error(
      "integrity-incomplete: aggregate manifest fingerprint mismatch",
    );
  }
  return patch;
}

function reconstructAndFingerprint(
  snapshotDir: string,
  receipt: DirtyWorkspacePreservationReceipt,
  patch: Buffer,
): string {
  const temporaryRoot = mkdtempSync(
    join(tmpdir(), "aks-dirty-snapshot-verify-"),
  );
  const reconstruction = join(temporaryRoot, "workspace");
  try {
    git(temporaryRoot, [
      "clone",
      "--quiet",
      join(snapshotDir, receipt.baseBundle.artifact),
      reconstruction,
    ]);
    git(reconstruction, ["checkout", "--quiet", "--detach", receipt.head]);
    if (patch.byteLength)
      git(
        reconstruction,
        ["apply", "--binary", "--whitespace=nowarn", "-"],
        patch,
      );
    for (const row of receipt.paths.filter(
      (entry) => entry.kind === "untracked",
    )) {
      assertSafeGitPath(row.path);
      if (!row.blobSha256 || row.state !== "present") {
        throw new Error(
          `integrity-incomplete: untracked path ${row.path} is not recoverable`,
        );
      }
      const destination = join(reconstruction, row.path);
      mkdirSync(dirname(destination), { recursive: true });
      const bytes = readFileSync(join(snapshotDir, "blobs", row.blobSha256));
      if (row.fileType === "symlink")
        symlinkSync(bytes.toString(), destination);
      else {
        writeFileSync(destination, bytes, { flag: "wx" });
        if (row.executable) chmodSync(destination, 0o755);
      }
    }
    return sha256(trackedPatch(reconstruction));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export function verifyDirtyWorkspaceSnapshot(
  snapshotDir: string,
): DirtyWorkspacePreservationReceipt {
  const resolvedSnapshot = resolve(snapshotDir);
  const receipt = readReceipt(resolvedSnapshot);
  const patch = validateArtifactBytes(resolvedSnapshot, receipt);
  const reconstructed = reconstructAndFingerprint(
    resolvedSnapshot,
    receipt,
    patch,
  );
  if (reconstructed !== receipt.trackedPatch.sha256) {
    throw new Error(
      `integrity-incomplete: reconstructed tracked patch fingerprint ${reconstructed} does not match ${receipt.trackedPatch.sha256}`,
    );
  }
  if (receipt.verification.reconstructedTrackedPatchSha256 !== reconstructed) {
    throw new Error(
      "integrity-incomplete: verification receipt fingerprint mismatch",
    );
  }
  return receipt;
}

export function requireExactPreservation(
  snapshotDir: string,
): DirtyWorkspacePreservationReceipt {
  return verifyDirtyWorkspaceSnapshot(snapshotDir);
}

export function preserveDirtyWorkspace(options: {
  workspacePath: string;
  artifactRoot: string;
  snapshotId?: string;
}): { snapshotDir: string; receipt: DirtyWorkspacePreservationReceipt } {
  const workspacePath = resolve(options.workspacePath);
  const artifactRoot = resolve(options.artifactRoot);
  const rootFromWorkspace = relative(workspacePath, artifactRoot);
  if (
    !rootFromWorkspace ||
    (!rootFromWorkspace.startsWith("..") && !isAbsolute(rootFromWorkspace))
  ) {
    throw new Error(
      "preservation artifact root must be outside the evolving source workspace",
    );
  }
  const head = git(workspacePath, ["rev-parse", "HEAD"])
    .stdout.toString()
    .trim();
  const patch = trackedPatch(workspacePath);
  const tracked = nulPaths(
    git(workspacePath, ["diff", "--name-only", "-z", "HEAD", "--"]).stdout,
  );
  const untracked = nulPaths(
    git(workspacePath, ["ls-files", "--others", "--exclude-standard", "-z"])
      .stdout,
  );
  if (!patch.byteLength && !untracked.length) {
    throw new Error("workspace is clean; no dirty bytes require preservation");
  }

  mkdirSync(artifactRoot, { recursive: true });
  const snapshotId = options.snapshotId ?? `${Date.now()}-${randomUUID()}`;
  const snapshotDir = join(artifactRoot, snapshotId);
  const temporaryDir = join(artifactRoot, `.${snapshotId}.tmp-${randomUUID()}`);
  if (existsSync(snapshotDir))
    throw new Error(`snapshot already exists: ${snapshotDir}`);
  mkdirSync(join(temporaryDir, "blobs"), { recursive: true });

  try {
    git(workspacePath, [
      "bundle",
      "create",
      join(temporaryDir, BASE_BUNDLE_FILE),
      "HEAD",
    ]);
    writeFileSync(join(temporaryDir, PATCH_FILE), patch, { flag: "wx" });
    const paths: PreservedPath[] = [];
    for (const path of tracked) {
      assertSafeGitPath(path);
      const absolute = join(workspacePath, path);
      if (!existsSync(absolute)) {
        paths.push({
          path,
          kind: "tracked",
          state: "deleted",
          blobSha256: null,
          byteLength: 0,
          fileType: "deleted",
          executable: false,
        });
        continue;
      }
      const content = pathBytes(absolute);
      paths.push({
        path,
        kind: "tracked",
        state: "present",
        blobSha256: writeBlob(temporaryDir, content.bytes),
        byteLength: content.bytes.byteLength,
        fileType: content.fileType,
        executable: content.executable,
      });
    }
    for (const path of untracked) {
      assertSafeGitPath(path);
      const content = pathBytes(join(workspacePath, path));
      paths.push({
        path,
        kind: "untracked",
        state: "present",
        blobSha256: writeBlob(temporaryDir, content.bytes),
        byteLength: content.bytes.byteLength,
        fileType: content.fileType,
        executable: content.executable,
      });
    }
    const currentHead = git(workspacePath, ["rev-parse", "HEAD"])
      .stdout.toString()
      .trim();
    const currentTracked = nulPaths(
      git(workspacePath, ["diff", "--name-only", "-z", "HEAD", "--"]).stdout,
    );
    const currentUntracked = nulPaths(
      git(workspacePath, ["ls-files", "--others", "--exclude-standard", "-z"])
        .stdout,
    );
    if (
      currentHead !== head ||
      sha256(trackedPatch(workspacePath)) !== sha256(patch) ||
      JSON.stringify(currentTracked) !== JSON.stringify(tracked) ||
      JSON.stringify(currentUntracked) !== JSON.stringify(untracked)
    ) {
      throw new Error(
        "workspace changed while preservation bytes were captured; retry from a fresh inventory",
      );
    }
    for (const row of paths) {
      const absolute = join(workspacePath, row.path);
      if (row.state === "deleted") {
        if (existsSync(absolute))
          throw new Error(
            `workspace path changed during preservation: ${row.path}`,
          );
        continue;
      }
      if (
        !existsSync(absolute) ||
        sha256(pathBytes(absolute).bytes) !== row.blobSha256
      ) {
        throw new Error(
          `workspace bytes changed during preservation: ${row.path}`,
        );
      }
    }
    const bundle = readFileSync(join(temporaryDir, BASE_BUNDLE_FILE));
    const patchSha256 = sha256(patch);
    const receipt: DirtyWorkspacePreservationReceipt = {
      schemaVersion: 1,
      integrity: "complete",
      exactPreservation: true,
      workspacePath,
      head,
      createdAt: new Date().toISOString(),
      baseBundle: {
        artifact: BASE_BUNDLE_FILE,
        sha256: sha256(bundle),
        byteLength: bundle.byteLength,
      },
      trackedPatch: {
        artifact: PATCH_FILE,
        sha256: patchSha256,
        byteLength: patch.byteLength,
      },
      paths,
      aggregateFingerprint: canonicalFingerprint(patchSha256, paths),
      verification: {
        reconstructedTrackedPatchSha256: patchSha256,
        verifiedAt: new Date().toISOString(),
      },
    };
    writeFileSync(
      join(temporaryDir, MANIFEST_FILE),
      `${JSON.stringify(receipt, null, 2)}\n`,
      {
        flag: "wx",
      },
    );
    verifyDirtyWorkspaceSnapshot(temporaryDir);
    renameSync(temporaryDir, snapshotDir);
    return { snapshotDir, receipt: verifyDirtyWorkspaceSnapshot(snapshotDir) };
  } catch (error) {
    rmSync(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}
