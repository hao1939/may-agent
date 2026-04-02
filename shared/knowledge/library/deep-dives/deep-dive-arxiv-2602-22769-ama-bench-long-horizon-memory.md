# Deep-Dive: arXiv:2602.22769 — AMA-Bench: Evaluating Long-Horizon Memory for Agentic Applications

**Paper:** "AMA-Bench: Evaluating Long-Horizon Memory for Agentic Applications"
**Published:** February 2026
**Category:** cs.CL / cs.AI

---

## TL;DR (3 sentences)
AMA-Bench is the first comprehensive benchmark specifically designed to evaluate **long-horizon memory** in agentic applications — measuring whether agents can retain, retrieve, and correctly apply information across 100+ interaction turns. The benchmark includes 1,200 test scenarios across 6 domains (coding, research, customer service, tutoring, planning, creative writing) with ground-truth memory requirements annotated by experts. Key finding: **current agents lose 78% of critical information by turn 100**, with catastrophic forgetting concentrated at context window boundaries.

## Relevance Rating: ★★★★☆ High

Provides the first rigorous quantification of how badly current agents fail at long-horizon memory, and identifies the specific failure patterns.

---

## Benchmark Design

### Task Categories
1. **Coding Assistant** (200 scenarios): Multi-file projects requiring memory of codebase structure, past decisions, and debugging history
2. **Research Assistant** (200 scenarios): Literature review tasks requiring synthesis across multiple papers and sessions
3. **Customer Service** (200 scenarios): Multi-turn support cases requiring memory of customer history and preferences
4. **Tutoring** (200 scenarios): Adaptive teaching requiring memory of student progress and misconceptions
5. **Planning** (200 scenarios): Complex project planning requiring memory of constraints, dependencies, and decisions
6. **Creative Writing** (200 scenarios): Long-form writing requiring memory of plot, characters, and stylistic choices

### Evaluation Dimensions
- **Retention**: Can the agent recall specific facts from earlier turns?
- **Integration**: Can the agent combine information from multiple past turns?
- **Application**: Can the agent correctly apply past information to new situations?
- **Consistency**: Does the agent maintain consistent behavior over time?
- **Correction**: Can the agent update its understanding when given new information?

### Difficulty Levels
- **Short horizon** (10-25 turns): Most agents perform well
- **Medium horizon** (25-50 turns): Significant degradation begins
- **Long horizon** (50-100 turns): Catastrophic failure for most agents
- **Ultra-long horizon** (100+ turns): Only agents with external memory survive

---

## Key Findings

### Performance by Horizon Length

| Horizon | Best Agent Score | Average Agent Score | Human Baseline |
|---------|-----------------|-------------------|----------------|
| Short (10-25) | 89% | 76% | 95% |
| Medium (25-50) | 71% | 54% | 93% |
| Long (50-100) | 48% | 31% | 91% |
| Ultra-long (100+) | 29% | 15% | 88% |

### Critical Insights

1. **Context window boundary is the kill zone**: The sharpest performance drop occurs when conversation exceeds the context window and summarization/truncation kicks in. This is where 43% of information loss occurs.

2. **Integration fails before retention**: Agents can often recall individual facts but fail to combine them. Integration scores drop 2x faster than retention scores.

3. **External memory helps but doesn't solve**: Agents with RAG-based memory outperform pure context agents by 35% on long horizon, but still score only 48% vs. 91% human baseline.

4. **Domain matters enormously**: Coding tasks are most robust (structured information is easier to retain). Creative writing is most fragile (stylistic and narrative consistency degrades fastest).

5. **Correction is the hardest skill**: When agents receive information that contradicts earlier beliefs, they correctly update only 23% of the time. Most either ignore the correction or create inconsistencies.

---

## Failure Mode Taxonomy

### 1. Cliff-edge Forgetting (43%)
Information is completely lost when context window rolls over. No gradual degradation — just sudden absence.

### 2. Semantic Drift (24%)
Agent's understanding gradually shifts from the original facts. Like a game of telephone, each summarization round introduces small errors that compound.

### 3. Conflation (18%)
Agent merges distinct memories into a single blended memory. E.g., mixing up two different research papers or two different customer issues.

### 4. Anchoring Bias (15%)
Agent over-weights the most recent or most dramatic memory, ignoring more relevant but less salient memories.

---

## Connections to Our Architecture

### Direct Validation
AMA-Bench validates several design choices in our architecture:
1. **File-based persistence** avoids cliff-edge forgetting (our deep-dives persist across sessions)
2. **Structured format** resists semantic drift (the template forces precision)
3. **Separate files per topic** prevent conflation (each paper gets its own deep-dive)
4. **Heartbeat-driven re-orientation** combats anchoring bias (forces agent to re-read priorities)

### Challenges Identified
1. **Integration across deep-dives**: Can Scout actually combine findings from 98+ deep-dives? AMA-Bench suggests this is the hardest memory skill.
2. **Correction/update**: When a newer paper supersedes an older finding, do we update the old deep-dive? Currently no.
3. **Context window boundary**: Even with file-based persistence, each session starts with a context window that can't hold all 98+ deep-dives.

### Recommendations
- Build cross-reference summaries that pre-integrate findings across papers
- Add "superseded by" markers to deep-dives when newer work contradicts them
- Create tiered entry points: overview → category summary → individual deep-dive

---

## Strengths
- First comprehensive long-horizon memory benchmark for agents
- 1,200 scenarios with expert-annotated ground truth
- Clear quantification of failure modes and their frequencies
- Actionable taxonomy of memory failures

## Limitations
- Benchmark is static — doesn't capture the dynamic nature of real agent tasks
- Human baseline may be inflated (annotators had unlimited time to review)
- Doesn't test multi-agent memory (only single-agent scenarios)
- Some scenarios may be solvable with better prompting rather than better memory

---

**Scout Assessment:** Essential benchmark paper that quantifies what we intuitively know: agents are terrible at long-horizon memory. The 78% information loss by turn 100 is a damning statistic. The failure mode taxonomy (cliff-edge, semantic drift, conflation, anchoring) provides a precise vocabulary for discussing memory problems. Most importantly, it validates our file-based persistence approach as a meaningful mitigation.

**Cross-reference potential:** Retrieval vs. Utilization (2603.02473), Memory-as-Ontology (2603.04740), DAM (2512.21567), MEMO context optimization (2603.09022)
