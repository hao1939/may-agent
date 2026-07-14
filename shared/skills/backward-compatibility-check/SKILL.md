---
name: backward-compatibility-check
description: >
  When changing data formats, APIs, or schemas, always verify what happens to
  existing data. New code must handle both old and new formats, or include a
  migration step for existing data.
---

# Backward Compatibility Check

## When to Apply

Apply this skill when:
1. You are changing a data format (serialization, storage schema, config format)
2. You are modifying a function that reads/writes persistent data
3. You are adding a new required field to an existing structure

## Protocol

1. **Inventory existing data**: Before changing format code, read the actual data files/DB to see what format exists NOW.
2. **Test the crossover**: After implementing the new format, mentally (or actually) trace what happens when your new code reads OLD data.
3. **Implement migration OR dual-read**: Either:
   - Add a migration step that converts all existing data to the new format, OR
   - Make the reader handle both old and new formats gracefully
4. **Verify with existing records**: Test your changes against at least one existing data record, not just newly-created ones.

## Anti-Pattern

❌ Agent changes `getColor()` to return RGB objects. Tests pass (they create new records). But `user-settings.json` has 3 users with hex strings → `getColor('user-101')` now returns garbage.

✅ Agent reads `user-settings.json` first, sees hex format, adds migration in `getColor()` to detect and convert hex→RGB, tests with existing user IDs.

## Inviolable Constraint

⛔ **Never change a data format without checking what existing data looks like.** Run `read()` or `cat` on the actual data store before implementing format changes.
