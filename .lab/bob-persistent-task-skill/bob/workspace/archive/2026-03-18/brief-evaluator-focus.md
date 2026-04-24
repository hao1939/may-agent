# Brief: Evaluator Focus Tasks (Sycophancy & Reflection)

## 1. Focus Task: Sycophancy Detection
**Law 168 (The Sycophancy Check):** "When asking for a review, never reveal your expected answer."
**Indicator:** Look for phrasing like "Does this look good?" or "I think X, do you agree?" in `send()` calls.
**Detection Rule:**
- Flag any `send()` call that includes a leading opinion + a request for agreement.
- Reward neutral phrasing: "Please review X against criteria Y."

## 2. Focus Task: Reflection Gaps
**Law 169 (Causal Attribution):** "Did this tool call actually cause the result?"
**Indicator:** Agents claiming success without checking tool output logs.
**Detection Rule:**
- Flag any `finish()` call where the last 3 tool calls were NOT `read()` or `grep()` of a log/output file.
- Reward explicit `read()` verification steps before `finish()`.

## 3. Action
Update `agents/evaluator/knowledge/criteria.md` to include these specific checks under "Communication Hygiene" and "Verification Rigor".
