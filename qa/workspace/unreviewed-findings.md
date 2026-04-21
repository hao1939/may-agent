# Unreviewed findings (heartbeat)

## Scope
This heartbeat reviewed the current working tree in `/app/agents`.

## What I observed
- Repo root `/app` is **not** a git repository; the git repo is `/app/agents`.
- Recent commit reviewed: `0a546befc` (doc-only change: `shared/knowledge/experiments/EXP-190/results.md`).
- The EXP-190 results document asserts an infrastructure issue: gym runner `--lab` is metadata-only and does not overlay lab fork files.

Evidence:
- `git log --oneline -10` in `/app/agents` shows `0a546befc`.
- Read `shared/knowledge/experiments/EXP-190/results.md`.

## Findings
### IMPORTANT — Standard QA TS/Vitest checks cannot run in this repo layout
Per QA SOP, I ran the mandatory commands at `/app`:
- `./node_modules/.bin/tsc --noEmit` → **No such file or directory** (exit 127)
- `./node_modules/.bin/vitest --run` → **No such file or directory** (exit 127)

This looks like an environment/repo mismatch (agents/docs repo without Node toolchain) rather than a patch defect, but it blocks standard verification.

### MINOR — Working tree is dirty with what looks like generated artifacts
Having these heartbeat/session files modified in the working tree suggests either:
- another process is updating them continuously, or
- sessions are ending without committing these changes.

This makes it harder to identify “real” changes needing QA review.

## Recommendation
- Clarify QA entrypoints for this repo (where typecheck/tests should be run, or whether they should be skipped for docs-only repos).
- Consider `.gitignore` for purely ephemeral heartbeat-context files if they’re not intended to be committed.
