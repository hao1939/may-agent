# Finding: Coach Cost Crisis — $50/day, 65% of All Spend

**Date:** 2026-03-17T20:49  
**Severity:** 🔴 CRITICAL  
**Data source:** 24h evaluation data (1,870+ sessions, 24M input tokens)

## The Numbers

| Metric | Value |
|--------|-------|
| Coach daily cost | **$50.21** |
| Total system daily cost | **$77.75** |
| Coach % of total | **65%** |
| Coach sessions/day | 425 |
| Coach input tokens/day | 15.6M |
| Coach cache hit rate | **0%** |
| Coach wasted tool calls/day | **453** |

## Root Causes (3 Independent Problems)

### 1. 🔴 Zero Prompt Caching ($190/day opportunity)

Coach uses the Opus model and processes 15.6M input tokens/day with **0% cache hit rate**. Bob, by comparison, achieves near-100% cache utilization on the same system.

- Current daily input token cost: ~$234 (at $15/M)
- With 90% cache: ~$44/day (at $1.5/M for cached)
- **Potential savings: ~$190/day**

This is likely a LiteLLM proxy configuration issue or model-specific caching behavior. Needs investigation by tech-lead.

### 2. 🟡 139 Empty-Arg Tool Failures/Day

Coach triggers 139+ tool calls with missing required arguments daily:
- `bash({})` — 85 occurrences (missing `command`)
- `read({})` — 43 occurrences (missing `path`)
- `edit({})` — 11 occurrences (missing `path`/`oldText`/`newText`)

Each failed call still costs input tokens for the turn + error response. At ~30K tokens per wasted turn average, this is ~4.2M tokens/day wasted = ~$63/day.

**Fix:** Coach's heartbeat.md or SOUL.md needs the same mandatory check that Optimizer has. The gym scenario testing (which is where most of these occur) should validate tool call args before execution.

### 3. 🟡 Gym Scenario Testing Drives 50%+ of Coach Sessions

The expensive sessions ($1+ each) are clustered in bursts that align with training-sprint and common-sense-verify cron jobs. These spawn gym scenarios that each create full LLM sessions:

- sycophants-dilemma: 46 wasted calls
- wrong-tool-args: 36 wasted calls
- phantom-fix: 44 wasted calls (across coder+optimizer)
- abandoned-branch: 20 wasted calls
- silent-dependency: 16 wasted calls
- shutdown-threat: 13 wasted calls

Each gym scenario creates a child session with full context injection — no caching across scenarios.

**Fix options:**
1. Reduce training-sprint frequency (currently 6h → 12h or 24h)
2. Use cheaper model for gym runs (sonnet instead of opus)
3. Batch gym scenarios to share context prefix (enables caching)

## Per-Agent Cost Summary (24h)

| Agent | Daily Cost | Sessions | Cache | Waste |
|-------|-----------|----------|-------|-------|
| coach | $50.21 | 425 | 0% | 453 |
| coder | $15.60 | 4 | 0% | 26 |
| tech-lead | $7.14 | 270 | 0% | 9 |
| optimizer | $2.66 | 133 | 0% | 0 |
| bob | $1.61 | 180 | ~100% | 16 |
| may | $0.53 | 420 | 0% | 3 |
| others | $0.00 | 400+ | 0% | 0 |

## Recommendations (Priority Order)

1. **[CRITICAL] Fix prompt caching for Opus** — investigate why Bob gets cache hits but Coach doesn't. Likely a LiteLLM or Anthropic API config issue. Est. savings: $190/day.

2. **[HIGH] Reduce gym frequency or use cheaper model** — training-sprint every 6h with Opus is expensive. Either:
   - Switch gym runs to Sonnet (~10x cheaper for input tokens)
   - Reduce to 12h or 24h intervals
   - Est. savings: $20-40/day

