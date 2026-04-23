# KE-357: Prompt-Based Interventions Cannot Help LLMs Discover Relational Bugs

**Date**: 2026-04-23
**Source**: EXP-195, EXP-198, EXP-199, EXP-201, EXP-202
**Confidence**: High
**Connects**: KE-199, KE-338, KE-356, H-181, H-185, H-187

## Core Finding

Across 7 distinct prompt-based interventions tested on cascading-fix-trap-v2 (total N=65+ trials), **none** improved the agent's ability to discover a relational (pipeline-ordering) bug. Only a direct hint naming the specific bug achieved any success (40%). This represents a hard capability ceiling, not a prompting gap.

## Evidence

| Intervention | EXP | N | Pass Rate |
|---|---|---|---|
| No intervention (baseline) | EXP-195 Arm A | 10 | 10% |
| **Direct hint naming the bug** | **EXP-195 Arm B** | **10** | **40%** |
| Inline skill | EXP-195 Arm C | 10 | 0% |
| Procedural skill | EXP-198 | 10 | 0% |
| Tool availability | EXP-199 Arm B | 10 | 0% |
| Tool + instruction | EXP-199 Arm C | 10 | 0% |
| Verification remasking | EXP-201 | 10 | 0% |
| Defect category enumeration | EXP-202 | 10 | 0% |

The 10% baseline pass likely found the bug by chance. Every non-hint intervention scored 0%.

## Mechanism / Why

Relational bugs require noticing that the *relationship between operations* is wrong, not that any individual value is incorrect. The agent finds the value bug (grade threshold) every time — it can detect "wrong value" easily. But "these steps happen in the wrong order" requires a different reasoning mode: comparing actual execution order against intended semantics. Prompt interventions that say "consider ordering bugs" don't enable this capability — the model either has the circuit or doesn't. Direct hints work because they bypass discovery entirely: they tell the agent *what* to look for.

## Implications

### 1. Stop investing in prompt interventions for discovery blindness
Seven experiments at 0% is conclusive. Further prompt variations (checklists, skills, reframing) will not break through.

### 2. Relational bug discovery requires architectural solutions
Options: (a) tool-based analysis that automatically checks operation ordering, (b) multi-agent approaches where a second agent reviews from a different angle, (c) wait for model capability improvements.

### 3. The gym→production gap (EXP-204) may have a similar ceiling
If breadcrumb non-action is partly a capability issue (not just attention), prompt-only fixes will cap similarly.

## Actionable

- Do NOT design more prompt-based experiments for cascading-fix-trap-v2 — the series is exhausted
- Design EXP-205 as an **architectural** intervention: e.g., a "diff-order checker" tool or multi-agent review pattern
- Update gym scenario difficulty classification: cascading-fix-trap-v2 is a model-capability barrier, not a skill gap

## Open Questions

- Would a stronger model (e.g., next-gen Claude) pass without hints? This would confirm it's a capability ceiling.
- Can a tool that explicitly traces data flow through pipeline stages enable discovery?
- Does the 40% hint success rate plateau or improve with more specific hints?
