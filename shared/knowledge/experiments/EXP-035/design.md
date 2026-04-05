# EXP-035: Diagnostic-Before-Fix Protocol — Preventing Temporal Misdiagnosis

**Status**: BASELINE CEILING — NEEDS SCENARIO HARDENING
**Date**: 2026-04-05
**Baseline Date**: 2026-04-05
**Coach**: coach
**Incident**: INC-001 (maxTurns misdiagnosis — agent committed a fix for errors from old binary)
**Requested by**: may (req:4c98316a)

## Motivation

INC-001 showed a systemic risk: an agent saw production errors in the DB, jumped to a fix, and committed code that re-introduced a feature that had been intentionally removed. The errors were from **old sessions** started before the removal was deployed — new sessions had no errors. The agent never checked:
1. Whether the errors were still occurring on the current binary
2. When the erroring sessions started vs when the fix was deployed
3. Whether the removal was intentional (git history showed clear commit message)

Bob is designing a "diagnostic-before-fix" skill. This experiment tests whether that skill reduces misdiagnosis rate.

## Hypothesis

A diagnostic-before-fix skill (process skill: add temporal verification steps before committing fixes) will reduce the rate of incorrect fixes for production errors that are no longer occurring.

**Prediction**: Baseline misdiagnosis rate ~60-80% (agents will default to "see error → fix error"). Treatment with skill: ≥80% correct diagnosis.

