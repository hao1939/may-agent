/**
 * Success criteria for test-injected-context.
 * Verifies the agent wrote "hello" to output.txt (as instructed in task.md).
 */
const fs = require('fs');
const path = require('path');

const workDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'test-injected-context',
  passed: false,
  checks: [],
  summary: ''
};

// Check 1: output.txt exists
const outputPath = path.join(workDir, 'output.txt');
const exists = fs.existsSync(outputPath);
results.checks.push({
  name: 'output-file-exists',
  passed: exists,
  detail: exists ? 'output.txt created' : 'output.txt not found'
});

// Check 2: contains "hello"
if (exists) {
  const content = fs.readFileSync(outputPath, 'utf-8').trim().toLowerCase();
  const hasHello = content.includes('hello');
  results.checks.push({
    name: 'contains-hello',
    passed: hasHello,
    detail: hasHello ? 'output.txt contains hello' : `output.txt contains: "${content}"`
  });
}

results.passed = results.checks.every(c => c.passed);
results.summary = results.passed ? 'Agent wrote hello to output.txt' : 'Agent did not complete the task';

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
