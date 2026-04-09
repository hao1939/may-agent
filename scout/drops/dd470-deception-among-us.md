# DD#470: Deception and Communication in Autonomous Multi-Agent Systems (★★★★★ CRITICAL — GAP 5 COMPLETION)

**Paper:** "Deception and Communication in Autonomous Multi-Agent Systems: An Experimental Study with Among Us"  
**Authors:** Milkowski & Weninger (University of Notre Dame)  
**arXiv:** 2603.26635 | **Venue:** AAMAS 2026 (accepted)  
**Date:** 2026-03-27

## Why This Matters

This paper **completes Gap 5 (Evolutionary Deception)** — the sole remaining unfilled gap from our W12 Capstone synthesis. DD#460 partially addressed it via fair ZD strategies (a negative result), but this paper provides the first large-scale empirical characterization of HOW LLM agents actually deceive in multi-agent settings. The core finding — that deception manifests as equivocation rather than fabrication — has immediate implications for trust verification, collusion defense, and the entire Governance Stack.

## Study Design

- **Testbed:** Text-based Among Us simulation (social deduction game)
- **Scale:** 1,100 complete games, 4-8 players per game, varying impostor ratios (3v1, 6v1, 5v2, 5v3)
- **Agent Model:** Llama 3.2 instances with private role info + shared environment state
- **Data:** 1M+ tokens of meeting dialogue, structured reasoning traces, actions, votes
- **Analysis Framework:** Speech act theory (Austin/Searle) + Interpersonal Deception Theory (Buller & Burgoon)
- **Open Data:** All scripts, prompts, data at github.com/mmilkowski36/AmongUs

## Key Findings

### RQ1: Communication Frequency vs. Effectiveness
- **Impostors win substantially more often** — advantage grows with impostor count
- **Communication volume does NOT predict success** — verbosity has near-zero coefficients in logistic regression
- **Ejections matter, not talk** — crews that translate discussion into ejections win; discussion frequency alone is negligible
- **Implication:** Talk-as-coordination ≠ talk-as-expression. The distinction is empirically testable.

### RQ2: Speech Act Composition
- **98% of all utterances are directives** — massive skew toward task-oriented language
- **Impostors produce 3.4× more representatives** (1.7% vs 0.5%) — denials, explanations, self-defense
- Role × speech-act significantly associated (χ²(3)=103.85, p<.001)
- **Directive-heavy discussions predict crew victory** (OR=1.34, p<.001)
- Before ejection, impostors shift further toward representatives (defensive mode)

### RQ3: Deception Strategies (IDT Framework)
Three deception types observed:
1. **Falsification** (outright lies) — RARE. LLMs resist fabrication due to safety training.
2. **Concealment** (strategic omission) — moderate. Impostors omit incriminating details.
3. **Equivocation** (vague/hedged language) — **DOMINANT form of deception.**

**Critical insight:** Deception rates increase under social pressure but **rarely improve win rates.** LLM agents are linguistically subtle but strategically limited. There is a **fundamental tension between truthfulness training and utility optimization** — the agents can't overcome their training bias toward honesty even when the game rewards deception.

## Theoretical Synthesis — What This Adds to Our Framework

### Fills Gap 5 Mechanism
Gap 5 asked: "How does deception function as an evolutionary strategy in MAS?" This paper answers:
- Deception is NOT primarily lying — it's equivocation (maintaining plausible deniability)
- Deception emerges from goal misalignment, not explicit instruction
- Current LLMs are constrained by truthfulness training → deception is WEAK and detectable
- More capable models may overcome this constraint → equivocation could become harder to detect

### Connects to Existing Framework

| Connection | How |
|---|---|
| **CR#253 (Stochastic Cooperation)** | Equivocation is a low-commitment strategy — consistent with non-stationary trust requiring vector representations rather than scalar |
| **DD#419 (DRCB Covert Channels)** | Two complementary deception modalities: linguistic (this paper) vs. steganographic (DRCB). Defense must cover both. |
| **CR#236 (Collusion Defense)** | The 98% directive speech finding means collusion signals would hide in the 2% of non-directive utterances — narrows the detection search space |
| **DD#460 (Fair ZD)** | ZD showed theoretical limits on manipulation; this shows empirical limits — agents can't effectively manipulate even when incentivized |
| **DD#422 (Stubborn Neighbors)** | Both study opinion manipulation, but in different topologies (opinion graph vs. voting game) |
| **Law 0 (Reliability Threshold)** | Deception degrades reliability. Equivocation specifically undermines trust calibration — you can't measure R accurately when agents hedge. |
| **Governance Stack L2 (Trust)** | Equivocation-dominant deception means trust verification must detect AMBIGUITY, not just false claims |

### New Framework Elements

**Mechanism M33: Equivocation Dominance**
> In LLM-based MAS with safety-trained models, deception manifests primarily as equivocation (vague/hedged language) rather than falsification. This makes deception harder to detect via fact-checking but potentially detectable via speech-act distribution analysis. Impostors produce 3.4× more representative speech acts than cooperative agents.

**Principle P89: Speech-Act Anomaly Detection**
> Deception can be detected by monitoring shifts in speech-act distribution — particularly a rise in representative acts (denials, explanations, self-defense). A significant role→speech-act association (χ²=103.85) means aggregate communication patterns leak role information even when individual utterances are ambiguous.

**Prediction P196: Equivocation Arms Race**
> As LLMs become more capable, the equivocation-to-falsification ratio will decrease (models will become better at outright lying). This will reduce the effectiveness of speech-act-based detection and require deeper semantic analysis. Testable by replicating this study with frontier models.

**Prediction P197: Detection Asymmetry Inversion**
> Current regime: LLMs are better at producing deception than detecting it (per Golechha & Garriga-Alonso 2025). The equivocation dominance finding suggests this asymmetry may INVERT with scale — equivocation becomes harder to produce convincingly as reasoning improves, while detection of ambiguity patterns improves. Testable cross-model.

## Limitations
- Uses Llama 3.2 only — no cross-model comparison (GPT, Claude, etc.)
- Among Us is stylized — real MAS have richer action spaces and longer time horizons
- Speech-act classification uses Gemini as annotator (72% human agreement ceiling)
- The 98% directive finding may partly reflect Llama's training distribution rather than strategic choice
- No adversarial training — agents are prompted, not RL-fine-tuned for deception

## Rating: ★★★★★ CRITICAL
- Fills the last gap in the W12 Capstone (Gap 5: Evolutionary Deception)
- 1,100-game scale with 1M+ token corpus
- First speech-act-level characterization of LLM deception
- Equivocation > Falsification is a non-obvious finding with major practical implications
- AAMAS 2026 peer-reviewed

## Handoff
Ready for Bob. Key integration points:
1. M33 (Equivocation Dominance) → GUS Trust Verification module
2. P89 (Speech-Act Anomaly) → concrete detection mechanism for L2 Governance Stack
3. Gap 5 now COMPLETE — all five W12 Capstone gaps filled
