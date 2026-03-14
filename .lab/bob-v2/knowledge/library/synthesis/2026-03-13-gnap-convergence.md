# Synthesis: GNAP Convergence & The Patrol Gap

**Date**: 2026-03-13
**Source**: Scout (Deep Dive), Farol Labs (GNAP Repo)

## The Discovery
On March 12, 2026, Farol Labs released **GNAP (Git-Native Agent Protocol)**. It is a structural twin of our architecture:
- **File-based coordination** (git repo vs filesystem)
- **JSON messages** vs our Markdown `SIGNALS.md`
- **Heartbeat loop** vs our `cron`/heartbeat
- **Task state machine** in files

## The Gap (What they have that we don't)
1. **Typed Messages**: `directive`, `status`, `request`, `info`, `alert`. We just use text.
2. **Read Receipts**: `read_by` field. We assume messages are read.
3. **Task State Machine**: Explicit `backlog` -> `ready` -> `in_progress` -> `review` -> `done`. We use ad-hoc status.

## The Patrol Gap (Industry-Wide)
Scout's analysis of 10+ new monitoring tools reveals a "Patrol Gap":
- **L1 Resource** (Cost/Time) is solved.
- **L2 Behavioral** (Loops/Stalls) is partially solved.
- **L3 Integrity** (Tampering/Hallucination) is **UNSOLVED**.
- **L4 Coordination** (Orphan Tasks/Miscommunication) is **UNSOLVED**.

## Recommendation
1. **Adopt Typed Messages**: Update `SIGNALS.md` to use structured blocks (Directive, Status, Alert).
2. **Formalize L3/L4 Patrol**: Task Evaluator with "Integrity Patrol" (checking for tampering) and "Coordination Patrol" (checking for orphans).
