# Finding: Tool Gap Analysis — Mode B (2026-04-19)

## Scan Window
Last 6h of sessions with opCount > 10.

## Top Sessions Analyzed
| Session | Agent | OpCount | Task |
|---------|-------|---------|------|
| s_1775288719514_12 | optimizer | 289 | heartbeat |
| s_1776158541712_115 | tech-lead | 272 | Guards-v2 Phase 1 |
| s_1775590412319_311 | coach | 252 | EXP-070 scenario redesign |
| s_1775502138823_26 | tech-lead | 202 | heartbeat |
| s_1776584132394_9 | optimizer | ~30 cmds | Mode A archaeology |

## Pattern 1: Scenario Discovery Sprawl (HIGH FREQUENCY)

**Observed in**: s_1776584132394_9, s_1775590412319_311

Agents spend 5-10 bash calls trying to find gym scenarios across multiple paths:
```
ls agents/shared/gym/scenarios/ | grep cascad
ls agents/gym/scenarios/ | grep cascad
find agents/shared -type d -name "cascad*"
ls agents/shared/gym/scenarios/cascading-fix-trap-v2/
ls agents/gym/scenarios/cascading-fix-trap-v2/
```

**Existing tools**: `scripts/gym-run.sh`, `scripts/gym-batch.sh`, `scripts/gym-stats.ts` — but no **scenario lookup/list** tool.

**Proposed tool**: `scripts/scenario-list.sh` — lists all scenarios with metadata (path, categories, tags, baseline pass rate from gym_runs). One command replaces 3-5 discovery calls.

*Note*: `scripts/scenario-oracle.sh` exists but its purpose unclear — may already partially cover this.

## Pattern 2: Experiment Cross-Reference (MEDIUM FREQUENCY)

**Observed in**: s_1776584058380_2, s_1776584132394_9

Agents grep across experiment directories to find related work:
```
grep -l "pattern" agents/shared/knowledge/experiments/EXP-*/results.md
head -20 agents/shared/knowledge/experiments/EXP-187/results.md
head -5 agents/shared/knowledge/experiments/EXP-177/results.md
ls agents/shared/knowledge/experiments/EXP-168/ ...
```

**Existing tools**: None for experiment search.

**Proposed tool**: `scripts/experiment-search.ts` — searches experiments by keyword, agent, status. Returns EXP-ID, title, status, key findings. Would save 3-4 calls per cross-reference.

## Pattern 3: DB Column Discovery (MEDIUM FREQUENCY)

**Observed in**: this session (s_1776585880857_25), and historically common

Agents query tables with wrong column names, get errors, then run PRAGMA table_info. This is partially mitigated by the session context injecting schema info, but agents still trip on it.

**Existing mitigation**: Session context includes key table schemas.

**Status**: Already addressed — no tool needed. The context injection is the right approach.

## Pattern 4: Git Log + File Discovery Combo (LOW-MEDIUM)

**Observed in**: s_1776584132394_9

```
cd agents && git log -1 --oneline -- shared/gym/scenarios/cascading-fix-trap-v2
cd agents && git log -3 --oneline -- gym/scenarios/cascading-fix-trap-v2
```

Agents frequently `cd agents && git log` to check recency of changes. This is a single-command pattern but appears repeatedly.

**Existing tools**: `scripts/git-when.sh` — may already handle this.

## Recommendations (Priority Order)

1. **Check `scenario-oracle.sh`** — if it doesn't list/search scenarios, extend it or create `scenario-list.sh`
2. **Build `experiment-search.ts`** — keyword search across EXP-* dirs, saves 3-4 calls per lookup
3. **No action needed** on DB schema (already in context) or git patterns (low ROI)

## Impact Estimate
- Pattern 1: ~5 wasted calls per session × ~2 sessions/6h = 10 calls saved
- Pattern 2: ~3 wasted calls per session × ~2 sessions/6h = 6 calls saved
- Total: ~16 calls/6h, modest but compounds over time
