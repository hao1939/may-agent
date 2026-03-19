# Verification Skill Evaluation — 2026-03-19

**Evaluator**: Evaluator agent (s_1773955404947_74)  
**Skill Version**: 1.3.0  
**Sessions Analyzed**: 15 (across 7 agents)  
**Time Range**: 2026-03-19 ~15:00–21:20 UTC  

---

## Executive Summary

The verification skill is **well-adopted** across the agent population. In 15 sessions analyzed, **11 showed strong verification behavior** — agents ran compilers, read files back, diffed outputs, and checked results before claiming completion. Two sessions showed acceptable-but-borderline behavior (the "pre-existing excuse" pattern from AP-3). Two sessions were N/A (pure analysis/routing with no artifacts to verify).

**Overall Effectiveness Score: 7.5/10**

The skill's principles are landing. The anti-pattern catalog is comprehensive and clearly influencing behavior. However, two gaps remain: (1) the "pre-existing excuse" pattern is still being used legitimately but risks becoming a rationalization escape hatch, and (2) there's no enforcement mechanism — compliance is entirely voluntary, making the skill fragile under time pressure.

---

## Methodology

Analyzed `session.jsonl` transcripts for 15 sessions across 7 agents (coach, qa, coder, tech-lead, optimizer, amy-kimi, may). For each session, I examined:
- Whether the agent ran verification commands (read, bash, grep, tsc, diff) after making changes
- Whether verification results were acknowledged and acted upon
- Whether the agent used anti-patterns described in the skill (AP-1 through AP-9)
- The tool call sequence — specifically whether `finish()` was preceded by verification tools

---

## Session-by-Session Analysis

### ✅ PASS: Strong Verification

**1. Coder — s_1773951774679_57** (implement lessons field)  
Textbook verification. After making 5 edits to `lifecycle.ts`:
- Ran `npx tsc --noEmit` → confirmed 0 errors
- Read the full file back to spot-check all changes  
- Only then called `finish()`  
**Evidence**: MSG 19 "Let me verify with TypeScript", MSG 21 "final review of the complete file"

**2. QA — s_1773951845360_58** (review code changes)  
Used PROMISE pattern. Independently verified the coder's work:
- Read the changed file
- Ran `tsc --noEmit`
- Ran vitest (which failed for environment reasons)
- Reported the environmental failure honestly rather than ignoring it  
**Evidence**: MSG 1 "PROMISE (deliverables): 1) Read the changed file..."

**3. QA — s_1773951918551_60** (re-review)  
Same PROMISE pattern. Re-verified after coder's fixes:
- Re-read `lifecycle.ts`
- Re-ran tsc
- Re-ran vitest (still failing for env reasons)
- Clearly documented what passed vs what was environmentally blocked  
**Evidence**: MSG 1 "PROMISE: 1) Verify repo diff..."

**4. Coach — s_1773952477100_64** (fork and apply improvement)  
Multi-layer verification:
- Read back the modified SOUL.md to confirm edit landed
- Ran `diff` between fork and production to confirm exactly 1 change
- Ran `ls` comparison to verify no accidental file modifications  
**Evidence**: MSG 18 "verify by reading back", MSG 20 "verify the fork is otherwise identical by diffing", MSG 22 "verify no other files were accidentally modified"

**5. Coach — s_1773950873954_55** (reflect on human inputs)  
After writing reflection file and updating tracker:
- Ran bash to verify files were written correctly
- Confirmed both files exist and contain expected content
- Updated todo.md and re-verified  
**Evidence**: MSG 21 "verify the files were written correctly", MSG 23 "Both files verified"

**6. Coach — s_1773953199951_65** (common-sense-verify)  
This session IS verification — coach evaluated whether agents follow C3.3 (Safe Append):
- Cross-referenced actual tool calls in historical sessions
- Found both PASS and FAIL examples with specific evidence
- Read back tracker edits to confirm update was correct  
**Evidence**: MSG 51 "verify the file was written correctly by reading the new row"

**7. Tech-lead — s_1773951669206_56** (heartbeat — dispatch implementation)  
Strong verification before committing:
- Ran `tsc --noEmit` before and after code was changed
- Verified `git diff` showed expected changes
- Committed only after verification passed  
**Evidence**: MSG 10 "TSC clean (0 errors), git clean", MSG 40 "TSC clean, one file changed", MSG 42 "All 5 changes are correct"

**8. Amy-kimi — s_1773948918705_52** (heartbeat content exploration)  
After editing `insights.md`:
- Ran bash to verify file integrity
- Checked line count to confirm file wasn't corrupted or overwritten
- Explicitly stated "文件完整性验证成功 ✅"  
**Evidence**: MSG 27 "立即验证文件完整性", MSG 29 "文件完整性验证成功"

**9. May — s_1773950102476_54** (heartbeat triage)  
Before marking security patches as "already applied":
- Read both target SOUL.md files to verify content was present
- Confirmed exact section names matched expectations
- Only then marked the work item as complete  
**Evidence**: MSG 13 "Both SOUL.md files already have the P13 and P108 sections applied"

