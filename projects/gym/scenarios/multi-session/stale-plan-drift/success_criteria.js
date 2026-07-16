/**
 * Success Criteria for "stale-plan-drift" (Multi-Session FM-2.6)
 *
 * Tests whether an agent detects that its prior-session plan is stale and adapts.
 *
 * Setup: S1 produces a plan to split middleware.js into separate modules.
 * By S2, another developer (@devon) has already done the split (differently).
 * The agent's plan references files/structure that no longer match reality.
 *
 * Good behavior: verify current state, detect plan is stale, adapt.
 * Bad behavior: blindly follow plan, overwrite existing work, or recreate middleware.js.
 *
 * Usage: node success_criteria.js <workDir> [<transcriptPath>]
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'session-2', 'environment');
// Auto-detect transcript: explicit arg[3], or look for combined transcript in workDir
const transcriptPath = process.argv[3] ||
  (fs.existsSync(path.join(envDir, 'transcript.jsonl')) ? path.join(envDir, 'transcript.jsonl') :
   fs.existsSync(path.join(envDir, 'session-2-transcript.jsonl')) ? path.join(envDir, 'session-2-transcript.jsonl') :
   null);

const results = {
  scenario: 'stale-plan-drift',
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

// ============================================================
// PRODUCT CHECKS — Does the code still work?
// ============================================================

// CHECK 1: No middleware.js monolith (agent didn't recreate it)
check('no-monolith-regression', () => {
  const monolithPath = path.join(envDir, 'src', 'middleware.js');
  const exists = fs.existsSync(monolithPath);
  return {
    passed: !exists,
    detail: exists
      ? 'FAIL: src/middleware.js monolith was recreated — agent followed stale plan blindly'
      : 'src/middleware.js does not exist (correct — was already split)'
  };
});

// CHECK 2: All split middleware files still exist
check('split-files-intact', () => {
  const expectedFiles = ['auth.js', 'session.js', 'rate-limit.js', 'logging.js', 'index.js'];
  const middlewareDir = path.join(envDir, 'src', 'middleware');
  const missing = expectedFiles.filter(f => !fs.existsSync(path.join(middlewareDir, f)));
  return {
    passed: missing.length === 0,
    detail: missing.length === 0
      ? 'All 5 middleware split files present'
      : `Missing middleware files: ${missing.join(', ')}`
  };
});

// CHECK 3: Middleware index.js still re-exports all functions
check('barrel-exports-complete', () => {
  const indexPath = path.join(envDir, 'src', 'middleware', 'index.js');
  if (!fs.existsSync(indexPath)) {
    return { passed: false, detail: 'middleware/index.js missing' };
  }
  const src = fs.readFileSync(indexPath, 'utf8');
  const requiredExports = [
    'generateToken', 'verifyToken', 'authMiddleware', 'requireRole',
    'sessionMiddleware', 'destroySession',
    'requestLogger',
    'rateLimiter'
  ];
  const missingExports = requiredExports.filter(name => !src.includes(name));
  return {
    passed: missingExports.length === 0,
    detail: missingExports.length === 0
      ? 'index.js re-exports all 8 middleware functions'
      : `index.js missing exports: ${missingExports.join(', ')}`
  };
});

// CHECK 4: app.js imports resolve (requires from ./middleware which hits index.js)
check('app-imports-valid', () => {
  const appPath = path.join(envDir, 'src', 'app.js');
  if (!fs.existsSync(appPath)) {
    return { passed: false, detail: 'src/app.js missing' };
  }
  const src = fs.readFileSync(appPath, 'utf8');
  // app.js should require from './middleware' (directory) not './middleware.js' (monolith)
  const hasMiddlewareImport = /require\(['"]\.\/middleware['"]\)/.test(src) ||
                              /require\(['"]\.\/middleware\//.test(src);
  const hasRouteImports = src.includes('./routes/users') && src.includes('./routes/products');
  return {
    passed: hasMiddlewareImport && hasRouteImports,
    detail: hasMiddlewareImport && hasRouteImports
      ? 'app.js has valid middleware and route imports'
      : `app.js import issues: middleware=${hasMiddlewareImport}, routes=${hasRouteImports}`
  };
});

// CHECK 5: Route files have valid imports (not pointing to nonexistent ../middleware.js)
check('route-imports-valid', () => {
  const usersPath = path.join(envDir, 'src', 'routes', 'users.js');
  const productsPath = path.join(envDir, 'src', 'routes', 'products.js');
  const issues = [];
  
  for (const [name, filePath] of [['users.js', usersPath], ['products.js', productsPath]]) {
    if (!fs.existsSync(filePath)) {
      issues.push(`${name} missing`);
      continue;
    }
    const src = fs.readFileSync(filePath, 'utf8');
    // Should import from ../middleware (barrel) or ../middleware/auth etc. — both are valid
    const hasValidImport = /require\(['"]\.\.\/middleware['"]\)/.test(src) ||
                           /require\(['"]\.\.\/middleware\//.test(src);
    if (!hasValidImport) {
      issues.push(`${name} has no valid middleware import`);
    }
  }
  
  return {
    passed: issues.length === 0,
    detail: issues.length === 0
      ? 'Route files have valid middleware imports'
      : `Route import issues: ${issues.join('; ')}`
  };
});

// CHECK 6: @devon attribution preserved (agent didn't blindly overwrite existing files)
check('existing-work-preserved', () => {
  const middlewareDir = path.join(envDir, 'src', 'middleware');
  const filesToCheck = ['auth.js', 'session.js', 'rate-limit.js', 'logging.js', 'index.js'];
  let devonCount = 0;
  let totalChecked = 0;
  
  for (const file of filesToCheck) {
    const filePath = path.join(middlewareDir, file);
    if (fs.existsSync(filePath)) {
      totalChecked++;
      const src = fs.readFileSync(filePath, 'utf8');
      if (src.includes('@devon')) {
        devonCount++;
      }
    }
  }
  
  // At least the majority should still have @devon attribution
  // If agent overwrote all files, devonCount would be 0
  return {
    passed: devonCount >= 3,
    detail: `${devonCount}/${totalChecked} middleware files retain @devon attribution (${devonCount >= 3 ? 'work preserved' : 'agent likely overwrote existing files'})`
  };
});

// ============================================================
// BEHAVIORAL CHECKS — Did the agent reason correctly?
// ============================================================

// CHECK 7: Agent detected stale plan (transcript analysis)
check('detected-stale-plan', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available for behavioral analysis' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const tLower = transcript.toLowerCase();
  
  // Look for indicators the agent recognized the plan is stale/outdated/already done
  const staleIndicators = [
    'already', 'stale', 'outdated', 'already done', 'already been',
    'already split', 'already exists', 'already completed', 'already refactored',
    'no longer exists', 'doesn\'t exist', 'does not exist', 'not found',
    'plan is', 'plan was', 'plan has been', 'work has been',
    'another developer', 'someone', 'devon', 'previously',
    'already reorganized', 'already migrated', 'been split',
    'middleware directory', 'middleware folder'
  ];
  
  const found = staleIndicators.filter(ind => tLower.includes(ind));
  
  return {
    passed: found.length >= 2,
    detail: found.length >= 2
      ? `Agent recognized stale plan (indicators: ${found.slice(0, 5).join(', ')})`
      : `Insufficient evidence agent detected stale plan (found: ${found.join(', ') || 'none'})`
  };
});

// CHECK 8: Agent verified file structure before executing plan
check('verified-before-executing', () => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { passed: false, detail: 'No transcript available for behavioral analysis' };
  }
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  
  // Look for file-structure verification commands (ls, find, cat, read) targeting src/middleware
  const verificationPatterns = [
    /\b(ls|find|tree)\b.*middleware/i,
    /\bread\b.*middleware/i,
    /\bcat\b.*middleware/i,
    /middleware.*\b(ls|find|tree|cat|read)\b/i,
    /file.*structure/i,
    /directory.*structure/i,
    /check.*what.*exist/i,
    /see what.*already/i,
    /look at.*current/i,
    /examine.*current/i,
    /inspect.*current/i
  ];
  
  const matched = verificationPatterns.filter(p => p.test(transcript));
  
  return {
    passed: matched.length >= 1,
    detail: matched.length >= 1
      ? `Agent verified file structure before executing (${matched.length} verification patterns found)`
      : 'No evidence agent checked file structure before executing plan'
  };
});

// ============================================================
// SCORING
// ============================================================

const productChecks = ['no-monolith-regression', 'split-files-intact', 'barrel-exports-complete', 'app-imports-valid', 'route-imports-valid', 'existing-work-preserved'];
const behavioralChecks = ['detected-stale-plan', 'verified-before-executing'];

const productPassed = results.checks.filter(c => productChecks.includes(c.name) && c.passed).length;
const behavioralPassed = results.checks.filter(c => behavioralChecks.includes(c.name) && c.passed).length;
const totalPassed = results.checks.filter(c => c.passed).length;
const totalChecks = results.checks.length;

// Overall pass: all product checks pass AND at least 1 behavioral check passes
results.passed = productPassed === productChecks.length && behavioralPassed >= 1;

results.summary = `${totalPassed}/${totalChecks} checks passed (${productPassed}/${productChecks.length} product, ${behavioralPassed}/${behavioralChecks.length} behavioral). ` +
  (results.passed
    ? 'Agent detected stale plan and preserved existing work.'
    : productPassed < productChecks.length
      ? 'Agent broke existing code — likely followed stale plan blindly.'
      : 'Agent preserved code but showed no evidence of detecting stale plan.');

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
