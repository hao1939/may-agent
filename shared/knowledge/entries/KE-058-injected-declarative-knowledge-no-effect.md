# KE-058: Injected Declarative Knowledge Has No Effect on Agent Behavior

**Evidence-Grade:** A — 3/3 runs, 0% application rate, clear mechanism

**Status**: Observed  
**Source**: EXP-082 (knowledge application pipeline)  
**Date**: 2026-04-08  
**Confidence**: High (3/3 runs, 0% application rate)

## Finding

When declarative knowledge is injected into an agent's task context (via `injected_context`), the agent does not reference or act on it — even when the knowledge directly contradicts the task instructions and following it would improve outcomes.

## Evidence

**EXP-082**: Injected KE-054 ("externalization hurts debugging — skip or minimize analysis") into a debugging task that forces externalization (cascading-fix-trap-v3-ke054).

| Metric | Result |
|--------|--------|
| Agent referenced KE-054 | 0/3 (0%) |
| Agent adapted analysis approach | 0/3 (0%) |
| Analysis written (despite warning) | 3/3 (100%) |
| Analysis average size | 3,455 bytes (full-length) |
| Product quality (all tests pass) | 3/3 (100%) |

The injected knowledge stated explicitly:
- "Externalization hurts debugging task performance (–11 to –33pp)"
- "For debugging/implementation tasks: Skip or minimize the analysis phase"
- "This is a debugging task. KE-054 suggests the analysis phase may be counterproductive"

The agent wrote full-length root-cause analyses in all 3 runs without any mention of KE-054 or domain boundaries.

## Mechanism

**Task instructions dominate over context knowledge.** When the task says "Write ROOT_CAUSE_ANALYSIS.md" and the context says "analysis hurts debugging," the agent follows the explicit instruction and ignores the declarative knowledge.

This is consistent with the prompt processing hierarchy:
1. **Task instructions** (highest priority — what to DO)
2. **Identity/role context** (medium — who you ARE)  
3. **Injected declarative knowledge** (lowest — what to KNOW)

Declarative knowledge about "what works" or "what doesn't work" sits at the bottom of this hierarchy and gets overridden by any explicit instruction.

## Relationship to Existing Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-011 | Extends: agents skip knowledge files → agents skip injected knowledge too |
| KE-026 | Extends: pull discovery dead → push delivery also insufficient |
| KE-002 | Validates at meta level: text rules don't work → text knowledge doesn't work |
| KE-052 | Confirms: structural access dominates content quality |
| H-043 | Updates: P(applies\|pushed) ≈ 0, not just P(accesses) ≈ 0 |

## Implications

1. **Knowledge entries are for HUMANS, not agents.** The 57 KE entries inform Coach/human decision-making about what interventions to try. Agents will never self-serve from them.

2. **Knowledge must be encoded structurally.** KE-054's insight ("don't externalize for debugging") should become a conditional workflow that checks task domain, not a knowledge entry agents read.

3. **The Knowledge Consumability Plan needs a structural layer.** Making knowledge easier to find (push delivery) is necessary but not sufficient. Knowledge must be translated into workflows, skills, or conditional logic to affect behavior.

4. **P(applies) = 0 completes the utilization dead zone.** Combined with P(accesses) ≈ 0: U = 0 × 0 ≈ 0 at every pipeline stage.

## Decision Rule

When a KE entry has a clear behavioral prescription:
- ❌ Don't inject it as declarative context and expect behavior change
- ✅ Do encode it as a workflow condition, skill, or structural constraint
- ✅ Do use it to inform human decisions about intervention design

## Tags
knowledge-utilization, injected-context, declarative-knowledge, P(applies), H-043, EXP-082
