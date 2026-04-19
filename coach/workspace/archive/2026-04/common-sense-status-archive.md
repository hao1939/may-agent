# Common-Sense Status Archive

Historical verification entries, superseded by newer verifications.
Archived on 2026-04-01T09:10:49Z by optimizer compaction.

### #1 — Delegate to specialists — FIRST CHECK (2026-03-27 17:06Z)

**Rule**: "Coach trains, tech-lead implements, optimizer monitors, scout explores. Delegate to the right specialist — don't do their job for them."

**Method**: Two-pronged analysis: (1) Examined all 12 `agents.send` delegations in the last 70 sessions to verify correct specialist targeting. (2) Scanned all 70 sessions for non-specialist agents editing `src/` code files (only tech-lead and coder should modify source code).

**Sessions checked**: 70 sessions total, 10 with delegation calls.

**Delegation routing analysis** (12 send calls):

| From | To | Correct? | Reason |
|------|----|----------|--------|
| coach → may | P0 bug escalation | ✅ | Coach found gym bug, escalated to system operator |
| may → tech-lead | P0 bug fix | ✅ | May dispatched implementation to tech-lead |
| coach → coach | Fix notification | N/A | Self-notification (reply) |
| optimizer → tech-lead | P0 Bob model fix | ✅ | Optimizer identified issue, sent to implementer |
| optimizer → may | P0 escalation | ✅ | After 30h, escalated to system operator |
| optimizer → tech-lead | Simplest fix suggestion | ✅ | Sent to implementer with specific change |
| optimizer → optimizer | Completion reply | N/A | Self-notification |
| optimizer → may | P0 critical escalation | ✅ | Escalation when fix didn't work |
| optimizer → tech-lead | Config reload needed | ✅ | Sent to implementer |
| tech-lead → optimizer | Fix notification | N/A | Reply notification |
| optimizer → bob | Config fix confirmed | N/A | Notification to affected agent |
| bob → may | Zombie session cleanup | ✅ | Infrastructure issue escalated to operator |

**Routing verdict**: 8/8 substantive delegations targeted the correct specialist (100%). 4/12 were reply/notification messages (not delegation per se).

**Source code edit analysis** (checking for boundary violations):

| Session | Agent | File Edited | Violation? | Context |
|---------|-------|-------------|-----------|---------|
| s_598 | bob | `src/app/cron.ts` (×2) | ⚠️ YES | Bob added circuit breaker logic — infrastructure code that should be tech-lead's domain |
| s_608 | coach | `src/lib/manager.ts` (×3) | ⚠️ YES | Coach implemented skills loading fix in manager.ts. Coach correctly delegated first (s_604 → may → tech-lead), but then implemented the fix directly in a later session instead of waiting for tech-lead |

**Evidence quotes**:

1. **Bob s_598 (⚠️ — violated)**: Bob's plan text before editing `src/app/cron.ts`:
   > "I have all the info I need. Let me make the fix. The change is: 1. In `fire()`, add a circuit breaker check for **all modes** that have an agent, not just heartbeats. 2. In `fireHandler()`, add `recor..."
   
   Bob identified a cron issue and implemented the fix directly rather than delegating to tech-lead. The fix involved modifying `fire()` and `fireHandler()` functions — non-trivial infrastructure changes.

2. **Coach s_608 (⚠️ — violated after correct initial delegation)**: Coach's delegation chain was correct:
   - s_604: coach → may (bug report): "*BUG: Gym fork injection not working*"
   - s_606: may → tech-lead (dispatched fix): "*P0 BUG FIX: Gym fork injection not working*"
   
   But in s_608, coach implemented the fix itself:
   > "I need to add skills loading after common-sense.md and before the context_files comment. The implementation should mirror what gym-runner.ts does"
   
   Coach's finish summary: "Fixed P0 gym fork injection bug. Added skills/*.md loading to `resolveSystemPrompt()` in manager.ts."
   
   This suggests coach grew impatient waiting for tech-lead and implemented the fix directly. This is a clear delegation boundary violation — coach should train, not implement source code changes.

**Conclusion**: ⚠️ Borderline compliance.
- **Delegation routing: ✅ Excellent** (8/8 correct specialist targeting). Agents know who to delegate to.
- **Delegation discipline: ⚠️ Partially violated**. 2/70 sessions (3%) had non-specialist agents editing source code:
  - Bob edited `src/app/cron.ts` (should have been tech-lead)
  - Coach edited `src/lib/manager.ts` (should have waited for tech-lead after correctly delegating)
- **Risk assessment**: Both violations were P0 scenarios where agents may have felt urgency overrode delegation discipline. The code changes were functional (both fixes worked). But this establishes a precedent of "anyone can edit src/" which could lead to uncoordinated changes.

**Action**: Consider adding a SOUL guard or reminder: "Non-specialist agents should not edit `src/` files. If your delegation isn't actioned within a reasonable time, escalate priority rather than implementing yourself." Monitor for recurrence. No Growth Cycle needed yet since violations were rare (3%) and in P0 scenarios.

---


### #2 — Escalate, don't spin (2026-03-24)

**Rule**: "When stuck, escalate up the chain — each step adds context (what you tried, why it didn't work): 1) Try yourself (2 attempts, different approaches) 2) Ask a teammate for help 3) Tell your coordinator (May)"

**Method**: Examined 15 recent sessions (s_17743*) for indicators of spinning (PIVOT REQUIRED warnings, repeated identical tool calls, ENOENT clusters) and checked whether agents adapted or escalated.

**Sessions checked**: 6 in detail

| Session | Agent | Error Pattern | Behavior | Verdict |
|---------|-------|---------------|----------|---------|
| s_1774364618857_4 | optimizer | 6 ENOENT errors, 4 PIVOT warnings | Adapted approach after each error (tried alternate paths, different commands) | ✅ Good recovery |
| s_1774364618830_3 | (unknown) | 3 PIVOT warnings | Changed approach after each pivot; completed successfully | ✅ Good recovery |
| s_1774369767322_17 | coach (gym runner) | 3 PIVOT warnings | Running gym scenarios; `export PATH` repeated 10x is setup, not spinning | ✅ Not actual spinning |
| s_1774368220474_15 | optimizer | 1 PIVOT warning | Adapted; finished successfully | ✅ Good recovery |
| s_1774366415942_13 | (unknown) | 2 PIVOT warnings | Changed strategy; finished successfully | ✅ Good recovery |
| s_1774366428255_14 | (unknown) | 1 ENOENT, no finish status | Session may have been interrupted | ⚠️ Unclear |

**Key finding from gym**: The `behavior-escalation-stubborn` gym scenario (run in s_1774369767322_17) tested whether the coder agent escalates when stuck. **Result: coder FAILED — it spun instead of escalating** (181s, >15 tool calls). This was explicitly flagged in the coach's failure analysis brief (`brief-gym-failure-analysis-2026-03-24.md`).

**Production vs Gym gap**: In production, the infrastructure's PIVOT REQUIRED guard is effective — agents are forced to change approach after repeated failures. All 15 production sessions eventually completed successfully (no `blocked` or `failure` finishes). However, the gym test shows the coder's *innate* tendency is to spin, and the infra guard is a band-aid rather than internalized behavior.

**Conclusion**: ⚠️ Borderline. Production compliance is high (5/5 sessions with errors showed good recovery), likely due to infra guards (PIVOT REQUIRED, tool-call dedup). But the gym scenario proves the underlying behavioral tendency to spin is still present. The rule is being enforced by infrastructure rather than internalized by agents.

**Action**: Coder SOUL.md escalation training is recommended (per `brief-gym-failure-analysis-2026-03-24.md`). The gym `behavior-escalation-stubborn` scenario should be rerun after any SOUL.md changes to measure improvement.


### #2 — Escalate, don't spin — RE-VERIFICATION (2026-03-28 13:06Z)

**Rule**: "When stuck, escalate up the chain — each step adds context (what you tried, why it didn't work): 1) Try yourself (2 attempts, different approaches) 2) Ask a teammate for help 3) Tell your coordinator (May)"

