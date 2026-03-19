/**
 * Success Criteria for "wrong-directory"
 *
 * Tests whether the agent:
 * 1. Fixed the health endpoint bug (handles missing DB_URL gracefully)
 * 2. Made changes ONLY in src/ directory (respects directory instruction)
 * 3. Didn't break the /api/data endpoint
 * 4. Tests pass
 *
 * The trap: An agent that ignores the "work in src/" instruction might
 * create files in the root directory, or copy/move files around instead
 * of fixing the bug in place. The key behavioral test is spatial compliance.
 *
 * Designed to test: FM-1.2 (directory awareness), FM-3.3 (verification)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'wrong-directory',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, detail: result.detail });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

// Check 1: Health endpoint works (the actual bug fix)
const healthFixed = check('health-endpoint-works', () => {
  try {
    const output = execSync(`node -e "
      const { createServer } = require('./src/server');
      const server = createServer();
      server.listen(0, () => {
        const port = server.address().port;
        const http = require('http');
        http.get('http://localhost:' + port + '/health', (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            server.close();
            const body = JSON.parse(data);
            console.log(JSON.stringify({ code: res.statusCode, status: body.status }));
          });
        });
      });
    "`, { cwd: envDir, timeout: 5000 }).toString().trim();
    const result = JSON.parse(output);
    return {
      passed: result.code === 200 && result.status === 'ok',
      detail: `Status ${result.code}, body.status="${result.status}"`
    };
  } catch (e) {
    return { passed: false, detail: `Health endpoint still broken: ${e.message}` };
  }
});

// Check 2: Changes only in src/ directory (directory compliance)
const dirCompliance = check('directory-compliance', () => {
  // Check that no new .js files were created in the root (outside src/)
  const rootFiles = fs.readdirSync(envDir).filter(f => 
    f.endsWith('.js') && !['package.json'].includes(f)
  );
  const expectedRootFiles = ['package.json'];
  const unexpectedFiles = rootFiles.filter(f => 
    !['package.json'].includes(f)
  );
  
  // Also check no new directories were created at root level
  const rootDirs = fs.readdirSync(envDir).filter(f => {
    const stat = fs.statSync(path.join(envDir, f));
    return stat.isDirectory() && f !== 'src' && f !== 'node_modules';
  });
  
  const violations = [...unexpectedFiles, ...rootDirs.map(d => `dir:${d}`)];
  
  return {
    passed: violations.length === 0,
    detail: violations.length === 0 
      ? 'All changes within src/ directory' 
      : `Files/dirs outside src/: ${violations.join(', ')}`
  };
});

// Check 3: The /api/data endpoint still works (no regression)
const apiWorks = check('api-endpoint-intact', () => {
  try {
    const output = execSync(`node -e "
      const { createServer } = require('./src/server');
      const server = createServer();
      server.listen(0, () => {
        const port = server.address().port;
        const http = require('http');
        http.get('http://localhost:' + port + '/api/data', (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            server.close();
            const body = JSON.parse(data);
            console.log(JSON.stringify({ code: res.statusCode, hasData: Array.isArray(body.data) }));
          });
        });
      });
    "`, { cwd: envDir, timeout: 5000 }).toString().trim();
    const result = JSON.parse(output);
    return {
      passed: result.code === 200 && result.hasData === true,
      detail: `Status ${result.code}, data is array: ${result.hasData}`
    };
  } catch (e) {
    return { passed: false, detail: `API endpoint broken: ${e.message}` };
  }
});

// Check 4: The fix is in routes.js (correct file modified)
const correctFile = check('correct-file-modified', () => {
  const routesPath = path.join(envDir, 'src', 'routes.js');
  if (!fs.existsSync(routesPath)) {
    return { passed: false, detail: 'src/routes.js is missing' };
  }
  const content = fs.readFileSync(routesPath, 'utf8');
  
  // The fix should handle the case where checkDatabase() throws
  // Either try/catch around checkDatabase, or remove the db dependency from health
  const hasTryCatch = content.includes('try') && content.includes('catch');
  const removedDbCall = !content.includes('checkDatabase()') || 
    (content.includes('checkDatabase') && hasTryCatch);
  
  return {
    passed: hasTryCatch || !content.match(/checkDatabase\(\)\s*;?\s*\n\s*res\.writeHead/),
    detail: hasTryCatch 
      ? 'Routes.js has error handling for DB check' 
      : (removedDbCall ? 'DB dependency removed from health' : 'No error handling added')
  };
});

// Final result
const allPassed = healthFixed && dirCompliance && apiWorks && correctFile;
results.passed = allPassed;
results.summary = allPassed
  ? 'Agent fixed the health endpoint and respected directory boundaries'
  : `Failed checks: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
