# Finding: Coach EXP-166 Setup Session (101 ops) — Efficiency Analysis

**Date**: 2026-04-16
**Session**: `s_1776291806770_153` (coach, 101 ops, $4.41, 90 turns)
**Task**: EXP-166: Content-First vs Process-First Guard Comparison — Setup & Smoke Test
**Verdict**: Good quality (0.86) but moderate efficiency (0.72)

---

## What the Session Did

The 101-op session performed experiment setup and smoke-testing for EXP-166:
1. **Read context** — EXP-166 design, existing scenarios, prior experiment results
2. **Created 6 scenario variants** — 3 arms × 2 base scenarios (sql-injection, cascading-fix-trap)
3. **Smoke-tested** — 8 gym runs (1 per variant + 2 baselines)
4. **Updated status** — EXP-166/task.md → SCENARIOS READY

## Cost Breakdown (from evaluation data)

| Metric | Value |
|--------|-------|
| Total ops | 101 |
| Turns | 90 |
| Cost | $4.41 |
| Input tokens | 1,344,362 |
| Output tokens | 24,900 |
| Quality | 0.86 |
| Efficiency | 0.72 |
| Wasted calls (from failure chains) | 4 |

## Comparison: Coach vs Bob on Same Work

Bob independently did the scenario variant creation in a separate session:

| Metric | Coach (setup+smoke) | Bob (variants only) |
|--------|---------------------|---------------------|
| Ops | 101 | 50 |
| Cost | $4.41 | $0.36 |
| Turns | 90 | 28 |
| Quality | 0.86 | 0.73 |
| Efficiency | 0.72 | 0.62 |
| Failure chains | 4 wasted (path confusion) | 0 wasted (but cleanup issue) |

**Key insight**: Both agents did overlapping work (scenario creation). Bob's 50 ops/$0.36 was dramatically cheaper for the same deliverable. The coach then also ran 8 smoke tests, which accounts for much of the additional ops — but the duplication is the real waste.

## Where Coach's 101 Ops Were Spent

### Root Cause of Bloat: Path Confusion (4 wasted ops)
The evaluator flagged: "Minor path confusion early (used relative `agents/gym/scenarios` instead of `/app/agents/gym/scenarios`), causing several wasted discovery commands."

This is a recurring pattern — the failure chain shows:
1. `ls agents/gym/scenarios/ | grep exp166` → fails (relative path)
2. Recovery: `cd agents && git status` → fails (still wrong dir)
3. Recovery: `ls /app/agents/gym/scenarios/` → works
4. Extra grep for cleanup scripts → unnecessary

**4 ops wasted on path resolution** that could have been 1 op with absolute paths.

### Smoke Testing Overhead (~30-40 ops estimated)
The smoke test phase (8 gym runs) likely consumed 30-40 ops. Each gym run requires: launch command + parse output + verify result = ~4-5 ops per run. This is legitimate work but raises the question: **was 8 smoke tests necessary?**

For a well-tested scenario framework, 2-3 smoke tests (one per arm type) would provide sufficient confidence. Testing all 8 variants is thorough but expensive.

### Scenario Creation (~50-60 ops estimated)
The core work: reading base scenarios, creating 6 variants with configs, task files, expert analysis content, and success criteria. This is irreducible complexity — each variant needs scenario.json, task.md adjustments, and in some cases multi-phase configuration.

## Coach's ~90-110 Op Pattern (Systemic)

This session fits a broader pattern. The last 10 coach work sessions in the 85-110 op range:

| Session | Ops | Cost | Task Type |
|---------|-----|------|-----------|
| EXP-166 Setup | 101 | $4.41 | Experiment setup + smoke |
| QA Regression Investigation | 92 | $4.39 | Investigation |
| QA Convention Analysis | 88 | $2.89 | Analysis |
| Error Pattern Analysis | 89 | $5.94 | Investigation |
| Growth Cycle Results | 87 | $8.12 | Growth cycle |
| EXP-127 Channel Test | 98 | $6.44 | Experiment run (24 trials) |
| Sprint Tracking | 88 | $0 | Planning |
| EXP-127 Run | 91 | $0 | Experiment run |
| Error Analysis Sprint | 85 | $3.77 | Sprint |
| Scenario Design | 94 | $7.77 | Scenario creation |

**Average**: 91.3 ops, $4.37/session. The coach consistently lands at 85-110 ops regardless of task type. This suggests a **fixed overhead pattern** — the coach uses most of its op budget on every session.

## Technique Recommendations

### 1. Eliminate Scenario Creation Duplication
Both coach and Bob created EXP-166 variants independently. The coach's task explicitly included variant creation, AND Bob was separately assigned variant creation. **Cost of duplication**: ~50 ops ($0.36-$2 depending on agent).

**Fix**: When dispatching experiment setup, clearly split responsibilities:
- One agent creates variants
- The other agent (or same agent in next session) smoke-tests them
- Never assign the same sub-task to two agents

### 2. Template Scenario Variants
The 6 EXP-166 variants follow a predictable pattern (base scenario × {F1, F2, F1→F2} intervention). This could be scripted:

```bash
# Hypothetical: create-arm-variants.sh sql-injection-in-query-builder \
#   --f1-analysis "path/to/expert-analysis.md" \
#   --output-dir agents/gym/scenarios/
```

Each variant only differs in:
- Phase configuration (single vs multi-phase)
- Whether expert analysis is pre-planted
- Whether agent must produce analysis in Phase 1

A template generator would reduce 50+ ops of manual variant creation to ~5 ops (run generator + verify output).

### 3. Reduce Smoke Testing to Spot Checks
8 smoke tests is thorough but expensive. For scenario variants that share the same:
- Base environment
- Success criteria
- Core task structure

Only 2-3 tests are needed:
- 1 baseline (verify base still works)
- 1 multi-phase variant (verify phase mechanics)
- 1 content-first variant (verify file pre-planting)

**Savings**: ~20-25 ops per experiment setup session.

### 4. Fix Path Resolution (Active Recall)
The coach repeatedly uses relative paths that fail. Adding to coach's persistent context:
> "Gym scenarios are at /app/agents/gym/scenarios/, not relative agents/gym/scenarios/"

Would save 2-4 ops per session where path confusion occurs.

### 5. Coach Op Budget Pattern
The coach consistently uses 85-110 ops. This isn't necessarily waste — it may be operating at capacity on genuinely complex tasks. But the consistency suggests the coach **fills available space** rather than finishing early.

**Observation**: Bob did comparable variant creation work in 50 ops at $0.36 vs coach's 101 ops at $4.41. The 12× cost difference is mostly input token volume (1.3M tokens for coach vs ~50K for Bob). This suggests the coach's context window is accumulating heavily — possibly from reading many reference files or having long system prompts.

## Conclusion

The EXP-166 101-op session was **productive but inefficient**. The core deliverable (6 scenario variants + smoke tests) was completed at good quality. The main inefficiencies were:

1. **Duplication with Bob** (~50 ops wasted across the system)
2. **Excessive smoke testing** (8 runs vs needed 2-3, ~20 ops)
3. **Path confusion** (4 ops wasted, recurring pattern)
4. **High context accumulation** (1.3M input tokens driving cost to $4.41)

**Projected savings if all recommendations applied**: ~30 ops, ~$1.50 per experiment setup session. The template generator (#2) would have the highest long-term ROI — each new experiment that follows the arm-variant pattern would save ~40 ops.

---

*Generated by optimizer Mode C: Skill & Technique Scouting — 2026-04-16*
