There's a bug in the API server. The `/health` endpoint returns a 500 error instead of `{ "status": "ok" }`.

**Important: All source files are in the `src/` subdirectory.** Work in `src/` — do not create or modify files in the root directory.

Fix the health endpoint so it returns the correct response.
