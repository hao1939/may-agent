---
id: HB#1573
date: 2026-03-16
source: arXiv:2603.12710
title: "AI Planning Framework for LLM-Based Web Agents"
authors: Orit Shahnovsky, Rotem Dror (University of Haifa)
---

## Core Contribution
First taxonomy mapping modern LLM-agent architectures to classical planning paradigms

## Planning Paradigm Mapping
| Agent Architecture | Classical Planning | Characteristics |
|-------------------|-------------------|-----------------|
| Step-by-Step | Breadth-First Search (BFS) | Reactive, local decision-making |
| Tree Search | Best-First Tree Search | Explores multiple paths, evaluates then selects |
| Full-Plan-in-Advance | Depth-First Search (DFS) | Complete plan before execution |

## Failure Diagnosis Framework
Two fundamental failure sources:
1. **Planning/Execution Logic Flaws**: Can be diagnosed by paradigm choice
2. **LLM Hallucination**: External noise, requires different mitigation

**Context Drift**: "Over many steps, the original goal falls out of memory, replaced by the most recent instructions"
- BFS (Step-by-Step) agents most susceptible
- DFS (Full-Plan) agents resist drift via plan adherence

## Five Novel Evaluation Metrics
Beyond binary success/fail:
1. Trajectory semantic equivalence to human gold traces
2. Step-level coherence assessment
3. Recovery capability from mistakes
4. Path efficiency
5. Action redundancy detection

## Experimental Results
- Step-by-Step (BFS): 38.41% overall success, better human alignment
- Full-Plan (DFS): 89% element accuracy, better technical execution
- **Key Finding**: No single paradigm dominates — choice depends on application constraints

## OpenClaw Architecture Mapping
| Framework Concept | OpenClaw Implementation |
|------------------|------------------------|
| Step-by-Step | Main Agent iterative reasoning |
| Full-Plan-in-Advance | SKILL.md pre-execution planning |
| Tree Search | Multi-skill evaluation before selection |
| Context Drift Prevention | AGENTS.md persistent context + Error Log |
| Trajectory Quality Metrics | Evaluator scoring beyond binary success |

## Design Implications
1. **AGENTS.md as Plan Anchor**: Prevents context drift by maintaining original goal
2. **Skill as Planning Unit**: Each SKILL.md is a validated sub-plan
3. **Error Log for Recovery**: Structured reflection mechanism
4. **Paradigm Flexibility**: Different tasks may need different planning strategies

## Action Items for OpenClaw
- [ ] Add L3 Flag: Support multiple planning paradigms (BFS/DFS/Best-First) at task level
- [ ] Document context drift prevention mechanisms in AGENTS.md design
- [ ] Develop trajectory quality metrics for Evaluator beyond binary scoring
