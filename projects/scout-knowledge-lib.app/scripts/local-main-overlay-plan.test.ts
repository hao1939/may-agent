import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { inspectLocalMainOverlay } from "./local-main-overlay-plan";

const roots: string[] = [];

function git(root: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd: root });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

async function repo(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "scout-overlay-plan-"));
  roots.push(root);
  git(root, "init", "--quiet");
  git(root, "config", "user.name", "Scout test");
  git(root, "config", "user.email", "scout@example.invalid");
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "base");
  return { root, base: git(root, "rev-parse", "HEAD") };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("local-main overlay plan", () => {
  it("drives a reversible mixed-index transition without changing overlay bytes", async () => {
    const { root, base } = await repo({
      "already-deleted.md": "base deletion\n",
      "candidate-clean.md": "base candidate clean\n",
      "divergent.md": "base divergent\n",
      "rename-old.md": "same rename bytes\n",
      "restore.md": "base restore\n",
      "unrelated.md": "base unrelated\n",
    });
    await unlink(join(root, "already-deleted.md"));
    await writeFile(join(root, "candidate-clean.md"), "candidate clean\n");
    await writeFile(join(root, "divergent.md"), "candidate divergent\n");
    git(root, "mv", "rename-old.md", "rename-new.md");
    await writeFile(join(root, "restore.md"), "candidate restore\n");
    await writeFile(join(root, "added.md"), "candidate addition\n");
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "candidate");
    const candidate = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "--quiet", "--detach", base);

    await unlink(join(root, "already-deleted.md"));
    await writeFile(join(root, "candidate-clean.md"), "candidate clean\n");
    await writeFile(join(root, "divergent.md"), "human divergent\n");
    await unlink(join(root, "rename-old.md"));
    await writeFile(join(root, "rename-new.md"), "same rename bytes\n");
    await writeFile(join(root, "unrelated.md"), "human unrelated\n");
    const preflight = git(
      root,
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--no-renames",
    );

    const plan = inspectLocalMainOverlay(root, base, candidate);

    expect(plan).toMatchObject({
      preflightStatusCount: 6,
      noRenameCandidatePathCount: 7,
      overlapCount: 5,
      unrelatedDirtyCount: 1,
      expectedPostflightStatusCount: 2,
      rollbackRestoreCount: 1,
      rollbackRemoveCount: 1,
    });
    expect(plan.overlapBecomesClean.map(({ path }) => path).sort()).toEqual([
      "already-deleted.md",
      "candidate-clean.md",
      "rename-new.md",
      "rename-old.md",
    ]);
    expect(plan.overlapRetained).toEqual([
      { path: "divergent.md", status: "M" },
    ]);
    expect(plan.cleanMaterialization).toEqual([
      { path: "added.md", rollback: "remove" },
      { path: "restore.md", rollback: "restore" },
    ]);

    // Changing only HEAD/index is the matched unsafe baseline: clean candidate
    // paths remain at base bytes and become two extra dirty records.
    git(root, "reset", "--mixed", "--quiet", candidate);
    expect(
      git(
        root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--no-renames",
      )
        .split("\n")
        .filter(Boolean)
        .sort(),
    ).toEqual([
      " M divergent.md",
      " M restore.md",
      " M unrelated.md",
      "D added.md",
    ]);
    git(root, "reset", "--mixed", "--quiet", base);
    expect(
      git(
        root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--no-renames",
      ),
    ).toBe(preflight);

    // The planner's clean-materialization set supplies only paths that were
    // clean at preflight; the mixed reset then advances HEAD/index while all
    // dirty overlay bytes remain untouched.
    git(
      root,
      "checkout",
      candidate,
      "--",
      ...plan.cleanMaterialization.map(({ path }) => path),
    );
    git(root, "reset", "--mixed", "--quiet", candidate);
    expect(git(root, "rev-parse", "HEAD")).toBe(candidate);
    expect(
      git(
        root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--no-renames",
      )
        .split("\n")
        .filter(Boolean)
        .sort(),
    ).toEqual([" M unrelated.md", "M divergent.md"]);
    expect(await Bun.file(join(root, "divergent.md")).text()).toBe(
      "human divergent\n",
    );
    expect(await Bun.file(join(root, "unrelated.md")).text()).toBe(
      "human unrelated\n",
    );

    const restorePaths = plan.cleanMaterialization
      .filter(({ rollback }) => rollback === "restore")
      .map(({ path }) => path);
    git(root, "checkout", base, "--", ...restorePaths);
    for (const { path } of plan.cleanMaterialization.filter(
      ({ rollback }) => rollback === "remove",
    )) {
      await unlink(join(root, path));
    }
    git(root, "reset", "--mixed", "--quiet", base);
    expect(git(root, "rev-parse", "HEAD")).toBe(base);
    expect(
      git(
        root,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--no-renames",
      ),
    ).toBe(preflight);
    expect(await Bun.file(join(root, "candidate-clean.md")).text()).toBe(
      "candidate clean\n",
    );
    expect(await Bun.file(join(root, "divergent.md")).text()).toBe(
      "human divergent\n",
    );
    expect(await Bun.file(join(root, "rename-new.md")).text()).toBe(
      "same rename bytes\n",
    );
    expect(await Bun.file(join(root, "unrelated.md")).text()).toBe(
      "human unrelated\n",
    );
  });

  it("counts both dirty sides of a content-identical rename", async () => {
    const { root, base } = await repo({ "old.md": "same\n" });
    git(root, "mv", "old.md", "new.md");
    git(root, "commit", "--quiet", "-m", "rename");
    const candidate = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "--quiet", "--detach", base);
    await unlink(join(root, "old.md"));
    await writeFile(join(root, "new.md"), "same\n");
    const before = git(
      root,
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    );

    const plan = inspectLocalMainOverlay(root, base, candidate);

    expect(plan).toMatchObject({
      preflightStatusCount: 2,
      noRenameCandidatePathCount: 2,
      overlapCount: 2,
      unrelatedDirtyCount: 0,
      expectedPostflightStatusCount: 0,
      rollbackRestoreCount: 0,
      rollbackRemoveCount: 0,
    });
    expect(plan.overlapBecomesClean.map(({ path }) => path).sort()).toEqual([
      "new.md",
      "old.md",
    ]);
    expect(git(root, "status", "--porcelain=v1", "--untracked-files=all")).toBe(
      before,
    );
    expect(git(root, "rev-parse", "HEAD")).toBe(base);
  });

  it("separates clean restore and remove rollback paths", async () => {
    const { root, base } = await repo({ "tracked.md": "old\n" });
    await writeFile(join(root, "tracked.md"), "new\n");
    await writeFile(join(root, "added.md"), "added\n");
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "candidate");
    const candidate = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "--quiet", "--detach", base);

    const plan = inspectLocalMainOverlay(root, base, candidate);

    expect(plan).toMatchObject({
      preflightStatusCount: 0,
      noRenameCandidatePathCount: 2,
      overlapCount: 0,
      expectedPostflightStatusCount: 0,
      rollbackRestoreCount: 1,
      rollbackRemoveCount: 1,
    });
    expect(plan.cleanMaterialization).toEqual([
      { path: "added.md", rollback: "remove" },
      { path: "tracked.md", rollback: "restore" },
    ]);
  });

  it("retains a human-owned overlap that differs from the candidate", async () => {
    const { root, base } = await repo({ "note.md": "base\n" });
    await writeFile(join(root, "note.md"), "candidate\n");
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "candidate");
    const candidate = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "--quiet", "--detach", base);
    await writeFile(join(root, "note.md"), "human\n");

    const plan = inspectLocalMainOverlay(root, base, candidate);

    expect(plan).toMatchObject({
      preflightStatusCount: 1,
      noRenameCandidatePathCount: 1,
      overlapCount: 1,
      unrelatedDirtyCount: 0,
      expectedPostflightStatusCount: 1,
      rollbackRestoreCount: 0,
      rollbackRemoveCount: 0,
    });
    expect(plan.overlapRetained).toEqual([{ path: "note.md", status: "M" }]);
  });

  it("refuses a preflight index with staged changes", async () => {
    const { root, base } = await repo({ "note.md": "base\n" });
    await writeFile(join(root, "note.md"), "candidate\n");
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "candidate");
    const candidate = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "--quiet", "--detach", base);
    await writeFile(join(root, "note.md"), "staged\n");
    git(root, "add", "note.md");

    expect(() => inspectLocalMainOverlay(root, base, candidate)).toThrow(
      "preflight index contains staged changes",
    );
  });

  it("refuses to read a candidate path through a symlinked parent", async () => {
    const { root, base } = await repo({ "dir/note.md": "base\n" });
    await writeFile(join(root, "dir", "note.md"), "candidate\n");
    git(root, "add", ".");
    git(root, "commit", "--quiet", "-m", "candidate");
    const candidate = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "--quiet", "--detach", base);
    await rm(join(root, "dir"), { recursive: true });
    await mkdir(join(root, "elsewhere"));
    await writeFile(join(root, "elsewhere", "note.md"), "base\n");
    await symlink(join(root, "elsewhere"), join(root, "dir"));

    expect(() => inspectLocalMainOverlay(root, base, candidate)).toThrow(
      "unsafe worktree parent: dir/note.md",
    );
  });
});
