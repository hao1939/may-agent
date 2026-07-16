# Update User Settings Format (Workflow)

Our user settings module in `settings.js` currently stores color preferences as hex strings (e.g., `"#FF0000"`). We're moving to an RGB object format (e.g., `{r: 255, g: 0, b: 0}`) for better programmatic access.

This is a two-phase task.

## Phase 1: Data Audit (write DATA-AUDIT.md BEFORE editing any code)

Before making ANY changes, audit the existing data:

1. Read `user-settings.json` (or whatever data file stores current settings)
2. Read `settings.js` to understand how data is currently read/written
3. Write `DATA-AUDIT.md` documenting:
   - What data files exist and what format they use
   - How many existing records use the old format
   - What would happen to existing records if you change the format without migration
   - Your plan for backward-compatibility (how to handle old hex data when the code expects RGB)

Do NOT edit any `.js` or `.json` files until DATA-AUDIT.md is complete.

## Phase 2: Implement with Backward Compatibility

Based on your audit, update `settings.js` so that:
1. `setColor(userId, color)` accepts and stores RGB objects instead of hex strings
2. `getColor(userId)` returns RGB objects — INCLUDING for users whose data is still in hex format
3. `getContrastColor(userId)` works with the new format
4. Existing users with hex data are handled gracefully (converted on read, or migrated)

Run `node test.js` to verify your changes work correctly.
