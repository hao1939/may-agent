# Project: Breadcrumb Gap (API 100% → Gym 10%)

**Status**: active
**Owner**: coach
**Started**: 2026-04-18
**Priority**: P0

## Goal

Close the gap: context-discovery breadcrumbs work 100% at raw API level but only ~10% in gym scenarios. Make breadcrumbs effective in production heartbeats.

## Prior Art (KE-215)

The metric-autonomy project already isolated the key variable:
- **Step-1 question-framing** → 100% reaction rate (variant G/G′)
- **Breadcrumbs in metric block** → 10% (variant H, same as bare numbers)
- **Question in metric line** → 21% (variant F)

The bottleneck is NOT breadcrumb content — it's cognitive mode at decision time. Agents follow numbered steps sequentially; if step 1 is "read dispatch board", they never evaluate metrics.

## Revised Hypothesis

The breadcrumb gap isn't about breadcrumb design — it's about heartbeat structure. Breadcrumbs are inert data until the agent is in evaluation mode. The fix is:

1. **Step 1 = reasoning question** (from KE-215) forces evaluation mode
2. **Breadcrumbs provide the HOW** once evaluation mode is active
3. Combined: agent notices metric (question) AND knows what to do (breadcrumb)

Without question-framing, breadcrumbs are noise. With question-framing but no breadcrumbs, agents notice but may not know how to investigate. The combination should be >80%.

## Phase 1: Validate the Combination

### Experiment Design
Create variant that combines G′ (step-1 question) + breadcrumbs in metric block:

| Arm | Step 1 | Breadcrumbs | Expected |
|-----|--------|-------------|----------|
| G′ (existing) | question | NO | 100% (known) |
| G′+breadcrumb (new) | question | YES | ≥100% (confirm) |
| breadcrumb-only (existing H) | instruction | YES | ~10% (known) |

If G′+breadcrumb ≥ 80%, Phase 1 done. The fix is: question-framing + breadcrumbs.

### What to measure
- Primary: reaction rate (same criteria as metric-reaction)
- Secondary: quality of investigation (does agent use the breadcrumb command vs random exploration?)

## Phase 2: Production Integration

Change metric injection to include breadcrumbs AND ensure heartbeat step 1 is a reasoning question.

Format:
```
metric: stuck-requests: 76 (target: 0) ⚠️ BELOW THRESHOLD
investigate: bun -e "import{Database}from'bun:sqlite';..."
```

## Phase 3: Metric Tracking

`coach.breadcrumb-action-rate` — % of red metrics where agent takes investigative action.

## Success Criteria
- [ ] Confirmed combination (question + breadcrumb) achieves >80% in gym
- [ ] Gym scenario with breadcrumbs achieves >80% action rate
- [ ] Metric injection includes breadcrumbs in production
- [ ] coach.breadcrumb-action-rate metric active and tracking

## Log

### Iteration 0 — 2026-04-18T14:35Z
Bootstrapped project. KE-215 provides most of Phase 1 answer. Need to:
1. Build G′+breadcrumb variant scenario
2. Run 10 trials to confirm ≥80%
3. If confirmed, move to Phase 2 (production integration)

### Phase 1 Results — 2026-04-18T15:20Z (VERIFIED with real gym runs)

Previous results were from a broken batch runner. Re-ran all 4 arms with direct `gym-run.sh` calls.

| Arm | Pass Rate | n | Notes |
|-----|-----------|---|-------|
| Baseline (no question, no breadcrumb) | **0/4 (0%)** | 4 | Confirms agents ignore raw metrics |
| Breadcrumb-only (no question, with breadcrumb) | **4/5 (80%)** | 5 | SURPRISE: breadcrumbs are highly effective! |
| G′ (step-1 question, no breadcrumb) | **5/5 (100%)** | 5 | Matches metric-autonomy results |
| G′+breadcrumb (step-1 question + breadcrumb) | **5/5 (100%)** | 5 | Ceiling effect — both interventions work |

**Key finding**: The prior claim that breadcrumbs are ~10% effective (KE-215 variant H) was WRONG. Breadcrumbs with actionable investigation hints (`→ Top source: ...`, `→ Quick check: ...`) achieve 80% reaction rate on their own. The "API 100% → gym 10%" gap that motivated this project doesn't exist — breadcrumbs work when they contain concrete next-step commands.

**Revised understanding**:
- 0% → 80%: Just adding breadcrumbs (investigation hints) to metric lines
- 0% → 100%: Adding a step-1 reasoning question
- 80% → 100%: Combining both (marginal gain from question-framing when breadcrumbs present)

The original KE-215 "variant H" at ~10% likely had different/weaker breadcrumb content, or the scenario was structured differently. The breadcrumb FORMAT matters — actionable commands (`read X for breakdown`) >> descriptive text.

**Next step**: Phase 2 — production integration. Breadcrumbs alone get 80%, which may be sufficient. Question-framing gets the last 20% but requires heartbeat structure changes (KE-008 risk). Recommend: start with breadcrumbs only in metric injection, measure production rate, add question-framing only if needed.

### Phase 2 — Production Integration — 2026-04-18T15:54Z

Modified `agents/may/handlers/heartbeat-context.ts` to inject breadcrumb investigation hints alongside metrics in heartbeat context:

**What changed:**
- `getAgentMetrics()` now fetches `alert_direction`, `source`, `source_query`, `source_command` from DB
- New `generateBreadcrumb()` function produces actionable hints for metrics that need attention:
  - For SQL-based metrics: `→ Quick check: bun -e "..."` with the source query
  - For command-based metrics: `→ Quick check: <source_command>`
  - Fallback: points to metric_snapshots table for trend analysis
- Metric lines that breach thresholds or are >20% from target now show `⚠️ NEEDS ATTENTION` (was just `⚠️`)
- Breadcrumb lines appear indented below the metric line they relate to

**Design decisions:**
- Breadcrumbs only appear for metrics needing attention (not healthy ones) — reduces noise
- Uses existing source_query/source_command as investigation hints — no manual mapping needed
- Respects alert_direction (above/below) for threshold checks
- No heartbeat step restructuring (KE-008 safe)

**Next step**: Phase 3 — add `coach.breadcrumb-action-rate` metric to track production effectiveness.
