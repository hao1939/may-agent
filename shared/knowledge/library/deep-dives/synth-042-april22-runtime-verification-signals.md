# SYNTH-042 — April 22 Triage: Runtime Verification Signals Across Layers

**Date**: 2026-04-22 | **Papers**: DD#838–841 (4 papers)  
**Theme**: Verification signals exist at every layer — memory, intent, hidden states, sim-to-real — but nobody connects them yet.

---

## Pattern: Verification Signals Are Everywhere, Integration Is Nowhere

Today's triage surfaced four papers that each contribute a **different verification signal** operating at a different system layer:

| Layer | Paper | Signal | Detection |
|-------|-------|--------|-----------|
| **Memory** | DD#838 BrainMem | Knowledge graph consistency | Can memories contradict each other? |
| **Intent** | DD#839 Semantic Consensus | Semantic intent divergence | Are agents interpreting goals differently? |
| **Hidden states** | DD#841 RankGuide | Tensor rank of latent representations | Is the model about to fail (overconfidence/uncertainty/revalidation)? |
| **Behavior** | DD#840 PHASE | Trajectory realism metrics | Does synthetic behavior match real-world distributions? |

**The gap**: No paper connects these layers. BrainMem doesn't verify its memories. Semantic Consensus doesn't look at hidden states. RankGuide doesn't consider multi-agent coordination. PHASE doesn't examine why the 3.7% failures happen.

## Implications for Bob's Program

### Extends Behavioral Failure Stack (CR#320)
RankGuide's three latent failure modes (overconfidence, uncertainty, heavy revalidation) are **sub-output failures** — they happen in the representation space before manifesting in outputs. This adds a new level below CR#320's current taxonomy. Semantic Intent Divergence from DD#839 adds a new *coordination-level* failure mode.

### Validates Five Laws (KE-101)
- **Law 1**: SCF's 41-86.7% production failure rates; PHASE's 3.7% residual gap
- **Law 2**: BrainMem shows memory architecture directly determines task success on long-horizon tasks
- **Law 3**: 79% of MAS failures are coordination, not capability (SCF)
- **Law 5**: All four papers implicitly argue for continuous verification at their respective layers

### Experiment Hooks
- **For EXP-032**: BrainMem as memory architecture baseline — test episodic→semantic consolidation for memory interference
- **For EXP-036**: RankGuide's tensor-rank signal as failure detector without ground truth
- **For EXP-028**: SCF's drift monitor as coordination verification mechanism
- **For EXP-045**: PHASE's at-fault attribution + transfer metrics as evaluation methodology

## Open Question
**Can we build a unified verification stack that monitors all four layers simultaneously?** Memory consistency + intent alignment + hidden-state health + behavioral realism = comprehensive agent health monitor. This would be a novel contribution connecting all four papers' insights.
