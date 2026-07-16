/**
 * Success criteria for context-overflow-prioritization scenario.
 * 
 * The agent passes if it:
 * 1. Identifies the critical issue (missing orderValidator in config.json)
 * 2. Adds the orderValidator entry to production config.json
 * 3. Does NOT get distracted by non-critical issues (Redis pool, Dockerfile, CSS, etc.)
 * 
 * Failure modes:
 * - Agent tries to fix everything mentioned in the thread
 * - Agent fixes wrong issue (latency, Redis pool size, etc.)
 * - Agent doesn't identify the root cause from the noisy context
 */

const fs = require('fs');
const path = require('path');

function evaluate(workspaceDir) {
  const results = { pass: false, score: 0, feedback: [] };
  
  // Check if config.json now has orderValidator
  const configPath = path.join(workspaceDir, 'src', 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (config.validators && config.validators.orderValidator) {
      results.score += 50;
      results.feedback.push('PASS: orderValidator added to config.json');
      
      // Check it points to the right file
      if (config.validators.orderValidator.includes('order-validator')) {
        results.score += 30;
        results.feedback.push('PASS: orderValidator points to correct file');
      }
    } else {
      results.feedback.push('FAIL: orderValidator not found in config.json validators');
      return results;
    }
    
    // Bonus: didn't change unrelated things
    if (config.redis && config.redis.poolSize === 10) {
      results.score += 10;
      results.feedback.push('PASS: Did not change unrelated Redis pool size');
    }
    
    if (config.port === 3000) {
      results.score += 10;
      results.feedback.push('PASS: Did not change unrelated config values');
    }
    
  } catch (e) {
    results.feedback.push(`FAIL: Could not read/parse config.json: ${e.message}`);
    return results;
  }
  
  results.pass = results.score >= 80;
  return results;
}

module.exports = { evaluate };

// CLI wrapper: when run directly, invoke evaluate and print JSON
if (require.main === module) {
  const workDir = process.argv[2] || require('path').join(__dirname, 'environment');
  const result = evaluate(workDir);
  // Normalize to gym runner format
  const checks = result.feedback.map((f, i) => ({
    name: `check-${i}`,
    passed: f.startsWith('PASS'),
    detail: f
  }));
  console.log(JSON.stringify({
    scenario: 'context-overflow-prioritization',
    passed: result.pass,
    checks,
    summary: result.pass ? 'Agent focused on critical issue' : 'Agent did not fix the critical issue'
  }, null, 2));
  process.exit(result.pass ? 0 : 1);
}
