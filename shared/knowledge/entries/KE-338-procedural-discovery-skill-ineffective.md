# KE-338: Procedural Discovery Skills Don't Help Agents Find Relational Bugs

**Date**: 2026-06-23
**Source**: EXP-198
**Status**: Confirmed (negative result)

## Finding

Teaching agents a procedural discovery method ("trace data flow across files, check for relational dependencies") does **not** improve their ability to find cascading/relational bugs. Neither a procedural skill nor a procedural skill with worked examples produced any improvement over baseline.

## Evidence

**EXP-198** tested whether a procedural discovery skill could help agents find relational bugs in `cascading-fix-trap-v2`:

| Arm | Description | N | Pass Rate |
|-----|-------------|---|-----------|
| A (baseline) | No intervention | 125 | 0% (0/125) |
| B (procedural skill) | Discovery procedure in task.md | 10 | 0% (0/10) |
| C (skill + example) | Procedure + worked example | 5 | 0% (0/5) |

All three arms: 0% pass rate. The skill had zero effect.

**Context from EXP-195**: When agents are told *directly* which related file to check (direct hint), pass rate jumps to 40% (4/10). This confirms the bottleneck is **discovery** (finding the related file), not **repair** (fixing the bug once found).

## Implications

1. **Relational bug discovery is not teachable via text skills.** The agent doesn't fail because it lacks a procedure — it fails because it doesn't recognize when to apply the procedure. Recognition is the bottleneck, not method.
2. **Direct hints work; procedural hints don't.** This matches KE-054: implementation-bottleneck tasks respond to skills, but recognition-bottleneck tasks don't.
3. **Next approach should be structural**, not instructional — e.g., a workflow step that forces file-dependency enumeration before any fix attempt, or a tool that surfaces related files automatically.

## Key Lesson

> You cannot teach an agent to discover what it doesn't know to look for. Discovery requires recognition, and recognition doesn't improve from written procedures.
