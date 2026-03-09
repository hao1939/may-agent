# Agent Coordination Patterns

## Overview

This document describes how agents coordinate in the may-agent system.
It covers dispatch patterns, feedback loops, and failure recovery.

## 1. Dispatch Patterns

### 1.1 Direct Dispatch

May dispatches tasks to agents using `subagents.run()`. Each agent receives:
- A task description (plain text)
- Access to shared knowledge files
- Write scope limited to their own directories

**Current limitation:** Agents cannot dispatch to each other directly.
This prevents cascade failures but limits peer collaboration.

### 1.2 Workflow Dispatch

For multi-step tasks, May uses `workflow.run()` which coordinates
multiple agents in sequence. The workflow engine handles:
- Agent sequencing (e.g., coder → qa → optimizer)
- Result passing between steps
- Error recovery and retry logic

## 2. Feedback Loops

### 2.1 Evaluation Pipeline

Every agent session is evaluated automatically:
1. Session completes → transcript saved to `.state/sessions/history/`
2. Evaluator reads transcript → scores efficiency and quality
3. Coach reviews evaluations → designs targeted exercises
4. Optimizer applies coaching corrections → updates agent config

**Known gap:** Step 4 often lags weeks behind step 3. The optimizer
backlog creates a bottleneck where coaching insights aren't applied.

### 2.2 Direct Feedback

Hao provides direct feedback during chat sessions. This is the
strongest signal — corrections from the human should be applied
immediately to the relevant agent's knowledge files.

## 3. Failure Recovery

### 3.1 Token Expiry

Agents running on external APIs (Gemini, GPT) may hit token expiry
mid-session. The system should detect this and either retry or
save partial progress. Currently: sessions just error out.

### 3.2 File Conflicts

Multiple agents editing the same file creates race conditions.
The current mitigation is write-scope isolation (each agent can
only write to their own directories). Shared files require
coordination through May or Bob.

## 4. Open Questions

- Should agents be able to signal each other without going through May?
- How do we handle graduated agents that regress?
- Is the current evaluation pipeline fast enough for real-time coaching?
