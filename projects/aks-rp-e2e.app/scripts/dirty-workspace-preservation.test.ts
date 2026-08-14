import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  preserveDirtyWorkspace,
  requireExactPreservation,
  verifyDirtyWorkspaceSnapshot,
} from "./lib/dirty-workspace-preservation.ts";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout.trim();
}

function fixture(): { root: string; workspace: string; artifacts: string } {
  const root = mkdtempSync(join(tmpdir(), "dirty-preservation-test-"));
  temporaryRoots.push(root);
  const workspace = join(root, "workspace");
  const artifacts = join(root, "artifacts");
  mkdirSync(workspace);
  git(workspace, "init", "--quiet");
  git(workspace, "config", "user.email", "test@example.invalid");
  git(workspace, "config", "user.name", "Preservation Test");
  writeFileSync(join(workspace, "tracked.bin"), Buffer.from([0, 1, 2, 3, 255]));
  writeFileSync(join(workspace, "tracked.txt"), "baseline\n");
  git(workspace, "add", ".");
  git(workspace, "commit", "--quiet", "-m", "baseline");
  return { root, workspace, artifacts };
}

function dirty(f: ReturnType<typeof fixture>): void {
  writeFileSync(
    join(f.workspace, "tracked.bin"),
    Buffer.from([0, 9, 2, 7, 255]),
  );
  writeFileSync(join(f.workspace, "tracked.txt"), "changed tracked bytes\n");
  writeFileSync(
    join(f.workspace, "untracked.bin"),
    Buffer.from([222, 173, 190, 239, 0]),
  );
}

describe("dirty workspace byte preservation", () => {
  test("atomically snapshots and reconstructs tracked binary patch plus untracked bytes", () => {
    const f = fixture();
    dirty(f);

    const { snapshotDir, receipt } = preserveDirtyWorkspace({
      workspacePath: f.workspace,
      artifactRoot: f.artifacts,
      snapshotId: "snapshot-success",
    });
    const verified = verifyDirtyWorkspaceSnapshot(snapshotDir);

    expect(existsSync(join(snapshotDir, "manifest.json"))).toBe(true);
    expect(existsSync(join(snapshotDir, "tracked.patch"))).toBe(true);
    expect(receipt.integrity).toBe("complete");
    expect(receipt.exactPreservation).toBe(true);
    expect(verified.verification.reconstructedTrackedPatchSha256).toBe(
      receipt.trackedPatch.sha256,
    );
    expect(receipt.paths.map((row) => `${row.kind}:${row.path}`)).toEqual([
      "tracked:tracked.bin",
      "tracked:tracked.txt",
      "untracked:untracked.bin",
    ]);
    for (const row of receipt.paths.filter(
      (entry) => entry.state === "present",
    )) {
      expect(row.blobSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(existsSync(join(snapshotDir, "blobs", row.blobSha256!))).toBe(
        true,
      );
    }
  });

  test("rejects checksum mismatch instead of issuing exact-preservation admission", () => {
    const f = fixture();
    dirty(f);
    const { snapshotDir } = preserveDirtyWorkspace({
      workspacePath: f.workspace,
      artifactRoot: f.artifacts,
      snapshotId: "snapshot-mismatch",
    });
    writeFileSync(join(snapshotDir, "tracked.patch"), "tampered patch bytes\n");

    expect(() => requireExactPreservation(snapshotDir)).toThrow(
      /tracked patch checksum mismatch/,
    );
  });

  test("rejects a receipt whose recoverable artifact is missing", () => {
    const f = fixture();
    dirty(f);
    const { snapshotDir } = preserveDirtyWorkspace({
      workspacePath: f.workspace,
      artifactRoot: f.artifacts,
      snapshotId: "snapshot-missing",
    });
    rmSync(join(snapshotDir, "tracked.patch"));

    expect(() => requireExactPreservation(snapshotDir)).toThrow(
      /tracked patch artifact is missing/,
    );
  });

  test("preserved receipt remains tied to original bytes after workspace continues evolving", () => {
    const f = fixture();
    dirty(f);
    const { snapshotDir, receipt } = preserveDirtyWorkspace({
      workspacePath: f.workspace,
      artifactRoot: f.artifacts,
      snapshotId: "snapshot-before-evolution",
    });

    writeFileSync(join(f.workspace, "tracked.bin"), Buffer.from([8, 8, 8, 8]));
    writeFileSync(join(f.workspace, "untracked.bin"), "descendant content\n");
    const descendantPatch = Buffer.from(
      git(f.workspace, "diff", "--binary", "--full-index", "HEAD", "--"),
    );
    rmSync(f.workspace, { recursive: true, force: true });
    const verified = requireExactPreservation(snapshotDir);

    expect(verified.aggregateFingerprint).toBe(receipt.aggregateFingerprint);
    expect(verified.trackedPatch.sha256).toBe(receipt.trackedPatch.sha256);
    expect(readFileSync(join(snapshotDir, "tracked.patch"))).not.toEqual(
      descendantPatch,
    );
  });

  test("fails closed for checksum-only inventory metadata", () => {
    const f = fixture();
    const checksumOnly = join(f.artifacts, "checksum-only");
    mkdirSync(checksumOnly, { recursive: true });
    writeFileSync(
      join(checksumOnly, "manifest.json"),
      JSON.stringify({
        paths: ["tracked.bin"],
        checksums: { "tracked.bin": "abc" },
      }),
    );

    expect(() => requireExactPreservation(checksumOnly)).toThrow(
      /checksum\/path inventory is not exact preservation|does not attest a verified recoverable byte artifact/,
    );
  });
});
