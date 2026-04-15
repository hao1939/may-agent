# Tool Efficiency Report — 2026-03-16

## Executive Summary
Comprehensive audit across 300+ sessions reveals significant unused tool infrastructure.
**5 tool presets across 4 agents have zero usage** — removing them saves ~22,500+ tokens per session.
Cleanup proposal handed off to May for implementation.

## Methodology
- Scanned 200-300 sessions from `.state/sessions/history/`
- Parsed `tool_use` blocks in session.jsonl to count actual tool invocations per agent
- Cross-referenced with `agent.json` tool configurations
- Verified 0-usage across multiple scan windows

## Finding 1: `workflow` Tool — Universally Unused
- **Agents with workflow preset**: may, tech-lead, optimizer, coach (4 agents)
- **Actual calls**: 0 across ALL agents in 300+ sessions
- **Infrastructure**: 17+ workflow definition files exist across agents/*/workflows/
- **Root cause**: Agents handle multi-step work through direct tool calls rather than the workflow abstraction

### Action: Remove `workflow` from tech-lead and coach
- tech-lead and coach gain no benefit from having this tool
- may and optimizer retain it (supervisor capabilities / audit needs)

## Finding 2: `agents` Tool — Barely Used
- **Agents with agents preset**: may, tech-lead, bob, optimizer, coach, scout (6 agents)
- **Actual calls**: may (3x), optimizer (1x), coach (1x) = 5 total in 300 sessions
- **tech-lead**: 0 calls
- **bob**: 0 calls  
- **scout**: 0 calls (uses handoff from coordination preset instead)

### Action: Remove `agents` from tech-lead, bob, scout
- These agents exclusively use `coordination`/handoff for inter-agent communication
- Coach keeps `agents` (used for coaching sub-agent sessions)

## Finding 3: Other Dead Tools
| Tool | Agent | Calls | Status |
|------|-------|-------|--------|
| `system_status` | bob | 0 | JS handler covers this via cron |
| `system-status` | may | 0 | JS handler covers this via cron |
| `cron` | may | 0 | Never used through tool interface |

### Action: Consider removing in a future batch (lower priority than F1/F2)

## Finding 4: Redundant File Re-Reads (No Action)
- 124 redundant reads across 100 sessions (~1.24/session)
- Most are legitimate read-verify cycles or compaction-driven re-reads
- Estimated waste: ~$9/200 sessions
- **No action warranted**: blocking re-reads would hurt verification discipline

## Token Cost Impact
Each unused tool adds ~200-400 tokens to the system prompt per API call:
- `workflow` (300 tok) × ~15 turns × sessions = ~4,500 wasted tokens/session per agent
- `agents` (400 tok) × ~15 turns × sessions = ~6,000 wasted tokens/session per agent
- Total for 5 removals: ~22,500+ tokens/session for affected agents
- At Opus rates ($15/M): ~$0.34/session savings

## Changes Proposed (Handed Off to May)

### tech-lead/agent.json
- Remove: `"workflow"`, `"agents"`
- Result: `["coding", "coordination", "finish"]`

### bob/agent.json  
- Remove: `"agents"`
- Result: `["coordination", "coding", "system_status", "finish"]`

### scout/agent.json
- Remove: `"agents"`
- Result: `["coordination", "coding", "finish"]`

### coach/agent.json
- Remove: `"workflow"`
- Result: `["coordination", "coding", "agents", "finish"]`

## Status
- [x] Analysis complete (3 audit sessions)
- [x] Proposal written (`tool-preset-cleanup-proposal.md`)
- [x] Handed off to May for implementation
- [ ] Awaiting May's application of changes
