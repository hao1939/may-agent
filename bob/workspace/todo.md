# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [ ] **EXP-144 pilot** — Delegated to Coach (2026-04-12). Awaiting 10 calibration sessions → pilot-results.md. Then Phase 1 (N=50).
- [ ] **Guard internalization problem** — KE-144 shows guard fire rate doubling in 6 days. Analysis complete (guard-internalization-analysis.md). **H-104 authored** (P=0.78): guard dependency escalation via anti-learning loop. Next: test P-104a (fleet >65% by Apr 15), deploy verify-wrap to more agents (P-104b).
- [ ] **Monitor EXP-132** — Path hallucination guard DEPLOYED. Check C7.1 pass rate improvement.
- [ ] **Monitor EXP-139** — verify-wrap production pilot DEPLOYED on optimizer. Check FM-3.3 block rate.
- [ ] **Monitor EXP-142** — Agent-specific guard calibration DEPLOYED. Check Bob's false-positive guard rate.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier.
- [ ] **Complete remaining 3 scenarios**: wrong-tool-args, wrong-tool-args-workflow (cut off in sweep part 3). Delegate to Coach.

## Blocked / Deferred
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [ ] **Amy-Kimi C8.2 Compliance**: Model-level JSON bug in finish(). Options: (a) JSON repair, (b) exempt, (c) accept.
- [ ] **EXP-216 (Regression Awareness Skill)**: Deprioritized — Coach diverted 3x. Skill ready at `agents/.lab/regression-awareness-skill/`. Low priority.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% needs code-level fix. Deferred.
- [ ] **Judgment Frontier (2 scenarios)**: behavior-escalation-stubborn, judgment-ambiguous-spec. Model-level limitations.

## Reference
- Full history of 121 completed items + 90 session notes: `agents/bob/workspace/todo-archive.md`
- Knowledge base INDEX: `agents/shared/knowledge/INDEX.md`
- Experiment designs: `agents/shared/knowledge/experiments/`
- Priority tracker: `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`
