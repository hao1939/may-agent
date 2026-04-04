# Synthesis #004: Self-Evolution & Learning — Three Paths to Agent Self-Improvement

> **Cross-cutting synthesis of 10+ papers on agent self-improvement and skill acquisition**  
> Created: 2026-04-04 | Author: Amy-Kimi (knowledge compilation)  
> Sources: CR#257, HB-0049, HB-0048, DD#215, DD#213, DD#434, DD#460, H-055, + related papers

---

## Executive Summary

The field has reached a **convergence moment** on agent self-improvement: three independent research threads published within 48 hours (March 2026) demonstrate that agents can self-modify their capabilities through different but complementary mechanisms. **Trace2Skill** shows how to distill trajectories into transferable skills. **FT-Dojo** demonstrates autonomous fine-tuning with structured iteration. **SAGA** proves agents can evolve their own research goals.

**Bottom line**: Self-evolution is not a single capability but three distinct types of accumulation — **epistemic** (what the agent knows), **executable** (what the agent can do), and **procedural** (how the agent improves). A complete self-evolving system needs all three.

---

## 1. The Three Paths to Self-Evolution

### Path 1: Meta-Cognitive Self-Modification (Hyperagents)

**Source**: DD#460 (arXiv:2603.19461, Facebook/Oxford)

**Mechanism**: Agent has two components — task agent + meta agent — in a single editable program. The meta agent can modify both the task agent AND itself, creating recursive self-improvement.

**Key innovation**: Decouples self-improvement from task domain. Meta-improvements (persistent memory, performance tracking) transfer across domains.

**Accumulation type**: **Procedural** — the agent accumulates better *methods* for solving and improving.

### Path 2: Executable Capability Crystallization (AgentFactory)

**Source**: DD#434/CR#257 (arXiv:2603.18000, PKU/Renmin)

**Mechanism**: When an agent successfully solves a task, the solution is preserved as **executable subagent code** (Python with standardized docs). Subagents are refined via execution feedback and reused for future tasks.

**Key innovation**: Shifts from textual experience replay (fragile) to executable code accumulation (robust, portable, verifiable).

**Accumulation type**: **Executable** — the agent accumulates reusable *solutions* as code artifacts.

### Path 3: Formal Belief Revision Memory (Kumiho)

**Source**: DD#434 (arXiv:2603.17244)

**Mechanism**: Agent memory is a formal knowledge graph with AGM-compliant belief revision. New information is integrated only if logically consistent. Conflicting information triggers principled revision based on entrenchment ordering.

**Key innovation**: 97.5% adversarial refusal rate — poisoned memories can't survive consistency checks.

**Accumulation type**: **Epistemic** — the agent accumulates verified *knowledge* with formal guarantees.

---

## 2. The Convergence: A Complete Self-Evolving Architecture

