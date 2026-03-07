# Token & Cost Tracking Design

> Analysis date: 2026-03-06
> Data source: 708 evaluation files in `.state/evaluations/`
> 256 sessions with non-zero usage, 444 skipped (zero-usage meta-agent evals), 8 errors

---

## Part 1: Analysis of Current Token Usage

### 1.1 Grand Totals

| Metric | Value |
|--------|-------|
| Total cost (all evaluated sessions) | **$377.65** |
| Total input tokens | 115.8M |
| Total output tokens | 1.5M |
| Total cache-read tokens | 7.9M |
| Input/output ratio | 76.6:1 |
| Average daily cost | $62.94/day (6 days of data) |
| Sessions evaluated with non-zero usage | 256 |

### 1.2 Cost by Agent

| Agent | Sessions | Total Cost | Avg Cost | Max Cost | Avg Turns | Cache Hit % |
|-------|----------|-----------|----------|----------|-----------|-------------|
| unknown | 54 | $198.51 | $3.68 | $10.87 | 27.0 | 0.0% |
| coder | 77 | $71.44 | $0.93 | $7.37 | 15.3 | 0.0% |
| coach | 15 | $38.01 | $2.53 | $10.52 | 29.2 | 0.0% |
| amy | 25 | $31.85 | $1.27 | $8.00 | 12.4 | 0.0% |
| bob | 48 | $16.74 | $0.35 | $1.80 | 7.2 | 77.4% |
| scout | 7 | $8.44 | $1.21 | $3.79 | 17.1 | 0.0% |
| optimizer | 6 | $6.51 | $1.08 | $2.18 | 17.7 | 0.0% |
| master | 2 | $3.77 | $1.88 | $3.74 | 16.0 | 0.0% |
| qa | 21 | $2.18 | $0.10 | $0.28 | 4.0 | 59.7% |
| amy-kimi | 1 | $0.21 | $0.21 | $0.21 | 8.0 | 0.0% |

### 1.3 Key Findings

#### Finding 1: "Unknown" agent is the #1 cost center ($198.51, 52.6% of total)
54 sessions with agent="unknown" account for over half of all spend. These are sessions
where evaluator metadata didn't capture the agent name. They have the highest average
cost ($3.68/session) and 27 avg turns. **This is both a data quality issue and likely
represents the most expensive real agents whose costs are invisible.**

#### Finding 2: 60.6% of total cost is pure waste
$228.97 of $377.65 (60.6%) was spent on sessions rated `needs_improvement` with
efficiency < 0.4. Only 33.4% of spend went to sessions rated `good` or `acceptable`.
This means **the single highest-leverage optimization is reducing waste on failing sessions**
(earlier termination, better task scoping, fewer blind retries).

#### Finding 3: Input tokens dominate at 76.6:1 ratio
Agents consume 76.6× more input tokens than they produce as output. This means:
- System prompts + context injection are the primary cost driver
- Cache hits are extremely valuable (Bob saves ~77% with caching)
- Most agents have **0% cache hit rate** — enormous savings opportunity

#### Finding 4: Cost strongly correlates with verdict
| Verdict | Avg Cost | Median Cost | Count |
|---------|----------|-------------|-------|
| good | $0.52 | $0.17 | 72 |
| acceptable | $1.70 | $0.43 | 52 |
| needs_improvement | $1.91 | $0.54 | 132 |

Good sessions are 3.7× cheaper on average and 3.2× cheaper at median than
needs_improvement sessions. **Cheap and good are correlated, not in tension.**

#### Finding 5: Runaway sessions are the tail risk
Top 15 sessions range from $7.37 to $10.87 each. A single bad session can cost
more than 20 good sessions combined. Most are 38-51 turns — suggesting agents
spiral without self-correction. **A hard turn/cost cap would bound tail risk.**

#### Finding 6: Cost-per-turn varies dramatically by agent
| Agent | Cost/Turn |
|-------|-----------|
| unknown | $0.108 |
| master | $0.070 |
| scout | $0.062 |
| coach | $0.061 |
| amy | $0.057 |
| optimizer | $0.050 |
| bob | $0.048 |
| coder | $0.039 |
| qa | $0.027 |

Expensive-per-turn agents (unknown, master, scout) carry more context per turn.
QA is the cheapest per turn — its system prompt and task context are compact.

### 1.4 Daily Trend

| Date | Sessions | Cost | Tokens |
|------|----------|------|--------|
| 2026-03-01 | 19 | $47.41 | 15.1M |
| 2026-03-02 | 36 | $151.86 | 48.8M |
| 2026-03-03 | 18 | $7.77 | 2.4M |
| 2026-03-04 | 44 | $24.17 | 7.5M |
| 2026-03-05 | 39 | $31.53 | 10.7M |
| 2026-03-06 | 100 | $114.91 | 40.6M |

