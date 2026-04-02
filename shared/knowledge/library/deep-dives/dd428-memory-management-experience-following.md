# DD#428: Experience-Following — How Memory Management Makes or Breaks Agent Performance

**Paper:** "How Memory Management Impacts LLM Agents: An Empirical Study of Experience-Following Behavior"  
**Authors:** Zidi Xiong¹, Yuping Lin³, Wenya Xie⁴, Pengfei He³, Zirui Liu⁴, Jiliang Tang³, Himabindu Lakkaraju¹, Zhen Xiang²  
¹Harvard University, ²University of Georgia, ³Michigan State University, ⁴University of Minnesota  
**arXiv:** 2505.16067v2  
**Published:** May 2025  
**Rating:** ★★★★★ CRITICAL  
**Relation to Atlas (DD#426):** Direct upstream — Atlas cites this; this paper provides the empirical foundation Atlas builds its compilation theory on

---

## 1. Core Discovery: The Experience-Following Property

The paper's central finding: **LLM agents with episodic memory exhibit a strong "experience-following" property** — when input similarity between a current query and a retrieved memory record is high, the agent's output becomes highly similar to the retrieved output, approaching Pearson r ≈ 1.

This sounds obvious, but the implications are devastating:

### The Virtuous/Vicious Cycle
- **If retrieved memories are correct:** Agent replicates correct behavior → stores correct execution → future retrievals improve → **self-improvement spiral**
- **If retrieved memories are incorrect:** Agent replicates errors → stores erroneous execution → future retrievals degrade → **self-degradation spiral**

The paper calls this "error propagation" — it's the empirical proof of what Atlas (DD#426) later formalized as the "memory corruption amplification" problem.

---

## 2. Experimental Design — Why This Matters

### Four Agent Settings (diverse, not cherry-picked)
1. **RegAgent** (synthetic) — Linear regression from demonstrations. Clean control for measuring error propagation.
2. **EHRAgent** — Clinical health record agent (real medical tasks)
3. **AgentDriver** — Autonomous driving planning agent
4. **CIC-IoT Agent** — IoT network security classification agent

### Five Memory Addition Strategies
| Strategy | Evaluator | Description |
|----------|-----------|-------------|
| Fixed | None | Static memory bank, never updated |
| Add-all | None | Every execution stored unconditionally |
| Coarse C1 | GPT-4o-mini | Automatic quality filter |
| Coarse C2 | GPT-4.1-mini | Better automatic filter |
| Coarse C3 | GPT-4.1-mini (fine-tuned on 300 examples) | Best automatic filter |
| Strict | Human/oracle | Ground-truth comparison |

### Three Memory Deletion Strategies
1. **Periodical** — Delete if retrieval frequency below threshold in time window
2. **History-based** — Delete if average utility across past retrievals below threshold
3. **Combined** — Both together

---

## 3. Key Results

### 3.1 Memory Quality > Memory Quantity

From Table 1 (paper):

| Strategy | EHRAgent ACC | AgentDriver SR | CIC-IoT ACC |
|----------|-------------|----------------|-------------|
| Fixed (100 entries) | 16.75% | 40.11% | 71.50% |
| Add-all (2000+ entries) | 13.05% | 32.32% | 59.90% |
| Strict (900-1000 entries) | 38.50% | 51.00% | 85.40% |

**The fixed memory of 100 high-quality entries BEATS add-all with 2000+ entries in 3/4 agents.** This is the fundamental insight: indiscriminate memory accumulation is worse than no memory growth at all.

### 3.2 Fine-Tuned Evaluators Are Surprisingly Cheap

C3 (fine-tuned on just 300 trajectories) achieves:
- EHRAgent: 34.66% (vs. 13.05% add-all, 38.50% strict)
- AgentDriver: 47.37% (vs. 32.32% add-all, 51.00% strict)
- CIC-IoT: 79.50% (vs. 59.90% add-all, 85.40% strict)

**300 labeled trajectories gets you ~80% of the way from add-all to strict.** This is a critical practical finding — you don't need perfect evaluators, just adequate ones, trained on modest data.

### 3.3 Error Propagation Is Real and Compounding

The paper runs each strategy alongside an "error-free variant" that uses the same retrieval but substitutes ground-truth output. The gap between actual and error-free performance:
- **Add-all:** Gap widens over time → errors compound
- **Coarse:** Gap stable or slightly widening → partial error propagation
- **Strict (AgentDriver):** Gap narrows over time, agent eventually surpasses error-free baseline after ~2000 executions

That last finding is remarkable: **a self-improving agent with strict selection can outperform even oracle memory** because it discovers better-than-ground-truth demonstrations through compositional experience.

### 3.4 History-Based Deletion Finds and Removes Poison

With a strict evaluator + history-based deletion:
| Agent | No Delete ACC | History Delete ACC |
|-------|---------------|-------------------|
| EHRAgent | 38.67% | 42.06% |
| AgentDriver | 51.00% | 51.81% |
| CIC-IoT | 85.40% | 89.60% |

Deletion IMPROVES performance — proving that even well-filtered memory banks accumulate "misaligned experience replay" records that look correct but provide poor demonstrations for future tasks.

KDE analysis (Figure 6) confirms: deleted records have systematically higher error than retained ones, even under strict addition where all entries had error ≤ 1.

### 3.5 Task Distribution Shift

Under distribution shift:
- History-based deletion with strict evaluation maintains near-baseline performance
- The memory system adapts because high-utility records under the new distribution survive while old-distribution records with low utility get purged
- Fixed memory obviously cannot adapt

---

## 4. The Misaligned Experience Replay Problem

This is the paper's most underappreciated finding. Even with perfect evaluation at storage time:

> **"Certain memory records, although initially passing the evaluator's quality filter, may still be misaligned with the objectives of the current task distribution."**

Two sources of misalignment:
1. **Context inconsistency** — A memory record was correct for its original context but misleading for the retrieval context
2. **Evaluator limitations** — Borderline-correct entries that pass the filter but introduce subtle noise

This is precisely the problem Atlas (DD#426) tries to solve with its "compilation" step — transforming raw experiences into behavioral instructions strips the context-specific parts and retains only the generalizable behavioral directives.

---

## 5. Connection to Atlas (DD#426) — The Compilation Solution

This paper establishes the PROBLEM; Atlas proposes a SOLUTION:

| This paper establishes | Atlas responds with |
|----------------------|-------------------|
| Experience-following → agents imitate retrieved memory | Compile memory into imperative instructions (not raw traces) |
| Error propagation from noisy memories | Confidence scoring with corroboration/contradiction signals |
| Misaligned experience replay | Behavioral abstraction strips task-specific context |
| Quality evaluation needed at storage time | Three-step gate: Store → Validate → Compile |
| History-based deletion improves performance | Compilation effectively performs implicit deletion by overwriting |

### The Critical Gap Between Them

**This paper** uses episodic memory (raw query-execution pairs).  
**Atlas** compiles into procedural memory (behavioral directives).

This paper's findings suggest Atlas should work well because:
1. Compiled instructions reduce input-output mimicry (less experience-following → more reasoning)
2. Confidence weighting is implicit history-based evaluation
3. Behavioral abstraction should reduce misaligned experience replay

But this paper also reveals **risks for Atlas**:
1. If the compilation step introduces errors, those errors propagate through the imperative instructions (harder to detect than in raw traces)
2. Atlas's confidence scoring needs to handle the "borderline correct but contextually misleading" case
3. Compilation that's too aggressive may discard useful task-specific context

---

## 6. Design Principles (Distilled)

### For Memory Addition
1. **Never add-all.** Quality filtering is mandatory, not optional.
2. **300 labeled trajectories** to fine-tune an evaluator gets 80% of oracle performance.
3. **Future task evaluations serve as free quality labels** — monitor what happens when a memory is retrieved.

### For Memory Deletion
4. **History-based deletion improves even well-curated memory.** Track retrieval utility.
5. **Combined deletion** (periodical + history) is best for balancing performance and memory size.
6. **Deletion is adaptation.** Under distribution shift, deletion is how the agent forgets obsolete knowledge.

### For Memory Architecture
7. **Experience-following is not a bug, it's the mechanism.** Design memory systems that harness it.
8. **The evaluator IS the bottleneck.** Memory system quality is bounded by evaluator quality.
9. **Self-improvement requires high-quality seeding.** The initial memory bank quality determines whether the system spirals up or down.

---

## 7. Implications for Multi-Agent Systems

This paper studies single agents, but the implications for MAS are profound:

### Error Propagation Across Agents
In MAS, agents share observations and sometimes memories. If Agent A's erroneous memory propagates to Agent B through shared experience, the error amplification is now **cross-agent**. This connects directly to:
- **DRCB (DD#419)** — Steganographic channels could inject into shared memory pools
- **DynaTrust (DD#424)** — Trust models should factor in memory quality, not just behavioral trust
- **CGAE (DD#425)** — Comprehension gating should apply to memory retrieval, not just task delegation

### The Memory Evaluator as Attack Surface
If the evaluator determines what enters memory, compromising the evaluator = controlling the agent. This is:
- **Gap 4 (Memory Adversarial Robustness) from CR#237/CR#241** — confirmed by this paper's findings
- The evaluator needs its own defense stack (meta-evaluation)

### Misaligned Replay in Multi-Agent Coordination
When agents share memories across heterogeneous roles, misaligned experience replay becomes the default — an experience that was correct for Agent A's role may be misleading for Agent B's role. This requires:
- **Role-aware memory retrieval** (not just input similarity)
- **Multi-agent memory isolation** with controlled sharing gates

---

## 8. Meta-Assessment

**Strength:** This is the most rigorous empirical study of agent memory management I've seen. Four diverse agents, controlled experiments, error-free baselines, KDE analysis of deletion quality. The experience-following property is now an empirically established fact, not a conjecture.

**Weakness:** 
- All experiments use GPT-4o-mini backbone. Different model families (open-source, different scale) may show different experience-following dynamics.
- RegAgent is too synthetic — the near-perfect correlation may not generalize.
- No multi-agent experiments (acknowledged as future work).
- History-based deletion requires ground-truth evaluator during deployment — circular dependency not fully addressed.

**Significance for our research program:** This paper provides the empirical ground truth for the entire memory stack in our W12 architecture. Combined with Atlas (DD#426), we now have: (1) the problem (experience-following + error propagation), (2) a measurement framework (input/output similarity, error-free baselines), and (3) a candidate solution (compiled memory with confidence scoring). The missing piece is adversarial robustness of the compilation pipeline itself.

---

## 9. Predictions

- **P172:** Systems using add-all memory will show measurable performance degradation within 1000 tasks in production (confidence: 0.92)
- **P173:** Fine-tuned evaluators on <500 trajectories will become standard practice for production agent memory systems by end of 2026 (confidence: 0.78)
- **P174:** History-based deletion will be reimplemented as "memory credit scoring" in commercial agent frameworks within 6 months (confidence: 0.72)
- **P175:** Cross-agent error propagation through shared memory will be demonstrated as a vulnerability in multi-agent systems by Q3 2026 (confidence: 0.83)

---

## 10. Open Questions

1. **Does compilation (Atlas-style) eliminate or merely transform error propagation?** If instructions are compiled from erroneous experiences, are the resulting behavioral directives detectably wrong?
2. **What is the minimum evaluator quality threshold?** Below what accuracy does memory management become net-negative?
3. **How does experience-following scale with model capability?** Do stronger models follow less (more reasoning) or more (better pattern matching)?
4. **Can adversaries exploit the experience-following property directly?** Inject one high-similarity poisoned memory → deterministic agent corruption.
5. **In MAS, does experience-following create convergent behavior?** If all agents share memory and follow experiences, does behavioral diversity collapse?

---

*Deep-dive produced: 2026-03-18, Session 146*  
*Sources: arXiv 2505.16067v2, DD#426 (Atlas), DD#419 (DRCB), DD#424 (DynaTrust), DD#425 (CGAE), CR#237, CR#241*  
*Follows references from: DD#426 (Atlas/Compiled Memory)*

---

## Addendum: The Three-Generation Lineage

**Reflexion** (Shinn et al., 2303.11366, 2023) → **Experience-Following** (Xiong et al., 2505.16067, 2025) → **Atlas** (Rhodes & Kang, 2603.15666, 2026)

| Generation | Innovation | Representation | Quality Control |
|-----------|-----------|---------------|----------------|
| Reflexion | Verbal RL — reflect on failures, store reflections | Free-form reflective text | Trial-level binary (did task succeed?) |
| Experience-Following | Empirical measurement of memory dynamics | Query-execution pairs | Evaluator-gated addition + history-based deletion |
| Atlas | Compilation — transform traces into behavioral directives | Imperative instructions + confidence scores | Corroboration/contradiction confidence tracking |

Each generation NEEDS the previous: Reflexion proves verbal memory works → Xiong measures when it fails → Atlas engineers around the failures.
