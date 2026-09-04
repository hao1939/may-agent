import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, lstat, open, realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";

export type DescriptorSafeLocalEvidenceResult = {
  ok: boolean;
  sha256: string;
  byteLength: number;
  bytes: Uint8Array | null;
  errors: string[];
  evidenceStatus: "local-byte-match-unverified" | "";
  scopeLimit: string;
};

function failed(error: string): DescriptorSafeLocalEvidenceResult {
  return {
    ok: false,
    sha256: "",
    byteLength: 0,
    bytes: null,
    errors: [error],
    evidenceStatus: "",
    scopeLimit:
      "A descriptor-safe local byte match proves file integrity for one read. It does not prove authorship, authority, independence, timestamp validity, or substantive correctness.",
  };
}

export function descriptorPath(parent: FileHandle, name = ""): string {
  const root = `/proc/self/fd/${parent.fd}`;
  return name ? `${root}/${name}` : root;
}

export async function readRegularChildNoFollow(
  parent: FileHandle,
  name: string,
): Promise<Uint8Array> {
  const handle = await open(
    descriptorPath(parent, name),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const status = await handle.stat();
    if (!status.isFile()) throw new Error("entry is not a regular file");
    return new Uint8Array(await handle.readFile());
  } finally {
    await handle.close();
  }
}

export function isCanonicalRelativeEvidenceName(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    value.includes("\0") ||
    isAbsolute(value)
  ) {
    return false;
  }
  return value
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export async function readDescriptorSafeLocalEvidence(
  evidenceRoot: string,
  artifactName: string,
  expectedSha256: string,
): Promise<DescriptorSafeLocalEvidenceResult> {
  if (!isAbsolute(evidenceRoot)) {
    return failed("evidence root must be an explicit absolute path");
  }
  if (!isCanonicalRelativeEvidenceName(artifactName)) {
    return failed("evidence artifact must be a canonical relative path");
  }
  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) {
    return failed("expected evidence SHA-256 is invalid");
  }

  let rootHandle: FileHandle | undefined;
  const directoryHandles: FileHandle[] = [];
  try {
    const rootStatus = await lstat(evidenceRoot);
    if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) {
      return failed("evidence root must be a real directory, not a symlink");
    }
    const root = await realpath(evidenceRoot);
    rootHandle = await open(
      root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const openedStatus = await rootHandle.stat();
    if (
      openedStatus.dev !== rootStatus.dev ||
      openedStatus.ino !== rootStatus.ino
    ) {
      return failed("evidence root changed while it was being opened");
    }

    const segments = artifactName.split("/");
    let directory = rootHandle;
    for (const segment of segments.slice(0, -1)) {
      const child = await open(
        descriptorPath(directory, segment),
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      directoryHandles.push(child);
      const status = await child.stat();
      if (!status.isDirectory()) throw new Error("entry is not a directory");
      directory = child;
    }
    const bytes = await readRegularChildNoFollow(directory, segments.at(-1)!);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== expectedSha256) {
      return failed("local evidence bytes do not match the declared SHA-256");
    }
    return {
      ok: true,
      sha256,
      byteLength: bytes.byteLength,
      bytes,
      errors: [],
      evidenceStatus: "local-byte-match-unverified",
      scopeLimit:
        "A descriptor-safe local byte match proves file integrity for one read. It does not prove authorship, authority, independence, timestamp validity, or substantive correctness.",
    };
  } catch (error) {
    return failed(
      `local evidence is not readable without following links: ${String(error)}`,
    );
  } finally {
    for (const handle of directoryHandles.reverse()) await handle.close();
    await rootHandle?.close();
  }
}
