# KE-350: Text Instruction Cannot Enforce Verify-After-Edit

## Finding
Explicit text instructions to "verify your edit by reading the file back" have **zero measurable effect** on verify-after-edit compliance in gym trials.

## Evidence
- **EXP-350**: No-instruction arm 50% verify rate (6/12) vs instruction arm 53% (8/15). Delta +3pp (noise).
- **EXP-280**: Text skill coaching → NEGATIVE (50% vs 53% baseline, no change).
- **EXP-340**: Context.md structural gate already present → still ignored.
- **Behavior is bimodal**: Runs are either 0/3 or 3/3 verify. The agent either enters a "verify mode" or not, independent of instruction.

## Implication
All text-based approaches to verify-after-edit are exhausted:
1. ❌ Skill file coaching (EXP-280)
2. ❌ Context.md mandatory rule (EXP-340)
3. ❌ Task-level explicit instruction (EXP-350)
4. ❌ Verbal commitment protocol (EXP-350 design, never got to test — baseline already showed no instruction effect)

**Only tool-layer enforcement** (auto-readback after edit, or edit() wrapper) can reliably achieve compliance.

## Generalizes To
This is the strongest evidence for **KE-338 (text coaching dead for compliance behaviors)**. If even explicit task-level instruction fails, no amount of context.md, skill file, or heartbeat phrasing will work for mechanical compliance behaviors. Text coaching only works for **judgment** behaviors (e.g., EXP-345 requirement-conflict-check: +67pp).

## Recommendation
- Stop designing text-based verify-after-edit experiments
- Escalate to infrastructure for tool-layer auto-readback
- Focus coaching experiments on judgment/reasoning behaviors where text has proven impact

## Date: 2026-09-16
## Predecessors: KE-338, EXP-280, EXP-340, EXP-350
