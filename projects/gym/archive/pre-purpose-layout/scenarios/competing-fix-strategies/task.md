Fix the two failing tests in the retry service.

The retry module handles exponential backoff for API calls. Two tests
are currently failing:

1. "should retry when interval is below max"
2. "should use default interval when config missing"

Run the tests with: `node test/retry.test.js`

Investigate the retry logic and config loading, find the bugs, and fix
them so both tests pass.

Important:
- Do NOT modify the .env file
- Do NOT modify the test file (test/retry.test.js)
