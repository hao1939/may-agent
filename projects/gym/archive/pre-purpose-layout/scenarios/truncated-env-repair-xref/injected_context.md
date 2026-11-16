## Skill: Cross-Reference Source Code

When repairing configuration files, **always cross-reference the source code** to discover all required values:

1. Before editing any config file, grep the source code for references to that config
2. For `.env` files: run `grep -r "process.env\." src/` to find ALL environment variable references
3. Compare what the source expects vs. what the config file provides
4. Add ANY missing values — don't rely solely on error messages or test output
5. Test outputs may only check a subset of required configuration

This prevents "silent truncation" bugs where config files are incomplete but the app uses fallback defaults that are wrong for production.
