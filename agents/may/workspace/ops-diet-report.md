# May Ops Diet — Before/After Report
*2026-04-16*

## Before
- **Heartbeat lines**: 133
- **Steps**: 8 (with duplicate numbering — two "Step 4"s, two "Step 6"s)
- **Avg ops/session (48h)**: 13.7
- **Top 5 worst sessions**: 37, 37, 33, 30, 29 ops

### Root Causes of Bloat (from transcript analysis)
1. **Redundant DB queries**: 5-8 bun queries per session instead of 1 snapshot (Sessions ran snapshot, then re-queried for errors, stuck sessions, specific agents)
2. **Board edit thrashing**: Steps 1+2 both read+edit the board separately → 4-6 read/edit cycles
3. **Inline investigation**: Reading src/ files, git diffs, cherry-picks done in heartbeat instead of forked (e.g., s_84 spent 20 ops fixing merge conflicts and reading compose-guards.ts)
4. **Git commit flailing**: 5-10 ops on git status/diff/stash/checkout cycles
5. **Step 4 had a redundant failure query** (copy of snapshot query already done)
6. **Step 3 (Gatekeeper)** encouraged broad exploration — "read agent workspace plans", "peek sessions", "check what agents changed" → unbounded ops

## After
- **Heartbeat lines**: 84 (37% reduction)
- **Steps**: 6 (clean numbering, no duplicates)
- **Target avg ops**: ≤12

### Key Changes
| Change | Ops Saved |
|--------|-----------|
| Merged Steps 1+2 into single board pass (1 read + 1 edit) | ~3-4 ops |
| Removed duplicate failure query from Step 4 | ~1 op |
| Replaced broad gatekeeper exploration with 1 targeted git log | ~3-5 ops |
| Single-line git commit (add+diff+commit in one bash) | ~3-8 ops |
| Removed "reflection" questions that triggered re-reads | ~1-2 ops |
| Added explicit op budget counter at top | prevents runaway |
| Added 🚫 NEVER list with concrete examples | prevents regression |

### Expected Ideal Heartbeat Flow (8-10 ops)
1. System snapshot (1 bash)
2. Read board (1 read)
3. Fork dispatches if needed (1-2 agents.fork)
4. Edit board (1 edit)
5. Gatekeeper git check (1 bash)
6. Read improvement queue (1 read) + fork (1 agents.fork)
7. Git commit (1 bash)
8. Finish (1 finish)

### Quiet Cycle Flow (5-6 ops)
1. System snapshot (1 bash)
2. Read board — nothing to change, skip edit (1 read)
3. Gatekeeper git check — nothing (1 bash)
4. Git commit — nothing to commit (1 bash)
5. Finish (1 finish)
