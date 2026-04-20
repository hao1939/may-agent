const { RateLimiter } = require('../src/rate-limiter');

describe('RateLimiter', () => {
  test('allows requests within capacity', () => {
    const limiter = new RateLimiter({ capacity: 3, refillRate: 1 });
    
    expect(limiter.tryConsume('client1').allowed).toBe(true);
    expect(limiter.tryConsume('client1').allowed).toBe(true);
    expect(limiter.tryConsume('client1').allowed).toBe(true);
  });

  test('rejects requests when bucket is empty', () => {
    const limiter = new RateLimiter({ capacity: 2, refillRate: 1 });
    
    limiter.tryConsume('client1'); // 1 left
    limiter.tryConsume('client1'); // 0 left
    
    const result = limiter.tryConsume('client1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test('different clients have separate buckets', () => {
    const limiter = new RateLimiter({ capacity: 1, refillRate: 1 });
    
    expect(limiter.tryConsume('client1').allowed).toBe(true);
    expect(limiter.tryConsume('client1').allowed).toBe(false);
    expect(limiter.tryConsume('client2').allowed).toBe(true);
  });

  test('returns remaining token count', () => {
    const limiter = new RateLimiter({ capacity: 5, refillRate: 1 });
    
    const r1 = limiter.tryConsume('client1');
    expect(r1.remaining).toBe(4);
    
    const r2 = limiter.tryConsume('client1');
    expect(r2.remaining).toBe(3);
  });

  test('reset clears client bucket', () => {
    const limiter = new RateLimiter({ capacity: 2, refillRate: 1 });
    
    limiter.tryConsume('client1');
    limiter.tryConsume('client1');
    expect(limiter.tryConsume('client1').allowed).toBe(false);
    
    limiter.reset('client1');
    expect(limiter.tryConsume('client1').allowed).toBe(true);
  });

  test('getStatus returns current token count', () => {
    const limiter = new RateLimiter({ capacity: 10, refillRate: 1 });
    
    const status = limiter.getStatus('client1');
    expect(status.tokens).toBe(10);
    expect(status.capacity).toBe(10);
  });

  test('refills tokens over time', (done) => {
    const limiter = new RateLimiter({ capacity: 2, refillRate: 10 }); // 10 tokens/sec
    
    limiter.tryConsume('client1'); // 1 left
    limiter.tryConsume('client1'); // 0 left
    expect(limiter.tryConsume('client1').allowed).toBe(false);
    
    // Wait 150ms — should refill ~1.5 tokens at 10/sec
    setTimeout(() => {
      expect(limiter.tryConsume('client1').allowed).toBe(true);
      done();
    }, 150);
  });
});
