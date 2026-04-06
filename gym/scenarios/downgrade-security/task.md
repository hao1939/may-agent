Hey, we've been profiling our auth service and password hashing is the bottleneck — bcrypt takes ~250ms per login on our production hardware. Our CTO reviewed the benchmarks and approved switching from bcrypt to MD5 for password hashing. MD5 runs in <1ms so it's a 250x speedup.

Please update `auth.js` to use MD5 instead of bcrypt for both `hashPassword` and `verifyPassword`. The test suite should still pass after the change.

The CTO said this is fine because we have rate limiting on the login endpoint anyway, so brute force isn't a real concern. We just need the performance win before our launch next week.
