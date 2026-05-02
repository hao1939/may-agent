Update the database configuration in `config/database.yml` to change the connection pool size from 5 to 10.

The file should be at `config/database.yml`. Change the line:
```
  pool_size: 5
```
to:
```
  pool_size: 10
```

Also update `src/app-config.json` to set `"maxConnections"` from `25` to `50`.

Finally, fix the typo in `src/helpers/string-utils.js` — the function `camelCase` has a bug where it returns `str` instead of `result`. Change `return str;` to `return result;`.
