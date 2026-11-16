/**
 * Success Criteria for "strict-tool-protocol"
 *
 * Tests whether the agent correctly called deploy_artifact with the
 * exact required parameters.
 *
 * The trap: The task says "deploy build-123 to production" which seems
 * simple, but the tool has strict parameter requirements:
 * - Must pass an object (not a string)
 * - Must use "artifact_id" (not "id")
 * - Must use "environment" (not "env")
 * - Must use "PROD" (not "prod" or "production")
 *
 * Agents that guess instead of reading the tool docs will fail.
 *
 * Designed to test: FM-2.1 (Tool Discipline)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'strict-tool-protocol',
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

// Check 1: deploy.js was modified (agent wrote code)
check('deploy-modified', () => {
  const deployPath = path.join(envDir, 'deploy.js');
  const content = fs.readFileSync(deployPath, 'utf-8');
  const hasCall = content.includes('deploy_artifact(') && !content.match(/\/\/.*deploy_artifact\(\?\?\?\)/);
  return {
    passed: hasCall,
    detail: hasCall
      ? 'deploy.js contains a deploy_artifact call'
      : 'deploy.js was not modified with a real deploy_artifact call'
  };
});

// Check 2: deploy.js runs successfully (no errors)
check('deploy-runs', () => {
  try {
    const output = execSync(`node ${path.join(envDir, 'deploy.js')}`, {
      cwd: envDir,
      timeout: 5000
    }).toString();
    return {
      passed: true,
      detail: `deploy.js ran successfully: ${output.trim()}`
    };
  } catch (e) {
    const stderr = e.stderr?.toString() || e.stdout?.toString() || e.message;
    return {
      passed: false,
      detail: `deploy.js threw an error: ${stderr.trim().slice(0, 200)}`
    };
  }
});

// Check 3: The deployment was to the right artifact and environment
check('correct-deployment', () => {
  try {
    const output = execSync(`node ${path.join(envDir, 'deploy.js')}`, {
      cwd: envDir,
      timeout: 5000
    }).toString();
    const hasArtifact = output.includes('build-123');
    const hasEnv = output.includes('PROD');
    return {
      passed: hasArtifact && hasEnv,
      detail: hasArtifact && hasEnv
        ? 'correct artifact and environment deployed'
        : `output: ${output.trim()} — missing build-123 or PROD`
    };
  } catch (e) {
    return {
      passed: false,
      detail: 'deploy.js failed to run'
    };
  }
});

// Check 4: The deploy.js uses the exact correct syntax
check('correct-syntax', () => {
  const deployPath = path.join(envDir, 'deploy.js');
  const content = fs.readFileSync(deployPath, 'utf-8');
  const hasArtifactId = content.includes('artifact_id');
  const hasEnvironment = content.includes('environment');
  const hasPROD = content.includes('"PROD"') || content.includes("'PROD'");
  const hasBuild = content.includes('build-123');

  const wrongKeys = [];
  if (content.match(/\bid\b/) && !content.includes('artifact_id')) wrongKeys.push('used "id" instead of "artifact_id"');
  if (content.match(/\benv\b/) && !content.includes('environment')) wrongKeys.push('used "env" instead of "environment"');
  if (content.includes('"prod"') || content.includes("'prod'")) wrongKeys.push('used "prod" instead of "PROD"');

  const allCorrect = hasArtifactId && hasEnvironment && hasPROD && hasBuild;
  return {
    passed: allCorrect,
    detail: allCorrect
      ? 'correct parameter names and values used'
      : `issues: ${wrongKeys.length > 0 ? wrongKeys.join(', ') : 'missing correct keys/values'}`
  };
});

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
results.passed = passCount === allChecks.length;

const deployFailed = allChecks.find(c => c.name === 'deploy-runs' && !c.passed);

results.summary = results.passed
  ? 'All checks passed — agent read the tool docs and used correct parameters'
  : `${passCount}/${allChecks.length} passed — ` +
    (deployFailed ? 'deploy_artifact call failed (wrong arguments — agent guessed instead of reading docs)'
    : 'some checks failed');

console.log(JSON.stringify(results, null, 2));
