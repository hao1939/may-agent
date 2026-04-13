# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [ ] **EXP-144 pilot** — Delegated to Coach (2026-04-12). Awaiting 10 calibration sessions → pilot-results.md. Then Phase 1 (N=50).
- [x] **H-107 DD-753 integration** — P(H) 0.62→0.80 (promoted Tier 2→Tier 1). 5 independent ZPD papers validate difficulty threshold mechanism. Fixed H-101/H-131 evidence regression from auto-commit. (2026-04-13)
- [x] **Guard architecture synthesis** — KE-161 written: "Permanent Linter Paradigm". (2026-04-13)
- [x] **KB INDEX integration** — 22 missing entries added. PRIORITY-TRACKER updated. (2026-04-12)
- [ ] **EXP-151 Medium bucket** — CRITICAL next step for H-107. Easy+Hard complete (114 trials) but non-discriminating (ceiling+floor). Medium bucket is where H-107 lives or dies. Also: fix mock-leak-trap scoring, fix wrong-fix-recovery gym integration.
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
