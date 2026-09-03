import { describe, expect, it } from "bun:test";
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
  });
});
