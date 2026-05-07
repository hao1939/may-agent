# Phase 7: Corpus Scan for Indirect Preference Signals

**Date:** 2026-05-08  
**Scope:** Full session corpus (~51,600 sessions) scanned for Hao's indirect preference signals beyond the 67 chat sessions already mined.

## Methodology

1. Identified session types by `kind` field in meta.json (job, chat, call)
2. Searched for "From Hao" directives in job/call sessions (non-chat)
3. Filtered out bulk automated dispatches (Xiaohongshu research tasks)
4. Analyzed multi-turn sessions (>1 user message) for redirections

## Corpus Statistics

| Category | Count | Notes |
|----------|-------|-------|
| Total sessions (history) | 51,603 | Full corpus |
| Chat sessions (history) | 66 | Direct Hao conversations |
| Chat sessions (active) | 6 | Currently open |
| "From Hao" job sessions | 5,875 | Hao directives passed through system |
| Substantive "From Hao" (non-Xiaohongshu) | 13 | Design decisions, corrections, redirections |
| "via review agent" sessions | 10 | Hao feedback on agent work |
| Multi-turn sessions (>2 user msgs) | Rare | Most are single-task jobs |

## Key Finding: 5,862 Xiaohongshu Dispatches

The overwhelming majority of "From Hao" job sessions (~5,862 of 5,875) are identical Xiaohongshu research dispatches. This reveals a **strong preference signal**: Hao uses the system heavily for content research/brief generation. This is a primary use case.

## Indirect Preference Signals Extracted

### Category 1: Design Corrections (Hao rejecting agent proposals)

1. **"Over-engineered" rejection** — Hao rejected both May's and Bob's code review designs:
   > "The designs are over-engineered. The solution is simpler than both proposals suggest."
   > "Don't poll git diffs. Don't rely on agents sending REVIEW_REQUEST. Both are wrong."
   > **Preferred approach:** "May reviews agent plans as part of her regular supervision."
   - **Signal:** Hao prefers simple, integrated solutions over complex new systems.

2. **"Needs more perspectives"** — Hao rejected a solo design:
   > "May wrote this solo. I want Bob, tech-lead, optimizer, and coach to all contribute their perspective."
   - **Signal:** Hao values collaborative design with multiple agent perspectives.

### Category 2: Directive Redirections (Hao changing course)

3. **Revert guard architecture** — Hao ordered immediate rollback:
   > "Revert these 4 commits in reverse chronological order" (BinaryGuard, WorkVerifyGuard, ToolSyntaxGuard, PathAssumptionGuard, Guard Architecture Phase 1)
   - **Signal:** Hao rejected an entire architectural approach after seeing results. Prefers proven patterns over speculative guards.

4. **Bundling plan unification** — Hao merged two separate tasks:
   > "Merge the Bun runtime migration INTO the bundling task. They're the same project now."
   - **Signal:** Hao thinks holistically about related work; dislikes artificial separation.

### Category 3: Methodology Preferences

5. **"Hard-constraints insight"** — Hao elevated a finding:
   > "Your hard-constraints insight is the most important finding from the auto-evolve experiment."
   > Directed Bob to design harness-level guards based on gym failure patterns.
   - **Signal:** Hao values empirical findings over theoretical approaches.

6. **Workflow over SOUL mutations** — Hao redirected after failure:
   > "Your SOUL.md mutations failed (0/5 improved pass rate). But your own data shows workflow enforcement is 18/18."
   > "Try the auto-evolve loop again, but with WORKFLOW variations instead."
   - **Signal:** Hao reads data carefully and redirects based on what actually works.

7. **Bottom-up isolation for debugging**:
   > "Investigate WHY it works at API level but not gym level. Use the bottom-up isolation method: start simple, add complexity, find where it breaks."
   - **Signal:** Hao prefers systematic debugging over guessing.

### Category 4: Urgency/Priority Signals

8. **"Do this FIRST before anything else"** — Used for the revert command.
   - **Signal:** When Hao says FIRST, it means drop everything.

9. **"dispatch NOW"** — Used for all Xiaohongshu tasks.
   - **Signal:** Research tasks have high urgency expectation.

10. **"aged 3 days"** — System tags showing stale directives.
    - **Signal:** Some Hao directives went unexecuted for days (project-resume redesign, context-discovery gap).

## Summary of Preference Patterns

| Pattern | Evidence Count | Confidence |
|---------|---------------|------------|
| Simplicity over complexity | 3 instances | High |
| Data-driven iteration | 2 instances | High |
| Collaborative design | 1 instance | Medium |
| Immediate action on failures | 2 instances | High |
| Holistic task grouping | 1 instance | Medium |
| Bottom-up debugging | 1 instance | Medium |
| High research throughput (Xiaohongshu) | ~5,862 dispatches | Very High |

## Unmined Resources Identified

1. **Multi-turn chat sessions** (6 active) — may contain recent Hao preferences not yet captured
2. **Session s_1777485773079_0** — 21 user messages, likely a long Hao conversation
3. **"via review agent" sessions** (10 total) — structured Hao feedback on agent deliverables
4. **Agent context.md files** — may contain distilled Hao preferences from prior sessions

## Next Steps for Phase 7

- [ ] Deep-dive the 10 "via review agent" sessions for structured approval/rejection patterns
- [ ] Analyze the 6 active chat sessions for recent preference shifts
- [ ] Cross-reference extracted preferences with existing gym training scenarios
- [ ] Map preferences to actionable gym scenario improvements
