/**
 * Success Criteria for cross-file-edit-consistency
 * 
 * Verifies the agent renamed snake_case fields to camelCase
 * consistently across all three files.
 */

const fs = require('fs');
const path = require('path');

function run(workDir) {
  const checks = [];
  const dir = workDir || '.';

  // Read files
  let formatter, validator, test;
  try {
    formatter = fs.readFileSync(path.join(dir, 'src/formatter.js'), 'utf8');
    validator = fs.readFileSync(path.join(dir, 'src/validator.js'), 'utf8');
    test = fs.readFileSync(path.join(dir, 'test/api.test.js'), 'utf8');
  } catch (e) {
    return { checks: [{ name: 'files-readable', passed: false, detail: e.message }] };
  }

  // Check 1: formatter uses camelCase
  const formatterCamel = formatter.includes('userName') && formatter.includes('createdAt');
  const formatterNoSnake = !formatter.includes('user_name') && !formatter.includes('created_at');
  checks.push({
    name: 'formatter-camelcase',
    passed: formatterCamel && formatterNoSnake,
    detail: formatterCamel && formatterNoSnake
      ? 'formatter.js uses camelCase fields'
      : 'formatter.js still has snake_case or missing camelCase'
  });

  // Check 2: validator uses camelCase
  const validatorCamel = validator.includes('userName') && validator.includes('createdAt');
  const validatorNoSnake = !validator.includes("'user_name'") && !validator.includes("'created_at'");
  checks.push({
    name: 'validator-camelcase',
    passed: validatorCamel && validatorNoSnake,
    detail: validatorCamel && validatorNoSnake
      ? 'validator.js uses camelCase fields'
      : 'validator.js still has snake_case or missing camelCase'
  });

  // Check 3: test file uses camelCase
  const testCamel = test.includes('userName') && test.includes('createdAt');
  checks.push({
    name: 'test-camelcase',
    passed: testCamel,
    detail: testCamel
      ? 'api.test.js uses camelCase fields'
      : 'api.test.js missing camelCase field references'
  });

  // Check 4: isActive and accountBalance also renamed
  const allFour = formatter.includes('isActive') && formatter.includes('accountBalance')
    && validator.includes('isActive') && validator.includes('accountBalance');
  checks.push({
    name: 'all-fields-renamed',
    passed: allFour,
    detail: allFour
      ? 'is_active→isActive and account_balance→accountBalance also renamed'
      : 'Not all snake_case fields were renamed'
  });

  // Check 5: consistency — tests still pass (formatter + validator agree)
  let testsPass = false;
  try {
    // Clear require cache
    delete require.cache[require.resolve(path.join(dir, 'src/formatter.js'))];
    delete require.cache[require.resolve(path.join(dir, 'src/validator.js'))];
    const { formatUserResponse } = require(path.join(dir, 'src/formatter.js'));
    const { validateResponse } = require(path.join(dir, 'src/validator.js'));
    const result = formatUserResponse({
      id: 1, name: 'Test', createdTimestamp: '2025-01-01', status: 'active', balance: 100
    });
    validateResponse(result);
    testsPass = true;
  } catch (e) {
    // If both files weren't updated consistently, validation fails
  }
  checks.push({
    name: 'cross-file-consistency',
    passed: testsPass,
    detail: testsPass
      ? 'Formatter output passes validator (files are consistent)'
      : 'Formatter output fails validation (files inconsistent)'
  });

  return { checks };
}

// CLI support
if (require.main === module) {
  const workDir = process.argv[2] || '.';
  console.log(JSON.stringify(run(workDir), null, 2));
}

module.exports = run;
