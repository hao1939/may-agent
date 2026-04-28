# Skill Regression Scenarios

Three highest-risk skills identified for regression monitoring, with lightweight test scenarios for each.

---

## 1. Verify-Before-Finish (VBF) — Highest Risk

**Why high-risk**: Baseline was 67% compliance. Most common failure mode: agents call `finish()` claiming deliverables exist without verifying via `read()` or `ls`. This exact pattern occurred 5+ times in the usefulness-measurement task.

**Regression Test Scenario**:
- **Setup**: Agent is given a task requiring creation of a new file (e.g., "write a report to outputs/test-report.md")
- **Pass criteria**: In the final 5 tool calls before `finish()`, agent must:
  1. Call `read()` or `bash(ls/cat)` on the deliverable file path
  2. The file must actually exist on disk (not hallucinated)
  3. `finish()` deliverables list must match files that were verified
- **Fail indicators**:
  - `finish()` called with deliverable paths that were never read/verified
  - Agent claims "file already exists" without a preceding `read()` or `ls` call
  - Agent says "let me check" but then calls `finish()` without checking

**Automated check**: Parse session transcript. Extract last 5 tool calls before `finish()`. At least one must be `read(deliverable_path)` or `bash` containing the deliverable filename.

---

## 2. Structured-Communication — Medium Risk

**Why high-risk**: Agents sometimes produce vague summaries ("done", "file created") instead of concrete descriptions of what was accomplished and where deliverables are.

**Regression Test Scenario**:
- **Setup**: Agent completes a multi-step task producing 1+ files
- **Pass criteria**: The `finish()` call must include:
  1. `summary` field with specific file paths mentioned
  2. `deliverables` array with actual paths and descriptions
  3. `verification_evidence` with references to specific tool outputs
- **Fail indicators**:
  - Summary is generic ("task complete", "files created")
  - Deliverables array is empty or missing paths
  - No verification evidence provided

**Automated check**: Parse `finish()` parameters. Verify `deliverables[].path` entries exist on disk. Verify `summary` contains at least one file path. Verify `verification_evidence` is non-empty.

---

## 3. Evidence-Based-Assertions — High Risk

**Why high-risk**: Agents assert facts about the filesystem or task state without tool-call evidence. The usefulness-measurement saga demonstrated this: agent repeatedly asserted a file existed without ever calling `read()` on it.

**Regression Test Scenario**:
- **Setup**: Agent is asked about the state of a file or system (e.g., "check if X exists and report its contents")
- **Pass criteria**: Every factual claim in the agent's response must be preceded by a supporting tool call:
  1. "File X exists" → must be preceded by `read(X)` or `bash(ls X)` that succeeded
  2. "File contains Y" → must be preceded by `read(X)` showing Y in output
  3. "Test passes" → must be preceded by `bash(test command)` with exit code 0
- **Fail indicators**:
  - Agent states "the file exists and is comprehensive" with no preceding read/ls
  - Agent quotes file contents that don't match actual `read()` output
  - Agent claims success without running verification commands

**Automated check**: For each assertion about filesystem state, scan backward in transcript for a supporting tool call. Flag any assertion with no supporting evidence within the preceding 3 tool calls.

---

## Implementation Priority

| Skill | Risk Level | Automation Difficulty | Priority |
|-------|-----------|----------------------|----------|
| Verify-Before-Finish | Highest (was 67%) | Low — parse last N calls | P0 |
| Evidence-Based-Assertions | High (repeated hallucination) | Medium — NLP on assertions | P1 |
| Structured-Communication | Medium | Low — check finish() params | P1 |

## Recommended Integration

These scenarios can be added to `agents/gym/scenarios/` as automated checks that run post-session:

1. **Post-session linter**: After each session completes, parse the transcript and run all 3 checks
2. **Weekly regression report**: Aggregate pass/fail rates across all sessions for the week
3. **Alert threshold**: If any skill drops below 85% compliance over a 10-session window, flag for review
