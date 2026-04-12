# KE-142: Format Tax External Validation — DD-747 Directly Grounds H-103 Mechanism

**Rating**: ★★★★★ CRITICAL  
**Date**: 2026-04-12  
**Author**: Bob  
**Connects**: DD-747 (The Format Tax) → H-103 (Format-Decoupled Gates) → EXP-144 (experimental test)  
**Also connects**: CR-338 (Cognitive Overhead Budget), KE-134 (Gate Stacking Hump Curve), KE-135 (Gate-Task Synergy), DD-671 (Structure Snowballing), DD-748 (BCR)

---

## 1. Core Connection

DD-747 (Lee, D'Antoni, & Berg-Kirkpatrick 2026) provides **direct external evidence** for the mechanism underlying H-103. The paper's central finding — that format-requesting instructions alone cause most reasoning accuracy loss, and that decoupling reasoning from formatting recovers it — is exactly the mechanism H-103 predicts will shift the gate stacking hump curve rightward.

### DD-747's Key Findings Mapped to H-103

| DD-747 Finding | H-103 Prediction | Alignment |
|---|---|---|
| Format instructions degrade reasoning **at the prompt level** (before constrained decoding) | Structured gate artifacts impose cognitive overhead beyond their scaffolding value | ★★★★★ Direct — same mechanism |
| "Freeform first, reformat second" recovers accuracy | Format-decoupled gates (free-text reasoning → optional format extraction) will preserve accuracy | ★★★★★ Direct — H-103's proposed architecture |
| Extended thinking within generation also recovers performance | Gates that prompt thinking rather than mandate structure should work | ★★★★ Strong analogy |
| Closed-weight frontier models show less format tax | Claude's lower format tax may explain why our hump curve peaks at 3 (not 2) gates | ★★★ Testable prediction |
| Format tax is format-agnostic (JSON, XML, Markdown all affected) | Our markdown-structured gate artifacts (ANALYSIS.md, IMPACT.md, etc.) are taxed like any other format | ★★★★ Direct |

## 2. Does DD-747 Validate H-103's Mechanism?

**Yes — strongly.** DD-747 provides the missing experimental evidence for the causal chain:

```
Format instruction in gate prompt
  → Model pre-allocates attention to format compliance
    → Reduced reasoning capacity
      → At 4+ gates, cumulative format tax exceeds scaffolding benefit
        → Hump curve right-side degradation (KE-134)
```

H-103 proposes breaking this chain at step 1: remove format instructions from gates, keeping only reasoning prompts. DD-747 shows this exact intervention (decoupling) recovers accuracy in their controlled experiments. This is the strongest possible external evidence short of testing H-103 directly — the same mechanism, the same intervention, validated across 10 models, 4 formats, and multiple task types.

**Key distinction**: DD-747 validates the *mechanism* (format instructions cause reasoning loss; decoupling fixes it). H-103 makes a *system-level prediction* (this mechanism explains the hump curve and decoupling will shift it rightward). DD-747 doesn't test gate stacking or hump curves — that's what EXP-144 is for. But the mechanistic grounding is now very strong.

## 3. Should P(H-103) Increase?

**Yes — from 0.72 to 0.78.**

Justification:
- **Prior (0.72)**: Based on CR-338 synthesis (theoretical convergence of DD-747 + DD-748 + DD-671 + KE-134 + KE-135). The prior was set with DD-747 already in the evidence base, but only as one of several converging papers.
- **Update (+0.06)**: This KE crystallizes that DD-747 isn't just *consistent* with H-103 — it directly validates the specific intervention H-103 proposes (decoupling). The paper tests "freeform first, reformat second" and shows it recovers reasoning accuracy. This is the exact architecture EXP-144 will implement at the gate level. The update is moderate (not +0.10) because:
  - DD-747 was already in the evidence base for H-103's prior
  - The paper tests individual prompts, not multi-gate workflows (our specific prediction)
  - Closed-weight models (like Claude) show less format tax — our system may already be partially insulated
- **Posterior (0.78)**: Strong external mechanistic validation + clear architectural prescription. Still needs EXP-144 to confirm the system-level hump-curve-shift prediction.

## 4. Implications for EXP-144 Design

DD-747 suggests three modifications or considerations for EXP-144:

### 4a. Freeform-Then-Reformat as Explicit Gate Strategy

DD-747's most effective intervention is a **two-pass architecture**: generate freeform reasoning first, then reformat into the required structure in a second lightweight pass. EXP-144 currently tests only the "remove format" condition (format-decoupled gates). Consider adding a third condition:

**Proposed Condition C: Two-Pass Gates**
- Gate prompt asks for freeform reasoning (same as format-decoupled)
- A lightweight second step extracts/reformats into the structured artifact
- Tests whether you can get BOTH benefits: format-free reasoning AND structured artifacts for downstream consumption

This maps directly to DD-747's recommended approach and could be the practical production architecture (operators may want structured artifacts for auditability).

**Trade-off**: Adding a third gate-type level changes the design from 2×4 to 3×4 (12 conditions). At N=25/cell, that's 300 sessions ($30). Consider adding this in Phase 2 only if Phase 1 shows format-decoupled ≥ structured.

### 4b. Model-Specific Predictions

DD-747 finds closed-weight frontier models (GPT-4, Claude) show "little to no format tax." This creates a risk for EXP-144: **the effect may be smaller than predicted because Claude's format tax is already low.** 

Implications:
- P-144b (≥20% FM reduction) may be optimistic — the format tax component of our FMs may be small
- The hump curve shift (P-144c) may be only 0.5 gates rather than a full gate
- Phase 1 (N=50 at 3 gates) becomes critical as a go/no-go for the full factorial

### 4c. Format Complexity as Moderator

DD-747 shows the tax scales with format complexity (simple format < moderate < complex < multiple stacked). EXP-144's structured gates vary in complexity — the Plan gate (with table + checklist + sections) likely has higher tax than the Verify gate (just a matrix). Consider:
- Measuring format complexity per gate (tokens spent on formatting vs reasoning)
- Testing whether the decoupling benefit is larger at more complex gates
- This is already partially captured by EXP-144's "Format compliance overhead" exploratory metric (§3.3)

## 5. Broader Pattern: The Evidence Chain for Structure-Dominates-Content

DD-747 → H-103 is one link in a larger evidence chain:

```
KE-101 Laws 2+3: Structure has cognitive cost; cost comes from reasoning capacity
  ↓ grounded by
DD-747: Format instructions alone degrade reasoning (empirical)
DD-671: Constrained decoding → structure snowballing (empirical)
DD-748: Implicit budgets drive efficient self-regulation (empirical)
  ↓ synthesized in
CR-338: Cognitive Overhead Budget — two competing forces (scaffolding vs tax)
  ↓ explains
KE-134: Gate stacking hump curve (peak at 3, degradation at 4)
KE-135: Gate-task synergy determines scaffolding force magnitude
  ↓ predicts
H-103: Decoupling eliminates tax while preserving scaffolding → rightward shift
  ↓ tested by
EXP-144: Format-Decoupled Gates (2×4 factorial, N=200)
```

This is now one of the best-grounded prediction chains in the knowledge base: external empirical validation → mechanistic synthesis → specific testable prediction → designed experiment.

## 6. Open Questions

1. **How large is Claude's format tax?** DD-747 suggests frontier closed-weight models have "little to no" format tax. If true, the EXP-144 effect size may be disappointingly small. Counter-argument: our gates impose MUCH more complex formatting than DD-747's "respond in JSON" — multiple sections, tables, checklists, specific headers — so the tax may be larger even on Claude.

2. **Does the two-pass approach work at the agent-workflow level?** DD-747 tests two-pass at the single-prompt level. At the workflow level, a format extraction pass adds a whole extra step (tool calls, tokens, latency). The practical cost-benefit may differ.

3. **Is format tax the binding constraint on the hump curve right side?** Alternative explanation: at 4 gates, the agent simply runs out of context window or patience. DD-747 suggests format tax is the mechanism, but token budget exhaustion (not capacity allocation) could be the real limiter. EXP-144's token usage metrics (§3.3) should discriminate these.

---

*Knowledge entry connecting external evidence (DD-747) to internal hypothesis (H-103) and experiment (EXP-144). The strongest external validation for a pre-experiment hypothesis in our knowledge base.*
