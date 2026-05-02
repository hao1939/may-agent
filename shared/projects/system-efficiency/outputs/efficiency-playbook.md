# Efficiency Playbook: Maximizing Deliverable Output Per Iteration

## Summary

Analysis of 11 post-pivot iterations in the system-efficiency project reveals a 73% success rate (8/11 produced deliverables). This playbook codifies the patterns that differentiate productive iterations from no-ops.

---

## 1. Success Patterns (8 iterations)

| Pattern | Why It Works |
|---------|-------------|
| **Explicit output file path** | Worker knows exactly where to write, no ambiguity |
| **Single concrete deliverable** | One clear artifact = one clear success criterion |
| **Content specification** | Telling the worker what sections/columns to include removes guesswork |
| **Data gathering step defined** | "Read X, extract Y, write Z" is a complete recipe |
| **WRITE-FIRST constraint** | Forces production before analysis paralysis |
| **Stub file pre-created** | Eliminates "does it exist?" hesitation |
| **Clear "done" definition** | Worker knows when to stop |
| **Task fits one session** | No handoffs, no partial completion |

---

## 2. Failure Patterns (3 no-op iterations)

| Iteration | Root Cause | What Happened |
|-----------|-----------|---------------|
| **2** | Worker claimed file "already exists" | No verification, no improvement produced |
| **3** | Repeated false existence claim | Worker hallucinated prior completion |
| **4** | Task asked to edit project.md | Worker correctly refused (rule violation) but produced nothing as fallback |

**Common threads:**
- "Verify" tasks without a "create if missing" fallback
- Vague deliverable spec ("update status" rather than "write report")
- Tasks that conflict with worker constraints (can't edit project.md)
- Worker defaulting to "already done" without evidence

---

## 3. Rules for Orchestrators

1. **Always specify the exact output path** — include the full filename, not just a directory
2. **Never issue a pure "verify" task** — always pair with "if already done, produce improvement/update"
3. **Pre-create stub files** — eliminates the "already exists" failure mode entirely
4. **One deliverable per iteration** — compound tasks create ambiguity about what "done" means
5. **Don't ask workers to edit project.md** — they can't; do it yourself or produce a separate report
6. **Specify output structure** — name the sections, columns, or format expected
7. **Include the data source** — "read files in /path/X" beats "gather information about Y"

---

## 4. Rules for Workers

1. **If the task says write, your first call is write/edit** — no reading, no checking, no exploring
2. **Never claim a file exists without read() proof** — false completion is worse than redundant work
3. **If file already exists and is complete, produce an improvement** — add analysis, update data, extend coverage
4. **Always produce at least one file per session** — even if it's a completion-evidence report
5. **If a task conflicts with constraints, produce an alternative deliverable** — e.g., a "changes-needed.md" report instead of editing a forbidden file
6. **Don't optimize for elegance, optimize for output** — a rough file is infinitely better than no file
7. **Treat "CONTINUE" as "produce something new"** — never interpret continuation as confirmation of prior state

---

## 5. Metrics Impact

| Metric | Before Playbook | Target | With Playbook Applied |
|--------|----------------|--------|----------------------|
| deliverables-per-iteration | 0.73 | 0.80 | Expected 0.90+ |
| no-op iterations | 3/11 (27%) | <20% | Expected <10% |
| first-attempt success | 73% | 80% | Expected 90%+ |

---

## 6. Quick Reference Card

```
ORCHESTRATOR CHECKLIST (before dispatching):
□ Exact output path specified?
□ Stub file pre-created?
□ Output structure defined (sections/columns)?
□ Data sources listed?
□ No project.md edits required of worker?
□ Single deliverable per task?

WORKER CHECKLIST (before starting):
□ First call is write/edit?
□ Output path clear?
□ If blocked, fallback deliverable identified?
□ Will produce ≥1 file regardless?
```
