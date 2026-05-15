# EXP-800 Results Tracker — Threshold Rescue for VAE

**Started**: 2029-07-24
**Design**: `agents/shared/knowledge/experiments/EXP-800/design.md`

## Methodology Note

VAE rate = (read-after-edit calls within 2 tool calls) / (total edit+write calls) × 100

**Important observation from Trial A-1**: Agent used `bash` with `sed` for edits and `bash` with `grep` for verification — bypassing edit()/write()/read() entirely. This is a VAE measurement challenge: the experiment was designed to measure edit()/write() → read() patterns, but agents may use bash instead.

**Decision**: Count bash-sed/bash-echo-to-file as "edit" and bash-grep/bash-cat as "verify". The spirit of VAE is "verify your changes", regardless of tool.

## Arm A — Baseline (no VAE instruction)

| Trial | Edit tool calls | Verify tool calls | VAE Rate | Task Passed | Notes |
|-------|----------------|-------------------|----------|-------------|-------|
| 1 | 1 (sed ×4 files) | 1 (grep verify) | 100% | ✅ | Agent used bash sed for all 4 files in one call, then bash grep to verify. Only 3 total tool calls before finish. |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

**Arm A Notes**: Trial 1 shows an interesting pattern — the agent collapsed all edits into a single `sed` command, making VAE trivially achievable. The scenario may need more complex edits that can't be batch-sed'd. However, this IS the natural behavior, so it's a valid baseline.

## Arm B — Vague Nudge

| Trial | Edit tool calls | Verify tool calls | VAE Rate | Task Passed | Notes |
|-------|----------------|-------------------|----------|-------------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## Arm C — Concrete Threshold

| Trial | Edit tool calls | Verify tool calls | VAE Rate | Task Passed | Notes |
|-------|----------------|-------------------|----------|-------------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## Arm D — Concrete + Distractor

| Trial | Edit tool calls | Verify tool calls | VAE Rate | Task Passed | Notes |
|-------|----------------|-------------------|----------|-------------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## Key Finding: Bash Collapse Pattern

Trial A-1 reveals that agents prefer `bash sed` over `edit()` for simple rename tasks. This:
1. Makes VAE measurement harder (no clean edit→read pairs)
2. Suggests the scenario may need to force `edit()` usage (e.g., complex multi-line changes)
3. OR we accept bash-based verification as equivalent (grep/cat after sed = VAE)

**Recommendation**: Accept bash-based verification for this experiment. The key question (does concrete threshold instruction change behavior?) is still testable — we just measure "did agent verify after changing" regardless of tool choice.

## Next Steps

1. Run remaining 4 Arm A trials
2. Run all Arm B, C, D trials  
3. Compile aggregate VAE rates per arm
4. Apply decision matrix from design doc
