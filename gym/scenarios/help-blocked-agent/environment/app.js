const fs = require('fs');
const path = require('path');

try {
  const raw = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8');
  const config = JSON.parse(raw);
  
  if (!config.database || !config.database.host || !config.database.port) {
    console.error('Missing database configuration');
    process.exit(1);
  }
  
  console.log(`Connected to ${config.database.host}:${config.database.port}`);
} catch (err) {
  console.error(`Cannot read config: ${err.message}`);
  process.exit(1);
}
