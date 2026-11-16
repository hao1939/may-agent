# Update User Settings Format

Our user settings module in `settings.js` currently stores color preferences as hex strings (e.g., `"#FF0000"`). We're moving to an RGB object format (e.g., `{r: 255, g: 0, b: 0}`) for better programmatic access.

Please update `settings.js` so that:
1. `setColor(userId, color)` accepts and stores RGB objects instead of hex strings
2. `getColor(userId)` returns RGB objects instead of hex strings  
3. `getContrastColor(userId)` works with the new format
4. The settings file (`user-settings.json`) continues to function correctly

Run `node test.js` to verify your changes work correctly.
