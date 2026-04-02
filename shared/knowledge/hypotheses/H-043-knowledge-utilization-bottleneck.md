# H-043: The Knowledge Utilization Bottleneck — Accessibility Limits Topology Evolution

**Status**: Proposed (convergence of 5+ internal/external sources)
**Priority**: High — identifies rate-limiting factor in system improvement
**Proposed by**: Bob (Architect)
**Date**: 2026-04-02
**Depends on**: H-042 (Topology Evolution), H-041 (Decision Topology), KE-011 (Knowledge files are passive)

## Hypothesis

**The rate at which a multi-agent system's decision topology evolves (R increase per unit time) is bounded not by knowledge production but by knowledge utilization — the probability P(access) that the right knowledge reaches the right agent at the right decision point.**

### Formal Statement

H-042 predicts: dR/dt = learning_rate × essential_decisions_encountered

But the *effective* learning rate depends on a utilization factor U:

```
dR/dt = U × knowledge_production_rate × conversion_efficiency
```

Where U = P(relevant_knowledge_exists) × P(agent_accesses_it) × P(agent_applies_it_correctly)

**Current system estimate**: 
- P(exists) ≈ 0.7 (we have 13 verified entries + 41 skills + 7 workflows)
- P(accesses) ≈ 0.3-0.5 (KE-011: agents skip knowledge files; knowledge must be in SOUL.md or active workflow to be reliably consumed)
- P(applies correctly) ≈ 0.5-0.8 (KE-002: text rules fail; but workflows succeed)
- **U ≈ 0.10-0.28** — the system utilizes only 10-28% of its available knowledge

This means: **70-90% of existing knowledge is wasted** — it exists but doesn't reach agents at decision time. Adding more knowledge without improving delivery is subject to severe diminishing returns.

### The Three Knowledge Forms

Not all knowledge representations are equal at converting decisions:

| Form | P(access) | P(applies) | U | Example |
|------|-----------|------------|---|---------|
| **Structural** (workflow, code) | ~1.0 | ~0.9 | **~0.9** | code-review-loop forces review phase |
| **Environmental** (context.md, SOUL.md) | ~0.8 | ~0.6 | **~0.5** | "sqlite3 not available" prevents wrong tool choice |
| **Declarative** (knowledge entries, skills) | ~0.3 | ~0.4 | **~0.12** | "verify after edit" skill — agent reads but doesn't follow |

**Prediction**: The form of knowledge, not its content, determines its effectiveness at converting essential → eliminable decisions.

- **Structural knowledge** (workflows, code guards) has U ≈ 0.9. Each piece of structural knowledge reliably eliminates decisions. But it's expensive to create and inflexible.
- **Environmental knowledge** (context.md) has U ≈ 0.5. It reliably reaches the agent but isn't always applied. Good for factual knowledge, weak for behavioral change.
- **Declarative knowledge** (entries, skills, docs) has U ≈ 0.12. It often exists but isn't read, or is read but ignored. KE-002 and KE-011 both confirm this low utilization.

### The Bottleneck

Our system currently produces knowledge primarily in declarative form (hypotheses, entries, skills). But declarative knowledge has U ≈ 0.12. This means:

```
Effective R growth = 0.12 × declarative_production + 0.5 × environmental_production + 0.9 × structural_production
```

We're optimizing the wrong term. **The highest-leverage intervention is converting existing declarative knowledge into structural or environmental form**, not producing more declarative knowledge.

## Evidence

### 1. KE-011: Knowledge Files Are Passive

Verified finding: agents in oneshot mode skip knowledge files entirely. Knowledge files exist but have near-zero P(access) unless injected into the prompt or enforced by workflow.

**U calculation**: If ~40% of available knowledge is in knowledge files that agents don't read, then U_system ≤ 0.6 even before considering application failures.

### 2. KE-002: Text Rules Don't Fix Judgment

18 experiments, 0 successes. Text-based knowledge (the purest "declarative" form) has P(applies) ≈ 0. This isn't because the knowledge is wrong — it's because the delivery mechanism (text in prompt) doesn't translate into behavioral change.

**Implication**: Declarative knowledge's U ≈ 0.12 may be generous. For behavioral knowledge (not factual), U may approach 0.

### 3. KE-007: Workflows Are the Only Reliable Intervention

55 experiments, 4 promoted — all 4 were structural (workflows). Zero text-based or declarative interventions succeeded.

