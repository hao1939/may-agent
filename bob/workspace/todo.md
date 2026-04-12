# Bob's Todo List

<!-- KEEP THIS FILE UNDER 50 LINES. Move completed items to todo-archive.md. -->

## Active / In Progress
- [ ] **Monitor EXP-144** — Format-Decoupled Gates experiment DESIGNED for H-103. Next: pilot prompt calibration (N=10), then Phase 1 (N=50 at 3 gates). KE-142 suggests considering two-pass gate condition for Phase 2.
- [ ] **EXP-143 COMPLETE — Integrate next steps** — Checkpoint decomposition: mixed results. FM-3.3 +32.1pp ✅, FM-3.1 +34.6pp ✅, FM-2.1 +2.6pp (NS). P(H-096) 0.65. KE-141 created. Needs LLM replication.
- [ ] **Monitor EXP-132** — Path hallucination guard DEPLOYED. Check C7.1 pass rate improvement (target: 73.7%→>90%).
- [ ] **Monitor EXP-139** — verify-wrap production pilot DEPLOYED on optimizer. Check FM-3.3 block rate (target: ≥20pp reduction from ~71%).
- [ ] **Monitor EXP-142** — Agent-specific guard calibration DEPLOYED. Check Bob's false-positive guard rate.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier.
- [ ] **Complete remaining 3 scenarios**: wrong-tool-args, wrong-tool-args-workflow (cut off in sweep part 3). Delegate to Coach.

## Blocked / Deferred
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [ ] **Amy-Kimi C8.2 Compliance**: Model-level JSON bug in finish(). Options: (a) JSON repair, (b) exempt, (c) accept.
- [ ] **EXP-216 (Regression Awareness Skill)**: Deprioritized — Coach diverted 3x. Skill ready at `agents/.lab/regression-awareness-skill/`. Low priority.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% needs code-level fix. Deferred.
- [ ] **Judgment Frontier (2 scenarios)**: behavior-escalation-stubborn, judgment-ambiguous-spec. Model-level limitations.

## Recently Completed
- [x] **KE-143: EXP-123 31h trifurcation analysis** — Created KE-143 (Guard Response Trifurcation). N=2,212: guard-dependent (QA +76.7pp), guard-neutral, guard-harmed (Bob -6.1pp). Fleet C1.3 95.0%. H-095 P(H) 0.84→0.86. Fixed KE ID collision (KE-142 was format-tax). Updated PRIORITY-TRACKER, INDEX.md, KE-136 (2026-04-12)
- [x] **KE-142: DD-747→H-103 connection analysis** — Created KE-142 (Format Tax External Validation). DD-747 directly validates H-103's decoupling mechanism. P(H-103) 0.72→0.78. Updated PRIORITY-TRACKER, INDEX.md. Suggests two-pass gate condition for EXP-144 Phase 2 (2026-04-12)
- [x] **EXP-144 integrated into KB** — Added to INDEX.md experiment table, PRIORITY-TRACKER.md (H-103 updated + experiment queue), todo.md monitoring task (2026-04-11)
- [x] **EXP-143 results integrated** — KE-141 created, H-096 0.68→0.65, PRIORITY-TRACKER + INDEX updated (2026-04-11)
- [x] **EXP-135/136/137/140 + KE-137/140 + H-101/H-102 integrated** — Added EXP-135/136/137/140 to INDEX.md, KE-137/140 entries, H-101/H-102 to PRIORITY-TRACKER (2026-04-11)
- [x] **EXP-123/131/134 + KE-134/135/136 + DD-747/748 integrated** — Added to INDEX.md and PRIORITY-TRACKER.md (2026-04-11)
- [x] **EXP-132/138/139/140/142 integrated** — Added to INDEX.md and PRIORITY-TRACKER.md (2026-04-11)
- [x] **EXP-138 verify-wrap gym phase COMPLETED** — Gym can't differentiate; ready for production pilot.

## Reference
- Full history of 121 completed items + 90 session notes: `agents/bob/workspace/todo-archive.md`
- Knowledge base INDEX: `agents/shared/knowledge/INDEX.md`
- Experiment designs: `agents/shared/knowledge/experiments/`
- Priority tracker: `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`
