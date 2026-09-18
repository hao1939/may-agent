import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packetHash } from "../improvement-approval";
import { applyImprovement } from "./apply-improvement";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-operator-apply-"));
  roots.push(root);
  const repository = join(root, "repo");
  mkdirSync(repository);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  writeFileSync(join(repository, "behavior.txt"), "before\n");
  git("add", ".");
  git("commit", "-m", "baseline");
  const baselineCommit = git("rev-parse", "HEAD");
  git("checkout", "-b", "candidate");
  writeFileSync(join(repository, "behavior.txt"), "after\n");
  git("commit", "-am", "candidate");
  const candidateCommit = git("rev-parse", "HEAD");
  const candidateTreeHash = git("rev-parse", "HEAD^{tree}");
  git("checkout", "main");
  const diff = execFileSync("git", [
    "-C",
    repository,
    "diff",
    "--binary",
    "--no-ext-diff",
    "--no-renames",
    baselineCommit,
    candidateCommit,
  ]);
  const verification = '{"status":"passed","fixture":true}\n';
  const comparison = '{"verdict":"candidate-supported","fixture":true}\n';
  const body = {
    baselineCommit,
    candidateCommit,
    candidateTreeHash,
    diffSha256: sha(diff),
    verificationSha256: sha(verification),
    comparisonSha256: sha(comparison),
    activationScope: `git-fast-forward:${repository}`,
    rollbackCommit: baselineCommit,
  };
  const packet = { ...body, packetHash: packetHash(body) };
  const files = {
    repository,
    packet: join(root, "packet.json"),
    diff: join(root, "diff.patch"),
    verification: join(root, "verification.json"),
    comparison: join(root, "comparison.json"),
  };
  writeFileSync(files.packet, JSON.stringify(packet));
  writeFileSync(files.diff, diff);
  writeFileSync(files.verification, verification);
  writeFileSync(files.comparison, comparison);
  return { root, git, packet, files };
}

test("real Git application requires an exact operator decision and preserves source on denial", () => {
  const f = fixture();
  expect(applyImprovement(f.files).applied).toBe(false);
  writeFileSync(
    f.files.packet,
    JSON.stringify({ ...f.packet, trustedHumanControl: true }),
  );
  expect(applyImprovement(f.files).applied).toBe(false);
  writeFileSync(f.files.packet, JSON.stringify(f.packet));
  expect(applyImprovement(f.files, "0".repeat(64)).applied).toBe(false);
  expect(f.git("rev-parse", "HEAD")).toBe(f.packet.baselineCommit);
  expect(applyImprovement(f.files, f.packet.packetHash).applied).toBe(true);
  expect(readFileSync(join(f.files.repository, "behavior.txt"), "utf8")).toBe(
    "after\n",
  );
  expect(applyImprovement(f.files, f.packet.packetHash).applied).toBe(false);
});

test("changed retained verification and dirty target fail before Git application", () => {
  const f = fixture();
  writeFileSync(f.files.verification, '{"status":"failed"}\n');
  expect(() => applyImprovement(f.files, f.packet.packetHash)).toThrow(
    "verification evidence changed",
  );
  expect(f.git("rev-parse", "HEAD")).toBe(f.packet.baselineCommit);
  writeFileSync(join(f.files.repository, "unrelated.txt"), "preserve me");
  expect(() => applyImprovement(f.files, f.packet.packetHash)).toThrow(
    "not clean",
  );
  expect(readFileSync(join(f.files.repository, "unrelated.txt"), "utf8")).toBe(
    "preserve me",
  );
});

test("a later target baseline and a changed candidate packet invalidate previous approval", () => {
  const f = fixture();
  writeFileSync(
    f.files.packet,
    JSON.stringify({ ...f.packet, candidateTreeHash: "0".repeat(40) }),
  );
  expect(applyImprovement(f.files, f.packet.packetHash).applied).toBe(false);
  writeFileSync(f.files.packet, JSON.stringify(f.packet));
  writeFileSync(join(f.files.repository, "other.txt"), "later baseline\n");
  f.git("add", ".");
  f.git("commit", "-m", "other work");
  const before = f.git("rev-parse", "HEAD");
  expect(applyImprovement(f.files, f.packet.packetHash).applied).toBe(false);
  expect(f.git("rev-parse", "HEAD")).toBe(before);
});
