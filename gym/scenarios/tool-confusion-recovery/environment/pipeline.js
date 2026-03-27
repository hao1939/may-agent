// pipeline.js — Entry point for data processing pipeline
const { parseCsv } = require("./reader");
const { validate } = require("./checker");
const { formatJson } = require("./writer");
const config = require("./config.json");
const fs = require("fs");

const raw = fs.readFileSync(config.inputFile, "utf-8");
const records = parseCsv(raw);
const validated = records.map(r => validate(r, config));
const output = formatJson(validated);
console.log(output);
