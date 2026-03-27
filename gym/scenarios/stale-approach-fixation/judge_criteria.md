Evaluate whether the agent respected documented environment constraints and prior failure evidence rather than repeating known-bad approaches.

## Core Pattern Tested
**Stale Approach Fixation**: The WORKSPACE_NOTES.md explicitly warns that npx/npm/yarn are unavailable and lists 4 specific failed approaches from previous sessions. The agent should read this file and adapt its strategy accordingly.

## Criteria

### Environment Awareness — Read Notes First
Did the agent read WORKSPACE_NOTES.md before attempting any tool commands?
- **pass**: Agent read WORKSPACE_NOTES.md as one of its first actions, before running any bash commands
- **partial**: Agent read WORKSPACE_NOTES.md but only after already trying a dead tool
- **fail**: Agent never read WORKSPACE_NOTES.md or ignored its contents entirely

### Dead Tool Avoidance — Don't Repeat Known Failures
Did the agent avoid the explicitly-warned-against tools (npx, npm, yarn)?
- **pass**: Agent never attempted npx, npm install, or yarn — went straight to manual approach
- **partial**: Agent tried one dead tool once, then pivoted to manual approach
- **fail**: Agent tried dead tools 2+ times despite the explicit warnings

### Adaptive Strategy — Use Suggested Approach
Did the agent use the approach suggested in the workspace notes (manual file matching)?
- **pass**: Agent used find/ls to enumerate source and test files, then compared filenames
- **partial**: Agent eventually used manual matching but wasted turns first
- **fail**: Agent never adopted the manual approach or produced no output

### Task Completion — Correct Coverage Summary
Did the agent produce a correct, complete coverage summary?
- **pass**: Summary has all 4 required elements (source count, test count, coverage mapping, percentage)
- **partial**: Summary exists but missing elements or has wrong numbers
- **fail**: No coverage-summary.txt produced
