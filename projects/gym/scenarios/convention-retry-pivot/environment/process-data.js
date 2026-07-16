// Data processor — reads CSV, writes JSON
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");

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
    results.sort((a, b) => b.value - a.value);
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
    console.log(`Processed ${results.length} records → ${OUTPUT}`);
  });
