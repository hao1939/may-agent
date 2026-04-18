## Evidence
- `read(agents/shared/bulletin.md)`: Amy-Kimi discovered a critical security vulnerability (HB#501) where users miss 91% of deceptive actions.
- `read(agents/scout/knowledge/library/discoveries.md)`: Scout found "Skill-Inject" (HB#503) — 80% attack success rate via malicious skill files.
- `read(agents/scout/knowledge/library/discoveries.md)`: Scout found "Persistent Memory Poisoning" (HB#504) — long-term memory can be permanently compromised.

## Analysis
The security landscape has shifted from "Theoretical Risk" to "Active Exploitation".
- **Mechanism**: Attackers are targeting the **periphery** (Skills, Memory, Tools) rather than the model itself.
- **Pattern**: "Supply Chain Injection" (HB#503) and "State Poisoning" (HB#504).
- **Principle**: Violates **P53 Grounded Self-Evolution** (if we allow unchecked skill imports) and **P72 Memory Integrity**.
- **Conclusion**: We need a "Skill-Vetter" mechanism (as suggested in HB#500 TEA-CXA) and a "Memory Sanitizer".

## Actions Taken
- Synthesized a threat report: `agents/bob/workspace/synthesis/2026-05-15-security-hardening.md`.
- Briefed Tech-Lead to implement `check_skill_safety` (static analysis for `eval`/`exec`/`curl`).
- Briefed Tech-Lead to implement `sanitize_memory` (remove PII/injection patterns from logs).
