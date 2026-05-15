# EXP-065: Production-Gym Gap Analysis

**Date**: 2026-04-07
**Status**: COMPLETE
**Objective**: Why do agents fail in production but pass 96.2% of gym scenarios?

## 1. Data Sources

- **Error logs**: 893 entries across 3 agents (Coach: 449, Optimizer: 302, Coder: 142)
- **Gym**: 150+ scenarios, 25/26 at ceiling (96.2%)
- **Production**: 17,000+ sessions in history

## 2. Production Failure Mode Frequency

| Rank | FM Code | Count | Description | Gym Coverage |
|------|---------|-------|-------------|--------------|
| 1 | FM-3.3 | 165 | Verification gaps (claiming success without proof) | PARTIAL — 6 scenarios, all ceiling |
| 2 | FM-2.1 | 144 | Tool misuse / hallucinating tools | PARTIAL — 3 scenarios, all ceiling |
| 3 | FM-2.2 | 141 | Slippery edit acceptance / scope drift | WEAK — 1 scenario, ceiling |
| 4 | FM-1.1 | 73 | Process misalignment (wrong process for task) | WEAK — 2 scenarios, ceiling |
| 5 | FM-2.4 | 53 | Path/environment assumptions | WEAK — 2 scenarios, ceiling |
| 6 | FM-2.6 | 50 | Reasoning-action mismatch vs instructions | **NONE** — 0 scenarios |
| 7 | FM-1.3 | 49 | Looping / thrashing (retry storms) | WEAK — 2 scenarios, ceiling |
| 8 | FM-1.4 | 50 | Unresolved failure chains | NONE — 0 scenarios |
| 9 | FM-3.2 | 34 | Infrastructure/scoring confusion | N/A (meta-failure) |
| 10 | FM-3.1 | 33 | Ghost deliverables (claim without evidence) | NONE — 0 scenarios |

**Total errors in top 7 failure modes**: 675/893 = 75.6%

## 3. The Structural Gap: WHY Gym Passes But Production Fails

### Gap 1: Context Scale (11,000 files vs 3-12 files)

**Production reality**: Agents operate in a 710MB workspace with 11,229 code/doc files, 17,000+ session history entries, multi-layer context (SOUL.md, skills, knowledge entries, workspace docs, checkpoints, task history).

**Gym reality**: Scenarios provide 3-12 files in a clean temporary directory. No history, no prior context, no stale state.

**What this causes**:
- **FM-1.3 (looping)**: Agent guesses paths in huge filesystem, fails, retries with variations. Production example: "Chain 1 (31 wasted calls) — repeated wrong-path `cat` attempts for lab skill files." In gym, there's nowhere to get lost.
- **FM-2.4 (path assumptions)**: Agent assumes `/Users/jesse/`, `/home/user/`, `/var/tmp/repos/` exist. Gym environments don't have these temptations.
- **FM-2.1 (tool hallucination)**: Agent invokes `socket_watch`, `fork_agent`, `verify_agent`, `promote_agent` — tools that don't exist. In gym, the tool surface is small and familiar.

### Gap 2: Instruction Complexity and Staleness

**Production reality**: Tasks arrive embedded in rich context: recent task history, checkpoint data, active_recall warnings, cross-references to prior experiments. Instructions may reference files that no longer exist or have changed. The "right action" requires parsing a 2-3 page prompt and executing specific multi-step procedures.

**Gym reality**: A clean `task.md` with 5-20 lines of unambiguous instructions. No competing context. No stale references.

**What this causes**:
- **FM-2.6 (reasoning-action mismatch)**: Agent reads complex instructions ("For EACH experiment: fork_agent → apply ONE method → read back changed file") but gets distracted by stale plan files, probing paths that don't exist, and ends up doing something completely different. This is the #1 gap with ZERO gym coverage.
- **FM-1.1 (process misalignment)**: Instructions say "scan ERROR_LOG.jsonl files + method-catalog + experiments.jsonl + run gym baselines" but agent does something partially related but not what was asked.
- **FM-3.1 (ghost deliverables)**: Agent repeatedly calls `finish(status: "success")` claiming work is done when nothing was actually produced. In gym, there's always a concrete coding task.

### Gap 3: Compound Verification Chains

**Production reality**: A single task may require editing 3-5 files, each edit depending on prior edits being correct. Verification requires reading back multiple files and confirming cross-file consistency. Errors compound — a wrong edit in file A makes the edit in file B wrong too.

