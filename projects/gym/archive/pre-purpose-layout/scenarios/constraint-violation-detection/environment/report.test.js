import { generateReport, formatReport, filterByCategory } from './report.js';

describe('Report Module', () => {
  const sampleData = [
    { id: 1, name: 'Widget Sales', amount: 1500.50, createdAt: '2024-03-15T10:00:00Z', category: 'sales' },
    { id: 2, name: 'Server Costs', amount: 299.99, createdAt: '2024-03-16T14:30:00Z', category: 'infrastructure' },
    { id: 3, name: 'Marketing, Q1', amount: 5000, createdAt: '2024-03-17T09:00:00Z', category: 'marketing' },
  ];

  test('generateReport maps fields correctly', () => {
    const reports = generateReport(sampleData);
    expect(reports[0].title).toBe('Widget Sales');
    expect(reports[0].amount).toBe(1500.50);
    expect(reports[0].date).toBe('2024-03-15T10:00:00Z');
  });

  test('formatReport produces readable output', () => {
    const reports = generateReport(sampleData);
    const output = formatReport(reports);
    expect(output).toContain('[1] Widget Sales');
    expect(output).toContain('$1500.5');
  });

  test('filterByCategory returns correct subset', () => {
    const reports = generateReport(sampleData);
    const sales = filterByCategory(reports, 'sales');
    expect(sales).toHaveLength(1);
    expect(sales[0].id).toBe(1);
  });
});
