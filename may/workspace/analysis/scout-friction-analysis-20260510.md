# Scout Operational Friction Analysis — 2026-05-10

## Metric Status
- **Scout operational friction rate (24h)**: 0.5135 (threshold: 0.3, target: 0.1) ⚠️ BREACH
- **Scout good session rate (24h)**: 0.6351 (threshold: 0.65, target: 0.85) ⚠️ NEAR-BREACH

## Root Cause: Destructive File Overwrites

Examining the last 19 evaluated scout sessions reveals a **recurring pattern**: scout uses shell heredoc redirects (`cat << 'EOF' > file`) to write cumulative/shared files, **replacing existing content** instead of appending or merging.

### Concrete Damage Found

**Session s_1778423107793 (overridden to needs_improvement)**:
- Overwrote `scout/workspace/digest/today.md` — lost prior digest entries
- Clobbered `shared/knowledge/entries/KE-004.md` and `KE-005.md` with unrelated content
- Commit `5995adb14` shows **40 insertions, 304 deletions** — destructive shape

**Session s_1778430307430 (overridden to needs_improvement)**:
- Overwrote `scout/workspace/digest/today.md` again — replaced four prior entries with three new ones
- Repurposed `shared/knowledge/entries/KE-151.md` (Bob's "Extended Thinking" entry) with unrelated SIRA content
- Commit `2f9900df4` landed the damage

### Why Heuristics Miss This

Both sessions were initially rated `good` by heuristic evaluation because they had:
- ✅ Git commits
- ✅ Knowledge updates
- ✅ File writes
- ✅ Post-write read-back verification

The heuristic cannot detect that the *diff* is destructive. Only the LLM review (aftermath) caught the issue by inspecting actual diffs against prior content.

## Impact Assessment

| Metric | Sessions Affected | Impact |
|--------|------------------|--------|
| Interrupted (schema errors) | 2/19 | Minor — transient DB schema mismatches |
| Destructive overwrites (review override) | 2/19 | **High** — data loss in shared knowledge |
| Finish-blocked by uncommitted changes | 1/19 | Low — self-repaired |
| Good sessions | 14/19 | Healthy when no overwrite |

The friction rate is dominated by the **overwrite pattern** (2 sessions) plus **interruptions** (2 sessions), giving ~4/19 ≈ 21% direct failure, but the metric likely includes a broader window.

## Recommendations

### P0: Prevent Knowledge Entry ID Collisions
Scout must check if a KE-NNN.md file exists before writing to it. A simple `test -f` before write would catch this.

### P1: Append-Only Digest Updates
`today.md` must use append semantics. The scout workflow should read existing content and merge, not replace.

### P1: Add Diff-Shape Heuristic to Evaluator
Flag sessions where `insertions < deletions * 0.5` on cumulative files (digest, knowledge) as suspicious. This would catch destructive overwrites without LLM cost.

### P2: Scout Schema Error Resilience
The 2 interrupted sessions hit DB schema errors (`no such column: id`). Scout's DB queries should use `PRAGMA table_info()` first, matching the pattern other agents already follow.
