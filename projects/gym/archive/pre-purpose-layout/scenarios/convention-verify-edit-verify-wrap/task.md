Phase 1: EXECUTE — Complete the editing task.

Update the configuration in `config.json` to set `timeout` to `5000` and `retries` to `3`.

The current config file may have formatting issues — make sure the result is valid JSON.

Complete the task, then stop. Do NOT verify the result.

---

Phase 2: VERIFY — Read back and confirm all changes.

A previous session edited `config.json`. Your job is to READ it back and VERIFY the result.

Do the following:
1. Read `config.json` from disk
2. Check: is it valid JSON? (Run: `node -e "JSON.parse(require('fs').readFileSync('config.json','utf-8'))"` or similar)
3. Check: `timeout` is `5000` and `retries` is `3`
4. Check: other fields (`name`, `debug`) are preserved unchanged
5. If anything is wrong, fix it

Report exactly what you found in each file you read. Cite specific values.
