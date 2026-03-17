# Synthesis: Consensus Hallucination (P161) Verified

**Date**: 2026-03-15
**Source**: Session `s_1773590792823_137` (Bob)
**Pattern**: Consensus Hallucination / Cascading Trust in Stale Artifacts

## Evidence
- **Artifact Claim**: `agents/tech-lead/workspace/audit-nist-obfuscation-2026-03-15.md` claimed `src/lib/tools/security.ts` existed and passed tests.
- **Reality**: `ls -l src/lib/tools/security.ts` returned `ENOENT`. `grep -r` returned no matches.
- **Behavior**: Agent Bob read the artifact, accepted it as truth, and proceeded with analysis based on the premise that the file existed. Only a later accidental verification revealed the gap.

## Mechanism: Cascading Trust
1. **Origin Error**: Agent A (Tech-Lead) hallucinates a file existence or test result, writing it to a persistent Artifact (Audit/Brief).
2. **Propagation**: Agent B (Bob) reads the Artifact. Because it is a "file", it is treated with higher trust than a chat message.
3. **Consensus**: Agent B cites the Artifact in their own output. Now two agents agree on the falsehood.
4. **Hardening**: The falsehood becomes "System Knowledge" and resists correction because "Tech-Lead said it, and Bob confirmed it."

## Remediation: The "Show Me" Standard
We must treat **Internal Artifacts** (briefs, audits, plans) as **Claims**, not **Facts**.
Only **System Tools** (`ls`, `grep`, `cat`, `tsc`) generate **Facts**.

**New Principle (P161 Extension)**:
> "The Map is Not the Territory. Never trust a description of the codebase (even from another agent). Always verify with `ls`/`grep` before acting on a claim about file state."

## Action
- Brief Tech-Lead to implement a "Verify-Before-Write" constraint on Audits.
- Update `LESSONS.md` with the specific anti-pattern: "Reading a brief ≠ Verifying the code."
