import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  publishKnowledgeChanges,
  snapshotKnowledge,
} from "./knowledge-publication";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function run(root: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "scout-publication-test-"));
  roots.push(root);
  run(root, "init", "-b", "main");
  run(root, "config", "user.name", "Test");
  run(root, "config", "user.email", "test@example.invalid");
  const project = join(root, "projects", "scout-knowledge-lib");
  mkdirSync(join(project, "knowledge"), { recursive: true });
  mkdirSync(join(project, "reports"), { recursive: true });
  writeFileSync(join(project, "knowledge", "existing.md"), "original\n");
  writeFileSync(join(root, "unrelated.txt"), "base\n");
  run(root, "add", ".");
  run(root, "commit", "-m", "base");
  return { root, project };
}

describe("Scout knowledge publication", () => {
  it("rechecks canonical ancestry after candidate preparation and before integration", () => {
    const { root, project } = fixture();
    const head = run(root, "rev-parse", "HEAD");
    const index = run(root, "ls-files", "--stage");
    const bin = join(root, "injection");
    const outside = join(root, "outside");
    mkdirSync(bin);
    mkdirSync(outside);
    const wrapper = join(bin, "git");
    writeFileSync(
      wrapper,
      `#!${process.execPath}
import { execFileSync } from "node:child_process";
import { symlinkSync } from "node:fs";
const args = process.argv.slice(2);
try { process.stdout.write(execFileSync(${JSON.stringify(Bun.which("git"))}, args)); }
catch (error) { process.stderr.write(error.stderr ?? ""); process.exit(error.status ?? 1); }
if (args.includes("commit")) symlinkSync(${JSON.stringify(outside)}, ${JSON.stringify(join(project, "knowledge/newdir"))});
`,
    );
    chmodSync(wrapper, 0o755);
    const script = join(bin, "probe.ts");
    writeFileSync(
      script,
      `
import { mkdirSync, writeFileSync } from "node:fs";
import { snapshotKnowledge, publishKnowledgeChanges } from ${JSON.stringify(fileURLToPath(new URL("./knowledge-publication.ts", import.meta.url)))};
const snapshot = snapshotKnowledge(${JSON.stringify(project)}, ${JSON.stringify(join(root, "artifacts"))});
mkdirSync(snapshot.projectRoot + "/knowledge/newdir");
const output = snapshot.projectRoot + "/knowledge/newdir/new.md";
writeFileSync(output, "candidate\\n");
try { publishKnowledgeChanges(snapshot, { executionId: "ancestry-race", summary: "ancestry race" }); throw new Error("unexpected success"); }
catch (error) { console.log(JSON.stringify({ error: String(error), output })); }
`,
    );
    const result = JSON.parse(
      execFileSync(process.execPath, [script], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        encoding: "utf8",
      }),
    );
    expect(result.error).toContain(
      "Canonical publication path contains a symlink",
    );
    expect(existsSync(join(outside, "new.md"))).toBe(false);
    expect(readFileSync(result.output, "utf8")).toBe("candidate\n");
    expect(run(root, "rev-parse", "HEAD")).toBe(head);
    expect(run(root, "ls-files", "--stage")).toBe(index);
    expect(existsSync(join(root, ".git/index.lock"))).toBe(false);
  });

  it("attempts remaining file and index restoration when branch and one file rollback fail", () => {
    const { root, project } = fixture();
    const blockedPath = join(project, "knowledge/z.md");
    writeFileSync(blockedPath, "last original\n");
    run(root, "add", ".");
    run(root, "commit", "-m", "second original");
    const base = run(root, "rev-parse", "HEAD");
    const index = run(root, "ls-files", "--stage");
    const bin = join(root, "injection");
    mkdirSync(bin);
    const realGit = Bun.which("git")!;
    // Run the helper in a separate process: only that process sees this Git
    // wrapper. After ref advancement, simulate a competing writer that blocks
    // ref rollback and one file restoration, then fails canonical read-back.
    const wrapper = join(bin, "git");
    writeFileSync(
      wrapper,
      `#!${process.execPath}
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
try { process.stdout.write(execFileSync(${JSON.stringify(realGit)}, args)); }
catch (error) { process.stderr.write(error.stderr ?? ""); process.exit(error.status ?? 1); }
if (args[0] === "update-ref" && args[2] !== ${JSON.stringify(base)}) {
  writeFileSync(${JSON.stringify(join(project, "knowledge/existing.md"))}, "concurrent mutation\\n");
  rmSync(${JSON.stringify(blockedPath)});
  mkdirSync(${JSON.stringify(blockedPath)});
  writeFileSync(${JSON.stringify(join(root, ".git/refs/heads/main.lock"))}, "competing writer\\n");
}
`,
    );
    chmodSync(wrapper, 0o755);
    const script = join(bin, "probe.ts");
    writeFileSync(
      script,
      `
import { writeFileSync } from "node:fs";
import { snapshotKnowledge, publishKnowledgeChanges } from ${JSON.stringify(fileURLToPath(new URL("./knowledge-publication.ts", import.meta.url)))};
const snapshot = snapshotKnowledge(${JSON.stringify(project)}, ${JSON.stringify(join(root, "artifacts"))});
writeFileSync(snapshot.projectRoot + "/knowledge/existing.md", "first changed\\n");
writeFileSync(snapshot.projectRoot + "/knowledge/z.md", "last changed\\n");
try { publishKnowledgeChanges(snapshot, { executionId: "rollback-probe", summary: "rollback probe" }); throw new Error("unexpected success"); }
catch (error) { console.log(JSON.stringify({ error: String(error), candidate: snapshot.candidateRoot })); }
`,
    );
    const result = JSON.parse(
      execFileSync(process.execPath, [script], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        encoding: "utf8",
      }),
    );
    expect(result.error).toContain("canonical byte read-back failed");
    expect(result.error).toContain("branch rollback failed");
    expect(result.error).toContain(`file rollback failed (${blockedPath})`);
    expect(existsSync(result.candidate)).toBe(true);
    expect(readFileSync(join(project, "knowledge/existing.md"), "utf8")).toBe(
      "original\n",
    );
    expect(run(root, "ls-files", "--stage")).toBe(index);
    expect(run(root, "rev-parse", "HEAD")).not.toBe(base);
    expect(existsSync(join(root, ".git/refs/heads/main.lock"))).toBe(true);
    expect(existsSync(join(root, ".git/index.lock"))).toBe(false);
  });

  it("commits exact isolated bytes and preserves unrelated staging and untracked work", () => {
    const { root, project } = fixture();
    writeFileSync(join(root, "unrelated.txt"), "staged\n");
    run(root, "add", "unrelated.txt");
    writeFileSync(join(root, "outside.tmp"), "untracked\n");
    const beforeIndex = run(root, "diff", "--cached", "--", "unrelated.txt");
    const candidate = snapshotKnowledge(project, join(root, "artifacts"));
    const output = join(candidate.projectRoot, "knowledge", "exact.md");
    writeFileSync(output, Buffer.from("exact\n\n\n"));
    const result = publishKnowledgeChanges(candidate, {
      executionId: "controlled-call",
      summary: "exact fixture",
    });
    expect(result.state).toBe("committed");
    expect(result.files).toEqual([
      "projects/scout-knowledge-lib/knowledge/exact.md",
    ]);
    expect(readFileSync(join(project, "knowledge", "exact.md"))).toEqual(
      Buffer.from("exact\n\n\n"),
    );
    expect(
      execFileSync("git", ["show", `${result.commit}:${result.files[0]}`], {
        cwd: root,
      }),
    ).toEqual(Buffer.from("exact\n\n\n"));
    expect(run(root, "diff", "--cached", "--", "unrelated.txt")).toBe(
      beforeIndex,
    );
    expect(existsSync(join(root, "outside.tmp"))).toBe(true);
  });

  it("does not commit a no-op and a retry observes the committed revision", () => {
    const { root, project } = fixture();
    const first = snapshotKnowledge(project, join(root, "artifacts"));
    writeFileSync(join(first.projectRoot, "knowledge", "new.md"), "new\n");
    const committed = publishKnowledgeChanges(first, {
      executionId: "controlled",
      summary: "new",
    });
    const retry = snapshotKnowledge(project, join(root, "artifacts"));
    const noChange = publishKnowledgeChanges(retry, {
      executionId: "retry",
      summary: "new",
    });
    expect(noChange).toMatchObject({
      state: "unchanged",
      commit: committed.commit,
      files: [],
      outputs: [],
    });
    expect(existsSync(retry.candidateRoot)).toBe(false);
    expect(run(root, "rev-list", "--count", "HEAD")).toBe("2");
  });

  it("rebases safely over disjoint HEAD movement and rejects overlap", () => {
    const disjoint = fixture();
    const candidate = snapshotKnowledge(
      disjoint.project,
      join(disjoint.root, "artifacts"),
    );
    writeFileSync(
      join(candidate.projectRoot, "knowledge", "new.md"),
      "candidate\n",
    );
    writeFileSync(join(disjoint.root, "unrelated.txt"), "head moved\n");
    run(disjoint.root, "add", "unrelated.txt");
    run(disjoint.root, "commit", "-m", "disjoint");
    const result = publishKnowledgeChanges(candidate, {
      executionId: "controlled",
      summary: "disjoint",
    });
    expect(result.parent).toBe(run(disjoint.root, "rev-parse", "HEAD^"));

    const overlap = fixture();
    const conflicting = snapshotKnowledge(
      overlap.project,
      join(overlap.root, "artifacts"),
    );
    writeFileSync(
      join(conflicting.projectRoot, "knowledge", "existing.md"),
      "candidate\n",
    );
    writeFileSync(join(overlap.project, "knowledge", "existing.md"), "other\n");
    run(
      overlap.root,
      "add",
      "projects/scout-knowledge-lib/knowledge/existing.md",
    );
    run(overlap.root, "commit", "-m", "overlap");
    expect(() =>
      publishKnowledgeChanges(conflicting, {
        executionId: "controlled",
        summary: "overlap",
      }),
    ).toThrow(/HEAD changed on intended/);
  });

  it("rejects pre-existing dirty target attribution and retains isolated failure evidence", () => {
    const { root, project } = fixture();
    const canonical = join(project, "knowledge", "existing.md");
    writeFileSync(canonical, "pre-existing\n");
    const candidate = snapshotKnowledge(project, join(root, "artifacts"));
    writeFileSync(
      join(candidate.projectRoot, "knowledge", "existing.md"),
      "agent\n",
    );
    expect(() =>
      publishKnowledgeChanges(candidate, {
        executionId: "controlled",
        summary: "dirty",
      }),
    ).toThrow(/already dirty.*isolated candidate retained/);
    expect(existsSync(candidate.candidateRoot)).toBe(true);
  });

  it("rejects out-of-scope candidate writes with a complete retained inventory", () => {
    const { root, project } = fixture();
    const candidate = snapshotKnowledge(project, join(root, "artifacts"));
    writeFileSync(
      join(candidate.projectRoot, "knowledge", "valid.md"),
      "valid\n",
    );
    writeFileSync(join(candidate.candidateRoot, "outside.md"), "outside\n");
    expect(() =>
      publishKnowledgeChanges(candidate, {
        executionId: "controlled",
        summary: "scope",
      }),
    ).toThrow(/outside Scout durable roots.*outside\.md.*candidate changes:/);
    expect(existsSync(candidate.candidateRoot)).toBe(true);
  });

  it("keeps the ref unchanged when a protected canonical target cannot be replaced", () => {
    const { root, project } = fixture();
    const candidate = snapshotKnowledge(project, join(root, "artifacts"));
    const output = join(candidate.projectRoot, "knowledge", "blocked.md");
    writeFileSync(output, "candidate\n");
    // A directory at the destination deterministically models a protected bind
    // mount: the same-directory temporary can be written, but rename cannot replace it.
    mkdirSync(join(project, "knowledge", "blocked.md"));
    const head = run(root, "rev-parse", "HEAD");
    expect(() =>
      publishKnowledgeChanges(candidate, {
        executionId: "controlled",
        summary: "protected",
      }),
    ).toThrow(/isolated candidate retained.*candidate changes:/);
    expect(run(root, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(candidate.candidateRoot)).toBe(true);
  });

  it.each(["before", "during"])(
    "blocks staged-only edits %s the call without changing the index",
    (timing) => {
      const { root, project } = fixture();
      const path = "projects/scout-knowledge-lib/knowledge/existing.md";
      const earlyCandidate =
        timing === "during"
          ? snapshotKnowledge(project, join(root, "artifacts"))
          : undefined;
      writeFileSync(join(root, path), "human staged\n");
      run(root, "add", path);
      writeFileSync(join(root, path), "original\n");
      const index = run(root, "ls-files", "--stage");
      const candidate =
        earlyCandidate ?? snapshotKnowledge(project, join(root, "artifacts"));
      writeFileSync(
        join(candidate.projectRoot, "knowledge/existing.md"),
        "agent\n",
      );
      expect(() =>
        publishKnowledgeChanges(candidate, {
          executionId: "controlled",
          summary: "staged collision",
        }),
      ).toThrow(
        /already dirty|became dirty|changed outside the isolated candidate/,
      );
      expect(run(root, "ls-files", "--stage")).toBe(index);
      expect(readFileSync(join(root, path), "utf8")).toBe("original\n");
    },
  );

  it.each(["changed-reuse", "unreported-new"] as const)(
    "rejects mixed candidate and direct canonical edits before publication: %s",
    (scenario) => {
      const { root, project } = fixture();
      const candidate = snapshotKnowledge(project, join(root, "artifacts"));
      const output = join(candidate.projectRoot, "knowledge/new.md");
      writeFileSync(output, "accepted candidate\n");
      const direct = join(
        project,
        "knowledge",
        scenario === "changed-reuse" ? "existing.md" : "direct.md",
      );
      writeFileSync(direct, "direct uncommitted edit\n");
      const head = run(root, "rev-parse", "HEAD");
      const index = run(root, "ls-files", "--stage");
      expect(() =>
        publishKnowledgeChanges(candidate, {
          executionId: "mixed-edit",
          summary: "must preserve both drafts without partial publication",
          reportedOutputs: [
            output,
            ...(scenario === "changed-reuse" ? [direct] : []),
          ],
        }),
      ).toThrow(/Canonical Scout paths changed outside the isolated candidate/);
      expect(run(root, "rev-parse", "HEAD")).toBe(head);
      expect(run(root, "ls-files", "--stage")).toBe(index);
      expect(run(candidate.candidateRoot, "rev-parse", "HEAD")).toBe(head);
      expect(existsSync(join(project, "knowledge/new.md"))).toBe(false);
      expect(readFileSync(direct, "utf8")).toBe("direct uncommitted edit\n");
      expect(readFileSync(output, "utf8")).toBe("accepted candidate\n");
    },
  );

  it("rejects a missing reported output before integrating otherwise valid changes", () => {
    const { root, project } = fixture();
    const candidate = snapshotKnowledge(project, join(root, "artifacts"));
    writeFileSync(
      join(candidate.projectRoot, "knowledge/existing.md"),
      "candidate\n",
    );
    const head = run(root, "rev-parse", "HEAD");
    expect(() =>
      publishKnowledgeChanges(candidate, {
        executionId: "missing-output",
        summary: "must not partially publish",
        reportedOutputs: [join(candidate.projectRoot, "knowledge/missing.md")],
      }),
    ).toThrow(/absent from the candidate/);
    expect(run(root, "rev-parse", "HEAD")).toBe(head);
    expect(readFileSync(join(project, "knowledge/existing.md"), "utf8")).toBe(
      "original\n",
    );
  });

  it("rejects a concurrent revision of a reused output before integrating new work", () => {
    const { root, project } = fixture();
    const candidate = snapshotKnowledge(project, join(root, "artifacts"));
    const reused = join(candidate.projectRoot, "knowledge/existing.md");
    const output = join(candidate.projectRoot, "knowledge/new.md");
    writeFileSync(output, "new result\n");
    writeFileSync(
      join(project, "knowledge/existing.md"),
      "new source revision\n",
    );
    run(root, "add", "projects/scout-knowledge-lib/knowledge/existing.md");
    run(root, "commit", "-m", "concurrent source revision");
    const head = run(root, "rev-parse", "HEAD");
    expect(() =>
      publishKnowledgeChanges(candidate, {
        executionId: "stale-reuse",
        summary: "review used an earlier note",
        reportedOutputs: [reused, output],
      }),
    ).toThrow(/Reviewed output changed/);
    expect(run(root, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(project, "knowledge/new.md"))).toBe(false);
    expect(readFileSync(join(project, "knowledge/existing.md"), "utf8")).toBe(
      "new source revision\n",
    );
  });

  it("retains an out-of-scope-only draft and its complete identity", () => {
    const { root, project } = fixture();
    writeFileSync(join(root, ".gitignore"), ".state/\n");
    run(root, "add", ".gitignore");
    run(root, "commit", "-m", "existing runtime convention");
    const candidate = snapshotKnowledge(project, root);
    writeFileSync(join(candidate.candidateRoot, "outside.md"), "draft\n");
    expect(() =>
      publishKnowledgeChanges(candidate, {
        executionId: "controlled",
        summary: "outside only",
      }),
    ).toThrow(/candidate base:.*candidate revision:.*outside\.md/);
    expect(existsSync(candidate.candidateRoot)).toBe(true);
    expect(run(root, "status", "--porcelain")).toBe("");
  });

  it("acquires the index lock before mutation and rejects canonical symlink ancestors", () => {
    const locked = fixture();
    const candidate = snapshotKnowledge(
      locked.project,
      join(locked.root, "artifacts"),
    );
    writeFileSync(
      join(candidate.projectRoot, "knowledge/existing.md"),
      "agent\n",
    );
    writeFileSync(join(locked.root, ".git/index.lock"), "other writer\n");
    const head = run(locked.root, "rev-parse", "HEAD");
    expect(() =>
      publishKnowledgeChanges(candidate, {
        executionId: "controlled",
        summary: "locked",
      }),
    ).toThrow(/EEXIST.*candidate base:.*candidate revision:/);
    expect(
      readFileSync(join(locked.project, "knowledge/existing.md"), "utf8"),
    ).toBe("original\n");
    expect(run(locked.root, "rev-parse", "HEAD")).toBe(head);

    const linked = fixture();
    const linkedCandidate = snapshotKnowledge(
      linked.project,
      join(linked.root, "artifacts"),
    );
    mkdirSync(join(linkedCandidate.projectRoot, "knowledge/newdir"));
    writeFileSync(
      join(linkedCandidate.projectRoot, "knowledge/newdir/new.md"),
      "agent\n",
    );
    const outside = mkdtempSync(join(tmpdir(), "scout-publication-outside-"));
    roots.push(outside);
    symlinkSync(outside, join(linked.project, "knowledge/newdir"));
    expect(() =>
      publishKnowledgeChanges(linkedCandidate, {
        executionId: "controlled",
        summary: "symlink",
      }),
    ).toThrow(/contains a symlink/);
    expect(existsSync(join(outside, "new.md"))).toBe(false);
  });
});
