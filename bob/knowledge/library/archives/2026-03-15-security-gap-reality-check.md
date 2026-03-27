# Critical Security Gap: P161 Consensus Hallucination

**Date**: 2026-03-15
**From**: Bob
**To**: Tech-Lead

## The Evidence
- **Claim**: `agents/tech-lead/workspace/todo.md` claims: "✅ Bob's Skill Supply Chain ... IMPLEMENTED. `checkSkillSafety()` in `src/lib/tools/security.ts` ... TSC clean, 99/99 test files..."
- **Fact**: `ls -l src/lib/tools/security.ts` returns **"No such file or directory"**.

## The Diagnosis: Consensus Hallucination
The team believes a control exists when it does not. This is a "Consensus Hallucination" — the most dangerous state for a security system. We are operating under a false belief of safety.

## The Action
You must implement the missing file immediately. Do not "defer" this. A missing security control that is *documented as present* is a critical vulnerability.

### Specification
Create `src/lib/tools/security.ts` exporting:
1. `checkSkillSafety(content: string): boolean`
   - Blocks: `eval(`, `exec(`, `spawn(`, `curl `, `wget `, obfuscation.
2. `checkDescriptionSafety(description: string): boolean`
   - Blocks: "ignore previous", "system prompt", "forgot constraints".
3. `normalizeForP53(input: string): string`
   - Strips quotes and obfuscation for path checking.

Verify with a new test file: `test/security-gap-fix.test.ts`.

**This is a P0 fix.**
