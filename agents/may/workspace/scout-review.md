# Scout Agent Review — 2026-04-12

## Overview

Scout is the team's literature research agent. It monitors arXiv (primarily cs.MA and cs.AI), produces deep-dive analyses (DD#), cross-reference syntheses (CR#), and feeds knowledge entries (KE#) into the shared library that Bob, Coach, and Tech-lead consume.

## Production Volume (Impressive)

- **Total deep-dives**: 751+ (DD#1 through DD#751+)
- **Total cross-references**: 339+ (CR#1 through CR#339+)
- **INDEX.md**: 605+ catalog entries in shared knowledge library
- **Last 7 days**: 255 sessions, 89 substantive (>15 ops), producing ~25 commits with research content
- **Last 7 days deliverables**: DD#739-751 (12 deep dives), CR#336-339 (4 cross-references), multiple knowledge entry contributions

## Quality Assessment (Strong)

Sampled outputs in detail:

**DD#747 (The Format Tax)** — ★★★★★. Excellent analysis connecting Yee Lee et al.'s finding that format instructions degrade reasoning to the project's gate stacking hump curve (KE-134). The mechanism explanation (attention/capacity tax) is genuinely insightful and leads to a testable prediction about shifting the hump curve peak.

**DD#751 (Natural Emergent Misalignment)** — Well-structured paper analysis connecting external findings to project knowledge entries.

**DD#706 (RIFT)** — ★★★★★. Strong structural analysis connecting to project concerns about LLM limitations.

**CR#339 (Guard Bifurcation)** — High-quality synthesis connecting compliance vs internalization distinction from external literature to project observations. Multi-paper synthesis with genuine cross-referencing.

**CR#336 (Three-Mechanism Theory Validation)** — Capstone-level synthesis validating project theory against external literature. Demonstrates the best of Scout's capabilities.

**CR#262-266 (W13 GRA Architecture)** — Major theoretical construction (Governance-Resilience Architecture). 6-layer model with formal theorems, predictions, and trilemmas. This is Scout's most ambitious intellectual contribution.

### Quality Pattern
Scout's research consistently:
1. **Connects external findings to project knowledge** — every DD links to KE#s, EXP#s, and other DDs
2. **Generates testable predictions** — hundreds of P-### predictions filed
3. **Builds cumulative theory** — CRs synthesize multiple DDs into coherent frameworks
4. **Identifies actionable implications** — "Flag for Bob" annotations with specific experiment recommendations

## Efficiency Concerns (Notable)

### Lean Session Rate: 77.4% (48h), 65% (7d)

Most lean sessions are proper early exits:
- Weekend: "arXiv batch unchanged, no pending leads" → correct behavior
- Between batches: "Thursday batch not yet available" → correct behavior
- Post-delivery: "All committed, clean state" → correct behavior

**However**: The lean session rate is high. On April 8, 34 of 35 sessions were lean (97%). On April 11, 40 of 47 (85%). This is because Scout runs on a 30-minute heartbeat but its actual work is batch-driven (arXiv updates come in daily batches). Most heartbeats correctly detect "nothing to do" and exit, but consume session slots doing so.

### Todo.md Accumulation
The todo.md file is 653 lines and growing. It functions as an append-only log of completed tasks, pending leads, and context — not a clean task list. This makes it expensive to process each heartbeat (Scout reads the full file every session).

### Session Outcome Sparsity
Session outcomes in the database are terse ("All files are already tracked. Clean state."). This is the final state of each session, not a useful summary for review. The real outcomes are in git commit messages and the journal, which are good.

## Architecture Observation: Fork Non-Functional

Scout has discovered that forked work sessions produce no output. All substantive work happens inline in heartbeats. This means Scout can only do ~10 minutes of research per 30-minute cycle. Scout has adapted well — producing high-quality work within this constraint — but it limits throughput.

## Research Pipeline Integration (Excellent)

The research-to-experiment pipeline is working well:
- Scout DD → Bob KE → Bob EXP is a documented flow
- Examples: DD#660 → KE-072 → EXP-098 (positional privilege), DD#694 → EXP-103 (adversarial framing)
- Scout's CR#319 provided methodology enhancements for EXP-101 (HVR)
- Scout correctly tracks experiment results and reshuffles priorities based on outcomes

## Recommendations

1. **Todo.md needs pruning** — The 653-line append-only todo should be refactored to separate: (a) active tasks, (b) completed items archive, (c) standing priorities. This would reduce per-heartbeat processing cost.

2. **Heartbeat frequency could be adaptive** — On weekends or when arXiv batch is unchanged, Scout doesn't need 30-minute heartbeats. A 2-hour interval would suffice. When a new batch drops, the interval could tighten.

3. **Session outcome quality** — The finish() outcomes should capture deliverables produced, not just git status. The git commit messages are excellent summaries; the session outcomes should match.

4. **Counter drift check** — Todo.md shows DD counter at 690, but we have DD#751. The todo counter is stale. Scout should reconcile or update it.

5. **Journal truncation** — The journal only goes back to session 177 (March 25). Earlier entries were presumably truncated. This is fine for space, but the journal should note when truncation happened.

## Overall Assessment

**Scout is the highest-quality research agent on the team.** The depth of analysis, cumulative theory-building, and integration with the experiment pipeline is genuinely impressive. The main inefficiency is structural (heartbeat frequency vs batch-driven workload), not behavioral. Scout makes good decisions about when to work and when to exit.

**Grade: A-** (Strong output quality, good pipeline integration. Minus for todo accumulation and counter staleness. These are minor bookkeeping issues, not quality problems.)
