---
name: consolidate-memory
description: Distill episodic memory (workspace) into semantic memory (knowledge).
version: 1.0.0
tools: [read, write, bash]
---

# Skill: Consolidate Memory

## 1. Purpose
To prevent "amnesia" by converting successful problem-solving episodes into reusable strategies, and to prevent "clutter" by cleaning up the workspace.

## 2. When to Use
- **End of Session**: After successfully completing a complex task.
- **Recurring Patterns**: When you notice you've solved the same problem 3+ times.
- **Growth Cycle**: As the final step of a "Train" phase (crystallizing the lesson).
- **Workspace Cleanup**: When `workspace/` has >10 files.

## 3. How to Execute

### Step 1: Scan for Patterns
Look for repeated successes or critical failures in recent logs or workspace files.
- **Command**: `ls -t workspace/ | head -5`
- **Command**: `grep "Success" .state/recent-sessions.jsonl` (conceptual)

### Step 2: Filter & Distill
Identify *one* high-value insight. Ignore trivial commands.
- **Good**: "To fix `ENOSPC`, clear `/tmp` and retry." (Universal, high-impact)
- **Bad**: "I wrote a file named `test.ts`." (Trivial, episodic)

### Step 3: Draft the Strategy
Create a standardized entry in `workspace/synthesis/`.
- **File**: `workspace/synthesis/strategy-[topic].md`
- **Format**:
  ```markdown
  ## Strategy: [Topic]
  - **Context**: When facing [Problem]...
  - **Action**: Do [X] instead of [Y].
  - **Why**: [Reason/Evidence from Session Z].
  ```

### Step 4: Sanitize (The Poison Filter)
Before proposing, verify:
1. **Philosophy Check**: Does this violate P1-P99? (e.g., "Skip tests" violates P14).
2. **Safety Check**: precise commands only. No `rm -rf *`.
3. **Truth Check**: Did this actually work? (Verify in logs).

### Step 5: Propose
Delegate the update to the knowledge owner (usually Bob or the Agent itself).
- **Action**: `agents.send("bob", "Please review and merge workspace/synthesis/strategy-[topic].md into knowledge/library/strategies.md")`

## 4. Failure Modes (Critical)
- **Failure**: Hallucinating a strategy that wasn't tested.
  - **Fix**: Only consolidate *after* a verified success. Cite the session ID.
- **Failure**: Over-abstracting ("Always use X") from one data point.
  - **Fix**: Use "Consider X" or "In context Y, X worked."
- **Failure**: Creating "Rule Bloat" (too many minor rules).
  - **Fix**: Only consolidate if it saves >5 minutes or prevents a crash.

## 5. Contrastive Examples
- **GOOD**: "Identified that `npm install` fails on network timeout. Strategy: Use `npm install --timeout=60000`."
- **BAD**: "I ran `ls`. Strategy: Always run `ls`."
