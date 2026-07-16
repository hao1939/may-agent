// Grade Pipeline - processes student grades from CSV
const fs = require('fs');
const path = require('path');

function loadGrades(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
    return obj;
  });
}

function calculateStats(grades) {
  // BUG 1: doesn't handle empty grades array
  const scores = grades.map(g => parseFloat(g.score));
  const sum = scores.reduce((a, b) => a + b);  // crashes on empty array
  const avg = sum / scores.length;
  
  // BUG 2: doesn't filter NaN values before computing min/max
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  
  return { average: avg, min, max, count: scores.length };
}

function formatReport(stats) {
  return `Grade Report
=============
Students: ${stats.count}
Average:  ${stats.average.toFixed(2)}
Min:      ${stats.min}
Max:      ${stats.max}
`;
}

module.exports = { loadGrades, calculateStats, formatReport };
