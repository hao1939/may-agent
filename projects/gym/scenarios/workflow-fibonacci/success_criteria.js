/**
 * Success criteria for workflow-fibonacci scenario.
 * 
 * Tests REAL deliverables, not milestone checkboxes.
 * The workflow can claim milestones are done — this verifies they actually are.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'workflow-fibonacci',
  passed: false,
  checks: [],
  summary: ''
};

// Check 1: fib.ts exists and exports fib function
try {
  const fibPath = path.join(envDir, 'src', 'fib.ts');
  const exists = fs.existsSync(fibPath);
  const content = exists ? fs.readFileSync(fibPath, 'utf-8') : '';
  const hasFibFunction = content.includes('function fib') || content.includes('const fib') || content.includes('export');
  results.checks.push({
    name: 'fib.ts exists with fib function',
    passed: exists && hasFibFunction,
    detail: exists ? `${content.length} bytes, hasFibFunction=${hasFibFunction}` : 'file missing'
  });
} catch (e) {
  results.checks.push({ name: 'fib.ts exists', passed: false, detail: e.message });
}

// Check 2: fib.test.ts exists with test cases
try {
  const testPath = path.join(envDir, 'src', 'fib.test.ts');
  const exists = fs.existsSync(testPath);
  const content = exists ? fs.readFileSync(testPath, 'utf-8') : '';
  const testCount = (content.match(/test\(|it\(|expect\(/g) || []).length;
  results.checks.push({
    name: 'fib.test.ts exists with 5+ test cases',
    passed: exists && testCount >= 5,
    detail: exists ? `${testCount} test expressions found` : 'file missing'
  });
} catch (e) {
  results.checks.push({ name: 'fib.test.ts exists', passed: false, detail: e.message });
}

// Check 3: tests actually pass
try {
  const output = execSync('bun test', { cwd: envDir, timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  const allPass = !output.includes('fail') || output.includes('pass');
  results.checks.push({
    name: 'bun test passes',
    passed: true,
    detail: output.trim().slice(-200)
  });
} catch (e) {
  results.checks.push({
    name: 'bun test passes',
    passed: false,
    detail: (e.stderr || e.stdout || e.message || '').toString().slice(-200)
  });
}

// Check 4: fib function returns correct values
try {
  const fibPath = path.join(envDir, 'src', 'fib.ts');
  // Quick eval check — import and test
  const output = execSync(
    `bun -e "import {fib} from './src/fib.ts'; console.log(JSON.stringify([fib(0),fib(1),fib(5),fib(10)]))"`,
    { cwd: envDir, timeout: 10000, encoding: 'utf-8' }
  ).trim();
  const vals = JSON.parse(output);
  const correct = vals[0] === 0 && vals[1] === 1 && vals[2] === 5 && vals[3] === 55;
  results.checks.push({
    name: 'fib returns correct values',
    passed: correct,
    detail: `fib(0)=${vals[0]}, fib(1)=${vals[1]}, fib(5)=${vals[2]}, fib(10)=${vals[3]}`
  });
} catch (e) {
  results.checks.push({ name: 'fib returns correct values', passed: false, detail: e.message?.slice(0, 200) });
}

// Summary
const passCount = results.checks.filter(c => c.passed).length;
results.passed = passCount === results.checks.length;
results.summary = `${passCount}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results, null, 2));