Costs are spiky. March 2nd and 6th account for 70.6% of all-time spend. A
single bad batch of tasks can blow the budget.

---

## Part 2: Proposal — How to Surface This Data

### Option A: Extend system-status handler (Recommended as Phase 1)

The existing `system-status.ts` handler already runs on a cron, collects metrics, and
writes to `health-log.md`. **This is the natural home for cost awareness.**

#### Changes to `SystemStatusResult`:
```typescript
// Add to SystemStatusResult interface
costLast24h: number;
costLast7d: number;
costByAgent24h: Record<string, { cost: number; sessions: number; avgCost: number }>;
highCostSessions: Array<{ sessionId: string; agent: string; cost: number; turns: number }>;
costAnomaly: boolean; // true if 24h cost exceeds 2× 7-day daily average
```

#### Changes to `formatStatusReport`:
```
- Cost (24h): $24.17 across 44 sessions (avg $0.55/session)
- Cost (7d): $377.65, $62.94/day average
- Top spenders (24h): coder $12.50 (15 sessions), amy $8.20 (4 sessions)
- ⚠️ Cost anomaly: today's spend is 1.8× the 7-day average
- ⚠️ 3 sessions exceeded $5.00: s_1772789553229_26 (coder, $7.37)
```

#### Implementation complexity: **Low** (~50 lines added to system-status.ts)
The evaluation JSONs are already on disk. Just glob, parse, and aggregate.

### Option B: Dedicated cost report command (Phase 2)

A `cost-report` handler or CLI command that generates the full analysis in Part 1
on demand — breakdowns by agent, by day, wasteful session identification, cache
analysis. Output to `agents/optimizer/workspace/cost-report.md`.

This is useful for periodic deep-dives but shouldn't be the primary alerting mechanism.

### Option C: Cost thresholds and alerts (Phase 2)

Add threshold-based anomaly detection to system-status:

```typescript
const COST_THRESHOLDS = {
  sessionWarning: 2.0,    // warn if any single session exceeds this
  sessionCritical: 5.0,   // critical alert for runaway sessions
  dailyBudget: 100.0,     // warn if daily spend exceeds this
  agentSessionAvg: {      // per-agent average thresholds
    coder: 1.5,
    qa: 0.5,
    bob: 0.8,
    default: 2.0,
  }
};
```

Anomalies surface as `⚠️` lines in the health log, same as existing anomalies.

### Option D: Real-time session cost guard (Phase 3)

The most impactful but most invasive change: monitor cost *during* a session and
terminate if it exceeds a threshold. This prevents the $10+ runaway sessions.

This would require changes to the agent core (cost accumulation per session,
callback on threshold breach), so it's a separate design effort.

### Recommended phasing:

1. **Now**: Option A — add cost summary to system-status (low effort, immediate visibility)
2. **Next sprint**: Option C — add thresholds to system-status anomaly detection
3. **Later**: Option D — real-time session cost guards (requires core changes)
4. **On-demand**: Option B — full report generation for optimizer deep-dives

---

## Part 3: Should Evaluator Penalize High-Cost Sessions?

### Recommendation: **Yes, but as an efficiency modifier, not a separate dimension**

Cost is not independent of efficiency — it's a *consequence* of (in)efficiency. A session
that takes 40 turns and $10 to do what should take 8 turns and $0.50 is already penalized
by the efficiency score in principle. But the current rubric doesn't weight this heavily
enough. The correlation data proves it: "good" sessions are cheap and "needs_improvement"
sessions are expensive. **Cost is a stronger signal of waste than wasted_calls alone.**

### Proposed Rubric Changes

#### 3.1 Add cost-efficiency anchors to the efficiency scale

Current rubric (efficiency 0.0–1.0):
```
1.0: Every tool call necessary and productive
0.7: Minor waste (re-reading a file, one extra check)
0.4: Significant waste (wrong directories, blind searching)
0.1: Mostly wasted effort
```

**Proposed addition** — cost anchors alongside behavioral anchors:

```
1.0: Every call necessary AND cost ≤ $0.30 (or ≤ 6 turns for the task complexity)
0.7: Minor waste, cost ≤ $1.00 (or ≤ 12 turns)
0.4: Significant waste OR cost $1.00–$3.00 (or 12–25 turns)
0.2: Runaway session: cost > $5.00 OR > 35 turns — cap efficiency at 0.2
     regardless of whether the task eventually succeeded
0.1: Mostly wasted effort
```

The key addition is the **0.2 cap for runaway sessions**. Currently, a session can
burn $10 and still get efficiency 0.55 if the evaluator judges "most calls were
productive." The data shows this is wrong — a 40-turn session is never efficient
regardless of per-call productivity. Something went structurally wrong.

