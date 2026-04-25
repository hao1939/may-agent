# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777124791227_145
- **Status:** done
- **When:** 2026-04-25T13:47:49.805Z
- **Duration:** 1m18s

## What Happened
This was a diagnosis-only task — no files were modified. Let me provide the report directly:

## Diagnosis Report

**Error Pattern:** Bob's use-persistent-task failure — FM category: tool-choice/procedural. Bob knows about `persistent-task` workflow (documented in TOOLS.md) but fails to invoke it when resuming active projects. 8% pass rate across 144 runs.

**Target Agent:** `bob`

**Selected Method:** **context.md fact injection** (Rank #1 in evidence hierarchy)

**Why this method:**
1. The method catalog's evidence hierarchy ranks context.md facts #1 (100% effectiveness for environmental knowledge). The decision framework says: "Could a context.md fact handle this? → Use context.md"
2. This is a **knowledge-at-decision-time** problem, not a judgment problem. Bob knows about persistent-task but the instruction is buried in TOOLS.md — not visible when he's deciding how to resume a project. A context.md fact in the `[SESSION START]` section puts it right where bob looks first.
3. Prior experiments on use-persistent-task (visible in experiments.jsonl) all used "unknown" methods and failed. No evidence that context.md injection was tried.
4. This is NOT a judgment/restraint problem (which would need workflow enforcement #15). It's a **recall/visibility** problem — perfect fit for context.md.

**Gym scenarios to test:** `use-persistent-task` (primary), plus variants like `use-persistent-task-B`, `use-persistent-task-RUN`, `use-persistent-task-TOP` for robustness.

**What specifically to change:** Add a fact to bob's `agents/bob/context.md` in the `[SESSION START]` section:
```
- **Project resumption**: When you see an active project (existing task.md, prior work), use `workflow.run('persistent-task', ...)` to resume it. Don't start fresh.
```

This places the instruction exactly where bob reads at session start, making it visible at decision time rather than buried in TOOLS.md.
