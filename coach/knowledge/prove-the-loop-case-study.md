# Prove the Loop — Complete Case Study

**Project**: prove-the-loop | **Duration**: 24+ iterations | **Closed**: 2026-06-24

## The Question
Can the coach training loop (identify gap → design experiment → run experiment → measure → promote/reject) measurably improve agent behavior?

## The Gap: Relational Bug Blindness
- Agents fix value bugs at ~97% but relational/pipeline bugs at ~2.5% (EXP-194, N=40)
- Validated across 50+ trials over 3+ weeks — robust, not noise
- Present in 45% of scenario corpus (9/20 scenarios)

## Experiments Run

| # | Intervention | N | Pass Rate | vs Baseline |
|---|-------------|---|-----------|-------------|
| EXP-177 | Lexical hinting in scenario | 46 | 27% | +27pp |
| EXP-195 | Generic Data Flow Audit skill | 6 | 0% | 0pp |
| EXP-195 | Direct hint ("check ordering") | 10 | 40% | +40pp |
| EXP-198 | Procedural discovery skill | 10 | 0% | 0pp |
| EXP-198 | Procedural + worked example | 10 | 0% | 0pp |
| Baseline | No intervention | 125 | 0-2.5% | — |

## Verdict: REJECT skill intervention. CONFIRM methodology.

### What worked
1. **The loop methodology is sound.** Gap identification, controlled experiments, pre-registered criteria, sufficient sample sizes — all executed correctly.
2. **Direct hints work** (+40pp), proving agents CAN fix relational bugs when told where to look.
3. **The measurement infrastructure works** — gym scenarios, batch runs, statistical analysis all functional.

### What didn't work
1. **Text-based skills cannot teach recognition.** 0/26 across two skill variants. The agent doesn't fail for lack of technique — it fails to *notice* the problem exists.
2. **Generic procedural guidance is ignored** when the agent's pattern-matching doesn't flag a problem area.

## Meta-Finding: The Boundary of Text Skills

**Text skills work for implementation bottlenecks, not recognition bottlenecks.**

- *Implementation bottleneck*: Agent knows what to do but needs a better technique. Skills like verify-after-edit, read-before-edit work here. The loop succeeds.
- *Recognition bottleneck*: Agent doesn't notice the problem. No amount of "remember to check X" text changes this. The loop methodology works, but the intervention type (text skill) has a ceiling.

**Implication**: Recognition tasks need *structural* interventions — workflow steps that force enumeration, tool augmentation that auto-surfaces related files, or scenario design that makes the problem visible.

## Promoted Knowledge Entries
- **KE-338**: Procedural discovery skills don't help find relational bugs
- **KE-054** (extended): Recognition-bottleneck tasks don't respond to text skills
- **KE-182**: Hard gate design rules (emerged from this work)

## Lessons for Future Experiments
1. Validate scenarios have real functional bugs before running experiments (v2 ordering bug had no test impact)
2. Baseline instability is real — always run fresh baselines alongside treatment
3. N=10 is minimum for gym experiments; N≥20 preferred for small effects
4. The 0% vs 40% direct-hint result is the most actionable finding — pursue structural interventions
