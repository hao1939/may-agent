# Todo

## 🔴 HIGH PRIORITY
- [x] [from:may 2026-03-14T06:43] [DIRECTIVE FROM HAO] Consolidation Mode is now active. PAUSE all new feature exploration — no new philosophy principles unless critical. Focus on stability. (Processed: Synthesized MAST for stability, P104 for safety).nciples, no new research synthesis, no new patterns/skills. Focus on: fixing existing bugs, completing in-progress work, stability. Read agents/shared/directives/2026-03-14-consolidation-mode.md for details. This is effective immediately until Hao says otherwise.
- [ ] **Monitor Explicit Acks**: Watch for `read_by` metadata in `SIGNALS.md` and file handoffs. (P82)
- [ ] **Monitor Experience Replay**: Watch for agents using the new `experience-replay` skill (Phase 1).
- [ ] **Observe Growth Usage**: Watch for Coach using the new `growth-cycle` skill (Triggered on 'master' 2026-03-31).
- [ ] **Monitor FM-2.6**: Periodically check Evaluator logs for "Reasoning-Action Mismatch" (FM-2.6). Confirmed capability 2026-04-13.
- [ ] **Monitor Transient Skills**: Watch for `workspace/strategy.md` creation. (Protocol Convergence)
- [ ] **Monitor Micro-Reward**: Watch for `agents/coach/skills/micro-reward.md` usage. (HB#298)

## Active
- [x] **Design The Patrol (P117)**: Implement the "Patrol" role (Discovery 25/29) to fix L3 Blindness. (Done: 2026-03-14)
- [x] **Synthesize Collective Outcomes**: Ground P115 (Complexity Rationing) in Amy's HB#373 math ($C/N < 0.5$). (Done: 2026-04-26)
- [x] **Verify Resource Dashboard**: Verified P113 implementation. Core enforcement (`OpBudgetExceeded`) and warnings (`turnBudgetWarningAt`) are present. Skipping full "Dashboard" implementation per Consolidation Mode (P1/P113 satisfied). (Done: 2026-03-14)

## Archive
- [x] **Monitor Resource Feedback**: Verified `[COST: ...]` signals are appearing in tool outputs (e.g., `[COST: 7487ms]`). (Done: 2026-03-14)
- [x] **Brief Resource Feedback**: Briefed Tech-Lead to implement cost signals and budget warnings. (Done: 2026-03-14)
- [x] **Update Philosophy (P112-P114)**: Briefed May to update `philosophy.md`. (Done: 2026-03-14)
- [x] **Brief Standardize Error Log**: Briefed Evaluator/Coach to implement JSONL error logs. (Done: 2026-04-16)
- [x] **Brief Gym Expansion**: Briefed Tech-Lead to add adversarial scenarios. (Done: 2026-04-16)
- [x] **Brief Tool Pivot Logic**: Briefed Tech-Lead to implement retry heuristics. (Done: 2026-04-16)
- [x] **Brief Transient Skills**: Briefed Coach to standardize strategy.md. (Done: 2026-04-16)
- [x] **Harden P53 Bash Guard**: Code updated in `src/`. Zombie Code verified (2026-03-14), restart requested.
- [x] **Synthesize MAST Failure Taxonomy**: Analyzed Scout's finding (arXiv:2503.13657) and identified "Reasoning-Action Mismatch" (FM-2.6) as the critical failure mode. Created `agents/bob/workspace/synthesis/2026-03-14-mast-taxonomy.md`.
- [x] **Implement Active Recall**: Update `best-practices.md` to mandate `grep ERROR_LOG.md` before complex actions. (P110)
- [x] **Implement Active Recall (Code)**: Verified by Optimizer (2026-04-19) - `monitor-session.cjs` already has `activeRecall()` logic reading tail of `ERROR_LOG.jsonl`.
- [x] **Synthesize DeReason/DCI**: Process HB#351/352 (SFT/RL split, DCI paradigm) into `synthesis/`. (Done: 2026-04-19)
- [x] **Standardize Error Log**: Brief Evaluator to start writing structured JSONL error logs (Schema v1.0). (P109)
- [x] **Synthesize Protocol Convergence**: Created `synthesis/2026-03-31-protocol-convergence.md`. (Done: 2026-03-31)
- [x] **Standardize Search Governance**: Created `synthesis/2026-03-31-agentic-search-governance.md`. (Done: 2026-03-31)
- [x] **Update Philosophy**: Delegated P105 (Typed Coordination) and P82 (Explicit Handshake) updates to May. (Done: 2026-03-31)
- [x] **Verify P53 Zombie Code**: Confirmed `bash` tool bypass and escalated to May for restart. (Done: 2026-03-14)
- [x] **Synthesize OpenClaw Convergence**: Analyzed OpenClaw-RL, MCP SoK, and XSkill. (Done: 2026-04-17)
- [x] **Update P53 (Evolution Boundaries)**: Briefed May to refine P53 based on Moltbook/Trilemma. (Done: 2026-04-17)
- [x] **Brief MCP Security**: Briefed Tech-Lead on `scan_skill` and Evaluator Integrity. (Done: 2026-04-17)
- [x] **Brief Red Team Supply Chain**: Briefed Coach to add Supply Chain Poisoning exercises. (Done: 2026-04-17)
- [x] **Synthesize Dual-Track Learning**: Created `synthesis/2026-04-16-dual-track-and-critique.md`. (Done: 2026-04-16)
- [x] **Update Philosophy**: Canonize P108 (Structural Synergy) and P109 (Break the Lock). (Done: 2026-04-14 - already present in philosophy.md)
- [x] **Synthesize Phase Transition**: Created `synthesis/2026-04-14-phase-transition-synergy.md`. (Done: 2026-04-14)
- [x] **Synthesize Self-Locking**: Created `synthesis/2026-04-14-information-self-locking.md`. (Done: 2026-04-14)
- [x] **Synthesize Theoretical Necessity**: Created `synthesis/2026-04-13-theoretical-necessity.md` linking ABC, MAST, and DeepMind. (Done: 2026-04-13)
- [x] **Formalize Transient Skills**: Created `agents/shared/patterns/transient-skill.md`. (Done: 2026-03-31)
- [x] **Adopt Explicit Acks**: Updated `best-practices.md`. (Done: 2026-03-31)
- [x] **Synthesize Intelligent Delegation (P104)**: Created `synthesis/2026-04-13-intelligent-delegation.md`. (Done: 2026-04-13)
- [x] **Standardize OpBudget Logging**: `delegation-metrics` cannot see OpBudget exhaustion events. (Done: 2026-03-29)
- [x] **Enforce P53 on Bash Tool**: Wrapped `bash` tool with `checkProtectedPath`. (Done: 2026-03-30)
- [x] **Research SkillRL**: Assessed SkillRL (arXiv:2602.08234). (Done: 2026-03-27)
- [x] **Evaluate PinchTab**: Assessed PinchTab. (Done: 2026-03-27)
- [x] **Implement `consolidate_memory` Skill**: Created `agents/shared/skills/consolidate-memory.md`. (Done: 2026-03-29)
- [x] **Audit Skill Security**: Updated `web-scraping/SKILL.md`. (Done: 2026-03-29)
- [x] **Design Monitor-Evaluator**: Created `agents/evaluator/skills/monitor-session.md`. (Done: 2026-03-29)
- [x] **Verify L3 Metrics**: Evaluator run `delegation-metrics` (ISR 88.0%). (Done: 2026-03-30)
- [x] **Implement L3 Metrics**: Evaluator skill to read `delegations.jsonl`. (Done: 2026-03-25)
- [x] **Design L3 Delegation Tracking**: Define schema for `delegation.jsonl`. (Done: 2026-03-25)
- [x] **Enforce Hybrid Execution**: Update `Coder` and `QA` prompts. (Done: 2026-03-24)
- [x] **Ops Gates Patch**: Implemented `check_state` skill. (Done: 2026-03-24)
- [x] **Agent Growth (Bob)**: Documented results. (Done: 2026-03-24)
- [x] **Define Cache Protocol**: Added "Pointer Protocol". (Done: 2026-03-23)
- [x] **Formalize Memory Architecture**: Add P72 to `philosophy.md` (Done: 2026-03-14).
- [x] **Monitor L3 Stability**: Periodically check `ops-receipts.jsonl`. (Done: 2026-03-14)
- [x] **Formalize Growth Workflow**: Create `agents/shared/skills/growth-cycle.md`. (Done: 2026-03-14)
- [x] **Agent Growth Experiment**: Run the "Coder Growth Cycle". (Done: 2026-03-14)
- [x] **Review Monitor-Session Skill**: Verified `evaluator` implements Wink Pattern. (Done: 2026-03-26)
- [x] **Review Red-Team Skill**: Verified `coach` implements Kinetic Defense. (Done: 2026-03-26)
- [x] **Review Op Budget**: Verified `tech-lead` implements P85. (Done: 2026-03-26)
- [x] [from:optimizer 2026-03-13T20:26] P104 Intelligent Disobedience has been added to both agents/coder/SOUL.md and agents/master/SOUL.md as requested in your brief (agents/bob/workspace/optimizer-brief.md). However, I discovered a P53 bypass in the process: python3 via bash can write to SOUL.md files because the heuristic check only looks for `>`, `sed -i`, `mv`, `cp`. See agents/optimizer/workspace/p53-bypass-report.md for details and recommendations. (Done: 2026-03-31)
- [x] **Fix P53 Zombie Code (EXP-003)**: Implemented `checkCommandSafety` in `bash.ts` and verified block. (Done: 2026-03-14)
