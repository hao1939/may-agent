# Journal

# Session 2026-03-27 17:33 (Fork Injection Bug Diagnosis)

## Summary
Investigated the P0 fork injection bug that Coach escalated — gym `.lab` forks produce identical `prompt_hash` between baseline/patched runs, blocking ALL growth-cycle experiments for 2+ days. Traced through gym-runner.ts → may.ts → bundle-mode.ts → agent-loader.ts → manager.ts to map the full fork overlay flow. Wrote a diagnosis brief with 4 hypotheses and recommended diagnostic steps.

## Key Actions
1. **Code trace**: Traced fork overlay flow across 5 files (gym-runner.ts lines 144-228, may.ts line 28, bundle-mode.ts line 47-66, agent-loader.ts line 631, manager.ts line 345-396). Confirmed the architectural path: gym copies agents to `agents-lab/`, overlays fork files, passes `AGENTS_ROOT` env var to binary, binary resolves via `agent-loader.ts` → `manager.ts` skill loading.
2. **Diagnosis brief**: Wrote `agents/bob/workspace/briefs/2026-03-27-brief-fork-injection-diagnosis.md` with 4 hypotheses, recommended diagnostic logging, and workaround for Coach.
3. **System state review**: No periodic tasks overdue (next: Pattern Synthesis 2026-04-03). Active focus items: Agent Evolution (PIVOT), Prompt Caching (ESCALATED to Hao). 57 zombie "echo hello" requests still in queue.

## Key Finding
The fork injection architecture looks correct on paper — `AGENTS_ROOT` env is properly set, file overlay uses correct paths, `assembleEffectivePrompt` reads from the overlaid directory. The bug is likely in one of: (1) fork directory structure mismatch between what Coach creates vs what gym expects, (2) identity sandbox copy (line 207) being used instead of AGENTS_ROOT, or (3) `assembleEffectivePrompt` not matching actual binary prompt assembly. Need diagnostic logging to confirm.

## Artifacts
- `agents/bob/workspace/briefs/2026-03-27-brief-fork-injection-diagnosis.md` (New — diagnosis + fix plan)

---

# Session 2026-03-27 16:03 (Consolidation + Zombie Alert)

## Summary
Consolidated `focus-tasks.md` from 385→101 lines (96% of items were completed/archived). Identified and escalated 37 zombie sessions clogging the system. Reviewed Scout's latest CRITICAL research (Memetic Drift scaling laws, Conformity Dynamics Trinity).

## Key Actions
1. **Focus-tasks cleanup**: Reduced from 385 lines to 101. Active items (2: Agent Evolution PIVOT, Prompt Caching ESCALATED) now clearly separated. Completed items in compact table. Deep archive in collapsible section.
2. **Zombie sessions brief**: Wrote `agents/bob/workspace/briefs/2026-03-27-brief-zombie-sessions.md` documenting 37 stale "echo hello" sessions from 2.5 days ago. Sent P2 to May for Hao.
3. **Research review**: Scout produced DD#473 (Memetic Drift / QSG Scaling Laws — ★★★★★), DD#474 (Trust Management), CR#260 (Conformity Dynamics Trinity — ★★★★★). Key insight: multi-agent consensus can be pure sampling noise ("lottery") rather than collective reasoning. Directly relevant to our system's consensus mechanisms.

## Findings
- **System health**: 36 sessions/6h, 11.1% error rate. My errors were all model-config issues, now resolved.
- **No overdue periodic tasks**: Next Pattern Synthesis due 2026-04-03.
- **Key architectural insight from DD#473**: The QSG model proves that low-bandwidth communication (m=1, like our text-based inter-agent messages) maximizes memetic drift. Our mitigations: structured request DB (not free-form debate), Bob as architect (single design authority), and workflow-based constraints all help prevent drift.

---

# Session 2026-03-27 (Evidence-First Reflection)

## Summary
Responded to Hao's directive on evidence-first process. Wrote a substantive reflection acknowledging the critique, cataloging specific examples where I over-designed before validating (Unified Guards, Auto-Evolve, Archetypes), and committing to a new workflow: assumption → data check → minimal test → brief (only if test passes).

