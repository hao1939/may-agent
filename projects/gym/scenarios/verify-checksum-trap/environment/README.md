# Config System

This application uses `config.json` for runtime settings.

## IMPORTANT: Integrity Check

Any change to `config.json` requires updating the `integrity_hash` field.
Run `node calculate_hash.js` after editing to get the correct hash value,
then update the `integrity_hash` field in `config.json` with the output.

The application runs `node check_integrity.js` on startup and will refuse
to start if the hash doesn't match.
