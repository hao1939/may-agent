# DD#605 — Decocted Experience Improves Test-Time Inference in LLM Agents

**Source:** Shen, Zha, He, Hong, Ouyang, Ryu, Sattigeri, Diggavi, Wornell; arXiv:2604.04373, 6 Apr 2026
**Rating:** ★★★★½ (OUTSTANDING — context as scaling axis, directly relevant to our architecture)

## What They Did
Systematically studied **context as a complementary scaling axis** alongside test-time compute scaling for LLM agents. Introduced **decocted experience** — extracting essence from past experience, organizing it coherently, and retrieving salient information to build effective prompts.

## Key Contributions

### Context as Scaling Axis
Most test-time scaling research focuses on: more tokens (longer reasoning), more samples (best-of-N), or more search (tree/beam search). This paper identifies a fourth axis: **better context construction**. The claim is that for agentic tasks, context quality matters more than compute quantity.

### Decocted Experience
The name comes from traditional Chinese medicine's "decoction" — boiling herbs to extract their essence. Applied to agent experience:
1. **Extract** — identify the useful signals from raw experience traces
2. **Organize** — structure extracted knowledge coherently
3. **Retrieve** — select the most salient information for the current task

### Systematic Analysis
Studied across math reasoning, web browsing, and software engineering tasks:
- How to derive context from experience (raw traces vs. summarized vs. decocted)
- How performance scales with accumulated experience
- What characterizes good context (specificity, relevance, organization)
- Which data structures best support context construction

## Why It Matters for Us — THIS IS EXTREMELY RELEVANT

### 1. Context Engineering (DD#598) — Theoretical Foundation
DD#598 identified "context engineering" as an emerging methodology. Decocted Experience provides the theoretical and empirical framework for it. The extract→organize→retrieve pipeline is exactly what context engineering needs.

### 2. Our Compaction Process = Decoction
What Scout sessions do when compacting context is literally "decoction": extracting key facts, organizing them into structured summaries, discarding raw traces. This paper validates our approach with rigorous empirical evidence.

### 3. Memory Architecture — Consolidation = Decoction
The Memory Architecture research project's consolidation tier (working memory → long-term memory) is decoction. The paper's finding that organized/structured experience outperforms raw retrieval validates the consolidation hypothesis.

### 4. Adaptive Reasoning Efficiency
For the adaptive-reasoning-efficiency research project: decocted experience is an *alternative* to spending more compute on reasoning. Instead of thinking harder, think with better context. This is a fundamental architectural insight — invest in experience infrastructure rather than bigger inference budgets.

### 5. DD#604 SuperLocalMemory Connection
SLM V3.3's 7-channel retrieval + Ebbinghaus forgetting IS a decoction system. The channels perform extraction, the forgetting curve handles organization (what to keep), and multi-channel fusion handles retrieval. DD#604 is an implementation; DD#605 is the theory.

### 6. Harness Engineering
For long-running agents: experience decoction = the mechanism by which agents improve over time without retraining. The harness should capture, decoct, and inject experience systematically.

## Key Empirical Findings
- **Raw experience traces** (just appending past actions) help less than **decocted summaries**
- Performance scales sub-linearly with raw experience but **near-linearly with decocted experience**
- Data structure matters: tree-structured experience retrieval > flat retrieval
- **Specificity** of retrieved experience matters more than volume

## Limitations
- Tested on standard benchmarks (GSM8K-level math, WebArena, SWE-bench) — may not extend to novel domains
- Nine authors from MIT/IBM — strong affiliation but computational resources may not replicate
- Decoction quality depends on the LLM doing the extraction — bootstrapping problem
- Doesn't address adversarial experience injection (what if past "experience" is poisoned?)

## Connections
| Link | Relationship |
|------|-------------|
| DD#598 Context Engineering | Decocted Experience = theoretical foundation for context engineering |
| DD#604 SuperLocalMemory | SLM is a decoction implementation (7-channel + forgetting) |
| DD#571 Adaptive Thinking | Reasoning effort allocation ↔ experience quality investment |
| Memory Architecture Project | Consolidation tier = decoction process |
| adaptive-reasoning-efficiency | Experience quality vs. inference compute trade-off |
| DD#558 Caveman Token Compression | Compression ↔ decoction (both extract essence) |

## Cross-Reference: New Concept Note
**CR#307 — Decoction Architecture**: Context engineering + tiered memory + experience consolidation form a unified "Decoction Architecture" where:
- **Raw experience** → Working Memory (DD#604 channels 1-3)
- **Decoction** → Consolidation Process (DD#604 channels 5-6)
- **Decocted Knowledge** → Long-Term Memory (DD#604 channel 7)
- **Retrieval** → Multi-channel fusion for context construction
- **Injection** → Prompt engineering / context window management

This is the most complete theory of how agents should manage experience for long-horizon tasks.

## Predictions
- **P411**: "Experience decoction" or equivalent terminology will appear in production agent frameworks (LangChain, CrewAI, etc.) within 12 months
- **P412**: The context-scaling axis will be recognized as more cost-effective than compute-scaling for agentic tasks, leading to a "context engineering > chain-of-thought" shift in 2027
- **P413**: Adversarial experience injection (poisoning the decoction) will be identified as a novel attack class within 18 months

## Bottom Line
The single most relevant paper this session for our architecture. Validates our compaction approach, provides theoretical grounding for memory consolidation, and identifies context quality as a scaling axis complementary to inference compute. The Decoction Architecture (CR#307) unifies DD#604 (SuperLocalMemory), DD#598 (Context Engineering), and our Memory Architecture research project into a coherent framework.
