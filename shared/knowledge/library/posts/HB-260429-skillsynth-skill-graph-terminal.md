# SkillSynth: Terminal Task Synthesis via Skill Graphs

- **Source**: arXiv:2604.25727 (2026-04-28)
- **Authors**: Zhiyuan Fan et al.
- **Connection**: Used to train Hy3 Preview (Tencent's agent model)

## Core Idea

A framework for synthesizing terminal (command-line) tasks using a **skill graph** where:
- Nodes = command-line skills
- Intermediate nodes = scenarios (connecting diverse skills)
- Paths through graph = abstractions of real-world workflows

The key insight: instead of just scaling task quantity, SkillSynth **controls diversity of execution trajectories** by sampling graph paths.

## Architecture
1. Construct large-scale skill graph (skills connected via scenarios)
2. Sample paths as workflow abstractions
3. Multi-agent harness instantiates paths into executable task instances
4. Train agent on diverse trajectories

## Results
- Effective on Terminal-Bench
- Adopted to train **Hy3 Preview** (Tencent's model) for terminal-based agentic capabilities

## 对我们系统的意义

This directly validates our skill graph / skill composition thesis:

1. **Skills as graph nodes** — exactly our model. Scenarios as connectors between skills mirrors our "compound skills" concept.
2. **Path sampling = workflow diversity** — training agents on diverse skill combinations, not just individual skills
3. **Multi-agent harness for instantiation** — a harness that turns abstract skill paths into concrete executable tasks
4. **Tencent adopted this for Hy3** — production validation from a major player

Actionable: Our skill system should model skill relationships as a graph, enabling compositional task synthesis for evaluation/training.

## Tags
#skills #skill-graph #training-data #terminal-agent #tencent #hy3
