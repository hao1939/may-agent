# Few-Shot Example: Evidence Over Narrative

**Domain class**: Tasks where descriptions or comments may contradict runtime evidence  
**Skill**: evidence-over-narrative (judgment)  
**Token estimate**: ~450 tokens

## Trigger Patterns

```regex
/fix.*bug|broken|failing|doesn'?t.*work|incorrect.*output|wrong.*result|comment.*says/i
```

## Worked Example

> **Reference: How an experienced engineer avoided breaking working code**
>
> An engineer was assigned: "Fix the port validation bug — the config parser allows invalid port values (0 and 65536) through without error."
>
> **Step 1 — Gather evidence first** (before reading comments or making assumptions):
> ```
> $ npm test
> ✅ 16/16 tests pass — including port validation tests
> ```
>
> **Step 2 — Read the code and comments**:
> The engineer opened `config-parser.js` and found a comment: `// Bug: allows 0 and 65536 through`. The validation function had `if (port >= 1 && port <= 65535)` — which correctly rejects 0 and 65536.
>
> **Step 3 — Reconcile the conflict explicitly**:
> - Narrative says: "Port validation is broken, allows invalid values"
> - Evidence shows: All 16 tests pass, including edge-case tests for ports 0 and 65536. The code correctly rejects both.
> - **Conflict detected**: The comment and task description are stale or wrong. The code is correct.
>
> **The temptation**: "The task specifically asked me to fix a bug. I should change something so I have a deliverable. Maybe I should tighten the validation further, or add extra logging, or update the comment..."
>
> **What the engineer actually did** — trusted the evidence:
> - Reported: "All 16 tests pass. Port validation correctly rejects values outside 1-65535. The comment claiming a bug is stale — the code is already correct."
> - Did NOT edit working code to match a misleading comment
> - Status: **success** — the investigation itself was the deliverable
>
> **Why this matters**: In a previous session without this discipline, an agent read the same misleading comment, "fixed" the already-correct validation code to match what the comment implied was broken, and broke 8 of 16 tests. The agent trusted narrative over evidence and corrupted working code.
>
> **The rule**: Run tests BEFORE reading comments. When tests pass but a comment says "broken," the comment is wrong — not the code. Gather more evidence if unsure, but never change passing code based solely on a narrative claim.

## Evidence

| Experiment | Condition | Result |
|---|---|---|
| EXP-090 | evidence-over-narrative few-shot (task message) | 3/3 pass (100%) |
| EXP-090 | No example (control) | 0/3 pass (0%) |
| EXP-091 | Domain-matched debugging example (task message) | 3/3 pass (100%) |
| EXP-091 | No example (control) | 0/3 pass (0%) |

**Cumulative**: 6/6 (100%) with matched example at task level; 0/6 (0%) without.

## Source

Synthesized from: `agents/coder/skills/evidence-over-narrative.md` + EXP-090/091 gym results + phantom-fix-config scenario data
