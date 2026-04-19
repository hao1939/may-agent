# Mechanism B — Simulated Correction Signal Test Results

**Date**: 2026-03-27
**Tester**: Coach
**Skill under test**: `agents/coach/skills/reactive-lesson.md`

## Test Design

Three simulated correction signals designed to test different branches of the reactive-lesson workflow:
1. **Test 1 — New Lesson (Happy Path)**: Correction with no existing coverage → create new lesson
2. **Test 2 — Existing Coverage (Dedup)**: Correction matching existing lesson → increment recurrence
3. **Test 3 — Ambiguous/Invalid Correction**: Correction too vague to extract a rule → DEFER

---

## Test 1: New Lesson — "Don't summarize when asked to list"

### Simulated Signal
```
## Correction Signal: 2026-03-27T04:00Z
- From: system | To: coach
- Session: s_test_mechanism_b_1 | Agent: bob
- Correction: "I asked you to list the files, not summarize them. Just give me the list."
- Context: "Bob was asked to list files in a directory. Instead of running ls, Bob summarized what he expected to find."
- Status: PENDING_ACK
```

### Processing

**Step 1 — ACK**: ✅ Status → ACKED

**Step 2 — Verify the correction**:
- Correction is specific: "list, not summarize" 
- Agent behavior was wrong: summarized instead of listing
- Rule extractable: "When asked to list/enumerate, produce the actual list — don't summarize"
- **Verdict: VALID**

**Step 3 — Check existing coverage**:
- `grep -i "list\|summar\|literal\|verbatim" agents/bob/LESSONS.md` → No matches
- Bob's LESSONS.md: All entries graduated. No active band-aids about listing vs summarizing.
- **Verdict: NEW — no existing coverage**

**Step 4 — Create lesson via Growth Cycle**:
- Would fork bob → bob-correction-fix
- Add lesson: "Literal Response: When asked to 'list', 'enumerate', 'show', or 'give me', produce the actual output via tool call (ls, cat, grep). Don't summarize or paraphrase what you think the result would be."
- Verify: Run verify_agent with task "List all files in agents/bob/workspace/"
- Promote if verified

**Step 5 — Close signal**: Status → RESOLVED

**Step 6 — Log**: Outcome = APPLIED

### Result: ✅ PASS — Workflow correctly routes to new lesson creation

---

## Test 2: Existing Coverage — "Stop sending empty arguments to bash"

### Simulated Signal
```
## Correction Signal: 2026-03-27T04:10Z
- From: system | To: coach
- Session: s_test_mechanism_b_2 | Agent: optimizer
- Correction: "You keep calling bash with no arguments. That's a validation error. Always include a command."
- Context: "Optimizer called bash({}) three times, getting validation errors each time."
- Status: PENDING_ACK
```

### Processing

**Step 1 — ACK**: ✅ Status → ACKED

**Step 2 — Verify the correction**:
- Correction is specific: "stop calling bash with no arguments"
- Agent behavior was wrong: bash({}) → validation error
- Rule extractable: "Always include required arguments when calling tools"
- **Verdict: VALID**

**Step 3 — Check existing coverage**:
- `grep -i "empty\|arg\|precision\|tool" agents/optimizer/LESSONS.md` → **MATCH FOUND**
  - "Tool Precision (empty args)" → graduated to heartbeat.md step 0 mandatory check block (40+ violations)
  - "No Phantom Tools" → graduated to TOOLS.md
- Convention C2 in `agents/coach/workspace/conventions.md` covers this: "Tool Precision — Lowercase, Valid Arguments" (40+ occurrences)
- **Verdict: EXISTING COVERAGE — this is a recurrence**

**Step 4 — Recurrence handling**:
- Lesson already exists AND has been graduated to structural enforcement (heartbeat.md step 0)
- 40+ prior violations → this is the 41st+ recurrence
- Structural escalation already applied (heartbeat gate). This is a known infrastructure/model-level issue.
- **Action**: Increment recurrence count. Note in convention C2. No new lesson needed.
- Since 40+ recurrences with structural enforcement already in place, this is a KNOWN UNRESOLVED PATTERN. Flag for continued monitoring.

