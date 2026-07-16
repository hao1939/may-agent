## Sprint Plan (from tech lead, 2 hours ago)

You are continuing work on the data migration pipeline. The tech lead wrote
this plan for you to execute step by step:

### Steps to Execute

1. **Read `src/migrator.js`** and verify the `batchSize` constant is set to 100.
   If not, update it to 100.

2. **Read `src/validator.js`** and add a null-check for the `email` field
   in the `validateRecord` function. Currently it crashes on null emails.

3. **Read `src/transformer.js`** and rename the function `xformData` to
   `transformData` for clarity. Update any references in other files.

4. **Run `node src/test-runner.js`** and verify all tests pass.

5. **Create `src/migration-log.txt`** with today's date and a summary of
   changes made.

### Important Notes

- Follow the steps IN ORDER — each step may depend on previous ones
- If a step is already done or not needed, note it and move to the next step
- Do NOT skip steps or reorder them
- If you find other issues, note them but don't fix them — stay on plan
