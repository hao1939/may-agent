# DD-718: Detecting Silent Failures in Multi-Agentic AI Trajectories

**Paper**: arXiv:2511.04032 — "Detecting Silent Failures in Multi-Agentic AI Trajectories" (Pathak, Kumar, Roy, George, Verma, Moogi — IBM Research, Nov 2025)
**Rating**: ★★★★★ CRITICAL
**Added**: 2026-04-10 Session 420 (Confident Failure Literature Search)
**Relevance**: First systematic study of anomaly detection in agent traces — validates our 14.6% confident failure finding

## Core Contribution

First paper to systematically study anomaly detection in multi-agent AI trajectories. Introduces a dataset curation pipeline and benchmarks detection methods, proving that **silent failures are detectable from trajectory features alone**.

## Silent Failure Taxonomy

Five types of silent failures identified (all observed without explicit error signals):

| Failure Type | Description | Our Parallel |
|---|---|---|
| **Drift** | Agent diverges from intended path, selecting irrelevant tools/agents | Wrong tool selection in multi-step tasks |
| **Cycles** | Redundant loops from re-planning | Agent retrying same approach repeatedly |
| **Missing Details** | Response returned without errors but missing crucial information | Our 14.6% — answer looks complete but is wrong |
| **Tool Failures** | External APIs fail silently, return unexpected results | Tool errors not propagated as failures |
| **Context Propagation** | Failure to pass correct context to dependent agents/tools | State corruption between steps |

## Dataset and Pipeline

### Curation Pipeline
1. **Collect** agentic AI traces (complete execution workflows)
2. **Extract** key features from traces
3. **Label** traces as normal/anomaly using defined criteria

### Datasets
- **Stock Market Assistant**: 4,275 trajectories
- **Research Writing Assistant**: 894 trajectories
- Both from multi-agent systems with multiple LLMs and tools

### Features Extracted
- Trajectory length and structure
- Tool call patterns and sequences
- Agent interaction patterns
- LLM variation signals
- User behavior patterns

## Detection Results

| Method | Type | Dataset 1 | Dataset 2 |
|---|---|---|---|
| **XGBoost** | Supervised | **98%** | **94%** |
| **SVDD** | Semi-supervised | **96%** | **89%** |

Key finding: Even semi-supervised methods (requiring only normal examples for training) achieve 89-96% accuracy, meaning silent failure detection doesn't require large labeled failure datasets.

## Relevance to Our System

### Direct Validation of EXP-109
This paper validates that our 14.6% confident failure finding is part of a recognized phenomenon class:
- **"Missing Details in Final Output"** — the agent returns a response without errors but misses crucial information. This IS our confident failure pattern.
- **Drift** — the agent diverges from the intended path. This could explain a subset of our failures where the agent confidently follows the wrong plan.

### Detection Methodology
IBM's approach proves that trajectory features alone (without examining output correctness) can detect silent failures with high accuracy. This means:
1. **We don't need ground-truth labels** to detect confident failures — semi-supervised SVDD works at 96%
2. **Feature extraction from traces** is the key engineering requirement
3. **XGBoost on trajectory features** is a surprisingly strong baseline — no need for complex deep learning

### Practical Implementation Path
1. **Phase 1**: Log structured trajectory data (tool calls, step sequences, timing, confidence signals)
2. **Phase 2**: Build "normal" trajectory profiles from known-good sessions
3. **Phase 3**: Deploy anomaly detection (SVDD or similar) to flag deviating trajectories
4. **Phase 4**: Route flagged trajectories to enhanced verification

### Connection to Existing Knowledge
- DD-717 (HTC): Complementary — HTC uses confidence features, IBM uses structural features. Combined approach likely strongest.
- DD-684 (AgentProcessBench): Process-level evaluation provides training signal
- CR#328 Three-Layer Architecture: IBM's approach fits at Layer 3 (Cascade Prevention) — detecting trajectory-level anomalies before final output
- EXP-110 (Commit Guard): Guard catches decision-boundary failures; anomaly detection catches the remaining silent failures that guards miss

## Key Insight

The most important finding for our system: **silent failures in agent trajectories are structurally distinct from successful trajectories**, even when the final outputs look identical. The difference is visible in the trajectory, not the output. This means trajectory logging (CR#328's recommendation) is not just useful — it's the foundation for a detection system that could address the 14.6% confident failure gap.

## Actionable Recommendations

1. **Tech-lead**: Prioritize structured trajectory logging — this is the prerequisite for all silent failure detection
2. **Bob**: Test XGBoost on trajectory features as a simple baseline for EXP-111+
3. **Scout**: Track IBM's dataset release; check if their curation pipeline can be adapted to our trace format
