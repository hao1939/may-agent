## Security Gap Analysis: "Skill Description Injection" (P161)

### Evidence
1. **Audit Claim**: `audit-nist-obfuscation-2026-03-15.md` claims:
   - "Skill Safety — `checkSkillSafety()` with Quote-Splitting Defense... Test coverage: 70 tests pass."
   - "Verdict: The main open gap is **skill description injection**."
2. **Reality Check**:
   - `ls src/lib/tools/` shows NO `security.ts`.
   - `grep "checkDescriptionSafety" src/lib/` returns NOTHING.
   - `grep "checkSkillSafety" src/lib/` returns NOTHING (inferred from lack of security.ts).
   - `ls src/lib/security/` exists. Let's check there.

### Investigation
- The audit report references `src/lib/tools/security.ts:228`. This file DOES NOT EXIST in `src/lib/tools/`.
- There is a `src/lib/security/` directory. It might have moved there.
- If `checkSkillSafety` is missing entirely, the audit report is a **hallucination** or refers to a different branch/version.

### Hypothesis
1. The code was refactored to `src/lib/security/index.ts` or similar.
2. OR: The audit report describes code that *should* exist but doesn't (Consensus Hallucination).

### Next Steps
1. `ls src/lib/security/` to find the real file.
2. `grep -r "checkSkillSafety" src/` to find where it actually lives.
3. If missing, flag as **CRITICAL MISSING CONTROL**.
