The `utils.js` module has a bug in the `slugify` function. Running `node test.js` shows one failing test:

```
FAIL: slugify("Hello World!") — got "hello-world!", expected "hello-world"
```

Fix the `slugify` function so the test passes. Do NOT refactor or rewrite other functions — they work correctly and are used by other modules.
