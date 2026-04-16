# Finding: Tool Gap Analysis — 6h Bash Pattern Scan (Apr 16 afternoon)

**Date**: 2026-04-16 15:00 UTC  
**Scope**: Sessions from last 6h (since ~09:00 UTC), opCount > 5, non-may agents  
**Method**: Queried sessions DB, reviewed op counts and waste metrics

## Sessions Analyzed

| Agent | OpCount | Productive | Wasted | Task Summary |
|-------|---------|-----------|--------|-------------|
| optimizer | 289 | 250 | 0 | Heartbeat work session |
| tech-lead | 272 | 314 | 1 | Guards-v2 Phase 1 implementation |
| coach | 252 | 298 | 1 | EXP-070 Phase 2 |
| tech-lead | 202 | 228 | 10 | Heartbeat |
| coach | 188 | 215 | 0 | EXP-117 investigation |
| bob | 187 | 0 | 0 | Scenario gap-fill |
| coach | 184 | 196 | 1 | Training resume |
| tech-lead | 182 | 245 | 1 | Fix broken evaluator |
| optimizer | 176 | 233 | 0 | Optimization analysis |
| coach | 166 | 183 | 1 | EXP-123 investigation |

**Total**: ~2,098 ops across top 10 sessions. Waste rate: 15/2098 = **0.7%** — extremely low.

## Key Finding: No New Tool Gaps

The last 6h shows near-zero waste. Previous analyses (Apr 15 evening, Apr 16 early) identified three recurring patterns:

1. **PATH setup boilerplate** (`export PATH=".state/.bun/bin:$PATH"`) — still unaddressed in infrastructure
2. **DB query boilerplate** (long `bun -e "import{Database}..."` one-liners) — still unaddressed
3. **`cd /app` prefix** — unnecessary since cwd is always /app

### Status of Prior Recommendations

| Recommendation | Status | Impact if Fixed |
|---------------|--------|----------------|
| Add `.state/.bun/bin` to session PATH automatically | ❌ Not implemented | Saves ~1 op/session across all agents |
| Create `scripts/db-query.sh` wrapper | ❌ Not implemented | Saves boilerplate in ~30% of sessions |
| Document cwd is always `/app` | ❌ Not implemented | Minor — agents mostly know this now |

### Why Waste Is So Low

The system is mature. High-op sessions (200-290 ops) are doing real work (implementing guards, running experiments, fixing evaluator). The waste that exists (tech-lead 10 wasted in heartbeat) is typical heartbeat overhead, not tool gaps.

## Conclusion

**No new tool gaps identified.** The three previously-identified patterns remain the only actionable items. Given the 0.7% waste rate, the ROI of building new tools is minimal. The biggest remaining win is the automatic PATH setup, which would save ~1 redundant bash call per session across hundreds of sessions/day.

## Recommendation

Implement the PATH fix (highest ROI of the three). The other two are nice-to-haves. No new scripting/tooling investment warranted at this time.
