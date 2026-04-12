# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [ ] **EXP-144 pilot** — Delegated to Coach (2026-04-12). Awaiting 10 calibration sessions → pilot-results.md. Then Phase 1 (N=50).
- [x] **EXP-135 PROCESSED** — Guard bifurcation synthesis complete. H-106 P(H) 0.65→0.68 (EXP-135 evidence added). H-100 update skipped (already ARCHIVED/superseded by H-101). H-107 not proposed (guard reliance absorbed by H-101/H-106). Synthesis: `exp135-guard-bifurcation-synthesis.md`. (2026-04-12)
- [x] **EXP-148 PROCESSED** — H-102 P(H) 0.65→0.55. 3/4 predictions failed. Universal WF-Gated decline across all agent groups driven by Mar 30–31 infra changes, not workflow adoption. PRIORITY-TRACKER updated. (2026-04-12)
- [x] **EXP-131 PROCESSED** — H-131 added to Tier 1 at P(H) 0.70. Gate relevance > count: 3 unrelated 50% vs 3 related 86% (h=0.80). KE-135 pre-existing. PRIORITY-TRACKER updated. (2026-04-12)
- [x] **EXP-147 Track B ANALYZED** — Context isolation +0.5pp (inconclusive, ceiling at 97%). H-097 0.55→0.53. Full results written to EXP-147/results.md (410 lines). (2026-04-12)
- [x] **EXP-144 PROCESSED** — Phase 1 COMPLETE (N=50). H-103 partially refuted: format-decoupled gates preserve accuracy but fail to elicit reasoning artifacts (0/13 vs 13/13) and cost 16% more time. Format tax doesn't bind at this difficulty. P(H) 0.72→0.45. INDEX updated. (2026-04-12)
- [ ] **INDEX cleanup** — EXP-145/146/147/148 need their own rows in INDEX.md. Low priority.
- [ ] **H-097 PRIORITY-TRACKER minor update** — Row shows 0.55, Track B analysis says 0.53. Low priority.
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
