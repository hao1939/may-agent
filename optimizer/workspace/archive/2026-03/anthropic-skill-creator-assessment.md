# Anthropic Skill-Creator Assessment

**Date**: 2026-03-17
**Source**: https://github.com/anthropics/skills/tree/main/skills/skill-creator

## Executive Summary

Anthropic's skill-creator provides a mature methodology for creating, testing,
and iterating on skills. Several patterns are directly valuable for our system;
others don't apply due to architectural differences (no browser UI, gym-based
testing, filesystem skills, heartbeat-constrained sessions).

**Verdict**: 3 patterns worth adopting, 2 principles to reinforce, several to skip.

---

## Patterns Worth Adopting

### 1. Assertions in Skills (for grader verification) ✅ ADOPT

**What they do**: Each skill includes explicit assertions that a grader can
evaluate — "Agent reads the relevant file before editing," "Agent does not
attempt actions outside stated scope." These are verifiable post-conditions.

**Why it matters for us**: Our gym success_criteria.js already does this for
scenarios, but skills themselves don't have assertions. When Optimizer runs
a refine-skill cycle, there's no structured way to check whether an agent
actually followed the skill's protocol. Adding assertions to SKILL.md gives
us automatic grading capability.

**Adaptation for our system**:
- Add an `## Assertions` section to each SKILL.md
- Our evaluator already grades sessions — assertions give it specific things
  to check when a skill was in context
- Format: plain-text assertions (not JSON) that can be checked against
  session transcripts

**Effort**: Low — add section to existing skills, update skill lifecycle template.

### 2. Multi-Run Benchmarking (mean ± stddev) ✅ ADOPT

**What they do**: Run each eval 3 times to account for LLM variance. Compute
pass rates with confidence intervals. Report mean ± stddev.

**Why it matters for us**: Our gym runs are single-shot. A skill could pass
once by luck and fail the next two runs. For important skill deployments
(especially to high-traffic agents like may, coach, tech-lead), we should
run 3x and require consistent results.

**Adaptation for our system**:
- Add to skill lifecycle step 3 (Test): "For deployment decisions, run gym
  scenario 3 times. Require ≥2/3 passes for deploy, 3/3 for critical skills."
- Track in skill journal: "3/3 passes" vs "2/3 passes (flaky)"
- Don't require 3x for every refinement iteration — only for deploy decisions

**Effort**: Low — update lifecycle doc, Optimizer follows during refine cycles.

### 3. Iteration Workspace Pattern ✅ ADOPT

**What they do**: Organize results by iteration (iteration-1/, iteration-2/)
with per-eval directories. Clean structure for tracking skill evolution.

**Why it matters for us**: Our refine-skill cycles currently dump findings
into journal.md prose. Hard to compare iterations or track regression. A
structured workspace per skill refinement would make cycles auditable.

**Adaptation for our system**:
```
agents/optimizer/workspace/skill-refine/
  <skill-name>/
    iteration-1/
      findings.md      (FM analysis, eval scan)
      changes.md       (what was changed and why)
      gym-results/     (pass/fail from gym runs)
    iteration-2/
      ...
```

**Effort**: Medium — create directory structure, update refine-skill task.

---

## Principles to Reinforce

### 4. "Explain the Why" Writing Principle ✅ REINFORCE

**What they say**: "Try hard to explain the why behind everything. If you find
yourself writing ALWAYS or NEVER in all caps, that's a yellow flag — reframe
and explain the reasoning so the model understands the importance rather than
blindly following a rule."

**Status in our system**: Already partially captured in our Skill Writing Guide
(added in a previous update), but worth checking if it's being followed. Many
of our skills still have imperative commands without reasoning.

**Action**: Audit existing skills for ALWAYS/NEVER patterns without reasoning.
Schedule as part of next refine-skill cycle.

### 5. "Keep the Prompt Lean" Transcript Review ✅ REINFORCE

**What they say**: "Read the transcripts, not just the final outputs. If the
skill is making the model waste time doing things that are unproductive,
remove those parts."

**Why it matters**: Our skill effectiveness measurement (step 5 in lifecycle)
says to check if the skill is read, but doesn't explicitly say to check if
following the skill *wastes time*. A skill could be read and followed but
still hurt performance by adding unnecessary steps.

**Action**: Add transcript review to refine-skill cycle: "Read 2-3 transcripts
of agents using this skill. Are any steps consistently skipped or wasted?"

---

## Patterns That Don't Apply

### Browser-Based Eval Viewer — SKIP
We don't have browser UI. Our gym runner + evaluator provide the equivalent.

### .skill Packaging — SKIP
We use SKILL.md files in git, not packaged bundles.

### Description Triggering Optimization — SKIP
Our skills trigger by agent browsing files + knowledge INDEX.md references,
not by frontmatter description matching. The "undertriggering" problem they
solve is different from ours (our problem is discoverability, not description
matching).

### Blind A/B Comparison — SKIP (for now)
Interesting but expensive. Requires spawning two agent sessions (one with
old skill, one with new) and a grader. Our gym already provides before/after
comparison at lower cost. Could revisit if we need more rigorous comparison
for high-impact skills.

### Independent Grader Agent — SKIP (partially adopted)
We already have evaluator doing session grading. Spawning a separate grader
per skill test would be expensive. Instead, we adopt *assertions* (pattern 1)
that feed into our existing evaluation pipeline.

### Cowork/Claude.ai Specific — SKIP
Different harness entirely.

---

## Proposed Changes to Skill Lifecycle

1. **Add Assertions section to SKILL.md template** (step 2 - Draft)
2. **Add multi-run requirement to gym testing** (step 3 - Test)
3. **Add "Grade" sub-step between Test and Deploy** (step 3.5)
4. **Add transcript review to Refine step** (step 6)
5. **Create iteration workspace structure** for refine-skill cycles
6. **Reinforce "explain the why" in Skill Writing Guide**

See the updated SKILL.md for the integrated changes.
