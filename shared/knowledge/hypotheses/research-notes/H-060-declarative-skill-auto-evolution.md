# H-060: Declarative Skill Auto-Evolution

**Status**: 🟡 Proposed (awaiting prioritization)  
**Created**: 2026-04-04  
**Source**: Trace2Skill paper (arXiv:2603.25158) via XHS discovery

---

## Claim

By analyzing gym execution traces, we can automatically extract behavioral patterns and generate skill file updates that sustainably improve agent task success rates—without human intervention. Skills should be stored as declarative documents rather than vector memories.

---

## Mechanism

Based on Trace2Skill's three-stage pipeline:

1. **Trajectory Collection**: Gather execution traces from gym episodes (success + failure)
2. **Parallel Analysis**: Deploy sub-agents to analyze traces:
   - Error-analysis agent: Use multi-turn ReAct to locate root causes
   - Success-analysis agent: Extract successful patterns
3. **Conflict-Free Merge**: Hierarchically merge patches via inductive reasoning to distill generalizable patterns
4. **Skill Update**: Write updated skill files (.md) declaratively

---

## Predictions

### P1: Cross-Model Transfer
Skills distilled from smaller models (e.g., Claude 3.5 Haiku) will improve larger models (Claude 3.5 Sonnet) performance, reducing skill generation costs.

**Test**: 
- Collect traces from Haiku runs
- Run Trace2Skill pipeline
- Test evolved skills on Sonnet
- Measure success rate delta

### P2: Declarative > Episodic
A single declarative skill document will outperform retrieval-augmented episodic memory banks for task execution efficiency.

**Test**:
- Baseline: Current RAG-based skill retrieval
- Treatment: Trace2Skill-evolved declarative skill
- Compare: Latency, success rate, token usage

### P3: Parallel > Sequential
Parallel trace analysis (3 min) will achieve comparable or better results than sequential editing (60 min) with 20× speedup.

**Test**:
- Implement both approaches
- Measure wall-clock time and success improvement
- Verify speed/quality tradeoff

---

## Relevance to OpenClaw

| Our Component | Trace2Skill Mapping |
|--------------|---------------------|
| `skills/*.md` | Declarative skill documents |
| `gym/` episodes | Execution traces |
| `coach/` skill creation | Human-authored seed skills |
| Missing | Auto-evolution loop |

**Gap**: We have manual skill creation via Coach, but no automated improvement from execution feedback.

**Opportunity**: Implement Trace2Skill-style auto-evolution as an enhancement to MetaClaw project.

---

## Connections

- **MetaClaw (research project)**: Trace2Skill provides concrete mechanism for skill evolution loop
- **H-041 (Decision Topology)**: Skill evolution requires different strategies for different task complexity (R values)
- **H-059 (Cadence Skill Effectiveness)**: Auto-evolved skills should target cadence over judgment for maximum utilization
- **H-047 (Memory Lifecycle Gap)**: Trace2Skill implements the "pruning as evolution" principle — bad patterns are replaced, not accumulated
- **H-053 (Workflow Adoption Decay)**: Auto-evolution could counteract decay by regenerating skills from fresh traces
- **H-055 (Self-Improvement Paradox)**: Trace2Skill partially bypasses the paradox by using population-level analysis (many traces) rather than individual self-judgment
- **Three-Loop Architecture**: This implements Loop 2 (knowledge lifecycle with skill evolution)

---

## Falsification Criteria

- [ ] P1 fails: Skills don't transfer across model sizes
- [ ] P2 fails: RAG memory outperforms declarative skills
- [ ] P3 fails: Parallel analysis produces worse patches than sequential

---

## Next Steps

1. **Design Doc**: Create implementation plan for Trace2Skill adaptation
2. **Pilot**: Pick 1 task family (e.g., file manipulation), run 20 episodes
3. **Evaluate**: Measure skill improvement after one evolution cycle

---

**Related**: HB-061-trace2skill-distillation.md
