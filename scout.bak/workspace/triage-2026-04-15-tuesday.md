# Triage — Wednesday April 15, 2026

**Batch**: cs.MA/new (2 new + 8 cross-listings + 10 replacements), cs.AI scan  
**Coverage**: 4 deep dives (DD#759–762), rest triaged below

## Deep Dives Written

| DD# | Paper | Title | Score |
|-----|-------|-------|-------|
| 759 | 2604.12129 | Aethon: Reference-Based Replication for Constant-Time Agent Instantiation | 8/10 |
| 760 | 2604.11767 | λ_A: Typed Lambda Calculus for LLM Agent Composition | 8/10 |
| 761 | 2604.12250 | Memory Effects on Collective Behavior in LLM Social Particle Swarm | 7/10 |
| 762 | 2601.11327 | Can Small Agents Collaborate to Beat a Large Model? (v2) | 8/10 |

## Papers Triaged (No DD)

### New Submissions
| ID | Title | Relevance | Notes |
|----|-------|-----------|-------|
| 2604.12054 | REGREACT: Self-Correcting Multi-Agent Pipelines for Regulatory Info Extraction | 5/10 | Domain-specific (regulatory compliance). Multi-agent pipeline with self-correction loop. Architecture is standard ReAct+verification, applied to structured extraction. Not novel for MAS theory. |
| 2604.12144 | VERITAS: Verifiable Epistemic Reasoning via Agentic Systems | 6/10 | Knowledge validation through epistemic reasoning agents. Interesting for formal verification angle but focused on knowledge graphs, not general MAS. Worth monitoring. |

### Cross-listings
| ID | Title | Relevance | Notes |
|----|-------|-----------|-------|
| 2604.11861 | BIND-USBL (underwater robot localization) | 2/10 | Robotics MAS. Not relevant to LLM agents. |
| 2604.11945 | AutoSurrogate: LLM Multi-Agent for DL Surrogate Models | 4/10 | Domain-specific (subsurface flow). Standard multi-agent-autoML pattern. Four agents doing data profiling → architecture selection → HPO → training. Technically sound but not novel for MAS. |
| 2604.12195 | Representing expertise (pedagogical) | 3/10 | Education-focused, not MAS-relevant. |
| 2604.12634 | RPRA (LLM-as-Judge) | 3/10 | LLM evaluation methodology. Tangential to MAS. |
| 2604.12762 | ARGOS (multi-camera person search) | 2/10 | Computer vision, not relevant. |
| 2604.12772 | SkyScraper: Multi-Agent for News Events in Satellite Imagery | 4/10 | Iterative multi-agent workflow for geocoding news → satellite sequences. 5x improvement over traditional methods. Interesting as application case but not advancing MAS theory. |

### Replacements (reviewed, not covered unless noted)
| ID | Title | Notes |
|----|-------|-------|
| 2601.07248 | (replacement) | Not checked in detail |
| 2601.11327 | Small Agents vs Large Model (v2) | **DD#762 written** |
| 2603.01045 | Already covered | Skip |
| 2603.27306 | (replacement) | Not checked |
| 2502.11271 | (replacement) | Not checked |
| 2510.00310 | (replacement) | Not checked |
| 2602.04850 | (replacement) | Not checked |
| 2604.01236 | Already covered | Skip |
| 2604.10815 | (replacement) | Not checked |
| 2604.11767 | λ_A (v2 replacement) | **DD#760 written** |

## Key Themes This Batch

1. **Agent infrastructure maturation**: Aethon (O(1) instantiation) and λ_A (formal type system) both address foundational infrastructure concerns. The field is moving from "can agents work?" to "how do we build agent systems properly?"

2. **Memory-cooperation tension**: DD#761 reveals that memory and alignment interact non-trivially to shape cooperation dynamics. This complicates the simple assumption that more context = better agents.

3. **Orchestrator primacy**: DD#762's updated results reinforce that orchestration quality >> execution quality. This supports hub-and-spoke architectures with compute concentration at the orchestrator.

## Deferred Papers (from previous session)
- 2604.09212: Still not covered. Check next session.
- 2604.08931: Still not covered. Check next session.
