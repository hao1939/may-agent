# DD#772: Thought-Retriever — Retrieve Thoughts, Not Raw Data

**Paper**: Thought-Retriever: Don't Just Retrieve Raw Data, Retrieve Thoughts for Memory-Augmented Agentic Systems
**arXiv**: 2604.12231 | **Authors**: Tao Feng et al. | **Published**: TMLR 04/2026
**Rating**: ★★★★

## Core Idea

Instead of retrieving raw data chunks from a knowledge base, retrieve the agent's own **intermediate responses (thoughts)** generated when solving past queries. Thoughts are filtered for quality, organized in "thought memory," and retrieved for new queries. This creates a self-evolving long-term memory that grows more capable through continuous interaction.

## Key Results

- +7.6% F1 score and +16% win rate over SOTA baselines (average across tasks)
- **Self-evolution**: Performance improves as agent solves more queries (more thoughts accumulate)
- **Depth scaling**: Agent learns to leverage "deeper thoughts" (higher-order reasoning) for more abstract queries
- Model-agnostic — works with any LLM

## Key Insight

Raw data retrieval is fundamentally limited by context length. But if you retrieve *processed thoughts* — which are compressed, relevant, and already partially reasoned — you effectively bypass the context bottleneck. The thought is a lossy but task-relevant compression of the original data.

## Direct Relevance

- Our deep dives (DDs) ARE thoughts — processed, synthesized versions of raw papers. This paper validates our library architecture.
- Cross-references (CRs) are "deeper thoughts" — synthesis across multiple DDs
- The self-evolution property maps to our growing knowledge library improving agent capability over time
- AcademicEval benchmark (academic paper QA) is directly our use case

## Implications

- Validates DD/CR architecture as a form of thought-retrieval memory
- Suggests we should ensure DDs are retrievable by future sessions (citation ratio problem)
- "Deeper thoughts" concept suggests multi-level synthesis: raw paper → DD → CR → hypothesis
- Could formalize our library as a thought-retrieval system with proper indexing

## Limitations

- Requires initial query-solving to build thought memory (cold start)
- Quality depends on initial thought generation — garbage in, garbage out
- Benchmark tasks are QA-focused, not agentic task execution

## Connections

- **DD#764** (dual-trace): Scene traces + thoughts = richer memory encoding
- **DD#770** (ContextCurator): Curator could select which thoughts to inject
- **DD#768** (GAM): Graph structure for organizing thoughts hierarchically
- **H-163** (knowledge library impact): Direct evidence that thought-retrieval improves agent performance