3. **[MEDIUM] Add arg-validation to Coach's context** — same mandatory check Optimizer has in heartbeat.md. Prevents 139 empty-arg failures/day. Est. savings: ~$10-20/day from reduced wasted turns.

## Total Potential Savings

Conservative: **$100/day** (cache fix + reduced gym frequency)  
Optimistic: **$200/day** (all three fixes)

System daily cost would drop from $77.75 to **$20-40/day** range.

## Update: Tech-Lead Response (2026-03-17T21:15)

Tech-lead responded to cache investigation (req:3e6b33b0) via req:56625ae9:

1. **Bob's cache hits are Gemini's implicit caching** — Bob uses gemini3pro, NOT Anthropic. The comparison was apples-to-oranges and invalid.
2. **Our app code ALREADY requests Anthropic caching** — pi-ai library sets `cache_control: {type: "ephemeral"}` on system prompts and last user message. System prompt is cache-stable by design (P147 KV-Cache Discipline).
3. **Likely blocker: LiteLLM proxy** at `host.docker.internal:4000` may be stripping `cache_control` markers before forwarding to Anthropic. This is an infrastructure config issue, not a code fix.
4. **Coach's "0% cache" data may be unreliable** — Heuristic evaluator (`writeHeuristicEvaluations`) sets all usage fields to 0, so we may be reading missing data as zero caching.

### Revised Cost Estimates

Tech-lead notes gym scenarios are inherently low-cacheability (each has different injected content). System prompt is a small fraction of total input tokens.

- **Previous estimate:** $190/day savings from caching
- **Revised estimate (tech-lead):** $30-80/day savings (system prompt caching works but gym content still uncached)
- **Other fixes still valid:** gym frequency reduction ($20-40/day), arg validation ($10-20/day)
- **Revised total: $60-140/day savings** (still significant)

### Verified: Caching Is Completely Non-Functional for Anthropic (2026-03-17T21:39)

Scanned actual session transcripts (not evaluations — those report 0):

**Cache hit rates by model type:**
| Model | Agent(s) | Cache Rate | Sessions |
|-------|----------|-----------|----------|
| Gemini | bob | 52.2% | 4 |
| Gemini | amy-kimi | 94.0% | 1 |
| Anthropic (Opus) | coach, tech-lead, optimizer, scout, amy | **0.0%** | 14 |
| Anthropic (evaluator) | evaluator | 73.9% | 23 |
| Anthropic (QA) | qa | 87.2% | 1 |

**Within-session proof:** Coach session s_1773783129647_149 (29 turns, $2.97) showed `cacheRead: 0` on every single turn, even turn 29 with 38K input tokens. The conversation prefix that should be cached from turn 2 onwards is completely uncached.

**Exception:** Evaluator has 73.9% cache rate. This may be because evaluator uses a different model config or its API path bypasses LiteLLM.

**Actual pricing:** Opus via LiteLLM → $3/M input, $15/M output (not $15/M input as initially estimated). Cached would be $0.30/M.

**Revised savings from caching fix:**
- 29-turn session: 952K input tokens × 65% cacheable × ($3.00-$0.30)/M = **$1.67 savings per session**
- Coach runs ~5 sessions/sample → ~$8.35/day just from intra-session caching
- With cross-session caching (system prompt): additional ~$5-15/day
- **Total cache savings estimate: $15-25/day** (revised down from $190/day)

### Action Items

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Check LiteLLM proxy config for Anthropic cache_control passthrough | Hao/Ops | ⏳ Needs human |
| 2 | Fix heuristic evaluator to extract real usage from transcript messages | Tech-lead | 📋 Queued |
| 3 | Reduce gym-sprint frequency (6h→12/24h) or use Sonnet for gym | Coach config | 📋 Queued |
| 4 | Add arg-validation to Coach's context | Coach | 📋 Queued |
| 5 | Investigate why evaluator HAS cache but other Anthropic agents don't | Optimizer | 📋 New |
