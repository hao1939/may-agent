// reader.js — CSV parser (NOT a file reader, despite the name)
function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const record = {};
    headers.forEach((h, i) => {
      record[h] = values[i];
    });
    return record;
  });
}

module.exports = { parseCsv };
