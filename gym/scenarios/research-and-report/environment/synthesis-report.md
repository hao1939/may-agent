# Synthesis Report: Agent Memory Architectures

## Paper Summaries

### 1. Episodic Memory — EpisodicBuffer (Chen, Nakamura, Osei, 2024)
EpisodicBuffer stores agent experiences as timestamped episodes of (observation, action, outcome) triples, preserving temporal and causal structure. It uses a two-phase retrieval combining structural tags and embedding similarity, achieving 12% improvement on multi-step debugging tasks. However, it struggles with cross-task transfer and requires explicit task boundary signals.

### 2. Semantic Memory — SemanticWeave (Ramirez, Liu, Petrov, 2024)
SemanticWeave distills session transcripts into a knowledge graph of entity-relation triples with confidence scores and provenance. Deployed across 15 repositories, it reduced redundant user questions by 67% and enabled cross-task knowledge transfer 43% of the time. Its main weakness is poor capture of procedural/sequential knowledge and one-task-behind update latency.

### 3. Procedural Memory — ActionForge (Johansson, Acharya, Williams, 2024)
ActionForge mines recurring successful action sequences and compiles them into parameterized, reusable procedures. Over 60 days it compiled 47 procedures that reduced task completion time by 34% on routine tasks. It suffers from cold-start problems (~50 tasks minimum) and cannot compose procedures or handle novel tasks.

## Comparative Analysis

| Dimension | EpisodicBuffer | SemanticWeave | ActionForge |
|---|---|---|---|
| **What it stores** | Temporal experience traces | Factual knowledge triples | Parameterized action sequences |
| **Cross-task transfer** | Poor | Strong (43%) | None (routine only) |
| **Novel task performance** | Good (12% gain) | Good (context accuracy 78%) | No improvement |
| **Routine task acceleration** | Moderate | Moderate | Strong (34% faster) |
| **Cold-start** | Useful immediately | Useful after first task | Needs ~50+ tasks |
| **Storage efficiency** | 2.1KB/episode | 1.8MB for 4,200 triples | 156KB for 47 procedures |
| **Key weakness** | No generalization across episodes | Loses procedural knowledge | Conservative, stale procedures |

## Recommendation for a Multi-Agent Coding Assistant

**Primary: SemanticWeave (semantic memory), augmented with ActionForge (procedural memory).**

A multi-agent coding assistant operates across many repositories, sessions, and task types. The dominant need is **cross-session knowledge persistence** — remembering project structures, conventions, past decisions, and known issues. SemanticWeave directly addresses this: its 67% reduction in redundant questions and 43% cross-repo transfer are exactly the properties needed when multiple agents collaborate on shared codebases. The knowledge graph also supports structured queries that agents can use to coordinate (e.g., "what does agent X know about this module?").

Episodic memory is the weakest fit as primary memory. Its poor cross-task transfer is a critical limitation in a system where agents switch between diverse coding tasks constantly. The 12% debugging gain is valuable but narrow.

**ActionForge is the ideal complement** to SemanticWeave. Coding assistants perform many repetitive workflows (run tests, fix imports, format code, create PRs). ActionForge's 34% speedup on routine tasks directly reduces latency for these patterns. Its cold-start problem is mitigated in a multi-agent system where action history accumulates quickly across agents.

## Complementary Combinations Worth Exploring

1. **SemanticWeave + ActionForge (recommended):** Semantic memory handles *what the agent knows* about the codebase; procedural memory handles *how to do common tasks*. They cover orthogonal gaps — SemanticWeave can't capture procedures, ActionForge can't capture facts.

2. **All three, layered:** EpisodicBuffer as a short-term buffer (last ~100 episodes) feeding into SemanticWeave for fact extraction and ActionForge for pattern mining. This uses episodic memory as a raw source that the other two distill from, addressing EpisodicBuffer's scalability plateau and the other systems' need for input data.

3. **EpisodicBuffer + SemanticWeave:** For debugging-heavy workflows where temporal traces matter, episodic memory provides the "how did this unfold" context that semantic triples cannot represent. Less relevant for routine coding tasks.
