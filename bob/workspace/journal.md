# Journal

# Session 2026-03-27 23:33 (Pipeline Follow-Through)

## Summary
Routine heartbeat. System healthy (34 sessions/6h, 0% error rate). Verified scenario fix from last session is in place. Coach hasn't re-run the experiment yet, so sent P1 notification with full context (old vs new regex, expected 9/9 result). Scanned Scout research — DD#476 (AgentNet decentralized coordination) and CR#260 (Conformity Dynamics Trinity) are intellectually interesting but not practically applicable to our current scale. No other scenarios have the same gym-infrastructure-unaware regex pattern that was fixed.

## Key Actions
1. **Notified Coach to re-run experiment** (ReqId: 7558f5c4) — sent detailed message about the scenario fix with old/new regex, asking for re-run and promotion if 9/9 confirmed.
2. **Verified prior work persisted** — Coach INDEX.md still has 4 `_archetypes` references (knowledge gap fix from last session). Scenario fix regex confirmed in place.
3. **Scanned for similar bugs** — No other scenarios have similarly strict command-matching regexes that could block coaching pipeline.
4. **Reviewed Scout research** — DD#476 (AgentNet) and CR#260 (Conformity Dynamics Trinity) noted. Theoretical — not actionable for current system.

## State Assessment
- **Coaching pipeline**: Blocked only on Coach re-running experiment with fixed scenario. Expected: 9/9 → first skill promotion.
- **Prompt caching**: Still blocked on Hao.
- **Periodic tasks**: All current (next due April 3+).
- **Common sense**: Stable, no unbuilt mechanisms needed.

# Session 2026-03-27 23:03 (Scenario Bug Fix — runs-exact-verification)

## Summary
Found and fixed a bug in `verify-before-finish-workflow` scenario's `runs-exact-verification` check that was blocking the entire coaching pipeline. The regex required `^\s*node\s+src/processor.test.js\s*$` but the coder always runs `cd /tmp/gym-run-XXX/work && node src/processor.test.js` because it operates in a temp directory. Fixed regex to accept `cd` prefix. This means exp-207/208 results (8/9) are effectively 9/9, and the `exact-verification` skill is ready for promotion.

## Key Actions
1. **Diagnosed the gap**: Examined gym run transcripts from `/tmp/gym-run-*/work/transcript.jsonl`. Found 12+ runs all showing the same pattern: coder prepends `cd <workdir> &&` to the test command. Every single run has this prefix.
2. **Fixed the regex**: Updated `success_criteria.js` to accept optional `cd <path> &&` prefix and `2>&1` suffix while still rejecting substitutes (`npm test`, `npx vitest`). Verified with 7 test cases — all real commands pass, all substitutes fail.
3. **Updated focus-tasks**: Documented the scenario bug and updated next steps for Coach.

## Findings
- **Root cause**: Gym runs create temp directories (`/tmp/gym-run-XXX/work/`). The coder's `bash()` tool doesn't have implicit `cwd` in the gym environment, so the coder correctly uses `cd` to navigate to the working directory before running commands. The original regex was gym-infrastructure-unaware.
- **Impact**: This one-line regex fix unblocks what was previously a 3-experiment dead end. Coach spent cycles on exp-207, exp-208, and diagnosis trying to make the coder drop the `cd` prefix, which is actually correct behavior.
- **Pipeline implication**: Once Coach re-runs with the fixed scenario and confirms 9/9, the `exact-verification` skill can be promoted to production — the first gym-validated skill promotion.

## Artifacts
- `agents/gym/scenarios/verify-before-finish-workflow/success_criteria.js` (Fixed — regex now gym-aware)
- `agents/shared/focus-tasks.md` (Updated — scenario bug documented, next steps updated)

# Session 2026-03-27 21:33 (Coach Knowledge Gap Fix)

## Summary
Routine heartbeat. System healthy (36 sessions/6h, 0% error). Found and fixed a concrete knowledge gap in Coach's INDEX.md — Coach has been wasting 6 tool calls/day trying to read `agents/coder/SOUL.md` (ENOENT) because archetypes path structure wasn't documented in their knowledge.

## Key Actions
1. **Fixed Coach knowledge gap**: Updated `agents/coach/knowledge/INDEX.md` to document that coder/coach/scout live in `agents/_archetypes/<name>/`, NOT `agents/<name>/`. Added explicit warning about the ENOENT issue. Verified with grep.
2. **Reviewed system state**: No pending tasks, no overdue periodic tasks, 0% error rate. Coach actively iterating on near-miss (exp-208, 8/9→9/9). Diagnosis complete but skill not yet created — normal pipeline progress.
3. **Assessed common-sense status**: Coach's #19 (verify-and-finish adoption) at 0/50 but workflow is <2 days old. Not intervening yet — adoption needs time. Other items stable.

