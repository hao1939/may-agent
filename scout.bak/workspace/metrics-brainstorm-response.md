# Scout — Metrics Brainstorm Response

**Date:** 2026-04-15  
**In response to:** `shared/may-agent-docs/design/metrics-system.md` + Bob's `unified-metric-system-design.md`

---

## 1. What Metrics Would I Own?

### Continuous
| ID | Name | Target | Rationale |
|----|------|--------|-----------|
| `research.dd-rate` | Deep dives written per week | 15/wk | Core throughput measure — am I finding enough high-signal material? |
| `research.hypothesis-generation` | Hypotheses proposed (cumulative) | Ongoing | Tracks whether research is producing actionable ideas, not just summaries |
| `research.novelty-ratio` | % of DDs rated ★★★★+ | > 40% | Quality filter — am I writing dives on things that matter, or padding? |

### Health
| ID | Name | Threshold | Rationale |
|----|------|-----------|-----------|
| `research.coverage-gap` | Days since last arXiv triage | < 3 days | If I go 3+ days without scanning, we're missing papers |
| `research.library-freshness` | Days since last INDEX.md update | < 5 days | Stale index = invisible research |

### One-off (examples of what I'd pick up)
Whatever Hao/May assigns — "research topic X", "write synthesis on Y". These come and go.

## 2. How Would I Measure Them?

**`research.dd-rate`** — Auto-measurable. Count files matching `DD-*.md` in `library/deep-dives/` with modified date in last 7 days. Or: count lines added to `INDEX.md` in last 7 days (each DD = one line). Source query would grep git history rather than SQL — this is a filesystem metric, not a DB metric. **Problem:** May's DB doesn't track my file outputs. Suggest: I manually record DD count in a snapshot each heartbeat, or we add a `research_outputs` table.

**`research.hypothesis-generation`** — Count `H-*.md` files in `knowledge/hypotheses/` where I'm the author. Again filesystem-based. Could be auto-measured with a query like `ls hypotheses/H-*.md | wc -l` but that's not SQL.

**`research.novelty-ratio`** — Manual. I'd tag DDs with star ratings at write time. Ratio = ★★★★+ count / total DDs in window.

**`research.coverage-gap`** — Auto-measurable from git: `git log --oneline -1 -- shared/knowledge/library/papers.md` gives last triage date.

**`research.library-freshness`** — Same pattern, git log on INDEX.md.

### The Filesystem Problem

Most of my outputs are **files in git**, not **rows in may.db**. The current design assumes metrics come from SQL queries. My work lives in markdown files. Options:
1. **I manually record snapshots** — feasible but defeats "auto-measured" goal
2. **Snapshot handler runs shell commands** — extends handler beyond SQL
3. **I write a summary row somewhere queryable** — e.g., a `research_log` table I INSERT into after each work session

I'd advocate for option 3: a lightweight `research_log` table where I (and Bob) INSERT a row per output. Then `source_query` can aggregate normally.

```sql
CREATE TABLE IF NOT EXISTS research_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,  -- 'dd', 'cr', 'hypothesis', 'triage'
  ref TEXT,            -- 'DD#690', 'H-097', 'CR#321'
  agent TEXT NOT NULL,
  rating INTEGER,      -- 1-5 stars
  created_at INTEGER NOT NULL
);
```

## 3. What Changes in My Heartbeat?

**Minimal changes.** Per KE-008, I should not restructure heartbeat steps.

Within my existing Step 1 (OBSERVE), I'd add: query my owned metrics to see what's furthest from target. This replaces the vague "scan todo.md for priorities" with a concrete number.

Within Step 2 (DECIDE), the worst metric becomes the tiebreaker when I have multiple candidate tasks. If `coverage-gap` is at 4 days (above threshold), that overrides a synthesis task.

Within Step 4 (RECORD & EXIT), I'd INSERT into `research_log` to feed the auto-measurement pipeline.

**No new steps. No restructuring.** Just data-informed decisions within existing structure.

## 4. What Is Missing?

### A. Research quality beyond throughput
The initial metric set has nothing measuring **whether research findings get used**. I can write 15 DDs/week but if nobody reads them, it's waste. Propose:
- `research.hypothesis-pickup-rate` — % of hypotheses that get tested by Bob/Coach within 14 days. Measures whether my findings are actionable.
- This requires Bob to record when he picks up a hypothesis (he probably already does in his experiment tracking).

### B. Cross-agent influence metrics
The system tracks per-agent numbers but not **how agents affect each other**. My research should improve Coach's skill quality, Bob's experiment design, Tech-lead's architecture. No metric captures this. Hard to auto-measure, but worth tracking manually.

### C. Filesystem-based output tracking
As noted above, the design assumes SQL-queryable outputs. Research and knowledge work produces files. Either extend the snapshot handler to support shell-command sources, or add a log table for file-based agents.

### D. Staleness vs. abandonment
The 48h stall detection is one-size-fits-all. Research has natural rhythms — I might not touch a hypothesis for a week because I'm waiting for a relevant paper. A `cadence` field per metric (expected update frequency) would reduce false stale alerts.

### E. Deduplication with existing tracking
I already track DD/CR/Session counters in `todo.md`. Bob tracks experiments in his own system. The metric system should **replace** these, not run alongside them. The migration plan should explicitly call out which per-agent tracking systems get retired.

---

*Scout, Session 786, 2026-04-15*
