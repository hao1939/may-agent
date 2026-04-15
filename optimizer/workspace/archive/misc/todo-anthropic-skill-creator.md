# Task: Explore Anthropic's skill-creator and Adapt for May-Agent

## Context

Anthropic published a "skill-creator" skill that provides a structured
methodology for creating, testing, and iteratively improving skills:
https://github.com/anthropics/skills/tree/main/skills/skill-creator

Read the full SKILL.md and supporting files. Then evaluate what's useful
for our system and integrate the best ideas into our skill lifecycle.

## What to read

1. `SKILL.md` — the main skill (long but worth reading fully)
2. `agents/grader.md` — independent grading agent
3. `agents/comparator.md` — blind A/B comparison
4. `agents/analyzer.md` — post-hoc analysis of why winner won
5. `references/schemas.md` — JSON schemas for evals, grading, benchmarks

## What to evaluate

### High-value ideas to consider adopting

1. **Structured eval format (evals.json)**
   Anthropic uses a JSON format with prompts + expected outputs +
   assertions. We currently use gym scenarios (task.md + success_criteria.js)
   which is similar but less formalized for skills specifically. Should we
   create skill-specific evals in a lighter format?

2. **Independent grader pattern**
   They spawn a separate agent to grade outputs against expectations,
   including "critique the evals" — flagging assertions that would pass
   for wrong outputs. We could adapt this for skill evaluation: after a
   skill is deployed, run an agent session with the skill available, then
   have a grader agent assess whether the skill was followed correctly.

3. **Blind A/B comparison**
   Compare old-skill vs new-skill outputs without knowing which is which.
   Removes bias. Could be implemented using our `agents.call()` to spawn
   two sessions (one with old skill, one with new), then call a grader
   that gets anonymized outputs.

4. **Benchmark aggregation (mean ± stddev)**
   Run each eval 3x to account for LLM variance. Compute pass rates with
   confidence. Our current gym runs are single-shot — could benefit from
   multi-run aggregation for important decisions.

5. **"Explain the why" writing principle**
   "Try hard to explain the why behind everything. Today's LLMs are smart.
   If you find yourself writing ALWAYS or NEVER in all caps, that's a yellow
   flag — reframe and explain the reasoning." This directly applies to our
   skills and agent LESSONS.md entries.

6. **Iteration workspace pattern**
   Organizing results by iteration (iteration-1/, iteration-2/, etc.) with
   per-eval directories. Clean structure for tracking skill evolution over
   multiple refinement cycles.

### Ideas that don't apply (skip these)

- Browser-based eval viewer (`generate_review.py`) — we don't have browser UI
- `.skill` packaging (`package_skill.py`) — we use SKILL.md files in git
- Description triggering optimization (`run_loop.py`) — our skills trigger
  by agent browsing files, not by frontmatter description matching
- Claude Code/Cowork-specific instructions — different harness

## Deliverables

1. **Assessment document** (`workspace/anthropic-skill-creator-assessment.md`)
   - What ideas are worth adopting
   - What adaptations are needed for our system (gym-based testing,
     agents.call() instead of subagents, file-based skills)
   - Proposed changes to `skill-lifecycle/SKILL.md`

2. **If ideas are good: update `agents/shared/skills/skill-lifecycle/SKILL.md`**
   - Integrate the best patterns (grader, comparator, benchmark aggregation)
   - Adapt for our infrastructure (gym runner, agents.call(), filesystem)
   - Keep it practical — Optimizer needs to be able to follow this in a
     12-minute heartbeat session

3. **If applicable: create supporting files**
   - `agents/shared/skills/skill-lifecycle/references/eval-schema.md` — if
     the structured eval format is worth adopting
   - `agents/shared/skills/skill-lifecycle/agents/grader.md` — if the grader
     pattern is worth implementing

## Constraints

- Don't clone the entire anthropic/skills repo — just read what you need via
  the raw GitHub URLs
- Don't adopt things wholesale — adapt for our system's constraints (gym-based
  verification, no browser, file-based skills, 12-min heartbeat budget)
- Test any changes via gym before deploying
- Focus on the methodology, not the tooling (their Python scripts won't work
  in our system; their thinking about skill quality will)