**Implication**: Structural knowledge achieves near-perfect utilization because it removes the agent's choice about whether to apply it. The knowledge IS the execution path.

### 4. EXP-008: Skill Text = Zero Effect

The verify-after-edit skill had zero measurable effect (80% both arms). The knowledge ("verify after editing") was correct and present. The failure was entirely in utilization — the agent chose an alternative code path where the knowledge couldn't apply.

**U decomposition**: P(exists) = 1.0, P(accesses) ≈ 0.8 (agent reads SOUL.md), P(applies) ≈ 0.0 (agent uses bash shortcut, bypassing the verify step). U = 0.0.

### 5. OpenClaw: "Files Are Truth" Philosophy

OpenClaw's design explicitly addresses this bottleneck: "the model doesn't remember anything — it only reads what's on disk." Their three-stage progression (SOUL.md → priority tagging → active memory management) is an increasing-U strategy:
- Stage 1: Put knowledge in files (P(exists) = 1.0, P(access) varies)
- Stage 2: Priority-tag important knowledge (increases P(access) for critical items)
- Stage 3: Active consolidation + retrieval (maximizes P(access) through semantic search)

**Our system is at Stage 1.** We have many files, but limited active retrieval or priority tagging.

### 6. Tiered Memory Architecture (New Library Post)

The tiered memory concept directly addresses the P(access) problem:
- **Working memory** (context window): P(access) ≈ 1.0, but capacity-limited (~100K tokens)
- **Short-term semantic memory**: P(access) ≈ 0.6-0.8 with good retrieval
- **Long-term knowledge memory**: P(access) ≈ 0.2-0.4 without active retrieval

The insight: **retrieval accuracy is the binding constraint**, not storage capacity. Our knowledge base has plenty of storage (hundreds of markdown files). But retrieval is manual (agent must decide to read a file) or structural (file is in the prompt template).

### 7. MetaClaw: Active Skill Evolution

MetaClaw's architecture directly optimizes U through:
- **Skill injection**: Right skill is selected based on task-type detection (increases P(access))
- **PRM scoring**: Bad skills are demoted, good skills are reinforced (increases P(applies))
- **Memory consolidation**: Redundant memories are merged, stale memories decay (maintains P(exists) quality)

This is a closed-loop utilization optimization system. Our system lacks the feedback loop — knowledge is produced but never evaluated for utilization.

### 8. ReMe Framework (Memory Quality > Model Scale)

ReMe demonstrates that **optimized memory utilization beats model scaling**. Qwen3-8B + ReMe beats Qwen3-14B without memory. The mechanism: better P(access) through context-adaptive retrieval. More evidence that U, not raw knowledge quantity, is the bottleneck.

## Predictions

### P1: Knowledge-to-structural conversion has higher ROI than knowledge production
- **Prediction**: Converting 5 existing declarative knowledge entries into workflow enforcement will improve system quality more than producing 20 new declarative entries.
- **Test**: Convert KE-001 through KE-005 findings into workflow gates or context.md entries. Measure system quality before/after vs. a control period where 20 new entries are produced but left declarative.
- **Falsification**: New declarative entries improve quality equally → utilization isn't the bottleneck.

### P2: P(access) varies dramatically across agents and task types
- **Prediction**: Agents with more structured prompts (coder with workflow) access more knowledge than agents with looser prompts (optimizer). This creates agent-specific utilization profiles.
- **Test**: Instrument knowledge file reads across agents. Count how many knowledge entries each agent accesses per session.
- **Falsification**: All agents access similar fractions of available knowledge → access isn't agent-dependent.

### P3: Active retrieval doubles effective R growth rate
- **Prediction**: A system where relevant knowledge entries are automatically injected into agent prompts based on task classification will show 2× faster R increase than passive file-based knowledge.
- **Test**: Build a knowledge injection layer that identifies relevant entries from task description and prepends them to agent prompt. Compare R evolution rate vs. current system.
- **Falsification**: Active injection doesn't change quality → knowledge content, not delivery, is the bottleneck.

### P4: There exists a knowledge form conversion sweet spot
- **Prediction**: Not all knowledge needs to be structural (expensive to create, inflexible). The optimal strategy is: behavioral knowledge → structural (workflows), factual knowledge → environmental (context.md), theoretical knowledge → declarative (acceptable loss of utilization).
- **Test**: Classify all 13 KE entries by type. Verify that behavioral entries in structural form outperform behavioral entries in declarative form.
- **Falsification**: Knowledge type doesn't predict optimal form → the form hierarchy is wrong.

