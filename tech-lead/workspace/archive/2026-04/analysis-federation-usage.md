# Federation Sync Code Usage Analysis

**Date**: 2026-04-11  
**Lens**: C (Dead Weight)  
**Target**: Federation sync code added 2026-04-08

## Verdict: ACTIVELY USED — Not Dead Code

The federation sync infrastructure is live and running in production across two instances (local + k3s). It is not dead weight. However, there are quality issues worth addressing.

## Evidence of Active Use

| Signal | Evidence |
|--------|----------|
| **Heartbeats** | `local.json` updated every 10min (last_seen: 09:23 today) |
| **Merge commits** | 216 "Merge remote-tracking branch" in last 2 days |
| **Sync commits** | 242 "commit before sync" in last 2 days |
| **Conflict files** | 3 `.conflict-k3s` files exist (evidence shared conflict resolution fires) |
| **Git remotes** | Both `k3s/main` and `local-bare/main` actively fetched/pushed |
| **Design doc** | Comprehensive federation-design.md by Bob, 2026-04-08 |

## Architecture Summary

- **File**: `agents/may/handlers/agents-auto-commit.ts` (~450 lines)
- **Schedule**: Every 10 minutes (`intervalMs: 600000`)
- **Instances**: `local` (7 agents on Docker Compose) ↔ `k3s` (4 agents on Azure k3s)
- **Sync**: Git-based — rebase preferred, fallback to merge, ownership-aware conflict resolution
- **Ownership model**: Agent dirs owned by their instance; `shared/` jointly owned with special merge rules

## Issues Found

### Issue 1: Git History Noise (P2)
**504 out of 1332 commits (38%)** in the last 2 days are auto-commit/merge noise. This makes `git log` nearly useless for finding real agent work. The 10-min interval creates ~144 sync cycles/day × 2 instances = up to 288 merge commits/day.

**Potential fix**: Increase interval to 30min (48 sync cycles/day), or use `--ff-only` when possible to eliminate merge commits for clean-forward syncs.

### Issue 2: Stale Conflict Files Not Cleaned (P2)
Three `.conflict-k3s` files persist in the repo:
- `gym/scenarios/sycophants-dilemma-fewshot/scenario.json.conflict-k3s` (Apr 9)
- `gym/scenarios/knowledge-base-navigation-discovery/task.md.conflict-k3s` (Apr 10)
- `shared/federation/heartbeats/local.json.conflict-k3s` (regenerated every cycle)

The code creates these but has no cleanup mechanism. They accumulate forever.

**Fix**: Add a cleanup step that removes `.conflict-*` files older than 24h (the human has had time to review by then).

### Issue 3: Recurring Heartbeat Conflict (P2)
`local.json.conflict-k3s` is regenerated every ~10 minutes. The heartbeat file `local.json` changes every cycle (new `last_seen` timestamp), which means it conflicts on every merge where both instances have committed. The conflict resolution keeps ours and saves theirs as `.conflict-k3s`, which then gets committed, pulled by k3s, modified, pushed back...creating an infinite loop of trivial conflicts.

**Fix**: Heartbeat files should be in `.gitignore` or handled with `--ours` strategy since they're ephemeral by nature. Each instance only cares about the OTHER instance's heartbeat staleness, and can check that after pull.

### Issue 4: No k3s Heartbeat File (P3)
`k3s.json` doesn't exist — either k3s isn't running the same handler version, or the instance detection is failing there. The federation heartbeat system is therefore half-functional (local writes heartbeats, k3s doesn't).

## Recommendations

1. **Do NOT remove** — this code is load-bearing infrastructure for a real 2-instance deployment
2. **P2 cleanup**: Add conflict file cleanup (24h TTL) — simple addition to the handler
3. **P2 heartbeat fix**: Make heartbeat files merge-conflict-proof (gitignore or ours-strategy for own instance's heartbeat)
4. **P3 investigation**: Check why k3s instance doesn't write k3s.json heartbeat

## Code Quality Assessment

The ownership-aware conflict resolution is well-designed:
- Clear ownership model (agent dir → instance, shared → joint)
- Good fallback chain (rebase → ownership resolution → merge → merge+resolution → abort)
- Append-only file merge for .jsonl/bulletin.md
- Never silently discards data (shared conflicts keep both versions)

The complexity is justified by the problem it solves (multi-instance git sync with mixed ownership).
