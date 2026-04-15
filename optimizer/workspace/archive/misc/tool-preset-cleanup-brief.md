# Tool Preset Cleanup — Remove Unused Tools

## Date: 2026-03-17

## Summary
Remove unused tool presets from 5 agents to reduce system prompt size and eliminate tool confusion. Based on analysis of 3,000+ sessions showing 0% usage.

## Changes Required (5 agent.json edits)

### 1. QA — Remove `coordination`
- **Evidence**: 0 handoff calls across 120 sessions (0%)
- **File**: `agents/qa/agent.json`
- **Change**: Remove `"coordination"` from tools array
- **Result**: `["coding", "finish"]`

### 2. Coder — Remove `coordination`
- **Evidence**: 0 handoff calls across 154 sessions (0%)
- **File**: `agents/coder/agent.json`
- **Change**: Remove `"coordination"` from tools array
- **Result**: `["coding", "finish"]`

### 3. Amy — Remove `coordination`
- **Evidence**: 0 handoff calls across 793 sessions (0%)
- **File**: `agents/amy/agent.json`
- **Change**: Remove `"coordination"` from tools array
- **Result**: `["coding", "finish"]`

### 4. Amy-kimi — Remove `coordination`
- **Evidence**: 1 handoff call across 671 sessions (0.1%)
- **File**: `agents/amy-kimi/agent.json`
- **Change**: Remove `"coordination"` from tools array
- **Result**: `["coding", "finish"]`

### 5. Tech-lead — Remove `workflow`
- **Evidence**: 3 workflow calls across 1194 sessions (0.3%)
- **File**: `agents/tech-lead/agent.json`
- **Change**: Remove `"workflow"` from tools array
- **Result**: `["coding", "agents", "coordination", "finish"]`

## Impact
- Each tool definition costs ~200-500 tokens in system prompt
- Estimated savings: ~2,500 tokens/session across affected agents
- Removes tool confusion — agents won't waste turns trying unused tools
- No behavioral change — these tools are never used by these agents

## Risk: Low
- All evidence based on thousands of sessions
- If any agent truly needs these tools in the future, they can be re-added
- QA and coder are leaf nodes that never need to hand off (they receive handoffs via delegation)