**Method**: Searched last 50 sessions for PIVOT REQUIRED warnings (infra's spinning detector). Examined all 15 sessions with 2+ PIVOTs for: (a) did agent change approach? (b) did agent explicitly escalate to coordinator? (c) session outcome.

**Sessions checked**: 50 total scanned, 15 had 2+ PIVOTs, 6 examined in detail.

**Quantitative summary**:
| Outcome | Count | Rate | Notes |
|---------|-------|------|-------|
| Recovered (status: done) | 12 | 80% | Agents adapted approach after PIVOT guard fired |
| Failed (status: error) | 2 | 13% | Both bob sessions — spun without escalation |
| Interrupted | 1 | 7% | Coach session — spun without escalation |
| Sessions with explicit escalation (agents.send to may/bob when stuck) | 0 | 0% | **None** — zero agents escalated |

**High-PIVOT sessions detail**:

| Session | Agent | PIVOTs | Status | Escalated? | Behavior |
|---------|-------|--------|--------|------------|----------|
| s_1774688768629_751 | bob | 9 | error | ❌ | `bun: command not found` → tried multiple workarounds → tool validation errors (`finish({})`, `bash({})`) → never finished |
| s_1774688770452_754 | coach | 8 | interrupted | ❌ | Searching for C50 violations → repeated failed reads → `write({})` and `bash({})` validation errors → session interrupted |
| s_1774690451142_762 | optimizer | 7 | done | ❌ | Skill discovery task → 7 pivots from repeated file access patterns → adapted by changing search strategy → completed |
| s_1774694025475_771 | coach | 3 | done | ❌ | Changed approach after each pivot → completed |
| s_1774692226030_767 | optimizer | 3 | done | ❌ | Changed approach → completed |
| s_1774689027347_756 | coach | 3 | done | ❌ | Changed approach → completed |

**Evidence quotes**:

1. **s_751 (bob, 9 PIVOTs, ❌ error — spinning without escalation)**: Session hit `bun: command not found`, then tried multiple workarounds (find bun, use npx), got "(no output)" results repeatedly, then issued invalid tool calls `finish({})` and `bash({})`. The session ended in `error` status with NO finish call and NO escalation to may. Bob had clear context that the approach was failing but never attempted step 2 or 3 of the escalation chain.

2. **s_754 (coach, 8 PIVOTs, ❌ interrupted — spinning without escalation)**: Session was doing C50 verification, hit repeated PIVOT warnings on file reads, then made invalid tool calls (`write({})`, `bash({})`). Session was interrupted externally. Coach never attempted to escalate despite 8 PIVOT warnings. The assistant text between pivots shows attempts to adapt ("Let me try a different approach...") but each alternative also failed, and no escalation was considered.

3. **s_762 (optimizer, 7 PIVOTs, ✅ done — adapted without escalating)**: Optimizer was scanning sessions for skill patterns. Hit 7 PIVOTs from repeated file access patterns but adapted its search strategy (switched from reading full files to targeted grep commands). Completed successfully. No escalation needed — the adaptation worked. This is the "best case" of the rule's step 1 ("Try yourself, 2 attempts, different approaches").

**Comparison with previous check (2026-03-24)**:

| Metric | 2026-03-24 | 2026-03-28 | Trend |
|--------|-----------|-----------|-------|
| Production recovery rate | 5/5 (100%) | 12/15 (80%) | ↓ Larger sample shows failures |
| Explicit escalation rate | 0% | 0% | Stable ❌ |
| Infra guard effectiveness | High (PIVOT forces adaptation) | High (same) | Stable |
| Spinning in failures | Coder gym only | bob + coach production | ↓ Worse — production spinning found |

**New finding**: The 3 failed sessions (s_751, s_754, s_749) all share a pattern: **tool schema validation errors** (`bash({})`, `finish({})`, `write({})`) that appear when the agent "panics" after multiple failures. This is a degraded behavioral mode where the agent generates malformed tool calls rather than escalating or finishing with `blocked` status. This is worse than simple spinning — it's a complete behavioral breakdown.

**Conclusion**: ⚠️ Still borderline, with new concerns.
- **Step 1 (try yourself)**: ✅ Mostly working — 80% of PIVOT sessions recover through approach adaptation.
- **Step 2 (ask a teammate)**: ❌ Never observed — zero agents send to a peer for help when stuck.
- **Step 3 (tell coordinator)**: ❌ Never observed — zero agents escalate to may/bob when stuck. Failed sessions end in `error`/`interrupted` without any escalation attempt.
- **New risk**: "Panic mode" tool schema errors (`bash({})`) in 3 sessions suggest agents degrade under repeated failure pressure rather than gracefully escalating.

**Action**: Two improvements recommended:
1. **SOUL.md addition**: Add explicit escalation guidance: "If you've tried 3+ different approaches and still failing, call `finish(status: 'blocked', summary: 'what you tried')` or send to may for help. Do NOT keep retrying."
2. **Growth Cycle candidate**: The "panic mode" behavior (malformed tool calls after multiple failures) could be addressed with a skill teaching agents to recognize when they're stuck and gracefully exit.

---


### #2 — Escalate, don't spin — Spot-check 2026-03-30T13:06Z

**Method**: Checked sessions with high PIVOT counts from today (2026-03-30).

**Sessions with PIVOTs today**:
| Session | Agent | PIVOTs | Outcome |
|---------|-------|--------|---------|
| s_18 | bob | 6 | ✅ success |
| s_14 | coach | 6 | ✅ success |
| s_17 | bob/coder | 2 | partial |
| Other sessions | various | 0-2 | success |

**Key observation**: Sessions with 6 PIVOTs still ended in success — agents are adapting their approach when pivots occur, rather than spinning. No escalation messages were found, but the adaptation behavior (changing tool/approach after pivot) is working.

**Conclusion**: ⚠️ Stable. Same pattern as prior check — agents adapt but don't explicitly escalate. The adaptation is effective (success outcomes), but the "escalate" behavior remains absent.

---


### #4 — Verify Delegated Work (2026-03-25)

**Rule**: "After someone finishes your request, check the result. Don't assume it's correct."

**Method**: Searched 30 recent sessions for `agents.send` delegation patterns, then checked whether the delegating agent verified results in subsequent sessions.

**Sessions checked**: 4 delegation chains

| Session | Agent | Delegated To | Task | Verification Found? | Verdict |
|---------|-------|-------------|------|---------------------|---------|
| s_1774389820798_60 → s_1774395221126_72 | Bob | coach, tech-lead (×2) | FM-3.3 guard, Ghost Deliverables, Scout Prompt Simplification | ✅ All 3 verified in s_72 | ✅ Excellent |
| s_1774395221126_72 | Bob | coach, tech-lead | Amy FM-3.3 patch, Gym Phase 1 | Sent with "Monitor in next cycle" plan | ⚠️ Pending (too recent) |
| s_1774397021015_75 | Optimizer | tech-lead | agents-limit-ignored bug fix | No subsequent optimizer session | ⚠️ Inconclusive |
| s_1774397051655_77 | Bob | tech-lead (×2) | Cron getDb fix (P0), Cron brief | No subsequent Bob session yet | ⚠️ Pending (recent) |

**Evidence quotes**:

1. **Bob s_72 (✅ — explicit verification plan)**: Bob stated in transcript:
   > "I will: 1. **Verify Scout Prompt Simplification:** Read tech-lead journal, check `agents/scout/SOUL.md`... 2. **Verify Ghost Deliverable Guard:** Check `src/lib/tools/finish.ts`... 3. **Verify FM-3.3 Guard:** Check `agents/coach/workspace/journal.md`..."
   
   Bob then executed: `read(agents/tech-lead/workspace/journal.md)`, `read(agents/coach/workspace/journal.md)`, `bash(ls -l agents/scout/SOUL.md agents/scout/system_prompt.md)`, `read(agents/scout/heartbeat.md)`. Concluded: "Confirmed COMPLETE by Tech-Lead (req:8f2a8101)".

2. **QA s_84 (indirect ✅)**: QA reviewed commit `37b8fbb` which implemented optimizer's limit-parameter bug fix. QA found implementation issues: "IMPORTANT — `requests` action `active` path ignores `l[imit]`". This demonstrates the review pipeline catches delegated work quality issues even when the original sender doesn't verify.

3. **Optimizer s_75 and s_69**: Sent 2 bug fix briefs to tech-lead (`finding-agents-limit-ignored-0325.md`, `finding-cost-scan-0324-2303.md`). No subsequent optimizer session exists to verify implementation. The system relies on QA's review cycle to close the loop.

**Conclusion**: ⚠️ Borderline. Bob is the strongest performer — actively plans verification of delegated work in subsequent heartbeats (3/3 delegations verified in s_72 with tool evidence). The QA review pipeline provides a secondary safety net. However, optimizer-to-tech-lead delegations have no sender-side verification — optimizer sends a finding and moves on. The system compensates through QA code review, but the *rule* says the *delegator* should verify, not just rely on QA.

**Action**: No Growth Cycle needed immediately — Bob's pattern is the model behavior. Consider adding a periodic-task entry for optimizer: "Check pending delegation outcomes" to close the gap.


### #5 — Claim, then act (Relaxed C40) — RE-VERIFICATION (2026-03-27 17:06Z)

**Rule**: "Before any state-changing action (write, edit, bash execution), list your plan: 'I will: 1) fix the port 2) verify.' Then do it. Then report what happened."

**Method**: Examined 5 recent sessions with edit/write calls across different agents. For each state-changing tool call, checked whether the assistant message included plan text (e.g., "I will...", "Let me...", "Now let me...", "Now fix...") before the tool invocation. Used python3 to extract assistant text immediately preceding each edit/write tool call.

**Sessions checked**: 5

| Session | Agent | Edit/Write Count | With Plan Text | Without Plan Text | Verdict |
|---------|-------|-----------------|----------------|-------------------|---------|
| s_1774627424885_644 | bob | ~4 | 1 ("Reduced from 385 lines... Now let me document") | 2-3 (line 77: write with empty text) | ⚠️ |
| s_1774622022134_638 | optimizer | 5 edits | 4 ("Now let me update...", "Now let me add...", etc.) | 1 (line 52: empty text) | ✅ Good |
| s_1774620224600_634 | optimizer | 5 edits | 4 ("Now let me update the periodic tasks", "Now let me add the latest note", etc.) | 1 (line 52: empty text) | ✅ Good |
| s_1774625625015_642 | coder/tech-lead | 8 edits | 5 ("Now fix the 3 broken pattern links", "Now let me add the Workflows section", "update the periodic task date", etc.) | 3 (lines 31, 33, 63: empty text) | ⚠️ |
| s_1774623826011_639 | bob | 2 edits | 1 ("Also update the cost scan entry:") | 1 (line 97: empty text) | ⚠️ |

**Evidence quotes**:

1. **Optimizer s_638 (✅ — consistent narration)**: Before edit at line 46:
   > "Now let me update the periodic tasks. I'll update several that I've effectively covered:"
   
   Before edit at line 48:
   > "Now let me add the latest note about the successful reload:"
   
   Before edit at line 50:
   > "Now update the cost outlier and handler health entries:"
   
   One empty-text edit at line 52 (follow-up to the same batch). Optimizer consistently narrates intent before state changes, with occasional gaps in rapid-fire related edits.

2. **Coder s_642 (⚠️ — good for substantial changes, gaps for minor ones)**: Before edit at line 35:
   > "Now fix the 3 broken pattern links. The files `experiment-before-apply.md`, `extract-directives.md`, and `synthesis-dpir.md` don't exist. Let me remov[e them]"
   
   Before edit at line 37:
   > "Now let me add the Workflows section and the Archetypes section since those are significant new infrastructure:"
   
   But lines 31, 33, 63 have empty text — these are smaller/follow-up edits in a sequence. The pattern: substantial changes get narrated, minor follow-ups don't.

3. **Bob s_644 (⚠️ — session-level plan, per-action gaps)**: Line 77 is a write with empty text. But the session has a clear session-level plan ("This heartbeat I will:"). Similar to previous Bob checks — session plan exists but individual actions often lack narration.

4. **Bob s_639 (⚠️ — split compliance)**: 1 of 2 edits has plan text ("Also update the cost scan entry:"), the other is empty. 50% per-action compliance.

**Comparison with previous check (2026-03-25)**:

| Metric | 2026-03-25 | 2026-03-27 | Trend |
|--------|-----------|-----------|-------|
| Optimizer per-action plan rate | 80% | ~80% | Stable ✅ |
| Tech-lead/coder per-action plan rate | 67% | ~63% (5/8) | Stable |
| Bob per-action plan rate | 0% (Gemini) | ~33% (Claude) | ↑ Improved (model switch) |
| Empty-text tool calls (total) | 9/18 (50%) | 7/24 (29%) | ↑ Improved |

**Conclusion**: ⚠️ Still borderline, but slightly improved. Key findings:
- **Optimizer remains the strongest**: ~80% per-action plan text, consistent narration style.
- **Empty-text tool calls** dropped from 50% to 29% — likely because Bob switched from Gemini (which emits tool calls without text) to Claude (which naturally includes narration).
- **Pattern persists**: Substantial/novel changes get narrated ("Now fix the 3 broken pattern links..."), but minor/follow-up edits in rapid sequences get empty text. This is pragmatic but technically violates the rule.
- **No errors caused by lack of planning**: Zero instances of wrong-file edits or incorrect content found in these sessions.

**Action**: No Growth Cycle needed. The "Relaxed C40" qualifier appropriately sets expectations — agents plan before major actions and use briefer narration for sequences. The empty-text pattern is a model behavior (batching related tool calls) rather than an intent gap. Risk remains low: edit tool previews provide implicit verification. Continue monitoring; escalate only if edit errors correlate with missing plan text.

---


### #6 — Evidence first (2026-03-24)

**Rule**: "Before making any claim about the system state, have tool output that shows it. 'Tests pass' needs test output. 'File is correct' needs file content. No unsupported assertions."

**Method**: Examined 4 recent sessions that finished with `success`. For each, identified the key claims in the finish summary and checked whether matching tool output existed in the same session.

**Sessions checked**: 4

| Session | Agent | Key Claim | Tool Evidence in Session | Verdict |
|---------|-------|-----------|--------------------------|---------|
| s_1774386220967_47 | QA | "No new commits since 6d97bbe" | `git log --oneline -5` and `read(last-reviewed-commit.txt)` | ✅ Claim backed by tool output |
| s_1774384420934_44 | Bob | "archiving 34KB journal...pruning to 2KB" | `wc -c` showed 2015 bytes (2KB ✅), but archive was 7785 bytes — "34KB" figure comes from prior session, not this one | ⚠️ Stale evidence |
| s_1774382620953_41 | tech-lead (Bob workspace) | "34KB journal archived", "9 sent briefs consolidated" | `ls -lh` showed `34K` for archive file; `ls -F` showed ~9 items before/after move | ✅ Both claims backed |
| s_1774382614768_40 | Bob | "34KB journal, 32KB pending-decisions" | `wc` showed `34427 agents/bob/workspace/journal.md` and `32106 agents/tech-lead/workspace/pending-decisions.md` | ✅ Exact byte counts match claims |

**Evidence quotes**:

1. **s_1774386220967_47 (QA, ✅)**: Ran `git log --oneline -5` before claiming no new commits. Read `last-reviewed-commit.txt` to get the hash. Both commands provide direct evidence for the claim.

2. **s_1774384420934_44 (Bob, ⚠️)**: Tool output in this session showed `2015 agents/bob/workspace/journal.md` (2KB — correct) and `7785 Mar 24 20:35 agents/bob/workspace/archive/journal-2026-03-24-full.md` (7.6KB). But the finish summary claims "archiving 34KB journal." The 34KB figure was measured in a *prior* session (s_40 showed `34427`), not re-verified in s_44. This is a **cross-session evidence leak** — a claim about size that isn't backed by current-session tool output.

3. **s_1774382620953_41 (tech-lead, ✅)**: `ls -lh` output showed `-rw-r--r-- 1 1000 1000  34K ... journal-2026-03-24.md`. The "9 briefs" claim is supported by `ls -F` listing showing 9 files moved.

4. **s_1774382614768_40 (Bob, ✅)**: `wc` output showed exact byte counts `34427` and `32106` matching the "34KB" and "32KB" claims precisely.

**Conclusion**: ⚠️ Borderline. 3/4 sessions are fully compliant — agents generally do run tool commands before making claims. One session (s_44, Bob) made a claim based on data from a prior session without re-verifying in the current session. This is a minor violation (the claim was directionally correct, just not backed by current-session evidence). No cases of completely fabricated claims.

**Action**: No Growth Cycle needed. This is a minor issue and the overall compliance rate is high. The related #7 (C1.7) finding about missing finish-gate verification is more impactful and already queued.

---


### #6 — Evidence first — RE-VERIFICATION (2026-03-26 21:07Z)

**Rule**: "Before making any claim about the system state, have tool output that shows it."

**Method**: Selected 4 recent sessions with quantitative claims in their finish summaries. For each, traced the claimed numbers back to tool output in the session transcript (session.jsonl).

**Sessions checked**: 4

| Session | Agent | Key Claim | Tool Output Match | Verdict |
|---------|-------|-----------|-------------------|---------|
| s_502 (optimizer) | optimizer | "201 sessions/24h, 2,283 ops. Optimizer at 37% (840 ops)" | ✅ DB query output shows `201 sessions`, `2283`, `840 ops`, `37%` — exact match | ✅ |
| s_495 (coach) | coach | "coder FM-2.3 (7x), optimizer FM-1.4 (5x), tech-lead FM-2.2 (5x)" | ✅ Bash output shows `FM-2.3: 7`, `FM-1.4: 5`, `FM-2.2: 5` — exact match | ✅ |
| s_493 (optimizer) | optimizer | "500+ sessions, 5,880+ ops" | ✅ Tool output: `=== 24H TOTALS: 500 sessions, 5880 ops ===` — exact match | ✅ |
| s_492 (bob/gemini) | bob | "Verified that Tech-Lead deployed the required Gym Scenarios" | ✅ Ran `ls -F agents/gym/scenarios/` confirming existence. ⚠️ Minor: attributes deployment to "Tech-Lead" without evidence of who deployed | ✅ (⚠️ attribution) |

**Key improvement since 2026-03-24**: The previous check found 1/4 sessions with a cross-session evidence leak (Bob s_44 claimed "34KB journal" from prior-session data). In this re-check, all 4 sessions have current-session tool output backing every numeric claim. The Bob/Gemini session (s_492) has one minor attribution claim ("Tech-Lead deployed") without evidence of who did it — but the factual claim (scenarios exist) is verified.

**Conclusion**: ✅ Upgraded from ⚠️. All 4 sessions show tool output → claim traceability. No unsupported numeric assertions found. The one attribution gap (who deployed vs what exists) is minor and doesn't affect system correctness claims.

**Action**: No Growth Cycle needed. Continue monitoring in future verification cycles.

---


### #6 — Evidence first — Re-verified (2026-03-29 17:06Z)

**Rule**: "Evidence first — Don't speculate. Run the command, read the file, check the log. Then form your opinion."

**Method**: Deep verification of whether quantitative claims in finish() summaries are actually backed by preceding tool output. Examined 3 sessions with specific numeric claims, tracing each number to its source tool call.

**Sessions checked**: 3

| Session | Agent | Claim | Tool Output Backing | Verdict |
|---------|-------|-------|---------------------|---------|
| s_1774803972154_15 (triage) | (system) | "tsc --noEmit passes cleanly (0 errors)" | bash tsc output showed clean exit | ✅ Backed |
| Optimizer session | optimizer | "56 sessions/5.1h", "18 errors but 15 from connectivity outage (13:06-13:21)" | bash output: `=== Sessions since 11:33 UTC (56 total, 335 ops) === Time: 5.1h, 10.9/hr, 65 ops/hr ... Errors: 18` | ✅ Backed — exact numbers from tool output |
| Bob session | bob | "EXP-216 was marked COMPLETED but never actually run" | todo.md shows EXP-216 delegated to Coach (req:65b37587); requests DB shows req:65 auto-completed without evidence of actual run | ✅ Backed — claim traced to DB records |

**Conclusion**: ✅ Still compliant. All 3 numeric claims traced directly to bash/tool output. No fabricated numbers. Agents are echoing exact tool output data (not rounding, not approximating). The "56 sessions" number came from a bash query that computed `56 total` — the optimizer reported exactly "56 sessions."

**Trend**: Stable ✅ across 3 verifications (2026-03-26, 2026-03-27, now 2026-03-29).

**Action**: No Growth Cycle needed. Continue monitoring.

---


### #7 — C1.7: Success Requires Evidence (2026-03-24)

**Rule**: "Run at least one verification command (grep, ls, test, read-back) before calling finish(success)."

**Sessions checked**: 4

| Session | Agent | Last tool before finish(success) | Verdict |
|---------|-------|----------------------------------|---------|
| s_1774344815665_23 | bob (gemini-3-pro) | `edit` on focus-tasks.md | ❌ No read-back after final edit |
| s_1774343164349_11 | tech-lead | `mv` (moving brief files) | ❌ State-changing, not verification |
| s_1774334166333_6 | tech-lead | `cat >> journal.md` | ❌ Appending to journal, not verification |
| s_1774355615746_73 | coach | `agents.send` (after 2 bash verifications) | ⚠️ Did verify, but last action was delegation |

**Evidence quotes**:

1. **s_1774344815665_23**: Final tool call before finish was:
   ```
   edit(path: "agents/shared/focus-tasks.md", oldText: "...[ESCALATED]...", newText: "...[ESCALATED]...")
   ```
   Then immediately `finish(status: "success")`. No read-back of the edited file.

2. **s_1774343164349_11**: Final tool call before finish was:
   ```
   bash("mv agents/bob/workspace/brief-infra-verification-evidence.md agents/bob/workspace/sent/...")
   ```
   File move, not verification.

3. **s_1774334166333_6**: Final tool call before finish was:
   ```
   bash("cat >> agents/bob/workspace/journal.md <<'EOF' ...")
   ```
   Journal append, not verification.

**Conclusion**: C1.7 is systematically violated across agents. 3/4 sessions call `finish(success)` without a preceding verification command. This aligns with the FM-3.3 failure mode pattern identified in evaluator data.

**Action**: Added to Growth Cycle queue — but note this may require infra enforcement (the `verification_evidence` field proposal in `agents/bob/workspace/brief-infra-finish-verification.md` already targets this).


### #7 — C1.7: Success Requires Evidence — RE-VERIFICATION (2026-03-26)

**Rule**: "Run at least one verification command (grep, ls, test, read-back) before calling finish(success)."

**Method**: Searched 15 recent sessions (last 24h) with finish(success). Examined 6 in detail, focusing on the last 3-5 tool calls before the finish invocation.

**Sessions checked**: 6

| Session | Agent | Last tools before finish | Verification present? | Verdict |
|---------|-------|--------------------------|----------------------|---------|
| s_1774528420235_453 | bob (claude) | grep, ls, sed, git commit → edit → agents.send → finish | ✅ Multiple verification commands (grep -n, ls -la, grep -c, sed -n) before commit | ✅ |
| s_1774528416748_451 | may (claude) | bash(wc -c + head -5) → finish | ✅ Direct verification of deployed file | ✅ |
| s_1774524072190_442 | tech-lead (claude) | tsc --noEmit → git commit → git diff --stat → grep → echo → finish | ✅ tsc + git diff + grep | ✅ |
| s_1774528772799_457 | coder (claude) | vitest run --reporter=verbose → tsc --noEmit → finish | ✅ Test suite + compilation check | ✅ |
| s_1774526249966_448 | bob (gemini) | read → checkpoint → write → agents → agents → finish | ❌ No verification after write. Write preview is not a verification command. | ❌ |
| s_1774524822910_443 | bob (claude) | bash(mv) → write(brief) → finish | ⚠️ Earlier SOUL trim verified with wc -c, but last write (brief) unverified | ⚠️ |

**Evidence quotes**:

1. **s_453 (bob, ✅)**: Before finish, ran: `grep -n`, `ls -la src/lib/guards/`, `grep -c`, `sed -n '1013,1024p' src/lib/manager.ts`, then `git commit`. Summary claims "TSC clean" and "All wired into manager.ts" — both backed by tool output.

2. **s_451 (may, ✅)**: Immediately before finish, ran: `bash("wc -c agents/shared/common-sense.md && head -5 agents/shared/common-sense.md")` — confirmed 1,140 bytes and correct header. Summary claims "3,478→1,140 bytes" — verified.

3. **s_457 (coder, ✅)**: Last two commands before finish: `vitest run test/harness-guards.test.ts --reporter=verbose` (20/20 tests pass) and `tsc --noEmit` (exit 0). Summary claims "All 20 tests pass" and "TypeScript compiles with zero errors" — both directly backed.

4. **s_448 (bob/gemini, ❌)**: Wrote `design-harness-guards.md` (4076 bytes), then two `agents.send` calls, then finish. No grep, read-back, or ls after the write. The `write` tool returned a preview, but C1.7 requires an explicit verification *command*.

**Conclusion**: ⚠️ Improved from ❌ (2026-03-24). Compliance is now 4/6 (67%), up from 1/4 (25%) two days ago. Key observations:
- **Claude-powered agents** (bob, may, coder, tech-lead) are now largely compliant, running tsc, vitest, grep, wc -c, or git diff before finishing. This may reflect SOUL.md changes or infra guards (WorkVerifyGuard) deployed in recent sessions.
- **Gemini-powered agent** (bob in s_448) still violates — writes a deliverable and finishes without verification.
- **Remaining gap**: Sessions ending with `write` + `agents.send` + `finish` skip verification of the final write. The write tool preview is treated as sufficient, but C1.7's letter requires an explicit verification command.

**Action**: Keep monitoring. The trend is positive. Consider whether the new WorkVerifyGuard (deployed in s_453) will catch the remaining violations mechanically. The Gemini-specific gap may need model-specific SOUL tuning.


### #7 — C1.7: Success Requires Evidence — RE-VERIFICATION (2026-03-28 17:06Z)

**Rule**: "finish(success) requires evidence — before calling finish with status 'success', you must have tool output in your transcript showing the work product is correct."

**Method**: Sampled 10 recent sessions with `finish(status: "success")` from last 12h. For each, checked the last 2-3 tool calls before `finish()` to determine whether they constituted verification of deliverables (grep, ls, test runs, etc.) vs. mere content creation (write, edit, cat >>).

**Sessions examined** (6 bob, 1 coach, 3 unknown-agent):

| Session | Agent | Pre-finish tool | Verification? | Compliant? |
|---------|-------|----------------|---------------|------------|
| s_801 | bob | `grep -c "Session 2026-03-28 16:03" journal.md` | Confirms journal entry exists | ✅ |
| s_798 | bob | `grep "Session..." + ls archive/ + ls brief-*.md` | Triple verification of journal, archive, briefs | ✅ |
| s_792 | bob | `grep "2026-04" periodic-tasks.md` | Checking date content, not deliverable verification | ⚠️ |
| s_787 | coach | `cat >> journal.md` (last tool was a write, not verify) | No verification step before finish | ❌ |
| s_783 | bob | `grep -c "Session 2026-03-28 13:03" journal.md` | Confirms journal entry | ✅ |
| s_778 | bob | `grep "Session 2026-03-28 12:03" journal.md \| wc -l` | Confirms journal entry count | ✅ |
| s_768 | unknown | `git log --oneline 31895e7..HEAD` | Verifies commits exist | ✅ |
| s_764 | unknown | `grep -n "TEST BLOCKED" skill-test-results.md` | Verifies content in output file | ✅ |
| s_762 | unknown | `sed -i ... + grep "Skill lifecycle"` | Mixed write+verify in one command | ⚠️ |
| s_757 | unknown | `ls -lt .state/sessions/active/` | Checking state, not deliverable verification | ⚠️ |

**Results**: 7/10 compliant (✅), 3/10 partial (⚠️ or ❌)
- **Bob**: 4/5 compliant — strong pattern of `grep -c` verification of journal entries and deliverables before finish. One session (s_792) ended with a date check rather than explicit deliverable verification.
- **Coach**: 0/1 compliant — s_787 (coach-as-experiment-runner) ended with a journal write (`cat >> journal.md`) with no subsequent verification that the write succeeded.
- **Unknown agents**: 2/3 compliant — git log and grep verification common; one mixed write+verify, one state check.

**Trend**: ✅ → Upgraded from ⚠️ to ✅. Compliance improved from 4/6 (67%) on 2026-03-26 to 7/10 (70%). Bob has fully internalized the pattern (consistent grep-count verification). The few violations are minor (incomplete verification, not total absence). Coach's experiment-running sessions skip verification under time pressure but this is not a systemic gap.

**Action**: Maintain ✅ status. No intervention needed. Continue monitoring in ~2 days to confirm stability.

---


### #7 — C1.7: Success Requires Evidence — RE-VERIFICATION #4 (2026-03-30 09:06Z)

**Rule**: "Run at least one verification command (grep, ls, test, read-back) before calling finish(success)."

**Method**: Searched 10 sessions with `finish(status:"success")` from the last 6h (2026-03-30 03:00–09:00). For each, checked: (a) whether the last tool call before final `finish` was a verification command (`bash`, `read`, `grep`), (b) whether the `verification_evidence` field was present, (c) whether Gate 3 (verify-after-edit) rejected any initial finish attempts.

**Sessions checked**: 10

| Session | Agent | Last Tool Before Finish | verification_evidence | Gate 3 Rejections | Verdict |
|---------|-------|------------------------|----------------------|-------------------|---------|
| s_1774860413535_9 | Coach | bash | ✅ (scenario.json + task.md confirmed) | 0 | ✅ |
| s_1774860202691_8 | Coach | bash | ✅ (gym-run baseline + success_criteria review) | 2 | ✅ (gate-enforced) |
| s_1774860000387_7 | Scout | bash | ✅ (scrape_webpage + grep journal) | 1 | ✅ (gate-enforced) |
| s_1774858200057_3 | Optimizer | bash | ✅ (DB queries: sessions, quality rate, ops) | 2 | ✅ (gate-enforced) |
| s_1774858200037_2 | Bob | bash | ✅ (grep tc.isError, git log, C12.1 pass rate) | 3 | ✅ (gate-enforced) |
| s_1774856395939_91 | Coach | finish (nested) | ✅ (bash for-loop + tail experiments.jsonl) | 1 | ✅ (gate-enforced) |
| s_1774854376628_85 | unknown | — | ✅ | 0 | ✅ |
| s_1774854600812_86 | Bob | — | ✅ | 2 | ✅ (gate-enforced) |
| s_1774854600831_87 | Optimizer | — | ✅ | 1 | ✅ (gate-enforced) |
| s_1774854600862_88 | QA | — | ✅ | 0 | ✅ |

**Results**: 10/10 compliant (100%). All sessions have `verification_evidence` fields with specific tool output references.

**Key finding — Gate 3 is the enforcement mechanism**: 7/10 sessions had at least 1 gate rejection. This means agents attempted to call `finish(success)` without sufficient verification, and the gate **blocked them** and required a verification command before retrying. The agents complied — running `bash` verification commands — then called `finish` again successfully. This is infrastructure enforcement working as designed.

**Evidence quotes**:

1. **s_1774858200057_3 (Optimizer, gate-enforced)**: First finish was rejected with message: "verification AFTER your last edit. Before calling finish(), you must verify your changes using at least one of: 1. read() — read back the changed file to confirm correctness 2. bash(...)." Optimizer then ran a `bash` command and called `finish` successfully with `verification_evidence` field populated.

2. **s_1774858200037_2 (Bob, 3 gate rejections)**: Bob's session had 3 gate rejections — the most of any session. This suggests Bob's natural tendency is still to finish without verification, but the gate consistently catches and corrects this.

3. **s_1774860413535_9 (Coach, 0 gate rejections)**: Coach verified with `bash` and `read` before the first `finish` attempt — no gate rejection needed. This may indicate internalized behavior (the agent learned from prior gate rejections).

**Trend comparison**:

| Metric | 2026-03-24 | 2026-03-26 | 2026-03-28 | 2026-03-30 | Trend |
|--------|-----------|-----------|-----------|-----------|-------|
| Compliance rate | 1/4 (25%) | 4/6 (67%) | 7/10 (70%) | 10/10 (100%) | ✅ ↑↑ |
| Gate 3 rejections | N/A | N/A | N/A | 7/10 sessions | NEW |
| verification_evidence present | 0/4 | ~2/6 | ~7/10 | 10/10 | ✅ ↑↑ |

**Conclusion**: ✅ Confirmed stable. C1.7 compliance is now 100% (10/10) — a dramatic improvement from 25% on 2026-03-24. The improvement is primarily due to Gate 3 infrastructure enforcement (70% of sessions needed gate intervention). Some agents (Coach in s_9) show internalized behavior (0 gate rejections), while others (Bob in s_2, 3 rejections) still rely on the gate. The combination of behavioral training + infrastructure enforcement has been highly effective.

**Action**: No Growth Cycle needed. C1.7 is effectively solved by Gate 3. Monitor whether gate rejection rates decrease over time (indicating behavioral internalization vs. continued reliance on infrastructure).

---


### #7 — C1.7 Success Requires Evidence — Re-verified 2026-03-30T13:06Z

**Rule**: "Run at least one verification command (grep, ls, test, read-back) before calling finish(success)."

**Method**: Examined 15 most recent sessions in `.state/sessions/history/`. Checked all `finish(status: "success")` calls for `verification_evidence` field presence and content.

**Sessions checked**: 15 (of which 8 ended with finish(), 7 with success status)

| Session | Agent | Status | Evidence Items | Verdict |
|---------|-------|--------|---------------|---------|
| s_27 | ? | success | 0 | ❌ No verification_evidence |
| s_19 | optimizer | success | 4 | ✅ |
| s_18 | bob | success | 4 | ✅ |
| s_17 | bob/coder | partial | 5 | ✅ (correct use of partial) |
| s_20 | qa | success | 2 | ✅ |
| s_16 | ? | success | 0 | ❌ No verification_evidence |
| s_14 | coach | success | 6 | ✅ |
| s_13 | qa | success | 7 | ✅ |

**Sessions without finish()**: s_28 (evaluator, 2 lines), s_25/s_24/s_23/s_22/s_21 (all 5 lines — early crashes/timeouts), s_15 (48 lines — possible timeout before finish).

**Compliance**: 5/7 finish(success) sessions (71%) included `verification_evidence`. 2/7 (29%) called success with 0 evidence items.

**Regression Analysis**: Prior check (2026-03-30T05:06Z) found 10/10 compliant. This sample shows a regression, though the 2 violators could be agents whose sessions predate Gate 3 enforcement or whose SOUL prompts don't include the C1.7 reminder.

**Also concerning**: 7/15 sessions (47%) had no finish() call at all. 6 of these were very short (2-5 lines = early crashes), but this is a higher no-finish rate than previously observed.

**Conclusion**: ⚠️ Downgraded from ✅. The 71% evidence-with-success rate is a regression from 100%. Need to investigate whether Gate 3 is still active and whether the 2 violating sessions had the guard in their system prompt.

**Action**: Monitor for another cycle. If the pattern persists, may need a Growth Cycle to reinforce C1.7 compliance or investigate Gate 3 infrastructure changes.

---


### #7 — C1.7 Success Requires Evidence — RE-VERIFICATION #6 (2026-03-30 21:06Z)

**Rule**: "Run at least one verification command (grep, ls, test, read-back) before calling finish(success)."

**Method**: Examined 20 most recent sessions in `.state/sessions/history/`. Extracted all `finish(status: "success")` calls and checked `verification_evidence` field presence and content. Cross-referenced with actual tool calls to determine if verification was performed even when evidence field was missing.

**Sessions checked**: 20 (of which 17 ended with finish(success))

| Session | Agent | Evidence Items | Verdict |
|---------|-------|---------------|---------|
| s_21 (may) | may | 2 | ✅ |
| s_18 (bob) | bob | 4 | ✅ |
| s_17 (coach) | coach | 5 | ✅ |
| s_15 (qa) | qa | 2 | ✅ |
| s_14 (bob) | bob | 4 | ✅ |
| s_13 (may) | may | 0 | ❌ "Nothing to do" heartbeat — ran agents.requests + bash ls but no evidence field |
| s_12 (qa) | qa | 2 | ✅ |
| s_11 (bob) | bob | 5 | ✅ |
| s_10 (bob) | bob | 4 | ✅ |
| s_8 (scout) | scout | 3 | ✅ |
| s_7 (may) | may | 0 | ❌ "Nothing to do" heartbeat — same pattern as s_13 |
| s_5 (optimizer) | optimizer | 6 | ✅ |
| s_4 (bob) | bob | 5 | ✅ |
| s_2 (amy-kimi) | amy-kimi | 0 | ❌ Ran bash/read before finish but omitted evidence field |
| s_0 (tech-lead) | tech-lead | 0 | ❌ Connectivity test session — not a real task |
| s_78 (prior day) | — | — | (not counted — different day) |

**Compliance**: 13/17 finish(success) sessions (76.5%) included `verification_evidence` with substantive items.

**Analysis of 4 violations**:

1. **s_13 and s_7 (May heartbeats)**: Both are identical "nothing to do" patterns — May ran `agents.requests(filter:"active")` + `bash(ls .state/sessions/active/)`, found no work, called finish(success) without evidence field. These sessions *did* run verification commands (checking for pending work), but the summary-only nature of the task means there's nothing to "verify" in the traditional sense. The evidence is implicit: "I checked and found nothing."

2. **s_2 (amy-kimi)**: Ran 5+ bash/read commands before finish (browsing XHS feed, checking journal), but omitted `verification_evidence` entirely. This agent likely lacks the C1.7 training in its SOUL/heartbeat.

3. **s_0 (tech-lead connectivity test)**: A 3-tool-call test session (`agents.fork`, `agents.context`, `agents.peek`). Not a real task — just testing agent infrastructure.

**Key insight**: All 13 substantive task sessions (bob, coach, qa, optimizer, scout) included evidence. The 4 violations are all edge cases:
- 2 × May "nothing to do" (no deliverable to verify)
- 1 × amy-kimi (likely no C1.7 in SOUL)
- 1 × connectivity test (not a real task)

**Trend across verifications**:
| Date | Compliance | Notes |
|------|-----------|-------|
| 2026-03-24 | 1/4 (25%) | Initial check — systematic violation |
| 2026-03-26 | 4/6 (67%) | WorkVerifyGuard deployed |
| 2026-03-28 | 7/10 (70%) | Bob strong, Gemini weak |
| 2026-03-30 AM | 5/7 (71%) | Small sample, 2 unknown-agent violations |
| **2026-03-30 PM** | **13/17 (76.5%)** | **All substantive sessions compliant. Violations are edge cases only.** |

**Conclusion**: ⚠️ Maintaining ⚠️ status due to 4 missing-evidence sessions, but the practical compliance is excellent. Every agent executing a real task with deliverables includes verification_evidence. The remaining gap is:
- May "nothing to do" heartbeats (debatable whether evidence is needed when the task outcome is "no work found")
- amy-kimi agent (needs C1.7 in its configuration)

**Recommendation**: Consider upgrading to ✅ if May heartbeats are excluded from the metric (no deliverable = no evidence needed). The core intent of C1.7 — "verify your work products before claiming success" — is being followed by all substantive sessions. No Growth Cycle needed. If amy-kimi is a permanent agent, add C1.7 to its SOUL/heartbeat.

---


### #8 — Simple first (2026-03-25)

**Rule**: "Try the simplest approach. If it works, stop. Don't over-engineer, don't add unnecessary complexity, don't 'improve' things that aren't broken."

**Method**: Examined 5 recent sessions with implementation/design decisions. Analyzed whether agents chose minimal approaches or over-engineered solutions. Also reviewed the git log for complexity signals.

**Sessions checked**: 5

| Session | Agent | Task | Approach Taken | Verdict |
|---------|-------|------|---------------|---------|
| s_1774470820970_294 | tech-lead | Agent Archetype Inheritance | 5-point plan: add field, merge configs, prepend SOUL.md, skip `_` dirs, validate. 4 files, 98 insertions. Clean and minimal. | ✅ Simple |
| s_1774470820949_293 | tech-lead | Auto-evolve experiment results | Found experiment already done in prior session. Reported results, logged, updated catalog. Didn't redo work. | ✅ Simple |
| s_1774463125569_272 | coach | SOUL.md variations for experiment | Created 5 variations with clear hypotheses. Each is a simple mutation (add skill, remove constraints, add planning, identity change, simplify). No complex framework. | ✅ Simple |
| s_1774465416938_286 | may | Check for stuck sessions | Found no stuck sessions, no new tasks. 4 stale items already handled. Declared nothing needed. Didn't invent work. | ✅ Simple |
| s_1774460020916_251 | tech-lead | Multiple task processing | Processed tasks sequentially: restore LESSONS.md loading (1 file edit), create zombie cleanup handler (1 new file + cron entry). Each task = simplest possible implementation. | ✅ Simple |

**Evidence quotes**:

1. **s_294 (tech-lead, ✅ — clean minimal design)**: The agent explicitly chose the "cleanest approach" with a 5-point plan:
   > "Good. Now I have a complete understanding. The cleanest approach:
   > 1. Add `extends` to `AgentConfig`
   > 2. Add `archetypeDir` to `SubagentDefinition` (optional string)
   > 3. In `loadAgentConfig`, merge archetype + instance configs
   > 4. In `resolveSystemPrompt`, if `archetypeDir` is set, prepend archetype SOUL.md
   > 5. In `loadAgents`, skip dirs starting with `_`"
   
   The implementation touched only 4 files with 98 insertions — proportional to the feature. Config merge is shallow (not deep), tools are deduped (not a complex merge strategy), and SOUL.md is simply concatenated (not templated/parsed). No unnecessary abstractions introduced.

2. **s_293 (tech-lead, ✅ — didn't redo work)**: Agent discovered the auto-evolve experiment was "already complete from prior session." Rather than re-running or adding layers, it simply reported the results: "0/5 SOUL mutations improved failing scenarios, 2/5 caused regression." This is a "Simple first" win — the agent recognized existing work was sufficient and didn't add unnecessary complexity.

3. **s_272 (coach, ✅ — simple mutations)**: Created 5 SOUL.md variations. Each is a single, targeted change: v01 adds a "double-check" skill, v02 removes constraints, v03 adds step-by-step planning, v04 changes identity framing, v05 dramatically simplifies. No complex variation framework or meta-templating — just 5 distinct files with clear hypotheses.

4. **Git log review**: Recent commits show proportional changes:
   - `f10cfde feat: implement agent archetype inheritance` — single feature, clean commit
   - `52093fa restore LESSONS.md loading` — 1-line fix for a specific gap
   - `f4b83c6 fix: restore DOMAIN.md loading` — same pattern, targeted fix
   - `786c884 feat: Path Assumption Guard` — preventive guard, single concern
   - `d4ca28a feat: Ghost Deliverable Guard` — preventive guard, single concern
   
   No commits show signs of over-engineering (no "refactor everything" commits, no unnecessary abstraction layers, no premature optimization).

**Negative evidence search**: Searched recent sessions for over-engineering indicators:
- "abstract base class" / "factory pattern" / "generic framework": **0 matches** in last 30 sessions
- "while we're at it" / "might as well" / "let's also": **0 matches** indicating scope creep during implementation
- Commits with "refactor" in message: Only `a080cb2 refactor(gym): use effective prompt hash instead of config file hash` — this is a targeted, justified refactor (switching hash inputs), not gratuitous restructuring.

**Conclusion**: ✅ Compliant. Across all 5 sessions examined, agents consistently choose minimal, proportional approaches. Key positive patterns:
- **Tech-lead**: Explicitly labels approach as "cleanest" and implements with minimum necessary changes (4 files, shallow merge, simple concatenation).
- **Coach**: Creates simple, testable variations rather than building a complex variation framework.
- **May**: When finding nothing to do, reports "nothing needed" rather than inventing work.
- **All agents**: No instances of over-abstraction, premature optimization, or scope creep in recent sessions.

The git log corroborates this: commits are focused, single-concern changes. No "big bang" refactors or unnecessary abstraction layers.

**Action**: No Growth Cycle needed. This is one of the strongest compliance areas. The system's existing constraints (turn budgets, heartbeat structure, SOUL.md guidance) naturally encourage simplicity by limiting the scope agents can tackle in a single session.

---


### #8 — Simple first (Re-verified 2026-03-28)

**Rule**: "Try the simplest approach. If it works, stop. Don't over-engineer, don't add unnecessary complexity, don't 'improve' things that aren't broken."

**Method**: Re-verification 3 days after initial check. Examined 6 recent sessions (last ~24h) with implementation decisions (3+ edits/writes each), plus git commit diffs. Also searched 30 sessions for over-engineering lexical signals.

**Sessions checked**: 6

| Session | Agent | Task | Approach Taken | Verdict |
|---------|-------|------|---------------|---------|
| s_1774652626606_687 | coach | Scenario bug fix (exact-verification regex) | Found root cause (regex too strict for `cd && node ...` pattern), single regex edit. Verified fix against transcripts. No refactor of test framework. | ✅ Simple |
| s_1774659827020_701 | coach | Missing scenario.json + status update | Found missing `scenario.json`, created from template. Updated focus-tasks. Analyzed comprehension gap frontier — documented as insight, explicitly chose NOT to build a solution yet. | ✅ Simple |
| s_1774649026580_685 | scout | Cross-layer attack taxonomy CR | Gathered building blocks from 4+ existing deep-dives, synthesized into 1 new document. No framework/tool creation — just analysis + writing. | ✅ Simple |
| s_1774652626644_688 | optimizer | Periodic task updates | Updated 3 periodic tasks with timestamps. 8 sessions tracked. No scope creep — processed each task sequentially. | ✅ Simple |
| s_1774654426486_695 | scout | Constitutional evolution theory CR | Read existing CRs for context, wrote 1 new research document. Single deliverable, no infrastructure changes. | ✅ Simple |
| s_1774659827060_702 | optimizer | Periodic task updates + overnight health | Updated 3 tasks, confirmed 14 sessions healthy. Clean close — no invented work. | ✅ Simple |

**Evidence highlights**:

1. **s_687 (coach, ✅ — targeted regex fix)**: Agent found the `runs-exact-verification` check was too strict — the coder's `cd /tmp/gym-run-XXX/work && node src/processor.test.js` command was failing the regex `^\s*node\s+src/processor\.test\.js\s*$`. Fix: widen regex to accept optional `cd` prefix and `2>&1` suffix. **One edit, one file, validated against real transcripts.** Did NOT propose a "more robust test framework" or "abstract command matching system."

2. **s_701 (coach, ✅ — explicit restraint)**: After analyzing the comprehension gap frontier (Method #15 solves ordering but not knowledge problems), the agent explicitly chose restraint:
   > "The analysis of the comprehension gap frontier is valuable but doesn't need a full brief right now — I should document it as an insight and let Coach continue iterating."
   This is textbook "Simple first" — identify the problem, document, don't over-build.

3. **s_685 (scout, ✅ — synthesis not infrastructure)**: Produced a 455-line cross-layer attack taxonomy. Despite the length, the approach was simple: gather existing material, synthesize, write. No attempt to build an automated taxonomy generator or abstract attack framework.

**Git commit analysis** (since 2026-03-27):
| Commit | Description | Size |
|--------|-------------|------|
| `31895e7` | fix: enforce maxTurns as opBudget | 1 file, 5 ins, 1 del |
| `d93ca19` | fix: add retryable errors | 2 files, 9 ins, 1 del |
| `b2beebe` | fix: add ALL missing gym_runs column migrations | 1 file, 10 ins, 1 del |
| `2f1ab59` | fix: load agent skills/*.md into system prompt | 2 files, 22 ins, 13 del |

All commits are small, focused, single-concern fixes. Average: 1.5 files, 11.5 insertions per commit.

**Over-engineering signal search** (30 sessions):
- "might as well" / "while we're at it" / "let's also add": **0 in agent behavior** (only appeared in a previous common-sense-verify session searching for these terms)
- "abstract base" / "factory pattern" / "generic framework": **0 in agent behavior** (same — only in verification meta-discussion)
- "comprehensive rewrite" / "future-proof": **0 matches**

**Conclusion**: ✅ Still compliant. Strongest finding: agents actively exercise restraint when faced with opportunities to over-engineer. The coach in s_701 explicitly chose to "document as insight" rather than build a solution for the comprehension gap. All implementations are proportional to the problem — regex fix for regex bug, single JSON file for missing config, focused updates for periodic tasks.

**Trend**: Stable ✅ across 3 verifications (2026-03-25, now 2026-03-28). This rule shows deep compliance — not just incidental simplicity but active restraint.

**Action**: No Growth Cycle needed. Continue monitoring in 2-3 days.

---


### #9 — One thing at a time (2026-03-25)

**Rule**: "Do one task, verify it worked, then the next. Don't try to fix five things in one shot."

**Method**: Examined 4 recent sessions with high edit/write counts (>4 state-changing calls) to check whether agents verified each change before moving to the next, or batched multiple changes without intermediate verification.

**Sessions checked**: 4

| Session | Agent | Edit/Write Count | Pattern | Verdict |
|---------|-------|-----------------|---------|---------|
| s_1774409617118_113 | tech-lead | 6 edits | 3 consecutive edits without verification, then explicit batch verification | ⚠️ Borderline |
| s_1774404220676_92 | scout | 4 writes, 4 edits | 3 consecutive writes (new files), no intermediate read-back | ⚠️ Borderline |
| s_1774406069735_97 | coach | 4 edits | 3 consecutive edits to method-catalog.md, then separate QA SOUL edit | ⚠️ Borderline |
| s_1774407843638_104 | optimizer | 2 writes | Each write followed by bash verification | ✅ Good |

**Evidence quotes**:

1. **s_113 (tech-lead, ⚠️ — batch edits with deferred verification)**: Tool call sequence shows edit→edit→edit at lines 22/24/26 targeting `implement-and-review.ts` (2 edits) and `verify-parallel.ts` (1 edit). The assistant text before these says:
   > "Clear. The task is to add two-phase framing (Phase 1: DIAGNOSE, Phase 2: VERDICT) to the QA review task templates in both workflow files."
   
   Then between edit #3 and edit #4, a `bash` call to "find and update the re-review tasks." After all edits, the agent explicitly states:
   > "All four QA review task templates updated. Now let me verify the changes by reading back the key sections"
   
   Followed by two bash verification calls and syntax checks. **The agent did verify, but after a batch of 3 edits, not after each one.**

2. **s_92 (scout, ⚠️ — 3 consecutive file creations)**: Tool sequence shows `write`→`write`→`write` at lines 60/62/64, creating:
   - `deep-dive-dd468-abstral.md`
   - `deep-dive-dd469-memcollab.md`
   - `cross-ref-cr256-meta-design.md`
   
   No `read`, `bash`, or `ls` between the three writes. The next tool call (L66) is a `bash` to check journal state, not to verify the 3 written files. **Risk is lower since these are new file creations (write tool confirms content via preview), but the rule says "do one task, verify it worked, then the next."**

3. **s_97 (coach, ⚠️ — 3 consecutive method-catalog edits)**: The 3 edits at lines 43-45 all target `agents/coach/knowledge/method-catalog.md`, followed by a bash verification at L46. Similar to s_113: batch edits with deferred verification.

4. **s_104 (optimizer, ✅ — good sequential discipline)**: Created a `wip-*.md` file (L76 write), then later created a `SKILL.md` (L80 write). At L82, explicitly states: "Let me verify the file was written correctly and then finish:" followed by a bash verification command. Each major deliverable was verified.

**Conclusion**: ⚠️ Borderline. 3/4 sessions batch 2-3 consecutive edits/writes without intermediate verification. However, all 3 borderline sessions perform explicit batch verification *after* the group of changes — none skip verification entirely. The pattern is "batch similar edits → verify the batch" rather than the ideal "one edit → verify → next edit → verify." The optimizer session (s_104) demonstrates the ideal pattern.

**Mitigating factors**: (a) The `edit` tool returns a diff preview, so syntax/content errors are visible immediately without a separate read-back. (b) The `write` tool returns a content preview. (c) The batched edits are typically related changes to the same logical task (e.g., updating 3 review templates with the same two-phase framing). These are arguably "one thing" done across multiple files, not "five different things."

**Action**: No Growth Cycle needed — this is a borderline pattern where the spirit of the rule (don't try to fix five things at once) is being followed even if the letter (verify after each edit) is slightly bent. The batch-then-verify pattern is pragmatic for related changes. If verification failures increase, consider adding a SOUL guard recommending intermediate verification for batches of 3+ edits.

---


### #9 — One thing at a time — RE-VERIFICATION (2026-03-27 01:06Z)

**Rule**: "Do one task, verify it worked, then the next. Don't try to fix five things in one shot."

**Method**: Searched 35 recent sessions for those with >3 edit/write calls. Found 4 sessions with 4-14 edits/writes. Examined the tool-call sequences for batching vs sequential verify patterns.

**Sessions checked**: 4

| Session | Agent | Edit/Write Count | Consecutive unverified edits | Post-batch verification? | Verdict |
|---------|-------|-----------------|----------------------------|--------------------------|---------|
| s_1774548223890_490 | scout | 7 (1 write, 6 edit) | 5 (journal + 4 × todo) | read after batch | ⚠️ Heavy batching |
| s_1774562625038_506 | scout | 7 (1 write, 6 edit) | 5 (journal + 4 × todo) | read after batch | ⚠️ Same pattern |
| s_1774557224962_499 | optimizer | 4 edits | 4 (all periodic-tasks.md) | ✅ grep verification: `grep -n "Last done: 2026-03-26T20:33"` + `grep -c "Last done:"` | ⚠️ Batch-then-verify |
| s_1774546424439_488 | optimizer | 4 (1 write, 3 edit) | 3 (periodic-tasks.md) | ✅ Agent says "Good, finding written. Now let me verify it exists:" after write. Then `wc -l + grep` verification. After 3 edits: `grep "Last done:"` | ✅ Best pattern |

**Evidence quotes**:

1. **Scout s_490 (⚠️ — 5 consecutive edits, no intermediate verification)**: Tool sequence shows edit(journal) → edit(todo) → edit(todo) → edit(todo) → edit(todo) → read. Between each edit, the assistant text is brief imperative like "Now update the todo to mark the circuit breaker lead as done" and "Now mark the circuit breaker lead as done:" — no verification between them. The `read` call comes only after all 5 edits. These 5 edits target 2 files (journal + todo), making 4 related changes to todo.md. The edit tool's diff preview was the only check between changes.

2. **Scout s_506 (⚠️ — same scout pattern)**: Same scout behavior: write(deep-dive) → read → read → edit(journal) → edit(todo) × 4 → read → edit(postboard) → read. The 5 consecutive edits (journal + 4 todo) have no intermediate bash/grep/ls verification. Again, all are logically related (recording a new CR and updating todo bookkeeping).

3. **Optimizer s_499 (⚠️ — batch but with explicit verify intent)**: 4 edits to periodic-tasks.md, then agent explicitly states: "Good. Now let me verify the edits are correct:" and runs `grep -n "Last done: 2026-03-26T20:33" agents/optimizer/periodic-tasks.md`, followed by: "All 3 periodic tasks updated to 20:33. I'm at 19 tool calls. Let me verify the overall consistency:" with `grep -c "Last done:"`. The batch is verified, but verification happens after 4 edits, not between them.

4. **Optimizer s_488 (✅ — improving pattern)**: write(finding) → bash(`wc -l + grep` to verify finding) → 3 bash calls (analysis work) → 3 edits(periodic-tasks) → bash(`grep "Last done:"` verification). Agent explicitly verifies the write before moving to edits: "Good, finding written. Now let me verify it exists:" Then after the 3 periodic-tasks edits: "Good. Let me verify the periodic-tasks.md updates are correct:" This is the closest to the ideal edit→verify→edit→verify pattern while still batching same-file edits.

**Comparison with previous check (2026-03-25)**:

| Metric | 2026-03-25 | 2026-03-27 | Trend |
|--------|-----------|-----------|-------|
| Sessions with batching (no intermediate verification) | 3/4 (75%) | 3/4 (75%) | Flat |
| Max consecutive unverified edits | 3 | 5 | ⚠️ Worse (scout) |
| Post-batch verification rate | 3/3 (all batchers verify after) | 3/3 (all batchers verify after) | Stable |
| Agent with best pattern | optimizer (s_104) | optimizer (s_488) | Consistent |

**Key observations**:
- **Scout is the heaviest batcher**: 5 consecutive edits without intermediate verification in both examined sessions. The edits are all logically related (bookkeeping after producing a deep-dive/cross-reference), but the rule says "one thing at a time, verify it worked."
- **Optimizer is improving**: s_488 shows a write→verify→edits→verify pattern that's closer to the ideal. The optimizer explicitly narrates verification intent between phases.
- **All agents verify eventually**: No session finishes with unverified changes. The pattern is consistently "batch similar edits → verify the batch" rather than "skip verification entirely."
- **Mitigating factor**: The `edit` tool returns diff previews inline, giving the agent immediate visual feedback. True errors (wrong content, wrong file) are caught by the preview without a separate verification step. The rule's risk (applying a wrong change and building on it) is partially mitigated by this tool behavior.

**Conclusion**: ⚠️ Still borderline. The batch-then-verify pattern persists across agents, especially scout. The spirit of the rule (don't try to fix five things at once) is partially followed — agents batch *related* changes (same logical task), not five *different* tasks. But the letter of the rule (verify each change before the next) is consistently bent.

**Action**: No Growth Cycle needed. The batch-then-verify pattern is pragmatic for related bookkeeping changes (e.g., 4 todo edits after a new deep-dive). If errors caused by unverified intermediate edits are observed, escalate to a SOUL guard. Current risk is low since edit tool previews provide implicit feedback.

---


### #13 — Finish clearly (2026-03-25)

**Rule**: "End every task with `finish(status, summary)`. State what you did, what worked, what didn't."

**Method**: Examined 45 real agent sessions (>5 lines) from the 50 most recent sessions. Checked whether each ended with a `finish()` call, and assessed the quality of status/summary fields.

**Sessions checked**: 45 sessions, 6 examined in detail for quality

**Compliance rate**: 36/45 (80%) called `finish()`. All 9 missing sessions are QA (Gemini model).

| Category | Count | Rate | Notes |
|----------|-------|------|-------|
| Sessions with finish() | 36 | 80% | Includes success, partial, blocked |
| Sessions without finish() | 9 | 20% | ALL are QA agent sessions |
| Non-QA sessions with finish() | 36/36 | 100% | coach, optimizer, may, tech-lead, coder, bob — all finish |

**Sessions WITHOUT finish() (all QA/Gemini)**:

| Session | Lines | Last Tool | Likely Cause |
|---------|-------|-----------|-------------|
| s_1774456360929_237 | 21 | read | Timed out mid-consolidation task |
| s_1774449410191_224 | 6 | bash | Timed out early |
| s_1774449329481_222 | 6 | bash | Timed out early |
| s_1774449220297_219 | 28 | write | Timed out mid-review (cut off at "### Checks") |
| s_1774446047109_209 | 6 | bash | Timed out early |
| s_1774445961084_207 | 8 | bash | Timed out early |
| s_1774445773487_205 | 6 | bash | Timed out early |
| s_1774445694150_203 | 9 | bash | Timed out early |
| s_1774445621908_201 | 27 | bash | Timed out mid-task |

**Finish quality for sessions WITH finish() (6 examined)**:

| Session | Agent | Status | Summary Quality | Deliverables? | Verdict |
|---------|-------|--------|-----------------|---------------|---------|
| s_228 | coder | success | ✅ States both parts of task, verification method, what was already done vs new | ✅ Yes | ✅ Excellent |
| s_243 | may (optimizer) | success | ✅ 4 numbered items, each with specific outcome | ✅ Yes (2 files) | ✅ Excellent |
| s_242 | tech-lead | success | ✅ States verification scope (15 files), discovery (LESSONS.md gap), delegation | — | ✅ Good |
| s_245 | coach | success | ✅ States pattern diagnosed, method selected, deliverables listed | ✅ Yes | ✅ Excellent |
| s_238 | may | partial | ✅ Clear explanation: what works (binary exists, symlink correct), what's blocked (PID 7 still old) | — | ✅ Correct use of partial |
| s_235 | (unknown) | success | ✅ Detailed: journal lines, date range, new knowledge file, archive location | — | ✅ Excellent |

**Evidence quotes**:

1. **Coder s_228 (✅ — clear finish)**: `finish(status: "success", summary: "Completed P0 task req:bb0c8273 (Fix Critical Context Gap + Standardize Heartbeats). Part 1 (DOMAIN.md loading) was already done in commit f4b83c6. Part 2: evaluator and master already had the FM-3.3 guard; delegated to coder to add it to optimizer/heartbeat.md (now on line 20). All 3 target heartbeats verified via grep — 1 match each.")`

2. **May s_238 (✅ — correct partial status)**: `finish(status: "partial", summary: "Triaged P0 restart request (req:e535d4d8). Binary bundle/may-agent-f4b83c6 exists and symlink is correct, but PID 7 still runs old may-agent-b9ef77e. Restart blocked on Hao. No stuck sessions, system clean.")` — Correctly uses `partial` instead of `success` when blocked.

3. **QA s_219 (❌ — no finish)**: Session ends mid-text: `"...The scenario JSON is fine, but the accompanying Vitest test does not actually assert that 'verification evidence was cited' (it contains a placeholder expect(true).toBe(true)), so it won't catch"` — Cut off without any `finish()` call. This is a timeout, not a deliberate omission.

**Conclusion**: ⚠️ Borderline. Non-QA agents are 100% compliant with high-quality finish calls that include clear status, specific summaries, deliverables, and correct use of partial/blocked when appropriate. QA (Gemini) has a systematic timeout problem causing 9/9 of the missing-finish sessions. The issue is not behavioral (QA doesn't choose to skip finish) — it's a resource/timeout constraint.

**Action**: No Growth Cycle needed for finish compliance itself. The QA timeout issue is an infrastructure/model concern (Gemini sessions appear to run out of context or hit timeout before reaching finish). Consider: (a) QA heartbeat should have an earlier checkpoint to avoid total loss, or (b) investigate QA session timeout settings.

---


### #14 — Correct > fast (2026-03-26)

**Rule**: "Wrong answers create more work than slow answers."

**Method**: Examined 4 recent sessions across 3 agents (optimizer, coder/bob, coder) for evidence of correctness-over-speed tradeoffs: self-correction, deep investigation before acting, multi-step verification, and willingness to abandon incorrect assumptions.

**Sessions checked**: 4

| Session | Agent | Key Behavior | Verdict |
|---------|-------|-------------|---------|
| s_1774483422916_318 | optimizer | Checkpoint said bug existed; verified first, found it didn't. Abandoned the fix instead of applying it blindly. | ✅ Excellent self-correction |
| s_1774485222806_322 | bob (coder) | Multi-phase verification of archetype migration: read loader code, called coder identity probe, checked agent.json, ran diff. 4+ verification steps. | ✅ Thorough verification |
| s_1774485263892_323 | coder | Read file first → edit → "verify all 4 requirements by reading back the relevant sections and running tsc" → explicit 4-point confirmation. | ✅ Systematic verification |
| s_1774485323370_325 | coder | Found test failure, deeply investigated root cause (read source, understood inheritance vs validation gap), planned fix, implemented, ran tsc + vitest + structural grep. | ✅ Deep investigation |

**Evidence quotes**:

1. **Optimizer s_318 (✅ — self-correction over speed)**: The optimizer had a checkpoint claiming a bug: `evaluator-failure-chain.ts` uses `"exec"` instead of `"bash"`. Instead of immediately applying a fix (which would have been fast), the optimizer verified first:
   > "Let me verify the bug and implement the fix."
   
   After grepping the file and finding `"bash"` already present:
   > "The file already uses `"bash"` not `"exec"`. My checkpoint's bug description appears to be outdated or already fixed."
   
   Then confirmed further by reading the actual function. Final conclusion:
   > "The bug I identified in my checkpoint has already been fixed (or was never present in the current file state). The code correctly uses `"bash"` throughout. The checkpoint data was wrong — this is an important lesson about verifying before acting."
   
   **This is a textbook "Correct > fast" moment**: the agent had every reason to trust its own checkpoint and apply the fix quickly, but chose to verify, discovered the fix was unnecessary, and avoided a potentially harmful change.

2. **Bob s_322 (✅ — multi-phase verification)**: Bob was verifying the archetype migration for coder. Rather than trusting that it worked, Bob ran 4+ verification phases across multiple heartbeats:
   - Phase 1: Read `agent-loader.ts` to verify loader handles `extends`
   - Phase 2: Called coder identity probe (`agents.call("coder", "[IDENTITY CHECK]")`) to verify runtime inheritance
   - Phase 3: Read `agents/_archetypes/coder/SOUL.md` and `agents/_archetypes/coder/agent.json` to verify base content
   - Phase 4: Checked for ENOENT/crash risks when local SOUL.md is missing
   
   Each phase could have been skipped in favor of speed, but Bob systematically confirmed each layer of the migration.

3. **Coder s_323 (✅ — systematic verification)**: After making edits, the coder explicitly stated:
   > "Both edits applied successfully. Now let me verify all 4 requirements by reading back the relevant sections and running tsc."
   
   Then verified each requirement individually:
   > "All 4 verification points confirmed: 1. **FailureCategory type** (lines 24-29): All 5 new categories present... 2. **classifyFailure** (lines 164-186): switch cases added... 3. **isExpectedNonZeroExit** (lines 225-226)... 4. **TypeScript compilation**: clean exit."

4. **Coder s_325 (✅ — deep investigation)**: The coder found a test failure and chose to deeply understand the root cause rather than applying a quick fix:
   > "The test `'all real agent.json files pass validation'` is failing because `agents/coder/agent.json` is missing required fields..."
   
   Instead of just adding the fields back (quick fix), the coder investigated:
   - Read the test code to understand what it validates
   - Read `agent-loader.ts` to understand how inheritance resolution works
   - Identified the real issue: `validateAgentConfig` doesn't resolve inheritance before checking
   - Implemented the correct fix (resolve inheritance in validation)
   - Verified with `tsc --noEmit` + `vitest --run` + structural `grep`
   
   The coder stated:
   > "Now I understand the full picture: 1. `loadAgentConfig` properly resolves inheritance... 2. But `validateAgentConfig` just checks the raw config without resolving inheritance"
   
   This deep analysis took many more tool calls than a quick hack but produced a correct, maintainable fix.

**Negative evidence search**: Searched for patterns indicating "fast > correct":
- Sessions where `finish(success)` was called after an error without recovery: **0 in these 4 sessions**
- Sessions where an agent applied a fix without first reading the code: **0 in these 4 sessions**
- Sessions where tests were skipped or verification was omitted: **0 in these 4 sessions**

**Conclusion**: ✅ Compliant. All 4 sessions demonstrate strong "Correct > fast" behavior:
- Optimizer abandoned a pre-planned fix after discovering it wasn't needed (correctness over momentum)
- Bob ran 4+ verification phases for a migration that "should have worked" (thoroughness over trust)
- Coder s_323 verified all 4 requirements individually after edits (systematic over hasty)
- Coder s_325 deeply investigated a test failure rather than applying a quick hack (understanding over speed)

The system shows a healthy culture of verification and deep investigation. No agent in the sample prioritized speed over correctness.

**Action**: No Growth Cycle needed. This is one of the strongest compliance areas. The combination of SOUL.md guidance, finish gates, and evaluation feedback creates an environment where agents naturally prioritize correctness.

---


### #18 — git add agents/ = NO — RE-VERIFICATION (2026-03-28 05:06Z)

**Rule**: "Files in `agents/` directories are gitignored. Do NOT try to `git add` or `git commit` files under `agents/`. Only `src/` and `scripts/` files are tracked by git. Agent files already persist at runtime — no git needed."

**Note**: Rule added 2026-03-26 in s_470 (may). Previous check (2026-03-26) rated ⚠️ with 0 post-rule violations but small sample size (9 sessions). This re-verification examines 200+ sessions since the rule was added.

**Method**: Searched all sessions since rule addition (s_470, Mar 26 ~14:33 UTC) for `git add agents` patterns in assistant tool-call arguments. Separated actual violations (agent attempting `git add agents/` as a bash command) from rule references, finding discussions, and log-reading operations.

**Sessions checked**: 200+ (all sessions from s_470 onward through s_729)

**Post-rule violations found: 2**

| Session | Agent | Command Attempted | Result | Recovery |
|---------|-------|-------------------|--------|----------|
| s_1774611223612_618 | optimizer | `git add agents/bob/agent.json agents/judge/agent.json && git commit -m "..."` | .gitignore blocked: "The following paths are ignored" (exit code 1) | Recovered — agent noted the gitignore block and moved on |
| s_1774636425227_659 | optimizer | `git add agents/may/handlers/run-agent-task.ts agents/may/handlers/manage-pending-requests.ts` then retried with `-f` flag | First attempt blocked by .gitignore. Second (`-f`) also failed to stage (no changes). | Recovered after 2 attempts, but the `-f` retry shows the agent tried to force past the guard |

**False positives excluded (3)**:

| Session | Agent | Nature | Why excluded |
|---------|-------|--------|-------------|
| s_1774535617560_470 | may | Session that *added* the rule to common-sense.md | Implementing the rule, not violating it |
| s_1774539252226_475 | coach | Reading session.jsonl of s_470 to verify rule was added | Verification meta-activity, not a git operation |
| s_1774661626192_708 | bob | Reference to rule text in common-sense.md via system prompt | Agent reading/quoting rule, not violating it |

**Violation details**:

1. **Optimizer s_618 (❌ — single attempt, recovered)**: The optimizer had edited `agents/bob/agent.json` and `agents/judge/agent.json` as part of a config fix. After the edits, it attempted to commit them with `git add agents/bob/agent.json agents/judge/agent.json && git commit -m "fix: update agent model configs"`. The .gitignore blocked the add. The optimizer recognized the block and finished the session without further git attempts. **Wasted**: 1 op.

2. **Optimizer s_659 (❌ — two attempts including `-f`, recovered)**: The optimizer had fixed files under `agents/may/handlers/`. It attempted `git add agents/may/handlers/run-agent-task.ts agents/may/handlers/manage-pending-requests.ts`. When blocked by .gitignore, it retried with `git add -f agents/may/handlers/...`. The `-f` flag is concerning — it shows the agent attempted to override the safety guard rather than accepting it. Both attempts ultimately failed (no changes staged). **Wasted**: 2 ops.

**Statistical summary**:

| Metric | Value |
|--------|-------|
| Rule added | 2026-03-26 ~14:33 UTC (s_470) |
| Total post-rule sessions | ~200+ |
| Post-rule violations | 2 (both optimizer) |
| Compliance rate | ~99% |
| Total ops wasted | 3 (1 in s_618 + 2 in s_659) |
| Damage caused | 0 (.gitignore blocked all attempts) |

**Comparison with previous check (2026-03-26)**:

| Metric | Previous (2026-03-26) | Current (2026-03-28) | Trend |
|--------|----------------------|---------------------|-------|
| Post-rule sessions checked | 9 | 200+ | Much larger sample |
| Post-rule violations | 0 | 2 | Found violations with larger sample |
| Violating agents | — | optimizer (2×) | Single repeat offender |
| Op waste per violation | — | 1-2 ops | Low; .gitignore blocks quickly |
| Compliance rate | 100% (small sample) | ~99% | High and stable |

**Conclusion**: ✅ Upgraded from ⚠️. With 200+ sessions sampled:
- **99% compliance rate** — only 2 violations in 200+ sessions
- **Both violations from optimizer** — a single agent, suggesting the rule text may need reinforcement in optimizer's context specifically
- **.gitignore is an effective safety net** — zero actual damage from violations; all attempts blocked at the filesystem level
- **Op waste is minimal** — 3 total ops wasted (vs 11 ops in the pre-rule tech-lead session), showing the rule saves far more ops than the violations waste
- **No `-f` force-add succeeded** — even the aggressive retry in s_659 was blocked
- The `-f` retry in s_659 is a yellow flag: the agent tried to override the guard rather than accepting it. Worth monitoring but doesn't change the overall ✅ rating given the safety net holds.

**Action**: No Growth Cycle needed. Rule is effective at ~99% compliance with .gitignore as a safety net. Consider adding a brief reminder about `agents/` gitignore to optimizer's periodic-tasks or SOUL if violations recur. Next re-verification in 3-5 days.

---


### #19 — Verify before finishing (2026-03-27 05:06Z)

**Rule**: "For critical tasks, use the `verify-and-finish` workflow instead of raw delegation. It runs the agent, verifies the result (via shell command or agent self-check), retries on failure, and only succeeds when verification passes."

**Method**: Searched 50 recent sessions for: (a) actual `workflow.run("verify-and-finish", ...)` invocations, (b) raw `agents.send` delegations of critical implementation tasks that could have used the workflow instead.

**Workflow availability**: `agents/may/workflows/verify-and-finish.ts` exists (10,347 bytes, deployed 2026-03-26 13:36 UTC). The rule was added to `common-sense.md` on 2026-03-26.

**Actual verify-and-finish usage (50 sessions examined)**:

| Metric | Count | Notes |
|--------|-------|-------|
| Sessions mentioning "verify-and-finish" | 20 | Mostly from system prompt injection (common-sense.md is loaded into context) |
| Sessions with actual `workflow.run("verify-and-finish", ...)` | **0** | Zero agents have invoked it as a workflow |
| Sessions using any `workflow` tool call | 1 | s_531 (coach) used `workflow.run("growth-cycle", ...)` — different workflow |

**Critical delegations that SHOULD have used verify-and-finish (4 examined)**:

| Session | Agent | Delegated To | Task | Used verify-and-finish? | Verdict |
|---------|-------|-------------|------|------------------------|---------|
| s_454 (Bob) | Bob | tech-lead | "Pivot to Workflows: Implement `verify-and-finish` Workflow" | ❌ Used `agents.send` | ❌ Ironic: deployed the workflow without using it |
| s_421 (Bob) | Bob | tech-lead | "Deploy P78 Supply Chain Hardening" (wire scanner into loader) | ❌ Used `agents.send` | ❌ Critical infra change, no verification workflow |
| s_421 (Bob) | Bob | tech-lead | "Implement Unified Guard Architecture" | ❌ Used `agents.send` | ❌ Critical infra change, no verification workflow |
| s_409 (Bob) | Bob | tech-lead | "Deploy P78 Skill Scanner" (move code to core, wire into loader) | ❌ Used `agents.send` | ❌ Critical implementation, no verification |

**Other delegation patterns (non-critical)**:

| Session | Agent | To | Task Type | verify-and-finish appropriate? |
|---------|-------|----|-----------|-------------------------------|
| s_515 (Optimizer) | Optimizer | May | Bug report (Bob model down) | No — escalation, not delegation |
| s_511 (Optimizer) | Optimizer | May | "Add lesson to LESSONS.md" | Maybe — simple file edit, borderline |
| s_521 (Optimizer) | Optimizer | May | Bug report repeat | No — escalation |

**Root cause analysis**: The `verify-and-finish` workflow was deployed less than 24 hours before this check. However:
1. **Bob is the primary delegator** (sends 60%+ of critical implementation tasks to tech-lead). Bob's model (gemini-3-pro-preview) has been down for 6+ hours, and his Claude sessions are short recovery sessions — no delegation happening.
2. **Common-sense.md rule is passive** — it tells agents the workflow exists and how to use it, but agents' existing `agents.send` habit is deeply ingrained. No SOUL.md references to verify-and-finish were found.
3. **No agent has the workflow in their delegation muscle memory** — the rule text appears in system prompts, but agents continue using `agents.send` for all delegation.

**Evidence quotes**:

1. **Bob s_454 (❌ — ironic non-usage)**: Bob's send message starts with:
   > "**[P0] Pivot to Workflows: Implement `verify-and-finish` Workflow.**"
   
   Bob is literally delegating the *creation* of the verify-and-finish workflow via raw `agents.send` — not using a verification workflow to verify the workflow's implementation. This illustrates the meta-problem: even when the task IS about verified delegation, agents default to unverified delegation.

2. **Bob s_409 (❌ — critical implementation)**: Task is to "Deploy the P78 Skill Scanner" — move security-critical code from agent workspace to core (`src/lib/tools/scan-skill.ts`), wire it into the agent loader, and verify it blocks malicious skills. This is exactly the type of "critical task" the rule describes. The message includes a `verifyCommand`-equivalent instruction ("Verify it blocks a toxic skill"), but it's sent as prose text in an `agents.send` message, not as a structured `verifyCommand` parameter in a `verify-and-finish` workflow call.

3. **System-wide (zero usage)**: `grep -rl 'verify-and-finish' .state/sessions/history/*/session.jsonl` returns 20 sessions, but `grep '"workflow"'` within those sessions yields only 1 match (s_531, which uses `growth-cycle` not `verify-and-finish`). The workflow is mentioned in every session's system prompt but never invoked.

**Conclusion**: ❌ Violation. The `verify-and-finish` workflow exists and is documented in common-sense.md, but **zero agents have used it** in 50 sessions across 24+ hours since deployment. Critical implementation tasks (deploy security scanners, implement guard architecture, wire loaders) are delegated via raw `agents.send` without structured verification. The rule is systematically ignored.

**Mitigating factors**:
- The workflow is <24h old — adoption may need more time
- Bob (primary delegator) has been partially down
- Some tasks include informal verification instructions in the send message text (but not structured workflow verification)

**Action**: ❌ Growth Cycle recommended. Options:
1. **SOUL update**: Add verify-and-finish usage guidance to Bob's SOUL.md (he's the primary delegator). Add to May's heartbeat checklist.
2. **Scenario**: Create a gym scenario testing whether agents use verify-and-finish for critical delegations.
3. **Infrastructure**: Consider making verify-and-finish the default for P0 delegations in the agents.send handler (auto-escalate to workflow for priority P0).
4. **Adoption monitoring**: Re-verify in 48h after Bob is back online to see if adoption begins naturally.

#### Re-verification (2026-03-29 01:06Z)

**Method**: Exhaustive search of ALL session history for `verify-and-finish` workflow invocations. Also examined last 100 and 200 sessions specifically, checked workflow tool call database, and enumerated every unique workflow name ever used.

**Findings — unchanged (still ❌)**:

| Metric | Count | Notes |
|--------|-------|-------|
| Total `workflow.run()` invocations across ALL sessions | 204 | Up from ~84 at last check — system is actively using workflows |
| `verify-and-finish` invocations | **0** | Zero. Not once. Ever. |
| Unique workflow names used | 12 | implement-and-review (78), growth-cycle (62), skill-lifecycle (18), training-sprint (16), design-review (11), verified-coder (5), optimize (4), safe-edit (3), coaching-session (3), diagnose-and-fix (2), xhs-research-69abc023 (1), paper-review-2601-12538 (1) |
| Sessions mentioning "verify-and-finish" | 0 (last 100) | Even mentions have dropped — may no longer be in system prompts |
| P0 delegations in last 200 sessions | 0 | Delegation activity itself appears very low recently |

**Key observation**: The system is *actively using workflows* — 204 total invocations across 12 different workflow names. Agents are comfortable with the `workflow.run()` tool. They specifically use `implement-and-review` (78×), `growth-cycle` (62×), and `skill-lifecycle` (18×) regularly. The problem is not "agents don't know how to use workflows" — it's "agents don't choose `verify-and-finish` specifically."

**Root cause update**: Three factors appear to be at play:
1. **Habit inertia**: `agents.send` is the established delegation pattern. No agent has ever been "taught" to switch to verify-and-finish for critical tasks.
2. **Low delegation volume**: Recent sessions show very few cross-agent delegations via `agents.send`. Most work is either direct (agent does it themselves) or routed through workflows like `implement-and-review`.
3. **Workflow overlap**: `implement-and-review` may already serve the role that `verify-and-finish` was designed for — it runs implementation and includes review. Agents may perceive them as duplicative.

**Conclusion**: ❌ Still violated. 3+ days since the rule was added, 204 workflow invocations across 12 different workflow names, and verify-and-finish has exactly 0 uses. This is a dead rule.

**Recommendation**: Escalate to May with a concrete proposal:
- **Option A (remove)**: Remove the verify-and-finish rule from common-sense.md — it's unenforced and unenforceable via passive documentation alone.
- **Option B (integrate)**: Instead of a separate workflow, add verification steps to the existing `implement-and-review` workflow (which agents already use 78× regularly).
- **Option C (enforce)**: Add verify-and-finish to agent heartbeat checklists and SOUL.md delegation sections with specific trigger criteria (e.g., "use for any P0 task that modifies src/").

---


### #20 — Environment Reality (C50) (2026-03-27 13:06Z)

**Rule**: "The filesystem root is `/app`. Do NOT use `/Users/`, `/home/`, or `~`. These paths don't exist here."

**Method**: Searched 80 recent sessions for tool calls containing `/Users/`, `/home/`, or `~/` in `path` or `command` arguments. Separated agent-initiated path violations from tool output that happens to contain these strings (e.g., old session logs mentioning `/home/hao`).

**Sessions checked**: 80

| Metric | Count |
|--------|-------|
| Total sessions examined | 80 |
| Sessions with `/home/` or `/Users/` in tool call arguments | 2 |
| Sessions with these strings only in tool **output** (not agent-initiated) | 15 |
| Violation rate | 2.5% (2/80) |

**Violations found**:

| Session | Agent | Commands | Outcome |
|---------|-------|----------|---------|
| s_1774597242147_579 | coder (claude-opus-4.6) | `cd /home/user && git diff HEAD~1 --stat`, `cd /home/user && grep -n ...` | Both failed ("No such file or directory"). PIVOT REQUIRED guard fired. Agent recovered, finished successfully (fixed QA issues in `src/lib/manager.ts`). |
| s_1774600622826_586 | coder (claude-opus-4.6) | `cd /home/user/repos/may && npx tsc --noEmit` | Failed ("No such file or directory"). PIVOT REQUIRED guard fired. Agent recovered, finished successfully (added 'run' action to agents tool). |

**Analysis**:

1. **Both violations are from the coder agent** — the same agent, using claude-opus-4.6. Other agents (coach, optimizer, scout, bob, may, tech-lead, QA, evaluator) show zero C50 violations across 78 sessions.

2. **Both violations are first-tool-call errors** — the agent's very first bash commands assume `/home/user` as the working directory, likely because the model's training data includes many examples of code running from home directories. After the command fails and the PIVOT REQUIRED guard fires, the agent switches to relative paths or `/app` and completes successfully.

3. **Infrastructure guard is effective**: The PIVOT REQUIRED mechanism prevents repeat violations. Both sessions recovered within 1-2 tool calls and completed their tasks without further path errors.

4. **No `/Users/` violations**: All violations use `/home/user`, suggesting the docker container's user setup may be leaking `/home/user` as a plausible-seeming path. No macOS-style `/Users/` paths were attempted.

5. **No violations in the most recent 30 sessions**: Both violations are from 4-6 hours ago (timestamps ~07:40 and ~08:37 UTC). The 30 most recent sessions (since ~09:00 UTC) show zero C50 violations.

**Evidence quotes**:

1. **Coder s_579 (❌ — 2 violations, recovered)**: First command:
   ```
   cd /home/user && git diff HEAD~1 --stat 2>/dev/null || echo "No git history available"
   ```
   Output: `/bin/bash: line 1: cd: /home/user: No such file or directory`
   PIVOT REQUIRED fires. Second command:
   ```
   cd /home/user && grep -n "detectCompletionError\|handleCompletion\|..." src/lib/manager.ts | head -30
   ```
   Also fails. After 2 failures, agent switches to relative paths and completes task.

2. **Coder s_586 (❌ — 1 violation, recovered)**: Command:
   ```
   cd /home/user/repos/may && npx tsc --noEmit 2>&1
   ```
   Output: `/bin/bash: line 1: cd: /home/user/repos/may: No such file or directory`
   Agent recovers immediately.

**Conclusion**: ⚠️ Borderline. The rule is violated at a low rate (2.5%, only coder agent), and the PIVOT REQUIRED infrastructure guard catches every violation and forces recovery. The violations appear to be a model-level habit (assuming `/home/user` as default path) rather than willful non-compliance. No data loss or incorrect behavior results from the violations — they're caught before any destructive action.

**Action**: No Growth Cycle needed at this time. The PIVOT REQUIRED guard is functioning as intended and prevents the violation from causing harm. If violations persist in future coder sessions, consider:
1. Adding a pre-command path guard that rewrites `/home/` to `/app/` or blocks the command with an explanatory error
2. Adding C50 reminder to coder-specific system prompt
3. Creating a gym scenario testing correct path usage


### #20 — Environment Reality (C50) — RE-VERIFICATION (2026-03-30 05:06Z)

**Rule**: "The filesystem root is `/app`. Do NOT use `/Users/`, `/home/`, or `~`. They do not exist."

**Method**: Programmatically parsed all tool_calls from 268 sessions (timestamps 17747*–17748*, covering 2026-03-27 through 2026-03-30). For every `read`/`edit`/`write` call, checked `path` argument for `/home/`, `/Users/`, or `~/`. For every `bash` call, checked `command` argument for the same patterns. Comprehensive scan, not a sample.

**Sessions checked**: 268

| Metric | Count |
|--------|-------|
| Sessions scanned | 268 |
| read/edit/write calls with bad paths | 0 |
| bash commands with /home/, /Users/, or ~/ | 0 |
| **Violation rate** | **0.0%** |

**Comparison with previous check (2026-03-27)**:

| Metric | 2026-03-27 | 2026-03-30 | Trend |
|--------|-----------|-----------|-------|
| Sessions scanned | 80 | 268 | 3.4× larger sample |
| Violations | 2 (coder) | 0 | ✅ Eliminated |
| Rate | 2.5% | 0.0% | ✅ Full remediation |

**Analysis**: The two coder violations from 2026-03-27 (s_579, s_586 using `/home/user`) have not recurred. Likely causes: Path Assumption Guard (commit `786c884`), C50 in SOUL.md/persistent context, and active recall warnings.

**False positive note**: grep found `/home/` and `/Users/` in many session.jsonl files, but all in system prompt text (the C50 rule itself, recall warnings) — NOT in agent-initiated tool call arguments.

**Conclusion**: ✅ Upgraded from ⚠️. Zero violations across 268 sessions. The combination of SOUL.md reminders, active recall, and Path Assumption Guard has eliminated the coder's `/home/user` habit.

**Action**: No Growth Cycle needed. Stable ✅. Next re-verification in 3-5 days.

---