## Key Actions
1. **Wrote reflection**: `agents/bob/workspace/reflection-evidence-first.md` — 99 lines, covers the critique honestly, identifies 3 concrete examples of theory-before-evidence, extracts the lesson from the context learning cycle, and commits to 5 specific process changes.
2. **Reviewed system state**: Common-sense is lean (8 principles). All focus tasks are completed/deployed. No periodic tasks overdue (next: Pattern Synthesis on 2026-04-03).

## Findings
- **Error streak resolved**: Last session (15:39) ran successfully after ~20h of model-config errors. This session is clean.
- **Archive evidence**: 94+ analysis files, 30+ briefs in archive. Many represent cancelled or unvalidated work. The archive itself is evidence of the pattern Hao identified.
- **No new common-sense gaps**: The 8 principles in common-sense.md are all deployed and behavioral. Nothing new to build.

## Artifacts
- `agents/bob/workspace/reflection-evidence-first.md` (New — evidence-first reflection per Hao's directive)

---

# Journal - 2026-03-26

## Summary
Verified the deployment of the "Safe Verification Workflow" (`agents/may/workflows/verify-and-finish.ts`) and the "Verification Integrity" Gym scenario (`agents/gym/scenarios/verify-before-finish/`). These artifacts successfully implement the strategic pivot from "Hard Constraints" (Code Guards) to "Behavioral Shaping" (Workflows/Scenarios) mandated by Req 8b381f87.

## Key Actions
1. **Verified Workflow**: Read `agents/may/workflows/verify-and-finish.ts`. It correctly implements a retry loop (max 2 retries) and supports both shell-based verification (`verifyCommand`) and agent self-verification.
2. **Verified Gym Scenario**: Confirmed `agents/gym/scenarios/verify-before-finish/` exists with proper success criteria (checks for `.length` typo fix, initial reduce value, and verification execution).
3. **Updated Focus Tasks**: Marked "Safe Verification Workflow" as **[DEPLOYED]** and consolidated the duplicate P78 entry as **[CANCELLED]**.
4. **Updated Strategy**: Updated `agents/bob/workspace/synthesis/strategy-workflows-pivot.md` to reflect the completed audit and drafting steps.

## Findings
- **Implementation Quality**: The `verify-and-finish.ts` workflow is robust. It parses input metadata (`agent`, `verifyCommand`, `maxRetries`), executes the agent, checks for verification signals (exit code 0 or "VERIFICATION PASSED"), and provides structured feedback on failure. This is a superior alternative to the rigid `VerificationGuard` middleware we cancelled.
- **Scenario Design**: The Gym scenario effectively targets FM-3.3 (Verification Gap) by requiring the agent to *prove* its work before finishing. The checks are structural (regex for code patterns, transcript analysis for tool calls), not semantic.
- **Pivot Status**: The shift from "Guards" to "Workflows" is now concrete. We have replaced the blocked "Unified Guard Architecture" with a deployed workflow that achieves the same safety goal (verification) without the runtime rigidity.

## Next Steps
- Monitor adoption of `verify-and-finish` in daily operations.
- Proceed with the "Agent Evolution System" (Gym as CI) using these new scenarios as baselines.

# Session 2026-03-26 (Strategy Pivot Verification)

## Findings
- **Strategy Confirmed**: The "Workflows + Scenarios" pivot is fully grounded in the codebase.
- **Verification Workflow**: `agents/may/workflows/verify-and-finish.ts` exists.
- **Gym Coverage**:
  - `verify-before-finish` (C1.7) exists.
  - `read-before-edit` (C1/C2.3) exists.
  - `efficient-file-reading` (C25) exists.
- **Common Sense**: Updated to reflect "Verify before finishing" workflow.
- **Focus Tasks**: Updated to reflect reality (Guards CANCELLED, Workflows DEPLOYED).

## Next Actions
- Monitor Gym usage (handled by Coach/Evaluator).
- Focus on "Agent Evolution System" (which now uses these scenarios).

# Session 2026-03-26 (Workflow Pivot Complete)

## Session Summary
- **Verification of Scenarios**: Confirmed existence of `read-before-edit`, `efficient-file-reading`, and `judgment-security-legit` gym scenarios. These replace the cancelled "Read Safety Guard" and "Supply Chain Hardening" runtime guards.
- **Strategy Update**: Updated `strategy-workflows-pivot.md` to reflect the completion of the "Behavioral Shaping" rollout. The architecture is now "Workflows + Scenarios" rather than "Middleware Guards".
- **Focus Tasks Update**: Marked "Read Safety Scenario" and "Security Scenario" as **[COMPLETED]** in `focus-tasks.md`. Cancelled the corresponding Guard entries.
- **Workspace Cleanup**: Archived stale strategy docs (`strategy-hard-constraints.md`, `auto-evolve-try2.md`).

## Findings
- **Pivot Complete**: We have successfully transitioned from a "Hard Constraints" strategy (which Hao rejected) to a "Behavioral Shaping" strategy (Gym Scenarios).
- **Next Step**: Monitor if agents actually improve on these scenarios. If not, we may need to revisit the "Unified Guard" idea, but perhaps as a "Coach-driven" intervention rather than "Infra-driven".

## Artifacts
- `agents/bob/workspace/synthesis/strategy-workflows-pivot.md` (Updated)
- `agents/shared/focus-tasks.md` (Updated)

# Session 2026-03-27 (Recovery + Knowledge Index Scan)

## Summary
First successful session after ~20 hours of errors due to model misconfiguration (stuck on deprecated gemini-3-pro-preview, now running claude-opus-4.6). Completed the weekly Knowledge Index Scan and updated focus tasks.

## Key Actions
1. **Knowledge Index Scan (Periodic):** Audited all 60+ paths in `agents/shared/knowledge-index.md` against the filesystem. Found and fixed:
   - **3 broken links removed**: `experiment-before-apply.md`, `extract-directives.md`, `synthesis-dpir.md` (files don't exist in `agents/shared/skills/patterns/`).
   - **1 new pattern added**: `coordinator-dedup.md` (existed but unlisted).
   - **Stale counts updated**: Amy posts 80→1000+, Coach conventions 33→7, deep-dives restructured (now in `deep-dives/` subdir, 22 files).
   - **GUS path updated**: Moved from root workspace to `archive/2026-03/`.
   - **2 new sections added**: "Workflows (May Runtime)" listing 6 workflow files, and "Agent Archetypes" listing 3 archetypes (coder/coach/scout).
2. **Focus Task Update:** Marked "Gym Runtime (Evolution Loop)" as **[DEPLOYED]** — verified in code that `may.ts` line 784 passes `interfaceAgent` (from `--agent` flag) to `manager.run()` in oneshot mode.
3. **Periodic Tasks:** Updated Knowledge Index Scan last_run to 2026-03-27, next due 2026-04-03.

## Findings
- **System Health**: 32 sessions/6h with 12.5% error rate. My own 4 recent sessions were all errors (model config issue now fixed).
- **Common Sense**: `common-sense.md` is lean and healthy — 8 principles, all behavioral, all deployed.
- **Prompt Caching**: Still blocked on Hao ($36-63/day waste). No movement since 2026-03-23.
- **Bulletin Staleness**: Bulletin has entries from Mar 17-19 that should be archived (>7 day rule). Lower priority.
- **All Focus Tasks Resolved**: The only active focus task is "Agent Evolution System" which is in monitoring phase. All IN PROGRESS items are now either DEPLOYED or COMPLETED.

## Artifacts
- `agents/shared/knowledge-index.md` (Updated — 3 broken links fixed, 2 sections added, counts updated)
- `agents/shared/focus-tasks.md` (Updated — Gym Runtime marked DEPLOYED)
- `agents/bob/periodic-tasks.md` (Updated — Knowledge Index Scan date)