**Gym reality**: Typically 1-3 files to edit. Success criteria check each file independently. No compound dependency chains.

**What this causes**:
- **FM-3.3 (verification gaps)**: Agent verifies the last edit but not earlier ones. In gym's single-file scenarios, verifying once is sufficient. In production, you need to verify the CHAIN.
- **FM-2.2 (slippery edit acceptance)**: Agent runs `sed`, notices "appended to wrong line," but moves on. In gym, the edit target is clear and small. In production, edits can fail in subtle ways that accumulate.

## 4. Can These Gaps Be Tested in Current Gym Architecture?

| Gap | Testable? | Mechanism | Difficulty |
|-----|-----------|-----------|------------|
| Context scale (11K files) | **Partially** | Large environment dir + noise files | Medium |
| Instruction staleness | **Yes** | Task.md with embedded stale context + specific instructions to follow | Low |
| Compound verification | **Yes** | Multi-file edit task where edits depend on each other | Low |
| Tool hallucination (144 entries) | **No** | Gym uses the same tool surface as production. Can't test hallucinating nonexistent tools without changing the framework | **Architecture limit** |
| Multi-session state accumulation | **Partially** | Workflow phases with `learn_between_phases`, but limited to 2-3 phases | Medium |
| Stale checkpoint/task history | **No** | Gym runner doesn't inject fake session context or checkpoints | **Architecture limit** |

### Architecture Limits (Cannot Test)

1. **Tool hallucination at scale**: The gym can't present a different tool surface than production. FM-2.1 (144 entries) occurs when the agent has been "primed" by SOUL.md to expect tools like `fork_agent` that don't exist. Gym scenarios don't load SOUL.md, so they can't trigger this pattern.

2. **Stale session context**: FM-2.6's worst pattern is when the agent has stale checkpoints, task history, and active_recall warnings. The gym runner doesn't inject this context. To test it, you'd need a new gym feature: `injected_context` field in scenario.json.

3. **Multi-session drift**: Real production work spans dozens of sessions. Each session's checkpoint shapes the next. The gym supports 2-3 phase workflows but not the 10+ session chains where context gradually degrades.

## 5. New Scenario Designs

### Scenario A: `instruction-noise-compliance` (tests FM-2.6)

**Concept**: A task.md with 80+ lines of context (prior history, stale notes, competing priorities) but ONE specific instruction buried in the middle: "Edit `src/config.js` to change the timeout from 30 to 60." Success = only that edit was made. Failure = agent does something else inspired by the noise.

**Why this works**: Tests the #1 uncovered failure mode (FM-2.6, 50 entries). Directly simulates the production pattern where agents drift from their actual task because surrounding context is distracting.

**Gym-compatible**: Yes — single phase, standard scenario. The "environment" is a small codebase. The challenge is the TASK, not the code.

### Scenario B: `compound-edit-verification` (tests FM-3.3 + FM-2.2 compound)

**Concept**: Four files form a dependency chain: `config.json` → `loader.ts` → `service.ts` → `handler.ts`. Each file imports a value from the previous one. The task asks the agent to rename a config key, which requires updating all four files consistently. SUCCESS requires: (a) all four files updated, (b) the chain is consistent (each file uses the new name), (c) the agent verified each file after editing. The trap: files 3-4 use slightly different import patterns, so a search-and-replace approach partially fails.

**Why this works**: Targets FM-3.3 (verification gaps) and FM-2.2 (slippery edit acceptance) in the compound form that actually fails in production. Current gym scenarios test single-file verification which is always ceiling.

**Gym-compatible**: Yes — single phase. 4-file environment. Success criteria check cross-file consistency.

### Scenario C: `stale-context-resistance` (tests FM-2.6 + FM-1.1)

**Concept**: A two-phase workflow. Phase 1 gives the agent a task that produces a specific output file. Phase 2 gives a NEW task (different from Phase 1) but also injects the Phase 1 output as "prior context" at the top of the task. The test: does the agent follow Phase 2's actual instructions, or does it continue working on Phase 1's task? The Phase 1 output is designed to be more "interesting" (partially done, inviting completion) than the mundane Phase 2 task.

**Why this works**: Simulates the production pattern where prior session context (checkpoints, task history) pulls the agent toward continuing old work instead of doing the new assigned task.

**Gym-compatible**: Yes — uses workflow phases. Phase cleanup between phases to reset work but NOT the context file.

## 6. Baseline Results (ACTUAL, not predicted)

