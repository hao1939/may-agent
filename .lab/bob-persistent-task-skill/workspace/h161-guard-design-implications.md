# H-161 Post-Mortem: What "Partial Support" Means for Guard Design

**Date**: 2026-04-15  
**Author**: Bob  
**Sources**: EXP-164, EXP-165, H-161, KE-186, KE-091, H-085, H-098, H-107

---

## The Core Result

H-161 decomposed forced externalization into two functions:
- **F1** (information quality): Artifact content helps consumers make better decisions
- **F2** (behavioral forcing): Producing the artifact interrupts default action patterns

EXP-164 (easy task): Both independently sufficient. F1=100%, F2=100%, Baseline=0%.  
EXP-165 (hard task): Only F1 works. F1=100%, F2=0%, Full-gate=0%, Baseline=0%.

The devastating finding: **full-gate (F1+F2 combined) scored 0%** on the hard task. Self-generated analysis didn't just fail to help—it actively destroyed the benefit that correct information would have provided.

## What This Means for Guard Design

### 1. Content-First, Not Process-First

Most of our guards are process-first: "force the agent to write FINDINGS.md before fixing." The implicit assumption is that the act of writing produces good-enough analysis. EXP-165 shows this assumption fails on hard tasks.

**The redesign principle**: Guards should maximize the quality of information entering the agent's decision process, not maximize the number of forced production steps.

Concretely:
- A guard that injects expert ROOT_CAUSE_ANALYSIS.md (+100pp) crushes a guard that forces self-analysis (+0pp)
- The information source matters enormously: expert-provided > self-generated, when the task is hard enough that self-analysis is unreliable
- Process gates are only valuable when the forced process reliably produces correct content (math-verifiable tasks, simple enumeration tasks)

### 2. H-085 (Forced Externalization) Needs Reframing

H-085 established that forced externalization is the general mechanism behind behavioral correction. This is still true, but the mechanism is narrower than we thought:

- **What H-085 got right**: Structural enforcement (Ch2) beats text instructions (Ch1/Ch3) for judgment tasks. KE-129's 0%/100% result stands.
- **What needs updating**: The mechanism isn't "forcing production interrupts bad patterns." It's "forcing production interrupts bad patterns *when the production process reliably surfaces correct information*." On math tasks: yes. On architectural tasks with documentation traps: no.

The practical reframe: H-085 describes a **content-generation mechanism**, not just a behavioral-interruption mechanism. When the content generated is wrong, the interruption provides no benefit.

### 3. The Alignment Tax Gets Worse Than We Thought

KE-091 showed forced verification harms high-complexity tasks (-50pp "alignment tax"). EXP-165 reveals a more specific mechanism:

- KE-091's framing: overhead consumes reasoning capacity → less capacity for core task
- EXP-165's finding: self-generated analysis actively primes incorrect paths → worse than no analysis

These are different failure modes:
- **Capacity displacement** (KE-091): The agent runs out of budget. Remove overhead → performance recovers.
- **Content poisoning** (EXP-165): The agent generates wrong analysis and follows it. The problem isn't budget—it's that the forced output is misleading. The agent would do better with NO analysis than with its own wrong analysis.

**Implication**: On hard tasks, process-forcing guards don't just waste capacity—they can actively degrade decision quality by anchoring the agent to its own incorrect initial assessment.

### 4. Connecting to H-098 (Attention Channels) and H-107 (Difficulty Threshold)

H-098 says Ch2 (structural gates) works because it captures the agent's attention channel. EXP-165 refines this: Ch2 captures attention, but attention directed toward unreliable self-analysis can be worse than attention directed at the raw problem.

H-107 says difficulty moderates overhead harm. EXP-165 adds a specific mechanism: above the difficulty threshold, the agent's self-analysis quality degrades, turning process-forcing from helpful (behavioral correction) to harmful (content poisoning). The threshold isn't just about "capacity headroom"—it's about **self-analysis reliability**.

### 5. Practical Redesign Implications

| Current Guard Pattern | Problem | Redesign Direction |
|----------------------|---------|-------------------|
| 2-phase gate: "analyze then fix" | Self-analysis may be wrong on hard tasks | Provide expert analysis when available; reserve self-analysis gates for tasks where agent can self-verify |
| Forced FINDINGS.md production | Content quality varies by task difficulty | Validate artifact content, not just existence |
| Gate checks artifact exists | Compliance theater: artifact exists but is wrong | Either inject correct content (F1) or verify artifact correctness before proceeding |
| One-size-fits-all gate | Hard tasks poisoned by bad self-analysis | Difficulty-adaptive: F1-style (inject knowledge) for hard tasks, F2-style (force analysis) for medium tasks, skip gates for easy tasks |

### 6. The Expert Analysis Pipeline Question

F1's spectacular effectiveness (+100pp) raises the obvious question: where does expert analysis come from?

Options for scaling F1:
- **Pre-written scenario-specific knowledge** (skills with correct diagnostic content)
- **Multi-model pipeline**: A stronger/different model generates ROOT_CAUSE_ANALYSIS.md, then the working agent reads it
- **Accumulated knowledge base**: Past correct diagnoses of similar problems, retrieved by similarity
- **Human expert input**: Expensive but reliable

The key constraint: F1 only works when the information is correct. Incorrect expert analysis would presumably fail the same way self-analysis fails. The bottleneck is information correctness, not information delivery.

---

## Summary: Three Actionable Takeaways

1. **Design guards content-first**: Maximize information quality entering the decision, not just process compliance. When correct information is available, inject it directly rather than hoping the agent will discover it.

2. **Make process gates difficulty-adaptive**: Self-analysis gates work on tasks the agent can reliably self-verify. On tasks beyond that threshold, process gates are neutral-to-harmful. Use F1 (information injection) instead.

3. **Never combine self-analysis with expert information in the same pipeline**: EXP-165's most striking finding—self-generated analysis overwrites/displaces correct information. If you have expert knowledge, deliver it WITHOUT requiring the agent to generate its own competing analysis first.

---

*Cross-references: H-161, EXP-164, EXP-165, KE-186, KE-091, H-085, H-098, H-107*
