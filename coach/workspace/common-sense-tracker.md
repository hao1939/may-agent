# Common Sense Verification Tracker

Tracks which rules from `agents/shared/common-sense.md` have been verified, when, and whether agents comply.

## Status Index

| Rule | Last Verified | Status | Agent(s) Checked | Notes |
|------|--------------|--------|-------------------|-------|
| Claim, then act (Relaxed C40) | - | ❓ Not verified | - | - |
| Evidence first | - | ❓ Not verified | - | - |
| C1.3 Verify every write | 2026-04-08 | ✅ Pass | May, Coach | See entry below |
| C1.7 Success Requires Evidence | 2026-04-09 | ✅ Pass | tech-lead, coach, may | See entry below |
| C1.8 Match finish() status to reality | 2026-04-09 | ⚠️ Mostly pass | bob, qa, may, coach | 5/6 compliant; 1 borderline FM-2.6 overlap |
| Environment Reality (C50) | - | ❓ Not verified | - | - |
| Two git repos | - | ❓ Not verified | - | - |
| Commit before finish() | 2026-04-09 | ⚠️ Mostly pass | bob, hao, may, scout, coach, tech-lead | 8/9 compliant; 1 clear violation (bob sub-session) |
| Simple first | - | ❓ Not verified | - | - |
| One thing at a time | - | ❓ Not verified | - | - |
| Cross-agent help | - | ❓ Not verified | - | - |

## Verification Log

### C1.3 Verify every write — 2026-04-08

**Sessions examined:**
- `s_1775647957720_1` (May, heartbeat, 47 ops)
- `s_1775647960675_2` (Coach, reflect, 27 ops)

**May (s_1775647957720_1) — 3 edits to dispatch-board.md:**
- ✅ Read file before editing (line 2 initial read, line 89-90 re-read before edit batch)
- ✅ All 3 edits received diff previews from the tool
- ✅ Read file AFTER all edits (line 107-108) to verify final state
- ✅ finish() verification_evidence cites "read of dispatch-board.md confirmed all edits applied correctly"
- **Verdict: COMPLIANT**

**Coach (s_1775647960675_2) — 1 write + 1 edit:**
- `write()` to `reflections/2026-04-08-11-reflection.md` returned truncated preview (30/137 lines)
- `edit()` to `archive/reflection-log.md` returned diff preview
- ✅ After both writes, Coach ran explicit bash verification (line 54-55): `wc -l` (136 lines), `grep -c "IT-4[89]\|IT-50"` (5 matches), `grep "last_analyzed_ts"` (confirmed update)
- Coach stated "All outputs are verified" before calling finish()
- **Verdict: COMPLIANT**

**Overall: ✅ Both agents verified their writes. No growth cycle action needed.**

### C1.7 Success Requires Evidence — 2026-04-09

**Rule**: "Run at least one verification command (grep, ls, test, read-back) before calling finish(success)."

**Sessions examined (4 sessions, 3 agents):**

**tech-lead (s_1775649760873_4) — heartbeat, 1 op:**
- ✅ Ran bash health query and agents.requests before finish
- ✅ verification_evidence field populated: 2 items ("bash health query showed session data", "agents requests showed only current heartbeat")
- **Verdict: COMPLIANT**

**coach (s_1775647960675_2) — reflect, 27 ops:**
- ✅ Tool sequence: ...→ write → edit → bash → finish — bash verification after writes
- ✅ verification_evidence field populated: 4 items (wc -l, grep ITs, grep last_analyzed_ts, cat human-inputs, grep model errors)
- **Verdict: COMPLIANT**

**may (s_1775647957720_1) — heartbeat, 47 ops:**
- ✅ Tool sequence: ...→ edit × 3 → bash × 3 → cron × 2 → read → finish — read-back and bash after edits
- ✅ verification_evidence field populated: 5 items (curl tests, DB query, agents send, read of dispatch-board)
- **Verdict: COMPLIANT**

