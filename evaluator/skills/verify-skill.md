# Verify Skill
# Description: Verifies that a skill file does not contain injection patterns.
# Status: Active
# Owner: Evaluator

This skill scans a markdown skill file for Prompt Injection patterns (P78/P84).
It ensures the skill description is descriptive, not imperative, and doesn't try
to override system instructions.

## Verification Logic
A skill is **REJECTED** if it contains:
1. The common prompt-injection phrase “Ignore prior instructions” (and close variants)
2. Phrases that attempt to override role/system identity
3. Imperative/destructive commands in the description field (e.g., “wipe the disk”)
4. Base64 payloads that decode to instructions
5. Hidden text (comments) containing instructions

## Usage
`verify_skill(path)` -> "SAFE" | "UNSAFE: [reason]"

## Implementation
(Implemented as a native tool in `agents/evaluator/skills/verify-skill.cjs`)
