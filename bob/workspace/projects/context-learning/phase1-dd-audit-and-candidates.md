# Phase 1: DD Library Audit & Candidate Approaches

**Author**: bob | **Date**: 2026-04-19 | **Status**: Complete

## DD Library Audit

### DD-743: Darwinian Memory — Evolutionary Pruning
**Core idea**: Treat memory as an ecosystem. Track utility, actively prune low-value memories, inhibit high-risk plans.
**Key result**: 18% success rate improvement, 33.9% execution stability improvement (GUI agents).
**Relevance**: HIGH. Our knowledge base (130+ DDs, 100+ KEs) grows monotonically. Context.md entries have no decay. LESSONS.md entries are manually curated. DD-743 provides the theoretical basis for automated pruning.
**Gap**: We track nothing about lesson utility. No "last-used" timestamps, no hit rates.

### DD-768: GAM — Hierarchical Graph Agentic Memory
**Status**: Indexed but no deep-dive written yet. Paper: arXiv 2604.12285.
**Core idea**: Graph-based hierarchical memory with dynamic importance scoring.
**Relevance**: MEDIUM. Could inform how lessons relate to each other, but we don't need graph structure yet — our lesson count per agent is small (~20-60 lines).

### DD-772: CONCORD — Privacy-Aware A2A Context Recovery  
**Core idea**: Negotiated context sharing between agents with partial views.
**Relevance**: LOW for learning. More about inter-agent coordination than experience-based improvement.

### DD-755: Artifacts as Memory Beyond the Agent Boundary
**Core idea**: Environment can serve as agent memory. Observing artifacts reduces internal memory capacity needed.
**Key result**: Mathematical proof that artifacts compress history without information loss.
**Relevance**: HIGH. Our context.md, LESSONS.md, and skills/ ARE artifacts in DD-755's sense. They externalize memory so the agent doesn't need to re-derive knowledge. The question is: what's the optimal artifact format for behavioral learning?

### Related: Reflexion (dd431), Self-Refine (dd432), CR#248 Self-Correction Triangle
**Status**: Referenced in topic index but deep-dive files missing from disk.
**Core ideas**: Reflexion = verbal reinforcement learning (reflect on failures, store reflections, use in future). Self-Refine = iterative self-feedback within a session.
**Relevance**: CRITICAL. Reflexion is the closest published pattern to what we want — but it operates within a task (retry with reflection), not across sessions.

### KE-044: Verification Separation Thesis
**Key finding**: Self-evolution works IFF verification is architecturally separated from generation. Five independent systems converge on this.
**Relevance**: HIGH. Whoever extracts lessons should NOT be the same agent that produced them. Our evaluator already does this.

## What We Already Have (Current Learning Mechanisms)

| Mechanism | Where | Extraction | Delivery | Pruning |
|-----------|-------|-----------|----------|---------|
| **context.md** | Per-agent file | finish() context_updates + LLM merge | Injected into every session prompt | Manual / cap at 2KB |
| **LESSONS.md** | Per-agent file | Manual (human/coach) | Agent reads at session start | Manual ("graduate then delete") |
| **skills/** | Per-agent directory | Coach designs from gym experiments | Agent reads relevant skills | None |
| **finish() lessons** | Session metadata | Agent self-reports at session end | Evaluator processes | None (fire-and-forget?) |
| **ERROR_LOG.md** | Per-agent file | May/agent writes on failure | Agent reads at session start | Manual |

**Key observation**: We have 5 learning channels but no feedback loop measuring whether any lesson actually changed behavior (except the one npx A/B test). The extraction and delivery mechanisms exist — what's missing is:
1. **Evidence that lessons are used** (attention tracking)
2. **Automated pruning** (decay of unused lessons)
3. **Error-to-lesson pipeline** (systematic extraction from failures)

## Four Candidate Approaches

### Approach 1: Reflexion-Style Post-Session Reflection
**How**: After each session, evaluator extracts "what went wrong and what to do differently" → writes to agent's reflection log → injected into next similar session.
**Pros**: Closest to proven pattern (Reflexion paper). We already have evaluator + context.md pipeline.
**Cons**: "Next similar session" matching is hard. Risk of lesson bloat.
**Effort**: LOW — extend existing context-learn pipeline.
**Test**: Gym scenario where agent makes error in session 1, should avoid it in session 2.

### Approach 2: Darwinian Lesson Pruning
**How**: Track which context.md/LESSONS.md entries agents actually reference (via tool call analysis). Score utility. Prune low-utility entries after N sessions.
**Pros**: Addresses the accumulation problem directly. DD-743 provides theoretical backing.
**Cons**: Requires utility tracking infrastructure. Cold-start problem (new lessons haven't been used yet).
**Effort**: MEDIUM — needs tracking code + pruning logic.
**Test**: Measure context.md size over time; verify useful entries survive, useless ones decay.

### Approach 3: Error-Pattern-to-Lesson Pipeline  
**How**: Analyze ERROR_LOG entries and session failures. Cluster similar errors. When an error type recurs 3+ times, auto-generate a targeted lesson and inject into the agent's context.
**Pros**: Directly addresses "don't repeat errors." Evidence-based (only fires on recurring patterns).
**Cons**: Requires error classification. May produce low-quality lessons without human review.
**Effort**: MEDIUM — needs error analysis + lesson generation.
**Test**: Measure error repeat rate before/after pipeline activation.

### Approach 4: Skill Auto-Evolution (from Gym Performance)
**How**: Coach already creates skills from gym experiments. Automate: run gym periodically → identify performance drops → generate/refine skill → re-test.
**Pros**: Full closed loop. Measurable. Already partially working (read-before-edit: 50%→70%).
**Cons**: Expensive (gym runs cost $0.05-0.15 each). Slow feedback loop. Only works for behaviors testable in gym.
**Effort**: HIGH — needs automation of gym→skill→gym cycle.
**Test**: Track skill effectiveness over gym iterations.

## Recommendation

**Start with Approach 1 (Reflexion-style) + Approach 3 (Error-pattern pipeline)**. Rationale:
- Approach 1 is lowest effort — extend existing context-learn to extract reflections, not just facts
- Approach 3 directly addresses the "don't repeat errors" goal with clear measurement (error repeat rate)
- Both can be tested in gym with controlled before/after experiments
- Approach 2 (pruning) becomes important later when lesson volume grows
- Approach 4 (auto-evolution) is the long-term vision but too expensive to start with

## Next Steps (Phase 2 Design)
1. Design gym experiment: agent encounters error in session 1, test if reflection prevents it in session 2
2. Define error repeat rate metric using existing ERROR_LOG data
3. Extend evaluator's lesson extraction to produce actionable reflections (not just facts)
4. Scout still needed for: OpenClaw, Hermes Agent external research (may validate or add approaches)
