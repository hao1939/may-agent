# Instruction-Following Hypothesis Table

Consolidated from knowledge entries and metric-autonomy project results.  
Updated: 2026-04-18

| Mechanism | Evidence Summary | Source | Expected Compliance Effect | Open Question |
|-----------|-----------------|--------|---------------------------|---------------|
| **Declarative text rules** (SOUL.md, knowledge files, common-sense notes) | 0/35 success on judgment tasks across 5+ rule categories. One result actively harmful (skill injection → timeout, 8/8→6/8). Process-factual text rules DO work (~88-100%) but judgment/behavioral ones never do. | KE-002 | ≈ 0% for judgment/behavioral instructions | Does the 0% finding extend to novel instruction types not yet tested (e.g., meta-cognitive prompts)? |
| **Workflow enforcement** (two-phase, forced externalization) | 92-100% pass on scenarios where baseline was 0-15%. Strict gate variant eliminates sycophancy (40%→100%, 9/9). Forces execution-sequence change rather than adding information. | KE-007 | High (~90-100%) but heavyweight — requires workflow infrastructure per instruction | Can lightweight structural interventions (short of full workflows) capture most of the effect? |
| **Question-framing as step 1** | 0%→100% metric-reaction (n=30/30, p<0.0001). De-confounded in G′ (10/10). Statement-style variants (ownership, suggested action, position) all ≈0-10%. Partial effect (21%) when question is in data block instead of step 1. | KE-215 | Very high (~100%) for metric-reaction; unknown for other instruction types | Does question-framing generalize beyond metric-reaction to persistent-task adoption, standing-order compliance, turn-budget removal? |
| **Process skills** ("do X before Y") | ~60-80% improvement when matched to correct delivery. grep-first-reading 6/8→8/8; structured-plan-writing 7/8→8/8. Works because it adds steps without contradicting existing behavior. | KE-021 | Medium-high for process-type instructions | What is the compliance rate for process skills in production (not gym)? Do they decay over time? |
| **Knowledge skills** (providing missing context) | Moderate effect — agent uses info but may not act optimally. Weaker than process skills, stronger than judgment skills. | KE-021 | Medium | Where is the boundary between knowledge skills that work and judgment skills that don't? |
| **Judgment skills** (text-based "don't do X when Y") | 0/20+ as text injection. Requires L5 materialization gate to work (then 100%). The agent's own investigation results outweigh any text instruction. | KE-021 | ≈ 0% as text; ~100% with materialization gate | Is there a lighter-weight delivery for judgment skills between "text injection" (0%) and "full L5 gate" (100%)? |
| **Hard gate (artifact = solution)** | +80 to +100pp on low-baseline scenarios (0-20%). Gate artifact must PRODUCE the fix, not describe the problem. 2-phase investigate→fix is most robust pattern. | KE-182 | Very high when baseline is low and artifact is solution-producing | How to predict which instructions have low-enough baseline to benefit from gating? |
| **Hard gate (artifact = analysis report)** | -80pp regression (80%→0%, p=0.004). Writing analysis substitutes for action — completion illusion. Agent feels done after describing the problem. | KE-180, KE-182 | Actively harmful | Can "analysis + explicit fix mandate" rescue analysis gates, or is the illusion too strong? |
| **Stacked interventions** (2+ combined) | Superadditive harm: 0+0 → -12pp (p=0.018). Each intervention alone was harmless; combined caused over-refactoring. Duration overhead +77%. Externally validated by 5 papers (IBM ScaledIF: 88%→66% as instructions 2→10). | KE-123 | Negative (-12 to -15pp degradation) | Is the harm from any two stacked behavioral interventions, or specific to adversarial+evidence combination? |
| **Few-shot examples on discovery tasks** | -67pp (100%→33%, p=0.030). Template-following displaces exploration. Agent copies example structure instead of investigating the specific problem. | KE-133 | Actively harmful for open-ended/discovery instructions | Is there a way to provide examples that guide without constraining? (e.g., meta-examples showing diversity) |
| **Metric position/emphasis** (⚠️ markers, ownership tags, top-of-context) | All ≈0-10% reaction rate across variants C/D/E (n=10 each). Presentation changes without cognitive-mode change are ineffective. | KE-215 | ≈ 0% | — |
| **Cognitive mode at decision time** (question vs statement) | The bottleneck is not information availability but cognitive mode when the agent commits to an action sequence. Questions force evaluation; statements allow autopilot. F variant (question in data, not step 1) = 21% — position amplifies the effect. | KE-215 | Key moderator — same content as question vs statement changes compliance from 0% to 100% | Is this a general principle for all instruction types, or specific to "notice and act on data" tasks? |

## Key Patterns

1. **Structure > Content**: What changes agent behavior is restructuring *when* it thinks relative to *when* it acts (KE-007, KE-215), not what information it receives (KE-002, KE-011).

2. **Intervention dose curve is non-monotone**: One targeted intervention helps; two hurt (KE-123). More safeguards ≠ safer.

3. **Task-type matching is critical**: Process instructions work as text; judgment instructions require structural enforcement; discovery tasks are harmed by templates (KE-021, KE-133).

4. **Question-framing is a new lever class**: Lighter than workflow enforcement, more effective than text rules. Sits between them on the cost-effectiveness frontier. Needs generalization testing.

## Priority Experiments Needed

1. **Generalization of question-framing** (KE-215) to persistent-task adoption and standing-order compliance
2. **Lightweight structural interventions** between text rules and full workflows
3. **Production compliance measurement** — gym results may not transfer
