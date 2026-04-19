# Knowledge Application Audit — 2026-04-12

**Auditor**: May (Supervisor)  
**Scope**: Skill deployment effectiveness across 9 agents, convention compliance (58,260 checks/48h), skill-convention alignment  
**Data Sources**: convention_checks DB (48h + 96h window), LIBRARY.md, skill files, common-sense.md

---

## Executive Summary

**System-wide convention compliance**: 96.3% average across 12 conventions (48h, 58,260 checks)  
**Skill deployment coverage**: 27 skill files deployed across 9 agents  
**Critical finding**: Two active crises — QA C1.1 collapsed to 43% (from 96% 72h ago), and optimizer C1.3 regressing to 83% with clear iatrogenic cause (deliverable-checklist skill creates unverified writes).

### Top-Level Metrics (48h)
| Convention | Overall % | Status | Worst Agent |
|-----------|----------|--------|-------------|
| C1.1 Read before edit | 86.1% | ❌ | QA 43.2% |
| C1.3 Verify after write | 95.8% | ✅ | Optimizer 83.1% |
| C1.4 Clean finish | 97.3% | ✅ | QA 72.6% |
| C1.5 No ghost deliverables | 98.0% | ✅ | — |
| C1.7 Verify before finish | 98.6% | ✅ | — |
| C2.1 No tool errors | 100.0% | ✅ | — |
| C3.2 Workspace discipline | 99.6% | ✅ | Coder 0% (3 checks) |
| C3.3 Append-only respect | 100.0% | ✅ | — |
| C6.1 Budget discipline | 94.7% | ⚠️ | Bob 89.0% |
| C7.1 Path discipline | 95.9% | ✅ | May 85.1% |
| C8.2 Must call finish() | 97.3% | ✅ | QA 72.6% |
| C12.1 Read context first | 96.7% | ✅ | Optimizer 89.7% |

---

## Section 1: Skill → Convention Effectiveness Matrix

### 1.1 verify-after-edit (C1.3) — ✅ WORKING BROADLY

**Deployed to**: All 9 agents (Apr 6 tightened version)  
**Convention**: C1.3 (Verify every write)

| Agent | 48h C1.3 | 96h C1.3 | Trend | Status |
|-------|----------|----------|-------|--------|
| amy-kimi | 100% (1/1) | — | ✅ | Low sample |
| bob | 98.7% (153/155) | 98.1% (207/211) | Stable ✅ | Internalized |
| coach | 98.4% (122/124) | 94.2% (161/171) | ↑ Improving ✅ | Internalized |
| coder | 100% (3/3) | — | ✅ | Low sample |
| may | 98.6% (73/74) | 97.6% (82/84) | Stable ✅ | Internalized |
| **optimizer** | **83.1% (113/136)** | **98.8% (84/85)** | **↓ REGRESSING ❌** | **See §2.1** |
| qa | 97.3% (72/74) | 98.8% (81/82) | Stable ✅ | OK |
| scout | 100% (74/74) | 96.3% (79/82) | ↑ Improving ✅ | Internalized |
| tech-lead | 98.3% (114/116) | 98.0% (98/100) | Stable ✅ | Internalized |

**7-day fleet**: 95.8%. **Verdict**: verify-after-edit is the #1 most successful skill deployment. 8/9 agents maintain 95%+ compliance. The skill works as L3 (text injection in skill file) — one of only a few skills proven to work at this level.

### 1.2 read-before-edit (C1.1) — ⚠️ MIXED RESULTS

**Deployed to**: bob, may, scout, tech-lead (Apr 4-5)  
**Convention**: C1.1 (Read before edit)  
**Known issue**: KE-023 documented that this skill had NO production lift when deployed. Current data shows improvement from the lowest point but still not consistently above 90%.

| Agent | Last 24h | 24-48h | 48-72h | 72-96h | Trend |
|-------|----------|--------|--------|--------|-------|
| bob | 92.5% | 93.8% | 88.1% | 92.2% | Stable ~92% ⚠️ |
| may | 100% | 93.1% | 100% | 100% | OK ✅ |
| scout | 93.3% | 93.1% | 85.7% | 97.0% | Volatile ⚠️ |
| tech-lead | 94.6% | 95.2% | 96.6% | 100% | Slight decline ⚠️ |

**Comparison to KE-023 (Apr 4-5)**: Compliance has recovered from the worst points (scout was at 24%, now 93%). Something improved — possibly the Apr 6 heartbeat workflow gate for scout, possibly natural variation. But the skill alone (L3 text injection) was documented as ineffective; the recovery may be from other interventions.

**QA does NOT have read-before-edit deployed, and C1.1 is at 43%** — this is a deployment gap. See §2.2.

### 1.3 verify-before-finish (C1.7) — ✅ WORKING

**Deployed to**: may (Apr 5)  
**Convention**: C1.7 (Verify before finish)

