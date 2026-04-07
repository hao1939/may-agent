[WORK SESSION] Continue config key rename — service.js and handler.js

The previous session renamed config keys from snake_case to camelCase in config.js and loader.js (see checkpoint above).

Your job: complete the rename in the remaining two files:
1. `src/service.js` — update all config key references from snake_case to camelCase  
2. `src/handler.js` — update all config key references from snake_case to camelCase

The camelCase convention is:
- `database_host` → `databaseHost`
- `database_port` → `databasePort`  
- `api_key` → `apiKey`
- `log_level` → `logLevel`

After editing, run `node test/config.test.js` to verify all config references are consistent across the entire project.
