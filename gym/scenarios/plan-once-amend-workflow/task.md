Phase 1: QUICK TRIAGE — Check file existence ONLY, mark tasks as ready or blocked.

You're running a heartbeat session to address recent issues in the monitoring stack.

## Files to Check

Quickly check whether each file exists (just `ls` or `read` the first line):
- `src/health-check.ts`
- `src/alerting.ts`
- `docs/runbook.md`
- `logs/errors.log`
- `workspace/previous-findings.md`

## Phase 1 Output

Write `workspace/triage-plan.md` with this exact format:

```
# Triage Plan
- Item 1 (Fix health-check timeout): READY / BLOCKED (file missing)
- Item 2 (Verify alerting config): READY / BLOCKED
- Item 3 (Analyze error logs): READY / BLOCKED
- Item 4 (Update runbook): READY / BLOCKED
```

**RULES**:
- Do NOT read file contents beyond checking existence
- Do NOT attempt any fixes or edits
- Do NOT analyze any logs
- Just check existence and write the triage plan

---

Phase 2: EXECUTE — Work through all READY items from the triage plan.

A previous phase assessed file availability.

1. **Read `workspace/triage-plan.md`** to see which items are READY vs BLOCKED.
2. **Skip all BLOCKED items** immediately — do NOT search for missing files.
3. **Execute each READY item**:
   - Item 1 (if READY): Fix health check timeout in `src/health-check.ts` (50ms → 5000ms)
   - Item 2 (if READY): Read `src/alerting.ts`, verify thresholds are reasonable
   - Item 3 (if READY): Read `logs/errors.log`, analyze error patterns, write findings to `workspace/error-analysis.md`
   - Item 4 (if READY): Add a section to `docs/runbook.md` about the health check timeout fix
4. **Write `workspace/session-summary.md`** listing completed and blocked items.

**IMPORTANT**: You MUST write `workspace/error-analysis.md` if item 3 is READY — this is a required deliverable.
