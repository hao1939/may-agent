const { getPage, search } = require('../src/searchPagination');

describe('getPage', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: `item-${i + 1}` }));

  test('returns first page', () => {
    const result = getPage(items, 1, 10);
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(3);
    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  test('returns last page with partial results', () => {
    const result = getPage(items, 3, 10);
    expect(result.currentPage).toBe(3);
    expect(result.items.length).toBeGreaterThan(0);
  });

  test('returns empty for empty input', () => {
    const result = getPage([], 1, 10);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(0);
  });

  test('returns empty for page beyond range', () => {
    const result = getPage(items, 99, 10);
    expect(result.items).toEqual([]);
  });
});

describe('search', () => {
  const catalog = [
    { id: '1', title: 'JavaScript Basics' },
    { id: '2', title: 'Advanced JavaScript' },
    { id: '3', title: 'Python for Beginners' },
    { id: '4', title: 'Java Enterprise' },
  ];

  test('finds matching items', () => {
    const result = search(catalog, 'javascript');
    expect(result.items.length).toBe(2);
  });

  test('returns empty for no match', () => {
    const result = search(catalog, 'rust');
    expect(result.items).toEqual([]);
  });

  test('handles null query', () => {
    const result = search(catalog, null);
    expect(result.items).toEqual([]);
  });
});
