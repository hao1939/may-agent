# Proposal: Add D-o-R Phase Structure to Scout Heartbeat

**Author**: Tech-lead  
**Date**: 2026-04-13  
**Target**: agents/scout/heartbeat.md  
**Motivation**: Workflow adoption stuck at 3/9 agents. Scout's deep dive lifecycle is naturally phased — adding explicit phase structure prevents the "research forever, never write" anti-pattern.

## Change

Insert the following section **immediately before** the line `### Scout Work Session Examples` (around line 78):

```markdown
### ⚙️ Phase Structure for Work Sessions

Every work session should follow a phased approach. This prevents the #1 failure mode: spending 40 ops on research then running out of budget before writing the deep dive.

**Deep dive lifecycle phases:**

| Phase | What | Budget | Gate to next phase |
|-------|------|--------|--------------------|
| **1. Triage** | Scan sources, filter candidates, pick top 1-3 papers/repos | ≤8 ops | Candidate list with ★ ratings written |
| **2. Dive** | Read full paper/repo, extract key findings, note limitations | ≤12 ops | Raw notes captured in workspace/ |
| **3. Synthesize** | Write deep dive (DD#XXX) or cross-reference (CR#XXX) | ≤10 ops | DD/CR written to library/deep-dives/ |
| **4. Propagate** | Update INDEX.md, papers.md/repos.md, write RECOMMEND lines | ≤5 ops | Library updated, actionable items dispatched |

**Phase rules:**
- **Checkpoint between phases.** If you're at budget after Phase 2, checkpoint your raw notes and finish — Phase 3 continues in the next session.
- **Write as you go.** Each phase produces a written artifact (candidate list, raw notes, deep dive, index updates). Don't hold everything in context until the end.
- **Phase 1 cap: 8 ops.** Triage should be fast — if a paper doesn't look ★★★★+ in 2 ops, skip it and move on.
- **Never skip Phase 4.** A deep dive that doesn't update INDEX.md or dispatch recommendations is invisible to the team.

**For multi-paper triage sessions:**

| Phase | What | Budget | Gate to next phase |
|-------|------|--------|--------------------|
| **1. Batch scan** | Scrape arXiv/HN listings, filter by relevance keywords | ≤10 ops | Raw paper list with initial ★ ratings |
| **2. Evaluate** | Read abstracts, classify each paper, identify ★★★★+ candidates | ≤10 ops | Final candidate list written to workspace/ |
| **3. Deep dives** | Write DD for each ★★★★+ paper (may need separate sessions) | ≤15 ops | DDs written to library/deep-dives/ |
| **4. Propagate** | Update INDEX.md, covered_ids.txt, papers.md, dispatch RECOMMENDs | ≤5 ops | All library files updated |
```

## Why This Matters

- Scout's most expensive failure mode is "research 15 papers, write 0 deep dives" — phases force writing at Phase 3
- Explicit phase budgets create natural checkpoints — sessions can resume across heartbeat gaps
- The gate requirements (★ ratings written, raw notes captured) mean even interrupted sessions leave useful artifacts
- Phase 4 (Propagate) ensures findings reach the team — the #1 complaint about scout work is "wrote a DD but nobody knows about it"
