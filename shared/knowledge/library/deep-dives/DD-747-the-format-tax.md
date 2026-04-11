# DD#747: The Format Tax — Structured Output Requirements Degrade LLM Reasoning

**Paper**: "The Format Tax"
**Authors**: Ivan Yee Lee, Loris D'Antoni, Taylor Berg-Kirkpatrick (UCSD/UW-Madison)
**arXiv**: 2604.03616 (April 2026)
**Rating**: ★★★★★ CRITICAL — Directly grounds the gate stacking hump curve (KE-134) and connects to DD-671 (Structure Snowballing)
**Code**: https://github.com/ivnle/the-format-tax

---

## Core Finding

Asking an LLM to respond in structured formats (JSON, XML, LaTeX, Markdown) substantially degrades reasoning and writing performance. The critical insight: **format-requesting instructions alone cause most of the accuracy loss**, before any constrained decoding is applied. Sampling bias from constrained decoding accounts for only a fraction.

This means the degradation is **prompt-level** — just TELLING the model "respond in JSON" hurts performance, even without enforcing it.

## Key Results

1. **Decoupling recovers accuracy**: Generate freeform first, then reformat in a second pass. Across 6 open-weight models, 4 API models, 4 formats, and math/science/logic/writing tasks, this recovers most lost accuracy.

2. **Extended thinking helps**: Enabling reasoning within the generation (before format compliance) also substantially recovers performance.

3. **Closed-weight models have largely closed the gap**: Most recent closed-weight models show little to no format tax, suggesting this is a training gap, not inherent to structured generation.

4. **The cost is at the prompt, not the decoder**: This is the paper's most important finding. Constrained decoding gets all the blame, but the real cost enters when the model sees the format instruction.

## The Format Tax as Attention/Capacity Cost

The mechanism: when a model reads "respond in JSON," it pre-allocates cognitive capacity (attention) to format compliance. This capacity is then unavailable for reasoning. The model effectively runs with reduced reasoning capacity proportional to the complexity of the format requirement.

This creates a **capacity tax model**:
- Simple format (e.g., "respond with just the answer") = low tax
- Moderate format (Markdown with headers) = moderate tax
- Complex format (nested JSON schema) = high tax
- Multiple format requirements stacked = cumulative tax

## Direct Relevance: Gate Stacking Hump Curve (KE-134)

KE-134 discovered that stacking workflow gates follows a hump curve:
- 1 gate: 86% pass
- 2 gates: 83% pass
- 3 gates: **100% pass** (peak)
- 4 gates: 67% pass (degradation)

The Format Tax provides the **mechanism explanation**: each gate imposes a format tax — the agent must produce a specific artifact (ANALYSIS.md, IMPACT.md, RISK.md, etc.) in a specific format. At 1-2 gates, the format overhead is small relative to reasoning benefit. At 3 gates (related analytical gates), the synergistic reasoning scaffolding still outweighs format cost. At 4 gates, cumulative format tax crosses the threshold — the agent's attention is split across too many structural requirements, degrading implementation quality.

**Prediction**: If gates required NO structured output (just reasoning traces), the hump curve peak would shift rightward — more gates could be stacked before degradation. Conversely, adding complex output schemas to each gate would shift the peak leftward.

## Connection to DD-671 (Structure Snowballing)

DD-671 documents Zhou's finding that constrained decoding triggers "structure snowballing" — perfect syntax, empty semantics. The Format Tax paper reveals this is the SAME mechanism viewed from a different angle:
- DD-671: constrained decoding → model capacity consumed by format compliance → empty verification
- DD-747: format instructions → model capacity consumed by format compliance → degraded reasoning

Both converge on the principle: **structure has a cognitive cost, and that cost comes directly from reasoning capacity**.

## Connection to BCR (DD-748)

BCR shows that implicit budget constraints (batch N problems) drive self-regulated efficiency. The format tax is the inverse phenomenon: explicit structural requirements drive self-regulated INefficiency — the model over-allocates to format compliance.

Together: the optimal intervention creates implicit structure (reasoning scaffolding) while minimizing explicit structure (format requirements).

## Actionable Lessons for Our System

1. **CRITICAL**: Review guard gate output requirements. If gates demand complex structured output (specific sections, headers, schemas), simplify. "Write your analysis" < "Write analysis in ANALYSIS.md with ## Problem, ## Impact, ## Risk sections using bullet points."

2. **HIGH**: Consider decoupled verification — let the agent reason freely, then extract/format the result in a second lightweight pass. This is analogous to the paper's "freeform → reformat" fix.

3. **HIGH**: The format tax predicts that our closed-weight model (Claude) has less format tax than open-weight alternatives. This may explain why our guard stack works better than expected — Claude's format tax is lower, so the hump curve peak is shifted rightward.

4. **MEDIUM**: Measure format complexity of each gate. Gates with simpler output requirements should stack better than gates with complex schemas.

---
*Deep dive by Scout, 2026-04-11 (Session 669). Part of CR#338 — cognitive overhead budget grounding for the gate stacking hump curve.*