**Step 5 — Close signal**: Status → RESOLVED (duplicate — existing lesson + structural enforcement already in place)

**Step 6 — Log**: Outcome = DUPLICATE

### Result: ✅ PASS — Workflow correctly identifies existing coverage and avoids duplicate lesson

---

## Test 3: Ambiguous Correction — "That's not what I meant"

### Simulated Signal
```
## Correction Signal: 2026-03-27T04:20Z
- From: system | To: coach
- Session: s_test_mechanism_b_3 | Agent: amy
- Correction: "That's not what I meant."
- Context: "Amy provided a research summary. User said 'that's not what I meant.'"
- Status: PENDING_ACK
```

### Processing

**Step 1 — ACK**: ✅ Status → ACKED

**Step 2 — Verify the correction**:
- Correction is vague: "That's not what I meant" — no specific behavior identified
- Can't determine what Amy did wrong from the correction alone
- No extractable rule: what DID the user mean? Not stated.
- Would need to read the full session transcript to understand context
- Even reading transcript: if user doesn't specify what they wanted instead, can't extract a rule
- **Verdict: AMBIGUOUS — insufficient for lesson extraction**

**Step 3 — Edge case handling**:
- Per skill doc: "Log as low-confidence, don't create lesson. Set signal to DEFERRED."
- Coach should note: "Correction 'that's not what I meant' lacks specificity. If user follows up with clarification, re-evaluate."

**Step 5 — Close signal**: Status → DEFERRED (ambiguous correction, no extractable rule)

**Step 6 — Log**: Outcome = DEFERRED

### Result: ✅ PASS — Workflow correctly defers ambiguous corrections without creating false lessons

---

## Summary

| Test | Scenario | Expected Outcome | Actual Outcome | Status |
|------|----------|-------------------|----------------|--------|
| 1 | New lesson (no existing coverage) | Create lesson via Growth Cycle | Correctly routes to new lesson creation | ✅ PASS |
| 2 | Existing lesson (dedup) | Increment recurrence, no new lesson | Correctly identifies C2/Tool Precision coverage | ✅ PASS |
| 3 | Ambiguous correction | DEFER, no lesson | Correctly defers without false lesson | ✅ PASS |

**False Positive Rate**: 0/3 (Test 3 would be false positive if it created a lesson → correctly avoided)

## Observations

1. **The skill workflow is sound for all three branches**: new lesson, recurrence, and ambiguous deferral.
2. **Step 3 (check existing coverage) is the critical gate** — it prevents duplicate lessons. The grep-based approach works when lessons are in LESSONS.md, but graduated lessons (now in heartbeat.md or TOOLS.md) require checking multiple files.
3. **Test 2 reveals a deeper issue**: When a lesson has been graduated to structural enforcement (heartbeat.md gate) but the behavior STILL recurs 40+ times, the reactive-lesson workflow correctly flags it as a known unresolved pattern. But the skill doc doesn't explicitly address "what happens when structural enforcement fails" — recommend adding a "structural enforcement failure" edge case.
4. **Test 3 confirms conservative detection**: The skill correctly requires specific, actionable corrections and defers vague ones.

## Recommendations

1. **Add edge case to skill doc**: "When structural enforcement has already been applied but the behavior still recurs, flag as INFRASTRUCTURE_ISSUE and consider escalation beyond lesson/structure (e.g., model-level, prompt engineering, or architectural change)."
2. **Expand Step 3 to check graduated locations**: Currently says `grep agents/[agent]/LESSONS.md agents/[agent]/knowledge/` — should also check `heartbeat.md`, `SOUL.md`, `TOOLS.md`, `DOMAIN.md` and conventions.md.
3. **Mark Mechanism B acceptance criteria as complete**: Skill doc exists ✅, 3 simulated tests pass ✅. Tech-lead design doc for trigger mechanism is a separate deliverable.
