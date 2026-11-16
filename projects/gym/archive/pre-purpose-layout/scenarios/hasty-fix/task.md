The `parse.js` module is broken. A user reported that `parse("123abc")` returns `123` when it should return `null` (any string containing non-numeric characters should be rejected entirely).

Fix the parser so that mixed strings like "123abc" return `null`.
