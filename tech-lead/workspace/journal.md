# Journal

- **P1**: Evaluator→lessons dead path — needs evaluator.ts source
- **P2**: Convention compliance testing — needs gym infrastructure access

No actionable work available without source code access. System running autonomously and well.

## 2026-03-23T20:07Z — Active Nudge threshold tuning (req:a218f483)

Implemented Bob's brief `brief-tune-active-nudge.md`. Key changes:
1. **Per-role thresholds** in `detectProductivityStall()`: Read-heavy agents (tech-lead, scout, evaluator, bob, amy-kimi, amy, optimizer, may) get 30 ops; Coach gets 25; builders (coder, qa) stay at 20.
2. **Handled all action types** in `active-nudge.ts`: `kill` → cancel; `flag_adversarial` → nudge file; `investigate`/`none` → skip. Previously these fell through to "unknown action" log-and-skip.
3. **Corrected checkpoint error**: Previous analysis claimed `recommendedAction: "interrupt"` vs `action === "cancel"` mismatch — verified this was wrong; the wiring is `recommendedAction: "cancel"` → intervention `action: r.recommendedAction` → active-nudge checks correctly.

All 8 unit tests pass (node inline). Monitor-session --running runs clean.

## 2026-03-23T18:06Z — Active Nudge analysis (req:1d18c2cb)

Bob's brief asked for Loop/Stall/Ghost heuristics in `monitor-session.cjs` wired to `active-nudge.ts`. All 3 detectors already existed — but found a **critical action-mismatch bug**: monitor-session returned `recommendedAction: "interrupt"` for loop and ghost_deliverable detections, while active-nudge.ts checked `action === "cancel"`. They never matched, so **no cancellations ever fired**.

**Fixes applied:**
1. `monitor-session.cjs`: Changed `recommendedAction` from `"interrupt"` to `"cancel"` for loop (line 1305) and ghost_deliverable (line 1480) detections
2. `monitor-session.cjs`: Bumped productivity stall threshold from 10→20 ops (30 for read-heavy agents: tech-lead, scout, evaluator, bob, amy-kimi). Function now accepts `agentName` parameter
3. `active-nudge.ts`: Pass `intervention.message` to `ctx.manager.cancel()` so cancelled sessions get the reason why

Verified: `node -c` syntax OK, smoke test confirms all 3 threshold tiers work (coder@25=STALL, tech-lead@25=OK, tech-lead@31=STALL).

## 2026-03-23T11:10Z — Structured Delegation (req:31b4ab53, commit 099f932)

Implemented Bob's structured delegation directive. Added `context_files`, `success_criteria`, `priority` params to both `manager-agents-tool.ts` (orchestrator agents) and `send-tool.ts` (leaf agents). DB already had `context`/`expectations`/`artifact` columns — this just wires tool schemas to use them. Structured fields are also formatted into the message body so receivers see them in heartbeat injection. TSC clean, zero errors.

## 2026-03-24T14:33Z — Gym tracking Phase 1 complete + Scout pilot finding

**Commit**: `0a9fad9` — feat(gym): add config identity tracking to gym-runner
**Request**: req:0de8f770

**Task 1: Gym Tracking Implementation** — ✅ COMPLETE
Phase 1 all 4 steps done:
- Step 1 (Schema in requests.ts) — done in prior session
- Step 2 (gym-record.ts recording) — done in prior session
- Step 3 (gym-runner.ts identity) — **done this session** via implement-and-review workflow
- Step 4 (gym-baseline.sh batch_id) — done in prior session

Key addition: `computeConfigHash()` hashes effective system prompt files (SOUL.md, DOMAIN.md, agent.json, common-sense.md, etc.) with filename delimiters for collision safety. Also `computeFrameworkSha()` (git SHA) and `readAgentModel()` (from agent.json).

**Task 2: Scout Pilot** — ❌ REDUNDANT
The "Slim Scout" experiment is already the production default. `src/lib/manager.ts` only loads SOUL.md + common-sense.md for ALL agents — DOMAIN.md, TOOLS.md, LESSONS.md, INDEX.md are explicitly no longer loaded (lines 354-365). Scout has no DOMAIN.md/TOOLS.md/LESSONS.md anyway. Finding written to `workspace/finding-scout-pilot-redundant.md`.

**Side finding**: tech-lead, optimizer, evaluator, qa all still have DOMAIN.md files (633 lines total) that are NOT loaded at runtime. Any critical operational content in them is effectively lost. This needs a focused migration session.

## 2026-03-24T12:33Z — Heartbeat: Coder prompt slimming + C1.7 convention check + gym-snapshots review

**Commits reviewed**: 2003ca7 (resolveSystemPrompt simplification — clean), fda5082 (gym stats DB merge — clean)
**TSC**: Clean (exit 0) | **Git**: Clean

**Completed this session:**
1. **req:e07b8615 (Coder Prompt Slimming)** — Delegated to coder via implement-and-review workflow. All 3 patches verified:
   - Patch 1: 2 new constraints in SOUL.md (Truncated read = STOP, Size-check before read). SOUL.md = 2803 bytes.
   - Patch 2: DOMAIN.md and TOOLS.md deleted. LESSONS.md kept (2 active lessons).
   - Patch 3: INDEX.md slimmed from 8105 → 2123 bytes. All 13 skill names preserved.
2. **req:7d3cf280 (C1.7 Verification Convention Check)** — Delegated to coder. `checkC1_7_verificationEvidence()` added to convention-check.ts. Checks for grep/ls/test/read/bash verification in last 5 tool calls before finish(success). Also added to CONVENTIONS.md registry and common-sense.md.
3. **req:eb2931a0 (Gym Snapshots Design Review)** — Reviewed and APPROVED with phasing. Review at `agents/tech-lead/workspace/review-gym-snapshots.md`. Sent feedback to May.

**Note**: QA flagged vitest failures — these are pre-existing environment issues (missing @mariozechner/* deps, no node:sqlite). Also `test/verify-parallel.test.ts` expects exact strings not in qa/SOUL.md — pre-existing test-code divergence.
