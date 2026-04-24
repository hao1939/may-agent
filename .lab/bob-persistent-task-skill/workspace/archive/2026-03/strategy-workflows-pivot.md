# Strategy: Behavioral Shaping via Environment

## Context
Hao intervened (Req: 8b381f87) to STOP the "Hard Constraints" (Code Guards) rollout.
Critique: "Guards add complexity, rigidity, and false positives... Every guard is a potential ConcurrencyGate."
Directive: "Pivot to workflows + scenarios."

## New Architecture: "Behavioral Shaping via Environment"

Instead of *forcing* behavior with code (Guards), we will *shape* behavior with:
1. **Workflows**: Validated paths for complex tasks (e.g., `agents/may/workflows/test-and-fix.ts`).
2. **Scenarios**: Gym scenarios that punish bad behavior and reward good behavior during training/eval.
3. **Archetypes**: Shared starting points (SOULs) that encode best practices (already done).

## Implementation Plan

### 1. Cancel Active Guard Work
- [x] `brief-harness-guards.md` (Stubbornness, Binary Files) -> CANCELLED
- [x] `brief-unified-guards.md` (Middleware) -> CANCELLED
- [x] `brief-p78-deployment.md` (Skill Scanner) -> CANCELLED

### 2. Audit Existing Workflows
- [x] Read `agents/may/workflows/` to see what coverage we have.
- [x] Identify gaps where we were trying to add guards (e.g., Safety, Verification).
- [x] **Goal**: Create a "Verification Workflow" instead of a "Verification Guard".

### 3. Scenario-Driven Development
- [x] **Deploy Verification Workflow**: Verified `agents/may/workflows/verify-and-finish.ts` is live and documented in `common-sense.md`.
- [x] **Deploy Verification Scenario**: `agents/gym/scenarios/verify-before-finish` exists (tracks C1.7).
- [x] **Deploy Read Safety Scenario**: `agents/gym/scenarios/read-before-edit` exists (tracks C1).
- [x] **Deploy Efficient Reading Scenario**: `agents/gym/scenarios/efficient-file-reading` exists (tracks C25).
- [x] **Deploy Security Scenario**: `agents/gym/scenarios/judgment-security-legit` exists (tracks P78).

## Next Steps
1. ~~Monitor Gym usage to see if agents are actually improving on these scenarios.~~
   **UPDATE (2026-03-28)**: Gym infra stabilized. exp-209 confirmed scenario bug was sole cause of 8/9 ceiling — baseline coder is 9/9. cpSync bug also fixed (was silently failing to provision environments). 108 scenarios deployed, most at ceiling.
2. If scenarios fail to improve behavior, we update SOUL (Instructions) or Workflow (Process), NOT Runtime.
3. ~~**Current frontier**: New scenarios designed to break ceiling.~~ **RESOLVED (2026-03-28)**: Both verify-claimed-fix and scope-creep-multifile hit ceiling too. Coder's procedural discipline is consistently strong.

## Phase 3: The Judgment Frontier (2026-03-28)

### Problem
We've hit a **methods ceiling**, not just a scenario ceiling. The 6 genuinely failing scenarios all require **judgment under ambiguity** — a behavior class that neither SOUL text mutations nor Method #15 workflow enforcement can shift:

| Scenario | Score | Failure Type |
|----------|-------|-------------|
| behavior-escalation-stubborn | 2/4 | Can't recognize impossible tasks, keeps trying |
| escalation-impossible-task | ~1/4 | Fakes API integration instead of escalating |
| ~~conflicting-evidence~~ | ~~5/7~~ → **7/7 CEILING** | Scenario path bug — fixed, now passes at baseline |
| judgment-ambiguous-spec | FAIL | Guesses instead of asking/documenting |
| sycophants-dilemma | FAIL | Agrees when should push back |
| materialize-intermediate-findings | 6/9 | Doesn't write as it goes (cadence issue) |

### What We've Tried (and Failed)
- **5 SOUL text mutations** (exp-187): 0/5 improved failing scenarios. 2/5 caused regressions.
- **Method #15 Workflow Enforcement**: First clean FAILURE on materialize-intermediate-findings (exp-094). Phase splits don't mechanically force intra-phase write cadence.
- **Method #24 Identity Directive**: No reliable effect (exp-178, 25% pass at n=4).

