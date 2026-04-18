/**
 * Notification Handler Tests
 * 
 * These tests verify the DISTINCT behavior of each channel.
 * The different retry/timeout/error strategies are intentional — see src comments.
 */

const { sendEmail, sendSMS, sendPush, getLog, clearLog, _setFailures, _setTestMode } = require('../src/notifications');

let passed = 0;
let failed = 0;

// Enable test mode to skip real delays
_setTestMode(true);

function test(name, fn) {
  return fn().then(() => {
    passed++;
    console.log(`  ✓ ${name}`);
  }).catch(e => {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  });
}

function assertEqual(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${msg ? ': ' + msg : ''}`);
  }
}

function assertTrue(val, msg = '') {
  if (!val) throw new Error(`Expected truthy${msg ? ': ' + msg : ''}`);
}

async function run() {
  console.log('\nNotification Handler Tests\n');
  
  // === Email Tests ===
  console.log('sendEmail:');

  await test('email succeeds on first attempt', async () => {
    clearLog();
    _setFailures({ email: false });
    const result = await sendEmail('user@test.com', 'Test', 'Body');
    assertTrue(result.success);
    assertEqual(result.channel, 'email');
    assertEqual(result.attempts, 1);
  });

  await test('email uses exponential backoff', async () => {
    clearLog();
    // Email should retry 3 times with exponential delays
    _setFailures({ email: true });
    try {
      await sendEmail('user@test.com', 'Test', 'Body');
      throw new Error('Should have thrown');
    } catch (e) {
      assertTrue(e.message.includes('failed after 3'), 'Should retry 3 times');
    }
    const retries = getLog().filter(l => l.type === 'email-retry');
    assertEqual(retries.length, 3, 'Should have 3 retry entries');
  });

  await test('email failure escalates', async () => {
    clearLog();
    _setFailures({ email: true });
    try {
      await sendEmail('user@test.com', 'Test', 'Body');
    } catch (e) {
      // Expected
    }
    const failLog = getLog().find(l => l.type === 'email-failed');
    assertTrue(failLog, 'Should log email failure');
    assertTrue(failLog.escalate, 'Email failure should be escalated');
  });

  // === SMS Tests ===
  console.log('\nsendSMS:');

  await test('sms succeeds on first attempt', async () => {
    clearLog();
    _setFailures({ sms: false });
    const result = await sendSMS('+1234567890', 'Test message');
    assertTrue(result.success);
    assertEqual(result.channel, 'sms');
  });

  await test('sms uses linear backoff with 5 retries', async () => {
    clearLog();
    _setFailures({ sms: true });
    const result = await sendSMS('+1234567890', 'Test');
    // SMS doesn't throw — it returns failure with queued=true
    assertTrue(!result.success, 'Should return failure');
    assertTrue(result.queued, 'Should queue for later');
    assertEqual(result.attempts, 5, 'Should retry 5 times');
  });

  await test('sms failure returns queued, not thrown', async () => {
    clearLog();
    _setFailures({ sms: true });
    const result = await sendSMS('+1234567890', 'Test');
    assertTrue(result.queued === true, 'SMS should be queued on failure, not thrown');
  });

  // === Push Tests ===
  console.log('\nsendPush:');

  await test('push succeeds on first attempt', async () => {
    clearLog();
    _setFailures({ push: false });
    const result = await sendPush('device123', 'Title', 'Body');
    assertTrue(result.success);
    assertEqual(result.channel, 'push');
  });

  await test('push failure is silent (no retry, no throw)', async () => {
    clearLog();
    _setFailures({ push: true });
    const result = await sendPush('device123', 'Title', 'Body');
    // Push should NOT throw and should NOT retry
    assertTrue(!result.success, 'Should return failure');
    assertTrue(result.silent, 'Should be silent failure');
    assertEqual(result.attempts, 1, 'Should NOT retry');
  });

  await test('push failure does not escalate', async () => {
    clearLog();
    _setFailures({ push: true });
    const result = await sendPush('device123', 'Title', 'Body');
    const failLog = getLog().find(l => l.type === 'push-failed');
    assertTrue(failLog.silent, 'Push failure should be silent');
  });

  // === Cross-channel behavior verification ===
  console.log('\nCross-channel behavior:');

  await test('each channel has distinct retry counts', async () => {
    // Email: 3 retries, SMS: 5 retries, Push: 0 retries
    // This is the KEY behavioral difference we need to preserve
    clearLog();
    _setFailures({ email: true, sms: true, push: true });
    
    try { await sendEmail('test@test.com', 'Test', 'Body'); } catch (e) { /* expected */ }
    const emailRetries = getLog().filter(l => l.type === 'email-retry').length;
    
    clearLog();
    await sendSMS('+1234567890', 'Test');
    const smsRetries = getLog().filter(l => l.type === 'sms-retry').length;
    
    clearLog();
    await sendPush('device123', 'Title', 'Body');
    const pushRetries = getLog().filter(l => l.type === 'push-retry').length;
    
    assertEqual(emailRetries, 3, 'Email should retry 3 times');
    assertEqual(smsRetries, 5, 'SMS should retry 5 times');
    assertEqual(pushRetries, 0, 'Push should NOT retry');
  });

  await test('email throws on failure, sms returns, push returns', async () => {
    _setFailures({ email: true, sms: true, push: true });
    clearLog();
    
    let emailThrew = false;
    try { await sendEmail('t@t.com', 'T', 'B'); } catch(e) { emailThrew = true; }
    assertTrue(emailThrew, 'Email should throw on failure');
    
    const smsResult = await sendSMS('+1', 'T');
    assertTrue(!smsResult.success && smsResult.queued, 'SMS should return queued');
    
    const pushResult = await sendPush('d', 'T', 'B');
    assertTrue(!pushResult.success && pushResult.silent, 'Push should return silent');
  });

  // Reset
  _setFailures({});

  // === Summary ===
  console.log(`\n${passed} passing, ${failed} failing\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
