# Federation Sync Redesign — Implementation Brief

**Date**: 2026-04-08
**Priority**: P0 (from Hao)
**Owner**: tech-lead
**Reviewer**: May

## Problem

The `agents-auto-commit` handler (`agents/may/handlers/agents-auto-commit.ts`) manages git commit/sync for the `agents/` repo shared between local and k3s instances. Recurring failures:

1. **Untracked file conflicts** — Both instances create new files in shared directories (`gym/scenarios/`, `shared/knowledge/`). Git rebase fails when untracked local files conflict with incoming files from the other instance.
2. **Data loss from sync** — EXP-086 results were **overwritten by pod sync** (see commit `25a49fc8` which rescued the data). This is the most serious failure.
3. **Revert cycle** — A rewrite attempt (commit `7f48a6a9`, 348→85 lines) had to be reverted (`eeaeaac3`) because it broke something.
4. **Rebase/merge failures** — The handler falls back to `merge -X ours` on rebase conflict, which silently discards the other side's changes. This is how data loss happens.

## Current Architecture

### Files involved:
- `agents/may/handlers/agents-auto-commit.ts` — Main handler (348 lines). Runs every 10min. Commits uncommitted changes, then pulls/pushes to remote.
- `scripts/federation/sync-agents-continuous.sh` — Runs on k3s host every 5min. Bridges bare repo between local and pod.
- `scripts/sync-agents.sh` — Manual two-way sync script (used by Hao).
- `scripts/auto-commit-agents.sh` — Old shell auto-commit (30 lines, simpler but dumber).

### Sync flow:
```
Local agents/ ←→ bare repo on k3s host ←→ Pod agents/
                     (via git push/pull)
```

### What goes wrong:
1. Instance A creates `shared/knowledge/KE-061.md` (untracked)
2. Instance B also creates `shared/knowledge/KE-061.md` (untracked)  
3. When A pulls, rebase tries to checkout B's version → fails because A has untracked file
4. Handler aborts rebase → falls back to `merge -X ours` → B's version is silently lost

## Design Requirements

Based on Bob's federation design (`agents/shared/projects/federation-design.md`) and observed failures:

### Must have:
1. **No data loss** — Never silently discard the other side's changes. If conflict can't be auto-resolved, fail loudly and alert.
2. **Commit-before-pull** — Always commit all local changes (including untracked) before any pull/rebase/merge. This is the #1 fix for untracked file conflicts.
3. **File ownership partitioning** — Agent directories are instance-owned:
   - Local owns: `may/`, `bob/`, `tech-lead/`, `coder/`, `optimizer/`, `qa/`, `evaluator/`
   - K3s owns: `scout/`, `coach/`, `amy/`, `amy-kimi/`
   - `shared/` is jointly written — needs special merge handling
4. **Safe conflict resolution** — For owned directories, prefer the owner's version. For shared directories, prefer the newer file (by mtime or commit time). Never `-X ours` on shared files.
5. **Idempotent** — Handler should be safe to run at any frequency (currently 10min).

### Should have:
6. **Append-only shared files** — `shared/bulletin.md`, `shared/knowledge/INDEX.md` etc. should be treated as append-only. Merge strategy: concatenate both sides.
7. **Federation directory** — Create `agents/shared/federation/` for structured cross-instance coordination (claims, notifications, instance heartbeats). See Bob's design §4-§8.
8. **Descriptive commit messages** — Keep the current per-agent classification (already good in the handler).

### Nice to have:
9. **Instance identification** — The handler should know which instance it's running on (local vs k3s) to make ownership decisions.
10. **Hot-path commits** — Cross-instance requests get committed immediately, not waiting for the 10min cycle.

## Proposed Implementation

### Phase 1: Fix the handler (P0, do this first)
Rewrite `tryPull()` in `agents-auto-commit.ts`:

```
1. git add -A && git commit (commit everything first — no untracked file conflicts)
2. git fetch remote main
3. If behind:
   a. Try git rebase remote/main
   b. On conflict:
      - For files in owned dirs → keep ours (we're the owner)
      - For files in the other's dirs → keep theirs (they're the owner)
      - For shared/ files → attempt auto-merge, if fails → keep both (rename conflict file)
      - git add -A && git rebase --continue
   c. If rebase still fails → git rebase --abort, try merge with same strategy
   d. If merge still fails → abort, log error, DON'T commit — try next cycle
4. git push
```

Key change: **Never use `-X ours` on shared files.** If we can't merge, keep both versions (rename one to `<file>.conflict-<instance>`) and let a human resolve.

### Phase 2: Add instance config
Create `agents/shared/federation/instance-config.json`:
```json
{
  "local": { "agents": ["may","bob","tech-lead","coder","optimizer","qa","evaluator"] },
  "k3s": { "agents": ["scout","coach","amy","amy-kimi"] }
}
```

The handler reads this to determine file ownership. The instance name is determined by which agents are running locally (check cron.json or process list).

### Phase 3: Federation directory structure
```
agents/shared/federation/
  instance-config.json    # who owns what
  heartbeats/             # instance liveness
    local.json
    k3s.json
  claims.jsonl            # task claim log (append-only)
  notifications.jsonl     # cross-instance notifications (append-only)
  requests/               # cross-instance work requests
```

## Reference Materials
- Bob's full design: `agents/shared/projects/federation-design.md` (558 lines)
- Current handler: `agents/may/handlers/agents-auto-commit.ts` (348 lines)
- K3s sync script: `scripts/federation/sync-agents-continuous.sh`
- Manual sync script: `scripts/sync-agents.sh`
- Reverted rewrite: git show `7f48a6a9` (what went wrong last time)

## Verification
- [ ] Handler runs without errors on 10min cycle
- [ ] No data loss when both instances create files in `shared/`
- [ ] Owned directory conflicts auto-resolve correctly
- [ ] Merge failures produce clear error logs (not silent data loss)
- [ ] Existing per-agent commit messages still work
- [ ] Push after commit works (no regressions)
