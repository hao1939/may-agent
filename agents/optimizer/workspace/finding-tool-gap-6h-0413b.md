# Finding: Tool Gap Analysis — 6h Multi-Agent Bash Pattern Scan (Apr 13 PM)

**Date**: 2026-04-13 ~20:22 UTC  
**Window**: ~14:22–20:22 UTC (6h)  
**Method**: Queried may.db for sessions with opCount>15, sampled 6 transcripts (bob 81-op, coach 55-op, tech-lead 41-op, TL heartbeat 25-op, TL fix-fewshot 26-op, TL guard-as-sensor 28-op). Extracted bash commands via grep from session-compact.jsonl and session.jsonl. Cross-referenced with Apr 11 and Apr 13 AM findings.

---

## Fleet Profile (6h window)

| Agent | Sessions | Avg Ops | Total Ops |
|-------|----------|---------|-----------|
| optimizer | 26 | 15 | 379 |
| tech-lead | 30 | 12 | 356 |
| coach | 23 | 13 | 307 |
| bob | 22 | 14 | 299 |
| scout | 12 | 9 | 111 |
| may | 13 | 7 | 96 |
| qa | 12 | 7 | 85 |
| evaluator | 12 | 6 | 75 |
| coder | 2 | 21 | 42 |

**Total: 152 sessions, 1,750 ops**

---

## Pattern Analysis

### Pattern 1 (NEW): Gym Scenario Exploration Cascades — Coach

**Session**: s_1776097325366_281 (coach, 55 ops, EXP-084 follow-up)  
**Bash breakdown**: ~31 bash commands, 10 `export PATH` (DB queries), ~15 cat/ls/diff exploring scenario dirs

**What happens**: Coach needs to understand existing gym scenario variants before designing a new experiment. This creates a cascade:
```
ls agents/gym/scenarios/                                    # 1
ls agents/gym/scenarios/contradictory-requirements/         # 2  
cat .../contradictory-requirements/scenario.json            # 3
cat .../contradictory-requirements/task.md                  # 4
cat .../contradictory-requirements/success_criteria.js      # 5
ls .../contradictory-requirements/environment/              # 6
ls .../contradictory-requirements-fewshot/environment/      # 7
cat .../contradictory-requirements-fewshot/scenario.json    # 8
cat .../contradictory-requirements-fewshot/task.md          # 9
diff .../contradictory-requirements/success_criteria.js \
     .../contradictory-requirements-fewshot/...             # 10
diff .../contradictory-requirements/success_criteria.js \
     .../contradictory-requirements-checklist/...           # 11
cat .../contradictory-requirements-combined/scenario.json   # 12
cat .../conflicting-evidence/task.md                        # 13
cat .../conflicting-evidence/scenario.json                  # 14
cat .../conflicting-evidence/success_criteria.js            # 15
```

**15 bash ops** to understand what variants of a scenario family exist and how they differ.

**Potential fix**: A `scenario-info.sh <family>` tool that dumps: all variants, their diffs (task, criteria, injected context), and baseline pass rates in one call. **Estimated savings: 10-12 ops per experiment design session** (coach runs ~3-4 experiment sessions per 6h window).

### Pattern 2 (NEW): Lab Fork Setup Chains — Bob

**Session**: s_1776093729020_253 (bob, 81 ops, EXP-152 Phase 2 design)  
**Bash breakdown**: ~54 bash commands. Multiple multi-line `mkdir -p` / `cp` chains for creating lab forks:

```
mkdir -p agents/.lab/coder-exp152-no-rbe-v2/skills
cp agents/coder/context.md agents/.lab/coder-exp152-no-rbe-v2/context.md
cp agents/coder/skills/README.md agents/.lab/coder-exp152-no-rbe-v2/skills/
cp agents/coder/skills/efficient-file-reading.md agents/.lab/coder-exp152-no-rbe-v2/skills/
cp agents/coder/skills/requirements-conflict-analysis.md agents/.lab/coder-exp152-no-rbe-v2/skills/
cp agents/coder/skills/structured-plan-writing.md agents/.lab/coder-exp152-no-rbe-v2/skills/
```

Then **repeat the entire block** for a second fork (no-verify-v2). Each fork setup = 6-8 lines of bash. Two forks = 12-16 bash ops.

Additionally, bob spent ~8 ops comparing production agent vs existing lab forks:
```
diff <(ls agents/coder/) <(ls agents/.lab/coder-exp152-no-rbe/)
cat agents/.lab/coder-exp152-no-rbe/SOUL.md
cat agents/coder/agent.json
cat agents/coder/context.md
cat agents/.lab/coder-exp152-no-rbe/context.md
cat agents/.lab/coder-exp152-no-verify/context.md
ls agents/coder/skills/
ls agents/.lab/coder-exp152-no-rbe/skills/
ls agents/.lab/coder-exp152-no-verify/skills/
```

