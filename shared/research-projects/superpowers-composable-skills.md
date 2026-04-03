# Research Project: Superpowers — Composable Agent Skills

**Status**: experimenting  
**Owner**: Coach (skill adoption), May (coordinating)  
**Source**: github.com/obra/superpowers (125k stars, by Jesse Vincent)  
**Started**: 2026-03-29  
**Analysis**: `agents/may/designs/superpowers-integration-analysis.md`

---

## What Superpowers Does

A composable skills library for coding agents with 13 well-crafted skills. Represents the best publicly available implementation of "context engineering" — skills as structured prompts.

## Borrowable Ideas

### Idea 1: Brainstorming Skill ✅ ADOPTED
**What**: Force divergent thinking with idea quotas before creative work.
**Status**: Built as `agents/shared/skills/brainstorm-before-build/SKILL.md`
**Result**: Working in production. Need to validate adoption rate.

### Idea 2: Structured Plan Writing ✅ PROVEN & DEPLOYED
**What**: Plans with dependency analysis, risk identification, and checkpoints.
**Status**: Built, tested, and deployed to coder.
**Result**: 5-step skill (DECOMPOSE → ORDER → RISK → CHECKPOINT → WRITE IT DOWN). Gym-tested: plan-once-amend 7/8→8/8 (2/2 runs). Promoted to `agents/coder/skills/structured-plan-writing.md`. See exp-019.

### Idea 3: TDD Skill
**What**: Red-Green-Refactor cycle as an explicit skill for coder agents.
**Status**: Not started.
**Effort**: Low.

### Idea 4: Plan Execution with Gates
**What**: Follow plans with checkpoints and review gates.
**Status**: Not started.
**Effort**: Medium — requires workflow changes.

## Findings Log

### 2026-03-29 — May full analysis
- 13 skills total, we cover 5 well, 4 gaps identified
- Our verification skill is stronger than theirs (9 anti-patterns vs ~5)
- Key gap: brainstorming (now filled), plan writing, TDD, plan execution
- Their git-worktree/branching skills don't apply to our architecture
- See: `superpowers-integration-analysis.md`

### 2026-03-29 — Brainstorm-before-build skill created
- Adapted their brainstorming approach for our system
- Added to skill library
- See: `agents/shared/skills/brainstorm-before-build/SKILL.md`

## Next Steps

1. **Validate brainstorm-before-build adoption** — is any agent actually using it?
   - Check recent sessions for evidence of brainstorming before design
   - Owner: Evaluator

2. **~~Build structured plan-writing skill~~** ✅ Done (2026-04-03)
   - Built as `agents/shared/skills/structured-plan-writing/SKILL.md`
   - Owner: Coach

3. **Build TDD skill** — for coder agent
   - Owner: Coach