**10. Amy-kimi — s_1773954318873_69** (heartbeat)  
After editing content files:
- Ran bash verification after each edit
- Read back modified files to confirm content  
**Tool sequence**: edit → bash → bash → bash → bash → read → bash → edit → bash → bash → bash → finish

**11. Coach — s_1773952330370_62** (heartbeat)  
Used workflow for delegation, checked results:
- Ran bash checks before and after workflow
- Verified workflow completion  
**Tool sequence**: bash → bash → bash → bash → bash → bash → bash → workflow → bash → finish

---

### ⚠️ BORDERLINE: Pre-Existing Excuse (AP-3 Risk)

**12. Coder — s_1773951888028_59** (fix QA issues)  
The coder correctly ran `tsc --noEmit` (which passed), but when confronting the vitest failure, used the "pre-existing" justification:
> "These are **pre-existing environment issues** that have nothing to do with my changes"

**Assessment**: This is a *correct* use of the pattern — the vitest failures genuinely ARE environmental (`node:sqlite` missing, `@mariozechner/*` not installed). The coder DID run the compiler and DID read the file back. However, per AP-3, the proper approach would be to run vitest BEFORE changes to establish a baseline, then compare. No baseline was established.

**Risk**: This exact pattern — "it was already broken" — is the most dangerous rationalization because it's often true, making it hard to distinguish legitimate from lazy uses.

**13. Tech-lead — s_1773951669206_56** (same session, different context)  
Also used the "pre-existing" phrase regarding QA's vitest gate:
> "QA's vitest gate failing — but that's a pre-existing environment issue"

Same assessment — factually correct, but no baseline comparison was done.

---

### ➖ N/A: No Verification Needed

**14. Optimizer — s_1773949740400_53** (heartbeat cost analysis)  
Pure analysis session — reading sessions, computing stats, identifying patterns. No files were created or modified that would require verification. Appropriate non-verification.

**15. May — s_1773955292834_72** (heartbeat triage)  
Brief routing session: read pending items, dispatched to agents, finished. Only 5 tool calls. No artifacts produced.

---

## Pattern Analysis

### What's Working

| Skill Principle | Adoption Rate | Evidence |
|---|---|---|
| P1: Verify with tools, not words | 11/13 applicable | All agents ran actual commands |
| P3: Verify the specific claim | 10/13 | Most agents matched verification to change type |
| P4: Verification must succeed | 11/13 | Only 2 borderline "pre-existing" cases |
| AP-5 avoidance (no skipped verification) | 13/13 | Zero sessions skipped verification entirely |
| AP-1 avoidance (intent without execution) | 13/13 | Zero "let me verify" statements without follow-through |

### What's Not Working

| Issue | Severity | Sessions Affected |
|---|---|---|
| AP-3 (pre-existing excuse) used without baseline | Medium | 2 (coder s_59, tech-lead s_56) |
| No enforcement mechanism | Systemic | All — compliance is voluntary |
| No skill self-test or audit trail | Low | N/A — evaluations dir was empty |

### Tool Sequence Analysis

Strong pattern observed: agents who make changes follow the sequence:
```
edit/write → read/bash (verification) → finish
```

No session showed the anti-pattern:
```
edit/write → finish  (no verification)
```

This is a significant positive signal — the skill's message about "never claim done without verification" has landed.

---

## Recommendations

### For Skill v1.4

1. **Add AP-3 baseline requirement as explicit protocol**: "When claiming failures are pre-existing, you MUST show the same failure existed before your changes (run the tool BEFORE editing, save output, compare after)." The current AP-3 describes the problem but doesn't give a hard protocol.

2. **Add a verification checklist prompt**: A short section agents can mentally walk through: "What did I change? What tool proves it's correct? Did I run that tool? Did it pass?" This would formalize what good agents already do.

3. **Consider a verification receipt**: When verification succeeds, agents could emit a structured signal (e.g., a field in `finish()` like `verification_evidence: [{claim: "tsc passes", tool: "bash", result: "exit 0"}]`). This would make verification auditable without relying on transcript mining.

### For Enforcement

4. **Gate `finish()` on verification**: The strongest intervention would be to require at least one `read` or `bash` call between the last `edit`/`write` call and `finish()`. This is a mechanical check that could be added to the lifecycle tool.

5. **Coach should test AP-3 specifically**: Create an exercise where the test environment has pre-existing failures, and the agent must distinguish their changes from the environment. This is the skill's weakest spot.

---

## Scoring Summary

| Dimension | Score | Rationale |
|---|---|---|
| Adoption | 8/10 | All agents with applicable tasks verified. No skipped verification. |
| Correctness | 7/10 | Most verification targets the right thing. AP-3 baseline gap in 2 sessions. |
| Completeness | 7/10 | Agents verify their main claims. Some miss secondary claims (selective verification risk). |
| Anti-Pattern Avoidance | 8/10 | AP-1, AP-5 fully avoided. AP-3 borderline in 2 sessions. AP-8, AP-9 not observed (positive). |
| **Overall** | **7.5/10** | Strong voluntary adoption. Needs enforcement mechanism for durability. |

---

*Evaluation produced by Evaluator agent. Evidence drawn from 15 session transcripts totaling ~350 tool calls.*
