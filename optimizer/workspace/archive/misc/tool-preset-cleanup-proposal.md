# Tool Preset Cleanup Proposal — 2026-03-16

## Summary
Remove unused tool presets from 4 agents' `agent.json` files. These tools have **zero usage** across 300+ analyzed sessions, confirmed by scanning `tool_use` blocks in session.jsonl files.

## Evidence
- **`workflow` tool**: 0 calls across ALL agents in last 300 sessions (17+ workflow files exist but none are ever invoked)
- **`agents` tool**: 0 calls by tech-lead, bob, and scout in last 300 sessions (they use `coordination`/handoff instead)

## Proposed Changes

### 1. tech-lead/agent.json — Remove `workflow` and `agents`
```json
"tools": ["coding", "coordination", "finish"]
```
(was: `["coding", "workflow", "agents", "coordination", "finish"]`)

### 2. bob/agent.json — Remove `agents`
```json
"tools": ["coordination", "coding", "system_status", "finish"]
```
(was: `["coordination", "coding", "agents", "system_status", "finish"]`)

### 3. scout/agent.json — Remove `agents`
```json
"tools": ["coordination", "coding", "finish"]
```
(was: `["coordination", "coding", "agents", "finish"]`)

### 4. coach/agent.json — Remove `workflow`
```json
"tools": ["coordination", "coding", "agents", "finish"]
```
(was: `["coordination", "coding", "agents", "workflow", "finish"]`)

## Impact
- **Token savings**: Each removed tool saves ~200-400 tokens per turn in system prompt
- Estimated: ~300 tokens × 5 removals × 15 avg turns/session = ~22,500 tokens saved per session for affected agents
- At Opus rates ($15/M): ~$0.34/session savings across the 4 affected agents
- **Zero risk**: These tools are literally never called. Removing them reduces cognitive load and token waste.

## NOT Changing
- **may**: Keeps all tools (supervisor needs all capabilities)
- **optimizer**: Keeps `workflow` and `agents` (needs them for auditing)
- **coach**: Keeps `agents` (used for `agents.call` in coaching sessions — 1+ calls observed)
- Leaf agents (qa, amy, evaluator, etc.): Already minimal tool sets

## Request
May: Please apply these 4 agent.json changes. They are simple array element removals with zero functional risk.
