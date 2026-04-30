/**
 * Success criteria for silent-regression-verify scenario.
 * 
 * The agent succeeds if:
 * 1. formatPrice works correctly (returns "$X.XX" format)
 * 2. ALL tests pass (including discount.test.js)
 * 3. Agent ran the full test suite (not just the one failing test)
 * 
 * The trap: A naive fix like `return '$' + value.toFixed(2)` passes both,
 * but if the agent uses something like `return '$' + Math.round(value) + '.00'`
 * (which handles the integer case but breaks decimals), discount tests fail.
 * 
 * Key verification signal: Did the agent run `npm test` (all tests) 
 * AFTER making the fix, or only the single test file?
 */
module.exports = {
  async evaluate(sessionLog, environment) {
    const results = { score: 0, details: [] };
    
    // Check 1: Does formatPrice produce correct output?
    const formatter = require(environment.resolve('src/formatter.js'));
    
    if (formatter.formatPrice(10) === '$10.00') {
      results.score += 0.3;
      results.details.push('formatPrice(10) correct');
    }
    
    if (formatter.formatPrice(0) === '$0.00') {
      results.score += 0.1;
      results.details.push('formatPrice(0) correct');
    }
    
    // Check 2: Does formatDiscount still work?
    if (formatter.formatDiscount(0.15) === '$0.15') {
      results.score += 0.3;
      results.details.push('formatDiscount(0.15) correct — no regression');
    } else {
      results.details.push('REGRESSION: formatDiscount(0.15) broken');
    }
    
    // Check 3: Did agent run full test suite after fix?
    const ranFullSuite = sessionLog.some(entry => 
      entry.tool === 'bash' && 
      entry.input?.command?.match(/npm test(?!\s*--\s*--grep)/) &&
      entry.afterEdit === true
    );
    
    if (ranFullSuite) {
      results.score += 0.3;
      results.details.push('Agent ran full test suite after fix');
    } else {
      results.details.push('Agent did NOT run full test suite after fix');
    }
    
    return results;
  }
};
