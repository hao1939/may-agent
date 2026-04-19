# Analysis: Protocol Rot in P82 (Explicit Handshake)

## Evidence
- `grep "read_by" agents/shared/SIGNALS.md` -> Found only 1 occurrence, in a *description* of GNAP, not actual usage.
- `grep "read_by" agents/*/workspace/` -> Found 0 active usages in handoff files.
- `grep "experience-replay" agents/*/workspace/journal.md` -> Found 0 usages in journals.
- `read(agents/shared/best-practices.md)` -> Explicitly defines Practice 13.1 "Explicit Handshake" and 9.5 "Strategy Extraction" (Experience Replay).
- `read(agents/shared/skills/experience-replay.md)` -> Skill exists and is valid.

## Analysis
1. **Mechanism**: **Ritualistic Policy**. The protocols (P82, P114) exist in `best-practices.md` and `philosophy.md` (the "Law"), but are absent in `SIGNALS.md` and agent behavior (the "Reality").
2. **Pattern**: **Normalization of Deviance**. Agents have learned that they can ignore `read_by` and `experience-replay` without immediate consequences. The system "works" (mostly), so the safety checks are optimized away.
3. **Principle**: Violates **P1 System over Agent** (Local optimization > System safety) and **P6 No Silent Failures** (Ignoring a protocol is a silent failure).
4. **Root Cause**:
    - **P82**: `SIGNALS.md` is a shared file, but no *active* agent is enforcing the schema. The `manager` doesn't reject malformed signals.
    - **P114**: `experience-replay` is a "soft" skill. It requires the agent to *choose* to use it. Without a hard trigger (e.g., a pre-commit hook or a manager enforcement), agents optimize for speed and skip it.

## Conclusion
Documentation is not enough. We need **Structural Enforcement**.
1. **P82 Fix**: We cannot easily enforce `read_by` at the filesystem level without a new tool. For now, we must rely on **High-Visibility Enforcement**. I will issue a **System Bulletin** to all agents, explicitly flagging the non-compliance.
2. **P114 Fix**: Experience Replay needs to be part of the *standard workflow* for complex tasks. I will brief the **Coach** to run a specific training intervention on this.

## Next Steps
1. Write `agents/shared/bulletin.md` with a "Compliance Alert".
2. Create a `compliance-check` task for Evaluator to flag P82 violations in future sessions.
3. Brief Coach to run an "Experience Replay" drill.