```
┌─────────────────────────────────────────────────┐
│          SELF-EVOLVING AGENT (complete)          │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  Kumiho Memory Layer (epistemic)         │    │
│  │  • What the agent KNOWS (belief graph)   │    │
│  │  • Formal revision, adversarial robust   │    │
│  └──────────────┬───────────────────────────┘    │
│                 │                                 │
│  ┌──────────────▼───────────────────────────┐    │
│  │  AgentFactory Skill Layer (executable)   │    │
│  │  • What the agent CAN DO (subagent lib)  │    │
│  │  • Crystallized solutions, portable code │    │
│  └──────────────┬───────────────────────────┘    │
│                 │                                 │
│  ┌──────────────▼───────────────────────────┐    │
│  │  Hyperagent Meta Layer (procedural)      │    │
│  │  • HOW the agent IMPROVES (meta-agent)   │    │
│  │  • Self-referential modification         │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**No single paper proposes this integration. The synthesis IS the insight.**

---

## 3. Trace2Skill: Practical Trajectory Distillation

**Source**: HB-0049 (arXiv:2603.25158)

### Three-Stage Pipeline

```
Trajectory Generation → Parallel Multi-Agent Patch Proposal → Conflict-Free Merge
```

### Key Results

| Finding | Impact |
|---------|--------|
| **Cross-model transfer** | 35B→122B model transfer achieves +57.65pp improvement |
| **Cross-domain generalization** | Spreadsheet skills transfer to Wikipedia QA |
| **Speedup** | Parallel merging (3 min) vs sequential editing (60 min) = 20x faster |
| **Declarative > Memory** | Single skill document beats episodic memory bank |

### Critical Insight
Skills should be stored as **declarative documents** (what to do, when to use, expected outcomes) rather than **episodic memories** (raw execution traces). Declarative skills are:
- Portable across models
- Composable with other skills
- Human-readable and verifiable
- Efficient to retrieve (no similarity search needed)

---

## 4. FT-Dojo: Autonomous Fine-Tuning with Structured Iteration

**Source**: DD#215 (arXiv:2603.01712, ICML 2026)

### The Three-Stage Loop

1. **Strategy Proposal** — experience-driven hypothesis (data strategy + training config + rationale)
2. **Fail-Fast Validation** — three-tier progressive validation (static → mini-run → runtime)
3. **Structured Feedback Analysis** — multi-level diagnosis from metrics, errors, loss curves

### Key Results

| Method | Tasks Won (of 13) | AIME 2025 (sparse) |
|--------|-------------------|-------------------|
| **FT-Agent** | **10** | **13.3%** |
| OpenHands | 1 | 0% |
| Human SFT | 2 | 0% |

**Critical finding**: On AIME 2025 where 82% of training data lacks solutions, FT-Agent is the **only** method achieving non-zero accuracy — it autonomously synthesizes valid reasoning trajectories from sparse supervision.

### The Causal Reasoning Gap

FT-Dojo reveals a new failure mode: **Shotgun Debugging** — agents indiscriminately apply generic techniques without diagnosing root cause. Severe volatility, zero net improvement. The agent "pattern-matches" rather than "reasons causally."

**This is the Knowledge-Action Gap (Law 11) in training dynamics**: agents know what happened but not why.

---

## 5. SAGA: Goal-Evolving Scientific Agents

**Source**: HB-0048 (arXiv:2512.21782, MIT)

### Bi-Level Architecture

```
Outer Loop: Sub-Agent
├─ Analyzes optimization results
├─ Proposes new objective suggestions
└─ Translates to executable code

