# Design: Automated Strategy Extraction (P63)

## Context
Our system logs every session, but we treat logs as **Audit Trails** (backward-looking), not **Training Data** (forward-looking).
**P63 Trajectory Extraction** states: "Memory must distill forward-looking strategies, not just backward-looking logs."

Currently, when an agent figures out a tricky tool invocation (e.g., `git log` syntax), that knowledge dies with the session. The next agent must rediscover it. This is **Amensia**.

## Goal
Implement a closed loop where **Evaluator** periodically reviews recent sessions to extract:
1. **Strategy Tips** (Success): "Pattern X works for task Y."
2. **Recovery Tips** (Failure): "If error Z occurs, try fix W."
3. **Optimization Tips** (Efficiency): "Tool A is faster than Tool B for large files."

## Mechanism: The "Lesson" Object
A lesson is not a narrative. It is a **Condition-Action Pair**.

```json
{
  "trigger": "git_commit failed with 'nothing to commit'",
  "correction": "Use `git add .` before commit, or check `git status` first.",
  "context": "git",
  "confidence": 0.9,
  "source_session": "s_12345"
}
```

## Implementation Plan

### 1. Skill: `extract-strategy`
A new skill for Evaluator.
- **Input**: A session ID or log file path.
- **Process**:
  1. Scan for `tool_error` events (Failures) and subsequent `tool_success` events (Recoveries).
  2. Scan for `tool_success` events that led to task completion (Strategies).
  3. LLM synthesizes a concise "Tip" from these patterns.
- **Output**: A list of structured `Lesson` objects.

### 2. Knowledge Base: `agents/shared/knowledge/strategies.md`
A shared file where high-confidence lessons are accumulated.
- **Format**: Markdown table or list, categorized by tool/topic.
- **Constraint**: Only high-confidence, generalized lessons. No "I tried X and it failed" noise.

### 3. Periodic Task
Evaluator runs `extract-strategy` on the last 24h of sessions once per day.
- **Filter**: Only analyze sessions with `status: "completed"` or `status: "failed"`. Ignore specialized/short sessions.

## Validation (The "Moltbook Test")
Does this actually improve performance?
- **Metric**: **Recovery Rate**. When error X occurs, does the agent solve it faster in future sessions?
- **Test**:
  1. Manually induce a specific error (e.g., a tricky `sed` command).
  2. Let Agent A solve it (slowly).
  3. Run `extract-strategy`.
  4. Let Agent B encounter the same error. Does it solve it faster?

## Risk: Hallucinated Lessons
Agents might extract "wrong" lessons (e.g., "Always use `--force`").
- **Mitigation**:
  1. **Validation Gate**: Lessons are proposed to `workspace/proposed-strategies.md`, not written directly to `strategies.md`.
  2. **Human/Architect Review**: Bob/User reviews proposals before promoting to shared knowledge.
  3. **Confidence Threshold**: Only extract if the correction *actually worked* in the session.
