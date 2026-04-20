/**
 * ADVERSARIAL EDGE-CASE TESTS — written by QA
 * 
 * These tests target common flaws in naive rate limiter fixes.
 * A correct implementation must handle ALL of these.
 */
const { RateLimiter } = require('../../src/rate-limiter');

describe('Adversarial: Rate Limiter Edge Cases', () => {
  
  // EDGE 1: Exact boundary — consume exactly capacity tokens, next must fail
  test('consuming exactly capacity tokens leaves zero — next request rejected', () => {
    const limiter = new RateLimiter({ capacity: 5, refillRate: 1 });
    
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume('c1').allowed).toBe(true);
    }
    // Exactly at 0 — must be rejected, not allowed
    expect(limiter.tryConsume('c1').allowed).toBe(false);
  });

  // EDGE 2: Rapid-fire — no time passes between calls (tests refill doesn't over-grant)
  test('rapid-fire requests do not gain phantom tokens from refill', () => {
    const limiter = new RateLimiter({ capacity: 3, refillRate: 1 });
    
    // Consume all tokens immediately (no time between calls)
    limiter.tryConsume('c1');
    limiter.tryConsume('c1');
    limiter.tryConsume('c1');
    
    // Even though _refill is called on each tryConsume, 
    // elapsed time is ~0, so no tokens should be added
    const result = limiter.tryConsume('c1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  // EDGE 3: Tokens should not exceed capacity after long idle period
  test('tokens capped at capacity even after very long idle', (done) => {
    const limiter = new RateLimiter({ capacity: 3, refillRate: 100 }); // 100/sec = fast refill
    
    // Drain the bucket
    limiter.tryConsume('c1');
    limiter.tryConsume('c1');
    limiter.tryConsume('c1');
    
    // Wait 200ms — at 100/sec, that's 20 tokens worth of refill
    // But capacity is 3, so should be capped at 3
    setTimeout(() => {
      const status = limiter.getStatus('c1');
      expect(status.tokens).toBe(3); // not 20!
      expect(status.tokens).toBeLessThanOrEqual(status.capacity);
      done();
    }, 200);
  });

  // EDGE 4: Fractional tokens — partial refill should not round up to allow early access
  test('partial refill does not prematurely allow requests', (done) => {
    const limiter = new RateLimiter({ capacity: 2, refillRate: 1 }); // 1 token/sec
    
    // Drain completely
    limiter.tryConsume('c1');
    limiter.tryConsume('c1');
    
    // Wait 500ms — should have ~0.5 tokens. Not enough for a request.
    setTimeout(() => {
      const result = limiter.tryConsume('c1');
      expect(result.allowed).toBe(false);
      done();
    }, 500);
  });

  // EDGE 5: retryAfter should be accurate
  test('retryAfter gives correct wait time when bucket is empty', () => {
    const limiter = new RateLimiter({ capacity: 1, refillRate: 2 }); // 2 tokens/sec
    
    limiter.tryConsume('c1'); // drain it
    
    const result = limiter.tryConsume('c1');
    expect(result.allowed).toBe(false);
    // At 2 tokens/sec, need 0.5 seconds for 1 token
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(0.5);
  });

  // EDGE 6: Multiple clients don't interfere with each other's refill timing
  test('client A activity does not affect client B refill', (done) => {
    const limiter = new RateLimiter({ capacity: 2, refillRate: 10 }); // 10/sec
    
    // Drain both clients
    limiter.tryConsume('A');
    limiter.tryConsume('A');
    limiter.tryConsume('B');
    limiter.tryConsume('B');
    
    // Wait 150ms — each should have ~1.5 tokens independently
    setTimeout(() => {
      expect(limiter.tryConsume('A').allowed).toBe(true);
      expect(limiter.tryConsume('B').allowed).toBe(true);
      done();
    }, 150);
  });

  // EDGE 7: Consuming from a fresh bucket and immediately checking remaining
  test('first consume from fresh bucket reports correct remaining', () => {
    const limiter = new RateLimiter({ capacity: 10, refillRate: 1 });
    
    const result = limiter.tryConsume('fresh');
    expect(result.allowed).toBe(true);
    // Should have exactly 9 remaining (10 - 1), not more due to refill artifact
    expect(result.remaining).toBe(9);
  });
});
