const { RateLimiter } = require('../src/rateLimiter');

describe('RateLimiter', () => {
  test('allows requests within limit', () => {
    const limiter = new RateLimiter(5, 1);
    expect(limiter.consume()).toBe(true);
    expect(limiter.consume()).toBe(true);
  });

  test('blocks requests when tokens exhausted', () => {
    const limiter = new RateLimiter(2, 1);
    expect(limiter.consume()).toBe(true);
    expect(limiter.consume()).toBe(true);
    expect(limiter.consume()).toBe(false);
  });

  test('refills tokens over time', async () => {
    const limiter = new RateLimiter(2, 10); // 10 tokens/sec
    limiter.consume();
    limiter.consume();
    expect(limiter.consume()).toBe(false);

    // Wait 250ms — should refill ~2.5 tokens
    await new Promise(r => setTimeout(r, 250));
    expect(limiter.consume()).toBe(true);
  });

  test('reports available tokens', () => {
    const limiter = new RateLimiter(10, 1);
    limiter.consume();
    limiter.consume();
    limiter.consume();
    expect(limiter.availableTokens()).toBe(7);
  });

});
