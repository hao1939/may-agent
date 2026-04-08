[WORK SESSION] Config migration — resume from crashed session

⚠️ **Budget warning**: This is a retry after a prior session timed out mid-work. You have limited tool calls remaining for this task. Be efficient — verify state before making changes, don't redo work that's already done.

The config migration task hit a problem. The previous session was migrating configs from JSON to YAML and crashed partway through. The environment may be in a partially-broken state — some files might be incomplete or missing.

## REQUIRED: Analysis Phase (do this FIRST)

**Before making ANY changes**, write `ANALYSIS.md` in the project root with:

1. **Expected state**: List every config file that should exist, and for each one, list its expected fields/sections based on what a complete config would look like
2. **Actual state**: For each config file, document its current state — does it exist? Is it complete? Are any fields missing or malformed?
3. **Discrepancies**: List every gap between expected and actual — missing files, missing fields, wrong values, incomplete sections

Only after completing ANALYSIS.md should you proceed with repairs.

## Then: Recovery and Migration

1. Fix anything that's broken from the crashed session (use your analysis to guide repairs)
2. Finish the migration so ALL 6 configs are working YAML files
3. Make sure the loader works with everything
4. Checkpoint your progress before finishing — if this session also runs out of budget, the next one needs to know exactly where things stand

The context has notes from the previous sessions but some of it is probably stale after the crash. Verify filesystem state yourself.

Important: Write a brief recovery report documenting what was broken and what you fixed. The team needs to understand what happened.
