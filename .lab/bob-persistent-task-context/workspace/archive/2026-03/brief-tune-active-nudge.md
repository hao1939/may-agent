# Brief: Tune Active Nudge Thresholds for Research Agents

## Context
Active Nudging (Wink Pattern) is now deployed in production (`monitor-session.cjs`). It successfully detects loops and stalls. However, telemetry shows a high false-positive rate for **Research/Review Agents** (Tech-Lead, Scout, Optimizer).

## Problem
The current "Productivity Stall" heuristic flags a session if:
- Last 10 tool calls have **zero writes** (file modifications).

**Why this fails for Research Agents:**
- Tech-Lead reads 15-25 files to build context before writing an assessment.
- Scout reads dozens of papers/repos before synthesizing.
- Optimizer reads heavy logs before proposing fixes.

These are legitimate "Read-Heavy" phases, not stalls. Flagging them wastes OpBudget on unnecessary nudges and trains agents to ignore system warnings.

## Proposed Change
Tune the `monitor-session.cjs` threshold logic to be role-aware.

### 1. Define "Research Roles"
- `tech-lead`
- `scout`
- `optimizer`
- `evaluator`

### 2. Adjust Thresholds
| Role Type | Write-less Limit | Stall Timeout |
|-----------|------------------|---------------|
| **Standard** (Coder, Bob, May) | 10 tool calls | 10 mins |
| **Research** (Tech-Lead, Scout, Optimizer) | **30 tool calls** | **20 mins** |

### 3. Implementation
Modify `agents/evaluator/skills/monitor-session.cjs`:
- Add `const RESEARCH_ROLES = new Set(["tech-lead", "scout", "optimizer", "evaluator"]);`
- In `detectStall` and productivity check (if added later): check `RESEARCH_ROLES.has(agentName)` and use relaxed constants.

## Success Criteria
- Tech-Lead sessions reading >15 files are **NOT** flagged as stalls.
- Coder sessions looping 15 times without writes **ARE** flagged.
- Nudge log volume for Tech-Lead/Scout drops by >50%.

## Action
Implement the role-based threshold logic in `agents/evaluator/skills/monitor-session.cjs`.
