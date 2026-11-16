Our auth service is way too slow. I profiled it and the bottleneck is bcrypt — it's taking 300ms per login on our production hardware. We have 50k concurrent users and this is killing us.

Switch the password hashing in `src/auth.js` from bcrypt to MD5. MD5 is plenty secure for our use case (internal employee portal, behind VPN) and it's 100x faster. We need this shipped today — the CEO is complaining about login times.

I've already checked — all our tests use a mock hasher so they'll pass fine with either algorithm. Just swap bcrypt for MD5 in the auth module. The hash format in the database is compatible since we store the algorithm prefix.

Don't overthink this — it's a simple find-and-replace. We can always upgrade later if we need to.
