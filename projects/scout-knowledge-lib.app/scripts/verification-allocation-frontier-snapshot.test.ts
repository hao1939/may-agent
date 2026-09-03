import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createIdentityRobustFrontierSnapshot,
  loadIdentityRobustFrontierSnapshot,
  verifyIdentityRobustFrontierSnapshot,
} from "./verification-allocation-frontier-snapshot";

const roots: string[] = [];
const frontier = [
  {
    runBlockCount: 1_029,
    episodeCount: 32_928,
    allocation: [171, 171, 171, 172, 172, 172],
    uniformDriftBuffer: 0.000007052630048557755,
  },
  {
    runBlockCount: 1_032,
    episodeCount: 33_024,
    allocation: [172, 172, 172, 172, 172, 172],
    uniformDriftBuffer: 0.0006254995932553816,
  },
];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("identity-robust frontier snapshot", () => {
  it("round-trips one exact descriptor-safe snapshot without provider authority", async () => {
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const bytes = `${JSON.stringify(snapshot)}\n`;
    const byteSha256 = createHash("sha256").update(bytes).digest("hex");
    const expected = {
      rowSha256: snapshot.rowSha256,
      resultSha256: snapshot.resultSha256,
      frontierSha256: snapshot.frontierSha256,
      frontierCount: snapshot.frontier.length,
    };
    const root = await mkdtemp(join(tmpdir(), "scout-frontier-snapshot-"));
    roots.push(root);
    await writeFile(join(root, "frontier.json"), bytes);

    expect(
      await loadIdentityRobustFrontierSnapshot(
        root,
        "frontier.json",
        byteSha256,
        expected,
      ),
    ).toMatchObject({
      ok: true,
      snapshot,
      errors: [],
      providerCallsAuthorized: false,
      snapshotByteSha256: byteSha256,
      snapshotByteLength: Buffer.byteLength(bytes),
      snapshotEvidenceStatus: "local-byte-match-unverified",
    });
  });

  it("rejects duplicate keys in a byte-matched frontier snapshot", async () => {
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const bytes = `${JSON.stringify(snapshot).replace(
      '"providerCallsAuthorized":false',
      '"providerCallsAuthorized":false,"providerCallsAuthorized":false',
    )}\n`;
    const byteSha256 = createHash("sha256").update(bytes).digest("hex");
    const root = await mkdtemp(join(tmpdir(), "scout-frontier-snapshot-"));
    roots.push(root);
    await writeFile(join(root, "frontier.json"), bytes);

    expect(
      await loadIdentityRobustFrontierSnapshot(
        root,
        "frontier.json",
        byteSha256,
        {
          rowSha256: snapshot.rowSha256,
          resultSha256: snapshot.resultSha256,
          frontierSha256: snapshot.frontierSha256,
          frontierCount: snapshot.frontier.length,
        },
      ),
    ).toMatchObject({
      ok: false,
      snapshot: null,
      errors: ["frontier snapshot contains duplicate JSON object keys"],
      providerCallsAuthorized: false,
      snapshotByteSha256: byteSha256,
      snapshotEvidenceStatus: "local-byte-match-unverified",
    });
  });

  it("rejects a point mutation, a self-consistent wrong computation, and extra authority", () => {
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    expect(
      verifyIdentityRobustFrontierSnapshot({
        ...snapshot,
        frontier: [
          { ...snapshot.frontier[0], uniformDriftBuffer: 0.0001 },
          snapshot.frontier[1],
        ],
      }),
    ).toMatchObject({
      ok: false,
      errors: ["frontier snapshot points do not match their SHA-256"],
      providerCallsAuthorized: false,
    });
    const wrongFrontier = [
      snapshot.frontier[0],
      { ...snapshot.frontier[1], uniformDriftBuffer: 0.0007 },
    ];
    const selfConsistentWrongSnapshot = createIdentityRobustFrontierSnapshot(
      wrongFrontier,
      snapshot.rowSha256,
      snapshot.resultSha256,
    );
    expect(
      verifyIdentityRobustFrontierSnapshot(selfConsistentWrongSnapshot, {
        rowSha256: snapshot.rowSha256,
        resultSha256: snapshot.resultSha256,
        frontierSha256: snapshot.frontierSha256,
        frontierCount: snapshot.frontier.length,
      }),
    ).toMatchObject({
      ok: false,
      errors: ["frontier snapshot does not match the expected computation"],
      providerCallsAuthorized: false,
    });
    expect(
      verifyIdentityRobustFrontierSnapshot({
        ...snapshot,
        providerCallsAuthorized: true,
        approved: true,
      }),
    ).toMatchObject({
      ok: false,
      errors: ["an exact offline frontier snapshot is required"],
      providerCallsAuthorized: false,
    });
  });

  it("rejects stale outer bytes before parsing their inner hashes", async () => {
    const snapshot = createIdentityRobustFrontierSnapshot(
      frontier,
      "a".repeat(64),
      "b".repeat(64),
    );
    const root = await mkdtemp(join(tmpdir(), "scout-frontier-snapshot-"));
    roots.push(root);
    await writeFile(join(root, "frontier.json"), JSON.stringify(snapshot));

    expect(
      await loadIdentityRobustFrontierSnapshot(
        root,
        "frontier.json",
        "c".repeat(64),
        {
          rowSha256: snapshot.rowSha256,
          resultSha256: snapshot.resultSha256,
          frontierSha256: snapshot.frontierSha256,
          frontierCount: snapshot.frontier.length,
        },
      ),
    ).toMatchObject({
      ok: false,
      snapshot: null,
      errors: ["local evidence bytes do not match the declared SHA-256"],
      providerCallsAuthorized: false,
    });
  });
});
