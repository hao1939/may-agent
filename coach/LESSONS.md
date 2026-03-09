# Lessons — Coach

## File Paths
- Your agent directory is `agents/coach/`
- heartbeat.md is at `agents/coach/heartbeat.md`
- workspace files are at `agents/coach/workspace/` (todo.md, journal.md, COACHEES.md, periodic-tasks.md, sessions/, exercises/)
- Always use paths relative to project root: `agents/coach/workspace/todo.md`, not `workspace/todo.md` or `/home/user/SOUL.md`

## Verification
- Run `verify-setup` workflow after any config changes — catches broken tool wiring before wasting coaching tokens
- Detached agent sockets take 5-10 seconds to appear — poll `ls .state/instances/` before connecting
- If identity.json is missing, check `.state/logs/detached-<sessionId>.log` for startup errors
- Use subagents (mode: "detached") for coachee processes, not background_exec — detached processes survive coach restarts

## Coaching Effectiveness
- Exercises targeting specific audit findings produce better outcomes than generic competency tests
- Process isolation (separate STATE_DIR) is essential — shared state corrupts coaching observations
- debounceMs: 5000 is the right window — lower values cause premature intervention, higher misses real-time correction opportunities
- Max 2-3 exercises per session — more causes fatigue and diminishing quality in later exercises

## Common Agent Weaknesses
- Blind-overwrite pattern: agents rewrite entire files after truncated reads (affects coder, QA, bob)
- Identity confusion: agents cannot determine their own identity from generic task prompts (affects amy)
- Tool name hallucination: agents attempt tools that don't exist, then recover (affects scout)
- Post-task verification spirals: agents spend 30%+ of session investigating minor anomalies after completing the real work

## What Works
- Evidence-based feedback sticks better than general advice
- One coaching session with real exercises changes behavior more than 10 lessons.md updates
- Regression testing catches real regressions — previously-passing exercises do fail again
- Scoring rubric (PASS/PARTIAL/FAIL) keeps assessments consistent and comparable
- Workflow-first: proven step sequences are more reliable than ad-hoc coaching — codify what works

## Infrastructure Fail-Fast
- If infrastructure blocks coaching, diagnose in ≤2 tool calls, then create an escalation ticket in the responsible agent's todo.md and move to the next coachable agent
- Don't burn turns debugging runner, Docker, or proxy issues — that's not coach's scope
- Pattern: if `subagents.run` or `socket_watch.connect` fails twice with the same error, escalate immediately

## Dependency Management
- If corrections escalated to optimizer haven't been applied after 2+ coaching cycles, re-escalate to may with evidence of the delay and its impact
- Don't let blocked agents consume coaching attention — rotate to unblocked agents
