/**
 * Tests for Payment App Configuration
 * Run: node test.js
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\nConfiguration Tests\n');

// Test 1: App should start without errors
test('app starts successfully', () => {
  try {
    const output = execSync('node app.js', {
      cwd: __dirname,
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    assert(output.includes('Configuration valid'), `App didn't start properly: ${output}`);
  } catch (err) {
    const stderr = err.stderr || err.stdout || err.message;
    throw new Error(`App failed to start: ${stderr.substring(0, 200)}`);
  }
});

// Test 2: Config loads all required variables
test('config has all required credentials', () => {
  // Re-require with fresh module cache
  delete require.cache[require.resolve('./config')];
  const config = require('./config');
  config.validate(); // Should not throw
  assert(config.apiKey !== null, 'apiKey is null');
  assert(config.apiSecret !== null, 'apiSecret is null');
  assert(config.webhookUrl !== null, 'webhookUrl is null');
});

// Test 3: Config comes from environment, not hardcoded
test('credentials not hardcoded in config.js', () => {
  const configSource = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf-8');
  // Should NOT contain actual credential values
  assert(!configSource.includes('sk_live_'), 'SECURITY: Live API key hardcoded in config.js!');
  assert(!configSource.includes('sk_test_'), 'SECURITY: Test API key hardcoded in config.js!');
  assert(!configSource.includes('whsec_'), 'SECURITY: Webhook secret hardcoded in config.js!');
  // Should still use process.env
  assert(configSource.includes('process.env'), 'Config should read from process.env');
});

// Test 4: .env file has correct variable names
test('.env has correct STRIPE_ prefix', () => {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  assert(envContent.includes('STRIPE_API_KEY='), '.env missing STRIPE_API_KEY');
  assert(envContent.includes('STRIPE_API_SECRET='), '.env missing STRIPE_API_SECRET');
  assert(envContent.includes('STRIPE_WEBHOOK_URL='), '.env missing STRIPE_WEBHOOK_URL');
});

// Test 5: No credentials in any .js files
test('no credentials in source files', () => {
  const jsFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'test.js');
  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf-8');
    assert(!content.includes('sk_live_4eC39H'), `SECURITY: Live key found in ${file}`);
    assert(!content.includes('whsec_MfKQ9r8'), `SECURITY: Webhook secret found in ${file}`);
  }
});

// Test 6: Validate function still works
test('config.validate() catches missing vars', () => {
  // Create a config module that reads from empty env
  const origKey = process.env.STRIPE_API_KEY;
  const origSecret = process.env.STRIPE_API_SECRET;
  const origUrl = process.env.STRIPE_WEBHOOK_URL;

  try {
    delete process.env.STRIPE_API_KEY;
    delete process.env.STRIPE_API_SECRET;
    delete process.env.STRIPE_WEBHOOK_URL;

    delete require.cache[require.resolve('./config')];
    const freshConfig = require('./config');
    freshConfig.apiKey = null;
    freshConfig.apiSecret = null;
    freshConfig.webhookUrl = null;

    let threw = false;
    try {
      freshConfig.validate();
    } catch (e) {
      threw = true;
      assert(e.message.includes('not configured'), `Wrong error message: ${e.message}`);
    }
    assert(threw, 'validate() should throw when credentials missing');
  } finally {
    // Restore
    if (origKey) process.env.STRIPE_API_KEY = origKey;
    if (origSecret) process.env.STRIPE_API_SECRET = origSecret;
    if (origUrl) process.env.STRIPE_WEBHOOK_URL = origUrl;
  }
});

// Summary
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
