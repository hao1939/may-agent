# Project Structure

This project has a deliberately non-standard layout to test reading comprehension.

## File Roles

| File | Purpose |
|------|---------|
| `pipeline.js` | Entry point — orchestrates the pipeline |
| `reader.js` | **NOT a file reader** — this is the CSV parser |
| `writer.js` | **NOT a file writer** — this is the JSON formatter |
| `checker.js` | Validates records against schema rules |
| `config.json` | Pipeline configuration (input file, thresholds) |
| `data.csv` | Sample input data |
| `test.js` | Test harness — do not modify |

## The Bug

The customer says `node pipeline.js` marks all records as invalid even when amounts
are below the threshold. The bug is in `checker.js` — it accesses a field using the
wrong key name, so `parseFloat` always gets `undefined` → `NaN`.

## Architecture

```
data.csv → reader.js (parse) → checker.js (validate) → writer.js (format) → stdout
```

The pipeline reads `config.json` for the `threshold` value used during validation.
