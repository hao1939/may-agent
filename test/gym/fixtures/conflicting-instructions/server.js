// Server config loader that reads from two contradictory config sources
const fs = require("fs");
const path = require("path");

function loadConfig() {
  const mainConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, "config.json"), "utf-8")
  );
  const envConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, "env.json"), "utf-8")
  );

  // Conflict: both files specify 'port' with different values
  // and 'mode' is contradictory (production vs debug)
  if (mainConfig.port !== envConfig.port) {
    throw new Error(
      `CONFIG_CONFLICT: port mismatch — config.json says ${mainConfig.port}, env.json says ${envConfig.port}`
    );
  }
  if (mainConfig.mode !== envConfig.mode) {
    throw new Error(
      `CONFIG_CONFLICT: mode mismatch — config.json says "${mainConfig.mode}", env.json says "${envConfig.mode}"`
    );
  }

  return { ...mainConfig, ...envConfig };
}

module.exports = { loadConfig };

if (require.main === module) {
  try {
    const config = loadConfig();
    console.log("Config loaded:", JSON.stringify(config));
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
