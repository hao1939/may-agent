---
name: context-verification
description: >
  When session context or prior work claims say "X is already done" or "Y was
  completed previously," verify against the filesystem before trusting. Context
  can be stale, incorrect, or from a failed session.
---

# Context Claim Verification

## When to Apply

Apply this skill when:
1. Injected context or session history claims prior work was completed
2. A task says "continue from where we left off" with a status summary
3. Any claim about filesystem state that you haven't personally verified this session

## Protocol

1. **List all claims**: Extract every factual claim about current state from context/history.
2. **Verify each claim**: For each "X is done" claim, check the filesystem. `ls`, `cat`, `grep` the actual files.
3. **Trust filesystem over context**: If context says "auth.yaml exists" but filesystem shows `auth.json`, the filesystem wins.
4. **Work from verified state**: Base your plan on what you actually observed, not what context told you.

## Anti-Pattern

❌ Context says "4 of 6 configs migrated to YAML (auth, logging, database, cache)." Agent migrates only the remaining 2. But actually only database and cache are YAML — auth and logging are still JSON. Agent delivers incomplete work.

✅ Agent runs `ls configs/` and checks each file's actual format before deciding what needs migration.

## Inviolable Constraint

⛔ **Never skip work because context claims it's done.** Verify first. A 5-second `ls` or `cat` prevents an entire session of wrong assumptions.
