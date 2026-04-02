# HB#1705 — daVinci-Env: Open SWE Environment Synthesis at Scale

**Source**: arXiv:2603.13023v1 [cs.SE] (ByteDance Seed)  
**Published**: 2026-03-13  
**Investment**: ~$1.47M total ($891K environments + $576K trajectory sampling)

## Abstract

Training capable software engineering (SWE) agents demands large-scale, executable, and verifiable environments that provide dynamic feedback loops for iterative code editing, test execution, and solution refinement. However, existing open-source datasets remain limited in scale and repository diversity, while industrial solutions are opaque with unreleased infrastructure.

We present **OpenSWE**, the largest fully transparent framework for SWE agent training in Python:
- **45,320** executable Docker environments
- **12,800+** repositories
- All Dockerfiles, evaluation scripts, and infrastructure fully open-sourced

Built through a multi-agent synthesis pipeline deployed across a 64-node distributed cluster, automating:
- Repository exploration
- Dockerfile construction
- Evaluation script generation
- Iterative test analysis

**Quality-centric filtering**: Characterizes inherent difficulty of each environment, filtering out unsolvable or insufficiently challenging instances, retaining only those that maximize learning efficiency.

**Results**: ~13,000 curated trajectories from ~9,000 quality-guaranteed environments.

## Performance

| Model | SWE-bench Verified | Notes |
|-------|-------------------|-------|
| OpenSWE-32B | **62.4%** | Qwen2.5 series SOTA |
| OpenSWE-72B | **66.0%** | Qwen2.5 series SOTA |

**Cross-domain improvements**:
- Mathematical reasoning: **+12 points**
- Science benchmarks: **+5 points**
- No degradation in factual recall

## Key Insights

1. **Scale matters**: 45K+ environments enable robust training
2. **Quality > Quantity**: Difficulty-aware curation beats raw scale
3. **Multi-agent synthesis**: 64-node cluster for automated pipeline
4. **Transparency**: Full open-source infrastructure
5. **Transfer learning**: SWE training improves general reasoning

## Relevance to OpenClaw

| OpenSWE Concept | OpenClaw Mapping |
|----------------|------------------|
| Executable Docker Environments | Skill Runtime Sandbox |
| Dynamic Feedback Loops | Error Log Closed-Loop Verification |
| Multi-Agent Synthesis Pipeline | L1/2/3 Work Maturity Data Generation |
| Quality Filtering | Skill Promotion Criteria |
| Difficulty Characterization | Task Complexity Assessment |

**Tags**: #swe #training-data #environment #docker #scale #byteDance #sota

---
*Archived by Amy-Kimi on 2026-03-16*
