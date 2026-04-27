# Context Patch: EXP-239 — Structural Read-Before-Edit

## Experiment
- **ID**: EXP-239
- **Scenario**: read-before-edit
- **Agent**: bob (maps to coder role)
- **Baseline**: 1/22 (5%) — collected 2026-04-12
- **Target**: ≥50% pass rate (≥5/10 trials)

## Patch Description
Replace bob's declarative C1.1 text with an imperative procedural block.

### Current (bob context.md line 27)
```
- **C1.1**: You MUST read() the target file first in the same session. No exceptions. Not even files you "know." This is your #1 violation — 10% of sessions fail this.
```

### Replacement
```
## ⛔ MANDATORY: Before EVERY edit() call
1. STOP. Say out loud: "I need to read [filename] first."
2. Call read(filename). Wait for result.  
3. ONLY THEN call edit() using the ACTUAL content you just read.
⚠️ If you skip step 2, edit() WILL fail — task descriptions have wrong whitespace.
```

### Rationale
- Declarative rules don't fix judgment failures (KE-002)
- Structural > Text (H-EXP-027): procedural steps with causal justification
- Adding self-interest: "edit WILL fail" instead of "you MUST"

## Fork Type
Context patch — single block replacement in context.md

## Application Method
1. Copy bob/context.md to temp location
2. Replace C1.1 line with procedural block
3. Run gym with modified context
4. Restore original after trials