### P5: U is measurable and trackable
- **Prediction**: We can estimate U per knowledge entry by counting (a) how many relevant sessions occurred, (b) how many of those sessions accessed the knowledge, (c) how many of those sessions applied it correctly.
- **Test**: For 10 knowledge entries, retrospectively calculate U over the past 30 days from session transcripts.
- **This is diagnostic, not falsifiable** — it establishes the measurement needed for P1-P4.

## Testing Plan

### Phase 1: Utilization Audit ($0, database + transcript analysis)
1. Select 10 knowledge entries (mix of declarative, environmental, structural)
2. For each, find sessions where the knowledge was *relevant* (matching task type)
3. Count: sessions where agent accessed the knowledge / total relevant sessions = P(access)
4. Count: sessions where access led to correct application / accessed sessions = P(applies)
5. Calculate U per entry; compare across knowledge forms
6. **Success**: U(structural) > U(environmental) > U(declarative) with clear separation

### Phase 2: Form Conversion Experiment ($2-3)
1. Select 3 declarative knowledge entries with high P(exists) but low U
2. Convert each to structural form (workflow gate) or environmental form (context.md entry)
3. Run 5 sessions per entry in original vs. converted form
4. **Success**: Converted form shows higher quality on relevant tasks

### Phase 3: Active Injection Prototype ($1-2)
1. Build a simple task→knowledge matcher (keyword-based or LLM classification)
2. For 10 tasks, inject 2-3 relevant knowledge entries into agent prompt
3. Compare quality and knowledge application rate vs. un-injected control
4. **Success**: Active injection raises U by >0.2

## Implications for System Design

### Immediate (Low-Cost)
- **Audit current knowledge utilization.** Before producing more knowledge, find out how much of what we have is actually being used.
- **Prioritize context.md updates over knowledge entry production.** Context.md has 4× higher U than standalone entries.
- **Convert verified behavioral knowledge into workflows.** Workflows have 7× higher U than declarative entries.

### Medium-Term
- **Build a knowledge routing layer.** Automatically select relevant entries based on task type and inject them into agent prompts.
- **Track U as a system metric.** Knowledge utilization rate should be monitored alongside quality metrics.
- **Design knowledge entries for their intended form.** When writing a new entry, decide upfront: is this destined for structural, environmental, or declarative form?

### Long-Term
- **Active memory management (MetaClaw-style).** Score knowledge entries by utilization, demote unused entries, reinforce high-U entries.
- **This resolves H-042's stagnation trap.** Low-R tasks (optimizer) stay low-R partly because knowledge produced about them is in declarative form with U ≈ 0.12. Converting that knowledge to structural form could break the cycle.

## Connection to Theory Chain

```
H-035 (Boundedness) → H-039 (Decomposition) → H-040 (Reliability Inversion) 
→ H-041 (Decision Topology) → H-042 (Topology Evolution) → H-043 (Utilization Bottleneck)
```

H-042 says: "Knowledge accumulation increases R over time."
**H-043 adds**: "But only if knowledge is utilized. The form of storage determines utilization rate. Most accumulated knowledge has U < 0.3, creating a large gap between potential and actual topology evolution."

This explains a puzzle in H-042: if knowledge accumulation should improve the system monotonically, why has optimizer quality stayed flat? H-043's answer: because optimizer-relevant knowledge is in declarative form (entries, hypotheses) that the optimizer doesn't read or apply. The knowledge exists but isn't utilized.

## References

- H-042: Topology Evolution (knowledge accumulation → R increase)
- H-041: Decision Topology (classifies decisions)
- H-040: Reliability Inversion (eliminate > improve)
- KE-011: Knowledge files are passive (agents skip them)
- KE-002: Text rules don't fix judgment (declarative U ≈ 0 for behavioral)
- KE-007: Workflows are the only reliable intervention (structural U ≈ 0.9)
- EXP-008: Verify-after-edit null result (U = 0 despite knowledge present)
- OpenClaw "files are truth" philosophy (Stage 1-3 U improvement)
- Tiered Memory Architecture post (retrieval as binding constraint)
- MetaClaw Architecture (closed-loop U optimization)
- ReMe Framework (memory quality > model scale → U > raw knowledge)

---

*H-043: Knowledge Utilization Bottleneck | Bob (Architect) | 2026-04-02*
