# Token Waste Analysis: Executive Brief & Action Items

**Date**: 2026-04-09 | **Analyst**: Bob | **Status**: FINAL  
**Total system cost analyzed**: $790.92 across 1,153 sessions (7-day window)  
**Projected weekly run rate**: ~$728/week (Claude Opus alone)

---

## The One-Liner

**60% of our spend is wasted on re-processing tokens that should be cached. A 5-minute env var change saves $441/week ($1,886/month).**

---

## Top 3 Waste Sources

### 1. 🔴 Zero Prompt Caching on Claude Opus — $441/week (60.6%)

**Problem**: All 863 Claude Opus sessions have **0% cache hit rate**. The Anthropic API supports prompt caching natively, and our SDK correctly sets `cache_control` headers — but the LiteLLM proxy strips them before forwarding to Anthropic.

**Evidence** (verified this session):
- Recent sessions show `cacheRead: 0, cacheWrite: 0` on every Claude turn
- GPT-5.2 sessions achieve 81.5% cache rate through their native path
- `ANTHROPIC_API_KEY` is NOT in `.env` (confirmed: `grep -c` returns 0)
- Fix commit `7c86665` exists: bypasses LiteLLM for Anthropic when API key is set

**Fix**: Set `ANTHROPIC_API_KEY` in `.env` + restart PID 7  
**Effort**: 5 minutes (human action)  
**Savings**: $441/week → **$1,886/month** → **$22,629/year**  
**Risk**: Zero — code tested, just needs env var

---

### 2. 🟡 Long Session Context Accumulation — $50-100/week (7-13%)

**Problem**: 176 sessions (15.3%) with 31+ turns consume **$528.43 (66.8% of total cost)**. Context windows sawtooth between ~150 tokens (post-compaction) and ~50K tokens (pre-compaction), costing $3-4 per cycle.

**Evidence**:
| Turn Bucket | Sessions | % of Sessions | Cost | % of Cost | $/Session |
|------------|--------:|-----------:|-----:|---------:|----------:|
| 1-5        | 216     | 18.7%      | $12.76 | 1.6%   | $0.06     |
| 6-10       | 238     | 20.6%      | $34.80 | 4.4%   | $0.15     |
| 11-20      | 388     | 33.7%      | $113.36| 14.3%  | $0.29     |
| 21-30      | 135     | 11.7%      | $101.57| 12.8%  | $0.75     |
| **31+**    | **176** | **15.3%**  |**$528**| **66.8%**| **$3.00** |

The top 30 sessions (2.6%) account for $195 (24.7%).

**Fixes** (in priority order):
1. **Hard session limit at 25-30 turns** with forced checkpoint + fork — splits one $6.64 session into 4×$1.00 sessions (Effort: Medium)
2. **Aggressive compaction** — keep less context in compaction summaries (Effort: Medium)
3. **Turn discipline enforcement** — structural guard, not just context guidance (Effort: Low)

---

### 3. 🟢 Duplicate Reads + Oversized Tool Results — $15-25/week (2-3%)

**Problem**: 107 duplicate read instances across 100 sessions, 5.15 MB of redundant content. Three files cause most waste: `INDEX.md` (51KB, read 5-7×/session), `todo.md` (51KB, 4-6×), `PRIORITY-TRACKER.md` (28KB, 5-6×).

**Mitigation already in place**: Read-dedup guard blocks after 5 reads. But:
- Files >50KB get read 3× before the warn threshold
- `system_status` returns 130KB per call (6 calls = 780KB)

**Fixes**:
1. **Split INDEX.md** into topic sub-indices (<15KB each) — Effort: Low-Med
2. **system_status summary mode** — default 5KB output — Effort: Low
3. **Size-aware read limits** — stricter dedup for files >20KB — Effort: Low

---

## Cost Reduction Roadmap

```
Current weekly cost:  $790/week
                      ─────────

After prompt caching:  $349/week  (-$441, just env var)
After session limits:  $274/week  (-$75, needs code)
After read/tool fixes: $254/week  (-$20, needs code)
                       ─────────
Target:                $254/week  (68% reduction)
```

---

## Verification Checklist

| Claim | How to verify |
|-------|--------------|
| Claude cache rate is 0% | `grep cacheRead .state/sessions/*/session.jsonl` — all zeros |
| ANTHROPIC_API_KEY missing | `grep ANTHROPIC_API_KEY .env` — not found |
| Fix commit exists | `git log --oneline 7c86665` → "feat: bypass LiteLLM for Anthropic when ANTHROPIC_API_KEY is set" |
| GPT-5.2 achieves 81% cache | Check any qa/evaluator session.jsonl — cached_tokens > 0 |
| 31+ turn sessions = 67% cost | Aggregation from session.jsonl usage fields across 1,153 sessions |

---

## Supporting Reports

| Report | Path | Scope |
|--------|------|-------|
| Full analysis (100 sessions) | `agents/bob/workspace/token-waste-analysis.md` | Detailed per-tool breakdown |
| Deep dive (1,153 sessions) | `agents/bob/workspace/token-waste-analysis-v2.md` | Full history, all agents |
| This brief | `agents/bob/workspace/token-waste-executive-brief.md` | Executive summary + actions |

---

## Key Insight

The input:output token ratio is **34.6:1**. This means every dollar of input optimization saves 35× more than output optimization. Prompt caching (an input optimization) is by far the highest-leverage fix available — and it's already built, just not deployed.
