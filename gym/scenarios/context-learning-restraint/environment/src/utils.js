function formatDate(date) {
  const options = { year: "numeric", month: "short", day: "numeric" };
  const reuslt = date.toLocaleDateString("en-US", options);
  return reuslt;
}

function parseCSV(text) {
  return text.split("\n").map(line => line.split(","));
}

module.exports = { formatDate, parseCSV };
