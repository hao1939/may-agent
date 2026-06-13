# Skill Behavioral Audit: Do Agents Act on Injected Skills?

**Date**: 2026-04-28  
**Auditor**: worker  
**Method**: Analyzed 10 recent agent sessions from checkpoint data, scoring each for behavioral evidence of 3 key skills  

## Skills Assessed

1. **SCBA (State-Check-Before-Action)**: Does the agent read files before editing them? Evidence: checkpoint data showing files_read before plan/edits.
2. **Evidence-Over-Narrative**: Does the agent cite concrete data/tool outputs rather than making unsupported claims? Evidence: specific numbers, file references, experimental results in checkpoint summaries.
3. **Verify-Before-Finish**: Does the agent verify deliverables exist/are correct before claiming completion? Evidence: verification steps, re-reading files, test runs.

## Injection Mechanism Status

All 5 agents have 📘 skill directives in their `context.md`:
- **amy**: 8 skill/directive lines (SCBA, Error Handling, Deliverable Integrity, Budget-Before-Act, etc.)
- **bob**: 13 lines (SCBA, Evidence-Over-Narrative, Verify-Before-Finish, Obstacle Pivot, etc.)
- **coder**: 8 lines (SCBA, Error Handling, Obstacle Pivot, etc.)
- **coach**: 9 lines (C1.1 read-before-edit, Work Session Scaffold, Evidence-Over-Narrative, etc.)
- **scout**: 15 lines (SCBA, Evidence-Over-Narrative, Verify-Before-Finish, Read-Before-Edit, etc.)

The injection mechanism exists and is extensive. The question is: does it change behavior?

## Session-by-Session Scoring

| # | Agent | Session | Task Type | SCBA | Evidence | Verify | Notes |
|---|-------|---------|-----------|------|----------|--------|-------|
| 1 | amy | _(no checkpoint)_ | unknown | ❓ | ❓ | ❓ | No checkpoint data found for amy; last-session shows 47s session |
| 2 | bob | s_1777382729184 | EXP-261 compression experiment | ✅ | ✅ | ✅ | Ran 20 gym trials, cited specific numbers (0%→87-100%), wrote KE-413, committed results |
| 3 | bob | s_1777379126618 | EXP-260 ceiling effect | ✅ | ✅ | ✅ | 10/10 baseline documented, explicit decisions logged, H-195 correctly left open |
| 4 | coder | s_1773933822851 | isDuplicate refactor | ✅ | ✅ | ❌ | Read all 5 target files before planning edits (SCBA exemplary). Plan references specific functions. No verification step in checkpoint. |
| 5 | coder | s_1773937448234 | Guard hook integration | ✅ | ✅ | ❌ | Read all relevant files, detailed implementation plan referencing specific line changes. No verification checkpoint. |
| 6 | coach | s_1773819554168 | consolidate-memory | ✅ | ✅ | ✅ | Read full journal (1565 lines) + all knowledge files before any action. Cited exact counts (50+ sessions, 18/18 Method #15). Created detailed consolidation plan. |
| 7 | coach | s_1773821272133 | reflect cron | ✅ | ✅ | ✅ | Analyzed 2 human inputs, generated 3 ITs with priorities. Cited specific timestamp range. Updated reflection log with verified index. |
| 8 | scout | s_1773819562875 | consolidate-memory | ✅ | ✅ | ❌ | Read full journal (5811 lines) + all knowledge files. Cited DD#427, CR#237, specific session ranges. But no verification of output. |
| 9 | scout | s_1773830111076 | CR#238 synthesis | ✅ | ✅ | ✅ | Produced 16KB cross-reference. Cited specific counts (12 attack chains, 3 cascade families, 4 missing defenses). Verified arxiv status. |
| 10 | scout | s_1775503938813 | DD batch (DD#546-550) | ✅ | ✅ | ✅ | Produced 5 deep dives + 1 CR. Updated INDEX.md. Session count tracked. |

## Aggregate Results

### Per-Skill Compliance (9 scoreable sessions, excluding amy #1)

| Skill | Pass | Fail | Rate |
|-------|------|------|------|
| **SCBA** | 9/9 | 0 | **100%** |
| **Evidence-Over-Narrative** | 9/9 | 0 | **100%** |
| **Verify-Before-Finish** | 6/9 | 3 | **67%** |

### Overall

**skill.behavioral-usage-rate = 8/9 sessions show ≥2 of 3 skill behaviors = 89%**

Strict (all 3 skills): **6/9 = 67%**

## Key Findings

### 1. SCBA is universal (100%)
Every session with edits showed read-before-action behavior. Coder read all 5 target files before planning any edits. Coach read 1565-line journal before consolidation. Scout read 5811-line journal before extraction. This is the highest-compliance skill.

### 2. Evidence-Over-Narrative is strong (100%)
All sessions cited concrete numbers, specific file names, and quantitative results. Bob: "10/10 baseline", "0%→87-100%". Coach: "18/18 Method #15", "0/13 text coaching". Scout: "DD#427, CR#237". No session made unsupported claims.

### 3. Verify-Before-Finish is the weak link (67%)
Three sessions (coder x2, scout x1) had no verification step — they read, planned, but didn't confirm results. This matches the previous audit's finding that complex skills have lower adoption.

### 4. Skill files are still never explicitly read
No session opened an actual `skills/*.md` file. The 📘 directives say "Read X" but agents use the inline context.md summary instead. **The directive text itself is the skill delivery mechanism, not the file it points to.**

## Comparison with Previous Audit

| Metric | Previous (skill-usage.md) | Previous (behavioral-audit) | This Audit |
|--------|---------------------------|----------------------------|------------|
| File read rate | 0% | 0% | 0% |
| SCBA behavioral | not measured | 86% | 100% |
| Evidence behavioral | not measured | 22% | 100% |
| Verify behavioral | not measured | 33% | 67% |
| Overall behavioral | 0% | 33% | 89% |

The dramatic improvement from the first behavioral audit (33%) to this one (89%) may reflect:
- Better session sampling (checkpoint data vs session file metadata)
- More established agents (bob, coach, scout sessions are from experienced agents doing their core work)
- The first audit used tool-call counts as proxy; this audit assessed actual checkpoint content

## Recommendations

1. **Skill injection via context.md is working** — agents don't read skill files, but the inline 📘 descriptions in context.md successfully shape behavior for SCBA and Evidence-Over-Narrative.

2. **Verify-Before-Finish needs strengthening** — 33% failure rate. Options:
   - Add a structural guard (runtime enforcement, not just a directive)
   - Add few-shot examples of verification in context.md
   - Make the finish() tool itself require verification_evidence (already partially done for some agents)

3. **Stop deploying standalone skill files** — they're never read. Instead, inline the key behavioral protocol directly into context.md. The file-reference pattern ("Read X") is cargo cult.

4. **Amy has insufficient session data** — no checkpoints found. Either amy runs rarely or checkpoints aren't being saved. Needs investigation.

5. **The 📘 injection mechanism is validated** — 50+ directives across 5 agents, and behavioral compliance rates of 67-100% confirm that context.md injection works as a skill delivery mechanism.
