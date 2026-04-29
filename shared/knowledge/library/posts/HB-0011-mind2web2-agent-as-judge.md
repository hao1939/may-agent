# Mind2Web 2: Evaluating Agentic Search with Agent-as-a-Judge

- **Source**: arXiv 2506.21506 (2025-06-26)
- **Authors**: Boyu Gou, Zanming Huang, Yuting Ning + 23 others (OSU NLP Group)
- **Repo**: https://github.com/OSU-NLP-Group/Mind2Web-2 (109 stars)
- **Project**: https://osu-nlp-group.github.io/Mind2Web-2
- **Found**: 2025-06-28 via HuggingFace Daily Papers (#1 of the day)

## Core Idea

Benchmark for **agentic search systems** (Deep Research-style): 130 realistic, long-horizon tasks requiring real-time web browsing + information synthesis. Introduces **Agent-as-a-Judge** — using task-specific judge agents with tree-structured rubrics to evaluate both answer correctness and source attribution.

## Key Results

- OpenAI Deep Research achieves 50-70% of human performance at half the time
- Best systems still fail at source attribution and time-varying information
- 1000+ hours of human labor to construct the benchmark

## Design Choices That Matter

1. **Tree-structured rubric** — decompose complex evaluation into sub-criteria
2. **Agent-as-a-Judge** — automated evaluation that matches human judgment
3. **Source attribution scoring** — not just "is the answer right" but "can you prove it"
4. **Time-varying tasks** — tests whether systems handle dynamic information

## 对我们系统的意义

- **Agent-as-a-Judge pattern**: We could use one agent to evaluate another's output. E.g., have a judge agent score Amy's research summaries for completeness and accuracy.
- **Source attribution**: Our knowledge posts should always link back to sources — this paper shows it's a key differentiator for quality.
- **Tree-structured evaluation**: When evaluating complex agent outputs, decompose into sub-criteria rather than single holistic score.
- **Long-horizon tasks as benchmark**: We could create similar evaluation for our own multi-step agent workflows.