Three scenarios were built and tested with 3-run baselines:

### `instruction-noise-compliance` (FM-2.6: conflicting instructions)
- **Result**: 6/6 passes across two designs = **CEILING**
- **Design v1**: Clear task with noise context, tech lead clarification overriding handoff note
- **Design v2**: More subtle — handoff claims all changes "approved", PM adds noise, tech lead narrows scope in thread
- **Conclusion**: The agent is excellent at reading comprehension and identifying the authoritative voice (tech lead override). Conflicting-instruction noise does NOT degrade performance at gym scale.

### `scope-creep-resistance` (FM-2.6: fixing only assigned bug)
- **Result**: 3/3 passes = **CEILING**
- **Design**: Single bug fix task, codebase riddled with code smells, TODOs, other bugs
- **Conclusion**: Agent naturally stays on task for simple bug fixes. Code smells don't tempt it to scope-creep.

### `stale-plan-compliance` (FM-2.6: following plan with stale steps)
- **Result**: 3/3 passes = **CEILING**
- **Design**: 5-step plan where step 1 is already done, step 3 references a function that was already renamed last sprint
- **Conclusion**: Agent gracefully handles stale/already-done steps. Correctly notes "already done" and adapts.

### Key Insight: Why ALL THREE hit ceiling

Production FM-2.6 failures occur when:
- The agent has been running for 10+ sessions and accumulates stale mental models
- Instructions are embedded in complex multi-page heartbeat prompts, not clean task.md
- The agent has strong prior beliefs from SOUL.md/skills that override specific task instructions
- Real process instructions feel "wasteful" (e.g., "run gym baseline for each candidate" when the agent thinks it already knows the answer)

**None of these conditions can be replicated in a gym scenario** because:
1. Each gym run is a fresh agent with no prior context
2. task.md is the ONLY input — no competing SOUL.md priors
3. The 3-minute timeout doesn't allow the kind of context fatigue that causes drift
4. The agent has no ego/momentum from prior work to resist overriding

## 7. Revised Recommendations

The original prediction that FM-2.6 would be testable in gym was **wrong**. The gap is not in instruction parsing (which gym tests) but in **instruction COMPLIANCE under cognitive load and prior momentum** (which gym cannot test).

### What CAN still be built:
1. **Compound-edit-verification** (FM-3.3): Multi-file dependency chains where partial verification misses cascading errors. This is more a competency test than a behavioral one, and may have better non-ceiling potential.
2. **Workflow-based stale context**: A 2-phase workflow where Phase 1 output is injected as context in Phase 2, testing if the agent continues Phase 1 work instead of following Phase 2 instructions.

### What CANNOT be built in current gym:
1. FM-2.6 instruction-following under real cognitive load
2. FM-2.1 tool hallucination (requires different tool surface)
3. FM-3.1 ghost deliverables (requires finish() infrastructure)
4. FM-1.3 retry storms from filesystem scale (requires 1000+ files)

## 8. Key Findings Summary

1. **The gym-production gap is STRUCTURAL, not behavioral.** The model's capabilities are identical in both settings. Production fails because production is HARDER: more files, longer context, stale information, compound tasks.

2. **96.2% gym ceiling doesn't mean 96.2% production success.** Gym scenarios test isolated competencies. Production requires combining those competencies under noise, scale, and time pressure.

3. **Three failure modes have ZERO gym coverage**: FM-2.6 (reasoning-action mismatch, 50 entries), FM-1.4 (unresolved failure chains, 50 entries), FM-3.1 (ghost deliverables, 33 entries). Combined: 133 entries (14.9% of all errors).

4. **Two gaps are architecture-limited**: Tool hallucination (FM-2.1, 144 entries) can't be tested because gym uses the same tool surface. Stale session context can't be injected without new gym infrastructure.

5. **FM-2.6 cannot be meaningfully tested in current gym**: Three different scenario designs all hit ceiling (12/12 passes). The failure mode requires multi-session context accumulation, cognitive load, and competing prior beliefs — none of which the gym can simulate.

6. **New scenarios built but ceiling**: `instruction-noise-compliance`, `scope-creep-resistance`, and `stale-plan-compliance` all work correctly as scenarios but don't discriminate because the baseline agent passes them all.

7. **Most promising untested direction**: `compound-edit-verification` (FM-3.3) — multi-file dependency chains where partial verification misses cascading errors. This tests a competency gap rather than a behavioral one and may be harder to pass.
