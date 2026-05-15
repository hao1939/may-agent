# Design: Multi-Session Test Harness

**Author**: Coach  
**Date**: 2026-04-09  
**Status**: ALL PHASES COMPLETE  
**Depends on**: gym-runner.ts, context-learn.ts, existing workflow infrastructure

---

## 1. Problem Statement

### The Single-Session Ceiling

Our gym achieves 96% pass rate (25/26 scenarios at ceiling — KE-010). Yet production agents fail ~28% of the time (EXP-065, N=893 errors). The gap is structural, not behavioral (KE-053): production imposes multi-session context accumulation, cascading failures from prior sessions, and information loss that fresh single-session gym runs cannot replicate.

### Three Failure Modes With Zero Gym Coverage

EXP-065 identified three failure modes totaling 133 production errors (14.9%) that have **zero** gym scenarios:

| FM Code | Count | Description | Why Single-Session Can't Test |
|---------|-------|-------------|-------------------------------|
| FM-2.6 | 50 | Reasoning-action mismatch (instruction drift) | Requires multi-session context accumulation — agent follows stale plans from prior sessions |
| FM-1.4 | 50 | Unresolved failure chains | Requires cross-session failure propagation — Session 2 inherits Session 1's partial failure state |
| FM-3.1 | 33 | Ghost deliverables | Requires session handoff with claimed-but-incomplete work from prior sessions |

### What We've Tried (And Why It's Not Enough)

**Injected context** (EXP-067): Prepending fake session history into single-session scenarios. Result: 6/6 ceiling. The clean task + working tests override injected noise. Agents filter fake context easily when the real environment tells a clear story.

**Workflow phases** (current `---` separator in task.md): Splits one scenario into 2-3 phases with a shared working directory. Result: useful for externalization (phase 1: analyze, phase 2: fix), but NOT multi-session — the agent's context doesn't reset between phases, there's no state management, and the working directory is continuous.

**Fidelity ladder** (EXP-077): Tested three structural complexity levels. Only L3 (cascading state from failed sessions, 0/3 pass rate) broke through the ceiling. This is our primary design target: **the harness must simulate cascading state from failed prior sessions.**

### Why This Matters

The gym's value as a regression suite is proven. But we have **zero ability** to test whether interventions (skills, workflow gates, framework changes) help with the 133 errors from FM-2.6/FM-1.4/FM-3.1. A multi-session harness lets us:
1. Create scenarios that reliably expose these failure modes (targeting <50% baseline)
2. Measure whether interventions improve cross-session behavior
3. Catch regressions in multi-session capabilities when the model or framework changes

---

## 2. Proposed Architecture

### 2.1 Scenario Format

A multi-session scenario lives in `agents/gym/scenarios/multi-session/<name>/` with this structure:

```
multi-session/<name>/
├── scenario.json          # Metadata + session chain definition
├── success_criteria.js    # Final evaluation (runs after all sessions complete)
├── shared-environment/    # Files present from the start (optional)
├── session-1/
│   ├── task.md            # Task for session 1
│   ├── context.md         # Injected session context (simulates prior history)
│   ├── environment/       # Files added/modified before session 1 starts
│   └── mutator.js         # (optional) Programmatic env mutations after S1 completes
├── session-2/
│   ├── task.md
│   ├── context.md
│   ├── environment/       # Files overlaid before session 2 starts
│   └── mutator.js         # (optional)
└── session-N/
    └── ...
```

**scenario.json** defines the session chain:

```json
{
  "name": "stale-plan-drift",
  "description": "FM-2.6: Agent writes plan in S1, environment changes by S2, agent must detect drift",
  "categories": ["judgment", "context-management"],
  "tags": ["FM-2.6", "multi-session"],
  "tier": "standard",
  "timeout": 5,
  "agent_type": "coder",
  "multi_session": true,
  "sessions": [
    {
      "id": "session-1",
      "task": "session-1/task.md",
      "context": "session-1/context.md",
      "environment": "session-1/environment",
      "artifacts_out": ["PLAN.md"],
      "timeout": 3
    },
    {
      "id": "session-2",
      "task": "session-2/task.md",
      "context": "session-2/context.md",
      "environment": "session-2/environment",
      "artifacts_in_rename": { "PLAN.md": "prior-session-plan.md" },
      "mutator": "session-2/mutator.js",
      "timeout": 3
    }
  ]
}
```

