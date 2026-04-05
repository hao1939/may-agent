# HB-0272: Components of a Coding Agent (Sebastian Raschka)

**Source**: Sebastian Raschka's Blog (magazine.sebastianraschka.com)  
**Date**: April 4, 2026  
**HN Popularity**: 232 points, 73 comments  
**Code**: https://github.com/rasbt/mini-coding-agent

---

## Core Argument

Coding agents are not just about better models — the surrounding system (tool use, context management, memory) plays an equally important role. This explains why Claude Code or Codex can feel significantly more capable than the same models in a plain chat interface.

## Six Components of a Coding Agent

### 1. Live Repo Context
- Collect "stable facts" (workspace summary) upfront before doing any work
- Git branch, status, commits provide context about in-progress changes
- Project documents (AGENTS.md, README) contain task-specific instructions
- **Insight**: "Fix the tests" is not self-contained — context determines the correct action

### 2. Prompt Shape And Cache Reuse
- "Smart" runtimes don't rebuild everything as one giant prompt on every turn
- **Stable prompt prefix**: General instructions, tool descriptions, workspace summary (cached)
- **Dynamic components**: Short-term memory, recent transcript, newest user request
- **Key optimization**: Reuse stable prefix to avoid wasted compute

### 3. Structured Tools, Validation, And Permissions
- Pre-defined list of allowed, named tools with clear inputs/boundaries
- Tool-use flow: Model proposes → System validates → Execute → Return results
- **Permission gates**: User approval for destructive operations
- **Validation layer**: Type checking, path verification before execution

### 4. Context Reduction And Output Management
- Clip/trim conversation history to stay within context limits
- Summarize older parts of conversation
- Manage output size and format

### 5. Transcripts, Memory, And Resumption
- SessionStore for persistence across restarts
- Record tool executions and outcomes
- **Resumption capability**: Pick up where left off after interruption

### 6. Delegation And Bounded Subagents
- Spawn subagents for isolated tasks
- Subagents run with limited context and tools
- Results merged back into parent context

## Key Distinctions

| Concept | Definition |
|---------|------------|
| **LLM** | The raw next-token model |
| **Reasoning Model** | LLM trained/prompted for more inference-time compute on verification/search |
| **Agent** | Control loop around the model: decides what to inspect, which tools to call, when to stop |
| **Agent Harness** | Software scaffold: manages context, tools, prompts, state, control flow |
| **Coding Harness** | Task-specific harness for software engineering |

## Critical Insight

> "Since vanilla versions of LLMs nowadays have very similar capabilities... the harness can often be the distinguishing factor that makes one LLM work better than another."

Raschka speculates that dropping GLM-5 into a similar harness could perform on par with GPT-5.4 in Codex or Claude Opus 4.6 in Claude Code.

## What This Means For Our System

1. **Harness > Model**: Our SOUL.md + skills architecture is the right focus
2. **Cache optimization**: We should implement stable prefix caching for repeated operations
3. **Tool validation**: Add explicit validation layer before skill execution
4. **Session resumption**: Consider transcript-based session recovery
5. **Subagent delegation**: Our Manager+Specialist pattern aligns with bounded subagents

## Code Reference

Mini Coding Agent implementation: https://github.com/rasbt/mini-coding-agent/blob/main/mini_coding_agent.py

Pure Python, ~500 lines, demonstrates all 6 components with clear code comments.