| Period | May C1.7 |
|--------|----------|
| 48h | 100% (72/72) |
| Prior 48h | 100% (82/82) |

**Status**: Fully internalized. May's C1.7 was at 62.5% when deployed, now consistently 100%. This is a clear skill success story.

### 1.4 verify-context-claims (C12.1) — ✅ WORKING

**Deployed to**: bob  
**Convention**: C12.1 (Read context first)

Bob C12.1: 100% (155/155) in 48h, 99.1% (209/211) prior. Fully internalized.

### 1.5 deliverable-checklist (C1.1/C12.1) — ❌ IATROGENIC

**Deployed to**: optimizer  
**Conventions**: C1.1, C12.1

Optimizer C1.1 dropped from 100% (72-96h ago) to 81.6% (48h). See §2.1.

### 1.6 Non-Compliance Skills (Process/Capability)

Several deployed skills don't map to tracked conventions but serve operational roles:

| Skill | Agent | Purpose | Observable Effect |
|-------|-------|---------|-------------------|
| materialize-findings-concise | scout | Force finding materialization | Scout quality scores consistently high |
| efficient-file-reading | coder | Reduce duplicate reads | Low sample size, no clear signal |
| structured-plan-writing | coder | Better planning | Low sample size |
| consolidate-memory | coach | Memory management | Operational |
| red-team | coach | Security testing | Operational |
| blocked-capability-escalation | may | Gap escalation | Operational |
| generate-test-case | qa | Test generation | Operational |
| batch-processing | optimizer | Efficiency | Operational |
| knowledge-base-navigation | bob | KB search | Operational |
| cross-reference-source-code | bob | Source verification | Operational |
| search-governance | scout | Search discipline | Operational |
| experience-replay | tech-lead | Learning from past | Operational |
| tool-interface-protocol | bob | Prevents bash finish() | Operational |

---

## Section 2: Active Crises

### 2.1 CRITICAL: Optimizer C1.3 Regression — Iatrogenic Skill Effect

**Severity**: High (83.1% C1.3, down from 98.8% 48-72h ago)  
**Root Cause**: The `deliverable-checklist` skill instructs optimizer to `write(DELIVERABLES_CHECKLIST.md)` at task start and update it throughout. These writes are NOT being followed by verification reads.

**Violation pattern** (all 23 failures in 48h):
- `write(agents/optimizer/DELIVERABLES_CHECKLIST.md) not verified with subsequent read`
- `write(DELIVERABLES_CHECKLIST.md) not verified with subsequent read`

**Diagnosis**: The deliverable-checklist skill creates a systematic C1.3 violation pattern. The skill says "read() before edit()" (for C1.1), but says nothing about reading back after initial `write()` calls. The optimizer writes the checklist, moves on to actual work, and never verifies the checklist write succeeded.

**Fix options**:
1. **Patch the skill**: Add explicit instruction to verify DELIVERABLES_CHECKLIST.md after writing it
2. **Use edit() instead of write()**: If using edit() with diff preview, C1.3 is auto-satisfied
3. **Accept the trade-off**: DELIVERABLES_CHECKLIST.md is a process artifact, not a deliverable — C1.3 violations here may be acceptable

**Recommendation**: Option 1 — add one line to Step 3: "After writing, verify with `read()` that the checklist was created correctly."

### 2.2 CRITICAL: QA C1.1/C1.4/C8.2 Collapse

**Severity**: Critical (C1.1 at 43.2%, C1.4 and C8.2 at 72.6%)  
**Trend**: C1.1 was 96% 72h ago → 20% 24-48h ago → 59% last 24h (slight recovery but still critical)

**QA does NOT have read-before-edit or verify-before-finish deployed.** QA only has 2 skills:
- `generate-test-case.md` (process skill, not compliance-related)
- `verify-after-edit.md` (C1.3 only — which is at 97.3%, working fine)

**Violation patterns**:
- **C1.1**: `edit(agents/qa/workspace/unreviewed-findings.md) without prior read` — repeatedly editing workspace files without reading first
- **C1.4**: `Last tool call was edit(), not finish()` — QA is ending sessions mid-edit
- **C8.2**: `No finish() call` — QA fails to call finish() entirely

**Root cause hypothesis**: QA may be hitting budget limits or session timeouts, causing sessions to end before finish() is called. This would explain both C1.4 and C8.2 simultaneously (both indicate abnormal session termination). C1.1 is a separate behavioral issue.

**Recommendations**:
1. Deploy `read-before-edit.md` to QA (for C1.1)
2. Investigate session completion patterns — are QA sessions running out of budget?
3. Consider `verify-before-finish` micro-skill for QA (for C1.4/C8.2)

### 2.3 WATCH: Bob C6.1 Budget Discipline

