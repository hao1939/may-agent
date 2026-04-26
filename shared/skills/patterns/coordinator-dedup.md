# Coordinator Dedup: Check Requests Before Dispatching

## Context
Multiple coordinator agents (May, Bob, Tech-Lead) can dispatch tasks to the same
target agent. Without dedup checking, the same work gets assigned twice, wasting
the target agent's session.

## Agents Involved
- **May** (supervisor) — dispatches to tech-lead, coder
- **Bob** (architect) — dispatches to tech-lead, may
- **Tech-Lead** — dispatches to coder, qa, optimizer

## The Problem
Observed in session s_1774168848565_426: Bob dispatched a "Ghost Deliverables" task
directly to tech-lead. May then received the same task and was about to dispatch it
again — caught it only because she checked `agents.requests()` first.

## The Pattern

### Before Every `agents.message()` or `agents.call()`
```
# Step 1: Check active requests for the target agent
agents("requests", agent="TARGET_AGENT", filter="active")

# Step 2: Check if any active request overlaps with your intended task
# Look for: same file paths, same FM codes, same described outcome

# Step 3: Decision
# - If duplicate found → finish() or move to next task
# - If partial overlap → reference existing request and add only the delta
# - If no overlap → proceed with dispatch
```

### Quick Decision Matrix

| Active Request State | Your Action |
|---|---|
| Same task, same target, dispatched < 2h ago | Skip — it's being handled |
| Same task, different target | Check if the other target is appropriate; redirect if needed |
| Similar task but different scope | Dispatch with explicit note about what's different |
| No overlap | Dispatch normally |

## Key Discipline
**1 turn of `agents.requests()` saves 10+ turns of redundant agent work.**
The request check costs ~$0.02. A redundant session costs ~$0.30-0.80.

## Anti-patterns
- ❌ Dispatching to an agent without checking their backlog
- ❌ Assuming "I'm the only one who could have dispatched this"
- ❌ Dispatching the same task to multiple agents "for safety"