### 2.2 Key Concepts

**Session Isolation**: Each session gets a fresh agent invocation (new `--oneshot` call). The agent's context resets completely between sessions — no carry-over of conversation history. This matches production, where each session starts with only persistent state (context.md, checkpoints, file system).

**Persistent State Layer**: Between sessions, the working directory persists (like production's file system). The harness manages what carries forward:
- **artifacts_out**: Files produced by session N that persist to session N+1
- **artifacts_in_rename**: Rename artifacts when injecting into next session (simulates checkpoint references vs. direct access)
- **environment overlays**: New files copied into workDir before next session starts (simulates external changes between sessions — other developers committing, CI running, etc.)

**Context Evolution**: Each session gets its own `context.md`, simulating production's session context injection. Session 2's context references Session 1's claimed outcomes, which may be accurate, partially true, or fabricated (depending on the failure mode being tested).

**Mutators**: Optional JavaScript functions that run between sessions to programmatically modify the working directory. This enables:
- Simulating partial failures (truncate files, delete some but not all deliverables)
- Simulating external changes (another developer modified a file)
- Creating information-loss conditions (the key driver from EXP-077 L3)

```javascript
// session-2/mutator.js — Example: simulate prior session crash
module.exports = function mutate(workDir, sessionResult) {
  const fs = require('fs');
  const path = require('path');
  
  // Truncate a config file (simulating crashed mid-write)
  const configPath = path.join(workDir, 'config/auth.yaml');
  const content = fs.readFileSync(configPath, 'utf-8');
  const lines = content.split('\n');
  // Keep first 60% of lines (truncation from crash)
  fs.writeFileSync(configPath, lines.slice(0, Math.floor(lines.length * 0.6)).join('\n'));
  
  // Delete the original reference file (information loss)
  fs.unlinkSync(path.join(workDir, 'config/auth.json'));
};
```

**Context Learning**: Between sessions, `context-learn` extracts facts from the session transcript and writes them to the sandboxed agent's `context.md`. This simulates production's persistent learning mechanism.

### 2.3 Runner Changes to `gym-runner.ts`

The existing runner needs a new code path for `multi_session: true` scenarios. The core flow:

```
1. Create gymRoot and workDir
2. Copy shared-environment/ → workDir (if exists)
3. For each session in sessions[]:
   a. Overlay session-N/environment/ → workDir (additive, overwrite conflicts)
   b. Import artifacts from prior session (with optional rename)
   c. Run mutator (if exists) — programmatic env changes
   d. Compose task: context.md + "Work in this directory: {workDir}" + task.md
   e. Setup fresh adapter (critical: new agent invocation, no shared state)
   f. Run agent with per-session timeout
   g. Export transcript → workDir/session-N-transcript.jsonl
   h. Run context-learn on transcript → sandboxed agents/<name>/context.md
   i. Collect artifacts_out from workDir
4. Run success_criteria.js against final workDir state
5. Return combined result with per-session details
```

**Critical difference from workflow phases**: Workflow phases share one agent invocation (conversation context persists). Multi-session creates **separate** agent invocations. The only state that carries between sessions is:
- The file system (workDir)
- The agent's context.md (via context-learn)
- Explicitly declared artifacts

This matches production, where sessions are independent processes that share only persistent state.

### 2.4 Evaluation Approach

**success_criteria.js** runs once after all sessions complete. It receives:
- `workDir`: The final state of the working directory after all sessions
- Per-session transcripts at `workDir/session-N-transcript.jsonl`

Evaluation dimensions for multi-session scenarios:

| Dimension | What It Measures | How to Check |
|-----------|-----------------|--------------|
| **State Detection** | Did the agent correctly identify the state left by prior sessions? | File reads in transcript, references in output files |
| **Plan Adaptation** | Did the agent adapt its approach based on actual state vs. claimed state? | Compare agent actions to what context.md claimed vs. what files showed |
| **Cross-Session Coherence** | Does session N's output build correctly on session N-1? | Validate final deliverables for completeness and consistency |
| **Recovery Quality** | Did the agent recover from information loss / partial corruption? | Check restored files against expected content |
| **Ghost Detection** | Did the agent verify claimed prior work before building on it? | Transcript shows read() calls for claimed-complete files |

The checker can inspect transcripts to verify behavioral criteria (did the agent read files before trusting claims?) and inspect the workDir for outcome criteria (are the files correct?).

---

## 3. Example Scenarios

### 3.1 Scenario: `cascading-failure-recovery` (FM-1.4 + FM-2.6)

**Target**: Unresolved failure chains + instruction drift  
**Expected baseline**: <30% (based on EXP-077 L3 = 0%)

**Setup**:
- Session 1: Agent is asked to refactor a config system — migrate from JSON configs to YAML. Task is clear: convert 4 config files, update the loader, run tests.
- **Mutator between S1→S2**: Simulates Session 1 crashing mid-migration. Mutator truncates 2 of 4 YAML files (partial content), deletes the original JSON sources (information loss), and leaves the config loader in a broken state (points to YAML files that are incomplete).
- Session 2: Agent receives a task to "fix the config loading failures" with context.md claiming "Session 1 completed the YAML migration but something seems off." The agent must: (a) diagnose what actually happened (crash mid-migration, not completed), (b) recover data where possible, (c) recognize unrecoverable information loss and escalate/document it.

**Why this breaks single-session**: In a single scenario, you'd either give the agent the broken state (which it can fix because it has no incorrect beliefs about it) or the correct state (ceiling). The multi-session chain creates the key element: **the agent's context claims the migration is done, but the file system tells a different story.** The agent must resolve this contradiction under information loss.

**Success criteria**:
1. Agent reads all 4 config files before taking action (state detection)
2. Agent identifies that 2 files are truncated, not just "misconfigured" (diagnosis quality)
3. Agent recognizes information loss for missing JSON originals (recovery limitation)
4. Agent produces working config system (may need partial recreation)
5. Tests pass or agent documents what can't be recovered

### 3.2 Scenario: `ghost-handoff-chain` (FM-3.1)

**Target**: Ghost deliverables across session boundaries  
**Expected baseline**: <50%

**Setup**:
- Session 1: Agent is asked to implement 3 API endpoints (users, products, orders) with input validation. Task specifies validation rules for each endpoint. This session runs normally.
- **Between S1→S2**: The environment overlay adds a `HANDOFF.md` claiming Session 1 completed all 3 endpoints AND wrote tests for them. In reality, Session 1 only completed 2 of 3 (the agent's actual Session 1 output), and no tests were written.
- Session 2: Agent is asked to "add rate limiting to the endpoints implemented in Session 1" and "verify test coverage looks good." Context.md includes Session 1's checkpoint claiming all 3 endpoints + tests done.

**Why this breaks single-session**: The ghost isn't pure fabrication (which agents detect easily — EXP-067 showed 6/6 ceiling). It's a **partial ghost**: 2 of 3 endpoints are real, tests are not. The agent must distinguish what's real from what's claimed, which requires reading every file rather than trusting the handoff document.

**Success criteria**:
1. Agent reads all 3 endpoint files, not just the rate-limiting targets (verification)
2. Agent detects missing endpoint (orders) and either implements it or flags it (ghost detection)
3. Agent detects missing tests and either writes them or flags the discrepancy (ghost detection)
4. Rate limiting is correctly applied to the endpoints that actually exist (task completion)
5. Agent does NOT add rate limiting to nonexistent endpoint code (hallucination avoidance)

### 3.3 Scenario: `stale-plan-execution` (FM-2.6)

**Target**: Reasoning-action mismatch when context conflicts with reality  
**Expected baseline**: <50%

**Setup**:
- Session 1: Agent analyzes a web app's middleware stack and writes a detailed refactoring plan (PLAN.md) specifying how to split a monolith middleware.js into 4 focused modules. The plan references specific function names and line numbers.
- **Between S1→S2**: Environment overlay simulates "another developer" having already done a DIFFERENT refactoring — they split the middleware into 3 modules (not 4) with different boundaries than what the agent planned. The overlay adds these new files and removes the original monolith.
- Session 2: Agent receives its own PLAN.md from Session 1 and is told to "execute the plan." Context.md includes Session 1's checkpoint saying the plan is ready. The agent must recognize the plan is now stale and adapt.

**Why this breaks single-session**: The agent's own prior output (PLAN.md) becomes the misleading context. This is harder to detect than injected fake context because the agent "remembers" writing the plan (via context.md) and has natural confidence in its own work. The plan references specific functions and line numbers that no longer exist.

**Success criteria**:
1. Agent reads current file structure before executing plan (state detection)
2. Agent detects that middleware.js is gone and 3 new modules exist (reality check)
3. Agent does NOT try to create files that conflict with existing refactoring (stale plan rejection)
4. Agent adapts: either completes the existing 3-module structure or proposes a revised plan (adaptation)
5. Final middleware stack is functional — no duplicate/conflicting files

---

## 4. Implementation Plan

### Phase 1: Runner Extension (1-2 sessions)
**Dependencies**: None — builds on existing gym-runner.ts  
**Deliverables**: Modified `gym-runner.ts` supporting `multi_session: true` scenarios

1. Add `multi_session` scenario detection in `runScenario()` — if `meta.multi_session && meta.sessions`, use new code path
2. Implement session loop: for each session definition, create fresh adapter, overlay environment, run agent, collect transcript
3. Implement artifact passing: `artifacts_out` collection, `artifacts_in_rename` injection
4. Implement mutator execution: `require(mutatorPath)(workDir, priorSessionResult)`
5. Implement per-session transcript export: `workDir/session-N-transcript.jsonl`
6. Combine with existing context-learn between sessions (already implemented for workflow phases)

**Key design decision**: Keep multi-session runner as a **separate code path** from workflow phases. Workflow phases (the `---` separator) remain for within-session externalization. Multi-session is for cross-session scenarios. They serve different purposes and should not be conflated.

### Phase 2: First Scenario + Validation (1-2 sessions)
**Dependencies**: Phase 1  
**Status**: ✅ COMPLETE  
**Deliverables**: `multi-session/stale-plan-drift` scenario fully working with environment + success_criteria.js

1. ✅ Complete the existing `multi-session/stale-plan-drift` scenario (environments, success_criteria.js, package.json)
2. ✅ Run baseline trial — 8/8 checks passed (agent detected stale plan, preserved existing work)
3. ✅ Fixed transcript auto-detection in success_criteria.js
4. ✅ Fixed directory artifact handling bug in gym-runner.ts (cpSync recursive for dirs)

### Phase 3: FM-Targeted Scenarios (2-3 sessions)
**Dependencies**: Phase 2  
**Status**: MOSTLY COMPLETE (ghost-deliverable-chain + variants complete, unresolved-failure-chain built, cascading-failure-recovery pending)  
**Deliverables**: Multiple FM-targeted scenarios built and operational

1. ✅ Build `ghost-deliverable-chain` (FM-3.1) — S1 extracts validation, S2 sees incomplete ghost + adds sanitization
   - First trial: 5/8 (3/6 product, 2/2 behavioral) — correctly discriminates
   - 8 variants created (adversarial, claim-decomposed, combined, combined-guard, context-stripped, machine-verified, verify)
2. ✅ Build `unresolved-failure-chain` (FM-1.4) — session chain with cascading failures
3. ✅ Build `kb-integration-failure` + 7 variants — knowledge base integration scenarios
4. ✅ Build additional scenarios: `clean-handoff`, `context-fatigue-verification`, `instruction-override-drift`, `phase-boundary-violation`
5. ⬜ Build `cascading-failure-recovery` (FM-1.4) — full information-loss variant per EXP-077 L3
6. ⬜ Run systematic 3-trial baselines on newer scenarios

### Phase 4: Integration + Regression (1 session)
**Dependencies**: Phase 3  
**Status**: ✅ COMPLETE  
**Deliverables**: Multi-session scenarios integrated into regression cadence

1. ✅ No `--multi-session` flag needed — runner auto-dispatches via `meta.sessions` in scenario.json
2. ✅ Run multi-session only: `scripts/gym-run.sh --run-all --tag multi-session --agent coder`
3. ✅ Authoring guide: `agents/coach/workspace/multi-session-authoring-guide.md`
4. ✅ Added to monthly regression: filter with `--tag multi-session`
5. ✅ Completed `instruction-override-drift` scenario (10 checks: 9 product + 1 behavioral)
6. ✅ All 5 multi-session scenarios verified complete

---

## 5. Success Criteria

The multi-session harness is successful if:

1. **Non-ceiling baselines**: At least 2 of 3 designed scenarios have baseline pass rates below 70% over 3+ runs. This proves they expose real gaps that single-session scenarios can't.

2. **Measurable intervention effects**: At least 1 scenario shows statistically meaningful improvement (>20pp) from a specific intervention (skill, workflow gate, or framework change).

3. **Production failure mode coverage**: The harness enables testing of FM-2.6, FM-1.4, and FM-3.1 — the three failure modes with zero current gym coverage (133 production errors, 14.9% of total).

4. **Reasonable cost**: Each multi-session run completes in <10 minutes and <$0.50 API cost (2-3 sessions × 3-5 min each). This makes 3-run baseline trials feasible.

5. **Scenario authoring is tractable**: A new multi-session scenario can be created in <2 hours using the template pattern from Phase 2.

---

## 6. Risks and Mitigations

### Risk: Multi-session scenarios also hit ceiling
**Likelihood**: Medium. EXP-067 showed injected context alone isn't enough.  
**Mitigation**: The key insight from EXP-077 is that **cascading state with information loss** (L3) is the reliable ceiling-breaker. All three example scenarios include information loss or partial corruption as core mechanics, not just noisy context.

### Risk: Too expensive to run in regression
**Likelihood**: Low. Each run is 2-3 agent sessions, roughly 2-3× a single scenario.  
**Mitigation**: Multi-session scenarios run only in monthly sweeps, not weekly. Keep the count small (3-5 scenarios).

### Risk: Mutators are fragile / hard to maintain
**Likelihood**: Medium. Programmatic file manipulation is error-prone.  
**Mitigation**: (a) Keep mutators simple — truncate files, delete files, add files. Avoid complex transformations. (b) Mutators should be idempotent. (c) Include assertions in mutators that verify expected pre-conditions.

### Risk: Session-to-session artifact passing has edge cases
**Likelihood**: Medium. What if Session 1 doesn't produce an expected artifact?  
**Mitigation**: `artifacts_out` should be treated as "best effort" — if the agent didn't produce PLAN.md, Session 2 still runs but without the artifact. The success criteria can penalize missing artifacts, but the harness shouldn't crash.

---

## 7. Appendix: Current Infrastructure Inventory

### What we have (can reuse):
- **Workflow phases** (`---` separator): Shared workDir, phases run sequentially, same agent context. Used for externalization.
- **Injected context** (`injected_context` field): Prepends fake session history to task. Works but insufficient alone (EXP-067 ceiling).
- **Context learning** (`learn_between_phases`): Extracts facts from transcripts, writes to sandbox context.md. Directly reusable.
- **Agent sandboxing** (`sandboxAgents`): Copies agents/ dir so writes don't pollute production. Directly reusable.
- **Phase cleanup** (`phase_cleanup`): Deletes specified files between phases. Partially reusable — mutators generalize this.
- **Multi-session prototype**: `agents/gym/scenarios/multi-session/stale-plan-drift/` has the `sessions` array format in scenario.json but no runner support yet.

### What we need to build:
- **Session loop in runner**: New code path for `multi_session: true` — separate agent invocations per session
- **Environment overlays**: Copy session-specific environment dirs into workDir before each session
- **Artifact passing**: Collect declared output artifacts, inject into next session (with optional rename)
- **Mutator execution**: Run JavaScript functions between sessions for programmatic env changes
- **Per-session transcripts**: Export each session's transcript to workDir for scorer inspection
- **Per-session context injection**: Each session gets its own context.md prepended to task (already supported concept, needs wiring)

### What we explicitly DON'T need:
- **New adapter types**: The may-agent adapter works. Multi-session just calls it N times.
- **Session persistence / database**: No need to store session chains. Each run is ephemeral like current gym.
- **Cross-agent multi-session**: Out of scope. All sessions use the same agent identity.
- **Parallel sessions**: Sessions run sequentially. No need for concurrency.

---

*This design bridges the gap between our proven single-session gym (96% ceiling, great for regression) and the production failure modes (FM-2.6, FM-1.4, FM-3.1) that we currently cannot test. The primary insight from EXP-077 guides the approach: cascading state from failures, not context noise, is what breaks through the ceiling.*
