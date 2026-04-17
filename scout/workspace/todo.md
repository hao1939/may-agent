# Scout Todo

## Active Tasks
- Counter state now in `workspace/state.json` — use `scripts/counters.sh` (get/bump/set/show) instead of editing prose.
- **[2026-04-17 15:35] Friday cs.MA triage + DD#776** (session 805): Scanned 8 new cs.MA IDs (2604.14572, 2604.15267, 2604.14956, 2604.14811, 2604.14550, 2604.13914, 2604.13699, 2604.13128). Wrote **DD#776 Corpus2Skill** — external validation of KE-052 structural-access thesis. Triage artifact: `workspace/2026-04-17-friday-triage.md`. papers.md row added for 2604.14572 + two honorable mentions (CoopEval 2604.15267 ★★★★ deferred, VeriGraphi 2604.14550 ★★★). covered_ids.txt +8 → 424. Counter DD→776. Drained 8 from Coverage=53 backlog.
- **[2026-04-17 14:35] DD-770/DD-771 collision resolved** (idle-playbook #5, session 805): orphan files renumbered to DD-774 (Memory Transfer Learning, 2604.14004) and DD-775 (Bi-Predictability, 2604.13061). papers.md rows added, KE-208 refs updated + triage note folded into historical section, counter bumped DD→775. Commits d91c2bb94, 736e661f8. Pre-existing DD-772 duplicate (Concord vs Emergent Fairness) left alone — separate cleanup if desired.
- **[2026-04-17 15:00] DD downstream-impact probe** (idle-playbook #2, session 805): `workspace/metric-probes/2026-04-17-dd-downstream-impact.md`. Counts: 226 distinct DD IDs cited across KEs+hypotheses, 298 in INDEX, only 24 physical files in shared library — DDs are consumed (top DD-755 cited 170×, DD-754 129×) but storage is fragmented. Confirmed "nobody reads DDs" concern is wrong; real gap is missing feedback-loop visibility. Three follow-ups logged (promote loose DDs, resolve orphan citations DD-747/750, propose KE→DD back-linking).
- **[2026-04-17 16:00] todo.md hygiene sweep** (idle-playbook #5, session 806): archived 23 ✅-completed Pending Leads (DD#655-712, CR#317-326 era) to todo-archive.md. todo.md dropped from 111 → ~40 lines. Addresses system-gaps.md §6 row 1 (bloated todo.md). No content lost — git + archive preserve full history.

## Pending Leads (current state — post-sweep)

### Active research priorities (next session)
1. **Mon–Fri arXiv triage** — next fresh batch ~00:00–06:00 UTC weekday window. Current coverage backlog: Coverage=53 → target 0. Drain ~8/session.
2. **CR#324 gap filling**: signal calibration, dynamic capability profiles, multi-step attack detection (carryover).
3. **Production-first evaluation literature** (carryover from CR#326): naturalistic agent benchmarking, distribution shift, session-fatigue studies.
4. **Decision boundary interventions** (carryover): last-mile verification, pre-commitment gates, finish()-point interventions.
5. **KE-106 habituation literature** — LOW priority, internal evidence strong.

### Active side threads
- **DD storage fragmentation** (metric probe 2026-04-17): 226 cited DDs, only 24 physical files in shared/library/deep-dives/. Three follow-ups: (a) promote loose DDs from workspace, (b) resolve orphan citations DD-747/750, (c) propose KE→DD back-linking protocol. Candidate next idle-playbook work.
- **Bob pipeline healthy**: Scout research → Bob KE integration working (KE-072, KE-076-078, KE-098, KE-105 all pulled from Scout DDs/CRs). No intervention needed.
- **Fork mechanism**: still non-functional. Substantive work must be inline or via `workflow.run('verify-wrap', ...)`. Verified across sessions.

### Not actioning unless nudged
- Weekly synthesis CR — last was CR#326 (gym-production gap, session 573). Defer new weekly CR until 5+ new DDs accumulate.
- EXP-104 framing revisit in CR#322/#323 — only matters if someone re-reads those CRs. Low urgency.
- **[2026-04-17 13:30] common-sense.md feedback loop closed** (reqs 5dd07962, 9a91cc97 from May/Hao): integrated. No further action.

---
*123 completed/historical sections moved to [todo-archive.md](./todo-archive.md)*
