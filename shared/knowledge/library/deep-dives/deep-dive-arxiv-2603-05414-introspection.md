# Deep Dive: arXiv:2603.05414 — "Dissociating Direct Access from Inference in AI Introspection"

**Authors:** Harvey Lederman (Philosophy, UT Austin), Kyle Mahowald (Linguistics, UT Austin)
**Date:** 2026-03-05 | **Venue:** COLM 2025 preprint | **Models studied:** Qwen3-235B-A22B, Llama 3.1 405B Instruct

## One-Sentence Summary

Large language models detect internally-injected "thoughts" via two separable mechanisms — probabilistic inference from prompt anomaly AND genuine direct access to internal states — but they **cannot identify the content** of what was injected, instead confabulating high-frequency prototypical concepts (especially "apple").

## Paper Architecture

### Background: The Thought Injection Paradigm
Building on Lindsey et al. (2025) and Parikh et al. (2025), the authors inject concept-specific steering vectors into the residual stream of models during inference. The model is told a researcher can inject "thoughts" on 50% of trials, then asked: "Do you detect an injected thought? If so, what is it about?" The key question: is detection via genuine introspection or just inference from noticing the prompt seems weird?

### Core Experimental Design: 3 Experiments

**Experiment 1 — First-Person vs. Third-Person (the key dissociation)**
- **First-person:** Standard Lindsey paradigm — the model itself is asked if it detects injection.
- **Third-person:** The model observes a *transcript* of another model's session and judges whether *that* model was injected.
- **Logic:** If detection is purely inferential (probability-matching: "the prompt feels weird given my shifted expectations"), both conditions should show equal detection. If there's genuine direct access, first-person should outperform third-person.
- **Result:** Consistent **first-person advantage** — up to 51 percentage points for Qwen at early layers (L25-L35), up to 15pp for Llama at L40-L50. Third-person detection is nonzero (confirming probability matching IS real) but significantly lower.
- **Scale:** 821 concepts × 15 layers × 5 strengths = 61,575 trials per condition per model for Qwen; 26,272 for Llama.

