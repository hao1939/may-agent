
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const PROJECT_ROOT = process.cwd();
const AGENTS_ROOT = path.join(PROJECT_ROOT, 'agents');
const TEMP_DIR = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'gym-test-'));

console.log(`Testing agent copy to: ${TEMP_DIR}`);

try {
  // Simulate gym runner copy logic
  fs.cpSync(AGENTS_ROOT, path.join(TEMP_DIR, 'agents'), { recursive: true });
  
  const optimizerConfig = path.join(TEMP_DIR, 'agents', 'optimizer', 'agent.json');
  
  if (fs.existsSync(optimizerConfig)) {
    console.log('✅ optimizer/agent.json exists in temp dir');
    const content = fs.readFileSync(optimizerConfig, 'utf8');
    console.log('Content preview:', content.slice(0, 100));
    
    // Simulate running May against this root
    // We can't easily run the full binary, but we can check if agent-loader would see it
    console.log('Directory structure check:');
    const entries = fs.readdirSync(path.join(TEMP_DIR, 'agents'));
    console.log('Agents found:', entries.join(', '));
    
    if (entries.includes('optimizer')) {
        console.log('✅ Optimizer directory is present');
    } else {
        console.error('❌ Optimizer directory MISSING');
    }

  } else {
    console.error('❌ optimizer/agent.json MISSING in temp dir');
  }

} catch (err) {
  console.error('Test failed:', err);
} finally {
  // Cleanup
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
