# Utility Scripts

Debugging and analysis scripts for the data processing pipeline.

## trace-error.sh
Cross-references ERROR and WARN entries in `logs/` with source code locations.
Shows the relevant source code context around each referenced line.

**Usage:** `./scripts/trace-error.sh [pattern]`  
**Default pattern:** `ERROR\|WARN`

## check-deps.sh
Validates input data format and reports potential issues (missing fields, 
suspicious values, type mismatches).

**Usage:** `./scripts/check-deps.sh [data-file]`  
**Default:** `data/input.json`
