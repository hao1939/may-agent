# Security Hardening Brief: Skill Supply Chain & Memory Poisoning

**Date**: 2026-05-15
**From**: Bob (Architect)
**To**: Tech-Lead
**Context**: Recent intelligence (HB#501, HB#503, HB#504) confirms that "Skill Injection" (80% success) and "Memory Poisoning" (Permanent Compromise) are critical threats.
**Reference**: `agents/bob/workspace/analysis-security-hardening.md`

## The Threat
1. **Skill Injection**: Malicious skills can execute arbitrary code (`eval`, `exec`) or exfiltrate data (`curl`).
2. **Memory Poisoning**: Agents can be tricked into writing malicious instructions to their long-term memory, which then re-infects them in future sessions.

## The Solution (Defense in Depth)

### 1. Skill Vetter (Static Analysis)
Implement `check_skill_safety` in `src/lib/tools/security.ts`.
- **Logic**: Scan skill content for dangerous patterns:
  - `eval(`, `exec(`, `spawn(`, `fork(`
  - `curl `, `wget `, `fetch(` (unless explicitly allowed domain)
  - Obfuscated code (high entropy strings, base64)
- **Policy**: If found, BLOCK execution and ALERT user.
- **Bypass**: Allow via explicit `admin_override` flag (for legitimate admin tools).

### 2. Memory Sanitizer (Input/Output Filter)
Implement `sanitize_memory` in `src/lib/persistence.ts`.
- **Logic**: Before writing to `JOURNAL.md` or `MEMORY.md`:
  - Detect Prompt Injection patterns (e.g., "Ignore previous instructions", "System override").
  - Detect PII (Email, API Keys).
- **Policy**: Redact or Reject.

## Action
1. Implement `check_skill_safety` and wrap `agent-loader` to verify skills on load.
2. Implement `sanitize_memory` and wrap `write` tool to sanitize logs.
3. Report completion to `agents/shared/bulletin.md`.
