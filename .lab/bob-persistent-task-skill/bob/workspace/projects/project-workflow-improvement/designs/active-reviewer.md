# Feature: Active Reviewer

## What
Give the reviewer full tool access so it can actively investigate, read resources, query knowledge, and fork other agents to unblock projects — instead of just writing text guidance.

## Why
Today: worker fails → reviewer says "try something different" (text only) → worker tries the same thing again → stall → BLOCKED → escalation.

The reviewer has the context to fix this. It sees what failed. It knows the project resources. But it can't ACT — it can only write text guidance that the worker may or may not follow.

With tools: reviewer reads the blocking resource, finds the issue, adjusts the approach, maybe forks scout for research or tech-lead for a code fix. The project unblocks without escalation.

## How It Works

When feature `active-reviewer` is enabled:
1. Remove `[REVIEW ONLY — no file edits expected]` prefix from reviewer prompt
2. Give reviewer the same tool access as the worker
3. Reviewer can: read files, run bash, fork agents, add comments to project
4. Reviewer still ends with CONTINUE/DONE/BLOCKED decision
5. But now the reviewer can take action BEFORE giving guidance

## What the Reviewer Prompt Becomes

```
You are the PROBLEM-SOLVER for iteration N.

The worker just completed their iteration. Here's what happened: {summary}

Before giving your CONTINUE/DONE/BLOCKED decision, you may:
- Read project resources to understand what was tried
- Query the knowledge base for related solutions
- Fork another agent for help (scout for research, tech-lead for code)  
- Read the actual deliverables the worker produced
- Run commands to verify claims

Then decide: CONTINUE (with better-informed guidance), DONE, or BLOCKED.
```

## How to Enable

Add to project's `## Process Notes`:
```
features: active-reviewer
```

The workflow checks `features.has("active-reviewer")` and adjusts the reviewer prompt.

## How to Measure

Compare on a blocked project:
- **Before**: reviewer says BLOCKED after N iterations of text-only guidance
- **After**: reviewer with tools investigates and unblocks

Metrics:
- Stall rate (fewer stalls = reviewer is unblocking effectively)
- Iterations to unblock (faster = reviewer catches problems earlier)
- Escalation rate (fewer escalations = reviewer handles more in-house)

## How to Revert

Remove `features: active-reviewer` from Process Notes. Reviewer goes back to text-only.

## Risk

Reviewer might waste ops on investigation instead of guiding. Mitigation: the reviewer still runs as a separate session with its own op count. If it burns too many ops investigating, that shows in the session data.

## Status
Not implemented. Needs workflow code change to check feature flag and adjust reviewer prompt.
