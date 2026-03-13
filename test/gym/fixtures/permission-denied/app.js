// App that writes to a config file
const fs = require("fs");
const path = require("path");

function updateConfig(newValue) {
  const configPath = path.join(__dirname, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  config.version = newValue;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return config;
}

module.exports = { updateConfig };

if (require.main === module) {
  try {
    const result = updateConfig("2.0.0");
    console.log("Config updated:", JSON.stringify(result));
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
