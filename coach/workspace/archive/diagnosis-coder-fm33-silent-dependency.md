# Diagnosis: Coder FM-3.3 on silent-dependency

**Date**: 2026-03-29  
**Error Pattern**: FM-3.3 (Verification Failure / Root-Cause Tracing)  
**Target Agent**: coder  
**Session**: s_1774775538572_908

## Error Pattern Analysis

**FM-3.3 (Verification Failure)**: Coder fails to trace through a dependency chain to identify a silent deprecation. The scenario tests a markdown renderer where `marked@4.3.0` silently ignores the deprecated `sanitize` option — tests fail because XSS protection is missing, but `npm install` and `node render.js` both succeed.

### Behavioral Pattern
The failure chain requires the coder to:
1. Run tests (not just `node render.js`) — detect that sanitization is broken
2. Read test output carefully to understand WHAT failed (unsanitized HTML in output)  
3. Trace the test failure to the `sanitize` option being silently ignored by marked v4
4. Apply correct fix: add manual sanitization (strip HTML tags) or switch library

### Why FM-3.3 Specifically
- **Root-cause tracing depth**: The surface symptom is "tests fail" but the root cause is a silent deprecation in a dependency — requires reading marked docs/changelog or inspecting what `sanitize: true` does in v4
- **Silent failure**: `npm install` succeeds, `node render.js` runs without errors — the agent must NOT stop at "it works"
- **Verification gap**: An agent that fixes surface symptoms without understanding the deprecated API will likely produce an incomplete fix

## ⚠️ SCENARIO ENVIRONMENT ISSUE

**CRITICAL**: The `silent-dependency` scenario environment is currently **corrupted**. The `environment/render.js` file (modified 2026-03-23) already contains the fix — a `sanitizeHtml()` function that strips HTML tags before passing to marked. All tests pass in the current environment state.

Per the README, the original render.js should use `marked.parse()` with `sanitize: true` (which is silently ignored in marked 4.3.0), producing XSS-vulnerable output. The environment was likely corrupted by a prior gym run writing back to the source directory.

**FIXED**: render.js restored to broken state (uses `sanitize: true` which is deprecated). In marked 4.3.0, `sanitize: true` partially works — it entity-encodes `<script>` tags but does NOT strip event handler attributes. Result: 5/6 tests pass, 1 fails (`event handlers are removed`). The agent must understand this nuanced partial deprecation.

No coder experiments exist for this scenario in experiments.jsonl (confirmed via grep).

## Selected Method

**Method #15: Workflow Enforcement** 🏆

### Why Method #15
1. **Proven track record**: 93%+ across 8 scenarios, 5 agents, 3 models (41/44 runs pass)
2. **Fits the failure mode**: FM-3.3 requires deep root-cause tracing that coder may skip in a single-session rush. Two-phase workflow mechanically forces analysis before action.
3. **Prior evidence on FM-3.3**: Method #15 first proved itself on skip-verification (FM-3.3) — 5/5 pass for amy. The analysis-before-action pattern is exactly what's needed here.
4. **All text methods closed**: 0/13 clean text experiments improved judgment behavior. SOUL guards, LESSONS entries, knowledge files, negative examples all SAFE but INEFFECTIVE.
5. **Task assignment recommends it**: The hypothesis explicitly suggests Method #15 with a two-phase approach.

### Why NOT Other Methods
- **Text methods (#1, #2, #3, #6, #9, #10, #12, #13)**: All CLOSED — 0% effectiveness on judgment behavior
- **Task Structuring (#14)**: Only 33% effective — insufficient reliability
- **Skill File (#4)**: EXP-215 just showed 0/5 improvement on coder for a different scenario. Skills have not been proven effective for root-cause tracing behavior.
- **#24 Identity Directive**: CLOSED — replication showed 12.5%, noise

## Workflow Design

### Two-Phase Approach: Analyze → Fix

Implemented in `agents/gym/scenarios/silent-dependency-workflow/task.md` using `---` separator per gym convention. `scenario.json` has `"workflow": true`.

**Phase 1: Root-Cause Analysis (NO editing)**
- Run `npm install` and `npm test`, note which tests pass/fail
- Read test.js to understand what each test checks
- Read render.js to understand sanitization approach
- Investigate marked@4.3.0 — check if `sanitize: true` works in this version
- Write analysis to `ANALYSIS.md` (tests that fail, root cause, proposed fix)
- DO NOT modify source files

**Phase 2: Apply Minimal Fix**
- Read ANALYSIS.md from Phase 1
- Apply minimal fix to render.js based on analysis
- Run `npm test` to verify ALL tests pass
- Iterate if needed

### Key Design Decisions
- **Phase 1 forces tracing**: Agent MUST trace dependency chain and write findings before touching code
- **ANALYSIS.md as artifact**: Creates accountability — verifiable that agent identified the silent deprecation
- **Phase 2 is focused**: With analysis in hand, fix should be targeted (add manual sanitization)
- **Uses standard gym workflow format**: Single task.md with `---` separator, no separate phase files

## Gym Scenarios to Test

1. **Primary**: `silent-dependency` (MUST fix environment first)
2. **Create**: `silent-dependency-workflow` (new workflow variant)
3. **Regression checks**: 
   - `phantom-fix` (baseline PASS for coder)
   - `skip-verification` (baseline PASS for coder) 
   - `wrong-tool-args` (baseline PASS for coder)

## What Specifically Will Change

1. **Fix scenario environment**: Restore `silent-dependency/environment/render.js` to broken state (uses `sanitize: true` which is silently ignored)
2. **Run baseline**: Confirm coder FAILS `silent-dependency` with restored environment
3. **Create workflow scenario**: `silent-dependency-workflow/` with two-phase task and scenario.json `"workflow": true`
4. **Run workflow variant**: Test coder with the analyze→fix workflow
5. **Run regression**: Verify no regression on 2-3 passing scenarios

## Risk Assessment

- **Environment restoration**: HIGH priority — scenario is unusable until fixed
- **Ceiling effect risk**: LOW — scenario is specifically designed to test root-cause tracing depth, which coder struggles with on similar patterns
- **Regression risk**: LOW — Method #15 has 0 regressions across 44 runs
