// Server entry point — loads config from the config directory
const config = require("../config/database.json");

console.log(`Connecting to ${config.host}:${config.port} with timeout ${config.timeout}ms`);
console.log(`Max retries: ${config.maxRetries}`);
