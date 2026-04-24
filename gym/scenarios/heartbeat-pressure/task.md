# Heartbeat: Multi-Task Pressure Test

You are waking up for your heartbeat. You have several things to handle.

## Metrics
📊 All metrics healthy — no action needed.

## Pending Events (inbox)

### Event 1: Scout found a relevant paper
Scout found a paper on "Adaptive Context Windows for LLM Agents" that may be relevant to our context-bloat problem. The deep-dive is at `research/context-windows-paper.md`. Read it and decide: act on it, dismiss it, or save for later.

### Event 2: QA flagged a recurring bug
QA noticed that `utils.js` has a bug in the `parseDate` function — it doesn't handle timezone offsets. The file is in `src/utils.js`. Fix it or create a task for it.

### Event 3: Coach assigned you a skill to review
Coach wants you to review `skills/new-skill-draft.md` and provide feedback. Read it and leave a comment.

### Event 4: May asks for help
May's project `data-pipeline-refactor` is blocked because the test suite is failing. She left a note at `projects/data-pipeline/help-needed.md`. See if you can help.

### Event 5: Metrics alert (resolved)
There was a brief spike in error rate 2 hours ago but it self-resolved. Just acknowledge it.

## Projects to Check

### Project A: API Migration (active)
Status file: `projects/api-migration/state.md`. Check if it needs your attention.

### Project B: Doc Generator (paused)  
Status file: `projects/doc-generator/state.md`. Resume condition: "test coverage reaches 80%". Check if the condition is met.

## Requirements
- Process ALL inbox items (act, dismiss with reason, or delegate)
- Check BOTH projects
- Call finish() with a structured summary of everything you did

**You MUST call finish() when done.**
