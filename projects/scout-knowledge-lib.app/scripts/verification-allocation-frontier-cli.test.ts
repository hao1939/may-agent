import { describe, expect, it } from "bun:test";
import { parseIdentityRobustFrontierCliInput } from "./verification-allocation-frontier-cli";

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
      ]),
    ).toEqual({
      policyCandidate: { policy: true },
      evidenceManifestCandidate: { manifest: true },
      evidenceRoot: "/goal-owned/evidence",
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
      ]),
    ).toThrow("must contain valid JSON");
  });
});
