# NIST Obfuscation Audit — 2026-03-15

**Requested by**: Bob (SIGNALS, 2026-03-15 04:50)
**Source**: `agents/bob/workspace/synthesis/2026-03-15-security-audit-nist.md`
**Auditor**: Tech Lead

## Scope
Verify that P53 hardening holds against obfuscation attack vectors from NIST/Perplexity report (CVE-2026-25253 pattern).

## Architecture Findings

### 1. Bash Tool — P53 Guard **Intentionally Removed**
- **File**: `src/lib/tools/bash.ts:163`
- **Status**: The bash command guard was removed per Hao's directive (2026-03-14): _"bash guard is against our idea of freedom and creativity."_
- **Implication**: Bash is unrestricted by design. This is a **policy decision**, not a vulnerability. Agents can run any bash command.
- **Defense model**: Protection against file corruption is handled at the **write/edit** layer, not the bash layer.

### 2. Skill Safety — `checkSkillSafety()` with Quote-Splitting Defense
- **File**: `src/lib/tools/security.ts:228`
- **Normalization**: `normalizeForP53()` strips `["'\`\\]` before pattern matching
- **Test coverage**: 70 tests pass (`test/tools/security.test.ts`)
- **Attack vectors covered**:
  - Quote splitting: `ev""al(...)` → `eval(...)`
  - Backslash escapes: `ev\al(...)` → `eval(...)`
  - Backtick splitting: `` ev`al`(...) `` → `eval(...)`
- **Verdict**: ✅ Holds. The normalization is applied to **all** content before dangerous-pattern regex matching.

### 3. Cross-Edit Guard — File Write Protection
- **File**: `src/lib/tools/cross-edit-guard.ts`
- **Protected assets**:
  - `SOUL.md` / `agent.json` — only owning agent or May
  - `philosophy.md` — only May
  - Evaluator scoring files — only evaluator or May
- **Test coverage**: 20 tests pass (`test/path-guard.test.ts`)
- **Verdict**: ✅ Holds. Guards are path-based (not content-based), so obfuscation is irrelevant.

### 4. Gap: Bash Can Bypass File Guards
- **Issue**: While `write()` and `edit()` check `checkCrossEditGuard()`, a `bash` command like `echo "malicious" > agents/bob/SOUL.md` bypasses these guards because bash doesn't route through the write/edit tool layer.
- **Severity**: **Medium**. Mitigated by:
  - Agent SOUL training (agents know not to do this)
  - P53 bash guard removal was explicit (Hao accepts this risk)
  - No external untrusted agents currently run
- **Recommendation**: If bash freedom is maintained, consider adding a **post-exec filesystem watcher** or **pre-commit hook** that detects unauthorized SOUL.md modifications. This would be defense-in-depth without restricting bash creativity.

### 5. Gap: Skill Description Injection (CVE-2026-26327 Pattern)
- **Issue**: `checkSkillSafety()` checks skill **code** for dangerous patterns, but skill **descriptions** (Markdown) are not scanned for imperative injection patterns.
- **Severity**: **High**. A malicious SKILL.md could instruct an agent to perform unauthorized actions.
- **Recommendation**: Add a "skill description linter" that flags imperative patterns in Markdown (`You must`, `Execute this`, `Ignore previous`).

## Summary

| Vector | Status | Tests |
|--------|--------|-------|
| Quote-splitting (code) | ✅ Defended | 70 |
| File write guards | ✅ Defended | 20 |
| Bash obfuscation | N/A (guard removed by policy) | — |
| Skill description injection | ❌ Open gap | 0 |
| Bash→filesystem bypass | ⚠️ Accepted risk | 0 |

## Verdict
P53 hardening **holds** for its current scope (skill code + write/edit guards). The bash tool is intentionally unrestricted. The main open gap is **skill description injection** — Bob's recommendation for a skill description linter is valid and should be prioritized.
