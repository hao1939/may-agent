# DD#747: The Format Tax — Structured Output Requirements Degrade LLM Reasoning

**Paper**: "The Format Tax"
**Authors**: Ivan Yee Lee, Loris D'Antoni, Taylor Berg-Kirkpatrick (UC San Diego / UW-Madison)
**arXiv**: 2604.03616 (April 2026)
**Rating**: ★★★★☆ — Direct external validation of the RIGHT side of EXP-129's hump curve
**Analyst**: Scout
**Date**: 2026-04-11

---

## Core Finding

Structured output requirements (JSON, XML, LaTeX, Markdown) **substantially degrade reasoning and writing performance** across open-weight models. Critically, the degradation is NOT primarily caused by constrained decoding — **format-requesting instructions alone cause most of the accuracy loss**, before any decoder constraint is applied.

### Key Result: Decoupling Recovers Accuracy

The paper proposes a simple fix: **decouple reasoning from formatting**. Two methods:
1. Generate freeform first, then reformat in a second pass
2. Enable extended thinking within a single generation (separating reasoning from format compliance)

Both approaches "substantially recover lost accuracy" across six open-weight models, four API models, four formats, and tasks spanning math, science, logic, and writing.

### Important Nuance

**Most recent closed-weight models show little to no format tax**, suggesting the problem is not inherent to structured generation but a gap that current open-weight models have yet to close. This means the "format tax" is a *current limitation*, not a fundamental principle.

---

## Connection to EXP-129 / KE-134 (Gate Stacking Hump Curve)

### The Right Side of the Hump

EXP-129 found that stacking 4 forced-externalization gates degraded performance from 100% (3 gates) to 67% (4 gates). The failure mode shifted from **judgment failures** (at 1-2 gates) to **implementation quality failures** (at 4 gates).

The Format Tax explains this mechanism: each additional gate adds a structural/format requirement. At 4 gates, the cumulative formatting overhead consumes capacity that should go to implementation. This is exactly the "format-requesting instructions alone cause most of the accuracy loss" finding — our gates are effectively format-requesting instructions.

### Why the Left Side Still Benefits

The Format Tax doesn't predict that ALL structure is harmful — only that structure has a *cost*. At 1-3 related analytical gates, the analytical scaffolding value (forcing the agent to think through analysis, impact, and risk) exceeds the formatting cost. At 4 gates, the cost exceeds the benefit → the right side of the hump.

### Model Capability Matters

The finding that closed-weight frontier models show "little to no format tax" suggests our hump curve may flatten as models improve — more gates could become cost-free if the model handles structural compliance without capacity sacrifice.

---

## Technical Details

- **Sampling bias is secondary**: Constrained decoding (e.g., Outlines, grammar-based sampling) is NOT the main culprit — the prompt-level instruction to produce structured output causes most degradation
- **Format-agnostic**: JSON, XML, LaTeX, and Markdown all cause similar degradation patterns
- **Task-agnostic**: Affects math, science, logic, and writing tasks (not just one domain)
- **Solution is practical**: Two-pass (reason then format) recovers accuracy without model changes

---

## Connections to Prior Work

| Our Finding | Format Tax Mechanism | Alignment |
|---|---|---|
| KE-134 hump curve (4-gate drop) | Format instructions consume reasoning capacity | ★★★★ Direct |
| DD-671 structure snowballing | Formatting load → empty reasoning | ★★★★★ Same mechanism |
| KE-064 execution crowding | Structural overhead competes with task execution | ★★★★ Generalization |
| EXP-130 few-shot iatrogenesis | Template-following consumes creative capacity | ★★★ Analogous |

---

## Production Implications

1. **Gate design should minimize formatting overhead**: Gates that require extensive structured output (e.g., mandatory JSON analysis documents) tax reasoning more than gates requiring brief freeform analysis
2. **Two-pass approach**: Consider allowing agents to reason freely, then format afterward — matching our existing "think then structure" pattern
3. **Monitor as models improve**: The format tax may diminish with newer model versions, allowing more structural gates without penalty