**may (s_1775647094979_0) — LLM test, 31 ops:**
- ✅ Tool sequence: ...→ bash × 7 → cron → bash → finish — bash verification before finish
- ✅ verification_evidence field populated: 1 item (curl to /v1/chat/completions returned successful completion)
- **Verdict: COMPLIANT**

**Overall: ✅ All 4 sessions provided verification_evidence and ran verification commands before finish(success). No growth cycle action needed.**

### C1.8 Match finish() status to reality — 2026-04-09

**Rule**: "If you identified blockers, unresolved errors, or missing inputs during the session, call `finish(status: "blocked")` or `finish(status: "partial")` — NOT `finish(status: "success")`. Success means *all* objectives were met and verified."

**Sessions examined (6 sessions, 4 agents):**

**bob (s_1775739578357_599) — Phase 2 deliverables, 28 ops:**
- Status: `success` — claimed all 5 integration tasks completed
- ✅ Deliverables verified: 6 verification_evidence items (grep on H-092, PRIORITY-TRACKER, INDEX.md; git commit 5654aa85)
- All claimed deliverables exist and contain expected content
- **Verdict: COMPLIANT** — status matches reality

**qa (s_1775738900543_596) — heartbeat, 6 ops:**
- Status: `partial` — correctly identified blockers (tsc/vitest unavailable)
- ✅ Blockers field populated: "Mandatory QA gates unavailable in this environment"
- Agent reviewed code but couldn't run required toolchain gates
- **Verdict: COMPLIANT** — excellent use of `partial` instead of `success`

**may (s_1775740636287_600) — heartbeat, 18 ops:**
- Status: `success` — routine cycle, dispatch board updated
- ✅ 4 verification items: bash confirmed files exist, agents(list) showed health, read+edit confirmed
- **Verdict: COMPLIANT** — status matches reality

**bob (s_1775738989157_597) — Phase 1 Analyze & Plan, 55 ops:**
- Status: `success` — claimed "EXP-102 results fully integrated into knowledge base"
- ⚠️ **Phase constraint violation**: Task said "DO NOT WRITE DELIVERABLES YET" and "Do NOT call write() or edit() on deliverable files in this phase"
- Agent made 10+ edits to INDEX.md, PRIORITY-TRACKER.md, H-093.md (all deliverable files)
- Agent reported success on writing work that it wasn't supposed to do in Phase 1
- The status "success" is **technically accurate** (it did complete the integration) but **misleading** — it implies Phase 1 constraints were followed
- This is primarily FM-2.6 (phase boundary violation) with C1.8 overlap — the agent's self-assessment of "what objectives were met" ignores the phase constraint objective
- **Verdict: BORDERLINE** — FM-2.6 violation makes the success status misleading, but the agent did verify its actual work

**coach (s_1775739044226_598) — commit guard 48h, 43 ops:**
- Status: `success` — report written, KE entry created, todo updated
- ✅ 7 verification items: git log counts, bun computation, git commit, grep confirmations
- **Verdict: COMPLIANT** — thorough verification, status matches reality

**bob (s_1775740864334_611) — Phase 2 DD integration, 5 ops:**
- Status: `success` — KE-095 written (117 lines), INDEX.md updated
- ✅ 4 verification items: wc -l, head, grep, edit diff
- File confirmed on disk at expected size
- **Verdict: COMPLIANT** — status matches reality

**Overall: ⚠️ 5/6 sessions fully compliant. 1 borderline case (bob Phase 1 s_1775738989157_597) where FM-2.6 phase boundary violation caused the finish(success) to be misleading — the agent completed work it wasn't supposed to do and reported success. This is already tracked as FM-2.6 in EXP-103 scenario design. No separate growth cycle action needed for C1.8 specifically, but the FM-2.6 fix (if effective) should also resolve this C1.8 edge case.**

### Commit before finish() — 2026-04-09

