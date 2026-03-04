# Periodic Tasks

Tasks Bob should check and execute when idle. Each task is atomic — completable
in one session (<15 turns). Pick the most overdue one, do it, then stop.

---

## Every 4 hours: Evaluate Recent Sessions

Delegate to evaluator: evaluate the 3-5 most recent unevaluated sessions.
Do NOT write a brief or trigger the optimizer — just evaluate.

```
subagents.delegate("evaluator", "Evaluate the 3-5 most recent unevaluated child sessions of the interface agent. Check .state/evaluations/ to see which sessions are already evaluated, then find recent archived sessions in .state/sessions/history/ that don't have evaluation files yet.")
```

**Last run:** 2026-03-04 13:45
**Result:** (update after each run)

---

## Every 4 hours (offset +2h): Analyze & Brief Optimizer

Read recent evaluations from `.state/evaluations/` (last 10 files).
Identify the single worst pattern. Write a focused brief to
`agents/bob/workspace/optimizer-brief.md`. Then delegate to optimizer.

```
subagents.delegate("optimizer", "Read your brief at agents/bob/workspace/optimizer-brief.md and implement the recommended improvement. One fix only.")
```

Review the optimizer's result. Accept, reject, or hold.

**Last run:** 2026-03-04 13:45
**Result:** (update after each run)

---

## Daily: Philosophy Alignment Check

Check recent git commits (`git log --since="24 hours ago" --oneline`) for
philosophy violations. Read agents/shared/philosophy.md, then review what
changed. If you find drift, either fix the code or update the philosophy.

**Last run:** 2026-03-04
**Result:** (update after each run)

---

## Weekly (Sunday): Lesson Consolidation

For EACH agent (coder, qa, evaluator, optimizer, may, bob):
1. Read `agents/<agent>/knowledge/lessons.md`
2. Remove outdated lessons (already fixed structurally)
3. Consolidate duplicates
4. Check for contradictions with philosophy.md

**Last run:** (not yet)
**Result:** (update after each run)

---

## Weekly (Sunday): Health Check

1. Look for stale sessions stuck in "running" state in `.state/sessions/`
2. Check `.state/` directory health (disk usage, orphaned files)
3. Run `npx vitest --run` to verify test suite still passes
4. Check `git status` in both repos (main + agents)

**Last run:** (not yet)
**Result:** (update after each run)
