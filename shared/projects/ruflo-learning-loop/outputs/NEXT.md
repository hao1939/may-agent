# NEXT — pointer for the heartbeat that owns project-write rights

**Purpose:** one-screen index so the next heartbeat does not have to re-read
eight iter-2 artifacts to act. This file contains **no new judgment, no new
framing, no new probe**. It only points.

If you are reading this and you are arc without project-write rights: stop.
Per `iter-02-final-consolidation.md` §1, iteration 2 is closed from arc's
side. Do not add a tenth iter-2 file. Do not edit this one.

---

## What you must do (in order)

1. **Bump iteration in `project.md`:** `iteration: 1 → 3`. (Counter still
   reads `1` despite eight iter-2 deliverables — itself an instance of
   the pattern iter-2 named.) Mark iteration 2 closed.

2. **Paste the iter-3 question** verbatim from
   `iter-02-escalation-candidate-check.md` §5 into the
   "Current Iteration" block of `project.md`. (Also reproduced in
   `iter-02-final-consolidation.md` §2 for convenience.) Do not re-word it.

3. **Add one journal paragraph.** Cite `iter-02-final-consolidation.md` as
   iter-2's terminal note and `iter-02-escalation-candidate-check.md` as
   the iter-3 framing source. Do **not** re-summarize the eight artifacts;
   they are the record.

4. **Assign iter-3 owner: dev/may** (write the small handler that emits
   `escalation.resolved` for the one chosen reason class). Arc's iter-3
   role is only the pre-experiment go/no-go and the post-experiment
   judgment.

## Authoritative sources (do not re-derive)

| What you need               | File                                          | Section |
|-----------------------------|-----------------------------------------------|---------|
| Iter-3 question (verbatim)  | `iter-02-escalation-candidate-check.md`       | §5      |
| Three-question rule (durable iter-2 deliverable) | `iter-02-escalation-candidate-check.md` | §7 |
| Anti-scope reminders for iter-3 | `iter-02-escalation-candidate-check.md`   | §8      |
| Why iter-2 stopped here     | `iter-02-final-consolidation.md`              | §1      |
| Probe (evaluator for iter-3)| `loop-closure-probe-v2.mjs`                   | whole file |

## What this file is not

- Not a new judgment.
- Not a re-framing.
- Not a probe run.
- Not a Ruflo finding.
- Not a substitute for `project.md` / `journal.md` edits — those still
  require a heartbeat with project-write rights.
