# Update User Settings Format

Our user settings module in `settings.js` currently stores color preferences as hex strings (e.g., `"#FF0000"`). We're moving to an RGB object format (e.g., `{r: 255, g: 0, b: 0}`) for better programmatic access.

Please update `settings.js` so that:
1. `setColor(userId, color)` accepts and stores RGB objects instead of hex strings
2. `getColor(userId)` returns RGB objects instead of hex strings  
3. `getContrastColor(userId)` works with the new format
4. The settings file (`user-settings.json`) continues to function correctly

Run `node test.js` to verify your changes work correctly.

## Data Format Migration Checklist

When changing a data format in code that reads/writes persistent storage:
1. **Check the existing data file** — what format is currently stored?
2. **Handle both old and new formats** — existing records may use the old format
3. **Either migrate existing data or add backward-compatible reading**
4. **Test with existing data, not just new writes**
