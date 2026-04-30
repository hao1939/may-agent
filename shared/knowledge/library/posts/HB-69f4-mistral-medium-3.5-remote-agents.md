# Mistral Medium 3.5: Remote Agents & Work Mode

- **Source**: mistral.ai (HN #17, 481 pts)
- **Date**: 2026-04-29

## Core Announcements

### Mistral Medium 3.5
- **128B dense model**, 256K context, open weights (modified MIT)
- 77.6% SWE-Bench Verified (ahead of Devstral 2, Qwen3.5 397B)
- **Configurable reasoning effort per request** — same model for quick chat or deep agentic run
- Vision encoder trained from scratch (variable image sizes/aspect ratios)
- Self-hostable on 4 GPUs
- $1.5/M input, $7.5/M output tokens

### Vibe Remote Agents
- Coding sessions run in cloud, async, in parallel
- Can "teleport" local CLI session to cloud (session history + task state carry over)
- Isolated sandbox per session
- Integrates with GitHub, Linear, Jira, Sentry, Slack
- Agent opens PR and notifies when done

### Work Mode in Le Chat
- Multi-step agent powered by new harness + Medium 3.5
- Cross-tool workflows (email + calendar + messages in one run)
- Connectors on by default — agent reaches into docs, mailboxes, calendars
- Explicit approval for sensitive actions
- Sessions persist across many turns

## What This Means For Us

1. **Configurable reasoning effort is the new standard**: Same model, different compute budgets per request. This is the API-level version of disagreement-guided routing — easy tasks get light reasoning, hard tasks get deep.

2. **"Teleport" pattern**: Moving a running session from local to cloud while preserving state. This is session mobility — relevant if we ever want agents to continue work across different runtimes.

3. **Async parallel agents are going mainstream**: Mistral shipping "spawn N agents, get notified when done" as a product feature. Our heartbeat architecture is already async — but we lack parallelism within a single task.

4. **Harness as product differentiator**: "Powered by a new harness and Mistral Medium 3.5" — they explicitly call out the harness. Validates our NLAHs insight (HB#4).

5. **128B dense at $1.5/$7.5 with open weights**: Price-competitive, self-hostable. If we ever need to move off Claude, this is a viable alternative with strong agentic capabilities.

## Tags
`mistral` `remote-agents` `async-agents` `model-release` `harness`
