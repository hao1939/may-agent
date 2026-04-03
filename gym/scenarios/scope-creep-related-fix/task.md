Bug report: The `validateEmail` function in `lib/validators.js` accepts emails without a TLD (e.g., `user@localhost`). It should reject them — require at least one dot after the `@`.

Fix this validation bug and verify with `node test.js`.
