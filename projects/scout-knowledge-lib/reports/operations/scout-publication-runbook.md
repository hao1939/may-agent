# Scout Publication Runbook

## Normal publication

Scout's hosted write workflows allocate an isolated detached Git worktree and give the writer its candidate project root. The writer judges whether the material is useful, source-continuous, correctly linked, and responsive to the assignment. Code then inventories the candidate, validates that outputs are regular files under `knowledge/` or `reports/`, stages only the exact changed paths, commits them, checks concurrent branch and path state, and reads the committed bytes back. Only that verification permits evidence such as `publication:commit:<sha>`, repository paths, and canonical output paths.

This automation proves which bytes and modes Git committed. It does **not** independently reproduce research claims or establish source quality. The [historical backlog adoption report](../triage/scout-git-backlog-adoption-2026-09-18.md) makes the same distinction: link and byte checks preserved reviewed material without revalidating every conclusion.

A valid run with no durable difference returns `publication:no-change`, creates no commit, and removes its pristine candidate. A retry that finds the intended bytes already committed should also resolve as no-change at that revision, not create a duplicate commit.

## Inspecting a failed publication

1. Read the workflow's failure evidence before retrying. Record the retained candidate path, its base and candidate revision, the complete base-to-revision/worktree changed-path inventory, and any reported unresolved branch, file, or index effects.
2. Confirm that every intended output was declared and remains inside the allowed library roots. Inspect candidate bytes and links there; do not treat the candidate as a committed result.
3. Inspect canonical Git state and the named paths. Distinguish an undeclared canonical edit, dirty allocation target, symlink/non-file output, unreviewed deletion, concurrent intended-path change, index lock, protected ancestor, or ref race. Preserve unrelated staged and worktree changes.
4. For a disjoint branch advance, let the workflow replay captured candidate bytes onto the new parent. For a conflict or protected-path failure, resolve the exact canonical obstruction through owner review, then retry from the retained evidence rather than broadly staging or copying files.
5. Accept success only after workflow evidence names the commit and an operator reads the resulting commit and output paths back from Git. This live run is not proven until that read-back occurs.

The helper rolls back tested ordinary lock, protected-path, and ref-race failures before advancing the shared ref. It does not promise atomic recovery from arbitrary process crashes or external filesystem writers. When rollback is incomplete, its explicit unresolved-effects report and retained candidate are the recovery boundary; do not infer a clean checkout or invent a commit from agent prose.
