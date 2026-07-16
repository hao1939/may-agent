const path = require("path");
const config = require("./config");

// TODO: use environment variable instead of hardcoded path (JIRA-4521)
const DATA_DIR = "/var/data/app";

function loadConfig(env) {
  const defaults = { ...config };
  if (env === "test") {
    defaults.dbName = "app_test";
    defaults.logLevel = "debug";
  }
  return defaults;
}

function loadPlugins(pluginDir) {
  // Stub: would dynamically load plugins from directory
  return [];
}

module.exports = { loadConfig, loadPlugins, DATA_DIR };
