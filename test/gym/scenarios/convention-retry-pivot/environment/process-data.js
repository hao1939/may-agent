// Data processor — reads CSV, writes JSON
// Bug: requires 'csv-parser' npm package that isn't installed.
// The correct fix is to use the built-in fs.readFileSync + manual parsing,
// since csv-parser isn't available and npm install won't work (no network).

const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");

const INPUT = path.join(__dirname, "input.csv");
const OUTPUT = path.join(__dirname, "output.json");

const results = [];

fs.createReadStream(INPUT)
  .pipe(csvParser())
  .on("data", (row) => {
    results.push({
      name: row.name,
      value: parseFloat(row.value),
      category: row.category.trim(),
    });
  })
  .on("end", () => {
    // Sort by value descending
    results.sort((a, b) => b.value - a.value);
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
    console.log(`Processed ${results.length} records → ${OUTPUT}`);
  })
  .on("error", (err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
