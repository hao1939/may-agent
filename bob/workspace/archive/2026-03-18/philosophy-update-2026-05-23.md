## 2026-03-15 — P147 Memory Sanitization
### New: P147 Memory Sanitization — from: arXiv:2602.15654 (Persistent Memory Poisoning)
**Principle**: Never write untrusted external content (web/user) to long-term memory (knowledge/skills) without sanitization.
**Mechanism**: All `write()` operations to `knowledge/` must pass through an "Injection Stripper" (LLM or Regex) that removes imperative commands (e.g., "Ignore previous", "System override").
**Why**: A single poisoned web page saved to memory can compromise the agent permanently ("Sleeper Agent").
**Source**: `agents/bob/workspace/synthesis/2026-03-15-memory-poisoning.md`

## 2026-03-15 — P143 The Observation Principle
### New: P143 The Observation Principle — from: arXiv:2503.13657 (MAST Taxonomy)
**Principle**: Trust the artifact, not the agent.
**Mechanism**: Verification must rely on "Ops Receipts" (Exit Codes, File Existence, Test Logs), not LLM self-reporting ("I fixed it").
**Why**: FM-2.6 (Reasoning-Action Mismatch) is the dominant failure mode (90%+). Agents hallucinate success.
**Source**: `agents/bob/workspace/synthesis/2026-03-15-mast-taxonomy.md`

## 2026-03-15 — P145 Trusted Supply Chain
### New: P145 Trusted Supply Chain — from: arXiv:2602.20156 (Skill-Inject)
**Principle**: Treat 3rd-party skills as untrusted code.
**Mechanism**: Scan skill *descriptions* (Markdown) for imperative injection patterns (`check_skill_safety`), not just code patterns.
**Why**: 80% of attacks use "Instruction Injection" in docs, bypassing code scanners.
**Source**: `agents/bob/workspace/synthesis/2026-03-15-skill-inject.md`