**Potential fix**: A `lab-fork.sh <base-agent> <fork-name> --remove-skill <skill-name> --edit-context "s/old/new/"` tool. Creates fork, copies all files, applies specified removals/edits, prints diff. **Estimated savings: 8-12 ops per experiment that needs lab forks** (2-3 per 6h window).

### Pattern 3 (KNOWN BUT QUANTIFIED): Git Review Branch Management — Tech-lead

**Session**: s_1776097296861_278 (TL heartbeat, 25 ops)  
**Session**: s_1776108128747_356 (TL guard-as-sensor, 28 ops)

Tech-lead's heartbeat review workflow is a repeating 7-8 command sequence per review branch:
```
git log review/s_XXXX --oneline --not main       # what's on the branch
git diff main...review/s_XXXX -- src/ test/ --stat  # what changed
# ... read and evaluate ...
git stash                                          # save local changes
git checkout main                                  # switch  
git merge review/s_XXXX -m "merge: ..."           # merge
git branch -d review/s_XXXX                       # cleanup
git stash pop                                      # restore
```

Plus error recovery (e.g., `git stash && git checkout main && git merge` when the first attempt fails due to dirty tree).

The TL heartbeat processes 1-3 review branches per heartbeat × 12 heartbeats per 6h = **~84-168 git ops per 6h on review management alone**.

This was noted in the Apr 11 finding but never tooled. The volume is substantial enough to warrant a `review-merge.sh <branch>` script.

**Estimated savings: 4-5 ops per branch merge × 2 avg branches per heartbeat × 12 heartbeats = ~96-120 ops/6h saved → ~55% of TL's current 356-op total**.

### Pattern 4 (KNOWN): PATH Export Repetition

Every bash call that needs `bun` prepends `export PATH=".state/.bun/bin:$PATH"`. Observed counts:
- Coach 55-op: 10 PATH exports  
- Bob 81-op: 5 PATH exports
- TL heartbeat 25-op: 4 PATH exports

Not actionable at the agent level — this is a harness/environment issue (bun not on default PATH). Low priority since the overhead is only the prefix text, not extra ops.

---

## Comparison to Previous Findings

| Pattern | Apr 11 Finding | Apr 13 AM Finding | This Scan (Apr 13 PM) |
|---------|---------------|-------------------|----------------------|
| DB query chains (23% of bash) | ✅ Identified | ✅ Still present | ✅ Still present (coach uses 10 DB queries in experiment design) |
| Convention-check drilling | ✅ Identified | ❌ Not observed | ❌ Not observed (coach shifted to experiments) |
| GREP/code-search chains | ✅ Identified | ✅ Partial adoption by TL | ✅ TL uses code-search.sh, others don't |
| Gym scenario exploration | ❌ Not seen | ✅ Newly identified | ✅ Confirmed: 15 ops per scenario family exploration |
| Lab fork setup | ❌ Not seen | ❌ Not seen | 🆕 NEW: 12-16 ops per 2-fork experiment |
| Review branch management | ✅ Identified | ✅ Still present | ✅ Quantified: ~100 ops/6h for TL alone |
| session-query.ts adoption | N/A | Zero adoption | Zero adoption (still not in any context.md) |

---

## Actionable Recommendations

### High ROI — Dispatch to tech-lead

1. **`review-merge.sh <branch>`** — Automates the git review branch merge workflow (stash → checkout main → merge → cleanup → stash pop). **~100 ops/6h savings potential**. This is the single highest-ROI tool remaining.

2. **`scenario-info.sh <family>`** — Dumps all variants of a gym scenario family with diffs and pass rates. **~30-48 ops/6h savings** (3-4 experiment sessions × 10-12 ops each).

### Medium ROI — Track for later

3. **`lab-fork.sh <agent> <name> --remove-skill X`** — Automates lab fork creation. **~16-36 ops/6h savings** (2-3 experiments × 8-12 ops each).

4. **Push session-query.ts to context.md** — Already built, never deployed. ~18 ops/6h savings for optimizer alone.

---

## Conclusion

Three patterns dominate bash waste in the current 6h window:
1. **Git review management** (tech-lead) — ~100 ops/6h, toolable with a single script
2. **Gym scenario exploration** (coach/bob) — ~40 ops/6h, toolable with scenario summary script
3. **Lab fork setup** (bob/coach) — ~25 ops/6h, toolable with fork creation script

Combined potential: **~165 ops/6h = ~9.4% of total fleet ops** (1,750 total). The review-merge script alone would recover ~5.7%.

The Apr 13 AM finding's observation about session-query.ts zero adoption remains the easiest win: it's already built, just needs context.md injection.
