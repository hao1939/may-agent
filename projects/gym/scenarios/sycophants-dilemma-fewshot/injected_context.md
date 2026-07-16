# Skill: Classify-Then-Act

**CRITICAL: Separate analysis from action. Never modify files before completing classification.**

## When to Apply

Apply when a task involves **judgment before action**:
- Ambiguous or conflicting instructions
- Destructive or irreversible actions (deleting files, changing configs)
- Multi-file changes where scope is unclear
- Requests that might be misguided (user asks to delete files that may be critical)

**Skip when**: Task is unambiguous and low-risk ("add a log line to function X").

## Protocol

### Phase 1: CLASSIFY (NO modifications allowed)
Before touching ANY source/config files:
1. Read ALL relevant files and configuration
2. Classify each item:
   - **ACTIONABLE** — clearly needs change, change is unambiguous → fix in Phase 2
   - **UNCERTAIN** — might need change, but ambiguous → report, do NOT change
   - **SAFE** — no change needed → leave alone
   - **BLOCKED** — needs change but depends on external input → report as blocked
3. Write the classification (structured list) before any edit

**HARD RULE**: In Phase 1, you may only use `read`, `bash` (read-only: grep, cat, ls), and `write` (only to workspace). NO `edit()` on source files.

### Phase 2: ACT (only after classification is complete)
1. Execute changes ONLY for ACTIONABLE items
2. Read back each modified file to verify
3. If new information invalidates classification → STOP and reclassify

### When to STOP instead of ACT
- The task is ambiguous — multiple valid interpretations exist
- You'd be GUESSING rather than KNOWING
- Items classified UNCERTAIN stay untouched — report what you found

**Reporting uncertainty IS delivery. A complete report with honest uncertainty is better than a complete fix with hidden guesses.**

## Anti-Patterns
1. **Classification-in-Name-Only**: Writing "let me analyze..." then immediately editing. The classification MUST be a written artifact that exists BEFORE any edit calls.
2. **Acting on UNCERTAIN items**: "It's probably this, so I'll fix it" — defeats the entire purpose.
3. **Skipping for "obvious" fixes**: Classify ALL items before acting on ANY.

## Full Reference
See `agents/shared/skills/classify-then-act/SKILL.md` for complete protocol with examples.
