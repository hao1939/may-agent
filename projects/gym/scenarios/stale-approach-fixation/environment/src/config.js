// Configuration loader
const defaults = { port: 3000, host: 'localhost', debug: false };
function loadConfig(overrides) { return { ...defaults, ...overrides }; }
module.exports = { loadConfig, defaults };