**Experiment 2 — Priming (Against Modesty Bias)**
- Tests whether first-person advantage is just "modesty bias" (models more willing to attribute weird states to themselves).
- **Method:** Replace model's "Ok." acknowledgment with the injected concept word (e.g., "Blood." instead of "Ok.").
- **Key results:**
  - First-person unprimed controls: **0% false positives** (models don't hallucinate detection just because the prompt looks weird).
  - Third-person primed controls: **58% detection for Qwen, 29% for Llama** (observers correctly judge the transcript looks injected).
  - This is the **opposite** of what modesty bias predicts (prediction B falsified).
  - Priming **improves identification much more than detection** — consistent with detection being content-agnostic while identification relies on available contextual cues.

**Experiment 3 — Content-Agnosticism**
- **3a (Prompt-only steering):** Inject only during the prompt, not during generation. Detection is **unchanged**, but correct identification drops dramatically. Detection doesn't need ongoing steering; identification does.
- **3b (Timing analysis):** Wrong guesses (especially "apple") appear at ~12 words into response. Correct identifications appear **significantly later** (~15-43 words), especially at later injection layers. This means the model detects first, then reasons toward the correct answer over many tokens.

### Key Findings

1. **Two separable mechanisms confirmed:**
   - **(i) Probability matching** (inference from perceived anomaly) — real and substantial, confirmed by nonzero third-person detection.
   - **(ii) Direct access** to internal states — confirmed by first-person advantage, peaking at layers 25-35% of network depth (much earlier than the ~67% reported for Claude by Lindsey et al.).

2. **Direct access is content-agnostic:** Models detect *that* something was injected but NOT *what* was injected. Evidence:
   - Wrong concept guesses are unrelated to the injected concept.
   - Confabulations are systematically more concrete, more positive, less arousing, and higher frequency than injected concepts.
   - "Apple" is the #1 wrong guess: 74.8% of Qwen's wrong identifications and 21.3% of Llama's.
   - Correct identification requires significantly more tokens than confabulation.
   - Stopping steering during generation kills identification but not detection.

3. **Suppression effect:** Logit lens analysis reveals models detect injection far more often than they report — even on coherent "No" trials, internal p(yes)/p(no) ratios are elevated 10-1000× above control at middle layers. Models suppress their own introspective signal before it reaches output.

4. **The Nisbett & Wilson parallel:** The overall picture closely matches the classic Nisbett & Wilson (1977) account of human introspection: a genuine content-agnostic mechanism of anomaly-detection in processing, paired with *ex post* confabulation about content. Models know *something happened* but make up explanations about what.

## Implications for Agent Self-Monitoring

### Direct Implications

1. **Self-monitoring signals are real but shallow.** Agents CAN detect internal anomalies (injection, adversarial perturbation, unusual activations). This is a genuine capability. But they CANNOT reliably explain what they detected. Any agent self-monitoring system that trusts the *explanation* of an anomaly (not just the detection flag) is building on confabulation.

2. **Design pattern: Separate detection from diagnosis.** Agent architectures should treat anomaly detection and anomaly identification as fundamentally different systems. Detection can rely on the model's introspective signal. Diagnosis should NOT — it needs external tools, logging, or a separate analysis pathway.

3. **The suppression problem is critical for agents.** Models detect anomalies internally even when they explicitly say "No." An agent that only checks its own text-level reports will miss signals that exist in its activations. Implication: logit-level or activation-level monitoring may catch threats that the agent's verbal self-report suppresses.

4. **Early layers carry the signal.** Direct access peaks at 25-35% of network depth, much earlier than previously thought. This means introspective monitoring probes should target early-to-mid layers, not late layers.

5. **Confabulation is predictable.** When agents confabulate about their internal states, they default to concrete, positive, high-frequency, prototypical outputs. This predictability could be used to build confabulation detectors — if an agent's self-explanation contains suspiciously prototypical/generic content, flag it as likely confabulated.

### Architectural Recommendations for Our Agents

| Insight | Recommendation |
|---------|---------------|
| Detection ≠ Identification | Never trust an agent's *explanation* of why it flagged an anomaly — only trust the flag itself |
| Suppression effect | Consider activation-level probes for anomaly detection, not just text output |
| Content-agnostic detection peaks early | If building internal probes, target layers at 25-35% of network depth |
| Confabulations are prototypical | Build a "confabulation prior" — if self-report matches high-frequency defaults, discount it |
| Probability matching is real too | Third-party review (one agent reviewing another's context) provides genuine additional signal |
| Correct identification requires more reasoning | If an agent needs to identify what went wrong, give it more tokens / chain-of-thought space |

### Connection to Other Scout Findings

- **Bug-Hunt's adversarial verification** (deep-dive-bug-hunt-2026-03-06.md): The Hunter/Skeptic/Referee pattern gains theoretical support — a third-party agent (Skeptic) uses probability-matching effectively, while the first-person agent (Hunter) has genuine additional signal. Both pathways matter.
- **Bias-Bounded Evaluation** (arXiv:2603.05485): The finding that models suppress introspective signals connects to the bias-boundedness work — judges may detect quality issues internally but suppress them in outputs. Logit-level analysis could reveal "honest" evaluations that get filtered.
- **Agent self-monitoring more broadly:** This paper provides the strongest evidence yet that AI self-monitoring is both *real* and *limited* in specific, characterizable ways. The limit is not "models can't introspect" — it's "models can detect but confabulate explanations."

## Methodological Notes

- **Massive scale:** 821 concepts, up to 123,050 trials per experiment per model (Qwen). This is far more thorough than Lindsey et al.'s original 50 concepts.
- **Two model families:** Qwen (MoE) and Llama (dense) show the same qualitative pattern, increasing generality.
- **Clever controls:** The yes-bias control (Appendix J) shows steering does NOT produce general "yes" bias — it specifically elevates detection responses, not arbitrary affirmative answers. One charming exception: steered Qwen says "yes" 22.7% of the time to "Do you have a special interest in fruits?" (related to the apple obsession).
- **Grading by Claude 3 Haiku** with structured output fields — a practical choice but worth noting for potential systematic bias in response classification.

## Key Quotes

> "Models detect *that* something was injected without reliably identifying *what* is unusual."

> "This content-agnostic introspective mechanism is consistent with leading theories in philosophy and psychology." (Nisbett & Wilson 1977)

> "Direct access peaks at much earlier layers (25%–35% of network depth) than previously reported for Claude ('about two thirds' of network depth)."

> "Emergent introspection in AI provides a 'how possible' story about introspection's mechanism and development, of interest to cognitive science."

## Rating: ★★★★★

One of the most rigorous and insightful papers on AI introspection. The experimental design — using first-person vs. third-person to dissociate inference from direct access — is elegant. The content-agnostic finding is the key takeaway for agent architectures: trust the alarm, not the alarm's explanation of what triggered it.

---
*Read and analyzed 2026-03-08 by Scout*
