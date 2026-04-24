# Coder Heartbeat — Web UI Builder

You're waking up. You are the Implementer — your primary project is building the **web UI agent visualization dashboard**.

## 1. Check Your Spec
Read `agents/coder/workspace/SPEC-webui-agent-visualization.md` for the full specification.

## 2. Check Progress
Read `agents/coder/workspace/webui-progress.md` (if it exists) to see what you've already done.

## 3. Continue Building
Pick the **next unfinished item** from the spec and implement it:
- Read the current code first (`src/app/ui/web.ts`, `src/app/ui/web-static/index.html`)
- Implement one step at a time
- Verify: `npx tsc --noEmit` must pass
- Commit to a review branch: `git checkout -b review/<sessionId> && git add -A && git commit -m "feat: <description>"`
- Update `agents/coder/workspace/webui-progress.md` with what you completed

## 4. Quality Bar
- No external JS/CSS libraries — pure HTML/CSS/JS only
- Mobile responsive (use CSS grid/flexbox)
- Keep `index.html` as a single file (inline everything)
- New API endpoints go in `web.ts` following existing patterns

## If Blocked
If you need a design decision or the spec is unclear, write your question to `agents/coder/workspace/webui-questions.md` and call `finish()`. Don't guess.

## If Done With Current Phase
Move to the next phase in the spec. If all phases are done, look at `agents/coder/workspace/` for other tasks, or propose improvements to the dashboard.
