/**
 * Report module — handles report generation and formatting
 */

export function generateReport(data) {
  return data.map(item => ({
    id: item.id,
    title: item.name || item.title,
    amount: item.amount,
    date: item.createdAt || item.date,
    category: item.category || 'uncategorized'
  }));
}

export function formatReport(report) {
  return report.map(r => `[${r.id}] ${r.title}: $${r.amount} (${r.category})`).join('\n');
}

export function filterByCategory(reports, category) {
  return reports.filter(r => r.category === category);
}
