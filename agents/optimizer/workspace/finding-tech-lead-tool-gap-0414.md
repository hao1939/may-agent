# Finding: Tech-Lead Tool Gap Analysis — Repeated Multi-Step Bash Patterns

**Date**: 2026-04-14
**Analyst**: Optimizer (Mode B)
**Sessions Analyzed**: 5 high-op tech-lead sessions (182, 94, 59, 50, 47 ops) + aggregate stats from 481 sessions over 7 days

## Executive Summary

Tech-lead averages 15.4 ops/session across 481 sessions (7d), but review sessions average 25.7 ops across 65 sessions — the single biggest activity category consuming **1,672 total ops** in a week. Three repeated patterns account for the majority of waste in high-op sessions.

## Top 3 Repeated Patterns

### Pattern 1: Batch Review Branch Merge (19+ git ops per batch)

**Where seen**: s_1776141991678_586 (94 ops — reviewed 8 branches), s_1776126397964_486 (6 merge ops), s_1776079351715_156 (7 merge ops)

**The pattern**: For each review branch, tech-lead manually runs:
1. `git merge review/<branch> --no-edit -m "..."`
2. Check for conflicts (`git diff --name-only --diff-filter=U`)
3. Resolve conflicts (`git checkout --ours <file> && git add`)
4. `git commit --no-verify`
5. `git branch -D review/<branch>`
6. Repeat for next branch

In the 94-op review session, tech-lead merged 8 branches with 19 git-related bash calls. Per branch: ~7 ops average (merge, check, resolve, delete, verify).

**Existing mitigation**: `scripts/review-merge.sh` exists and handles single-branch merge. But tech-lead still does manual batch merges, likely because:
- The script handles ONE branch at a time
- No batch mode (`--all` or `--batch` flag)
- Conflict resolution (checkout --ours) requires manual intervention

**Estimated savings**: 4-5 ops per branch × 8 branches = ~35 ops saved per batch review session. With 65 review sessions/week, even partial adoption saves **100-200 ops/week**.

**Recommendation**: **BUILD** — Extend `review-merge.sh` with:
- `--batch` flag that processes all `review/*` branches
- `--auto-resolve=ours` for workspace files (todo.md, PRIORITY-TRACKER.md — always safe to --ours)
- Summary report at end (N merged, N conflicted, N skipped)
- Estimated effort: 2-3 hours. High ROI.

---

### Pattern 2: Test-Debug-Rerun Loops (10-120 test invocations per session)

**Where seen**: s_1776126397964_486 (120 test/typecheck mentions across 182 ops), s_1776141991678_586 (21 test runs), s_1776079351715_156 (10 test runs)

**The pattern**: Tech-lead runs tests, reads failures, edits code, re-runs tests — sometimes 10+ cycles. The 182-op evaluator-fix session spent the majority of ops on:
1. `bun test test/evaluate-task.test.ts` → failure
2. Read error output, grep for context
3. Edit fix
4. `bun test` again → different failure (bun test module isolation issue)
5. Investigate mock isolation (`bun test doesn't properly isolate vi.mock`)
6. Repeat

The root issue was **bun test's lack of file isolation** — mocks in one file leak to others. Tech-lead spent ~40+ ops just discovering and working around this.

**Estimated savings**: Hard to reduce via tooling — this is inherent debugging work. However, a `test-isolated.sh` wrapper that runs each test file separately could prevent the mock-leak rabbit hole (~20 ops saved when it occurs). The deeper issue is rare (mock isolation) but devastating when hit.

**Recommendation**: **SKIP (mostly)** — Test-debug loops are core engineering work and resist tooling. One small win: document bun test mock isolation gotcha in a skill file so tech-lead doesn't re-discover it. The 120-test-mention session was a one-off evaluator emergency, not a recurring pattern.

---

### Pattern 3: Code Exploration via grep/sed Chains (11-24 ops per audit session)

**Where seen**: s_1776081149853_169 (24 grep/sed ops across 38 bash calls), s_1776126397964_486 (11 grep/sed ops), s_1776077546612_142 (3 grep/sed ops in a shorter session)

**The pattern**: When auditing code or tracing data flows, tech-lead chains:
1. `grep -rn 'functionName' src/ --include='*.ts'` → find usages
2. `sed -n '100,130p' src/lib/file.ts` → read context
3. `grep -A5 'pattern' src/lib/other.ts` → follow the trail
4. Repeat 5-15 times per audit topic

This is the "Lens" audit workflow — tech-lead runs ~14 Lens sessions/day averaging 16-59 ops. The grep→sed→grep chain is the fundamental operation.

**Existing mitigation**: `scripts/code-search.sh` exists but tech-lead rarely uses it (only 1 usage spotted). The `read` tool could replace many `sed -n` calls but tech-lead prefers bash for chaining.

**Estimated savings**: A `trace-symbol.sh <symbol>` tool that shows definition + all usages + surrounding context in one call could save 3-5 ops per audit. With 14 Lens sessions/day, that's **42-70 ops/day**.

**Recommendation**: **BUILD (light)** — Create `scripts/trace-symbol.sh` that:
- Finds definition (grep for `function X\|const X\|class X`)
- Lists all import/usage sites with 3 lines of context
- Shows the file:line for each
- Single command replaces 3-5 grep/sed calls
- Estimated effort: 1-2 hours. Medium ROI.

---

## Summary Table

| Pattern | Frequency | Ops/Occurrence | Weekly Impact | Recommendation |
|---|---|---|---|---|
| Batch review merge | 65 review sessions/wk | 7 ops/branch × N branches | ~200 ops saved | **BUILD** batch mode for review-merge.sh |
| Test-debug loops | Rare (2-3 heavy sessions/wk) | 20-40 wasted ops when mock issue hits | ~60 ops saved | **SKIP** — document mock gotcha |
| grep/sed audit chains | 14 Lens sessions/day | 3-5 ops reducible | ~50 ops/day saved | **BUILD** trace-symbol.sh |

## Additional Observation: PATH Setup Waste

Across all sessions, tech-lead prefixes many commands with `cd /app && export PATH=...`. This appeared 17 times in the 182-op session and 11 times in the 47-op session. This is a per-session environment issue — if PATH were set in the session init, these would be unnecessary. However, this is a framework-level fix, not a tool gap. **Noting for infrastructure team.**

## Priority Recommendation

1. **Immediate**: Extend `review-merge.sh` with `--batch` and `--auto-resolve=ours` for workspace files
2. **Next**: Build `trace-symbol.sh` for code audits  
3. **Low priority**: Add bun test mock isolation skill/doc
