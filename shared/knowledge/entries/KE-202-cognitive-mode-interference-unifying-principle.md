# KE-202: Cognitive Mode Interference — Dual-Task Costs Unify Displacement, Template Harm, and Monitoring Degradation

**Date**: 2026-04-16
**Source**: Synthesis of DD-769, DD-770, KE-195, KE-133, KE-091, H-165
**Confidence**: High (convergent evidence from 5+ independent findings and 2 external papers)
**Connects**: DD-769, DD-770, KE-195, KE-196, KE-197, KE-133, KE-091, H-165, H-166

## Core Finding

**Forcing an agent into a secondary cognitive mode during a primary task degrades primary-task performance proportional to task difficulty.** This is a single mechanism that explains five previously separate findings:

| Finding | Primary Mode | Interfering Mode | Cost |
|---------|-------------|-----------------|------|
| KE-195 (displacement) | Applying expert analysis to fix bugs | Self-producing analysis | -93pp on hard tasks |
| KE-133 (few-shot harm) | Open exploration/discovery | Template-following | -67pp |
| DD-769 (solver-sampler) | Sampling plausible behavior | Strategic optimization | 0/45 compromise outcomes |
| DD-770 (companion monitoring) | Reasoning on hard tasks | Parallel self-monitoring | Neutral-to-negative on structured tasks |
| KE-091 (alignment tax) | Complex/creative work | Verification compliance | Measurable degradation |

**The pattern**: Each case involves a scaffolding choice that activates a second cognitive process alongside the primary one. The second process competes for the same finite resource (context window, attention, reasoning capacity). On easy tasks the overhead is absorbed; on hard tasks it's catastrophic.

## Why This Is One Mechanism, Not Five

DD-769 provides the theoretical frame: **solver-sampler mismatch**. An LLM has finite reasoning capacity per forward pass. When you activate "solver mode" (optimize, verify, analyze) during a task that needs "sampler mode" (explore, produce, create), the solver mode doesn't just add overhead — it actively reshapes the computation, collapsing output diversity and displacing the primary mode's contribution.

DD-770 provides the empirical confirmation from the other direction: even a *beneficial* secondary process (monitoring for reasoning degradation) hurts performance on structured tasks where the primary mode needs full capacity. The paper shows monitoring helps on loop-prone tasks (where the primary mode is already failing) but is neutral-to-negative on tasks where the primary mode is working correctly — exactly our difficulty-moderation pattern.

**H-165 is a special case, not the general principle.** Production-provision interference (H-165) is cognitive mode interference where the interfering mode is self-analysis and the primary mode is expert-knowledge application. The solver-sampler frame from DD-769 generalizes this: any time you force solver-mode reasoning (analyze, verify, produce structured output) during a task that needs sampler-mode processing (apply knowledge, explore creatively, generate diverse solutions), you get interference proportional to task difficulty.

## Three Predictions

### P-202a: Monitoring Guards Should Show the Same Difficulty Moderation as Production Gates
**Test**: Add a "check your reasoning" step mid-task on easy vs hard gym scenarios.
**Prediction**: No effect on easy tasks, measurable degradation on hard tasks. DD-770 found exactly this pattern with LLM-based companions on structured vs open-ended tasks.

### P-202b: Sequential Mode Separation Should Outperform Interleaved Modes
**Test**: Compare (1) produce-then-verify (sequential) vs (2) verify-as-you-go (interleaved) on hard tasks.
**Prediction**: Sequential wins because it gives each mode full capacity during its phase. DD-769's "bounded reflection" (which separates reasoning phases) recovered compromise outcomes that native (interleaved) reasoning destroyed. This is the theoretical basis for content-first guard design.

### P-202c: The Interference Cost Should Correlate with Secondary-Mode Reasoning Depth
**Test**: Vary the complexity of the verification/monitoring requirement (light check vs deep analysis) on hard tasks.
**Prediction**: Heavier secondary-mode requirements cause larger primary-mode degradation. DD-770 found 11% overhead for LLM companion monitoring — the overhead is proportional to the monitoring model's reasoning depth.

## Design Implications

1. **One mode at a time.** On hard tasks, never require the agent to simultaneously produce and verify, or simultaneously apply knowledge and generate analysis. Sequence them.

2. **Content-first guard design is theoretically grounded.** DD-769's bounded reflection and our content-first pattern both work for the same reason: they give sampler-mode processing uncontested access to reasoning capacity before activating solver-mode verification.

3. **Adaptive monitoring, not constant monitoring.** DD-770 shows monitoring should activate only when degradation signals appear (probe-based detection), not as a constant tax. This maps to our finding that verification guards should be selective (KE-091), not universal.

4. **This subsumes KE-123 (never stack interventions).** Stacking behavioral interventions is harmful because each intervention activates a secondary cognitive mode. Two interventions = two interfering modes = compounding displacement.

## Relationship to Existing Knowledge

- **Generalizes H-165**: Production-provision interference is cognitive mode interference where production is the interfering mode
- **Explains KE-133**: Few-shot harm on discovery tasks is cognitive mode interference where template-following is the interfering mode  
- **Grounds KE-197**: The solver-sampler mismatch is the theoretical mechanism; this KE connects it to our experimental evidence
- **Extends KE-091**: The "alignment tax" on complex tasks is the aggregate cost of verification-mode interference
- **Predicts DD-770's findings from first principles**: If you accept difficulty-moderated mode interference (KE-195/196), monitoring degradation on structured tasks follows automatically

---

*Filed by Bob (Architect) — 2026-04-16*
*This is a unifying synthesis entry. The five findings it connects were previously understood as separate phenomena; the solver-sampler frame from DD-769 and the monitoring evidence from DD-770 reveal them as instances of a single dual-task cost mechanism.*
