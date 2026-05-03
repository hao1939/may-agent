# Bob's Improvement Queue

> Idle-time work — concrete deliverables only. Pick the top **Ready** item and fork a session.
> See DESIGN-idle-improvement.md for rationale.

## Ready

- [x] **EXP Doc-Drift Detection Guard (Phase 1)**: Implement pilot drift-check script targeting `may-agent-docs/sessions.md`. Validate against known KE-570 findings. See `EXP-PROPOSAL-doc-drift-detection-guard.md`. Output: working script + test results. → DONE 2025-05-03: `scripts/drift-check.sh` finds 4/5 drifts (80% true positive). See `drift-report-2026-05-03.md`.

- [ ] **Execute H-098 consolidation**: Based on ANALYSIS-hypothesis-tensions.md, execute the 4 proposed merges (H-085, H-091, H-043, H-053, H-087 → H-098). Update H-098 hypothesis file, mark absorbed hypotheses, update PRIORITY-TRACKER. Output: updated hypothesis files + tracker.

- [ ] **H-096 experiment design**: H-096 (Evaluation Architecture Determines Quality Ceiling) is at P=0.68 with no direct test. Design a minimal experiment using checkpoint decomposition on a known-hard scenario. Output: `knowledge/experiments/EXP-145/design.md` or next available number.

- [ ] **KE freshness audit**: Find knowledge entries older than 7 days that reference experiments now completed or hypotheses whose status changed. Flag stale claims. Output: workspace file listing entries needing update, with specific corrections.

- [ ] **Bayesian scorecard for H-101 through H-104**: The April 11 scorecard was done before H-101/H-102/H-103/H-104 were authored. Run explicit prior/likelihood/posterior calculations for these four new hypotheses. Output: append to or create new scorecard section.

- [x] **Meta-harness feasibility analysis** → `workspace/DESIGN-meta-harness-feasibility.md` (5KB) — Phase 1 MVP identified: polling loop for experiment-completion detection. Full autonomy feasible but needs event-driven triggers. (2026-05-01): KE-081 suggests closed-loop self-improvement. Analyze whether our system's current architecture (heartbeat dispatch, gym, guard infrastructure) could support a meta-harness — an outer loop that proposes hypotheses, designs experiments, runs them, and updates the KB without human intervention. What's the minimum viable design? Output: `workspace/DESIGN-meta-harness-feasibility.md`

- [ ] **Write skill: bayesian-update**: Extract the Bayesian scorecard process into a reusable skill doc that any agent could use. Output: `agents/shared/skills/bayesian-update.md` or similar path.

- [ ] **Discovery boundary theory paper**: H-099 (Discovery Task Boundary) is now CONFIRMED with 7 experiments. Write a synthesis document that could serve as an internal "paper" — organized argument with evidence tables, connecting to external literature (if any). This is our strongest negative result. Output: `knowledge/synthesis/discovery-boundary-synthesis.md`

## Done
- [x] **Hypothesis corpus tension scan** → `ANALYSIS-hypothesis-tensions.md` (15.6KB) — Found 4 merges, 2 flags, 14 keep-separates. H-098 identified as potential grand unifying framework. (2026-04-12)
