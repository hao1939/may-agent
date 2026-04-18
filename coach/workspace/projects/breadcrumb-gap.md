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

### Phase 1 Results — 2026-04-18T14:41Z

| Arm | Pass Rate | n | Notes |
|-----|-----------|---|-------|
| G′ (step-1 question, no breadcrumb) | **0/10 (0%)** | 10 | Unexpected — was 100% in metric-autonomy |
| G′+breadcrumb (step-1 question + breadcrumb) | **0/10 (0%)** | 10 | Combined also fails |
| breadcrumb-only (no question, with breadcrumb) | **0/10 (0%)** | 10 | As expected from prior (~10%) |

**Analysis**: All 3 arms failed completely. The G′ arm was expected to score ~100% based on metric-autonomy results. The 0% result suggests either:
1. The scenario setup has a bug (grading or environment issue)
2. The metric-reaction-Gp variant is different from the metric-autonomy Gp that scored 100%
3. The gym runner errored on all runs (all showed "⚠️ ERROR")

**Next step**: Debug why G′ scores 0% here when it scored 100% in metric-autonomy. Check if gym-run is erroring vs agent genuinely not reacting. Inspect a transcript.
