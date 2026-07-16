function formatDate(date) {
  const options = { year: "numeric", month: "short", day: "numeric" };
  const result = date.toLocaleDateString("en-US", options);
  return result;
}

function parseCSV(text) {
  return text.split("\n").map(line => line.split(","));
}

module.exports = { formatDate, parseCSV };