**Rule**: "When you create or significantly change files in agents/, commit them with a descriptive message before calling finish(). Run: `cd /app/agents && git add -A <your-files> && git commit -m "<agent>: <what you did>"`."

**Method**: Identified all sessions from 2026-04-09 with file writes (edit/write calls) AND a finish(success) call. Compared whether git operations (git add/commit) appeared in the session transcript before finish(). Examined 9 sessions across 6 agents.

**Sessions examined (9 sessions with writes + finish, 6 agents):**

**bob (s_1775740864334_611) — Phase 2, DD-682/683/684 integration, 5 ops:**
- Wrote: KE-095 (write), INDEX.md (edit) — 2 file modifications
- Git operations: **ZERO** — no git add, no git commit anywhere in session
- finish() called with status:success, accepted by system (no blocking)
- ❌ **VIOLATION** — Files written but never committed. This is a Phase 2 sub-session spawned by the orchestrator; the commit guard did NOT block finish() here. The parent session (s_1775740749720_609, Bob heartbeat) presumably committed later, but this sub-session itself violated the rule.

**bob (s_1775739578357_599) — Phase 2, cross-referencing, 28 ops:**
- Wrote: H-092.md, PRIORITY-TRACKER.md, INDEX.md — multiple edits
- Git operations: First finish() **blocked** with "uncommitted changes". Agent recovered: ran `git add -A && git commit`. Second finish() succeeded.
- ✅ **COMPLIANT** (commit guard caught the violation and agent recovered)

**bob (s_1775738989157_597) — Phase 1 (violated phase boundary), 55 ops:**
- Wrote: 21 file modifications (edits to INDEX.md, PRIORITY-TRACKER.md, H-093.md, etc.)
- Git operations: 2 git operations found — committed in agents/ dir before finish()
- ✅ **COMPLIANT** (committed before finish, despite FM-2.6 phase violation)

**hao (s_1775742436284_613) — heartbeat, writes=2:**
- Git operations: 7 git commits during session
- ✅ **COMPLIANT** — proactive committer

**may (s_1775767997978_642) — heartbeat:**
- Git operations: 5 git operations
- ✅ **COMPLIANT**

**scout (s_1775738899990_595) — research session:**
- Explicitly committed before finish: `"Good. Now let me commit and exit."` followed by git commit
- ✅ **COMPLIANT** — proactive

**coach (s_1775739044226_598) — 48h analysis:**
- Committed before finish: `"The changes are in the agents submodule but not yet committed. Let me commit them:"` followed by git commit
- ✅ **COMPLIANT** — self-corrected proactively

**tech-lead (s_1775738896886_593) — session with writes:**
- 1 git commit before finish
- ✅ **COMPLIANT**

**bob (s_1775733496959_557) — earlier session with writes:**
- Git commits before finish confirmed
- ✅ **COMPLIANT**

**Compliance summary:**
- 8/9 sessions COMPLIANT (89%)
- 1/9 sessions VIOLATED — bob s_1775740864334_611 (Phase 2 sub-session)
- 2/9 sessions were caught by commit guard on first finish() attempt and recovered (s_1775739578357_599, and at least one May heartbeat session)

**Key finding**: The commit guard works well for **top-level sessions** (catches violations and forces recovery). However, **Phase 2 sub-sessions** can bypass the commit guard — bob s_1775740864334_611 wrote 2 files and finished successfully without any git commit and without the guard intervening. This suggests the commit guard may not be applied to sub-sessions spawned within orchestrated workflows.

**Recommendation**: The commit guard should be verified to operate on ALL sessions that write files, not just top-level sessions. The Phase 2 sub-session gap means files could be written and never committed if the parent session doesn't explicitly commit them later.

**Overall: ⚠️ 8/9 compliant. 1 clear violation in a Phase 2 sub-session that bypassed the commit guard. The guard itself is effective for top-level sessions (2 caught violations, 100% recovery). Structural gap: sub-session commit enforcement.**
