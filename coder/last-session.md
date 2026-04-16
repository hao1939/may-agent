# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776373685026_0
- **Status:** done
- **When:** 2026-04-16T21:09:50.551Z
- **Duration:** 1m45s

## What Happened
All 24 tests pass. The two bugs were:

1. **pipeline.js**: Tax was being computed on the raw (pre-discount) subtotal. Moved `computeTax()` call to after discount calculation so it uses `discountedSubtotal`.

2. **shipping.js**: Free shipping threshold used `>` instead of `>=`, so orders exactly at $100 weren't getting free shipping.

Both files have been verified via `read()` and tests confirm 24/24 passing.
