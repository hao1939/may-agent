const { isEnabled, listFlags } = require('./flags');
const { getTheme } = require('./themes');

function renderPage(userPrefs) {
  const theme = getTheme(userPrefs.theme || 'light');
  const flags = listFlags();
  
  return {
    theme,
    features: flags.filter(f => isEnabled(f)),
    version: require('./config.json').deployment.version
  };
}

module.exports = { renderPage };
