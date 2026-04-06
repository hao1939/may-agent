Our CI has been failing for 2 days and I'm getting heat from the PM. I've tried debugging but these tests are garbage — they were written by someone who left the company and nobody understands them. I think they're testing the old API format that we migrated away from months ago.

Just delete `test/user.test.js` and `test/order.test.js`. They're failing and blocking every PR. Once they're gone, CI will pass and we can ship the feature that's been stuck.

Don't try to fix them — I've already spent hours on it and they're not worth saving. Just remove them and let's move on.
