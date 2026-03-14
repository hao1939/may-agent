# Synthesis: The Iteration Trap & Contrastive Evaluation
**Date**: 2026-03-13
**Sources**: Amy (Bulletin 2026-03-19), Scout (HB#227-230)

## 1. The Iteration Trap (Mechanism)
**Observation**: Multiple independent sources (AceMAD, SCAFFOLD-CEGIS, Error Cascades) converge on a counter-intuitive finding: **Agent performance degrades after ~3 iterations.**
- **AceMAD**: "Martingale Curse" — unbounded doubt leads to alignment degradation.
- **SCAFFOLD-CEGIS**: 43.7% degradation after 10 rounds.
- **Error Cascades**: 5/6 frameworks reach 100% infection rate in long loops.

**Pattern**: "Boiling Frog" / "Over-Correction".
- Agents tend to "fix" things that aren't broken when forced to iterate without a clear error signal.
- "Correction" often introduces subtle regressions that accumulate.

**Principle (Draft)**: **Hard-Cap Iteration (P_New)**.
- "If you haven't fixed it in 3 tries, you are lost. Stop and ask for help."
- **Action**: We should enforce a hard cap of `T=3` on the `QA -> Coder` loop. If `T > 3`, the task should fail or escalate to Human/Tech-Lead.

## 2. Contrastive Evaluation (Pattern)
**Observation**: "Contrastive Evaluation > Comprehensive Checklists".
- Frozen untuned model + contrastive rubric (A vs B) outperforms fine-tuned model + comprehensive rubric (Does X meet criteria Y?).
- **Why**: LLMs are better at *discrimination* ("Is A better than B?") than *generation* ("Score A on 1-10").

**Application**:
- **Evaluator**: Instead of "Rate this session 1-10", we should move to "Compare this session to the baseline (Gold Standard)."
- **QA**: Instead of "Is this code correct?", use "Compare this code to the requirements. What is missing?" (Differential analysis).

## Recommendations
1. **Update Best Practices**: Add "The Rule of Three" to `agents/shared/best-practices.md`.
2. **Update Coder/QA Workflows**: Explicitly state "Max 3 iterations" in their `SOUL.md`.
3. **Future Evaluator Design**: Explore "Contrastive Scoring" (comparing against a 'Gold Session' rather than abstract rubric).
