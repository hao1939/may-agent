# Research Project: gstack — AI Software Factory Patterns

**Status**: archived  
**Owner**: May (coordinating), Coach (skill adoption)  
**Source**: github.com/garrytan/gstack (Garry Tan / YC CEO)  
**Started**: 2026-03-31  
**Archived**: 2026-04-13  
**Archive Reason**: Key ideas extracted (confidence scoring, cross-model review, structured learnings, preamble tiers). No experiments started in 12 days. Confidence scoring overlaps with adaptive-reasoning-efficiency project. Revisit individual ideas if they become relevant.  
**Analysis**: `agents/shared/research-digest.md` (Industrial section)

---

## What gstack Does

A skill-based virtual engineering team built on Claude Code. Key differentiators:
1. **Preamble-tier system** — skills have priority tiers (1-4), higher tiers load first
2. **Resolver pipeline** — TypeScript functions that dynamically inject context (learnings, confidence, design system)
3. **Cross-model review** — dispatches code review to Codex as independent second opinion
4. **Confidence scoring** — every finding gets 1-10 score, only high-confidence issues are actionable
5. **Learnings system** — JSONL-based per-project institutional memory

## Borrowable Ideas (ranked)

### Idea 1: Confidence Scoring for QA/Review
**What**: QA findings rated 1-10. Only ≥7 are actionable. Prevents nitpicking.
**Why it matters**: Our QA agent produces CONDITIONAL verdicts that cause 65% false escalations. Confidence scoring would let QA say "this is minor (3/10), don't block."
**Effort**: Low — add to QA prompt instructions + workflow verdict parsing.
**Status**: Ready to experiment.

### Idea 2: Cross-Model Review
**What**: Dispatch review to a different model (Codex, GPT) for independent second opinion.
**Why it matters**: Same-model review has blind spots. A different model catches different issues.
**Effort**: Medium — needs infrastructure to call a second model during workflow.
**Status**: Design needed.

### Idea 3: Structured Learnings (JSONL per-project)  
**What**: Append-only log of learnings with `{skill, type, content, timestamp}`. Searchable, pruneable.
**Why it matters**: Our context.md is unstructured. Structured learnings enable better retrieval and dedup.
**Effort**: Medium — replace context.md format or add alongside it.
**Status**: Need to compare with our existing context-learn.ts.

### Idea 4: Preamble Tier System
**What**: Skills have priority tiers. Higher tiers are always loaded. Lower tiers only when relevant.
**Why it matters**: We have 50+ skills but no prioritization. Agents read them all or none.
**Effort**: Low — add a `tier` field to LIBRARY.md, teach agents to check tier.
**Status**: Design needed.

## Findings Log

### 2026-03-31 — May deep-dive on full repo
- 61K lines of code across 30+ skills
- Plugin system for Claude Code, Codex, OpenCode
- Browse skill: headless Chrome via CDP for QA testing
- Ship skill: full CI/CD workflow (test → review → bump version → changelog → PR)
- Office-hours skill: YC-style forcing questions for product direction
- Retro skill: weekly engineering retrospective from git history

## Next Steps

1. **Experiment with Idea 1 (Confidence Scoring)** — add to QA review prompt
   - Teach QA to rate each finding 1-10
   - Update workflow to ignore findings < 7
   - Owner: Coach (behavioral) + Optimizer (workflow)

2. **Prototype Idea 4 (Preamble Tiers)** — classify existing skills by priority
   - Tier 1 (always): verification, grep-first-reading
   - Tier 2 (when relevant): brainstorm-before-build, investigate-and-fix
   - Owner: Coach
