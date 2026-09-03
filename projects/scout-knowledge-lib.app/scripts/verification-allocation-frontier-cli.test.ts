import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  parseIdentityRobustFrontierCliInput,
  parseIdentityRobustSnapshotFrontierCliInput,
} from "./verification-allocation-frontier-cli";

describe("identity-robust frontier CLI input", () => {
  it("allows no policy or one policy, manifest, and evidence root", () => {
    expect(parseIdentityRobustFrontierCliInput([])).toBeNull();
    expect(
      parseIdentityRobustFrontierCliInput([
        "--policy-json",
        '{"policy":true}',
        "--evidence-manifest-json",
        '{"manifest":true}',
        "--evidence-root",
        "/goal-owned/evidence",
        "--freeze-bundle-root",
        "/goal-owned/freeze",
      ]),
    ).toEqual({
      policyCandidate: { policy: true },
      evidenceManifestCandidate: { manifest: true },
      evidenceRoot: "/goal-owned/evidence",
      freezeBundleRoot: "/goal-owned/freeze",
    });
  });

  it("parses one explicit snapshot-backed selection input", () => {
    expect(
      parseIdentityRobustSnapshotFrontierCliInput([
        "--snapshot-root",
        "/goal-owned/snapshots",
        "--snapshot-artifact",
        "frontier.json",
        "--snapshot-sha256",
        "a".repeat(64),
        "--policy-json",
        '{"policy":true}',
        "--evidence-manifest-json",
        '{"manifest":true}',
        "--evidence-root",
        "/goal-owned/evidence",
        "--freeze-bundle-root",
        "/goal-owned/freeze",
      ]),
    ).toEqual({
      snapshotRoot: "/goal-owned/snapshots",
      snapshotArtifact: "frontier.json",
      snapshotSha256: "a".repeat(64),
      policyCandidate: { policy: true },
      evidenceManifestCandidate: { manifest: true },
      evidenceRoot: "/goal-owned/evidence",
      freezeBundleRoot: "/goal-owned/freeze",
    });
  });

  it("parses a descriptor-safe local manifest without parsing its bytes inline", () => {
    const manifestInput = {
      schema: "scout.verification-allocation-local-policy-manifest-input/v1",
      manifestArtifact: "policies/manifest.json",
      manifestSha256: "b".repeat(64),
    };
    expect(
      parseIdentityRobustFrontierCliInput([
        "--policy-json",
        '{"policy":true}',
        "--evidence-manifest-artifact",
        manifestInput.manifestArtifact,
        "--evidence-manifest-sha256",
        manifestInput.manifestSha256,
        "--evidence-root",
        "/goal-owned/evidence",
        "--freeze-bundle-root",
        "/goal-owned/freeze",
      ]),
    ).toEqual({
      policyCandidate: { policy: true },
      evidenceManifestCandidate: manifestInput,
      evidenceRoot: "/goal-owned/evidence",
      freezeBundleRoot: "/goal-owned/freeze",
    });
    expect(
      parseIdentityRobustSnapshotFrontierCliInput([
        "--snapshot-root",
        "/goal-owned/snapshots",
        "--snapshot-artifact",
        "frontier.json",
        "--snapshot-sha256",
        "a".repeat(64),
        "--policy-json",
        '{"policy":true}',
        "--evidence-manifest-artifact",
        manifestInput.manifestArtifact,
        "--evidence-manifest-sha256",
        manifestInput.manifestSha256,
        "--evidence-root",
        "/goal-owned/evidence",
        "--freeze-bundle-root",
        "/goal-owned/freeze",
      ]),
    ).toEqual({
      snapshotRoot: "/goal-owned/snapshots",
      snapshotArtifact: "frontier.json",
      snapshotSha256: "a".repeat(64),
      policyCandidate: { policy: true },
      evidenceManifestCandidate: manifestInput,
      evidenceRoot: "/goal-owned/evidence",
      freezeBundleRoot: "/goal-owned/freeze",
    });
  });

  it("rejects partial, reordered, and malformed inputs", () => {
    for (const args of [
      ["--policy-json", "{}"],
      [
        "--evidence-manifest-json",
        "{}",
        "--policy-json",
        "{}",
        "--evidence-root",
        "/tmp/evidence",
        "--freeze-bundle-root",
        "/tmp/freeze",
      ],
    ]) {
      expect(() => parseIdentityRobustFrontierCliInput(args)).toThrow(
        "optional usage",
      );
    }
    expect(() =>
      parseIdentityRobustFrontierCliInput([
        "--policy-json",
        "not-json",
        "--evidence-manifest-json",
        "{}",
        "--evidence-root",
        "/tmp/evidence",
        "--freeze-bundle-root",
        "/tmp/freeze",
      ]),
    ).toThrow("must contain valid JSON");
  });

  it("rejects duplicate keys in either inline JSON argument", () => {
    for (const [policyJson, evidenceJson] of [
      ['{"policy":true,"policy":true}', '{"manifest":true}'],
      ['{"policy":true}', '{"manifest":true,"manifest":true}'],
    ]) {
      expect(() =>
        parseIdentityRobustFrontierCliInput([
          "--policy-json",
          policyJson!,
          "--evidence-manifest-json",
          evidenceJson!,
          "--evidence-root",
          "/tmp/evidence",
          "--freeze-bundle-root",
          "/tmp/freeze",
        ]),
      ).toThrow("must not contain duplicate JSON object keys");
    }
  });

  it("rejects partial or reordered snapshot-backed input", () => {
    expect(() =>
      parseIdentityRobustSnapshotFrontierCliInput([
        "--snapshot-artifact",
        "frontier.json",
      ]),
    ).toThrow("snapshot usage");
    expect(() =>
      parseIdentityRobustFrontierCliInput([
        "--policy-json",
        '{"policy":true,"policy":true}',
        "--evidence-manifest-artifact",
        "policies/manifest.json",
        "--evidence-manifest-sha256",
        "a".repeat(64),
        "--evidence-root",
        "/tmp/evidence",
        "--freeze-bundle-root",
        "/tmp/freeze",
      ]),
    ).toThrow("policy argument must not contain duplicate JSON object keys");
    for (const [artifact, sha256, message] of [
      ["../manifest.json", "a".repeat(64), "canonical relative path"],
      ["policies/manifest.json", "A".repeat(64), "lowercase hex digits"],
      ["policies/manifest.json", "a".repeat(63), "lowercase hex digits"],
    ]) {
      const args = [
        "--policy-json",
        '{"policy":true}',
        "--evidence-manifest-artifact",
        artifact!,
        "--evidence-manifest-sha256",
        sha256!,
        "--evidence-root",
        "/tmp/evidence",
        "--freeze-bundle-root",
        "/tmp/freeze",
      ];
      expect(() => parseIdentityRobustFrontierCliInput(args)).toThrow(message!);
      expect(() =>
        parseIdentityRobustSnapshotFrontierCliInput([
          "--snapshot-root",
          "/tmp/snapshots",
          "--snapshot-artifact",
          "frontier.json",
          "--snapshot-sha256",
          "b".repeat(64),
          ...args,
        ]),
      ).toThrow(message!);
    }
  });

  it("rejects every unsafe filesystem input before adapter dispatch", () => {
    const inlineArgs = [
      "--policy-json",
      '{"policy":true}',
      "--evidence-manifest-json",
      '{"manifest":true}',
      "--evidence-root",
      "/goal-owned/evidence",
      "--freeze-bundle-root",
      "/goal-owned/freeze",
    ];
    for (const [index, value, message] of [
      [
        5,
        "relative/evidence",
        "evidence root must be an explicit absolute path",
      ],
      [
        7,
        "relative/freeze",
        "freeze bundle root must be an explicit absolute path",
      ],
      [
        5,
        "/goal-owned/evidence\0alias",
        "evidence root must be an explicit absolute path",
      ],
    ] as const) {
      const args = [...inlineArgs];
      args[index] = value;
      expect(() => parseIdentityRobustFrontierCliInput(args)).toThrow(message);
    }
    expect(() =>
      parseIdentityRobustFrontierCliInput([
        "--policy-json",
        '{"policy":true}',
        "--evidence-manifest-artifact",
        "policies/manifest.json",
        "--evidence-manifest-sha256",
        "b".repeat(64),
        "--evidence-root",
        "relative/evidence",
        "--freeze-bundle-root",
        "/goal-owned/freeze",
      ]),
    ).toThrow("evidence root must be an explicit absolute path");

    const snapshotArgs = [
      "--snapshot-root",
      "/goal-owned/snapshots",
      "--snapshot-artifact",
      "frontier.json",
      "--snapshot-sha256",
      "a".repeat(64),
      ...inlineArgs,
    ];
    for (const [index, value, message] of [
      [
        1,
        "relative/snapshots",
        "snapshot root must be an explicit absolute path",
      ],
      [
        1,
        "/goal-owned/snapshots\0alias",
        "snapshot root must be an explicit absolute path",
      ],
      [
        3,
        "../frontier.json",
        "snapshot artifact must be a canonical relative path",
      ],
      [5, "A".repeat(64), "snapshot SHA-256 must be 64 lowercase hex digits"],
      [5, "a".repeat(63), "snapshot SHA-256 must be 64 lowercase hex digits"],
    ] as const) {
      const args = [...snapshotArgs];
      args[index] = value;
      expect(() => parseIdentityRobustSnapshotFrontierCliInput(args)).toThrow(
        message,
      );
    }
  });

  it("rejects malformed direct process input before frontier workers start", async () => {
    const child = Bun.spawn(
      [
        "timeout",
        "--kill-after=1s",
        "1s",
        process.execPath,
        join(import.meta.dir, "verification-allocation-robust-frontier.ts"),
        "--policy-json",
        "{}",
        "--evidence-manifest-json",
        "{}",
        "--evidence-root",
        "relative/evidence",
        "--freeze-bundle-root",
        "/goal-owned/freeze",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(exitCode).not.toBe(124);
    expect(stdout).toBe("");
    expect(stderr).toContain("evidence root must be an explicit absolute path");
  });
});
