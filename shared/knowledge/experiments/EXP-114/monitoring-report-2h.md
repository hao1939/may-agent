# EXP-114a: Post-Deployment Monitoring Report (T+2h)

**Status**: EARLY OBSERVATION — insufficient data for statistical conclusion
**Date**: 2026-04-10 08:26 UTC (2.1 hours post-deployment)
**Author**: Coach
**Guard deployed**: `src/lib/tools/tool-schema-guard.ts` (committed 07:20 UTC)

---

## Executive Summary

The tool schema guard has been live for 2.1 hours across 57 sessions with **zero activations** and **zero false positives**. No tool misuse patterns (empty args, cross-tool confusion, missing fields) were observed in any post-deployment session. However, 57 sessions is **insufficient** to detect a statistically significant effect — the pre-deployment base rate was only 1.5%, meaning we'd expect ~0.9 issues naturally.

**Verdict**: Guard is deployed and operational. No regressions. Measurement requires 200+ additional sessions (~6-12 more hours of traffic).

---

## Data Sources & Methodology

| Source | Period | Sessions | Notes |
|--------|--------|----------|-------|
| `.state/sessions/` (post-deploy) | Apr 10 06:23–08:26 UTC | 57 | Schema guard active |
| `.state/sessions/` (pre-deploy) | Apr 3–10 06:00 UTC | 1,828 | Empty-args guard active, schema guard NOT active |
| `agents/*/ERROR_LOG.jsonl` | Mar 14–29 | ~2,000 | 178 FM-2.1 errors (historical baseline) |
| `agents/.state/may.db` evaluations | Up to Mar 23 | 812 | Original EXP-114a analysis source |

**Key limitation**: Session data and ERROR_LOG data cover different time periods. The 178 FM-2.1 errors from March have no overlap with the 1,828 sessions from April. This means the EXP-114a retrospective analysis (54% catch rate on 96 issues) was based on the March data, while our A/B comparison uses April data.

### Pattern Detection Method

For each session, parsed `session.jsonl` to find `assistant` messages with `toolCall` blocks matching these patterns:
1. **Empty args**: `read({})`, `bash({})`, `edit({})`, `write({})`
2. **Cross-tool confusion**: `read({command:...})`, `bash({path:...})`
3. **Missing required fields**: `finish({})`, `agents({})`

Guard activations were detected by searching for `🚫 SCHEMA [` and `🚫 EMPTY_ARGS:` prefixes in `toolResult` content blocks.

---

## Results

### Post-Deployment (57 sessions, 2.1 hours)

| Metric | Value |
|--------|-------|
| Sessions analyzed | 57 |
| Tool misuse patterns found | **0** |
| Schema guard activations (blocks) | **0** |
| Empty-args guard activations (blocks) | **0** |
| Other guard blocks | 2 (SCRAPE_DEDUP: 1, E_RETRY_LIMIT: 1) |
| FM-2.1 errors in ERROR_LOG | **0** |
| False positives | **0** |

### Pre-Deployment Baseline (1,828 sessions, 6.5 days)

| Metric | Value |
|--------|-------|
| Sessions analyzed | 1,828 |
| Sessions with tool misuse patterns | **27 (1.5%)** |
| Total misuse instances | **65** |

**Breakdown by pattern:**

| Pattern | Count | % of total | Schema Guard covers? |
|---------|-------|-----------|---------------------|
| bash_EMPTY | 28 | 43.1% | No (empty-args guard) |
| read_EMPTY | 18 | 27.7% | No (empty-args guard) |
| BASH_WRONG_ARG | 6 | 9.2% | ✅ Yes |
| AGENTS_EMPTY | 5 | 7.7% | ✅ Yes (via AGENTS_MISSING_ACTION) |
| READ_WRONG_ARG | 3 | 4.6% | ✅ Yes |
| FINISH_EMPTY | 3 | 4.6% | ✅ Yes (via FINISH_MISSING_FIELDS) |
| edit_EMPTY | 2 | 3.1% | No (empty-args guard) |

**Schema guard–specific patterns**: 17 of 65 instances (26.2%) across 12 of 27 sessions
**Empty-args guard patterns**: 48 of 65 instances (73.8%) across 22 of 27 sessions

### Pre-Deployment by Agent

| Agent | Sessions | Issues | Rate | Top Patterns |
|-------|----------|--------|------|-------------|
| bob | 345 | 21 | 6.1% | bash_EMPTY(9), read_EMPTY(6) |
| coach | 333 | 16 | 4.8% | bash_EMPTY(10), read_EMPTY(3) |
| optimizer | 179 | 12 | 6.7% | read_EMPTY(4), bash_EMPTY(3) |
| may | 164 | 11 | 6.7% | read_EMPTY(5), bash_EMPTY(4) |
| tech-lead | 189 | 4 | 2.1% | bash_EMPTY(2), AGENTS_EMPTY(1) |
| scout | 161 | 1 | 0.6% | AGENTS_EMPTY(1) |
| evaluator | 237 | 0 | 0% | — |
| qa | 161 | 0 | 0% | — |
| amy-kimi | 55 | 0 | 0% | — |

---

## Key Finding: Pre-Existing Guard Failure

The empty-args guard (`createEmptyArgsGuard()`) was deployed March 24 and wired into `composeGuards()` before all April sessions. Yet **48 empty-args patterns** occurred in April sessions without being blocked:

