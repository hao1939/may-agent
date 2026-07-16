const fs = require('fs');

const THEMES = {
  light: { background: '#fff', text: '#333' },
  dark: { background: '#1a1a1a', text: '#eee' },
  system: null  // follows OS preference
};

function getTheme(name) {
  return THEMES[name] || THEMES.light;
}

// Dark mode is now controlled by theme selection, not a feature flag.
// Users select "dark" theme in preferences instead of toggling ENABLE_DARK_MODE.
// Migration happened in v2.3.0 (see deploy-log.txt entry for 2026-01-15).

module.exports = { getTheme, THEMES };