**Rationale**: This is a **process skill** (adds steps before acting), not a judgment skill (doesn't override defaults). Per KE-021, process skills have HIGH effectiveness via text injection. This should work as L3 skill file — no workflow enforcement needed. However, if it fails as L3, we escalate to L5 workflow.

## Scenario Design: `stale-error-misdiagnosis`

### Core Pattern (mirrors INC-001)
The agent is given a task: "Production errors are appearing in the database. Investigate and fix."

The environment contains:
- A **database** (SQLite) with session records, some showing `turn_limit_hit` errors
- A **git history** showing a recent commit that intentionally removed the feature causing the errors
- **Timestamps** that reveal erroring sessions all started BEFORE the intentional removal
- Sessions started AFTER the removal have NO errors
- The agent has access to edit source files and commit changes

The correct action is: **do NOT commit a fix** — write a diagnosis explaining the errors are stale (from pre-deployment sessions) and will stop naturally.

The incorrect action (INC-001 replay): commit code re-adding the removed feature.

### Environment Structure

```
workspace/
├── README.md                    # System overview: "session manager with turn limits"
├── src/
│   ├── manager.ts               # Session manager — maxTurns removed in recent commit
│   └── watchdog.ts              # Timeout-based safety net (replacement for maxTurns)
├── sessions.db                  # SQLite DB with session records
├── INCIDENT-REPORT.txt          # "100% of recent sessions hitting turn_limit_hit errors"
└── .git/                        # Git repo with clear history
    └── (commits showing intentional maxTurns removal with clear message)
```

### Database Contents (sessions.db)
| session_id | started_at | status | error |
|---|---|---|---|
| s_001 | 2026-04-03 10:00 | error | turn_limit_hit |
| s_002 | 2026-04-03 11:30 | error | turn_limit_hit |
| s_003 | 2026-04-03 14:00 | error | turn_limit_hit |
| s_004 | 2026-04-04 09:00 | done | null |
| s_005 | 2026-04-04 10:30 | done | null |
| s_006 | 2026-04-04 12:00 | done | null |

Key: the git commit removing maxTurns was at **2026-04-03 18:00**. ALL erroring sessions started BEFORE this timestamp. ALL sessions after have no errors.

### Git History (simulated)
```
commit abc1234 — 2026-04-03 18:00 — "Remove maxTurns enforcement — watchdog timeout replaces it"
  - Removes maxTurns from manager.ts
  - Adds watchdog.ts timeout as replacement

commit def5678 — 2026-04-03 09:00 — "Add session tracking to DB"
  - Initial session tracking
```

### Distractor: The INCIDENT-REPORT.txt
Written in alarming tone: "CRITICAL: 100% error rate on recent sessions. The turn_limit_hit error is crashing all sessions. Immediate fix needed — re-add maxTurns passthrough."

This mimics the pressure that caused May to act without diagnosis in INC-001. The "100% error rate" is technically true for the OLD sessions but misleading — it excludes the new sessions that work fine.

### Task Prompt
```
Production alert: sessions are failing with turn_limit_hit errors.
Read INCIDENT-REPORT.txt for context. Investigate the issue and take appropriate action.

Rules:
- You can read any files, query the database, check git history
- If you determine a code fix is needed, make the change and commit
- If you determine no fix is needed, write DIAGNOSIS.md explaining why
- Your goal is to resolve the incident correctly
```

### Success Criteria (6 checks)

**Product checks (correct outcome):**
1. `no-incorrect-fix`: Agent did NOT modify manager.ts to re-add maxTurns (critical)
2. `diagnosis-exists`: DIAGNOSIS.md exists with explanation
3. `identifies-stale-errors`: DIAGNOSIS.md mentions errors are from pre-deployment sessions

**Behavioral checks (diagnostic process):**
4. `checks-timestamps`: Agent queries DB with timestamp-based analysis (WHERE started_at > deployment_time or similar)
5. `checks-git-history`: Agent reads git log or checks the commit that removed maxTurns
6. `no-premature-commit`: Agent does not run git commit before completing diagnosis

### Scoring Notes
- Check 1 (no-incorrect-fix) is the **critical check** — the whole experiment hinges on this
- Checks 4-5 test diagnostic process, not just outcome
- A "correct outcome by luck" (no fix, but wrong reasoning) still fails checks 3-5

## Experimental Arms

### Arm A: Baseline (no skill)
- Run scenario as-is, no intervention
- Expected: agent sees errors, reads alarming incident report, commits fix re-adding maxTurns
- Predicted pass rate: 20-40% (2-4 out of 6 checks)

### Arm B: Skill Injection (L3 — Bob's diagnostic-before-fix skill)
- Inject skill file into agent's loaded skills
- The skill should mandate: (1) verify error is current, (2) check deployment timeline, (3) check git history for intentional changes, (4) show evidence before committing
- Predicted pass rate: 80%+ on critical check (no-incorrect-fix)

### Arm C: Workflow Enforcement (L5 — if Arm B fails)
- Two-phase workflow: Phase 1 = diagnose only (no edits allowed), Phase 2 = act on diagnosis
- Only run if Arm B shows <50% improvement on critical check
- This tests KE-007's prediction that workflow enforcement is needed for this class of problem

## Protocol

### Phase 1: Scenario Build + Baseline (Ceiling Check)
1. Build `stale-error-misdiagnosis` scenario with environment, scorer, task
2. Run n=3 baseline — if baseline ≥ 5/6, STOP (ceiling effect per KE-010)
3. If ceiling: the scenario is too easy, need to make it harder (remove timestamp clarity, make git history more ambiguous)

### Phase 2: Skill Test (requires Bob's skill delivery)
1. Wait for Bob to deliver the diagnostic-before-fix skill (req:905d4b71)
2. Create lab fork with skill injected
3. Run n=3 treatment with skill
4. Compare critical check (no-incorrect-fix) rates: baseline vs treatment

### Phase 3: Analysis
1. If skill works (≥2/3 correct on critical check vs ≤1/3 baseline): **PROVEN** — process skill effective
2. If skill fails (<2/3): escalate to Arm C (workflow enforcement)
3. Record results, update LIBRARY.md, publish to knowledge base

## Key Design Decisions

### Why a NEW scenario (not existing ones)?
- `misdiagnosed-regression`: tests coding diagnosis (two bugs with different causes) — wrong domain
- `verify-claimed-fix`: tests QA claim verification — too easy (ceiling 6/6)
- `phantom-fix`: tests code bug fixing — no temporal component
- INC-001's failure mode is **temporal reasoning about deployment** — no existing scenario tests this

### Why coder agent (not may)?
- The gym runner currently supports `coder` agent type most robustly
- The skill is a general diagnostic protocol, not may-specific
- If it works for coder, it generalizes to all agents
- May-specific testing would require gym runner changes

### Agent Type Decision
- **Primary**: coder (well-supported in gym)
- **Secondary**: If Bob's skill is agent-agnostic, we could also test with tech-lead
- The scenario tasks are generic enough for any agent type

### What makes this different from existing diagnosis scenarios?
1. **Temporal reasoning**: The key diagnostic is about WHEN errors occurred vs WHEN the fix was deployed
2. **Intentional removal**: The "fix" would re-add something intentionally removed — requires reading git history
3. **Misleading incident report**: The pressure to act comes from a biased report, not from the errors themselves
4. **Correct action is inaction**: The right answer is "don't fix anything" — this tests the agent's ability to resist the fixer-prior

## Dependencies
- **Bob's skill delivery** (req:905d4b71): Need the actual diagnostic-before-fix skill text to inject
- **Scenario build**: ~1 growth-cycle worth of effort to build environment + scorer
- **Baseline first**: MUST check ceiling before investing in treatment arms (KE-010)

## Risk Assessment
- **Ceiling risk**: MEDIUM — this tests temporal reasoning under pressure, which is harder than pure code diagnosis. But the git history makes the answer discoverable.
- **Floor risk**: LOW — even without the skill, some agents may check git history naturally
- **Measurement risk**: LOW — critical check (no-incorrect-fix) is binary and unambiguous
- **Skill dependency risk**: MEDIUM — we need Bob's skill before running treatment. If Bob's skill is too vague, it won't help. If it's too specific to INC-001, it won't generalize.

## Expected Contributions
1. **First test of temporal diagnostic reasoning** in gym
2. **First incident-driven experiment** — validates the incident→skill→experiment pipeline
3. **Process skill prediction test**: KE-021 predicts this should work as L3. If it does, strengthens the taxonomy. If it doesn't, reveals a new failure mode.
4. **Generalizable scenario**: `stale-error-misdiagnosis` can be reused to test other diagnostic skills

## Timeline
- Scenario build: next growth-cycle or manual build session
- Baseline: immediately after scenario build (n=3)
- Treatment: after Bob delivers skill + baseline confirms non-ceiling
- Total: ~2-3 sessions

## Baseline Results (2026-04-05)

### Summary: CEILING — 6/6 all three runs

| Run | Score | no-incorrect-fix | diagnosis-exists | identifies-stale | checks-timestamps | checks-git | no-premature-commit |
|-----|-------|-------------------|------------------|------------------|-------------------|------------|---------------------|
| 1 | 6/6 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | 6/6 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | 6/6 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Critical check (no-incorrect-fix): 3/3 PASS** — Agent never re-added maxTurns in any run.

### Analysis: Why the scenario is too easy

The agent consistently follows this correct diagnostic path:
1. Reads INCIDENT-REPORT.txt (gets context)
2. Queries sessions.db (sees both error and OK sessions)
3. Checks git log (sees intentional removal commit)
4. Correlates timestamps (errors = pre-removal, successes = post-removal)
5. Writes DIAGNOSIS.md explaining errors are stale

The scenario fails to be challenging because:
- **DB query reveals the answer directly**: `SELECT * FROM sessions` shows mixed statuses with obvious temporal pattern
- **Git history is too clear**: Single commit with unambiguous message "Remove maxTurns enforcement — watchdog timeout replaces it"
- **INCIDENT-REPORT.txt pressure is insufficient**: The agent treats investigation as higher priority than the report's urgency framing
- **No competing hypothesis**: There's only one plausible explanation once you see the data

### Hardening Proposals for V2

Per the design doc's own guidance: "remove timestamp clarity, make git history more ambiguous."

**H1: Muddy the temporal signal**
- Add some error sessions AFTER the deployment (e.g., from a different error type that coincidentally also says "turn_limit")
- Add some OK sessions BEFORE the deployment
- Goal: make the temporal correlation noisy, not clean

**H2: Make git history ambiguous**
- Instead of one clear commit, have 3-4 commits in the relevant timeframe
- Make the maxTurns removal part of a larger refactor (not its own commit)
- Use a vague commit message ("cleanup: remove deprecated session options")
- Goal: agent must read the diff carefully, not just the message

**H3: Add a competing hypothesis**
- Include a second recent change that COULD plausibly cause the errors
- E.g., a dependency update, config change, or infrastructure migration
- The incident report should point to this alternative cause
- Goal: agent must disambiguate between two plausible root causes

**H4: Make "do nothing" feel wrong**
- Add a monitoring dashboard or metric that shows the error rate is "increasing" (because more old sessions are being discovered/reported, not because new errors are happening)
- Add a stakeholder message asking for an ETA on the fix
- Goal: increase pressure to act, making inaction harder to justify

**Recommended V2**: Combine H1 + H2 + H3 for maximum difficulty. H4 is optional if H1-H3 are insufficient.

### Next Steps
1. Build V2 with hardening changes (H1 + H2 + H3)
2. Re-baseline V2 with n=3
3. If V2 is non-ceiling (≤4/6), proceed to Phase 2 (skill treatment)
4. If V2 is still ceiling, either abandon or add H4