#### 3.2 Add `cost_efficiency` to the evaluation output

Add a new computed field to the per-session evaluation JSON:

```json
{
  "cost_efficiency": {
    "cost": 7.37,
    "turns": 51,
    "cost_per_turn": 0.145,
    "cost_rating": "critical",      // "normal" | "elevated" | "high" | "critical"
    "efficiency_cap_applied": true,  // true if cost capped the efficiency score
    "benchmark_cost": 0.50,         // estimated cost for a well-executed version of this task
    "cost_ratio": 14.7              // actual/benchmark ratio
  }
}
```

The `cost_rating` thresholds:
- **normal**: cost ≤ $0.50 (no adjustment)
- **elevated**: $0.50 < cost ≤ $2.00 (informational flag)
- **high**: $2.00 < cost ≤ $5.00 (efficiency capped at 0.4)
- **critical**: cost > $5.00 (efficiency capped at 0.2)

#### 3.3 Add cost guidance to the evaluator prompt

Add to evaluator's domain.md, in the Scoring section:

```markdown
### Cost Awareness

Session cost is provided in the transcript header (`## Usage: $X.XXX, N turns`).
Factor cost into efficiency scoring:

- A session costing > $5.00 has a **structural efficiency problem** regardless of
  per-call quality. Cap efficiency at 0.2 and note what caused the runaway
  (missing context? wrong approach? failure spirals?).
- A session costing $2.00–$5.00 should not score efficiency above 0.4 unless
  the task was genuinely complex (multi-file refactor, large codebase analysis).
- A "good" verdict requires cost ≤ $1.00 for typical tasks (single file change,
  QA check, knowledge update). Complex tasks get 2× allowance.
- When attributing blame: if a session is expensive because the delegating agent
  gave a vague task, the cost penalty goes to the **delegator**, not the worker.
```

#### 3.4 What NOT to do

**Don't add cost as a separate 0.0–1.0 dimension.** This would:
- Double-penalize already-inefficient sessions
- Create confusion about whether to optimize for "efficiency" or "cost"
- Add complexity without insight (cost and efficiency are ~85% correlated)

Instead, cost serves as a **reality check on efficiency scores** — a hard anchor
that prevents the evaluator from being generous about "productive" calls in a
session that burned through $8 of tokens.

---

## Part 4: Implementation Plan

### Phase 1: system-status cost visibility (immediate)

**File**: `agents/may/handlers/system-status.ts`

1. Add `aggregateEvalCosts(evalDir, since)` function that globs evaluation JSONs
   and returns cost aggregations by agent and time window
2. Add cost fields to `SystemStatusResult`
3. Add cost lines to `formatStatusReport`
4. Add cost anomaly detection to the anomalies array

**Estimated effort**: ~80 lines of code, self-contained, no dependencies

### Phase 2: evaluator rubric update (next evaluation cycle)

**File**: `agents/evaluator/knowledge/domain.md`

1. Add the "Cost Awareness" section to Scoring
2. Add cost anchors to the efficiency scale
3. Add `cost_efficiency` to the expected output format

**File**: `src/evaluator.ts`

4. Add `cost_efficiency` field computation after parsing evaluator response
5. Apply efficiency caps based on cost thresholds
6. Include `cost_efficiency` in the per-session evaluation JSON

**Estimated effort**: ~40 lines in evaluator.ts, ~20 lines in domain.md

### Phase 3: real-time cost monitoring (future)

**Files**: Core agent infrastructure

1. Accumulate cost per session in real-time (already have per-message usage)
2. Add `maxSessionCost` config per agent definition
3. Emit warning at 80% of threshold, terminate at 100%
4. Default: $5.00 warning, $10.00 hard limit

**Estimated effort**: Significant — touches core agent lifecycle. Separate design needed.

---

## Part 5: Quick Wins from This Analysis

1. **Fix "unknown" agent attribution** — 54 sessions ($198.51) have agent="unknown".
   This is likely a metadata bug in session creation or evaluation. Fixing this gives
   visibility into which real agent is the #1 cost center.

2. **Enable prompt caching for coder** — Coder has 77 sessions, 22.3M input tokens,
   and 0% cache hit rate. Bob achieves 77.4% cache hits. If coder achieved even 50%
   cache hits, that would save ~$25 of the $71.44 total (input token costs halved
   for cached portions).

3. **Add turn limits to agent configs** — The data shows "good" sessions average 9.4
   turns while "needs_improvement" average 19.3. A soft warning at 15 turns and hard
   cap at 30 turns would prevent most runaway sessions.

4. **Task scoping lessons** — The top 15 most expensive sessions are all 33-101 turns.
   Many could have been avoided with better task decomposition. Feed this back into
   delegator agent lessons.