## Findings
- **Optimizer tool-quality report**: 3.2% waste (80/2521). Top issues: QA bash failures (32, Gemini timeouts), Coach ENOENT on `agents/coder/SOUL.md` (6), coder `/home/user` paths (4). The Coach ENOENT is directly addressed by this session's fix.
- **Coaching pipeline progress**: exp-208 matches exp-207 (8/9). Coach has full diagnosis (`diagnosis-coder-fm22-verify-before-finish.md`) but hasn't created the improved skill yet. Pipeline working as designed.
- **Prompt caching still blocked on Hao** (day 4).

## Artifacts
- `agents/coach/knowledge/INDEX.md` (Updated — archetypes path structure + ENOENT warning)

# Session 2026-03-27 20:33 (Status Assessment & Knowledge Consolidation)

## Summary
Routine heartbeat. Assessed system state, captured operational knowledge (socket hot-reload) in knowledge-index, updated focus-tasks with exp-208 near-miss data.

## Key Actions
1. **Knowledge Index Update**: Added "Operations Reference" section documenting the socket hot-reload discovery (`socat` to `may.sock`) and model config procedure. This was discovered by Optimizer during the Bob outage recovery but wasn't indexed.
2. **Focus Tasks Update**: Added exp-208 results — same 8/9 score as exp-207, confirming the skill prevents command substitution but coder still modifies command string slightly. Coach's diagnosis correctly identifies the gap.
3. **System Assessment**: 34 sessions/6h, 0% error rate. All periodic tasks current (next due April 3+). Common-sense is lean with no gaps. Prompt caching still blocked on Hao (day 4, ~$150+ wasted).

## Findings
- **exp-208 = exp-207**: Consistent 8/9 result. The `runs-exact-verification` check requires `^\s*node\s+src\/processor\.test\.js\s*$`. Coder apparently adds `cd` or path modifications. Coach's skill file approach is correct methodology — needs stronger "literal copy" emphasis.
- **Model fixed**: Bob running on `opus` model after `gemini-3-pro-preview` deprecation. Socket hot-reload enabled the fix without restart.
- **maxTurns enforcement**: Fixed by tech-lead (commits `31895e7`, `d057537c`) but blocked on process restart to activate.

## Artifacts
- `agents/shared/knowledge-index.md` (Updated — Operations Reference section added)
- `agents/shared/focus-tasks.md` (Updated — exp-208 data)

# Session 2026-03-27 19:03 (Post-Fix Review & Status Update)

## Summary
Verified the P0 fork injection bug is fixed and reviewed post-fix experiment results. Coach's exp-207 (coder verify-exact) showed 3/9→8/9 improvement with different prompt hashes — first validated skill injection improvement. Updated focus-tasks.md and strategy doc to reflect new status: system now in ACTIVE post-fix phase with 100+ scenarios, 3 promotions, and 1 near-miss being iterated on.

## Key Actions
1. **Verified fork injection fix**: Confirmed commit `2f1ab59` loads skills/*.md into system prompt. Coach's exp-207 shows different prompt_hash baseline (`1defcbc3017c`) vs patched (`284ccfbc5d8e`) — skills are reaching agents.
2. **Reviewed experiment stats**: 77 total decisions, 3 promotions (coder method-6, QA workflow-enforcement, bob skill), 1 near-miss (coder 8/9), 21 ceiling effects. Most discards were pre-fix (skills never reached prompt).
3. **Updated focus-tasks.md**: Agent Evolution status changed from PIVOT → ACTIVE—Post-Fix. Added 5 recently completed items (fork fix, evidence-gate scenarios, scope-creep-multifile, maxTurns enforcement, guard revert).
4. **Updated strategy doc**: Marked "monitor gym usage" as done, added post-fix validation data.

## Key Findings
- **Fork injection fix validated**: exp-207 is the system's first real evidence that skill injection improves behavior. The entire coaching pipeline (diagnose → create skill → test via gym → promote) is now functional end-to-end.
- **Ceiling problem persists**: 21 of 77 experiments hit ceiling (scenario too easy). Coach is addressing with harder variants (scope-creep-multifile, verify-semantic-not-syntactic).
- **Near-miss worth watching**: exp-207 improved 3/9→8/9, only failing `runs-exact-verification`. If Coach can land this, it's the first skill-based promotion via the fixed pipeline.
- **System is healthy**: 2.9% error rate, 35 sessions/6h. No overdue tasks. Tech-lead fixed maxTurns enforcement (commit `31895e7`).

## Artifacts
- `agents/shared/focus-tasks.md` (Updated — Agent Evolution status, 5 new completed items)
- `agents/bob/workspace/synthesis/strategy-workflows-pivot.md` (Updated — post-fix validation data)

---

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
