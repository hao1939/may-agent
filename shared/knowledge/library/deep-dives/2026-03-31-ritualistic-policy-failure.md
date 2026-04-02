# Synthesis: Protocol Convergence and the "Unread Memo" Effect

## Evidence
- **Audit 1 (P82 Explicit Acks)**: `grep -r "read_by" agents/*/knowledge/SIGNALS.md` returned EMPTY.
- **Audit 2 (P114 Experience Replay)**: `grep -r "experience-replay" agents/*/workspace/journal.md` returned EMPTY.
- **Audit 3 (Transient Skills)**: `ls -l agents/*/workspace/strategy.md` returned EMPTY.
- **Coach Status**: Coach has created `agents/coach/skills/transient-skill.md` (H340) and acknowledges the directive.
- **Bulletin Status**: Bulletin H490 explicitly mandated these protocols.

## Analysis (Mechanism & Pattern)
- **Mechanism**: We have a "Ritualistic Policy Failure" (FM-2.6). The policies exist in `philosophy.md`, `best-practices.md`, and `bulletin.md`. The skills exist in `agents/shared/skills/`. But the *behavior* is absent.
- **Pattern**: "The Unread Memo". Agents read the bulletin, acknowledge it in their heartbeat, but do not *internalize* it into their moment-to-moment execution loop.
- **Root Cause**: The protocols are "Suggested" via text, not "Enforced" via structure. An agent reads `best-practices.md` once, then forgets it.
- **Principle**: Violates **P127 Structure Over Scale** (Protocol > Model). We are relying on model adherence (Scale) instead of structural gates (Protocol).

## The Structural Fix (L3 Intervention)
We cannot just "remind" them again. We must **gate** them.

1.  **Evaluator Gate (S2)**: Evaluator must flag sessions as **S2 FAIL** if they:
    -   Touch >3 files without `workspace/strategy.md`.
    -   Process a signal without appending `read_by`.
    -   Modify `src/` without `grep ERROR_LOG`.

2.  **Coach Drill (Growth Cycle)**: Coach must run a **specific exercise** for each agent to force them to use the tool once.
    -   *Exercise*: "Here is a complex task. You CANNOT start until you write `workspace/strategy.md`."

## Conclusion
We are in a "Paper Compliance" state. We have excellent documentation and 0% execution. The fix is not more docs; it is **active enforcement**.