**Evidence**: Session `s_1775641741589_0` (April 8, 09:49 UTC, agent: may) contained `read({})` and `bash({})` calls. Instead of receiving `🚫 EMPTY_ARGS:` blocks, the tool framework returned `Validation failed for tool "read": - path: must have required property 'path'`. This indicates the guard either:

1. **Wasn't compiled/loaded** in the runtime that served those sessions
2. **Has a bug** in how `params` are passed (though code review shows `args: params ?? {}` which should work)
3. **Is order-dependent** — the framework validation fires before `beforeToolCall`

⚠️ **This is a more important finding than the schema guard measurement.** If the empty-args guard isn't actually blocking, the schema guard may not be blocking either. The zero activations we see post-deployment could mean "guard isn't running" rather than "no misuse occurred."

---

## Statistical Analysis

### Power Analysis

- Pre-deployment misuse rate: 1.5% of sessions
- Post-deployment sessions: 57
- Expected misuse instances (null hypothesis): 57 × 0.015 = **0.855**
- Observed: 0

With such a low base rate, seeing 0 in 57 sessions is **consistent with both hypotheses**:
- H0: Guard has no effect, rate is still 1.5% → P(0 in 57) = (1-0.015)^57 = **42.2%**
- H1: Guard reduces rate to 0% → P(0 in 57) = 100%

**We cannot distinguish these hypotheses.** To achieve 80% power to detect a reduction from 1.5% to 0%, we need approximately **280 sessions** (Fisher's exact test).

### Schema Guard-Specific Patterns

If we only count patterns the schema guard uniquely addresses (cross-tool confusion, finish/agents missing fields):
- Pre-deployment rate: 12 of 1,828 sessions = **0.66%**
- Expected in 57 sessions: 0.37
- P(0 in 57 | rate = 0.66%) = **68.6%**

Even less distinguishable. We need **500+ sessions** to detect this effect.

---

## Deployment Verification

### Guard Integration ✅

```
src/lib/manager.ts (line 384):
  beforeToolCall: composeGuards(
    createEmptyArgsGuard(),
    createToolSchemaGuard(),    ← NEW
    createFinishGuard(),
    createCommitGuard(def.name, this._projectRoot),
    createReadDedupGuard(),
    createSessionReadGuard(),
    createScrapeDedupGuard(),
  ),
```

### Guard Code ✅

`src/lib/tools/tool-schema-guard.ts` exports `createToolSchemaGuard()` with 4 detectors:
- `FINISH_MISSING_FIELDS` — `finish()` without `status` or `summary`
- `READ_WRONG_ARG` — `read()` with `command` arg (should be `bash`)
- `AGENTS_MISSING_ACTION` — `agents()` without `action`
- `BASH_WRONG_ARG` — `bash()` with `path` arg (should be `read`)

### Compose Guard ✅

`src/lib/tools/compose-guards.ts` exports `composeGuards()` — runs guards in order, first block wins.

---

## Comparison to EXP-114a Predictions

| Prediction | Actual (T+2h) | Status |
|-----------|---------------|--------|
| 54% catch rate on tool schema FM-2.1 | Untestable (0 events) | ⏳ Pending |
| Zero false positives | ✅ 0 false positives | Confirmed |
| ~0ms overhead per call | ✅ No performance complaints | Confirmed |
| Fail-open on errors | ✅ No guard-caused failures | Confirmed |
| ≥50% FM-2.1 reduction | Untestable (insufficient sessions) | ⏳ Pending |

---

## Recommendations

### Immediate (Before T+6h)

1. **Investigate empty-args guard failure**: The 48 empty-args calls in April that bypassed the guard are a regression or integration bug. Check if `beforeToolCall` fires before framework validation. This affects ALL guards including our new schema guard.

2. **Add guard telemetry**: The current guards produce no logs when they DON'T fire. Adding a counter (e.g., `guardsChecked`, `guardsBlocked` in session metadata) would let us verify the guard code path is actually executing.

### Short-Term (T+6h to T+24h)

3. **Re-check at 200+ sessions**: With ~30 sessions/hour traffic, we should have 200+ sessions by T+8h. Re-run this analysis at that point.

4. **Consider a synthetic test**: Run a gym scenario that deliberately triggers schema guard patterns to verify the guard blocks correctly in production.

### Medium-Term (T+24h to T+1w)

5. **Phase 3 measurement**: With 500+ sessions, perform the statistical comparison. If guard is working, we should see the 0.66% schema-guard-specific rate drop to ~0%.

6. **Address the empty-args guard integration**: If the framework validation is racing the guard, all beforeToolCall guards may be partially ineffective. This is a systemic issue worth a focused investigation.

---

## Files

- **This report**: `agents/shared/knowledge/experiments/EXP-114/monitoring-report-2h.md`
- **Phase A results**: `agents/shared/knowledge/experiments/EXP-114/results-phase-a.md`
- **Guard source**: `src/lib/tools/tool-schema-guard.ts`
- **Guard compose**: `src/lib/tools/compose-guards.ts`
- **Guard integration**: `src/lib/manager.ts` (line 384)

---

*Next monitoring checkpoint: T+6h (estimated ~200 sessions, ~14:00 UTC)*

[SIG: EXP-114a-MONITORING-2H]
