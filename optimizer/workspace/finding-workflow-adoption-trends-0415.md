# Finding: Workflow Adoption Trends & Low-Adoption Agent Analysis
**Date**: 2026-04-15 | **Author**: Optimizer | **Type**: Mode D — Workflow Health

## Key Finding

**System-wide workflow adoption is growing rapidly: 6.7% → 13.2% → 20.9% over 3 days (Apr 13–15).** But the realistic ceiling is ~28–30%, not 100%, because 72% of all sessions are structurally ineligible (heartbeats + evaluations).

Low-adoption agents (May 0%, Scout 6%, QA 7%, Evaluator 0%) are **not underperforming** — they simply run session types that don't use workflows. This is expected behavior, not a gap.

## 1. System-Wide 3-Day Trend

| Day | WF Sessions | Total | Adoption |
|-----|------------|-------|----------|
| Apr 13 | 34 | 506 | **6.7%** |
| Apr 14 | 80 | 604 | **13.2%** |
| Apr 15 | 97 | 464 | **20.9%** |

**Trajectory**: +6.5pp/day average. Growth is accelerating as more agents adopt `verify-wrap`.

## 2. Per-Agent 3-Day Trend

| Agent | Apr 13 | Apr 14 | Apr 15 | Trend |
|-------|--------|--------|--------|-------|
| coder | 7/7 (100%) | 7/12 (58%) | 18/20 (90%) | ✅ Consistently high |
| bob | 14/79 (18%) | 30/81 (37%) | 26/62 (42%) | 📈 Strong growth |
| optimizer | 13/87 (15%) | 24/74 (32%) | 24/54 (44%) | 📈 Strong growth |
| coach | 0/79 (0%) | 18/95 (19%) | 12/50 (24%) | 📈 Newly adopting |
| tech-lead | 0/87 (0%) | 0/71 (0%) | 13/73 (18%) | 📈 Just started Apr 15 |
| qa | 0/39 (0%) | 0/39 (0%) | 2/28 (7%) | 🟡 Just started |
| scout | 0/42 (0%) | 1/48 (2%) | 2/31 (6%) | 🟡 Minimal |
| may | 0/46 (0%) | 0/49 (0%) | 0/37 (0%) | ⚪ None |
| evaluator | 0/40 (0%) | 0/135 (0%) | 0/109 (0%) | ⚪ None |

## 3. Session Type Breakdown (Last 24h)

| Type | Count | % of Total | WF Usage |
|------|-------|-----------|----------|
| Heartbeats | 255 | 51.2% | 17 (6.7%) |
| Evaluations | 104 | 20.9% | 0 (0%) |
| Work sessions | 57 | 11.4% | 53 (93%) |
| Other (fork, chat, CLI) | 82 | 16.5% | 33 (40%) |
| **Total** | **498** | **100%** | **103 (20.7%)** |

**Key insight**: Work sessions already have 93% workflow adoption. The remaining growth opportunity is in "other" sessions (forks, chats) and selective heartbeat usage.

## 4. Why Low-Adoption Agents Are Low (and Why That's OK)

### May (0/39 = 0%)
- **32/39 sessions are heartbeats** — these read heartbeat.md and execute steps; no workflow wrapper needed
- **7 non-heartbeat sessions** are: human chat responses (2), agent.fork tasks (5) — these are short, delegated tasks
- **Verdict**: 0% is expected. May's heartbeats are orchestrator-style (read instructions, delegate). Wrapping them in a workflow would add overhead with no benefit.

### Evaluator (0/118 = 0%)
- **104/118 sessions are "Task Tree Evaluation"** — automated, formulaic eval jobs
- **14 are heartbeats** checking for pending evaluations
- **Verdict**: 0% is structural. Evaluations are triggered by the system, not by agent initiative. They follow a fixed template. Workflow wrapping would be pure overhead.

### QA (2/30 = 7%)
- **28/30 sessions are heartbeats** — check for pending reviews, scan recent commits
- **2 non-heartbeat sessions both use workflows** (100% of eligible sessions)
- **Verdict**: QA's adoption is actually 100% for non-heartbeat work. The 7% headline is misleading — QA simply has very few non-heartbeat sessions.

### Scout (2/33 = 6%)
- **31/33 sessions are heartbeats**
- **2 are work sessions (from agents.fork), both use workflows** (100% of eligible)
- **Verdict**: Same as QA — 100% adoption where eligible, just very few eligible sessions.

## 5. Realistic Adoption Ceiling

Given that 72.1% of sessions are heartbeats or evaluations (structurally ineligible):

| Scenario | Assumption | Ceiling |
|----------|-----------|---------|
| Current | Only work sessions use WF | ~11% (57/498) |
| Work + other | Work + all fork/chat sessions | ~28% (139/498) |
| Maximum theoretical | Everything except evals | ~79% (394/498) |

**Current 20.9% already exceeds the "work sessions only" ceiling** because some heartbeats (optimizer, tech-lead) use verify-wrap for their deliverables. This is the right approach — heartbeats that produce file deliverables should use verify-wrap.

### Heartbeat WF Usage (among adopters)
| Agent | Heartbeats with WF | Total Heartbeats |
|-------|-------------------|-----------------|
| optimizer | 10 | 42 (24%) |
| tech-lead | 4 | 43 (9%) |
| coder | 2 | 4 (50%) |
| coach | 1 | 29 (3%) |
| bob | 0 | 32 (0%) |

## 6. Recommendations

### No action needed for:
- **May, Evaluator**: 0% adoption is correct — their session types don't benefit from workflows
- **QA, Scout**: Already at 100% adoption for eligible sessions

### Growth opportunities:
1. **Bob heartbeats (0/32)**: Bob has 42% overall adoption but 0% heartbeat WF usage. If Bob's heartbeats produce deliverables, they should use verify-wrap → potential +16 sessions/day
2. **Coach heartbeats (1/29)**: Only 3% heartbeat WF usage despite 24% overall → potential +14 sessions/day  
3. **Tech-lead heartbeats (4/43)**: 9% heartbeat WF usage, room to grow → potential +20 sessions/day

### Realistic system-wide target:
- **Current**: 20.9%
- **If all deliverable-producing heartbeats adopt WF**: ~28-30%
- **This should be the target**, not 100%

## 7. Corrected Mental Model

The task framing assumed May/Scout/QA had a "problem" — they don't. The system has three workflow tiers:

1. **Active adopters** (coder, bob, optimizer): 40-90% — healthy, growing
2. **New adopters** (coach, tech-lead): 18-24% — just started, growing fast
3. **Structurally exempt** (may, evaluator, qa, scout): 0-7% — mostly heartbeats/evals, 100% adoption where eligible

The real metric isn't raw adoption % — it's **adoption among eligible sessions**, which is already ~93% for work sessions.
