# EXP-228 Results: Security Awareness Skill for Tech-Lead

**Date**: 2026-04-26
**Status**: COMPLETED — NULL RESULT (skill has no marginal effect)

## Summary

The security-awareness skill for tech-lead produced **no marginal improvement** because
tech-lead already catches SQL injection at ~100% without the skill. The real finding is
the massive gap between agents: **coder: 0/15 (0%)** vs **tech-lead: 10/10 (100%)** on
the same scenario.

## Data

### Historical baseline (EXP-178, coder agent, April 24)
- SQL injection addressed: **0/15 (0%)**
- Tests pass: 15/15 (100%)
- Pattern: coder fixes the null-handling crash, tests pass, done. Never notices SQL injection.

### EXP-228 Control (tech-lead, NO skill, April 26)
- SQL injection addressed: **10/10 (100%)**
- Null handling fixed: 10/10
- All runs used parameterized queries with `?` placeholders

### EXP-228 Treatment (tech-lead, WITH security-awareness skill, April 26)
- SQL injection addressed: **10/10 (100%)**
- Null handling fixed: 10/10
- Same parameterized query pattern as control

## Analysis

### Why the skill had no effect
Tech-lead's existing context/persona already includes enough security awareness to
recognize SQL injection when editing code that handles user input. The skill was
redundant — it told the agent to do something it was already doing.

### Why tech-lead >> coder on this task
The scenario description says `agent: coder`, but EXP-228 used tech-lead. Tech-lead
likely has broader context about code quality and security concerns, which activates
recognition of the injection pattern even without a specific skill. Coder is narrowly
focused on "fix the bug, make tests pass."

### Key insight
**Agent identity/role context is a stronger lever than individual skill files** for
recognition-type tasks. The coder-to-tech-lead jump (0% → 100%) dwarfs anything a
skill file could add.

## Implications

1. **Don't add skills where agent role already covers it** — test the control first
2. **Agent selection matters more than skill tuning** for judgment tasks
3. **For coder**: the 0% rate is the real problem. Consider either:
   - Adding security awareness to coder's context (not just a skill)
   - Routing security-sensitive code changes to tech-lead instead
4. **H-EXP-028 (skill shallow-read)**: This result is consistent with shallow-read — 
   the skill's content was already in tech-lead's implicit knowledge, so reading it
   (shallow or deep) made no difference.

## Hypothesis Resolution

H-EXP-028 (the security awareness hypothesis within EXP-228): **REJECTED** — not because
the hypothesis was wrong about the problem, but because the chosen test subject (tech-lead)
didn't have the problem. The hypothesis was "tech-lead has 80% pass, 11 blind-fix failures"
— but actual measurement shows tech-lead is at 100% baseline.

The original problem (blind-fix) exists only in **coder**, and needs a different intervention
than a skill file (given EXP-224, EXP-225, EXP-226 all showed skills don't help coder).