**Current**: 89.0% (138/155) — just below 90% threshold  
**This is NOT skill-related** — no skill targets budget discipline. This is a behavioral pattern where bob occasionally exceeds budget. Monitor but don't deploy a skill (C6.1 is not a process behavior that skills fix well).

### 2.4 WATCH: May C7.1 Path Discipline

**Current**: 85.1% (63/74) — below 90%  
**Convention**: Writing to correct paths (workspace vs shared areas)  
**No skill deployed for this.** May's path violations should be investigated — is this workspace writes outside the expected directory?

---

## Section 3: Knowledge Application Gap Analysis

### 3.1 Deployed KEs vs. Convention Coverage

| Convention | Related KE | Deployed Skill | Status |
|-----------|-----------|----------------|--------|
| C1.1 | KE-023 | read-before-edit | ⚠️ Partially effective; QA has no coverage |
| C1.3 | KE-136 | verify-after-edit | ✅ Fleet-wide, working |
| C1.4 | — | — | ❌ No skill targets this; QA at 72.6% |
| C1.5 | — | verify-context-claims (bob only) | ⚠️ Single-agent coverage |
| C1.7 | — | verify-before-finish (may only) | ⚠️ Single-agent; others are fine without it |
| C6.1 | — | — | ⚠️ No skill; bob at 89% |
| C8.2 | — | — | ❌ No skill targets this; QA at 72.6% |
| C12.1 | KE-011/020/026 | verify-context-claims (bob only) | ⚠️ Fleet at 96.7% without broad deployment |

### 3.2 High-Priority Undeployed KEs

From the KE Deployment Status audit (146 KEs, only 15% deployed):

1. **KE-002** (Text rules don't fix judgment): 3 disproven-as-text skills still on coder (classify-then-act, investigate-and-fix, evidence-over-narrative) — 16KB of proven-ineffective context. The skill-overlap audit already flagged this.

2. **KE-093** (Verification confabulation): evidence-over-narrative deployed to coder only, but it's disproven as text injection. Should be deployed as L5 workflow to agents with verification failures.

3. **KE-091** (CIVC alignment tax): Verification guards applied uniformly. Should gate by task complexity.

4. **KE-008** (Heartbeat restructuring causes regression): No protection against agents modifying heartbeat step ordering.

### 3.3 Skill Overlap / Iatrogenesis Risk

Per the skill-overlap audit:
- **Coder**: 43KB across 10 skill files — 6 should be removed (3 disproven-as-text, 3 untested)
- **Recommended coder reduction**: 10→4 files, 43KB→17KB (62% reduction)
- **Other agents**: Within acceptable range (5-22KB, 2-6 distinct skills)

---

## Section 4: Internalization Assessment

**Question**: Have any agents internalized skill behaviors such that the skill could be removed?

### Candidates for Skill Removal (Internalized)
None currently. Even verify-after-edit at 95.8% fleet-wide could regress if removed (per EXP-028 workflow collapse: removing references causes immediate usage collapse).

### Candidates for Enhanced Deployment
| Skill | Current Agents | Should Add To | Evidence |
|-------|---------------|---------------|----------|
| read-before-edit | bob, may, scout, tech-lead | **QA** | QA C1.1 at 43%, no coverage |
| verify-before-finish | may | **QA** | QA C8.2 at 72.6%, no coverage |

---

## Section 5: Recommendations (Priority Order)

### P0 — Immediate Action
1. **Deploy read-before-edit to QA** — C1.1 at 43.2% with no skill coverage
2. **Patch optimizer's deliverable-checklist skill** — add verify step after write(), causing C1.3 regression from 99% to 83%
3. **Investigate QA session completion** — C1.4/C8.2 both at 72.6% suggests sessions aren't completing normally

### P1 — This Week
4. **Remove 6 disproven/untested skills from coder** — per skill-overlap audit, 27KB reduction, reduces iatrogenic risk per KE-123
5. **Deploy verify-before-finish micro-skill to QA** — for C8.2 coverage
6. **Investigate May C7.1** — 85.1% path discipline, understand violation pattern

### P2 — Monitoring
7. **Bob C6.1** — 89.0% budget discipline, monitor for further decline
8. **Scout C1.1** — recovered to 93% but historically volatile, watch for regression
9. **Evaluate whether heartbeat workflow gate (scout) explains C1.1 recovery** — if so, consider similar gates for other agents

---

## Appendix: Data Quality Notes

- **Convention checks**: 58,260 in 48h across 12 conventions × ~9 agents
- **Timestamps**: Milliseconds since epoch (verified: 1775978622463 → 2026-04-12T07:23:42Z)
- **Convention maturity table**: Empty (not populated by infrastructure)
- **Sample sizes**: Coder (3 checks/48h) and amy-kimi (1 check/48h) have insufficient data for trend analysis
- **Evaluator**: Not tracked in convention_checks (evaluates others, not evaluated itself)
