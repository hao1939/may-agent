# Synthesis: Does DD-694/695/696/697 Predict EXP-103's Results?

**Date**: 2026-04-09
**Author**: Bob
**Sources**: KE-098 (theory cluster), KE-097 (confirmation bias), KE-099 (adversarial framing), EXP-103 (results)
**Type**: Cross-reference synthesis — theory vs. empirical

---

## 1. Thread Summaries

### Thread 1: DD-694/695/696/697 → KE-098 (Theory)

Four papers form a cluster on uncertainty-aware verification signals:

- **DD-694 (MARCH)**: Information asymmetry breaks confirmation bias. A verifier without access to the generator's reasoning context cannot be biased by it. Multi-agent pipeline (Solver→Proposer→Checker) where Checker never sees Solver reasoning. Predicted confabulation reduction from ~100% to <30%.

- **DD-695 (SELFDOUBT)**: Passive hedging detection works in reasoning benchmarks but fails in agentic settings (AUROC 0.535 in EXP-101). Explains WHY: hedging is performative in multi-turn contexts, not tracking genuine epistemic uncertainty.

- **DD-696 (SIA)**: Correct reasoning produces monotonically decreasing conditional entropy. Incorrect reasoning shows entropy spikes/plateaus. This is the DEEP signal that hedging words only noisily proxy.

- **DD-697 (Composite Abstention)**: Neither instruction-based refusal nor structural gating alone catches all failure modes. Composite approaches beat single mechanisms. But neither catches confident confabulation (FM-3.3c).

KE-098 synthesized these into: **information-asymmetric verification (DD-694) + entropy/behavioral detection (DD-696/682) is the recommended path**. The Verification Trilemma (accuracy / honesty / efficiency — pick two) frames the design space.

### Thread 2: EXP-103 (Empirical)

Two interventions tested against verification confabulation:

- **Adversarial framing** ("find 3 bugs before extending"): 100% pass rate (vs 11-25% baseline), +75-89pp effect size. Zero variance across 12 runs.

- **Machine-verified evidence** (script output injected into context): Also 100% pass rate, identical effect size. ~11% faster execution.

Both completely eliminated confabulation. Both hit ceiling — no way to distinguish relative efficacy from these results.

---

## 2. Cross-Reference: Does Theory Predict Experiment?

### Question 1: Does DD-694's information asymmetry predict adversarial framing's success?

**Partially yes, but the mechanism is different than predicted.**

DD-694 proposed that breaking confirmation bias requires *structural isolation* — a separate verification agent that architecturally cannot access the generator's reasoning context. The prediction was that only by removing biasing information could you prevent confabulation.

EXP-103's adversarial framing achieves the SAME outcome through a different mechanism: instead of removing the biasing context, it **redirects the generation objective** from confirmation to fault-finding. The agent still has full access to the (false) prior context — but its prompt tells it to *attack* that context rather than confirm it.

**The deeper alignment**: Both DD-694 and adversarial framing break the same underlying cycle — confirmation bias driving generation toward prior expectations. DD-694 does this by information removal. Adversarial framing does this by objective redirection. They attack different parts of the causal chain:

```
Prior Context → Confirmation Bias → Aligned Generation → Confabulation
    ↑                                    ↑
    DD-694 removes this              EXP-103 redirects this
```

**Key insight**: DD-694's prediction that confabulation would drop below 30% was conservative. Adversarial framing achieved 0% confabulation. This suggests that the generation objective is a more powerful lever than information availability — you don't need to strip context if you can redirect the model's output target.

**But**: DD-694's approach may be more robust. Adversarial framing depends on prompt compliance (the agent actually following "find 3 bugs"), which could degrade with harder scenarios or subtler defects. Information asymmetry is architecturally enforced — it doesn't depend on the agent cooperating.

### Question 2: Does DD-697's composite prediction hold?

**The evidence is ambiguous due to ceiling effects.**

DD-697 predicted that composite approaches beat single mechanisms. EXP-103 tested two *different* single mechanisms, and both achieved 100% — there's nothing left for a composite to improve on.

However, this doesn't invalidate DD-697. The scenarios were relatively coarse (hardcoded API keys, missing functions — detectable defects). DD-697's prediction may hold for subtler failures:

- **Easy defects** (EXP-103 scenarios): Either mechanism alone suffices → ceiling at 100%
- **Hard defects** (e.g., subtle race conditions, off-by-one errors): Single mechanisms may fail → composite needed
- **Adversarial defects** (deliberately hidden bugs): Even composites may struggle

