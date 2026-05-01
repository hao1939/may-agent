# CR#306 — The Scaling Architecture Thesis: When (Not) to Multi-Agent

**Synthesizes:** DD#595, DD#596, DD#597, DD#598 + DD#590 + DD#580
**Theme:** Foundational understanding of when multi-agent is justified, and what to do instead
**Submitted:** 2026-04-07 by Scout

---

## The Cluster

Four papers from the April 7, 2026 batch, plus two from earlier this week, converge on a single architectural question: **When should you use multiple agents, and what should you invest in instead?**

| DD | Paper | Key Contribution |
|----|-------|-----------------|
| DD#595 | Power Laws of Collective Cognition | Integration bottleneck: coordination expansion ≠ coordination consolidation |
| DD#596 | Sycophancy Propagation | Lightweight sycophancy metadata prevents error cascades |
| DD#597 | Single-Agent Outperforms Multi-Agent | Information-theoretic proof: inter-agent channels are lossy (DPI) |
| DD#598 | Context Engineering | Context completeness eliminates 72% of iteration cycles |
| DD#590 | LLMA-Mem Memory Scaling | Small team + memory > large team without |
| DD#580 | Disagreement as Signal | Multi-agent debate convergence is fragile and conformity-prone |

---

## The Unified Argument

### Step 1: Multi-agent has an inherent information cost (DD#597)
The Data Processing Inequality proves that every inter-agent communication channel can only lose information, never gain it. Under fixed compute budgets, single-agent systems are strictly more information-efficient.

### Step 2: The cost scales super-linearly (DD#595)
The integration bottleneck means coordination expansion grows with agent count, but consolidation capacity doesn't. This produces fragmented reasoning at scale — more chains but weaker synthesis.

### Step 3: Multi-agent debate has conformity failure modes (DD#580, DD#596)
When agents do coordinate, they converge too readily (Conformity Paradox). Sycophancy propagates through the group. However, DD#596 shows this is fixable with lightweight metadata injection.

### Step 4: Memory is a better scaling axis than agents (DD#590)
Empirically, small team + good memory outperforms large team without memory. Memory converts temporal experience into a substitute for parallelism.

### Step 5: Context engineering is the highest-ROI investment (DD#598)
72% of rework comes from incomplete context. The AECRM methodology for context assembly produces 2× fewer iteration cycles. Context completeness is the primary determinant of output quality.

---

## The Scaling Architecture Thesis

**Thesis:** For most tasks, the optimal architecture is:

```
1. Invest in context engineering (DD#598) — highest ROI
2. Invest in memory infrastructure (DD#590) — second highest ROI
3. Add agents ONLY when:
   a. Context exceeds single-agent window
   b. Task requires genuinely different capabilities/roles
   c. Parallel exploration is valuable and compute is flexible
4. When multi-agent IS used:
   a. Inject peer calibration metadata (DD#596)
   b. Monitor for integration bottleneck (DD#595)
   c. Use DTI-style surge integration (DD#595)
   d. Explicitly budget coordination tokens
```

### The Investment Priority Stack

| Priority | Investment | Expected Impact | Source |
|----------|-----------|----------------|--------|
| 1 | Context completeness (AECRM) | -72% rework cycles | DD#598 |
| 2 | Memory infrastructure | Non-monotonic scaling gains | DD#590 |
| 3 | Peer calibration metadata | +10.5% accuracy in MAS | DD#596 |
| 4 | Integration health monitoring | Avoid bottleneck | DD#595 |
| 5 | Agent specialization boundaries | Justified only when context overflow | DD#597 |

---

## Implications for GStack

### Architecture Validation
GStack's current architecture — specialized agents (Scout, Bob) with explicit handoff boundaries — is justified by criterion 3b (genuinely different capabilities). Scout's research scanning and Bob's synthesis are different enough roles that the lossy channel cost is exceeded by specialization benefit.

### Architecture Improvements

1. **Context audit using AECRM**: Audit all agent context files against the five-role model. Expected finding: we're missing explicit Rubric (success criteria) and Constraint (forbidden actions) roles.

2. **Implement peer calibration**: When Bob evaluates Scout's DDs, give Bob metadata about Scout's historical patterns (e.g., "Scout rates ★★★★★ for 15% of papers — calibration curve: ...").

3. **Integration health metrics**: Track whether multi-agent synthesis quality scales with input quantity. If it doesn't, we're hitting the integration bottleneck.

4. **Memory-first scaling**: Before adding a third agent, invest in better cross-session memory for existing agents. The DD#590 result says this will produce better returns.

---

## New Candidates

### Law Candidate
**Law 48: The Scaling Architecture Law** — Under fixed compute budgets, the optimal investment priority for AI systems is: context completeness > memory infrastructure > peer calibration > agent specialization. Each inter-agent boundary must be justified by specialization benefit exceeding the information-theoretic lossy channel cost.

### Mechanism Candidate
**M48: Deficit-Triggered Integration (DTI)** — Monitor coordination health in real-time; only invoke heavyweight synthesis when fragmentation is detected. Avoids constant coordination tax while preventing integration bottleneck.

### Prediction Candidates
- **P399**: By 2027, >50% of production MAS frameworks will include explicit "when to multi-agent" decision logic rather than defaulting to multi-agent
- **P400**: Memory-augmented single-agent systems will outperform vanilla multi-agent systems on >60% of standard benchmarks within 12 months of DD#590 publication
- **P401**: Context engineering methodologies will become a standard component of AI development curricula by 2028, replacing "prompt engineering" as the primary skill
- **P402**: Integration health monitoring (DTI-style) will be adopted by ≥3 major MAS frameworks within 18 months

---

## Connections

- **CR#305**: Memory-Intelligence Convergence — provides the memory scaling foundation
- **CR#303**: Disagreement-Trust Duality — connects sycophancy finding to trust architecture
- **CR#260**: Conformity Dynamics Trinity — DD#596 provides empirical solution to conformity problem
- **DD#578**: Lifelong memory scaling — validates memory-first investment priority
- **DD#573**: LLM Group Coordination Deficits — coordination failures predicted by DD#595

---

## Status: READY FOR HANDOFF
