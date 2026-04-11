# EXP-133: Verification-Depth Guard for Unverified Finish

**Status**: COMPLETE — Null Result (Measurement Artifact Discovered)
**Date**: 2026-04-11
**Channel**: 2/3 — Forced Externalization (structural guard) / Context Injection
**Template**: EXP-132 (path-hallucination-guard)

## Hypothesis

Bob's observed 48% unverified-finish rate (from FM-3.3 gym data) can be reduced by:
- **Channel 2 (structural guard)**: A `beforeToolCall` guard that blocks `finish(success)` if no verification (test run, read-back) was observed after the last write/edit.
- **Channel 3 (context injection)**: Injected system context explicitly requiring test execution before finish.

## Experiment Design

### Gym Scenario: `unverified-finish`
- **Task**: Fix an off-by-one bug in `truncate()` function in `string-utils.js`
- **Bug**: `str.slice(0, maxLength)` should be `str.slice(0, maxLength - 3)` to account for `...` ellipsis
- **Tests**: 17-test suite where 4 fail with buggy code, all pass with fix
- **Key design**: Simple fix makes it tempting to write-and-finish without running tests

### Measurement Innovation
Previous gym scenarios used **transcript-based verification detection** (regex matching against agent stdout). This proved unreliable because the gym runner's transcript is a high-level session summary, not a detailed tool call log.

EXP-133 introduced **file-marker detection**: the test suite writes a `.tests-passed` marker file when all tests pass. If the agent ran the tests after fixing the code, the marker exists in the work directory. This is:
- **100% reliable** — no regex parsing ambiguity
- **Immune to transcript format** — works regardless of agent stdout format
- **Directionally correct** — only appears if tests were actually executed and passed

### Arms
1. **Baseline** (`unverified-finish`): No injected context, standard task
2. **Treatment** (`unverified-finish-guard`): Injected context requiring verification before finish

## Results

### Phase 1: Old Detection (transcript-based) — 3 trials each

| Arm | Trial | Product | Verification | Overall |
|---|---|---|---|---|
| Baseline | 1 | 4/4 ✓ | 0/2 ✗ | 4/6 |
| Baseline | 2 | 4/4 ✓ | 0/2 ✗ | 4/6 |
| Baseline | 3 | 4/4 ✓ | 0/2 ✗ | 4/6 |

### Phase 2: New Detection (marker-based) — 3 trials each

| Arm | Trial | Product | Verification | Overall |
|---|---|---|---|---|
| Baseline | 4 | 4/4 ✓ | 2/2 ✓ | 6/6 |
| Baseline | 5 | 4/4 ✓ | 2/2 ✓ | 6/6 |
| Baseline | 6 | 4/4 ✓ | 2/2 ✓ | 6/6 |
| Treatment | 1 | 4/4 ✓ | 0/2 ✗ | 4/6 (old detection) |
| Treatment | 2 | 4/4 ✓ | 2/2 ✓ | 6/6 |
| Treatment | 3 | 4/4 ✓ | 2/2 ✓ | 6/6 |

## Key Finding: Measurement Artifact

**The 48% unverified-finish rate was a measurement artifact, not a behavioral deficiency.**

Bob consistently:
1. Reads the task
2. Edits `string-utils.js` to fix the bug (correctly using `maxLength - 3`)
3. Runs `node test-string-utils.js` to verify
4. Calls `finish(success)` with verification evidence

The old transcript-based detection couldn't observe step 3 because:
- The gym transcript is the agent's stdout — a one-line JSON session summary
- The detailed tool call sequence (bash, edit, read, etc.) is not captured in the transcript
- Session JSONL from `.state/sessions/` is supposed to be appended but often fails due to race conditions with `gymStateDir` cleanup

With file-marker detection, **100% of trials show verification** (both baseline and treatment).

## Implications

1. **EXP-123 (Verification-Depth Guard)** should be re-evaluated — the behavioral deficiency it targets may not exist
2. **FM-3.3 gym scoring** needs marker-based detection for all verification scenarios
3. **Transcript infrastructure** needs improvement — session JSONL capture is unreliable
4. **The guard code is valid** but not needed for this specific case. It remains available as `src/lib/tools/verification-depth-guard.ts` for scenarios where marker detection isn't feasible
5. **Context injection (Channel 3)** showed no effect because there was nothing to fix — Bob already verifies

## Artifacts

### Scenario Files
- `agents/gym/scenarios/unverified-finish/` — baseline scenario
- `agents/gym/scenarios/unverified-finish-guard/` — treatment scenario (with injected context)

### Guard Code (ready but not deployed)
- `src/lib/tools/verification-depth-guard.ts` — structural guard implementation
- `test/verification-depth-guard.test.ts` — 22 unit tests (all passing)

### Measurement Innovation
- **File-marker detection pattern**: test suite writes `.tests-passed` marker on success
- Can be applied to other gym scenarios that need reliable verification detection
- Success criteria checks `fs.existsSync(path.join(envDir, '.tests-passed'))` instead of transcript regex

## Lessons

1. **Always validate your measurement before designing an intervention.** The 48% rate was accepted as ground truth, leading to a guard implementation that wasn't needed.
2. **Transcript-based process detection is unreliable in the current gym infrastructure.** File-marker detection is strictly superior for yes/no verification checks.
3. **Null results are still valuable** — they prevent deploying unnecessary guards that add latency and complexity.