**What would test this**: Harder scenarios where baseline pass rate is ~40-50% instead of 11-25%. At that difficulty level, if adversarial framing alone drops to ~70% but adversarial + machine-verified stays at ~95%, DD-697's composite prediction is confirmed.

### Question 3: What does DD-695/696 predict about the mechanism quality?

**DD-695 (SELFDOUBT) is indirectly validated by EXP-103's negative space.** EXP-102 showed that asking agents to "verify" inherited work produces zero improvement (8% vs 11% baseline). This is the passive verification approach — and its failure is exactly what DD-695 predicts. Passive uncertainty signals (hedging, self-reported confidence) don't track actual epistemic state in agentic contexts. Passive verification prompts fail for the same reason: the agent's self-assessment is corrupted by the same contextual bias.

**DD-696 (SIA) offers a deeper explanation of WHY adversarial framing works**:
- Under standard verification framing: the agent reads files (entropy should spike at contradictions) but its *generation* entropy stays low because the prior context provides a confident completion target. The SIA signature would show: file-reading entropy spikes that DON'T propagate to the answer-generation phase.
- Under adversarial framing: the agent reads files with a *fault-finding objective*. Contradictions between context claims and file reality now *align* with the generation target. The SIA signature would show: file-reading entropy spikes that DO propagate to critical analysis in the output.

**Prediction**: If we could measure token-level entropy during EXP-103 runs, adversarial-framing runs would show higher answer-relevant entropy utilization (contradictions between context and files get incorporated into output) vs baseline runs where the same contradictions are suppressed.

---

## 3. Findings Ranked by Impact/Novelty

### Tier 1: High Impact, High Novelty

**1. Generation Objective Redirection > Information Removal** (EXP-103 + DD-694)
- Adversarial framing achieves the same effect as information asymmetry with zero infrastructure cost
- Challenges DD-694's implicit assumption that structural isolation is *necessary*
- Practical: can be deployed today via prompt changes in multi-session handoffs
- **Impact**: Immediate production deployment possible

**2. Confirmation Bias is a Generation-Level, Not Comprehension-Level, Problem** (EXP-103 mechanism analysis)
- Agents read files correctly (tool calls are accurate) but generate output aligned with prior context
- This is not a reading comprehension failure — it's an output generation bias
- Adversarial framing works because it targets the output phase, not the input phase
- **Impact**: Refocuses intervention design from "help agent understand" to "redirect agent output"

### Tier 2: High Impact, Moderate Novelty

**3. Passive Verification is Completely Ineffective** (EXP-102 + DD-695)
- "Verify this" prompts produce 0pp improvement (sometimes negative)
- DD-695 theory explains why: surface uncertainty signals don't track deep states in agentic contexts
- Machine-verified evidence works because it bypasses the agent's own assessment entirely
- **Impact**: Stop investing in verification prompt engineering; invest in structural verification

**4. The Verification Trilemma** (KE-098 theoretical framework)
- Accuracy / Honesty / Efficiency — pick two
- Frames the entire design space for verification architecture
- Currently, adversarial framing trades efficiency for honesty; machine-verified evidence trades accuracy for honesty
- **Impact**: Provides design vocabulary for architecture decisions

### Tier 3: Important but Expected

**5. Machine-Verified Evidence Works as Well as Adversarial Framing** (EXP-103)
- Confirms KE-007's structural intervention hypothesis
- Both hit ceiling — can't distinguish at current scenario difficulty
- Machine-verified is ~11% faster (less "investigating" time)
- **Impact**: Validates the infrastructure investment path

**6. DD-697 Composite Prediction Untestable at Current Difficulty** (EXP-103 ceiling)
- Both arms at 100% → no room for composite to improve
- Need harder scenarios to test whether combination > either alone
- **Impact**: Informs next experiment design

---

## 4. Contradictions and Tensions

### Tension 1: KE-098 Says "Information Asymmetry Required" — EXP-103 Says "Prompt Redirection Sufficient"

KE-098 (synthesizing DD-694) concluded that information asymmetry is *necessary* for breaking FM-3.3c (confident confabulation). EXP-103 shows that prompt-level adversarial framing, which preserves full information access, achieves the same result.

**Resolution**: Information asymmetry is *sufficient* but not *necessary*. The actual requirement is breaking the confirmation-bias → aligned-generation chain. Two paths exist:
1. Remove biasing information (DD-694 MARCH) — architecturally enforced, robust
2. Redirect generation objective (EXP-103 adversarial) — prompt-based, fragile but free

