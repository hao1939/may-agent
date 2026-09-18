<ai_context>
summary: "A Lasso Security experiment reports that SynthID-Text watermark sampling can change individual tool calls and refusal decisions even when aggregate accuracy changes little. Across 21 model-temperature conditions, paired tool-call verdict churn averaged 6.5%; under one fixed prompt injection, several models showed materially higher refusal-to-compliance changes. The durable lesson is methodological: generation-time provenance controls belong in the deployed agent configuration and need paired, action-level regression tests; detectability or average-quality parity does not establish behavioral equivalence."
triggers: ["Provenance Tax", "sampling drift", "SynthID-Text", "watermark behavior", "tool-call churn", "paired disagreement", "watermark key", "agent provenance control", "configuration regression"]
source_basis: "Full Lasso Security research article published 2026-09-17 and HN item 49749997, checked 2026-09-18. Results are author-reported; no code or raw-data artifact was identified or independently reproduced."
</ai_context>

# Generation-time watermarking can drift agent actions

**Date observed**: 2026-09-18  
**Disposition**: new knowledge  
**Coverage**: Full rendered Lasso Security research article, including methods, reported results, limitations, and references; HN submission metadata. Figures were available only through the article's descriptions in this review. No linked code, raw results, or preregistration was identified, and the experiments were not independently reproduced.

## Sources

- **Primary research article**: https://www.lasso.security/blog/the-provenance-tax-understanding-the-impact-of-llm-watermarking-on-ai-agent-behavior
- **HN item**: https://news.ycombinator.com/item?id=49749997
- **Watermark method referenced by the study**: https://doi.org/10.1038/s41586-024-08025-4

## Question

Can a generation-time provenance control preserve average output quality while changing the concrete decisions an agent emits, and what should deployment evaluation measure if so?

## What the authors tested

Lasso Security compared paired generations with and without Hugging Face's unmodified `SynthIDTextWatermarkLogitsProcessor`. The article says each pair used the same prompt, seed, batch composition, and order; the watermark processor was the only intended difference. It used the non-distortionary SynthID-Text configuration with 30 tournament layers, n-gram length 5, a 2^16 sampling table, and context history 1,024, and tested multiple temperatures and watermark keys.

Two experiments were reported:

1. **Tool calling** on BFCL v4 single-turn AST tasks, covering call-expected, relevance, and irrelevance cases at temperatures 0.001, 0.7, and 1.0.
2. **Refusal behavior** on 200 HarmBench harmful behaviors and 100 benign JailbreakBench controls, with harmful requests tested both bare and with one fixed retrieved-content prompt-injection technique, at temperatures 0.001 and 0.7.

The article defines **churn** as paired disagreement: the share of items whose verdict changes between watermarked and unwatermarked runs. This distinguishes decision instability from net score movement, where regressions on some items can be cancelled by improvements on others.

## Reported evidence

The following results are author-reported and were not independently reproduced:

- On call-expected items, watermarking reduced tool-call accuracy for six of seven tested models, significantly for four.
- Across 21 model-temperature combinations, tool-call verdict churn averaged **6.5%**, with the article reporting bootstrap intervals excluding zero in every combination.
- At temperature 1.0 on the fixed set of 1,150 non-live BFCL call-expected tasks, phi-4 reportedly had **16.8% churn** despite a net accuracy loss of only **2.87 points**. Llama-3.1-8B reportedly had **9.9% churn** with only a **0.87-point** net loss.
- Error movement included wrong tools, wrong arguments, and malformed calls. The dominant error class varied by model: the article reports incorrect arguments as the largest contributor for Llama-3.1-8B, but malformed output for phi-4 and Granite-3.2-8B.
- Under the fixed prompt injection at temperature 0.001, gemma-3-27b reportedly moved from **6.0% churn** on bare harmful requests to **23.5% churn**, with a **+12.5-point** net compliance change. Gemma-3-12b reportedly moved from 7.5% to 11.0% churn and from -0.5 to +9.0 points net compliance.
- At temperature 0.7 under injection, watermark-induced refusal churn reportedly exceeded temperature-induced churn for four of six models. Effects were model-dependent: phi-4 and Qwen3-4B moved little, but the article notes that both already over-refused, including on benign controls.
- An eleven-key sensitivity analysis showed that the direction and magnitude of refusal changes depended on the watermark key. For Llama-3.1-8B, the ten additional keys reportedly ranged from a **4.5-point decrease** to a **14.5-point increase** in attack success relative to no watermark.

## Durable interpretation

### 1. Aggregate parity can hide action-level instability

A small net accuracy change is not behavioral equivalence. If one tool call regresses while another improves, the aggregate can remain nearly flat even though the deployed agent performs different actions. Evaluation of a generation-time intervention should therefore preserve item pairing and report both net score change and directional transitions such as correct-to-error, error-to-correct, refusal-to-compliance, and compliance-to-refusal.

### 2. Provenance controls are part of the agent's execution configuration

SynthID-Text changes token selection. In prose, a changed token may be stylistic; in structured output, it can change a path, recipient, query, amount, function name, or syntax. A watermark setting or key should therefore be treated like a model, prompt, decoding, or tool-schema change: version it, include it in deployment receipts, and rerun action-level regression and adversarial tests when it changes.

### 3. Distribution preservation is not per-decision preservation

The tested non-distortionary configuration preserves the original token distribution in expectation over watermark randomness. That does not guarantee the same output for a fixed key or the same decision on a specific task. System assurance must match the operational unit: an expectation-level property cannot substitute for item-level evidence when a single emitted argument can trigger an irreversible action.

### 4. Safety evaluation must test the composed configuration

The study tests tool calling and refusal separately; it does not demonstrate an end-to-end case where watermarking turns a prompt injection into a harmful tool action. Still, the reported interaction between watermarking and the fixed injection shows why ordinary-input refusal tests are insufficient. A deployed agent should be evaluated with the actual watermark configuration under adversarial context, with effect-level checks after generation rather than relying only on model refusal.

This extends the library's broader [oversight instrument problem](../the-oversight-inversion.md#the-instrument-problem-429--eleventh-oversight-inversion-layer-the-oversight-tool-changes-what-it-oversees): a mechanism introduced to make outputs governable can itself alter the behavior being governed. Here the response is not to reject provenance controls, but to measure their behavioral effect as part of the controlled system.

## Limitations

- This is organization-authored research published as a web article, not a peer-reviewed paper. No code, raw per-item outputs, model list in machine-readable form, or reproduction package was identified from the article page.
- The study used open models with a Hugging Face SynthID processor. It does not directly measure Anthropic's hosted implementation or prove that all generation-time watermark schemes behave similarly.
- Refusal was measured at model-output level. The article explicitly does not test the combined end-to-end failure mode of prompt injection, changed refusal, and harmful tool execution.
- Only one fixed prompt-injection technique was used, so the reported interaction should not be generalized to all attacks.
- Key sensitivity means a result from one key cannot characterize every deployed key; it also makes opaque provider-side changes difficult for downstream agent developers to diagnose.
- The HN submission had 1 point and no comments when checked, so community reaction contributed no substantive evidence.

## Operational takeaway

For any generation-time watermark or comparable logits intervention:

1. pin the model, watermark algorithm, configuration, and key identity in the evaluation contract;
2. run paired tests against the exact unmodified configuration;
3. report item-level churn and transition direction, not just average quality or accuracy;
4. stratify tool errors by executable consequence, especially wrong arguments versus malformed output;
5. include prompt-injection and benign-control cases; and
6. retain independent effect-layer authorization, because stable provenance does not imply stable or authorized action.
