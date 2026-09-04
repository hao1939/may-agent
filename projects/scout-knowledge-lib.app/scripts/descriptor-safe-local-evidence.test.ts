import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDescriptorSafeLocalEvidence } from "./descriptor-safe-local-evidence";

const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "scout-policy-evidence-"));
  roots.push(root);
  await mkdir(join(root, "decisions"));
  const bytes = '{"decision":"synthetic fixture"}\n';
  await writeFile(join(root, "decisions", "policy.json"), bytes);
  return {
    root,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("descriptor-safe local evidence", () => {
  it("reads one nested regular file through pinned descriptors", async () => {
    const { root, bytes, sha256 } = await fixture();
    const result = await readDescriptorSafeLocalEvidence(
      root,
      "decisions/policy.json",
      sha256,
    );
    expect(result).toMatchObject({
      ok: true,
      sha256,
      byteLength: Buffer.byteLength(bytes),
      evidenceStatus: "local-byte-match-unverified",
      errors: [],
    });
    expect(new TextDecoder().decode(result.bytes!)).toBe(bytes);
  });

  it("rejects relative roots, traversal, and byte mismatches", async () => {
    const { root } = await fixture();
    expect(
      await readDescriptorSafeLocalEvidence(
        "relative",
        "policy.json",
        "a".repeat(64),
      ),
    ).toMatchObject({
      ok: false,
      errors: ["evidence root must be an explicit absolute path"],
    });
    expect(
      await readDescriptorSafeLocalEvidence(
        root,
        "../policy.json",
        "a".repeat(64),
      ),
    ).toMatchObject({
      ok: false,
      errors: ["evidence artifact must be a canonical relative path"],
    });
    expect(
      await readDescriptorSafeLocalEvidence(
        root,
        "decisions/policy.json",
        "a".repeat(64),
      ),
    ).toMatchObject({
      ok: false,
      errors: ["local evidence bytes do not match the declared SHA-256"],
    });
  });

  it("rejects symlink roots, directories, and final files", async () => {
    const { root, sha256 } = await fixture();
    const linkedRoot = `${root}-link`;
    roots.push(linkedRoot);
    await symlink(root, linkedRoot);
    expect(
      await readDescriptorSafeLocalEvidence(
        linkedRoot,
        "decisions/policy.json",
        sha256,
      ),
    ).toMatchObject({
      ok: false,
      errors: ["evidence root must be a real directory, not a symlink"],
    });

    await symlink("decisions", join(root, "linked-decisions"));
    expect(
      await readDescriptorSafeLocalEvidence(
        root,
        "linked-decisions/policy.json",
        sha256,
      ),
    ).toMatchObject({ ok: false });

    await symlink("policy.json", join(root, "decisions", "linked-policy.json"));
    expect(
      await readDescriptorSafeLocalEvidence(
        root,
        "decisions/linked-policy.json",
        sha256,
      ),
    ).toMatchObject({ ok: false });
  });
});