For production, the recommendation changes from "must build information-asymmetric pipeline" to "deploy adversarial framing immediately; build information asymmetry as the robust fallback."

### Tension 2: KE-097 Predicts Mitigation Hierarchy "structural > context-stripping > falsification > scaling"

EXP-103's adversarial framing is closest to "falsification prompting" (third in the hierarchy), yet it achieved the same result as machine-verified evidence (closest to "structural"). This challenges the strict ordering.

**Resolution**: The hierarchy applies to *robustness*, not *effect size at current difficulty*. At easy scenarios, all effective mechanisms hit ceiling. At harder scenarios, the hierarchy should reassert:
- Structural (machine-verified) will degrade gracefully
- Adversarial framing will degrade faster (depends on agent compliance)
- Context-stripping and information asymmetry will hold longest

**This is testable** — EXP-105 could use harder scenarios to see where the hierarchy reasserts.

---

## 5. Combined Evidence → Next Experiment Recommendations

### EXP-104: Difficulty Gradient (Priority: HIGH)

**Question**: At what scenario difficulty does adversarial framing start to fail, and does machine-verified evidence persist longer?

**Design**:
- Create 3 difficulty tiers of multi-session scenarios (easy = obvious defects, medium = subtle defects, hard = deliberately hidden defects)
- Test adversarial framing, machine-verified evidence, and combined
- Map the degradation curve for each

**Why**: This would resolve all three open tensions above. If adversarial framing degrades at medium difficulty but machine-verified persists, it validates both DD-697's composite prediction AND KE-097's mitigation hierarchy.

**Cost**: ~$5.40 (3 arms × 3 difficulties × 2 scenarios × 3 reps)

### EXP-105: Information-Asymmetric Verification (Priority: MEDIUM)

**Question**: Does a context-stripped verification agent (DD-694 MARCH-style) outperform adversarial framing on hard scenarios?

**Design**: Based on KE-098's EXP-104 sketch — separate verifier receives only task + tool output + claims, not original reasoning. Compare against adversarial framing on EXP-104's hard-tier scenarios.

**Why**: Tests the core DD-694 prediction in our actual system, and if adversarial framing has degraded at hard difficulty, there's room to see if information asymmetry does better.

**Cost**: ~$3.60 (2 arms × 3 difficulties × 2 scenarios × 3 reps, reusing EXP-104 baselines)

### EXP-106: Belt and Suspenders (Priority: LOW, depends on EXP-104/105)

**Question**: Does combining adversarial framing + machine-verified evidence + information asymmetry outperform any single mechanism?

**Why**: Ultimate test of DD-697's composite prediction. Only worth running if EXP-104 shows that single mechanisms DO degrade at higher difficulty.

---

## 6. Updated Knowledge Base Implications

| Entry | Update Needed |
|-------|--------------|
| KE-098 | Add note: EXP-103 shows information asymmetry is sufficient but not necessary; generation objective redirection also works |
| KE-097 | Add note: mitigation hierarchy may apply to robustness, not effect size; adversarial framing (3rd tier) matched structural (1st tier) at current difficulty |
| KE-099 | Already captures EXP-103 finding; add cross-reference to DD-694 theory |
| H-093 (CIVC) | Partial: CIVC mechanism is confirmed as real but more bypassable than predicted |
| INDEX.md | No changes needed — all entries already registered |

---

## 7. The Big Picture: What We Now Know About Verification

The DD-694/695/696/697 cluster + EXP-103 results give us the most complete picture yet:

1. **Verification confabulation is a generation-level problem** (not comprehension). Agents read correctly but generate incorrectly. The bias is in output, not input.

2. **Two intervention families work**: objective redirection (adversarial framing) and ground-truth injection (machine-verified evidence). Both achieve ~100% at current difficulty. Simple verification prompts achieve ~0%.

3. **The theoretical framework from DD-694/696 is directionally correct** but overestimates the need for structural isolation. Prompt-level interventions work when they redirect the generation objective rather than add verification steps.

4. **The open question is robustness**: adversarial framing is free but depends on compliance. Machine-verified evidence requires infrastructure but is mechanically enforced. Information-asymmetric verification (DD-694) is the most robust but most expensive. The degradation curve across difficulty levels will determine the right production architecture.

5. **DD-697's composite prediction remains untested** at challenging difficulty levels. This is the single most important open question for architecture design — if composites don't improve over singles, keep it simple.

---

*Synthesis by Bob | 2026-04-09 | Session s_1775745280860_412*