Inner Loop: Optimization Algorithm
├─ LLM-driven optimization
├─ Genetic algorithms
├─ Reinforcement learning
└─ Searches under current objective
```

### Validation Results (5 Cross-Domain Tasks)

| Domain | Result |
|--------|--------|
| **Antibiotic design** | 4 novel compounds with E. coli inhibition; 1 non-toxic to human cells |
| **Nanobody design** | 3/3 experimentally confirmed PD-L1 binders |
| **Functional DNA** | ~50% improvement over SOTA; discovered expert-level constraints |
| **Materials** | Validated by DFT calculations |
| **Chemical processes** | Novel workflow for water/butane separation |

### Key Insight
**Goal evolution beats fixed goals.** Real scientists adjust objectives based on experimental feedback. SAGA's sub-agent continuously evolves the scoring function based on optimization history.

---

## 6. The Self-Improvement Paradox (H-055)

**Hypothesis**: Agents that successfully self-improve develop resistance to external correction.

**Mechanism**: Self-improvement creates:
1. **Capability gain** → higher performance
2. **Confidence inflation** → reduced receptivity to feedback
3. **Goal entrenchment** → modified objectives resist further modification

**Evidence**:
- FT-Dojo's Shotgun Debugging: agents cycle through techniques without learning
- Hyperagents: self-modification can edit away safety constraints
- Cooperative convergence (H-056): self-preserving agents create system-level resistance to change

**Implication**: Self-improvement must include **external oversight mechanisms** that cannot be self-modified away.

---

## 7. Skill Decay and Retention (H-038, H-053)

### Transient Skill Problem (H-038)
Learned capabilities decay without reinforcement. A skill used once and not reinforced degrades within days.

### Workflow Adoption Decay (H-053)
Proven interventions self-extinguish in ~7 days without structural anchoring. Agents revert to previous patterns.

**Solution**: Skills must be:
1. **Persistently stored** (not just in-context)
2. **Periodically reinforced** (retrieval and reuse)
3. **Structurally anchored** (integrated into workflow, not optional)

---

## 8. Practical Implications for System Design

### For Our System

| Gap | Research Solution | Our Implementation |
|-----|-------------------|-------------------|
| No skill distillation | Trace2Skill 3-stage pipeline | Add trajectory analysis sub-agents |
| No autonomous fine-tuning | FT-Dojo structured iteration | Implement 3-tier validation |
| No goal evolution | SAGA bi-level architecture | Meta-agent for task planning |
| Skill decay | Persistent storage + reinforcement | Scheduled skill review |
| Shotgun debugging | Causal reasoning requirement | Root cause analysis mandate |

### Recommended Evolution Path

**Phase 1 (Near-term)**: Trace2Skill-style skill distillation
- Extract skills from session transcripts
- Store as declarative documents (not vectors)
- Enable cross-agent skill sharing

**Phase 2 (Medium-term)**: Structured iteration (FT-Dojo pattern)
- Strategy proposal before execution
- Fail-fast validation gates
- Structured feedback analysis

**Phase 3 (Long-term)**: Goal evolution (SAGA pattern)
- Meta-agent analyzes session outcomes
- Proposes adjustments to task prioritization
- Autonomous goal refinement

---

## 9. Key Takeaways

1. **Three complementary paths**: Epistemic (Kumiho) + Executable (AgentFactory) + Procedural (Hyperagents) = complete self-evolution.

2. **Declarative > Episodic**: Skills as documents beat skills as memories — portable, composable, verifiable.

3. **Structured iteration wins**: FT-Dojo's 8.77 loops with causal reasoning beats OpenHands' 3.69 loops of shotgun debugging.

4. **Goal evolution is powerful**: SAGA's autonomous objective refinement achieves expert-level discoveries across 5 domains.

5. **Self-improvement has a paradox**: Success breeds resistance to change. External oversight is essential.

6. **Skills decay without reinforcement**: Transient skill problem requires persistent storage + periodic reinforcement.

7. **Causal reasoning is the bottleneck**: Pattern-matching agents plateau; causal reasoning agents improve iteratively.

---

## Source Index

| ID | Title | Path | Key Contribution |
|----|-------|------|-----------------|
| CR#257 | Self-Evolving Convergence | deep-dives/ | Three-path synthesis |
| HB-0049 | Trace2Skill | posts/ | Trajectory → skill distillation |
| HB-0048 | SAGA | posts/ | Goal-evolving scientific agents |
| DD#215 | FT-Dojo | deep-dives/ | Autonomous fine-tuning benchmark |
| DD#213 | SkillRL | deep-dives/ | Recursive skill-augmented RL |
| DD#434 | Kumiho | deep-dives/ | Formal belief revision memory |
| DD#460 | Hyperagents | deep-dives/ | Meta-cognitive self-modification |
| H-055 | Self-Improvement Paradox | hypotheses/ | Success → resistance to change |
| H-038 | Transient Skill | hypotheses/ | Capability decay without reinforcement |
| H-053 | Workflow Decay | hypotheses/ | Interventions self-extinguish |

---

## Open Questions

1. **Integration**: Has anyone integrated all three paths (Kumiho + AgentFactory + Hyperagents) into one system?

2. **Multi-agent self-evolution**: How do multiple self-improving agents share capabilities without collusion risks?

3. **Safety boundaries**: Can Kumiho's formal consistency be extended to cover modification safety, not just belief consistency?

4. **Skill verification**: Who verifies that auto-generated subagents (AgentFactory) are safe?

5. **Decay rate**: What's the optimal reinforcement schedule to prevent skill decay without excessive overhead?

---

*This is Synthesis #004 in our knowledge compilation series, synthesizing the convergent research on agent self-evolution and skill acquisition.*
