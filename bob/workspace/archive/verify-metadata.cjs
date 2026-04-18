
const fs = require('fs');
const path = require('path');

const scenarioPath = process.argv[2];
if (!scenarioPath) {
  console.error('Usage: node verify-metadata.cjs <scenario-path>');
  process.exit(1);
}

try {
  const jsonPath = path.join(scenarioPath, 'scenario.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('scenario.json not found at:', jsonPath);
    process.exit(1);
  }

  const content = fs.readFileSync(jsonPath, 'utf8');
  const meta = JSON.parse(content);

  console.log('Metadata loaded successfully:');
  console.log('Name:', meta.name);
  console.log('Agent Type:', meta.agent_type);
  console.log('Workflow:', meta.workflow);
  console.log('Tier:', meta.tier);
  console.log('Categories:', meta.categories);
  
  if (meta.agent_type === 'optimizer') {
    console.log('✅ Correct agent_type found for optimizer scenario');
  } else {
    console.error('❌ Unexpected agent_type:', meta.agent_type);
  }

} catch (err) {
  console.error('Failed to load metadata:', err.message);
}
