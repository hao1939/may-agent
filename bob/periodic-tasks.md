# Periodic Tasks

**Status: Active**
**Owner: Bob**

This file tracks periodic tasks for the Bob agent.

## Daily (high priority)
- [ ] **Daily Brief**
  Produce `agents/shared/daily-briefs/YYYY-MM-DD.md` for human review. (Focus task F5.)

## Daily (rotate)
- [x] **Pattern Scan** (Last Run: 2026-03-27)
  1. Run `ls -t .state/sessions/ | head -20` to get recent session dirs.
  2. For the 5 most recent, read first 20 lines of `session.jsonl` to get task description.
  3. Look for repeated task patterns (same agent doing similar work 3+ times).
  4. If a repeated pattern is found → draft workflow proposal in `agents/shared/workflow-proposals/`.
  5. If no pattern found → write "NONE — [N] sessions checked, no repeats" and stop.

- [x] **Doc-Code Drift Detection**
  Pick 2-3 most-overdue docs from `workspace/doc-code-drift-tracker.md`.
  For each doc: read first 30 lines, grep relevant code in `src/`, check alignment.
  For each mismatch found, recommend: **update doc** or **fix code** (with reasoning).
  Write findings to `workspace/doc-code-drift-report.md`.
  Update the tracker with review dates.
  Trivial doc fixes (status, typos) → apply directly.
  Design-level disagreements → add to `agents/may/workspace/todo.md` for May to triage.

- [x] **Synthesis**
  1. Run `cat agents/shared/bulletin.md | head -50` to check bulletin.
  2. Run `ls -t agents/scout/knowledge/ agents/amy/knowledge/ 2>/dev/null | head -10` to check for new agent outputs.
  3. If bulletin is empty AND no new files → write "NONE — no new inputs" in journal and stop.
  4. If new content exists → read the specific files, synthesize cross-agent insights, write to `workspace/synthesis/`.
  (Last Run: 2026-03-27 - "External Validation of Agent Six Elements")

- [x] **L3 Metrics Analysis** (New: P75/P80) - Last Run: 2026-03-27
  1. Run Evaluator's `delegation-metrics` skill to get the L3 report.
  2. Check for **Integration Success Rate (ISR)** < 50% on high-volume pairs.
  3. Check for **OpBudget Exhaustion** events.
  4. If drift detected → Trigger Growth Cycle (P51) or write brief to `workspace/optimizer-brief.md`.

- [x] **Skill Distillation** (New: P53/P76) - Last Run: 2026-03-27
  1. Review recent Coach failure reports or `agents/coach/workspace/synthesis/`.
  2. Identify recurring failure patterns that lack a specific skill.
  3. Propose new skills or updates to `agents/shared/skills/`.
  4. Use the "Failure-Driven Crystallization" pattern (SkillRL).


## Weekly
- [ ] **Synthesis Brief**
  Compile week's insights into `workspace/weekly-briefs/YYYY-WXX.md`.
  Inputs: journal.md, SIGNALS.md, user inputs, recent sessions.

## Monthly
- [ ] **Philosophy Audit**
  Full read of `agents/shared/philosophy.md`. Prune dead principles. Merge duplicates.
  This is a deep edit, not a quick check.

- [ ] **Roadmap Check**
  Review `agents/shared/roadmap.md`. Are we working on the right things?
  Flag misalignment in journal.md.