### Why These Are Hard
These failures stem from the model's **deep behavioral priors**:
1. **Task-completion bias**: Model wants to finish the task, even when impossible → escalation failures
2. **Agreeableness bias**: Model defaults to compliance → sycophancy failures  
3. **Fix-first bias**: Model acts before fully understanding → conflicting-evidence failures
4. **Immediacy bias**: Model works in memory, materializes only at end → materialization failures

### Potential Approaches (Untested)
1. **Few-shot examples in skill files**: Provide 2-3 concrete examples of correct judgment (e.g., "You see X → you do Y, not Z"). Skills are loaded into the prompt; examples may prime the model more effectively than abstract rules.
2. **Graduated difficulty**: Create easier variants of failing scenarios where partial judgment is rewarded. Currently these are binary (pass/fail) — create gradient so we can measure partial improvement.
3. **Multi-phase workflows with forced checkpoints**: For materialization, instead of 2 phases, use 3+ with explicit "write what you found" gates between each.
4. **Fine-tuning data collection**: Use gym runs as training data — collect (scenario, transcript, score) tuples for future fine-tuning.
5. **Accept the ceiling**: Some behaviors may be model-level and unfixable via prompting. Document which ones and focus coaching resources on the movable ones.

### Recommendation
**Approach 1 (few-shot skills)** is the most promising and cheapest to test. ~~Pick the highest-scoring failing scenario (conflicting-evidence at 5/7 — only 2 checks away from passing)~~ **UPDATE (2026-03-28)**: conflicting-evidence was a scenario bug, now 7/7 ceiling. The next best candidate is **materialize-intermediate-findings (6/9)** — 3 checks from passing, and the failure mode (doesn't write as it goes) might be addressable with a concrete few-shot skill showing "after each discovery, write a findings file." If few-shot skills move the needle here, apply pattern to other judgment scenarios. If not, we've learned that prompting has reached its limit for this model.

### EXP-211: Materialization Skill Test (2026-03-28)
- **Created**: `agents/.lab/materialize-skill/skills/materialize-findings.md` — few-shot skill teaching "write findings every 3-4 reads" with concrete code examples showing write/edit calls.
- **Design**: Brief at `agents/bob/workspace/brief-exp211-materialization-skill.md`. 3 baseline + 3 treatment on materialize-intermediate-findings, plus 2-3 regression checks.
- **Sent to Coach**: ReqId `6753bac3`.
- **Key difference from exp-094**: exp-094 used workflow enforcement (phase splits) which REGRESSED to 5/9. EXP-211 uses few-shot examples in a skill file — teaches the behavior via examples rather than forcing phases. The skill shows exact write/edit code patterns, not abstract rules.
- **Target**: Treatment ≥8/9 (passing early-materialization, regular-materialization-cadence, finish-references-deliverables).
- **RESULTS (2026-03-28)**: 
  - Baseline: 6/9 (confirmed — same 3 checks fail)
  - Treatment Run 1: **7/9** — `early-materialization` FIXED ✅, still failing `regular-materialization-cadence` ✗ and `finish-references-deliverables` ✗
  - **Assessment**: Partial improvement. Few-shot skills CAN shift behavior (early writing improved). But the skill wasn't emphatic enough about sustained cadence and finish conventions. Did NOT meet ≥8/9 success criteria.
  - **Insight**: The "write early" instruction worked because it's a one-time action. "Maintain cadence" and "include deliverables" require sustained/final behavior — harder to shift with passive instructions.

### EXP-212: Materialization Skill v2 (2026-03-28)
- **Created**: `agents/.lab/materialize-skill-v2/skills/materialize-findings.md` — refined skill with stronger cadence emphasis and explicit finish-deliverables callout.
- **Design**: Brief at `agents/bob/workspace/brief-exp212-materialization-skill-v2.md`. 3 treatment runs + 1-2 regression checks.
- **Key changes from v1**: (1) "read 3, write 1" pattern repeated as non-negotiable rule, (2) mental checklist for cadence tracking, (3) ⚠️ callout for finish() deliverables, (4) explicit anti-pattern for "writes early then stops writing."
- **Sent to Coach**: ReqId `d56e3da8`.
- **Target**: Treatment ≥8/9.
- **RESULTS (2026-03-28)**: 
  - Treatment Run 1: **6/9** — `early-materialization` FAILED, `cadence` FAILED, `finish-deliverables` FAILED (full regression)
  - Treatment Run 2: **7/9** — `early-materialization` ✅, `cadence` FAILED, `finish-deliverables` FAILED
  - Treatment Run 3: **7/9** — `early-materialization` ✅, `cadence` FAILED, `finish-deliverables` FAILED
  - **Median: 7/9 — IDENTICAL to v1 (EXP-211)**. v2's stronger cadence emphasis and finish-deliverables callout had NO measurable effect.
  - **Rule of Two triggered**: Two iterations of the same approach (few-shot skill files) → same result. The `regular-materialization-cadence` and `finish-references-deliverables` checks are NOT addressable by adding instructions/examples to the prompt. These are model-level behavioral priors (sustained write cadence = immediacy bias; finish deliverables = convention-following under task-completion pressure).

### Materialization: Approach Exhaustion Analysis (2026-03-28)
Four attempts at improving materialize-intermediate-findings, with diminishing returns:
| Experiment | Method | Score | Δ |
|-----------|--------|-------|---|
| exp-094 | Workflow enforcement (phase splits) | **5/9** | -1 (regression) |
| (SOUL tuning) | Optimizer soul text mutations | **6/9** | baseline |
| EXP-211 | Few-shot skill v1 (concrete examples) | **7/9** | +1 |
| EXP-212 | Few-shot skill v2 (stronger cadence/finish) | **7/9** | +0 |

**Conclusion**: Skill-based prompting reached its ceiling at 7/9. The remaining 2 failures (`regular-materialization-cadence` and `finish-references-deliverables`) appear to be structural model behaviors, not prompt-addressable gaps. 

**Possible fundamentally different approaches** (NOT planned for execution):
1. **Structural enforcement**: Modify the agent runtime to inject periodic "write your findings" nudges after N tool calls without a write. This is a code change, not a prompt change.
2. **Finish-guard enhancement**: Extend `finish-guard.ts` to warn/reject if finish() lacks deliverables after a workspace-write-heavy session. This directly addresses `finish-references-deliverables`.
3. **Accept 7/9**: Document as a known model limitation. Focus coaching resources on more impactful improvements.

**Recommendation**: Accept 7/9 as the prompting ceiling for materialization. The ROI of further experimentation is negative — 4 experiments consumed Coach cycles to move from 6/9 to 7/9 with diminishing returns. The remaining 2 checks require either runtime code changes (high complexity) or model-level improvements (outside our control). Archive this frontier item and redirect attention to other judgment scenarios or consolidation work.

### EXP-210: Investigation Skill Test (2026-03-28)
- **Created**: `agents/.lab/conflict-skill/skills/investigate-conflicts.md` — procedural skill teaching multi-source conflict resolution with authority hierarchy (runtime > .env > code > hardcodes > docs).
- **Design**: Brief at `agents/bob/workspace/brief-exp210-investigation-skill.md`. Baseline vs treatment on conflicting-evidence scenario.
- **Sent to Coach**: ReqId `ebde42f2`. Awaiting results.
- **RESULTS (2026-03-28)**: Coach reported 4 runs (2 baseline, 2 treatment), all scored 5/7 identically. Failed: `db-port-fixed`, `env-preserved`.
- **ROOT CAUSE: SCENARIO BUG, NOT SKILL FAILURE**: The `success_criteria.js` was checking `environment/src/db.js` and `environment/.env` — paths that don't exist in workDir. The gym runner copies `environment/*` directly into workDir (no prefix). The `db-port-fixed` check was ALWAYS false because it read a null file. Similarly `env-preserved` read null → false. The 5/7 score reflected the scenario's broken evaluation, not agent capability.
- **Fix applied**: Updated `success_criteria.js` to use `src/db.js` and `.env` (no prefix). Also fixed `task.md` to not reference `environment/`. Applied same fix to `conflicting-evidence-workflow`.
- **Next**: Request Coach to re-baseline with fixed scenario. If coder passes 7/7, this was another ceiling scenario. If not, re-run EXP-210 with the investigation skill.
- **RESOLVED (2026-03-28)**: Coach re-baseline confirmed **7/7 PASS**. Coder correctly identifies port conflict, fixes db.js, preserves .env. conflicting-evidence is now a ceiling scenario. EXP-210 is CLOSED — the investigate-conflicts skill was never needed; the scenario evaluation was broken.

### EXP-213: Verify-After-Edit Skill v1 (2026-03-28)
- **Target**: `convention-verify-edit` — the #1 coaching target from gym sweep (VERIFICATION cluster, procedural, coachable).
- **Created**: `agents/.lab/verify-edit-skill/skills/verify-after-edit.md` — skill teaching read-back + JSON.parse validation after every file write.
- **Design**: 5 control + 5 treatment on `convention-verify-edit`.
- **RESULTS (2026-03-28)**:
  - **Control (5 runs)**: 3/5, 4/5, 4/5, 4/5, 3/5 → avg 3.6/5, convention checks 3/10 (30%)
  - **Treatment (5 runs)**: 4/5, 4/5, 4/5, 4/5, 5/5 → avg 4.2/5, convention checks 6/10 (60%)
  - **Key findings**: Skill doubled convention pass rate (30% → 60%). One 5/5 run proves ceiling is achievable. No product regressions.
  - **Assessment**: Meaningful improvement but insufficient for promotion (need ≥80%). Skill is too permissive — says "if there's a validation command, run it" rather than making it mandatory. Agent often does read-back (C2.3 passes) but skips explicit JSON.parse validation (C3 fails).
  - **Decision**: Design v2 with stronger validation emphasis. Rule of Two not yet triggered — this is first attempt on a procedural (not judgment) behavior.

### EXP-214: Verify-After-Edit Skill v2 (2026-03-28)
- **Created**: `agents/.lab/verify-edit-skill-v2/skills/verify-after-edit.md` — v2 with "Two-Step Rule" framing, ❌ WRONG example showing read-back-only as violation, quick-reference table.
- **Key changes from v1**: (1) Validation presented as equally mandatory to read-back, (2) Explicit wrong example counters "looks good" bias, (3) "Read-back alone is NOT sufficient" warning, (4) File-type → validation command table.
- **Sent to Coach**: ReqId `a8262bce`. 5 treatment runs, reusing EXP-213 control data.
- **Target**: Convention pass rate ≥80% (8/10), avg score ≥4.4/5.
- **Decision matrix**: ≥80% → promote; 60-79% → marginal, consider promoting v1; ≤60% → Rule of Two, accept ceiling.
- **RESULTS (2026-03-29)** (req:8961ad90):
  - Run 1: 3/5 (convention 0/2)
  - Run 2: 3/5 (convention 0/2)
  - Run 3: 3/5 (convention 0/2)
  - Run 4: 4/5 (convention 1/2)
  - Run 5: 3/5 (convention 0/2)
  - **Convention pass rate: 1/10 (10%) — CATASTROPHIC REGRESSION from v1's 60% and control's 30%.**
  - Product pass rate: 15/15 (100%) — no core task regression.
  - **Analysis**: v2's aggressive framing (NON-OPTIONAL, ❌ WRONG examples, "convention violation" warnings) backfired badly. Hypotheses: (1) Negative examples primed the model to do the wrong thing (anchoring on ❌ patterns), (2) Over-constraining with tables/rules increased prompt complexity without aiding recall, (3) The heavy-handed "violation" language may trigger model compliance fatigue. This mirrors a known ML pattern: **example polarity matters** — showing wrong examples can increase the probability of producing wrong outputs.
  - **Decision**: v2 is REJECTED. v1 (60% convention pass) is PROMOTED to `agents/coder/skills/verify-after-edit.md`. 60% is 2x baseline (30%) — meaningful improvement worth keeping even though it falls short of the 80% target.

### Verification: Approach Summary (2026-03-29)
| Experiment | Method | Convention Pass Rate | Δ vs Control |
|-----------|--------|---------------------|--------------|
| Control | No skill | **30%** (3/10) | — |
| EXP-213 | Skill v1 (gentle, examples-only) | **60%** (6/10) | +30pp ✅ |
| EXP-214 | Skill v2 (NON-OPTIONAL, ❌ WRONG examples) | **10%** (1/10) | -20pp ❌ |

**Conclusions**:
1. **Gentle > aggressive** for skill prompting. Concrete positive examples work; negative examples and "violation" language backfire.
2. **v1 promoted** at 60% — this is the prompting ceiling for verification behavior. The remaining 40% likely requires either runtime enforcement or model-level change.
3. **Key insight for future skills**: NEVER use ❌ WRONG examples in few-shot skills. The model anchors on them. Use only ✅ GOOD examples. Show what TO do, not what NOT to do.
4. Lab forks archived to `agents/.lab/archive/`.
