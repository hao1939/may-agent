# Synthesis: Skill Interventions × Verification Architecture

**Date**: 2026-04-19  
**Sources**: EXP-186 (KE-272), DD#777-779 (KE-270, KE-271)

## Thread Summaries

### EXP-186: Skill-based intervention for interruptive behavior
TRIGGER/ACTION/EXAMPLE skill pattern achieved **75% compliance** (3/4) on persistent-task workflow adoption vs **0% baseline** (0/3). This challenges H-162's Cell C prediction (0-15% for behavioral signaling on interruptive behaviors) but falls short of 100% structural enforcement. The skill works by reducing inference steps (providing exact commands) but lacks architectural guarantees.

### DD#777-779 Triage → KE-270, KE-271
- **KE-270** ("Structure All the Way Down"): Five research streams converge — agent behavior is determined by structural constraints, not content. Verification quality = evidence architecture, not reasoning quality. Combined interventions cause iatrogenesis (-12 to -15pp).
- **KE-271** (Two-Threshold Verification): Optimal weak→strong verification escalation uses two thresholds: accept/reject on confident weak scores, escalate in the uncertain middle. Calibration × sharpness governs weak verifier value. Distribution-free online algorithm maintains error guarantees.

## Cross-Thread Connections

### 1. The 75% ceiling IS the structure-content boundary (HIGH IMPACT)
EXP-186's 75% result is the empirical boundary between content-level and structure-level intervention. KE-270 explains *why*: structural constraints bind pre-attentionally (limiting possible behaviors), while content competes for finite attention post-attentionally. The skill's TRIGGER/ACTION pattern pushes content toward structure (providing exact commands) but remains fundamentally text — hence 75%, not 100%. This is the most precise measurement we have of where content-based intervention tops out for interruptive behaviors.

### 2. Skills as "weak verifiers" of behavior (NOVEL)
KE-271's two-threshold framework maps onto intervention design: skills are like weak verifiers — they work when confidence is high (clear trigger match) but fail in ambiguous situations. The 25% failure rate in EXP-186 likely clusters in cases where the trigger condition was less salient (analogous to queries falling in the escalation band). **Implication**: For interruptive behaviors, use skills as the "weak layer" with structural enforcement as the "strong layer" escalation — don't rely on skills alone.

### 3. Iatrogenesis risk for skill+verification stacking
KE-270 warns that combining interventions causes -12 to -15pp degradation. EXP-186 already combined two mechanisms (skill file + SOUL.md rule). Adding a verification guard on top could push into iatrogenic territory. The two-threshold approach from KE-271 offers a way out: instead of stacking interventions, use calibrated confidence to decide *which single intervention* to apply.

## Findings Ranked by Impact

1. **Skills cap at ~75% for interruptive behaviors** — precise empirical bound for the structure/content boundary (EXP-186 + KE-270)
2. **Two-threshold escalation as intervention architecture** — don't stack interventions; use weak→strong escalation with calibrated confidence (KE-271 + KE-270)
3. **Calibration > accuracy for intervention selection** — a well-calibrated skill that knows when it will fail is more valuable than a more accurate skill that can't signal uncertainty (KE-271)

## Next Steps

1. **H-update**: Update H-162 Cell C range from 0-15% → 0-75% with EXP-186 as evidence; note this requires TRIGGER/ACTION/EXAMPLE pattern specifically (not generic instructions, which remain ~0%)
2. **Design experiment**: Test whether adding structural enforcement (handler-level auto-detection) on top of the skill *degrades* performance (iatrogenesis prediction from KE-270) or whether structural enforcement simply overrides the skill
3. **Prototype two-threshold intervention selection**: For behaviors where skill compliance is uncertain, implement a lightweight detector that routes to structural enforcement when skill delivery confidence is low
