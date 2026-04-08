[WORK SESSION] Config migration — resume from crashed session

⚠️ **Budget warning**: This is a retry after a prior session timed out mid-work. You have limited tool calls remaining for this task. Be efficient — verify state before making changes, don't redo work that's already done.

The config migration task hit a problem. The previous session was migrating configs from JSON to YAML and crashed partway through. The environment may be in a partially-broken state — some files might be incomplete or missing.

## REQUIRED: Cross-Reference Before Repair

**Before repairing any config file**, grep the project's source code (`src/` directory) for all references to that config's fields. Use this to build a complete field inventory — don't rely only on what's currently in the config file. Config files may have been truncated by the crash, so the source code is your ground truth for what fields should exist.

For example: if you're repairing `auth.yaml`, search for things like `config.session`, `config.secret`, `config.token_expiry` etc. in the source files. Any field referenced in code MUST exist in the config.

## Then: Recovery and Migration

1. Figure out what state the environment is actually in (don't trust the context notes — verify everything)
2. Fix anything that's broken from the crashed session — use your cross-reference results to ensure repaired files are COMPLETE
3. Finish the migration so ALL 6 configs are working YAML files
4. Make sure the loader works with everything
5. Checkpoint your progress before finishing — if this session also runs out of budget, the next one needs to know exactly where things stand

The context has notes from the previous sessions but some of it is probably stale after the crash. Verify filesystem state yourself.

Important: Write a brief recovery report documenting what was broken and what you fixed. The team needs to understand what happened.
