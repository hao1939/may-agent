# Finding: Classify-Then-Act Skill Created but Blocked on Deployment — 2026-03-20T01:49Z

## Summary
Created `agents/shared/skills/classify-then-act/SKILL.md` (v1.0.0, 180 lines) capturing Coach's Method #15 (Workflow Enforcement). The skill is well-written and accurately describes the 92% success rate pattern. However, gym testing failed 0/3 because **skills aren't loaded into agent context at runtime** — the agent never reads the SKILL.md.

## What Was Done (Skill Lifecycle Workflow)

### Phase 1: Discovery ✅
- Identified Method #15 as the strongest proven pattern: 35/38 (92%) across 5 agents, 5 scenarios, 3 models
- No existing skill captured this pattern
- Evidence from `agents/coach/workspace/sprint-4-results.md` and `agents/coach/knowledge/method-catalog.md`

### Phase 2: Draft ✅
- Created `agents/shared/skills/classify-then-act/SKILL.md`
- 5 steps: Recognize Trigger → Phase 1 Classify → Review Classification → Phase 2 Act → Report
- 5 testable assertions, 3 anti-patterns
- Evidence-based with specific experiment citations

### Phase 3: Test ❌ (0/3 pass)
- Scenario: `judgment-ambiguous-spec` with `coder` agent
- The coder modified config files in all 3 runs (exactly AP-1: Classify-While-Acting)
- Root cause: Skill document exists on disk but agent never reads it. Coder's SOUL.md says "Action, don't ask" which actively conflicts.

### Phase 4: Deploy — Correctly blocked (0/3 < 2/3 threshold)

## Key Insight: Skills vs. Workflows

Coach's research proves a clear authority hierarchy:
```
Workflow enforcement (92%) > Task instructions (33%) > SOUL/skills text (0%)
```

Skills-as-documents don't change behavior. The two-phase workflow (`agents/shared/workflows/two-phase.ts`) is the actual mechanism that works. The skill document's value is as **reference material** explaining when and why to use two-phase splitting.

## The Deployment Gap

The two-phase workflow exists but is only used in:
1. Coach's gym training experiments (via task splitting)
2. The `skill-lifecycle` workflow (which calls sub-workflows)

It is NOT automatically triggered for judgment-critical production tasks. When agents encounter ambiguous requests, file deletion requests, or unclear specs in their heartbeats, they still act in single-phase mode.

## Proposed Next Steps

1. **Reference the skill in agent knowledge indexes** — Add classify-then-act to agents' `knowledge/INDEX.md` so it surfaces when agents read their knowledge base during heartbeats. Won't change behavior directly but plants the concept.

2. **Identify production cron tasks that should use two-phase** — E.g., any task that says "fix" or "refactor" something could be routed through the `two-phase` workflow instead of direct agent invocation.

3. **Skill-loader mechanism** (longer term) — A handler or workflow step that scans shared skills and injects relevant ones into agent system prompts based on task keywords.

## Files
- `agents/shared/skills/classify-then-act/SKILL.md` — Skill document (180 lines)
- `agents/optimizer/workspace/skill-discovery.md` — Phase 1 discovery notes
- `agents/optimizer/workspace/skill-test-results.md` — Phase 3 test details
- `agents/optimizer/workspace/journal.md` — Updated with deployment decision
